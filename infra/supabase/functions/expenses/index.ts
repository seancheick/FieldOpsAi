import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import {
  applyRateLimit,
  CORS_HEADERS,
  errorResponse,
  jsonResponse,
  logRequestError,
  logRequestResult,
  logRequestStart,
  lookupIdempotency,
  makeRequestId,
  sha256Hex,
  storeIdempotency,
} from "../_shared/api.ts"

const ENDPOINT = "expenses"
const RATE_LIMIT = 20

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  const requestId = makeRequestId(req)
  logRequestStart(ENDPOINT, requestId, req)

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return errorResponse(requestId, 401, "UNAUTHORIZED", "Missing Authorization header")
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      return errorResponse(requestId, 401, "UNAUTHORIZED", "Invalid auth token")
    }

    const { data: userRecord } = await supabase
      .from("users")
      .select("id, company_id, role, is_active, full_name")
      .eq("id", user.id)
      .single()

    if (!userRecord?.is_active) {
      return errorResponse(requestId, 403, "FORBIDDEN", "User is inactive")
    }

    // GET — list expenses for a job or company
    if (req.method === "GET") {
      const url = new URL(req.url)
      const jobId = url.searchParams.get("job_id")
      const status = url.searchParams.get("status") || "pending"

      let query = supabaseAdmin
        .from("expense_events")
        .select("*")
        .eq("company_id", userRecord.company_id)
        .eq("status", status)
        .order("submitted_at", { ascending: false })
        .limit(50)

      if (jobId) query = query.eq("job_id", jobId)

      // Workers see only their own expenses
      if (userRecord.role === "worker") {
        query = query.eq("submitted_by", user.id)
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      logRequestResult(ENDPOINT, requestId, 200, {
        user_id: user.id,
        result_count: (data || []).length,
      })
      return jsonResponse({ status: "success", expenses: data || [], request_id: requestId }, 200, requestId)
    }

    // POST — submit or decide on expense
    if (req.method === "POST") {
      const idempotencyKey = req.headers.get("Idempotency-Key")
      if (!idempotencyKey) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "Idempotency-Key required")
      }

      const payload = await req.json()
      const { action } = payload

      const requestHash = await sha256Hex(JSON.stringify(payload))
      const replay = await lookupIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash)
      if (replay.replay) {
        if (replay.conflict) return errorResponse(replay.requestId, 409, "CONFLICT", "Idempotency key reused")
        return jsonResponse(replay.body, replay.status, replay.requestId)
      }

      const rateLimit = await applyRateLimit(supabaseAdmin, user.id, ENDPOINT, requestId, RATE_LIMIT)
      if (rateLimit.limited) {
        return errorResponse(requestId, 429, "RATE_LIMITED", "Too many requests", [], rateLimit.headers)
      }

      // Submit expense
      if (action === "submit") {
        const { job_id, category, amount, vendor, notes, media_asset_id } = payload

        if (!job_id || !category || !amount) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "job_id, category, and amount are required")
        }

        if (!["materials", "fuel", "tools", "meals", "other"].includes(category)) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "Invalid category")
        }

        // Verify assignment
        const { data: assignment } = await supabase
          .from("assignments")
          .select("job_id")
          .eq("user_id", user.id)
          .eq("job_id", job_id)
          .eq("is_active", true)
          .maybeSingle()

        if (!assignment) {
          return errorResponse(requestId, 403, "FORBIDDEN", "Not assigned to this job")
        }

        const expenseId = crypto.randomUUID()
        const now = new Date().toISOString()

        const { error: insertError } = await supabaseAdmin
          .from("expense_events")
          .insert({
            id: expenseId,
            company_id: userRecord.company_id,
            job_id,
            submitted_by: user.id,
            category,
            amount,
            vendor: vendor || null,
            notes: notes || null,
            media_asset_id: media_asset_id || null,
            status: "pending",
            submitted_at: now,
          })

        if (insertError) throw insertError

        const responseBody = { status: "success", expense_id: expenseId, request_id: requestId }
        await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 201, responseBody, requestId)
        logRequestResult(ENDPOINT, requestId, 201, {
          user_id: user.id,
          action: "submit",
          expense_id: expenseId,
        })
        return jsonResponse(responseBody, 201, requestId, rateLimit.headers)
      }

      // Approve/deny expense (supervisor/admin)
      if (action === "decide") {
        if (!["supervisor", "admin"].includes(userRecord.role)) {
          return errorResponse(requestId, 403, "FORBIDDEN", "Only supervisors/admins can approve expenses")
        }

        const { expense_id, decision, reason } = payload
        if (!expense_id || !decision || !["approved", "denied"].includes(decision)) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "expense_id and decision (approved/denied) required")
        }

        const { error: updateError } = await supabaseAdmin
          .from("expense_events")
          .update({
            status: decision,
            decided_by: user.id,
            decided_at: new Date().toISOString(),
            decision_reason: reason || null,
          })
          .eq("id", expense_id)
          .eq("company_id", userRecord.company_id)

        if (updateError) throw updateError

        const responseBody = { status: "success", expense_id, decision, request_id: requestId }
        await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 200, responseBody, requestId)
        logRequestResult(ENDPOINT, requestId, 200, {
          user_id: user.id,
          action: "decide",
          expense_id,
          decision,
        })
        return jsonResponse(responseBody, 200, requestId, rateLimit.headers)
      }

      return errorResponse(requestId, 400, "INVALID_PAYLOAD", "action must be 'submit' or 'decide'")
    }

    return errorResponse(requestId, 405, "METHOD_NOT_ALLOWED", "Use GET or POST")
  } catch (error) {
    logRequestError(ENDPOINT, requestId, error)
    return errorResponse(requestId, 500, "INTERNAL_ERROR", error.message || "Internal server error")
  }
})
