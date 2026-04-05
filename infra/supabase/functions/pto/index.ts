import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import {
  applyRateLimit,
  corsHeaders,
  errorResponse,
  jsonResponse,
  logRequestError,
  logRequestResult,
  logRequestStart,
  makeRequestId,
} from "../_shared/api.ts"

const ENDPOINT = "pto"
const PTO_RATE_LIMIT = 20

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) })
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

    // Rate limit
    const rateLimit = await applyRateLimit(supabaseAdmin, user.id, ENDPOINT, requestId, PTO_RATE_LIMIT, 60)
    if (rateLimit.limited) {
      logRequestResult(ENDPOINT, requestId, 429, { reason: "rate_limited" })
      return errorResponse(requestId, 429, "RATE_LIMITED", "Too many requests", [], rateLimit.headers)
    }

    // ─── GET: List PTO requests ───────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url)
      const statusFilter = url.searchParams.get("status")

      let query = supabaseAdmin
        .from("pto_requests")
        .select("id, user_id, pto_type, start_date, end_date, day_count, status, notes, decided_by, decided_at, decision_reason, created_at, users!pto_requests_user_id_fkey(full_name)")
        .eq("company_id", userRecord.company_id)
        .order("start_date", { ascending: false })
        .limit(100)

      // Workers see only their own; supervisors/admins see all
      if (!["supervisor", "admin"].includes(userRecord.role)) {
        query = query.eq("user_id", user.id)
      }

      if (statusFilter) {
        query = query.eq("status", statusFilter)
      }

      const { data: requests, error: fetchError } = await query

      if (fetchError) {
        logRequestError(ENDPOINT, requestId, fetchError)
        return errorResponse(requestId, 500, "INTERNAL_ERROR", "Failed to fetch PTO requests")
      }

      logRequestResult(ENDPOINT, requestId, 200, { user_id: user.id, count: (requests || []).length })
      return jsonResponse({ requests: requests || [], request_id: requestId }, 200, requestId)
    }

    // ─── POST: Submit or decide ───────────────────────────
    if (req.method !== "POST") {
      return errorResponse(requestId, 405, "METHOD_NOT_ALLOWED", "Use GET or POST")
    }

    const payload = await req.json()
    const { action } = payload

    // ── Action: request ──────────────────────────────────
    if (action === "request") {
      const { pto_type, start_date, end_date, notes } = payload

      if (!pto_type || !start_date || !end_date) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "pto_type, start_date, and end_date are required")
      }

      if (!["vacation", "sick", "personal"].includes(pto_type)) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "pto_type must be vacation, sick, or personal")
      }

      if (start_date > end_date) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "start_date must be before or equal to end_date")
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("pto_requests")
        .insert({
          company_id: userRecord.company_id,
          user_id: user.id,
          pto_type,
          start_date,
          end_date,
          notes: notes || null,
          status: "pending",
        })
        .select("id, pto_type, start_date, end_date, day_count, status, notes, created_at")
        .single()

      if (insertError) {
        logRequestError(ENDPOINT, requestId, insertError)
        return errorResponse(requestId, 500, "INTERNAL_ERROR", "Failed to submit PTO request")
      }

      logRequestResult(ENDPOINT, requestId, 201, { user_id: user.id, pto_id: inserted.id, pto_type })
      return jsonResponse({
        status: "submitted",
        pto_request: inserted,
        request_id: requestId,
      }, 201, requestId)
    }

    // ── Action: decide (approve/deny) ────────────────────
    if (action === "decide") {
      if (!["supervisor", "admin"].includes(userRecord.role)) {
        return errorResponse(requestId, 403, "FORBIDDEN", "Only supervisors or admins can decide PTO requests")
      }

      const { pto_request_id, decision, reason } = payload

      if (!pto_request_id || !decision) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "pto_request_id and decision are required")
      }

      if (!["approved", "denied"].includes(decision)) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "decision must be approved or denied")
      }

      // Fetch the request to validate
      const { data: existing } = await supabaseAdmin
        .from("pto_requests")
        .select("id, status, user_id, company_id")
        .eq("id", pto_request_id)
        .eq("company_id", userRecord.company_id)
        .single()

      if (!existing) {
        return errorResponse(requestId, 404, "NOT_FOUND", "PTO request not found")
      }

      if (existing.status !== "pending") {
        return errorResponse(requestId, 409, "CONFLICT", `PTO request is already ${existing.status}`)
      }

      // Cannot approve own PTO
      if (existing.user_id === user.id) {
        return errorResponse(requestId, 403, "FORBIDDEN", "Cannot approve or deny your own PTO request")
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("pto_requests")
        .update({
          status: decision,
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          decision_reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pto_request_id)
        .select("id, pto_type, start_date, end_date, day_count, status, decided_by, decided_at, decision_reason")
        .single()

      if (updateError) {
        logRequestError(ENDPOINT, requestId, updateError)
        return errorResponse(requestId, 500, "INTERNAL_ERROR", "Failed to update PTO request")
      }

      logRequestResult(ENDPOINT, requestId, 200, { user_id: user.id, pto_id: updated.id, decision })
      return jsonResponse({
        status: "decided",
        pto_request: updated,
        request_id: requestId,
      }, 200, requestId)
    }

    // ── Action: cancel (worker cancels own pending) ──────
    if (action === "cancel") {
      const { pto_request_id } = payload

      if (!pto_request_id) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "pto_request_id is required")
      }

      const { data: existing } = await supabaseAdmin
        .from("pto_requests")
        .select("id, status, user_id, company_id")
        .eq("id", pto_request_id)
        .eq("company_id", userRecord.company_id)
        .eq("user_id", user.id)
        .single()

      if (!existing) {
        return errorResponse(requestId, 404, "NOT_FOUND", "PTO request not found")
      }

      if (existing.status !== "pending") {
        return errorResponse(requestId, 409, "CONFLICT", `Cannot cancel — PTO request is already ${existing.status}`)
      }

      const { error: cancelError } = await supabaseAdmin
        .from("pto_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", pto_request_id)

      if (cancelError) {
        logRequestError(ENDPOINT, requestId, cancelError)
        return errorResponse(requestId, 500, "INTERNAL_ERROR", "Failed to cancel PTO request")
      }

      logRequestResult(ENDPOINT, requestId, 200, { user_id: user.id, pto_id: pto_request_id, action: "cancelled" })
      return jsonResponse({ status: "cancelled", request_id: requestId }, 200, requestId)
    }

    return errorResponse(requestId, 400, "INVALID_PAYLOAD", "action must be 'request', 'decide', or 'cancel'")
  } catch (error) {
    logRequestError(ENDPOINT, requestId, error)
    console.error("pto error:", error)
    return errorResponse(requestId, 500, "INTERNAL_ERROR", error.message || "Internal server error")
  }
})
