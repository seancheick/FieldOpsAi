import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"
import {
  CORS_HEADERS,
  corsHeaders,
  errorResponse,
  jsonResponse,
  makeRequestId,
} from "../_shared/api.ts"

const ENDPOINT = "client_portal"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) })
  }

  const requestId = makeRequestId(req)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // ── GET: public portal view ──────────────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url)
      const token = url.searchParams.get("token")

      if (!token) {
        return errorResponse(requestId, 400, "INVALID_PAYLOAD", "token is required")
      }

      // Look up token
      const { data: shareToken, error: tokenError } = await supabaseAdmin
        .from("job_share_tokens")
        .select("id, token, job_id, company_id, label, expires_at, revoked_at")
        .eq("token", token)
        .single()

      if (tokenError || !shareToken) {
        return errorResponse(requestId, 404, "NOT_FOUND", "Share link not found or expired")
      }

      if (shareToken.revoked_at) {
        return errorResponse(requestId, 410, "GONE", "This share link has been revoked")
      }

      if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
        return errorResponse(requestId, 410, "GONE", "This share link has expired")
      }

      // Fetch job details
      const { data: job } = await supabaseAdmin
        .from("jobs")
        .select("id, name, code, status, address, start_date, end_date")
        .eq("id", shareToken.job_id)
        .single()

      // Fetch company branding
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("name, logo_data_uri")
        .eq("id", shareToken.company_id)
        .single()

      // Fetch stamped photos (most recent 50)
      const { data: photos } = await supabaseAdmin
        .from("media_assets")
        .select("id, storage_url, stamp_metadata, created_at, asset_type")
        .eq("job_id", shareToken.job_id)
        .eq("company_id", shareToken.company_id)
        .not("stamp_metadata", "is", null)
        .order("created_at", { ascending: false })
        .limit(50)

      // Fetch task summary
      const { data: tasks } = await supabaseAdmin
        .from("tasks")
        .select("id, name, status, requires_photo, sort_order")
        .eq("job_id", shareToken.job_id)
        .order("sort_order", { ascending: true })

      // Increment view count (fire and forget)
      supabaseAdmin
        .from("job_share_tokens")
        .update({ view_count: (shareToken as any).view_count + 1, last_viewed_at: new Date().toISOString() })
        .eq("id", shareToken.id)
        .then(() => {})

      return jsonResponse({
        status: "success",
        job,
        company: { name: company?.name, logo: company?.logo_data_uri },
        photos: photos || [],
        tasks: tasks || [],
        label: shareToken.label,
        request_id: requestId,
      }, 200, requestId)
    }

    // ── POST: authenticated token management ─────────────────
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization")
      if (!authHeader) {
        return errorResponse(requestId, 401, "UNAUTHORIZED", "Authorization required")
      }

      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      })

      const jwt = authHeader.replace("Bearer ", "")
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        return errorResponse(requestId, 401, "UNAUTHORIZED", "Invalid auth token")
      }

      const { data: userRecord } = await supabaseAdmin
        .from("users")
        .select("id, company_id, role")
        .eq("id", authData.user.id)
        .single()

      if (!userRecord) {
        return errorResponse(requestId, 403, "FORBIDDEN", "User not found")
      }

      const allowedRoles = ["owner", "admin", "supervisor", "foreman"]
      if (!allowedRoles.includes(userRecord.role)) {
        return errorResponse(requestId, 403, "FORBIDDEN", "Insufficient role to manage share links")
      }

      const payload = await req.json()
      const { action } = payload

      if (action === "create_token") {
        const { job_id, label, expires_days } = payload
        if (!job_id) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "job_id is required")
        }

        // Verify job belongs to company
        const { data: job } = await supabaseAdmin
          .from("jobs")
          .select("id")
          .eq("id", job_id)
          .eq("company_id", userRecord.company_id)
          .single()

        if (!job) {
          return errorResponse(requestId, 404, "NOT_FOUND", "Job not found")
        }

        const expiresAt = expires_days
          ? new Date(Date.now() + expires_days * 86400000).toISOString()
          : null

        const { data: newToken, error: insertError } = await supabaseAdmin
          .from("job_share_tokens")
          .insert({
            job_id,
            company_id: userRecord.company_id,
            created_by: userRecord.id,
            label: label || null,
            expires_at: expiresAt,
          })
          .select("id, token, label, expires_at, created_at")
          .single()

        if (insertError) throw insertError

        return jsonResponse({
          status: "success",
          token: newToken,
          share_url: `/portal/${newToken.token}`,
          request_id: requestId,
        }, 201, requestId)
      }

      if (action === "revoke_token") {
        const { token_id } = payload
        if (!token_id) {
          return errorResponse(requestId, 400, "INVALID_PAYLOAD", "token_id is required")
        }

        const { error: revokeError } = await supabaseAdmin
          .from("job_share_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", token_id)
          .eq("company_id", userRecord.company_id)

        if (revokeError) throw revokeError

        return jsonResponse({ status: "success", request_id: requestId }, 200, requestId)
      }

      if (action === "list_tokens") {
        const { job_id } = payload
        const query = supabaseAdmin
          .from("job_share_tokens")
          .select("id, token, job_id, label, expires_at, revoked_at, view_count, last_viewed_at, created_at")
          .eq("company_id", userRecord.company_id)
          .order("created_at", { ascending: false })

        if (job_id) query.eq("job_id", job_id)

        const { data: tokens, error: listError } = await query
        if (listError) throw listError

        return jsonResponse({ status: "success", tokens: tokens || [], request_id: requestId }, 200, requestId)
      }

      return errorResponse(requestId, 400, "INVALID_PAYLOAD", "Unknown action. Use: create_token, revoke_token, list_tokens")
    }

    return errorResponse(requestId, 405, "METHOD_NOT_ALLOWED", "Method not allowed")
  } catch (error) {
    console.error("[client_portal] error:", error)
    return errorResponse(requestId, 500, "INTERNAL_ERROR", (error as Error).message || "Internal error")
  }
})
