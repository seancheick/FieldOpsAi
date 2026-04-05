import { createClient } from "@supabase/supabase-js";

async function run() {
  const supabase = createClient("http://127.0.0.1:54321", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY3NjQ4NzQwMCwiZXhwIjoxOTkyMzMyMDkwfQ.mHnZ_l8nN3dZk--C9Q7HkVJ88c9aR3vP_UIn0_3G22k");

  const { data: { session }, error: signinError } = await supabase.auth.signInWithPassword({
    email: "supervisor@test.com",
    password: "password123",
  });

  if (signinError) {
    console.error("Sign in failed", signinError);
    return;
  }

  const token = session.access_token;
  const response = await fetch("http://127.0.0.1:54321/functions/v1/schedule?date_from=2026-04-06&date_to=2026-04-12", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const payload = await response.json();
  console.log("GET /schedule successful:", response.ok);
  if (!response.ok) {
    console.error("GET error:", payload);
  }
  console.log("pto_requests fetched:", Array.isArray(payload.pto_requests) ? payload.pto_requests.length : "NO");

  const copyResponse = await fetch("http://127.0.0.1:54321/functions/v1/schedule", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": "test-" + Date.now()
    },
    body: JSON.stringify({
      action: "copy_week",
      source_start: "2026-04-06",
      source_end: "2026-04-12",
      target_start: "2026-04-13"
    })
  });

  let copyPayload = null;
  if(copyResponse.headers.get("content-type")?.includes("application/json")) {
    copyPayload = await copyResponse.json();
  } else {
    copyPayload = await copyResponse.text();
  }
  
  console.log("POST /schedule copy_week successful:", copyResponse.ok, copyPayload);
}
run();
