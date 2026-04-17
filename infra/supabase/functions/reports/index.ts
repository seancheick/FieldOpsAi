import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"
import {
  applyRateLimit,
  CORS_HEADERS,
  corsHeaders,
  errorResponse,
  jsonResponse,
  logRequestStart,
  logRequestResult,
  logRequestError,
  makeRequestId,
} from "../_shared/api.ts"
import { isSupervisorOrAbove } from "../_shared/roles.ts"

const ENDPOINT = "reports"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) })
  }

  const requestId = makeRequestId(req)

  try {
    if (req.method !== "POST") {
      return errorResponse(requestId, 405, "METHOD_NOT_ALLOWED", "Use POST for /reports")
    }

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

    // Only supervisors/admins/owners can generate reports
    if (!isSupervisorOrAbove(userRecord.role)) {
      return errorResponse(requestId, 403, "FORBIDDEN", "Only supervisors, admins, or owners can generate reports")
    }

    logRequestStart(ENDPOINT, requestId, req)

    // Rate limit: 10 requests per 60 seconds per user
    const rateLimit = await applyRateLimit(supabaseAdmin, user.id, ENDPOINT, requestId, 10, 60)
    if (rateLimit.limited) {
      logRequestResult(ENDPOINT, requestId, 429, { reason: "rate_limited" })
      return errorResponse(requestId, 429, "RATE_LIMITED", "Too many report requests. Try again shortly.", [], rateLimit.headers)
    }

    const payload = await req.json()
    const { report_type, job_id, date_from, date_to } = payload

    if (!report_type) {
      return errorResponse(requestId, 400, "INVALID_PAYLOAD", "report_type is required (job_report or timesheet)")
    }

    // ──────────────────────────────────────────
    // JOB REPORT — Full job summary with timeline
    // ──────────────────────────────────────────
    if (report_type === "job_report") {
      if (!job_id) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "job_id is required for job_report")
      }

      // Fetch job
      const { data: job } = await supabaseAdmin
        .from("jobs")
        .select("id, name, code, status, site_name, geofence_radius_m, created_at")
        .eq("id", job_id)
        .eq("company_id", userRecord.company_id)
        .single()

      if (!job) {
        return errorResponse(requestId, 404, "NOT_FOUND", "Job not found")
      }

      // Fetch all supplementary data in parallel (no dependencies between queries)
      const [
        { data: clockEvents },
        { data: tasks },
        { data: photoEvents },
        { data: otApprovals },
      ] = await Promise.all([
        supabaseAdmin
          .from("clock_events")
          .select("id, user_id, event_subtype, occurred_at, gps_lat, gps_lng, users!clock_events_user_id_fkey(full_name)")
          .eq("job_id", job_id)
          .eq("company_id", userRecord.company_id)
          .order("occurred_at", { ascending: true })
          .limit(500),
        supabaseAdmin
          .from("tasks")
          .select("id, name, status, requires_photo, completed_at, completed_by")
          .eq("job_id", job_id)
          .eq("company_id", userRecord.company_id)
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("photo_events")
          .select("id, occurred_at, media_asset_id, user_id, is_checkpoint")
          .eq("job_id", job_id)
          .eq("company_id", userRecord.company_id)
          .order("occurred_at", { ascending: true })
          .limit(200),
        supabaseAdmin
          .from("ot_approval_events")
          .select("id, worker_id, decision, reason, occurred_at, users!ot_approval_events_approver_id_fkey(full_name)")
          .eq("job_id", job_id)
          .eq("company_id", userRecord.company_id)
          .order("occurred_at", { ascending: true }),
      ])

      // Compute worker hours
      const workerHours = computeWorkerHours(clockEvents || [])

      // Fetch media verification codes for photos
      const mediaIds = (photoEvents || []).map((pe: any) => pe.media_asset_id).filter(Boolean)
      let mediaAssets: any[] = []
      if (mediaIds.length > 0) {
        const { data } = await supabaseAdmin
          .from("media_assets")
          .select("id, verification_code, sha256_hash")
          .in("id", mediaIds)
        mediaAssets = data || []
      }

      const report = {
        report_type: "job_report",
        generated_at: new Date().toISOString(),
        generated_by: userRecord.full_name,
        job: {
          name: job.name,
          code: job.code,
          status: job.status,
          site_name: job.site_name,
        },
        summary: {
          total_clock_events: (clockEvents || []).length,
          total_photos: (photoEvents || []).length,
          total_tasks: (tasks || []).length,
          completed_tasks: (tasks || []).filter((t: any) => t.status === "completed").length,
          total_ot_decisions: (otApprovals || []).length,
        },
        worker_hours: workerHours,
        tasks: (tasks || []).map((t: any) => ({
          name: t.name,
          status: t.status,
          requires_photo: t.requires_photo,
          completed_at: t.completed_at,
        })),
        photos: (photoEvents || []).map((pe: any) => {
          const asset = mediaAssets.find((a: any) => a.id === pe.media_asset_id)
          return {
            occurred_at: pe.occurred_at,
            verification_code: asset?.verification_code || null,
            is_checkpoint: pe.is_checkpoint,
          }
        }),
        ot_decisions: (otApprovals || []).map((ot: any) => ({
          decision: ot.decision,
          reason: ot.reason,
          occurred_at: ot.occurred_at,
          approver: ot.users?.full_name || "Unknown",
        })),
        clock_events: (clockEvents || []).map((ce: any) => ({
          worker: ce.users?.full_name || "Unknown",
          subtype: ce.event_subtype,
          occurred_at: ce.occurred_at,
          gps: ce.gps_lat && ce.gps_lng ? `${ce.gps_lat.toFixed(4)}, ${ce.gps_lng.toFixed(4)}` : null,
        })),
      }

      // Store as export artifact
      const artifactId = crypto.randomUUID()
      await supabaseAdmin.from("export_artifacts").insert({
        id: artifactId,
        company_id: userRecord.company_id,
        job_id,
        generated_by: user.id,
        export_kind: "job_report_pdf",
        status: "completed",
        generated_at: new Date().toISOString(),
        metadata: { report_data: report },
      })

      return jsonResponse({
        status: "success",
        artifact_id: artifactId,
        report,
        request_id: requestId,
      }, 200, requestId)
    }

    // ──────────────────────────────────────────
    // TIMESHEET — CSV-ready worker hours export
    // ──────────────────────────────────────────
    if (report_type === "timesheet") {
      const from = date_from || new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]
      const to = date_to || new Date().toISOString().split("T")[0]

      // Fetch all clock events in date range for this company
      const { data: clockEvents } = await supabaseAdmin
        .from("clock_events")
        .select("id, user_id, job_id, event_subtype, occurred_at, cost_code, users!clock_events_user_id_fkey(full_name), jobs!clock_events_job_id_fkey(code)")
        .eq("company_id", userRecord.company_id)
        .gte("occurred_at", `${from}T00:00:00Z`)
        .lte("occurred_at", `${to}T23:59:59Z`)
        .order("occurred_at", { ascending: true })
        .limit(2000)

      if (job_id) {
        // Filter client-side since we already have the data
      }

      // Build timesheet rows
      const rows = buildTimesheetRows(clockEvents || [], job_id)

      // Generate CSV
      const csvHeader = "Worker,Date,Job Code,Cost Code,Clock In,Clock Out,Regular Hours,OT Hours,Total Hours"
      const csvRows = rows.map((r: any) =>
        `"${r.worker}","${r.date}","${r.job_code}","${r.cost_code || ""}","${r.clock_in}","${r.clock_out}","${r.regular_hours}","${r.ot_hours}","${r.total_hours}"`
      )
      const csv = [csvHeader, ...csvRows].join("\n")

      // Store artifact
      const artifactId = crypto.randomUUID()
      await supabaseAdmin.from("export_artifacts").insert({
        id: artifactId,
        company_id: userRecord.company_id,
        job_id: job_id || null,
        generated_by: user.id,
        export_kind: "timesheet_csv",
        status: "completed",
        generated_at: new Date().toISOString(),
        metadata: { date_from: from, date_to: to, row_count: rows.length },
      })

      return jsonResponse({
        status: "success",
        artifact_id: artifactId,
        date_from: from,
        date_to: to,
        row_count: rows.length,
        csv,
        rows,
        request_id: requestId,
      }, 200, requestId)
    }

    return errorResponse(requestId, 400, "INVALID_PAYLOAD", "report_type must be 'job_report' or 'timesheet'")
  } catch (error) {
    console.error("reports error:", error)
    return errorResponse(requestId, 500, "INTERNAL_ERROR", error.message || "Internal server error")
  }
})

// ─── Helper: compute worker hours from clock events ──────────
function computeWorkerHours(events: any[]) {
  const sessions: Record<string, { worker: string; clock_in: string; clock_out: string | null }[]> = {}

  for (const event of events) {
    const workerId = event.user_id
    const workerName = event.users?.full_name || "Unknown"

    if (!sessions[workerId]) sessions[workerId] = []

    if (event.event_subtype === "clock_in") {
      sessions[workerId].push({
        worker: workerName,
        clock_in: event.occurred_at,
        clock_out: null,
      })
    } else if (event.event_subtype === "clock_out") {
      // .findLast() is ES2023 — not available in all Deno versions.
      // Use .slice().reverse().find() for broad compatibility.
      const openSession = sessions[workerId].slice().reverse().find((s: any) => s.clock_out === null)
      if (openSession) {
        openSession.clock_out = event.occurred_at
      }
    }
  }

  const result: any[] = []
  for (const [, workerSessions] of Object.entries(sessions)) {
    let totalMinutes = 0
    for (const session of workerSessions) {
      if (session.clock_in && session.clock_out) {
        const diff = new Date(session.clock_out).getTime() - new Date(session.clock_in).getTime()
        totalMinutes += diff / 60000
      }
    }
    if (workerSessions.length > 0) {
      const regularMinutes = Math.min(totalMinutes, 480) // 8 hours
      const otMinutes = Math.max(totalMinutes - 480, 0)
      result.push({
        worker: workerSessions[0].worker,
        sessions: workerSessions.length,
        total_hours: +(totalMinutes / 60).toFixed(2),
        regular_hours: +(regularMinutes / 60).toFixed(2),
        ot_hours: +(otMinutes / 60).toFixed(2),
      })
    }
  }
  return result
}

// ─── Helper: build timesheet rows from clock events ──────────
function buildTimesheetRows(events: any[], filterJobId?: string) {
  // Pair clock_in with clock_out per worker per job
  const pairs: any[] = []
  const openSessions: Record<string, any> = {}

  for (const event of events) {
    if (filterJobId && event.job_id !== filterJobId) continue

    const key = `${event.user_id}_${event.job_id}`
    const workerName = event.users?.full_name || "Unknown"
    const jobCode = event.jobs?.code || "N/A"

    if (event.event_subtype === "clock_in") {
      openSessions[key] = {
        worker: workerName,
        job_code: jobCode,
        cost_code: event.cost_code || "",
        clock_in: event.occurred_at,
      }
    } else if (event.event_subtype === "clock_out" && openSessions[key]) {
      const session = openSessions[key]
      const inTime = new Date(session.clock_in)
      const outTime = new Date(event.occurred_at)
      const totalMinutes = (outTime.getTime() - inTime.getTime()) / 60000
      const regularMinutes = Math.min(totalMinutes, 480)
      const otMinutes = Math.max(totalMinutes - 480, 0)

      // Round to nearest 15 minutes
      const roundTo15 = (mins: number) => +(Math.round(mins / 15) * 15 / 60).toFixed(2)

      pairs.push({
        worker: session.worker,
        date: inTime.toISOString().split("T")[0],
        job_code: session.job_code,
        cost_code: session.cost_code || "",
        clock_in: inTime.toISOString(),
        clock_out: outTime.toISOString(),
        regular_hours: roundTo15(regularMinutes),
        ot_hours: roundTo15(otMinutes),
        total_hours: roundTo15(totalMinutes),
      })
      delete openSessions[key]
    }
  }

  return pairs
}
