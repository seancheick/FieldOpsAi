import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import {
  CORS_HEADERS,
  errorResponse,
  jsonResponse,
  logRequestError,
  logRequestResult,
  logRequestStart,
  makeRequestId,
} from "../_shared/api.ts"
import { isSupervisorOrAbove } from "../_shared/roles.ts"

const ENDPOINT = "alerts"

/**
 * Alert system — generates and manages alert_events.
 *
 * GET /alerts — List alerts for the company (filterable by status, job_id)
 * POST /alerts — Generate alerts by scanning recent events (called periodically or on-demand)
 * POST /alerts (action=resolve) — Resolve or dismiss an alert
 */
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
      .select("id, company_id, role, is_active")
      .eq("id", user.id)
      .single()

    if (!userRecord?.is_active) {
      return errorResponse(requestId, 403, "FORBIDDEN", "User is inactive")
    }

    // GET — list alerts
    if (req.method === "GET") {
      const url = new URL(req.url)
      const status = url.searchParams.get("status") || "open"
      const jobId = url.searchParams.get("job_id")

      let query = supabaseAdmin
        .from("alert_events")
        .select("*")
        .eq("company_id", userRecord.company_id)
        .eq("status", status)
        .order("triggered_at", { ascending: false })
        .limit(50)

      if (jobId) query = query.eq("job_id", jobId)

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      logRequestResult(ENDPOINT, requestId, 200, {
        user_id: user.id,
        result_count: (data || []).length,
      })
      return jsonResponse({
        status: "success",
        alerts: data || [],
        count: (data || []).length,
        request_id: requestId,
      }, 200, requestId)
    }

    // POST — scan for alerts or resolve
    if (req.method === "POST") {
      if (!isSupervisorOrAbove(userRecord.role)) {
        return errorResponse(requestId, 403, "FORBIDDEN", "Only supervisors, admins, or owners can manage alerts")
      }

      const payload = await req.json()
      const { action } = payload

      // Resolve an alert
      if (action === "resolve") {
        const { alert_id, resolution } = payload
        if (!alert_id) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "alert_id required")
        }

        const resolveStatus = resolution === "dismiss" ? "dismissed" : "resolved"
        const { error: updateError } = await supabaseAdmin
          .from("alert_events")
          .update({
            status: resolveStatus,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
          })
          .eq("id", alert_id)
          .eq("company_id", userRecord.company_id)

        if (updateError) throw updateError

        logRequestResult(ENDPOINT, requestId, 200, {
          user_id: user.id,
          action: "resolve",
          alert_id,
          resolution: resolveStatus,
        })
        return jsonResponse({
          status: "success",
          alert_id,
          resolution: resolveStatus,
          request_id: requestId,
        }, 200, requestId)
      }

      // Scan for new alerts
      if (action === "scan") {
        const today = new Date().toISOString().split("T")[0]
        const alertsGenerated: string[] = []

        // 1. Check for unapproved OT past threshold
        const { data: pendingOT } = await supabaseAdmin
          .from("ot_requests")
          .select("id, job_id, worker_id, requested_at")
          .eq("company_id", userRecord.company_id)
          .eq("status", "pending")
          .lt("requested_at", new Date(Date.now() - 3600000).toISOString()) // pending > 1 hour

        for (const ot of pendingOT || []) {
          const alertId = crypto.randomUUID()
          const { error } = await supabaseAdmin
            .from("alert_events")
            .insert({
              id: alertId,
              company_id: userRecord.company_id,
              job_id: ot.job_id,
              user_id: ot.worker_id,
              alert_type: "unapproved_ot",
              severity: "high",
              status: "open",
              message: `OT request pending for over 1 hour (requested ${new Date(ot.requested_at).toLocaleTimeString()})`,
              triggered_at: new Date().toISOString(),
            })
          if (!error) alertsGenerated.push(alertId)
        }

        // 2. Check for jobs with no clock-ins today
        const { data: activeJobs } = await supabaseAdmin
          .from("jobs")
          .select("id, name")
          .eq("company_id", userRecord.company_id)
          .in("status", ["active", "in_progress"])

        for (const job of activeJobs || []) {
          const { count } = await supabaseAdmin
            .from("clock_events")
            .select("id", { count: "exact", head: true })
            .eq("job_id", job.id)
            .eq("event_subtype", "clock_in")
            .gte("occurred_at", `${today}T00:00:00Z`)

          if ((count || 0) === 0) {
            const alertId = crypto.randomUUID()
            const { error } = await supabaseAdmin
              .from("alert_events")
              .insert({
                id: alertId,
                company_id: userRecord.company_id,
                job_id: job.id,
                alert_type: "no_clock_ins",
                severity: "medium",
                status: "open",
                message: `No clock-ins today for job: ${job.name}`,
                triggered_at: new Date().toISOString(),
              })
            if (!error) alertsGenerated.push(alertId)
          }
        }

        logRequestResult(ENDPOINT, requestId, 200, {
          user_id: user.id,
          action: "scan",
          alerts_generated: alertsGenerated.length,
        })
        return jsonResponse({
          status: "success",
          alerts_generated: alertsGenerated.length,
          alert_ids: alertsGenerated,
          request_id: requestId,
        }, 200, requestId)
      }

      return errorResponse(requestId, 400, "INVALID_PAYLOAD", "action must be 'scan' or 'resolve'")
    }

    return errorResponse(requestId, 405, "METHOD_NOT_ALLOWED", "Use GET or POST")
  } catch (error) {
    logRequestError(ENDPOINT, requestId, error)
    console.error("alerts error:", error)
    return errorResponse(requestId, 500, "INTERNAL_ERROR", error.message || "Internal server error")
  }
})
