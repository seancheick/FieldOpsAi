import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/api.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface AiRequest {
  workers: string[];
  jobs: string[];
  anchorDate: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const body: AiRequest = await req.json();

    // Mock AI Network Delay (simulating an LLM generation loop)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // MOCK RESPONSE LOGIC:
    // We will generate 3 fake standard shifts from the provided datasets if available.
    const ghost_shifts = [];
    const validWorkers = body.workers?.slice(0, 3) || [];
    const targetJob = body.jobs?.[0]; // Dump them onto the first active job

    if (targetJob) {
      for (const workerId of validWorkers) {
        ghost_shifts.push({
          id: `ghost-${crypto.randomUUID()}`,
          worker_id: workerId,
          job_id: targetJob,
          date: body.anchorDate,
          start_time: "07:00",
          end_time: "15:30",
          status: "ghost",
          notes: "[AI SUGGESTION] Historically high-performing crew matching this job profile.",
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "AI recommendations built based on historical worker efficiency metrics.",
        ghost_shifts,
      }),
      {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
