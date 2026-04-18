import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"
import {
  applyRateLimit,
  CORS_HEADERS,
  corsHeaders,
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
import { isSupervisorOrAbove } from "../_shared/roles.ts"

const ENDPOINT = "schedule"
const RATE_LIMIT = 20

function mondayFor(date: Date) {
  const copy = new Date(date)
  const day = copy.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  copy.setUTCDate(copy.getUTCDate() + offset)
  return copy
}

function weekRange(weekStart: string | null) {
  const base = weekStart ? new Date(`${weekStart}T00:00:00Z`) : mondayFor(new Date())
  if (Number.isNaN(base.getTime())) return null
  const end = new Date(base)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    start: base.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function dateRange(dateFrom: string | null, dateTo: string | null) {
  if (!dateFrom || !dateTo) return null
  const start = new Date(`${dateFrom}T00:00:00Z`)
  const end = new Date(`${dateTo}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

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

    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .select("id, company_id, role, is_active")
      .eq("id", user.id)
      .single()

    if (userError || !userRecord?.is_active) {
      return errorResponse(requestId, 403, "FORBIDDEN", "User is inactive")
    }

    if (req.method === "GET") {
      const url = new URL(req.url)
      const range =
        dateRange(url.searchParams.get("date_from"), url.searchParams.get("date_to")) ??
        weekRange(url.searchParams.get("week_start"))
      if (!range) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "Invalid date range")
      }

      let query = supabaseAdmin
        .from("schedule_shifts")
        .select(`
          id,
          worker_id,
          job_id,
          shift_date,
          start_time,
          end_time,
          status,
          notes,
          published_at,
          published_by,
          users!schedule_shifts_worker_id_fkey(full_name),
          jobs!schedule_shifts_job_id_fkey(name, code)
        `)
        .eq("company_id", userRecord.company_id)
        .gte("shift_date", range.start)
        .lte("shift_date", range.end)
      if (["worker", "foreman"].includes(userRecord.role)) {
        query = query.eq("worker_id", user.id).eq("status", "published")
      }

      const { data, error } = await query
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true })

      const { data: ptoData, error: ptoError } = await supabaseAdmin
        .from("pto_requests")
        .select("id, user_id, pto_type, start_date, end_date, status")
        .eq("company_id", userRecord.company_id)
        .in("status", ["approved", "pending"])
        .lte("start_date", range.end)
        .gte("end_date", range.start)

      if (ptoError) throw ptoError

      const shifts = (data || []).map((shift: Record<string, unknown>) => ({
        id: shift.id,
        worker_id: shift.worker_id,
        worker_name: (shift.users as { full_name?: string } | null)?.full_name ?? "Unknown worker",
        job_id: shift.job_id,
        job_name: (shift.jobs as { name?: string } | null)?.name ?? "Unknown job",
        job_code: (shift.jobs as { code?: string } | null)?.code ?? null,
        date: shift.shift_date,
        start_time: typeof shift.start_time === "string" ? shift.start_time.slice(0, 5) : shift.start_time,
        end_time: typeof shift.end_time === "string" ? shift.end_time.slice(0, 5) : shift.end_time,
        status: shift.status,
        notes: shift.notes,
        published_at: shift.published_at,
        published_by: shift.published_by,
      }))

      logRequestResult(ENDPOINT, requestId, 200, {
        user_id: user.id,
        result_count: shifts.length,
      })
      return jsonResponse({
        status: "success",
        week_start: range.start,
        week_end: range.end,
        shifts,
        pto_requests: ptoData || [],
        request_id: requestId,
      }, 200, requestId)
    }

    if (req.method !== "POST") {
      return errorResponse(requestId, 405, "METHOD_NOT_ALLOWED", "Use GET or POST")
    }

    if (!isSupervisorOrAbove(userRecord.role)) {
      return errorResponse(requestId, 403, "FORBIDDEN", "Only supervisors, admins, or owners can manage schedules")
    }

    const idempotencyKey = req.headers.get("Idempotency-Key")
    if (!idempotencyKey) {
      return errorResponse(requestId, 400, "INVALID_PAYLOAD", "Idempotency-Key required")
    }

    const payload = await req.json()
    const action = payload?.action
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

    if (action === "create") {
      const { worker_id, job_id, shift_date, start_time, end_time, notes, publish } = payload

      if (!worker_id || !job_id || !shift_date || !start_time || !end_time) {
        return errorResponse(
          requestId,
          400,
          "INVALID_PAYLOAD",
          "worker_id, job_id, shift_date, start_time, and end_time are required",
        )
      }

      if (start_time >= end_time) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "start_time must be before end_time")
      }

      const [{ data: worker }, { data: job }] = await Promise.all([
        supabaseAdmin
          .from("users")
          .select("id")
          .eq("id", worker_id)
          .eq("company_id", userRecord.company_id)
          .in("role", ["worker", "foreman"])
          .maybeSingle(),
        supabaseAdmin
          .from("jobs")
          .select("id")
          .eq("id", job_id)
          .eq("company_id", userRecord.company_id)
          .maybeSingle(),
      ])

      if (!worker || !job) {
        return errorResponse(requestId, 404, "NOT_FOUND", "Worker or job not found")
      }

      const shiftId = crypto.randomUUID()
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("schedule_shifts")
        .insert({
          id: shiftId,
          company_id: userRecord.company_id,
          worker_id,
          job_id,
          shift_date,
          start_time,
          end_time,
          notes: notes || null,
          status: publish ? "published" : "draft",
          created_by: user.id,
          ...(publish ? { published_at: new Date().toISOString(), published_by: user.id } : {}),
        })
        .select(`
          id,
          worker_id,
          job_id,
          shift_date,
          start_time,
          end_time,
          status,
          notes,
          published_at,
          published_by,
          users!schedule_shifts_worker_id_fkey(full_name),
          jobs!schedule_shifts_job_id_fkey(name, code)
        `)
        .single()

      if (insertError) throw insertError

      const responseBody = {
        status: "success",
        shift: {
          id: inserted.id,
          worker_id: inserted.worker_id,
          worker_name: inserted.users?.full_name ?? "Unknown worker",
          job_id: inserted.job_id,
          job_name: inserted.jobs?.name ?? "Unknown job",
          job_code: inserted.jobs?.code ?? null,
          date: inserted.shift_date,
          start_time: typeof inserted.start_time === "string" ? inserted.start_time.slice(0, 5) : inserted.start_time,
          end_time: typeof inserted.end_time === "string" ? inserted.end_time.slice(0, 5) : inserted.end_time,
          status: inserted.status,
          notes: inserted.notes,
          published_at: inserted.published_at,
          published_by: inserted.published_by,
        },
        request_id: requestId,
      }
      await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 201, responseBody, requestId)
      logRequestResult(ENDPOINT, requestId, 201, {
        user_id: user.id,
        action: "create",
        shift_id: shiftId,
      })
      return jsonResponse(responseBody, 201, requestId, rateLimit.headers)
    }

    if (action === "update") {
      const { shift_id, worker_id, job_id, shift_date, start_time, end_time, notes } = payload
      if (!shift_id) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "shift_id is required")
      }

      const updates: Record<string, unknown> = {}
      if (worker_id) updates.worker_id = worker_id
      if (job_id) updates.job_id = job_id
      if (shift_date) updates.shift_date = shift_date
      if (start_time) updates.start_time = start_time
      if (end_time) updates.end_time = end_time
      if (notes !== undefined) updates.notes = notes || null

      if (Object.keys(updates).length === 0) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "At least one editable field is required")
      }

      if (start_time && end_time && start_time >= end_time) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "start_time must be before end_time")
      }

      if (worker_id || job_id) {
        const [{ data: worker }, { data: job }] = await Promise.all([
          worker_id
            ? supabaseAdmin
                .from("users")
                .select("id")
                .eq("id", worker_id)
                .eq("company_id", userRecord.company_id)
                .in("role", ["worker", "foreman"])
                .maybeSingle()
            : Promise.resolve({ data: { id: "unchanged" } }),
          job_id
            ? supabaseAdmin
                .from("jobs")
                .select("id")
                .eq("id", job_id)
                .eq("company_id", userRecord.company_id)
                .maybeSingle()
            : Promise.resolve({ data: { id: "unchanged" } }),
        ])

        if (!worker || !job) {
          return errorResponse(requestId, 404, "NOT_FOUND", "Worker or job not found")
        }
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("schedule_shifts")
        .update(updates)
        .eq("id", shift_id)
        .eq("company_id", userRecord.company_id)
        .eq("status", "draft")
        .select(`
          id,
          worker_id,
          job_id,
          shift_date,
          start_time,
          end_time,
          status,
          notes,
          published_at,
          published_by,
          users!schedule_shifts_worker_id_fkey(full_name),
          jobs!schedule_shifts_job_id_fkey(name, code)
        `)
        .maybeSingle()

      if (updateError) throw updateError
      if (!updated) {
        return errorResponse(requestId, 404, "NOT_FOUND", "Draft shift not found")
      }

      const responseBody = {
        status: "success",
        shift: {
          id: updated.id,
          worker_id: updated.worker_id,
          worker_name: updated.users?.full_name ?? "Unknown worker",
          job_id: updated.job_id,
          job_name: updated.jobs?.name ?? "Unknown job",
          job_code: updated.jobs?.code ?? null,
          date: updated.shift_date,
          start_time: typeof updated.start_time === "string" ? updated.start_time.slice(0, 5) : updated.start_time,
          end_time: typeof updated.end_time === "string" ? updated.end_time.slice(0, 5) : updated.end_time,
          status: updated.status,
          notes: updated.notes,
          published_at: updated.published_at,
          published_by: updated.published_by,
        },
        request_id: requestId,
      }
      await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 200, responseBody, requestId)
      logRequestResult(ENDPOINT, requestId, 200, {
        user_id: user.id,
        action: "update",
        shift_id,
      })
      return jsonResponse(responseBody, 200, requestId, rateLimit.headers)
    }

    if (action === "delete") {
      const shiftId = payload?.shift_id
      if (!shiftId) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "shift_id is required")
      }

      const { data: deleted, error: deleteError } = await supabaseAdmin
        .from("schedule_shifts")
        .delete()
        .eq("id", shiftId)
        .eq("company_id", userRecord.company_id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle()

      if (deleteError) throw deleteError
      if (!deleted) {
        return errorResponse(requestId, 404, "NOT_FOUND", "Draft shift not found")
      }

      const responseBody = { status: "success", shift_id: shiftId, request_id: requestId }
      await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 200, responseBody, requestId)
      logRequestResult(ENDPOINT, requestId, 200, {
        user_id: user.id,
        action: "delete",
        shift_id: shiftId,
      })
      return jsonResponse(responseBody, 200, requestId, rateLimit.headers)
    }

    if (action === "publish") {
      const shiftIds = Array.isArray(payload?.shift_ids) ? payload.shift_ids.filter(Boolean) : []
      if (shiftIds.length === 0) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "shift_ids is required")
      }

      const { data: published, error: publishError } = await supabaseAdmin
        .from("schedule_shifts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_by: user.id,
        })
        .in("id", shiftIds)
        .eq("company_id", userRecord.company_id)
        .eq("status", "draft")
        .select("id")

      if (publishError) throw publishError

      const responseBody = {
        status: "success",
        published_count: (published || []).length,
        request_id: requestId,
      }
      await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 200, responseBody, requestId)
      logRequestResult(ENDPOINT, requestId, 200, {
        user_id: user.id,
        action: "publish",
        published_count: (published || []).length,
      })
      return jsonResponse(responseBody, 200, requestId, rateLimit.headers)
    }

    if (action === "copy_week") {
      const { source_start, source_end, target_start } = payload
      if (!source_start || !source_end || !target_start) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "source_start, source_end, target_start are required")
      }

      const srcStartMs = new Date(`${source_start}T12:00:00Z`).getTime()
      const tgtStartMs = new Date(`${target_start}T12:00:00Z`).getTime()
      const diffDays = Math.round((tgtStartMs - srcStartMs) / 86400000)

      const { data: sourceShifts, error: fetchError } = await supabaseAdmin
        .from("schedule_shifts")
        .select("*")
        .eq("company_id", userRecord.company_id)
        .gte("shift_date", source_start)
        .lte("shift_date", source_end)

      if (fetchError) throw fetchError

      if (!sourceShifts || sourceShifts.length === 0) {
        const responseBody = { status: "success", copied_count: 0, request_id: requestId }
        await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 200, responseBody, requestId)
        logRequestResult(ENDPOINT, requestId, 200, { user_id: user.id, action: "copy_week", copied_count: 0 })
        return jsonResponse(responseBody, 200, requestId, rateLimit.headers)
      }

      const newShifts = sourceShifts.map((shift) => {
        const d = new Date(`${shift.shift_date}T12:00:00Z`)
        d.setUTCDate(d.getUTCDate() + diffDays)
        const newDateStr = d.toISOString().slice(0, 10)
        return {
          id: crypto.randomUUID(),
          company_id: userRecord.company_id,
          worker_id: shift.worker_id,
          job_id: shift.job_id,
          shift_date: newDateStr,
          start_time: shift.start_time,
          end_time: shift.end_time,
          notes: shift.notes,
          status: "draft",
          created_by: user.id
        }
      })

      const { error: insertError } = await supabaseAdmin
        .from("schedule_shifts")
        .insert(newShifts)

      if (insertError) throw insertError

      const responseBody = { status: "success", copied_count: newShifts.length, request_id: requestId }
      await storeIdempotency(supabaseAdmin, user.id, ENDPOINT, idempotencyKey, requestHash, 201, responseBody, requestId)
      logRequestResult(ENDPOINT, requestId, 201, {
        user_id: user.id,
        action: "copy_week",
        copied_count: newShifts.length,
      })
      return jsonResponse(responseBody, 201, requestId, rateLimit.headers)
    }

    return errorResponse(requestId, 400, "INVALID_PAYLOAD", "Unsupported action")
  } catch (error) {
    logRequestError(ENDPOINT, requestId, error)
    return errorResponse(requestId, 500, "INTERNAL_ERROR", error.message || "Internal server error")
  }
})
