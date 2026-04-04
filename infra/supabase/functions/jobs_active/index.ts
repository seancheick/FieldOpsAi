import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { CORS_HEADERS, errorResponse, jsonResponse, makeRequestId } from "../_shared/api.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  const requestId = makeRequestId(req)

  try {
    if (req.method !== "GET") {
      return errorResponse(requestId, 405, "METHOD_NOT_ALLOWED", "Use GET for /jobs/active")
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse(requestId, 401, "UNAUTHORIZED", "Missing Authorization header")
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      return errorResponse(requestId, 401, "UNAUTHORIZED", "Invalid auth token")
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('id', user.id)
      .single()

    if (userError || !userRecord) {
      return errorResponse(requestId, 401, "UNAUTHORIZED", "User record not found")
    }
    if (!userRecord.is_active) {
      return errorResponse(requestId, 403, "FORBIDDEN", "User is inactive")
    }

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        job_id,
        jobs (
          id,
          name,
          code,
          geofence_radius_m,
          site_lat,
          site_lng,
          tasks (
            id,
            name,
            requires_photo
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (error) {
      throw error
    }

    const jobs = assignments
      .map((assignment) => assignment.jobs)
      .filter(Boolean)
      .map((job: any) => ({
        job_id: job.id,
        job_name: job.name,
        geofence: {
          lat: job.site_lat,
          lng: job.site_lng,
          radius_m: job.geofence_radius_m,
        },
        tasks: (job.tasks || []).map((task: any) => ({
          task_id: task.id,
          name: task.name,
          requires_photo: task.requires_photo,
        })),
      }))

    return jsonResponse(
      {
        jobs,
        fetched_at: new Date().toISOString(),
      },
      200,
      requestId,
    )
  } catch (error) {
    console.error(error)
    return errorResponse(requestId, 500, "INTERNAL_ERROR", error.message || "Internal server error")
  }
})
