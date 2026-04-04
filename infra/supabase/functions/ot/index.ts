import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import {
  applyRateLimit,
  CORS_HEADERS,
  errorResponse,
  jsonResponse,
  lookupIdempotency,
  makeRequestId,
  sha256Hex,
  storeIdempotency,
} from "../_shared/api.ts"

const ENDPOINT = "ot"
const OT_RATE_LIMIT = 20

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  const requestId = makeRequestId(req)

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

    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id, company_id, role, is_active, full_name")
      .eq("id", user.id)
      .single()

    if (userError || !userRecord) {
      return errorResponse(requestId, 401, "UNAUTHORIZED", "User record not found")
    }
    if (!userRecord.is_active) {
      return errorResponse(requestId, 403, "FORBIDDEN", "User is inactive")
    }

    // ──────────────────────────────────────────────────────────
    // GET /ot?job_id=<uuid>&status=<pending|approved|denied>
    // List OT requests (workers see their own, supervisors see all for company)
    // ──────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url)
      const jobId = url.searchParams.get("job_id")
      const status = url.searchParams.get("status") || "pending"

      let query = supabaseAdmin
        .from("ot_requests")
        .select(`
          id,
          job_id,
          worker_id,
          requested_at,
          total_hours_at_request,
          notes,
          status,
          request_photo_event_id,
          created_at,
          users!ot_requests_worker_id_fkey ( full_name ),
          jobs!ot_requests_job_id_fkey ( name, code )
        `)
        .eq("company_id", userRecord.company_id)
        .eq("status", status)
        .order("requested_at", { ascending: false })
        .limit(50)

      if (jobId) {
        query = query.eq("job_id", jobId)
      }

      // Workers only see their own requests
      if (userRecord.role === "worker") {
        query = query.eq("worker_id", user.id)
      }

      const { data: requests, error: fetchError } = await query
      if (fetchError) throw fetchError

      return jsonResponse({
        status: "success",
        ot_requests: requests || [],
        count: (requests || []).length,
        request_id: requestId,
      }, 200, requestId)
    }

    // ──────────────────────────────────────────────────────────
    // POST /ot — Two actions: "request" (worker) or "decide" (supervisor)
    // ──────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const idempotencyKey = req.headers.get("Idempotency-Key")
      if (!idempotencyKey) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "Idempotency-Key header is required")
      }

      const payload = await req.json()
      const { action } = payload

      if (!action || !["request", "decide"].includes(action)) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "action must be 'request' or 'decide'")
      }

      const requestHash = await sha256Hex(JSON.stringify(payload))
      const replay = await lookupIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash)
      if (replay.replay) {
        if (replay.conflict) {
          return errorResponse(replay.requestId, 409, "CONFLICT", "Idempotency key reused with different payload")
        }
        return jsonResponse(replay.body, replay.status, replay.requestId)
      }

      const rateLimit = await applyRateLimit(supabaseAdmin, user.id, ENDPOINT, requestId, OT_RATE_LIMIT)
      if (rateLimit.limited) {
        return errorResponse(requestId, 429, "RATE_LIMITED", "Too many OT requests", [], rateLimit.headers)
      }

      // ── ACTION: request (worker submits OT request) ──
      if (action === "request") {
        const { job_id, total_hours, notes, photo_event_id } = payload

        if (!job_id) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "job_id is required")
        }

        // Verify worker is assigned
        const { data: assignment } = await supabase
          .from("assignments")
          .select("job_id")
          .eq("user_id", user.id)
          .eq("job_id", job_id)
          .eq("is_active", true)
          .maybeSingle()

        if (!assignment) {
          return errorResponse(requestId, 403, "FORBIDDEN", "Worker is not assigned to this job")
        }

        // Verify photo exists if provided
        if (photo_event_id) {
          const { data: photoEvent } = await supabaseAdmin
            .from("photo_events")
            .select("id")
            .eq("id", photo_event_id)
            .eq("company_id", userRecord.company_id)
            .maybeSingle()

          if (!photoEvent) {
            return errorResponse(requestId, 400, "INVALID_PAYLOAD", "photo_event_id not found")
          }
        }

        const otRequestId = crypto.randomUUID()
        const now = new Date().toISOString()

        const { error: insertError } = await supabaseAdmin
          .from("ot_requests")
          .insert({
            id: otRequestId,
            company_id: userRecord.company_id,
            job_id,
            worker_id: user.id,
            request_photo_event_id: photo_event_id || null,
            requested_at: now,
            total_hours_at_request: total_hours || null,
            notes: notes || null,
            status: "pending",
            source_event_uuid: otRequestId,
          })

        if (insertError) throw insertError

        const responseBody = {
          status: "success",
          ot_request_id: otRequestId,
          request_id: requestId,
        }

        await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 201, responseBody, requestId)
        return jsonResponse(responseBody, 201, requestId, rateLimit.headers)
      }

      // ── ACTION: decide (supervisor approves or denies) ──
      if (action === "decide") {
        const { ot_request_id, decision, reason } = payload

        if (!ot_request_id || !decision) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "ot_request_id and decision are required")
        }
        if (!["approved", "denied"].includes(decision)) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "decision must be 'approved' or 'denied'")
        }
        if (!reason || reason.trim().length === 0) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "reason is required for OT decisions")
        }

        // Only supervisors and admins can approve
        if (!["supervisor", "admin"].includes(userRecord.role)) {
          return errorResponse(requestId, 403, "FORBIDDEN", "Only supervisors or admins can approve OT requests")
        }

        // Fetch the OT request
        const { data: otRequest, error: otError } = await supabaseAdmin
          .from("ot_requests")
          .select("id, company_id, job_id, worker_id, status")
          .eq("id", ot_request_id)
          .maybeSingle()

        if (otError) throw otError
        if (!otRequest) {
          return errorResponse(requestId, 404, "NOT_FOUND", "OT request not found")
        }

        // Must be same company
        if (otRequest.company_id !== userRecord.company_id) {
          return errorResponse(requestId, 403, "FORBIDDEN", "OT request belongs to a different company")
        }

        // Cannot approve own request
        if (otRequest.worker_id === user.id) {
          return errorResponse(requestId, 403, "FORBIDDEN", "Cannot approve your own OT request")
        }

        // Must be pending
        if (otRequest.status !== "pending") {
          return errorResponse(requestId, 400, "INVALID_TRANSITION",
            `OT request is already '${otRequest.status}'. Decisions are immutable.`)
        }

        const now = new Date().toISOString()
        const approvalEventId = crypto.randomUUID()

        // Update ot_requests status
        const { error: updateError } = await supabaseAdmin
          .from("ot_requests")
          .update({ status: decision })
          .eq("id", ot_request_id)

        if (updateError) throw updateError

        // Create ot_approval_event
        const { error: eventError } = await supabaseAdmin
          .from("ot_approval_events")
          .insert({
            id: approvalEventId,
            company_id: userRecord.company_id,
            job_id: otRequest.job_id,
            ot_request_id,
            worker_id: otRequest.worker_id,
            approver_id: user.id,
            decision,
            reason,
            occurred_at: now,
            received_at: now,
            source_event_uuid: approvalEventId,
          })

        if (eventError) {
          // Rollback — revert status to pending
          await supabaseAdmin
            .from("ot_requests")
            .update({ status: "pending" })
            .eq("id", ot_request_id)
          throw eventError
        }

        const responseBody = {
          status: "success",
          ot_request_id,
          decision,
          approval_event_id: approvalEventId,
          request_id: requestId,
        }

        await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 200, responseBody, requestId)
        return jsonResponse(responseBody, 200, requestId, rateLimit.headers)
      }
    }

    return errorResponse(requestId, 405, "METHOD_NOT_ALLOWED", "Use GET or POST for /ot")
  } catch (error) {
    console.error("ot error:", error)
    return errorResponse(requestId, 500, "INTERNAL_ERROR", error.message || "Internal server error")
  }
})
