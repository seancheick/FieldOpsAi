import datetime
import hashlib
import json
import sys
import uuid

import requests

SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

WORKER_1_JOB_ID = "33333333-3333-3333-3333-333333333333"
WORKER_2_JOB_ID = "77777777-7777-7777-7777-777777777777"
WORKER_1_TASK_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
UPLOAD_BYTES = b"\xff\xd8\xff\xe0fieldops-sprint-1-test"


def fail(message, payload=None):
    print(f"❌ FAILED: {message}")
    if payload is not None:
        if isinstance(payload, str):
            print(payload)
        else:
            print(json.dumps(payload, indent=2))
    sys.exit(1)


def expect(condition, message, payload=None):
    if not condition:
        fail(message, payload)


def authenticate(email, password="password123"):
    response = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        json={"email": email, "password": password},
        timeout=15,
    )
    expect(response.status_code == 200, f"auth failed for {email}", response.text)
    return response.json()["access_token"]


def mobile_headers(token, idempotency_key=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Client-Version": "mobile-1.0.0",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def require_request_headers(response):
    expect("X-Request-ID" in response.headers, "missing X-Request-ID header")


def require_rate_limit_headers(response, expected_limit):
    require_request_headers(response)
    expect(response.headers.get("X-RateLimit-Limit") == str(expected_limit), "unexpected rate limit", dict(response.headers))
    expect("X-RateLimit-Remaining" in response.headers, "missing X-RateLimit-Remaining header")
    expect("X-RateLimit-Reset" in response.headers, "missing X-RateLimit-Reset header")


def admin_select(path, params):
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
        params=params,
        timeout=15,
    )
    expect(response.status_code == 200, f"admin select failed for {path}", response.text)
    return response.json()


print("========================================")
print("🚀 SPRINT 1 VALIDATION TESTS")
print("========================================\n")

print("🔹 Authenticating seeded users...")
worker_1_token = authenticate("worker@test.com")
worker_2_token = authenticate("worker2@test.com")
supervisor_token = authenticate("supervisor@test.com")
print("✅ SUCCESS: Authentication passed for worker1, worker2, and supervisor\n")

# 1. Test /jobs/active assignment scoping
print("🔹 Testing: GET /jobs/active assignment scoping")
jobs_worker_1 = requests.get(f"{SUPABASE_URL}/functions/v1/jobs_active", headers=mobile_headers(worker_1_token), timeout=15)
expect(jobs_worker_1.status_code == 200, "/jobs/active failed for worker1", jobs_worker_1.text)
require_request_headers(jobs_worker_1)
worker_1_body = jobs_worker_1.json()
expect(len(worker_1_body["jobs"]) == 1, "worker1 should only see one assigned job", worker_1_body)
expect(worker_1_body["jobs"][0]["job_id"] == WORKER_1_JOB_ID, "worker1 saw the wrong job", worker_1_body)
expect(worker_1_body["jobs"][0]["geofence"]["radius_m"] == 150, "worker1 geofence missing", worker_1_body)

jobs_worker_2 = requests.get(f"{SUPABASE_URL}/functions/v1/jobs_active", headers=mobile_headers(worker_2_token), timeout=15)
expect(jobs_worker_2.status_code == 200, "/jobs/active failed for worker2", jobs_worker_2.text)
worker_2_body = jobs_worker_2.json()
expect(len(worker_2_body["jobs"]) == 1, "worker2 should only see one assigned job", worker_2_body)
expect(worker_2_body["jobs"][0]["job_id"] == WORKER_2_JOB_ID, "worker2 saw the wrong job", worker_2_body)

jobs_supervisor = requests.get(f"{SUPABASE_URL}/functions/v1/jobs_active", headers=mobile_headers(supervisor_token), timeout=15)
expect(jobs_supervisor.status_code == 200, "/jobs/active failed for supervisor", jobs_supervisor.text)
supervisor_body = jobs_supervisor.json()
expect(len(supervisor_body["jobs"]) == 2, "supervisor should see both jobs", supervisor_body)
print("✅ SUCCESS: assignment scoping behaves correctly\n")

# 2. Test /sync/events with idempotency, duplicates, assignment, and geofence
print("🔹 Testing: POST /sync/events")
event_id = str(uuid.uuid4())
batch_id = str(uuid.uuid4())
occurred_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
sync_payload = {
    "batch_id": batch_id,
    "clock_events": [
        {
            "id": event_id,
            "job_id": WORKER_1_JOB_ID,
            "event_subtype": "clock_in",
            "occurred_at": occurred_at,
            "gps": {
                "lat": 37.7749,
                "lng": -122.4194,
                "accuracy_m": 10.5,
            },
        }
    ],
}

sync_idempotency_key = str(uuid.uuid4())
sync_resp_1 = requests.post(
    f"{SUPABASE_URL}/functions/v1/sync_events",
    headers=mobile_headers(worker_1_token, sync_idempotency_key),
    json=sync_payload,
    timeout=15,
)
expect(sync_resp_1.status_code == 200, "/sync/events first insert failed", sync_resp_1.text)
require_rate_limit_headers(sync_resp_1, 10)
sync_body_1 = sync_resp_1.json()
expect(sync_body_1["status"] == "success", "sync response missing success status", sync_body_1)
expect(sync_body_1["accepted"] == [event_id], "sync event should be accepted on first insert", sync_body_1)
expect(sync_body_1["duplicates"] == [], "duplicates should be empty on first insert", sync_body_1)
expect(sync_body_1["rejected"] == [], "rejected should be empty on first insert", sync_body_1)
print("✅ SUCCESS: first sync accepted")

sync_replay = requests.post(
    f"{SUPABASE_URL}/functions/v1/sync_events",
    headers=mobile_headers(worker_1_token, sync_idempotency_key),
    json=sync_payload,
    timeout=15,
)
expect(sync_replay.status_code == 200, "sync replay failed", sync_replay.text)
expect(sync_replay.json() == sync_body_1, "idempotent replay did not return same response", sync_replay.json())
print("✅ SUCCESS: idempotent sync replay returned same response")

sync_dup = requests.post(
    f"{SUPABASE_URL}/functions/v1/sync_events",
    headers=mobile_headers(worker_1_token, str(uuid.uuid4())),
    json=sync_payload,
    timeout=15,
)
expect(sync_dup.status_code == 200, "sync duplicate call failed", sync_dup.text)
sync_dup_body = sync_dup.json()
expect(sync_dup_body["accepted"] == [], "duplicate sync should not be accepted", sync_dup_body)
expect(sync_dup_body["duplicates"] == [event_id], "duplicate sync should be reported as duplicate", sync_dup_body)
print("✅ SUCCESS: duplicate sync was deduped")

unassigned_payload = {
    "batch_id": str(uuid.uuid4()),
    "clock_events": [
        {
            "id": str(uuid.uuid4()),
            "job_id": WORKER_2_JOB_ID,
            "event_subtype": "clock_in",
            "occurred_at": occurred_at,
            "gps": {
                "lat": 40.7128,
                "lng": -74.0060,
                "accuracy_m": 8.0,
            },
        }
    ],
}
sync_unassigned = requests.post(
    f"{SUPABASE_URL}/functions/v1/sync_events",
    headers=mobile_headers(worker_1_token, str(uuid.uuid4())),
    json=unassigned_payload,
    timeout=15,
)
expect(sync_unassigned.status_code == 200, "unassigned sync request failed unexpectedly", sync_unassigned.text)
unassigned_body = sync_unassigned.json()
expect(unassigned_body["accepted"] == [], "unassigned job should not be accepted", unassigned_body)
expect(unassigned_body["rejected"][0]["reason"] == "forbidden_job", "unassigned job should be rejected", unassigned_body)
print("✅ SUCCESS: unassigned job sync rejected")

geofence_payload = {
    "batch_id": str(uuid.uuid4()),
    "clock_events": [
        {
            "id": str(uuid.uuid4()),
            "job_id": WORKER_1_JOB_ID,
            "event_subtype": "clock_in",
            "occurred_at": occurred_at,
            "gps": {
                "lat": 0,
                "lng": 0,
                "accuracy_m": 100,
            },
        }
    ],
}
sync_geofence = requests.post(
    f"{SUPABASE_URL}/functions/v1/sync_events",
    headers=mobile_headers(worker_1_token, str(uuid.uuid4())),
    json=geofence_payload,
    timeout=15,
)
expect(sync_geofence.status_code == 200, "geofence sync request failed unexpectedly", sync_geofence.text)
geofence_body = sync_geofence.json()
expect(geofence_body["rejected"][0]["reason"] == "invalid_geofence", "invalid geofence should be rejected", geofence_body)
print("✅ SUCCESS: geofence validation rejected invalid GPS\n")

# 3. Media flow with authorization, idempotency, upload, finalize, and timeline event
print("🔹 Testing: POST /media/presign and /media/finalize")
unauthorized_media = requests.post(
    f"{SUPABASE_URL}/functions/v1/media_presign",
    headers=mobile_headers(worker_1_token, str(uuid.uuid4())),
    json={
        "job_id": WORKER_2_JOB_ID,
        "mime_type": "image/jpeg",
        "file_size_bytes": len(UPLOAD_BYTES),
    },
    timeout=15,
)
expect(unauthorized_media.status_code == 403, "unassigned media presign should be forbidden", unauthorized_media.text)
print("✅ SUCCESS: unauthorized media presign blocked")

presign_idempotency_key = str(uuid.uuid4())
presign_payload = {
    "job_id": WORKER_1_JOB_ID,
    "task_id": WORKER_1_TASK_ID,
    "mime_type": "image/jpeg",
    "file_size_bytes": len(UPLOAD_BYTES),
    "captured_at": occurred_at,
    "gps": {
        "lat": 37.7749,
        "lng": -122.4194,
        "accuracy_m": 6.0,
    },
}
presign_resp = requests.post(
    f"{SUPABASE_URL}/functions/v1/media_presign",
    headers=mobile_headers(worker_1_token, presign_idempotency_key),
    json=presign_payload,
    timeout=15,
)
expect(presign_resp.status_code == 201, "/media/presign failed", presign_resp.text)
require_rate_limit_headers(presign_resp, 20)
presign_body = presign_resp.json()
expect(presign_body["status"] == "success", "presign missing success status", presign_body)
expect(presign_body["media_asset_id"], "presign missing media_asset_id", presign_body)
expect(presign_body["storage_path"].startswith("11111111-1111-1111-1111-111111111111/33333333-3333-3333-3333-333333333333/"), "storage path is not company/job scoped", presign_body)
print("✅ SUCCESS: /media/presign returned a valid upload contract")

presign_replay = requests.post(
    f"{SUPABASE_URL}/functions/v1/media_presign",
    headers=mobile_headers(worker_1_token, presign_idempotency_key),
    json=presign_payload,
    timeout=15,
)
expect(presign_replay.status_code == 201, "presign replay failed", presign_replay.text)
expect(presign_replay.json() == presign_body, "presign replay did not return same response", presign_replay.json())
print("✅ SUCCESS: idempotent media presign replay returned same response")

upload_response = requests.put(
    presign_body["upload_url"],
    headers=presign_body["upload_headers"],
    data=UPLOAD_BYTES,
    timeout=15,
)
expect(upload_response.status_code in (200, 201), "direct upload failed", upload_response.text)
print("✅ SUCCESS: direct upload completed")

finalize_idempotency_key = str(uuid.uuid4())
checksum = hashlib.sha256(UPLOAD_BYTES).hexdigest()
finalize_resp = requests.post(
    f"{SUPABASE_URL}/functions/v1/media_finalize",
    headers=mobile_headers(worker_1_token, finalize_idempotency_key),
    json={
        "media_asset_id": presign_body["media_asset_id"],
        "checksum_sha256": checksum,
    },
    timeout=15,
)
expect(finalize_resp.status_code == 200, "/media/finalize failed", finalize_resp.text)
require_rate_limit_headers(finalize_resp, 20)
finalize_body = finalize_resp.json()
expect(finalize_body["status"] == "success", "finalize missing success status", finalize_body)
expect(finalize_body["media_asset_id"] == presign_body["media_asset_id"], "finalize returned wrong media asset id", finalize_body)
expect(finalize_body.get("photo_event_id"), "finalize should create a photo_event", finalize_body)
print("✅ SUCCESS: /media/finalize created media and timeline event")

finalize_replay = requests.post(
    f"{SUPABASE_URL}/functions/v1/media_finalize",
    headers=mobile_headers(worker_1_token, finalize_idempotency_key),
    json={
        "media_asset_id": presign_body["media_asset_id"],
        "checksum_sha256": checksum,
    },
    timeout=15,
)
expect(finalize_replay.status_code == 200, "finalize replay failed", finalize_replay.text)
expect(finalize_replay.json() == finalize_body, "finalize replay did not return same response", finalize_replay.json())
print("✅ SUCCESS: idempotent finalize replay returned same response")

asset_rows = admin_select(
    "media_assets",
    {
        "id": f"eq.{presign_body['media_asset_id']}",
        "select": "id,bucket_name,storage_path,sync_status,sha256_hash",
    },
)
expect(len(asset_rows) == 1, "expected one media_asset row", asset_rows)
expect(asset_rows[0]["sync_status"] == "uploaded", "media asset should be marked uploaded", asset_rows)
expect(asset_rows[0]["sha256_hash"] == checksum, "media asset checksum mismatch", asset_rows)

photo_rows = admin_select(
    "photo_events",
    {
        "media_asset_id": f"eq.{presign_body['media_asset_id']}",
        "select": "id,job_id,user_id,media_asset_id,photo_role,is_checkpoint,source_event_uuid",
    },
)
expect(len(photo_rows) == 1, "finalize should create exactly one photo_event", photo_rows)
expect(photo_rows[0]["id"] == finalize_body["photo_event_id"], "photo_event_id mismatch", photo_rows)
print("✅ SUCCESS: media_assets and photo_events rows verified\n")

print("========================================")
print("🏁 TESTS COMPLETE")
print("========================================")
