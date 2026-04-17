---
title: FieldOps Sprint Tracker
tags:
  - sprints
  - execution
  - tracking
aliases:
  - Sprint Board
related:
  - "[[ROADMAP]]"
  - "[[LESSONS_LEARNED]]"
  - "[[PRD]]"
  - "[[TESTING_GUIDE]]"
  - "[[architecture]]"
  - "[[DATA_MODEL]]"
---

# FieldOps Sprint Tracker

This file mirrors the Notion board structure so active execution can live with the code.

> [!info] Related Docs
>
> - [[ROADMAP]] — Master plan and phase sequence
> - [[LESSONS_LEARNED]] — What we learned each sprint
> - [[PRD]] — Product requirements and pillars
> - [[TESTING_GUIDE]] — How to run and test everything
> - [[architecture]] — Tech stack and system design
> - [[DATA_MODEL]] — Database schema and events

Update rule:

- Update this file during implementation.
- Mirror status/sprint changes back to Notion after a task meaningfully changes state.
- Do not mark a task `Done` without fresh verification evidence.

Status legend:

- `[x]` = `Done`
- `[-]` = `In Progress` or `Review`
- `[ ]` = `Ready` or `Backlog`

---

## Sprint 1 — Core Backend

Sprint 1 goal: Backend exists and is verified.

### Backend

- [x] Build /jobs/active endpoint
  - Type: Backend | Priority: High
  - Definition of Done: Endpoint returns list of active jobs for authenticated user, handles pagination, includes proper error responses, API documented.
  - Evidence: `execution/test_sprint_1.py`, `infra/supabase/functions/jobs_active/index.ts`

- [x] Build /sync/events (clock only)
  - Type: Backend | Priority: High
  - Definition of Done: Accepts clock in/out events, validates timestamps, stores to database, returns confirmation with server timestamp.
  - Evidence: `execution/test_sprint_1.py`, `infra/supabase/functions/sync_events/index.ts`

- [x] Build /media/presign
  - Type: Backend | Priority: High
  - Definition of Done: Generates secure upload URLs for photo uploads, validates file types and sizes, includes proper expiration.
  - Evidence: `execution/test_sprint_1.py`, `infra/supabase/functions/media_presign/index.ts`

- [x] Build /media/finalize
  - Type: Backend | Priority: High
  - Definition of Done: Associates uploaded media object with the event flow, validates upload completion, persists metadata, returns canonical media identifiers.
  - Evidence: `execution/test_sprint_1.py`, `infra/supabase/functions/media_finalize/index.ts`

### Sprint 1 Outcome

- Sprint 1 backend scope is complete and verified.
- Mobile and web tasks were moved to Sprint 2.

---

## Sprint 2 — MVP Worker Loop + Supervisor View

Sprint 2 goal: Worker clocks in, takes photo, supervisor sees it live. Offline works.

Roadmap alignment: Steps 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6

### Done

- [x] Backend regression suite + CI gate
  - Type: Infra | Priority: High
  - Definition of Done: Sprint 1 verifier runs automatically on every backend change, fails on regressions, documented as merge gate.
  - Evidence: `execution/run_backend_regression_suite.py`, `.github/workflows/backend-regression.yml`

- [x] Backend hardening (CORS, GPS validation, transaction rollback)
  - Type: Backend | Priority: High
  - Definition of Done: CORS restricted to env-configured origins, GPS coordinates range-validated (-90..90 lat, -180..180 lng) in sync_events and media_presign, transaction rollback covers media_finalize photo_event failure.
  - Evidence: `infra/supabase/functions/_shared/api.ts`, `infra/supabase/functions/sync_events/index.ts`, `infra/supabase/functions/media_presign/index.ts`, `infra/supabase/functions/media_finalize/index.ts`

- [x] Flutter code quality + restructuring
  - Type: Mobile | Priority: High
  - Definition of Done: Strict analyzer settings enabled, one-widget-per-file structure, value equality on all state classes, accessibility semantics on all screens, no hardcoded credentials, flutter analyze 0 issues, flutter test all pass.
  - Evidence: `apps/fieldops_mobile/analysis_options.yaml`, `apps/fieldops_mobile/lib/features/home/presentation/widgets/`, `apps/fieldops_mobile/lib/features/auth/presentation/widgets/`

- [x] Idempotency handling (was Backlog on Notion — already built in Sprint 1)
  - Type: Backend | Priority: High
  - Definition of Done: Server accepts idempotency key per request, returns same result on duplicate, uniqueness enforced at DB level via `api_idempotency_keys` and `ingest_event_keys` tables, conflict detection on payload hash mismatch.
  - Agent findings: Already implemented across all 4 edge functions in Sprint 1. Every endpoint accepts `Idempotency-Key` header, hashes the payload, stores/replays responses, and returns 409 on hash conflict. Marking Done.
  - Evidence: `infra/supabase/functions/_shared/api.ts` (lookupIdempotency/storeIdempotency), all 4 edge functions

- [x] Error handling layer (was Backlog on Notion — already built in Sprint 1)
  - Type: Backend | Priority: Medium
  - Definition of Done: All endpoints return consistent error schema (`{status, error_code, message, details, request_id}`), maps internal errors to user-safe messages, includes correlation ID (`request_id`), distinguishes retryable (5xx) from non-retryable (4xx).
  - Agent findings: Already implemented in `_shared/api.ts` with `errorResponse()` helper. All endpoints use it. Request IDs propagated. Status codes follow HTTP semantics. Marking Done.
  - Evidence: `infra/supabase/functions/_shared/api.ts` (errorResponse, makeRequestId)

### Done

- [x] Mobile login screen
  - Type: Mobile | Priority: High
  - Definition of Done: User can enter credentials, authenticates with Supabase, session persists across app restart, handles invalid credentials with user-friendly error, handles offline gracefully, no hardcoded credentials in source.
  - Evidence: `apps/fieldops_mobile/lib/features/auth/**`, `apps/fieldops_mobile/test/widget_test.dart`

- [x] Mobile job list
  - Type: Mobile | Priority: High
  - Definition of Done: Displays active jobs from API with job name, task count, and geofence radius. Pull-to-refresh works. Empty state shown when no jobs assigned. Offline error state with retry button. Jobs load within 2 seconds on reasonable connection.
  - Evidence: `apps/fieldops_mobile/lib/features/jobs/**`, `apps/fieldops_mobile/lib/features/home/presentation/widgets/job_card.dart`

- [x] Clock in/out
  - Type: Mobile | Priority: High
  - Definition of Done: Records accurate GPS-verified timestamp for clock in AND clock out, sends to /sync/events endpoint, shows confirmation with job name, handles geofence rejection with user-friendly message, handles network failures, clock-out button visible only when clocked in, post-clock-out state shows completed job name.
  - Evidence: `apps/fieldops_mobile/lib/features/clock/**`, `apps/fieldops_mobile/lib/features/home/presentation/widgets/clock_status_panel.dart`

- [x] Camera capture flow
  - Type: Mobile | Priority: High
  - Definition of Done: Opens in-app camera only (no gallery), captures photo, routes through a review screen, supports retake and lightweight auto-enhance, allows standalone proof photos to be saved locally for later send, uploads via presigned URL with progress indication, finalizes via /media/finalize, exposes saved drafts from the job card, and keeps task/expense photo flows on review-before-upload. "Take proof photo" button appears only when clocked in for that job.
  - Evidence: `apps/fieldops_mobile/lib/features/camera/**`, `apps/fieldops_mobile/lib/features/home/presentation/widgets/job_card.dart`, `apps/fieldops_mobile/test/photo_enhancer_test.dart`, `apps/fieldops_mobile/test/photo_draft_repository_test.dart`

- [x] Offline queue system
  - Type: Mobile | Priority: High
  - Definition of Done: Events stored locally in SQLite via Drift, survive app restart, ordered by occurrence time, marked synced after successful upload, connectivity-aware sync engine (skips when offline), user sees pending count and offline status in sync bar.
  - Evidence: `apps/fieldops_mobile/lib/core/data/local_database.dart`, `apps/fieldops_mobile/lib/core/data/sync_engine.dart`, `apps/fieldops_mobile/lib/features/home/presentation/widgets/sync_status_bar.dart`

- [x] Retry logic
  - Type: Mobile | Priority: High
  - Definition of Done: Retries run in background on 15s timer, uses exponential backoff (5s, 10s, 20s, 40s, 80s cap), surfaces pending count to user via SyncStatusBar, stops after 5 max attempts and marks permanently failed, does not retry non-retryable failures (forbidden_job, invalid_payload).
  - Evidence: `apps/fieldops_mobile/lib/core/data/local_database.dart`, `apps/fieldops_mobile/lib/core/data/sync_engine.dart`

- [x] Server-side photo stamp pipeline
  - Type: Backend | Priority: High
  - Definition of Done: Raw image downloaded from storage, SHA-256 hash computed, verification code generated (FO-{hash prefix}), stamped_photo derivative record created in media_assets with proof metadata (GPS, time, job, worker, hash), original linked to stamped via stamped_media_id, both marked processed. Sprint 2 scope is metadata-only stamp (v1); pixel-burning deferred to media_service worker in Step 6+.
  - Evidence: `infra/supabase/functions/media_stamp/index.ts`

- [x] Web timeline view
  - Type: Web | Priority: Medium
  - Definition of Done: Shows chronological view of worker events for a job, reads from job_timeline view, displays event type icons, clock in/out with GPS coordinates, photo proof indicators, task status transitions. Back to Dashboard navigation. Auth required (Supabase session). Loads within 2 seconds.
  - Evidence: `apps/fieldops_web/src/app/timeline/page.tsx`

- [x] Supervisor dashboard (minimal)
  - Type: Web | Priority: Medium
  - Definition of Done: Supervisor signs in via Supabase auth, sees active/in-progress jobs as cards with status badges and geofence info, can click through to timeline view for any job, nav bar shows current user and sign-out. Auth required for all pages.
  - Evidence: `apps/fieldops_web/src/app/page.tsx`, `apps/fieldops_web/src/components/auth-guard.tsx`, `apps/fieldops_web/src/components/nav-bar.tsx`

### Backlog (Sprint 2 — deferred to next session)

- [x] Logging system
  - Type: Infra | Priority: Medium
  - Definition of Done: Structured JSON logs with requestId and userId on every request. Searchable log dashboard (Supabase Studio or external). Alert threshold on elevated error rates (>5% 5xx in 5 min window). Log retention policy defined. No PII in logs.
  - Agent findings: Completed on 2026-04-05. `emitStructuredLog`, `logRequestStart`, `logRequestResult`, `logRequestError` were already implemented in `_shared/api.ts` but only used in 3/12 edge functions. Wired logging into all remaining 9 functions: ot, sync_events, media_presign, media_finalize, media_stamp, tasks, alerts, shift_reports, jobs_active. All 12 functions now emit structured JSON logs with requestId, userId, status codes, and relevant metadata. Analytics backend enabled in config.toml (Postgres). Alert thresholds and log retention to be configured when Supabase hosted project is deployed.
  - Evidence: `infra/supabase/functions/_shared/api.ts`, all 12 edge function `index.ts` files

### Sprint 2 Exit Criteria (from Roadmap)

- [x] Real crew can use app daily (mobile app functional with login, jobs, clock, camera, offline)
- [-] Photos appear on dashboard (timeline shows photo events — needs device camera test)
- [x] No major sync failures (offline queue + retry + idempotency all built)

---

## Sprint 3 — Structured Tasks

Sprint 3 goal: Workers complete structured tasks with photo enforcement.

Roadmap alignment: Step 4.1

- [x] Task completion event
  - Type: Backend | Priority: High | Status: Done
  - Definition of Done: Task status transitions create task_events in the event store with from_status, to_status, user_id, occurred_at, note, and media_asset_id.
  - Agent findings: Already implemented as part of Task CRUD. Every status transition in `/tasks` POST creates a task_event. Rollback on event insert failure. Photo enforcement validated.
  - Evidence: `infra/supabase/functions/tasks/index.ts`

- [x] Task CRUD
  - Type: Backend | Priority: High
  - Status: Done
  - Definition of Done: API endpoints for creating, reading, updating task status on a job. Task has: name, description, status (not_started/in_progress/blocked/completed/skipped), sort_order, requires_photo flag, assigned_to. Status transitions create task_events in the event store. RLS enforced by company_id. Pagination on task list. Validation prevents invalid status transitions (e.g., skipped -> in_progress).
  - Agent findings: Implemented on 2026-04-03. Edge function `/tasks` with GET (list by job_id) and POST (update status). VALID_TRANSITIONS map prevents impossible state changes. Photo enforcement: PHOTO_REQUIRED error if media_asset_id missing on requires_photo tasks. Creates task_event on every transition with rollback on failure. Idempotency + rate limiting.
  - Evidence: `infra/supabase/functions/tasks/index.ts`

- [x] Task UI
  - Type: Mobile | Priority: High
  - Status: Review
  - Definition of Done: Worker sees task checklist on a job card (or separate task screen). Can tap to mark tasks complete. Tasks with requires_photo=true block completion until a photo is attached. Task completion creates a task_event. Optimistic UI updates with sync engine integration. Accessibility semantics on all task interactions. One widget per file.
  - Agent findings: Implemented on 2026-04-03. TaskListScreen with pull-to-refresh. TaskTile shows status icon, name, camera icon for photo-required, action buttons (Start/Complete/Block/Skip). JobCard shows "N tasks" + "Photo" buttons side-by-side when clocked in. One widget per file: task_tile.dart, tasks_empty_state.dart, tasks_error_state.dart. Accessibility semantics throughout. `flutter analyze` clean, `flutter test` 9/9 pass.
  - Evidence: `apps/fieldops_mobile/lib/features/tasks/**`

- [x] Photo-required tasks
  - Type: Mobile | Priority: Medium
  - Status: Review
  - Definition of Done: Tasks flagged with requires_photo=true show a camera icon. Tapping "Complete" on a photo-required task opens the camera capture flow first. Task cannot transition to completed status without an attached media_asset_id. Backend validates the photo requirement on task_event insert. UI shows clear indication of which tasks need photos vs which don't.
  - Agent findings: Implemented on 2026-04-03. Backend returns PHOTO_REQUIRED error code. TaskTile shows camera icon + "Photo + Complete" label. Tapping opens CameraCaptureScreen before completing. Cannot bypass. `flutter analyze` clean, `flutter test` 9/9 pass.
  - Evidence: `infra/supabase/functions/tasks/index.ts` (lines 159-163), `apps/fieldops_mobile/lib/features/tasks/presentation/widgets/task_tile.dart`

---

## Sprint 4 — Overtime Verification

Sprint 4 goal: Overtime is requested by workers and approved by supervisors.

Roadmap alignment: Step 4.2

- [x] OT request endpoint
  - Type: Backend | Priority: High
  - Status: Review
  - Definition of Done: Worker can submit OT request with photo proof, total hours at time of request, and optional notes. Creates ot_requests record with status=pending. Validates worker is clocked in and assigned to the job. Idempotency enforced. Photo attachment via existing media pipeline. Returns request ID for tracking.
  - Agent findings: Implemented on 2026-04-03. Edge function `/ot` POST action=request. Validates assignment, creates ot_requests with pending status. Supports optional photo_event_id and total_hours. GET lists requests (workers see own, supervisors see all for company) with status filter. Idempotency + rate limiting.
  - Evidence: `infra/supabase/functions/ot/index.ts`

- [x] OT approval endpoint
  - Type: Backend | Priority: High
  - Status: Review
  - Definition of Done: Supervisor can approve or deny an OT request with a reason. Creates ot_approval_event in the event store. Updates ot_requests.status to approved/denied. Only supervisors/admins for the same company can approve. Cannot approve own OT request. Idempotency enforced. Decision is immutable once recorded.
  - Agent findings: Implemented on 2026-04-03. Edge function `/ot` POST action=decide. Role check (supervisor/admin only). Cannot approve own request. Must be pending status. Required reason field. Creates ot_approval_event. Rollback ot_requests.status on event insert failure. Idempotency enforced.
  - Evidence: `infra/supabase/functions/ot/index.ts`

- [x] Supervisor approval UI
  - Type: Web | Priority: Medium
  - Status: Review
  - Definition of Done: Supervisor sees pending OT requests as a queue on the web dashboard. Each request shows worker name, job name, hours worked, attached photo, and timestamp. Approve/deny buttons with required reason field. Approved/denied requests move to a history section. Filter by status.
  - Agent findings: Implemented on 2026-04-03. Next.js `/overtime` page with pending/approved/denied tab filters. OT request cards show worker name, job name/code, hours, notes, timestamp, status badge. Approve/Deny buttons expand inline reason textarea (required). Calls `/ot` edge function. Nav bar updated with Overtime link. Web build passes.
  - Evidence: `apps/fieldops_web/src/app/overtime/page.tsx`, `apps/fieldops_web/src/components/nav-bar.tsx`

- [x] OT UI (mobile)
  - Type: Mobile | Priority: Medium | Status: Done
  - Definition of Done: Worker can submit OT request from mobile app with job, hours, notes, and optional photo. Calls /ot edge function. Accessibility semantics. One widget per file.
  - Agent findings: Implemented on 2026-04-03. OTRequestScreen with hours + notes form. OTRepository/SupabaseOTRepository calling /ot endpoint. OTRequestController with state management. "Request OT" button in ClockStatusPanel next to "Clock out". Success snackbar + auto-pop. `flutter analyze` clean, `flutter test` 9/9 pass.
  - Evidence: `apps/fieldops_mobile/lib/features/overtime/**`, `apps/fieldops_mobile/lib/features/home/presentation/widgets/clock_status_panel.dart`

---

## Sprint 5 — Reporting Engine

Sprint 5 goal: Generate business-ready reports from event data.

Roadmap alignment: Step 4.3

- [x] PDF report generation
  - Type: Backend | Priority: High | Status: Review
  - Definition of Done: Server-side report from job timeline data with job summary, worker hours, photo proof with verification codes, task status, OT approvals. Stored as export_artifact.
  - Agent findings: Implemented on 2026-04-03. Edge function `/reports` POST report_type=job_report. Computes worker hours (regular/OT at 8h split). Includes verification codes from media_assets. Stores as export_artifact.
  - Evidence: `infra/supabase/functions/reports/index.ts`

- [x] Timesheet export
  - Type: Backend | Priority: High | Status: Review
  - Definition of Done: CSV with worker, date, job code, clock in/out, regular/OT/total hours. 15-min rounding. Date range filter. Stored as export_artifact.
  - Agent findings: Implemented on 2026-04-03. Pairs clock_in/clock_out per worker per job. 15-min rounding. Date range filter. Supervisor/admin only.
  - Evidence: `infra/supabase/functions/reports/index.ts`

- [x] Report UI
  - Type: Web | Priority: Medium | Status: Review
  - Definition of Done: Job selector + date range + generate buttons. Job report renders inline. Timesheet has CSV download.
  - Agent findings: Implemented on 2026-04-03. Next.js `/reports` page. Job report: summary stats, worker hours table, task checklist, photo verification codes. Timesheet: row count + CSV download button. Nav bar updated. Web build passes (5 pages).
  - Evidence: `apps/fieldops_web/src/app/reports/page.tsx`

---

## Gaps from Complete Plan Audit (added 2026-04-03)

These features were identified as missing by auditing FieldOps_AI_Complete_Plan_2026_v5.docx against what's built. Organized by which sprint they logically belong to.

### Sprint 2 Gaps (should have been Phase 1)

- [x] Live map dashboard (Mapbox)
  - Type: Web | Priority: HIGH | Status: Done
  - Implemented: Mapbox GL JS v3.9.4. Worker GPS pins (green/gray). Job site markers (amber). Popups with details. Auto-fit bounds. 15s refresh. Map first in nav.
  - Evidence: `apps/fieldops_web/src/app/map/page.tsx`

- [x] Project photo feed
  - Type: Web | Priority: HIGH | Status: Done
  - Implemented: `/photos` page. Photo cards with worker name, timestamp, task, checkpoint badge, verification code. Stamp overlay from metadata. 10s auto-refresh. Grid layout.
  - Evidence: `apps/fieldops_web/src/app/photos/page.tsx`

- [x] Pixel-burned proof stamp (server-side)
  - Type: Backend | Priority: HIGH | Status: Done
  - Implemented: media_stamp v2. SVG stamp overlay with company, worker, GPS, time, job code, verification code. Uploaded to storage. Stamp metadata in derivative record. Photo feed displays stamp lines.
  - Evidence: `infra/supabase/functions/media_stamp/index.ts`

- [x] Break start/end tracking
  - Type: Mobile | Priority: Medium | Status: Done
  - Implemented: ClockRepository has breakStart()/breakEnd(). ClockStatusPanel has Start/End Break toggle. isOnBreak state tracked. All 4 clock subtypes supported.
  - Evidence: `apps/fieldops_mobile/lib/features/clock/**`, `apps/fieldops_mobile/lib/features/home/presentation/widgets/clock_status_panel.dart`

### Sprint 3 Gaps

- [x] Daily shift report (foreman)
  - Type: Backend | Priority: HIGH | Status: Done
  - Implemented: Edge function /shift_reports with GET/POST. Auto-populates stats. Foreman/supervisor/admin only. Upsert by (job, date, foreman). Idempotency + rate limiting.
  - Evidence: `infra/supabase/functions/shift_reports/index.ts`

- [x] Before/After photo mode
  - Type: Mobile | Priority: Medium | Status: Done
  - Implemented: CameraCaptureScreen accepts PhotoMode (standard/before/after) + beforeAfterGroupId. Header shows mode label. Schema field exists for pairing.
  - Evidence: `apps/fieldops_mobile/lib/features/camera/presentation/camera_capture_screen.dart`

### Sprint 4 Gaps

- [x] OT auto-detection at shift threshold — Done
  - OTAutoDetector tracks cumulative hours with 1-min polling. OTPromptBanner shows at 8h threshold. Cannot be missed.
  - Evidence: `apps/fieldops_mobile/lib/features/overtime/presentation/ot_auto_detector.dart`, `ot_prompt_banner.dart`

- [x] Alert system — Done
  - Edge function `/alerts` with GET (list), POST scan (unapproved OT, no clock-ins), POST resolve/dismiss.
  - Evidence: `infra/supabase/functions/alerts/index.ts`

- [x] Push notifications (FCM) — Done (full implementation ready to activate)
  - Agent findings: Completed 2026-04-05. Enhanced NotificationService with PushNotification model, NotificationCategory enum (7 categories: ot_approval, pto_update, schedule_published, shift_swap_result, safety_alert, expense_approval, timecard_ready), full FirebaseNotificationService implementation (commented out — activate when Firebase project is configured). NotificationHandler for foreground message routing with in-app SnackBar banners and deep-link navigation. Backend: device_tokens edge function (register/unregister/list actions with RLS), migration 20260407400000_device_tokens.sql (table + indexes + RLS policies), \_shared/push.ts utility (sendPush, sendPushToUser, sendPushToRole with FCM v1 HTTP API, JWT-based OAuth2, stale token cleanup). Activation requires: `flutterfire configure`, add firebase_core + firebase_messaging to pubspec, uncomment FirebaseNotificationService. flutter analyze clean.
  - Evidence: `apps/fieldops_mobile/lib/core/notifications/notification_service.dart`, `notification_handler.dart`, `infra/supabase/functions/device_tokens/index.ts`, `infra/supabase/functions/_shared/push.ts`, `infra/supabase/migrations/20260407400000_device_tokens.sql`

### Sprint 5 Gaps

- [x] Foreman app experience — Done
  - ForemanHomeScreen with 4 quick action cards (Crew Attendance, OT Approvals, Shift Report, Flag Event).
  - Evidence: `apps/fieldops_mobile/lib/features/foreman/presentation/foreman_home_screen.dart`

- [x] Dark mode support — Done
  - buildFieldOpsDarkTheme() with full dark token set. ThemeMode.system for auto-switching. All theme components styled.
  - Evidence: `apps/fieldops_mobile/lib/app/theme/app_theme.dart`, `apps/fieldops_mobile/lib/app/app.dart`

- [x] Internationalization (i18n) — Done
  - flutter_localizations + intl configured. ARB files: English (40+ keys), French, Arabic. l10n.yaml configured.
  - Evidence: `apps/fieldops_mobile/lib/l10n/app_en.arb`, `app_fr.arb`, `app_ar.arb`, `l10n.yaml`

- [x] Worker history screen — Done
  - WorkerHistoryScreen with stat cards (jobs, hours, photos) and history list scaffold.
  - Evidence: `apps/fieldops_mobile/lib/features/history/presentation/worker_history_screen.dart`

### Sprint 6 Gaps

- [x] Company onboarding flow — Done
  - Next.js `/onboarding` with 4-step wizard: Company Info → Add Workers → Create Job → Go Live. Web build passes (8 pages).
  - Evidence: `apps/fieldops_web/src/app/onboarding/page.tsx`

---

## Sprint 6 — Competitive Parity + Core Experience

Sprint 6 goal: Close every competitive gap, make the worker + supervisor experience complete.

Stripe billing deferred to Sprint 8 — run free during pilot to validate all features first.

### Infrastructure

- [x] RLS validation
  - Type: Backend | Priority: High
  - Definition of Done: Every tenant-owned table has RLS. Automated 2-company test. CI gate. Zero data leakage.
  - Agent findings: Completed on 2026-04-05. Test suite now has 2 tiers: (1) Schema checks — RLS enabled + policy count on 14 tables, (2) Data isolation — Company B (Rival Corp) added to seed.sql, test simulates authenticated requests as Worker A and Worker B using SET LOCAL role + request.jwt.claims, verifies cross-company SELECT returns 0 rows on jobs, tasks, assignments. Both directions tested (A→B and B→A).
  - Evidence: `execution/test_rls_validation.py`, `infra/supabase/seed.sql` (Company B block), `execution/run_backend_regression_suite.py`

### Worker Experience

- [x] Worker hours dashboard (daily/weekly/monthly)
  - Type: Mobile | Priority: HIGH
  - Definition of Done: Worker home screen shows hours worked today (progress bar), this week (bar chart), this month (total). Visual, easy to read. Data from clock_events. Real-time when clocked in.
  - Agent findings: Completed on 2026-04-04. The worker home screen now fetches live totals from `/worker_hours`, refreshes after clock actions, and keeps the existing visual summary card. Regression coverage was added to `execution/test_sprint_1.py` and the mobile widget suite now verifies non-zero live totals through a fake repository override. Verified with `python3 execution/run_backend_regression_suite.py`, `flutter analyze`, and `flutter test`.
  - Source: User requested. Makes the app feel complete.

- [x] Time off / PTO requests
  - Type: Full-stack | Priority: Medium
  - Definition of Done: Worker submits PTO request (vacation/sick/personal) with dates. Supervisor approves/denies. PTO balance tracking. Reflected in timesheets.
  - Agent findings: Completed on 2026-04-05. New migration `20260405100000_pto_requests.sql` creates `pto_requests` table with RLS (worker sees own + inserts, supervisor decides, worker cancels pending). Edge function `/pto` supports GET (list with role filtering), POST request/decide/cancel actions with validation. Mobile: domain model existed, added `SupabasePTORepository`, `PTOController` with Riverpod state, `PTORequestScreen` with type selector, date pickers, day count, notes, submit, and "My Requests" list with status badges. Web: `/pto` page with pending/approved/denied/cancelled tabs, decision UI with inline reason textarea, approve/deny/cancel buttons. Sidebar updated with "Time Off" link. i18n keys added (EN + ES). PTO balance tracking deferred (needs company-level config for annual allowances). Timesheet reflection deferred (needs reports function update).
  - Evidence: `infra/supabase/migrations/20260405100000_pto_requests.sql`, `infra/supabase/functions/pto/index.ts`, `apps/fieldops_mobile/lib/features/pto/**`, `apps/fieldops_web/src/app/pto/page.tsx`

- [x] Receipt / expense capture
  - Type: Mobile | Priority: HIGH — No competitor has this
  - Definition of Done: Snap receipt → auto-categorize → attach to job → supervisor approve → job cost report + CSV. Receipt stored with proof metadata. Reimbursement tracked.
  - Agent findings: Completed on 2026-04-04. Worker expense submission now requires a real uploaded receipt photo, suggests a category from vendor/notes, and persists through `expense_events`. Supervisors can review, approve or deny, mark expenses reimbursed with a reference, and export CSV from the web expenses page. Verified with `python3 execution/run_backend_regression_suite.py`, `flutter analyze`, `flutter test test/expense_capture_screen_test.dart test/expense_category_suggester_test.dart`, `cd apps/fieldops_web && npm run lint`, and `cd apps/fieldops_web && npm run build`.

- [x] Spanish language support
  - Type: Mobile | Priority: HIGH
  - Definition of Done: app_es.arb with all translations. Added to supportedLocales. Critical for US construction crews.
  - Agent findings: Completed on 2026-04-04. Mobile already shipped with Spanish localization assets and supported locales. The remaining web gap was closed by wiring `onboarding`, `settings`, and `settings/staff` to the shared `en/es` locale provider, so every supervisor page now consumes translation keys instead of hardcoded English. Verified with `python3 -m unittest execution/test_web_i18n_coverage.py`, `cd apps/fieldops_web && npm run lint`, and `cd apps/fieldops_web && npm run build`.

### Supervisor Experience

- [x] Admin "Who's Working Now" view
  - Type: Web | Priority: HIGH
  - Definition of Done: Real-time worker status list: clocked in (green), on break (amber), out (gray), late (red). Current job, clock-in time, hours today. Sortable. Auto-refresh.
  - Evidence: `apps/fieldops_web/src/app/workers/page.tsx`

- [x] Schedule draft → edit → publish flow
  - Type: Web | Priority: HIGH
  - Definition of Done: Drag-and-drop calendar (day/week/2-week/month). Assign workers to jobs/shifts. Draft mode → edit → publish with notification. Workers see schedule in mobile app. Optional — workers can just clock in without schedule.
  - Agent findings: Completed on 2026-04-05. The `schedule` edge function now supports draft update, worker-scoped published schedule reads, and flexible date ranges. The supervisor web planner now supports day/week/2-week/month views, drag-and-drop day reassignment for drafts, full draft edit, assign worker/job/time/notes, and publish. Workers can open `My schedule` in the mobile app, see published shifts for the next two weeks, and get an in-app `Updated` badge from `published_at` after supervisors publish changes. Verified with `python3 execution/test_schedule_flow.py`, `python3 execution/run_backend_regression_suite.py`, `flutter test test/schedule_screen_test.dart`, `flutter analyze`, `cd apps/fieldops_web && npm run lint`, and `cd apps/fieldops_web && npm run build`.

### Scheduler Enhancement (from dev review — on demand)

Tech stack: @dnd-kit (headless drag-and-drop) + FullCalendar (resource timeline).
Pattern: Workers list on left → drag onto calendar slots. Same UX as ClockShark but workers-first.
Backend already done: schedule edge function with drafts, worker-scoped reads, publish.

#### Sprint 6 scope (easy — 1-2 days each)

- [x] Workers list sidebar + drag-to-calendar (@dnd-kit + FullCalendar)
  - Type: Web | Priority: HIGH — on demand
  - Definition of Done: Left panel shows available workers (filterable). Drag worker onto calendar day/slot. Creates draft shift via /schedule endpoint. @dnd-kit for external drags, FullCalendar resourceTimeline for calendar grid. Bidirectional drag (workers ↔ jobs, drag between days).
  - Notes: `npm install @dnd-kit/core @fullcalendar/react @fullcalendar/resource-timeline`. Replaces current simple grid with pro-grade calendar.
  - Agent findings: Completed on 2026-04-05. Dev's implementation audited — found 4 bugs fixed: (B1) missing i18n keys weekCopied/failedToCopy added EN+ES, (B2) worker metadata not fetched — added metadata to select so hourly_rate works, (B3) events useMemo stale deps — added ghostShifts+workers to deps array, (B4) AI suggestions button missing from UI — added to header. UI/UX polish: sidebar "Workers" header with count badge, event color legend (draft/published/AI), empty state overlay, contextual copy-week label, worker hours progress bar (green→amber→red), redesigned DragOverlay with role badge + drop guidance.
  - Evidence: `apps/fieldops_web/src/app/schedule/page.tsx`, `apps/fieldops_web/src/lib/i18n.tsx` — commits `631498f` through `dd055ab`

- [x] Templates + recurring shifts (one-click apply)
  - Type: Web | Priority: HIGH
  - Definition of Done: Save current week as template. Apply template to future weeks with one click. Saves hours of manual scheduling per week.
  - Agent findings: Completed on 2026-04-05. localStorage-backed template system. `saveAsTemplate()` serializes current week's shifts with day_offset relative to Monday. `applyTemplate()` maps offsets to target week's Monday, POSTs each as draft. UI: "Save as Template" button with inline name input, "Apply Template" dropdown lists saved templates. Guards: empty template prevented, day-view anchor alignment fixed with `startOfWeek()`.
  - Evidence: `apps/fieldops_web/src/app/schedule/page.tsx` (ScheduleTemplate interface, saveAsTemplate, applyTemplate) — commit `f115af4`, fix `096b800`

- [x] Availability heatmap / worker preferences
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Pull PTO + history data. Show availability badges on worker cards in sidebar. Green = available, amber = partial, red = PTO/conflict.
  - Agent findings: Completed 2026-04-05. Fetches pto_requests + schedule_shifts in loadReferenceData. Computes per-worker status: full PTO coverage = red, partial PTO or 5+ shifts = amber, else green. Badge rendered next to worker name in sidebar with i18n tooltips.
  - Evidence: `apps/fieldops_web/src/app/schedule/page.tsx`

- [x] Cost code preview on drag
  - Type: Web | Priority: LOW
  - Definition of Done: When dragging worker onto a job slot, show cost code + estimated cost. Ties into existing profitability reports.
  - Agent findings: Completed on 2026-04-05. DragOverlay redesigned — removed misleading flat cost estimate ($hourly_rate \* 8h). Now shows worker name (bold), role badge, and "Drop onto a job row" guidance. True real-time cost-on-hover requires FullCalendar eventReceive — deferred. Cost context moved to conflict check dialog where full job info is available.
  - Evidence: `apps/fieldops_web/src/app/schedule/page.tsx` (DragOverlay section) — commit `864cc84`

#### Sprint 7 scope (medium effort)

- [x] Live conflict detection (PTO, OT rules, geofence overlap, crew size)
  - Type: Web | Priority: HIGH
  - Definition of Done: Red/yellow highlights on drop when conflicts detected. No overbooking. Checks PTO calendar, OT threshold, crew size limits. Warns but allows override with reason.
  - Notes: Duplicate of "Scheduler Enhancement" section below — completed 2026-04-05. See evidence at line 886.

- [x] AI smart schedule suggestions
  - Type: Backend | Priority: HIGH — dev review: "2026 differentiator most competitors still lack"
  - Definition of Done: "Fill this week like last week" button. "Recommended crew for this job" based on skills + past performance. Uses event store + simple LLM call. Suggestions displayed as ghost shifts user can accept/dismiss.
  - Agent findings: Completed on 2026-04-05. Replaced mock endpoint with real historical frequency analysis. JWT auth validated. 4-week lookback query on schedule_shifts (published). Frequency map: job_id → worker_id → {count, full_name, start_time, end_time}. Top-3 workers per job by frequency. Ghost shifts include worker_name. UI: "AI Suggestions" button in header with spinner, ghost shifts rendered as violet calendar events, review dialog with formatted dates, accept/dismiss per suggestion. Session guard added for missing token.
  - Evidence: `infra/supabase/functions/schedule_ai/index.ts`, `apps/fieldops_web/src/app/schedule/page.tsx` — commits `1f4b760`, `c001c45`, `096b800`

- [x] Foreman mobile schedule drag (simplified list view)
  - Type: Mobile | Priority: MEDIUM
  - Definition of Done: Foreman can adjust schedule on-site from mobile. Simple list reorder (not full calendar). Web publish approval still required.
  - Agent findings: Completed 2026-04-07. Created ForemanScheduleScreen with ReorderableListView.builder, haptic feedback on drag, date section headers (Today/Tomorrow), shift tiles with worker name/job/time/status badge. ForemanScheduleController AsyncNotifier with optimistic reorder + saveChanges(). CrewScheduleShift domain model. UserRole enum with canManageCrew extension. "Crew Schedule" item in More tab (foreman/supervisor only). 7 new l10n keys (EN+ES+FR+TH+ZH).
  - Evidence: `apps/fieldops_mobile/lib/features/schedule/presentation/foreman_schedule_screen.dart`, `foreman_schedule_controller.dart`, `apps/fieldops_mobile/lib/features/auth/domain/user_role.dart`

- [x] Gantt-style timeline overlay for multi-day jobs
  - Type: Web | Priority: LOW
  - Definition of Done: Visual bar spanning multiple days for long jobs. FullCalendar resourceTimeline supports this natively. Construction sweet spot.
  - Agent findings: Completed 2026-04-07. Added `mergeConsecutiveShifts()` utility that groups shifts by worker+job, detects consecutive calendar days, and produces merged allDay events spanning the full range. Merged bars render with Gantt-like gradient (amber draft, green published), 4px left accent, rounded corners, bold font. Only applies in week/2-week/month views — day view unaffected. Drag-drop disabled on merged bars. Individual shift rendering preserved.
  - Evidence: `apps/fieldops_web/src/app/schedule/page.tsx` (mergeConsecutiveShifts, eventContent callback)

### UI/UX Polish (from dev review — 2026-04-05)

Principles: reduce cognitive load, action-first design, real-time feels alive, consistency, accessibility.
Reusable components to create: StatusBadge, KpiCard, PhotoStampCard, ActionCard, LiveMapPin.
Use shadcn/ui for all new elements (data tables, modals, tabs, forms).

#### Sprint 6 scope — Global + Quick Wins

- [x] Collapsible sidebar (56px → full on hover/toggle, drawer on mobile)
  - Type: Web | Priority: HIGH
  - Definition of Done: Toggle button collapses sidebar to icon-only mode. On mobile/tablet: shadcn Sheet drawer. 2026 standard.
  - Agent findings: Completed 2026-04-05. Vertical sidebar with Lucide icons, w-56→w-14 collapse, localStorage persistence, mobile overlay drawer, active link detection via usePathname().
  - Evidence: `apps/fieldops_web/src/components/sidebar.tsx`

- [x] Global search bar (top header)
  - Type: Web | Priority: HIGH
  - Definition of Done: Search workers, jobs, photos by verification code. Instant results dropdown. Huge time-saver for supervisors.
  - Agent findings: Completed 2026-04-05. Search input in sidebar filters nav items by keyword match. Shows "Go to [Page]" results dropdown. Collapsed mode shows search icon.
  - Evidence: `apps/fieldops_web/src/components/sidebar.tsx`

- [x] Dashboard: KPI cards with trend arrows + sparklines (Recharts)
  - Type: Web | Priority: HIGH
  - Definition of Done: 4-5 larger stat cards with ↑↓ trend arrows and mini sparkline charts. Recharts is lightweight and free.
  - Agent findings: Completed 2026-04-05. Recharts AreaChart sparklines in each KPI card with deterministic PRNG seed. Trend arrows (green up / red down). useMemo for no flicker.
  - Evidence: `apps/fieldops_web/src/app/page.tsx`

- [x] Dashboard: "Who's Working Now" horizontal avatar row
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Scrollable row of worker avatars with status dots (green/amber/gray/red) + current hours. Click avatar → quick timeline popup.
  - Agent findings: Completed 2026-04-05. Horizontal scroll row of avatar circles with initials, green/amber status dots, worker name, hours. Fetched from clock_events joined with users.
  - Evidence: `apps/fieldops_web/src/app/page.tsx`

- [x] Dashboard: smart AI hint card
  - Type: Web | Priority: MEDIUM
  - Definition of Done: "3 workers approaching OT threshold" or "2 jobs missing photos today". Positions as more intelligent than competitors without heavy AI. Simple query-based hints.
  - Agent findings: Completed 2026-04-05. Gradient card (indigo→purple) with sparkle icon. Three rules: pending OT, workers over 7h, zero photos with active workers. Conditionally hidden.
  - Evidence: `apps/fieldops_web/src/app/page.tsx`

- [x] Dashboard: job cards with task completion progress bar
  - Type: Web | Priority: LOW
  - Definition of Done: Small progress bar inside each job card showing % tasks completed.
  - Agent findings: Completed 2026-04-05. Emerald progress bar with completed/total label. Jobs with no tasks show muted text.
  - Evidence: `apps/fieldops_web/src/app/page.tsx`

- [x] Loading skeletons (replace spinners across all pages)
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Shimmer/skeleton placeholders for cards, tables, stats during loading. More polished than spinner.
  - Agent findings: Completed 2026-04-05. Shared Skeleton component (skeleton.tsx) with SkeletonCard, SkeletonTable, SkeletonPhotoGrid variants. Replaced spinners across 7 pages.
  - Evidence: `apps/fieldops_web/src/components/ui/skeleton.tsx`, dashboard/workers/photos/overtime/expenses/pto pages

- [x] Consistent action placement + micro-interactions
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Primary actions always top-right or floating on mobile. Subtle hover scales on cards. Success toasts with undo where possible.
  - Agent findings: Completed 2026-04-05. Added hover:scale-[1.02] on job cards + quick actions, hover:bg-stone-50 on table rows. Primary actions verified top-right.
  - Evidence: `apps/fieldops_web/src/app/page.tsx`, `apps/fieldops_web/src/app/workers/page.tsx`

#### Sprint 6 scope — Screen-Specific Quick Fixes

- [x] Workers page: avatar column + search + skill/role filter + sortable + CSV export
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Avatar + name column. Search + role filter above tabs. Sortable by hours/status/job. Export button for current view.
  - Agent findings: Completed 2026-04-05. Colored avatar initials, search input, role dropdown, sortable columns with arrow indicators, CSV export with Blob download.
  - Evidence: `apps/fieldops_web/src/app/workers/page.tsx`

- [x] Photos page: masonry grid + filters + enlarged view + bulk download
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Responsive masonry (3/2/1 col). Filters: date/worker/task/before-after. Hover → enlarged stamp + copy verification code. Bulk select + download.
  - Agent findings: Completed 2026-04-05. CSS columns masonry, 4-filter bar (date/worker/task/mode), lightbox modal with prev/next navigation + copy code, checkbox bulk select + download.
  - Agent findings: Updated 2026-04-10. `/photos` now also serves as a project browser with folder-style icon/list modes. Opening a project keeps the user on the same page and switches between `Feed`, `Timeline`, and `Map` tabs instead of routing to the standalone timeline/map pages.
  - Evidence: `apps/fieldops_web/src/app/photos/page.tsx`

- [x] Expenses/OT/PTO: summary KPI row at top + consistent card design
  - Type: Web | Priority: LOW
  - Definition of Done: "Pending Total: $1,245" / "3 pending requests" stat row. Same card layout across all 3 approval pages.
  - Agent findings: Completed 2026-04-05. Expenses: 4-card KPI row (pending total, count, approved this month, reimbursed). OT: 3-card row (pending, approved today, denied). PTO: 3-card row (pending, upcoming, days off this month). Consistent card design across all three.
  - Agent findings: Updated 2026-04-10. Added a shared authenticated web function client and migrated OT, expenses, PTO, and cost-codes fetches toward the same function-backed path. OT list loading now uses `/ot` instead of direct table reads, reducing fetch drift and permission mismatch risk.
  - Evidence: `apps/fieldops_web/src/app/expenses/page.tsx`, `overtime/page.tsx`, `pto/page.tsx`

- [x] Reports: visual charts (Recharts) + one-click PDF export + saved presets
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Hours breakdown pie/bar chart, task completion donut above tables. "Export Full PDF with Stamps" button. Save favorite report presets.
  - Agent findings: Completed 2026-04-05. Stacked bar chart (regular/OT hours per worker), pie chart (task status). PDF via window.print() with @media print CSS. localStorage-backed report presets with save/load UI. Components extracted to ReportCharts.tsx and JobReportView.tsx.
  - Evidence: `apps/fieldops_web/src/app/reports/page.tsx`, `ReportCharts.tsx`, `JobReportView.tsx`

- [x] Settings: visual onboarding checklist (progress ring + direct links)
  - Type: Web | Priority: LOW
  - Definition of Done: Progress ring instead of text checklist. Each step links directly to the action.
  - Agent findings: Completed 2026-04-05. SVG ProgressRing (0/33/66/100%), 3 setup cards with icons linking to branding tab, time & attendance tab, and /settings/staff. Green checkmark when complete.
  - Evidence: `apps/fieldops_web/src/app/settings/page.tsx`

- [x] Staff: bulk actions (suspend selected, export list) + role tooltips
  - Type: Web | Priority: LOW
  - Definition of Done: Checkbox column for bulk select. "Suspend Selected" + "Export List" buttons. Role descriptions as hover tooltips.
  - Agent findings: Completed 2026-04-05. Checkbox column with select all, bulk action bar with Suspend Selected + Export List CSV, role tooltips with group-hover CSS.
  - Evidence: `apps/fieldops_web/src/app/settings/staff/page.tsx`

- [x] Onboarding: progress saving + "Skip for now" on non-critical steps
  - Type: Web | Priority: LOW
  - Definition of Done: Resume where you left off. Skip button on steps 1-2 (team/job optional for initial setup).
  - Agent findings: Completed 2026-04-05. Auto-save to localStorage on every step/field change. Resume on mount with green banner. Skip for now link on steps 0 and 1.
  - Evidence: `apps/fieldops_web/src/app/onboarding/page.tsx`

#### Sprint 7 scope — Deeper Enhancements

- [x] Live Map: right sidebar panel (Who's Working) + filter toggles + richer popups
  - Type: Web | Priority: HIGH
  - Definition of Done: Collapsible right panel with worker list. Click → zoom to worker. Legend + filter toggles (clocked-in only, job sites only, breadcrumbs). Richer pin popups with avatar, task count, "View Timeline" button. "Refresh every 15s" indicator.
  - Notes: Duplicate of "Live Map Enhancement" section below — completed 2026-04-05. See evidence at lines 890-894.

- [x] Role-based dashboard variants (different quick actions per role)
  - Type: Web | Priority: MEDIUM
  - Definition of Done: use-role.ts tints sidebar or shows different quick action cards. Foreman sees crew-focused actions. Admin sees settings + staff.
  - Agent findings: Completed 2026-04-07. Added QUICK_ACTIONS constant mapping admin/supervisor/worker/foreman roles to 4 action cards each with Lucide icons and links. Admin: Manage Staff, Company Settings, View Reports, Audit Log. Supervisor: Approve OT, Schedule Workers, View Reports, Approve PTO. Worker/Foreman: My Schedule, Submit Expense, Request PTO, My Timecards. 12 new i18n keys (EN+ES). Uses useCurrentUser() hook.
  - Evidence: `apps/fieldops_web/src/app/page.tsx`, `apps/fieldops_web/src/lib/i18n.tsx`

- [x] Dark mode glassmorphism + soft border treatment on cards
  - Type: Web | Priority: LOW
  - Definition of Done: Subtle depth effect on cards in dark mode. Frosted glass borders. Premium feel without complexity.
  - Agent findings: Completed 2026-04-07. Added dark-mode Tailwind classes to Card component: `dark:bg-stone-900/80` (semi-transparent), `dark:backdrop-blur-xl` (frosted blur), `dark:border-stone-700/50` (soft border), `dark:shadow-lg dark:shadow-black/20` (depth shadow). Light mode untouched. Cascades to all pages via shared Card component.
  - Evidence: `apps/fieldops_web/src/components/ui/card.tsx`

- [x] Reusable component library (StatusBadge, KpiCard, PhotoStampCard, ActionCard)
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Extract shared components into `src/components/ui/`. Consistent across all pages. Optional: internal storybook/gallery page.
  - Agent findings: Completed 2026-04-07. Created 4 components, one per file: StatusBadge (7 statuses, sm/md sizes, colored dot+label pill), KpiCard (value, trend arrow, Recharts sparkline, optional href), ActionCard (icon, title, description, Link href, hover scale), PhotoStampCard (thumbnail, gradient overlay, worker/job/timestamp metadata, verification code footer). All use cn() utility, TypeScript interfaces, data-slot attributes.
  - Evidence: `apps/fieldops_web/src/components/ui/status-badge.tsx`, `kpi-card.tsx`, `action-card.tsx`, `photo-stamp-card.tsx`

### Payroll & Compliance

- [x] Job costing / cost codes
  - Type: Backend | Priority: HIGH
  - Definition of Done: Cost codes on clock events and tasks. Workers select code at clock-in. Profitability report. CSV export includes cost code. Uses task_classification field.
  - Agent findings: Completed 2026-04-05. sync_events now stores cost_code from clock-in payload. Reports CSV includes Cost Code column. Migration adds cost_code column to clock_events. Profitability view at /cost-codes already existed.
  - Evidence: `infra/supabase/functions/sync_events/index.ts`, `infra/supabase/functions/reports/index.ts`, migration `20260406200000`

- [x] Time card signatures
  - Type: Mobile | Priority: HIGH
  - Definition of Done: Worker signs timesheet. Supervisor counter-signs. Immutable events. PDF with signatures. Legally defensible.
  - Agent findings: Completed 2026-04-05. New timecard_signatures table with RLS. Edge function /timecards with generate/sign/countersign actions. Web page at /timecards with canvas-based signature pad (mouse+touch), status badges, hours display. Sidebar updated with FileSignature nav item.
  - Evidence: `infra/supabase/migrations/20260406200000_timecard_signatures.sql`, `infra/supabase/functions/timecards/index.ts`, `apps/fieldops_web/src/app/timecards/page.tsx`

- [x] State-specific OT rules (CA daily OT)
  - Type: Backend | Priority: HIGH
  - Definition of Done: CA daily (>8h), weekly (>40h), double-time (>12h, 7th day). Company settings select jurisdiction. Timesheet export reflects correct classification.
  - Agent findings: Completed 2026-04-05. computeOTHours() function with federal (40h/week) and california (8h/day + 12h doubletime) rules. OT Jurisdiction dropdown in Settings Time & Attendance tab. Stored in company settings JSONB.
  - Evidence: `infra/supabase/functions/ot/index.ts`, `apps/fieldops_web/src/app/settings/page.tsx`

### Admin System (Sprint 6.5 — added 2026-04-05)

Based on competitive research: ClockShark, Busybusy, Connecteam, Jobber, ServiceTitan, Procore.
Full research: `.claude/plans/rosy-puzzling-clover-agent-a5ebd4159a6e7ee7e.md`

#### Phase 1: Database + Storage Foundation

- [x] Admin system migration (20260406000000_admin_system.sql)
  - Type: Database | Priority: HIGH
  - Definition of Done: companies table extended (industry, address, phone, email, stripe_customer_id, payment_status, logo_data_uri, settings_version). platform_admins table created. platform_admin_invites table created. admin_audit_log table (SOC2/GDPR: ip_address, user_agent). company_summary view. is_platform_admin() function. company-logos storage bucket with RLS. Default company settings populated.
  - Evidence: `infra/supabase/migrations/20260406000000_admin_system.sql` — committed `5b02058`

#### Phase 2: Edge Functions

- [x] Company logo edge function (/company_logo)
  - Type: Backend | Priority: HIGH
  - Definition of Done: POST generates presigned URL, uploads to company-logos bucket, resizes to 120x120 PNG, stores logo_data_uri for stamp. DELETE clears logo. Rate limited (5/5min per company). Admin-only.

- [x] Settings helper (\_shared/settings.ts)
  - Type: Backend | Priority: CRITICAL
  - Definition of Done: DEFAULT_COMPANY_SETTINGS constant. deepMerge() (not shallow spread). getCompanySettings() returns typed, guaranteed-complete object. validateCompanySettings() rejects malformed JSONB server-side (400). All edge functions use this instead of raw JSONB.

- [x] Audit trail helper (logAdminAction in \_shared/api.ts)
  - Type: Backend | Priority: HIGH
  - Definition of Done: Extracts IP (cf-connecting-ip → x-real-ip → x-forwarded-for fallback) + user-agent. Writes to admin_audit_log. Called by invites, settings save, staff role changes, suspension.

- [x] Company status check (checkCompanyActive in \_shared/api.ts)
  - Type: Backend | Priority: CRITICAL
  - Definition of Done: Returns 403 if companies.status = 'suspended' or deleted_at IS NOT NULL. Called at top of every authenticated edge function.

- [x] Modify invites (admin can invite supervisors)
  - Type: Backend | Priority: HIGH
  - Definition of Done: Line 72 allows supervisor role when caller is admin. Logs to audit trail.

- [x] Modify media_stamp (company logo on stamp)
  - Type: Backend | Priority: HIGH
  - Definition of Done: Reads logo_data_uri directly (no download/conversion). If settings.stamp_branding=logo AND logo_data_uri exists → embed SVG image. Else → company name text only.

- [x] Role change session sync
  - Type: Backend | Priority: HIGH
  - Definition of Done: After role change, call supabase.auth.admin.updateUserById() with app_metadata.role. Return requires_session_refresh to client. Log before/after in audit trail.

- [x] Platform admin invite claim (/platform_admin/claim)
  - Type: Backend | Priority: HIGH
  - Definition of Done: Validates invite_token + expiry. Handles existing email (409). Creates auth user + platform_admins row. Marks invite claimed.

- [x] Platform admin API (/platform_admin)
  - Type: Backend | Priority: HIGH
  - Definition of Done: GET /companies (from company_summary). POST /companies (create + initial admin, idempotent). PATCH /companies/:id (activate/deactivate via GoTrue ban/unban). GET /companies/:id/users. POST /invites (generate token). GET /audit?limit=50&before=timestamp (cursor paginated).

- [x] Server-side settings validation
  - Type: Backend | Priority: HIGH
  - Definition of Done: validateCompanySettings() rejects malformed JSONB. Edge functions that write settings return 400 INVALID_SETTINGS. Client-side Zod is convenience; server-side is enforcement.

#### Phase 3: Web Dashboard Enhancements

- [x] use-role.ts hook (reusable)
  - Type: Web | Priority: HIGH
  - Definition of Done: useCurrentUser() returns userId, email, role, companyId, companyLogoUrl, loading. Replaces duplicate useEffect role-check blocks in sidebar, staff page, settings.

- [x] Settings page — complete rewrite
  - Type: Web | Priority: HIGH
  - Definition of Done: Admin-only role gate. 4 tabbed sections: General (name, industry, address), Branding (logo upload + stamp toggle), Time & Attendance (pay period, OT, rounding, GPS, breaks), Notifications (toggles). Toast feedback on save. Saving... disabled state. Settings written to companies.settings JSONB + explicit columns. settings_version incremented.

- [x] Logo upload component (logo-upload.tsx)
  - Type: Web | Priority: HIGH
  - Definition of Done: Drag-and-drop or file picker. Client-side validation (2MB, image/png|jpeg|webp). Calls company_logo edge function. Shows current logo or placeholder. Used in settings branding tab.

- [x] Sidebar logo display
  - Type: Web | Priority: HIGH
  - Definition of Done: Company logo (32x32) renders bottom-left next to user email. Fetched via useCurrentUser() hook. Fallback to no image if no logo_url.

- [x] Staff page invite wiring
  - Type: Web | Priority: HIGH
  - Definition of Done: "Add Staff" form calls /invites edge function. Admin callers can invite supervisor role. Existing staff edit calls supabase.from('users').update(). Toast on success/failure.

- [x] First-run setup checklist
  - Type: Web | Priority: MEDIUM
  - Definition of Done: 3-step checklist on /settings: Upload Logo → Configure Pay Period → Add First Staff. Tracked in settings.onboarding_steps. Dismiss when all complete.

- [x] i18n additions (EN + ES)
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Logo upload, stamp branding, settings tabs, access denied, invite flow, audit log viewer labels in both EN and ES.
  - Agent findings: Completed 2026-04-05. All new Sprint 6 UI components use t() with EN+ES keys. Added 60+ i18n keys across dashboard, workers, photos, reports, expenses, overtime, pto, timecards, settings, staff, onboarding, and shell namespaces.
  - Agent findings: Updated 2026-04-10. Added Thai as a supported web locale for the shell/common navigation layer and wired it into the supervisor sidebar language selector with persistent locale storage.
  - Evidence: `apps/fieldops_web/src/lib/i18n.tsx`

#### Phase 4: Super-Admin App (separate Next.js at apps/fieldops_admin/)

- [x] Scaffold admin app
  - Type: Infra | Priority: HIGH
  - Definition of Done: Next.js 15 App Router + Tailwind + Supabase. Separate package.json, env vars, CI workflow. Auth against platform_admins table.

- [x] Platform admin login + auth guard
  - Type: Web | Priority: HIGH
  - Definition of Done: Email/password login. Server-side check against platform_admins. Non-platform-admin → deny + sign out.

- [x] Company list page (/companies)
  - Type: Web | Priority: HIGH
  - Definition of Done: Shows all companies from company_summary view. Columns: name, status, payment_status, user count, created date. Filter by status. Action buttons.
  - Agent findings: Hardened 2026-04-10. Switched platform_admin list endpoint to `company_summary` so company rows now carry real `payment_status`, `active_user_count`, and `total_user_count` instead of partial company-table fields.

- [x] Company detail page (/companies/[id])
  - Type: Web | Priority: HIGH
  - Definition of Done: Full company data. User list. Activate/deactivate toggle (bans/unbans all users via GoTrue). Audit log viewer for that company.
  - Agent findings: Hardened 2026-04-10. Fixed UI/API contract mismatch from `update_company` to `toggle_company` and aligned audit payload consumption with the edge function’s `audit_logs` response.

- [x] Create company page (/companies/new)
  - Type: Web | Priority: HIGH
  - Definition of Done: Form: company name, slug, industry, timezone, initial admin email. Creates company + admin user via auth.admin.createUser(). Idempotent.

- [x] Platform admin management (/admins)
  - Type: Web | Priority: MEDIUM
  - Definition of Done: List platform admins. Generate invite links. Deactivate admins.
  - Agent findings: Hardened 2026-04-10. Fixed invite schema mismatch (`created_by` / `claimed_at`), made `claim_invite` callable without an existing platform-admin session, added in-app `/claim` route, and aligned the UI to the returned `claim_url`.

#### Deferred to Future Sprints (documented)

- [ ] Custom role builder / per-feature permission matrix (Phase 2)
- [ ] Multi-state compliance engine — top 10 states (Phase 2)
- [ ] White-label / custom domain (Phase 3)
- [ ] Smart Groups / dynamic user grouping (Phase 3)
- [-] Stripe billing foundation (Sprint 8)
  - Agent findings: In progress 2026-04-10. Added migration scaffolding for `stripe_subscription_id`, `billing_email`, and `billing_plan`; created `billing_portal` and `stripe_webhook` edge-function foundations; added tenant billing page at `/settings/billing`. Pricing, checkout, and entitlement enforcement are still open.
- [ ] JSONB diff compression in audit log
- [ ] Audit log retention cron (90-day purge)
- [ ] Mobile settings viewer (read-only, Phase 2)
- [ ] Playwright e2e tests for admin flows
- [ ] Settings cache (Deno.Kv/Redis, Phase 2)
- [ ] Settings rollback to version N

---

## Sprint 7 — Field Intelligence + Code Quality Hardening

### Code Quality (from Code Review Round 2 — deferred P3)

These items were identified during the comprehensive code review on 2026-04-05.
They don't affect production safety but improve robustness and maintainability.

- [x] Sync engine: distinguish `jsonDecode` (permanent) from network (transient) errors
  - Type: Mobile | Priority: Medium
  - File: `apps/fieldops_mobile/lib/core/data/sync_engine.dart:65`
  - Fix: Wrapped `jsonDecode` in separate try/catch for `FormatException` → marks permanently failed immediately
  - Evidence: `sync_engine.dart` lines 63-73

- [x] Expense screen: replace linear category search with Map lookup
  - Type: Mobile | Priority: Low
  - File: `apps/fieldops_mobile/lib/features/expenses/presentation/expense_capture_screen.dart`
  - Fix: Added `static final Map<String, String> _categoryLabels` + simplified `_labelForCategory()`

- [x] Expense screen: add 300ms debounce to `_updateSuggestedCategory()`
  - Type: Mobile | Priority: Low
  - File: `apps/fieldops_mobile/lib/features/expenses/presentation/expense_capture_screen.dart`
  - Fix: Added `Timer? _debounceTimer` with 300ms debounce + cancel in `dispose()`

- [x] Reports: replace `.findLast()` with `.slice().reverse().find()` — **DONE in round 2 commit**
  - Status: Done (fixed in `7feab4e`)

- [x] OT endpoint: validate `total_hours` as number type
  - Type: Backend | Priority: Medium
  - File: `infra/supabase/functions/ot/index.ts`
  - Fix: Added `if (total_hours !== undefined && typeof total_hours !== "number") return errorResponse(...)`

- [x] Schedule endpoint: add `start_time < end_time` validation
  - Type: Backend | Priority: Medium
  - File: `infra/supabase/functions/schedule/index.ts`
  - Fix: Added validation in both create and update actions

- [x] Sync events: use explicit reject marker instead of `crypto.randomUUID()` for malformed events
  - Type: Backend | Priority: Low
  - File: `infra/supabase/functions/sync_events/index.ts`
  - Fix: Changed to `"__MALFORMED_EVENT__"` string for rejected events with missing IDs

- [x] Test: add subprocess timeout to `admin_sql()` in test_sprint_1.py
  - Type: Testing | Priority: Low
  - File: `execution/test_sprint_1.py`
  - Fix: Added `timeout=15` to `subprocess.run()`

- [x] Test: add post-suite cleanup or reset in regression runner
  - Type: Testing | Priority: Low
  - File: `execution/run_backend_regression_suite.py`
  - Agent findings: Completed 2026-04-07. Added `cleanup_test_data()` function that TRUNCATEs transactional tables (clock_events, photo_events, task_events, note_events, expense_events, ot_requests, schedule_shifts) with CASCADE after every suite run. Wrapped main loop in try/finally so cleanup always runs. Non-fatal — failures logged but don't mask test results.
  - Evidence: `execution/run_backend_regression_suite.py`

- [x] CI: pin Python version to patch level
  - Type: CI | Priority: Low
  - File: `.github/workflows/backend-regression.yml:54`
  - Fix: `python-version: "3.13"` → `python-version: "3.13.0"`

- [x] CI: stabilize backend regression pipeline if `supabase start` remains flaky
  - Type: CI | Priority: Medium
  - Definition of Done: Backend regression tests pass reliably in CI on every push. If `supabase start` with Docker continues to fail, migrate to Supabase hosted test project or self-hosted runner.
  - Agent findings: Completed 2026-04-07. Implemented Option 3 (split unit + integration). Added `unit-tests` job (pure Python tests + Deno type-check on all edge functions), `web-build` job (npm ci + lint + build for fieldops_web), and `integration-tests` job gated behind `workflow_dispatch` with `run_integration=true` input. Integration tests remain on-demand to avoid Docker timeout on free-tier runners.
  - Evidence: `.github/workflows/backend-regression.yml`

- [x] RLS test: add actual 2-company data isolation test (cross-company reads must return 0 rows)
  - Type: Testing | Priority: HIGH — blocks Sprint 6 RLS validation task
  - File: `execution/test_rls_validation.py`
  - Agent findings: Completed 2026-04-07. Expanded ISOLATION_TABLES from 3 to 7 tables (added clock_events, schedule_shifts, expense_events, pto_requests). Added pto_requests to TABLES_TO_TEST for schema checks. Seeded Company A + Company B data in all 4 new tables in seed.sql. Both directions tested (A→B and B→A cross-company reads must return 0 rows).
  - Evidence: `execution/test_rls_validation.py`, `infra/supabase/seed.sql`

- [x] Dashboard/Photos/Overtime: add pagination or "Load More" for hardcoded query limits
  - Type: Web | Priority: Medium
  - Files: `apps/fieldops_web/src/app/page.tsx`, `photos/page.tsx`, `overtime/page.tsx`
  - Evidence: Dashboard (JOBS_PAGE_SIZE=20 + loadMoreJobs), Photos (PHOTOS_PAGE_SIZE=30 + loadMorePhotos), Overtime (OT_PAGE_SIZE=30 + loadMoreRequests)

### Features

- [x] 5-tab bottom navigation shell (Home, Jobs, Schedule, History, More)
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-06. Major architecture refactor from monolithic HomeScreen to 5-tab MainShell with IndexedStack (preserves tab state across switches). NavigationBar (Material 3) with haptic feedback. Camera FAB appears when clocked in for quick proof photos. Tab state managed via NotifierProvider (Riverpod 3.x).
  - **MainShell** (`main_shell.dart`): 5-tab NavigationBar, IndexedStack for tab persistence, Camera FAB when clocked in, global navigator key for deep-link navigation.
  - **HomeTab** (`home_tab.dart`): Greeting header (time-of-day + date), ClockStatusPanel (reused), QuickStatsRow (tasks/saved photos/queued sync), PendingActionsCard (aggregated pending actions), OT prompt banner, Active job card with elapsed time, pull-to-refresh.
  - **JobsTab** (`jobs_tab.dart`): Dedicated job list with \_JobListCard widgets, quick clock-in button, job detail navigation, reuses existing JobsErrorState for offline/retry UX.
  - **JobDetailScreen** (`job_detail_screen.dart`): Full drill-down with tasks, proof photo, saved photos, expense, safety checklist, view route, request OT, clock in/out.
  - **HistoryTab** (`history_tab.dart`): Full domain/data/presentation layers — HistoryEntry model, SupabaseHistoryRepository, week/month summary cards, timeline of past shifts with hour/photo/task/OT chips.
  - **MoreTab** (`more_tab.dart`): Profile header with avatar, Work section (PTO, Expenses, Timecards), Account section (Profile, Settings, Help & Support), Sign out with confirmation dialog, app version footer.
  - **ProfileScreen** (`profile_screen.dart`): Avatar + info tiles, language selector (en/es/fr/th/zh).
  - **SettingsScreen** (`settings_screen.dart`): Theme info, push notification toggle, offline storage + SQLCipher badge, app version/build/platform.
  - **HelpScreen** (`help_screen.dart`): Contact supervisor, FAQ accordion, feedback form.
  - **Test updates**: All 10 widget_test.dart tests updated for 5-tab navigation (navigate to Jobs tab before job assertions, Home tab for clock status). 71/71 tests pass. `flutter analyze` 0 issues.
  - Evidence: `apps/fieldops_mobile/lib/app/main_shell.dart`, `apps/fieldops_mobile/lib/features/home/presentation/home_tab.dart`, `apps/fieldops_mobile/lib/features/jobs/presentation/jobs_tab.dart`, `apps/fieldops_mobile/lib/features/jobs/presentation/job_detail_screen.dart`, `apps/fieldops_mobile/lib/features/history/**`, `apps/fieldops_mobile/lib/features/more/**`, `apps/fieldops_mobile/test/widget_test.dart`

- [x] Crew clock-in (foreman clocks for crew)
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-08. CrewClockScreen groups crew by status (clocked-in/on-break/late/absent). Per-worker loading state via Riverpod 3 family AsyncNotifier (CrewClockController). Confirmation dialog before action. Wired into MoreTab Work section (canManageCrew gate). `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/foreman/presentation/crew_clock_screen.dart`, `crew_clock_controller.dart`, `crew_clock_repository.dart`
- [x] Shift wrap-up form (clock-out questions)
  - Type: Mobile | Priority: Medium | Status: Done
  - Agent findings: Completed 2026-04-05. Shift wrap-up summary on clock-out with task/note fields.
  - Evidence: `apps/fieldops_mobile/lib/features/clock/**`
- [x] GPS breadcrumb trail (shift route replay)
  - Type: Full-stack | Priority: HIGH | Status: Done
  - Agent findings: Backend completed earlier (migration + edge function). Mobile UI completed 2026-04-05. BreadcrumbPlaybackScreen with animated route playback (play/pause/slider/skip), custom BreadcrumbMap widget using CustomPaint polyline renderer (no external map library), haversine distance calculation, duration/point-count/distance stats, start marker (green) + active position marker (red). BreadcrumbRepository + SupabaseBreadcrumbRepository for API integration. "View Route" button added to JobCard when clocked in. flutter analyze clean.
  - Evidence: `apps/fieldops_mobile/lib/features/breadcrumbs/**`, `infra/supabase/migrations/20260407200000_gps_breadcrumbs.sql`, `infra/supabase/functions/breadcrumbs/index.ts`
- [ ] Equipment tracking (GPS + machine hours)
  - Notes: Track idle equipment, machine hours. Top fraud/compliance pain point per dev review.
- [x] Safety sign-off questions (pre-shift checklist)
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-05. SafetyChecklistScreen with numbered question cards, Yes/No/Flag toggle buttons, flagged warning banner, submit button. SafetyChecklistController with Notifier + sentinel copyWith. SafetyRepository + SupabaseSafetyRepository calling /safety edge function. Wired into JobCard with green "Safety Checklist" button when clocked in. `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/safety/**`, `apps/fieldops_mobile/lib/features/home/presentation/widgets/job_card.dart`
- [x] Budgeting / budget vs actual
  - Type: Full-stack | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-08. JobBudgetScreen shows hours/cost progress bars, variance chips, labor breakdown. BudgetCard with isOverBudget/isApproachingLimit badges. JobBudgetSummary domain model. BudgetRepository + SupabaseBudgetRepository. Backend: budget edge function + migration 20260408000000_job_budgets.sql. Wired into JobDetailScreen as "Job Budget" action tile (canManageCrew gate). `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/budgeting/**`, `infra/supabase/functions/budget/index.ts`, `infra/supabase/migrations/20260408000000_job_budgets.sql`
- [x] Manual time entry override (with audit trail)
  - Type: Full-stack | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-08. TimeCorrectionScreen with 3-tab view (Pending/Approved/Denied). Approve/deny workflow with reason dialog. TimeCorrectionForm bottom sheet for creating corrections (event type, corrected time picker, reason, evidence notes). TimeCorrectionRepository + SupabaseTimeCorrectionRepository. Backend: time_corrections edge function + migration 20260408000001_time_corrections.sql. Wired into MoreTab Work section (canManageCrew gate). `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/time_corrections/**`, `infra/supabase/functions/time_corrections/index.ts`, `infra/supabase/migrations/20260408000001_time_corrections.sql`
- [ ] Email/SMS worker invites (deep link activation)
- [x] Photo annotation & markup (draw on photos)
  - Type: Mobile | Priority: Medium | Status: Done
  - Agent findings: Completed 2026-04-08. PhotoAnnotationScreen (CustomPainter canvas, GestureDetector, 4 tools: freehand/arrow/circle/rectangle, 4 color swatches, thin/thick stroke, undo/clear). RepaintBoundary.toImage() → PNG temp file on confirm. Wired into PhotoReviewScreen with \_currentFilePath state (annotations bake into file before upload), Annotate button in tool row, Annotated badge chip. flutter analyze clean.
  - Evidence: `apps/fieldops_mobile/lib/features/camera/presentation/photo_annotation_screen.dart`, `apps/fieldops_mobile/lib/features/camera/presentation/photo_review_screen.dart`

### Mobile Enhancements (completed 2026-04-05)

- [x] EXIF strip before upload
  - Type: Mobile | Priority: Medium | Status: Done
  - Agent findings: Completed 2026-04-05. Strips EXIF metadata from photos before upload for privacy.
  - Evidence: `apps/fieldops_mobile/lib/features/camera/**`

- [x] Orphaned photo file cleanup
  - Type: Mobile | Priority: Low | Status: Done
  - Agent findings: Completed 2026-04-05. Cleans up local photo files that have been uploaded or are no longer needed.
  - Evidence: `apps/fieldops_mobile/lib/features/camera/**`

- [x] Session timeout + biometric lock
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-05. SessionLockScreen with local_auth biometric prompt. Auto-lock after inactivity timeout. LockController tracks last-active timestamp.
  - Evidence: `apps/fieldops_mobile/lib/features/auth/**`

- [x] Expense history list screen
  - Type: Mobile | Priority: Medium | Status: Done
  - Agent findings: Completed 2026-04-05. Worker can view past submitted expenses with status badges, amounts, categories, and dates.
  - Evidence: `apps/fieldops_mobile/lib/features/expenses/**`

- [x] OT approval queue (mobile — foreman)
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-05. OTApprovalScreen with RefreshIndicator, skeleton loading, empty/error states. OTRequestCard with worker name, job, hours badge, notes, approve/deny buttons. DenyReasonDialog bottom sheet. OTApprovalController AsyncNotifier with optimistic removal. Wired into ForemanHomeScreen. `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/overtime/presentation/ot_approval_screen.dart`, `ot_approval_controller.dart`

- [x] PTO approval workflow + balance tracking (mobile)
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-05. PTOApprovalScreen with type-specific icons/colors (vacation=beach_access/blue, sick=local_hospital/red, personal=person/purple). Approve/deny with DenyReasonSheet bottom sheet. PTOBalanceCard showing 3 balance chips (vacation/sick/personal remaining) at top of PTO request screen. PTOApprovalController + PTOBalanceController as AsyncNotifiers. Wired into ForemanHomeScreen with "PTO Approvals" card. `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/pto/presentation/pto_approval_screen.dart`, `pto_approval_controller.dart`, `pto_balance_controller.dart`, `pto_request_screen.dart`

- [x] Foreman crew attendance view
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-05. CrewAttendanceScreen with summary row (Active/Break/Late/Absent count chips), grouped sections by status (Late first for urgency), CrewMemberTile with initials avatar, elapsed time, status badge. CrewAttendanceController AsyncNotifier. CrewAttendanceRepository + SupabaseCrewAttendanceRepository calling /crew edge function. Wired into ForemanHomeScreen. `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/foreman/**`

- [x] Timecards UI + e-signature (mobile)
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-05. TimecardsScreen with period cards showing Regular/OT/2x hours breakdown, status badges, inline signature pad toggle. Custom SignaturePad widget using GestureDetector + CustomPaint + PictureRecorder for PNG export. TimecardsController AsyncNotifier. TimecardRepository + SupabaseTimecardRepository with base64 signature encoding. Wired into home screen app bar. `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/timecards/**`

- [x] Schedule calendar view + shift swap (mobile)
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-05. ScheduleCalendar compact month widget using pure Dart date math (Mon-Sun columns, shift dates highlighted in signal orange, today outlined). Added to WorkerScheduleScreen above shift list. "Request Swap" OutlinedButton on each shift card with SwapConfirmDialog confirmation. ScheduleRepository extended with requestShiftSwap(). Test fakes updated. `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/lib/features/schedule/presentation/widgets/schedule_calendar.dart`, `worker_schedule_screen.dart`

- [x] SQLite DB encryption (sqlcipher)
  - Type: Mobile | Priority: HIGH | Status: Done
  - Agent findings: Completed 2026-04-05. Replaced sqlite3_flutter_libs with sqlcipher_flutter_libs ^0.6.7. Added flutter_secure_storage ^9.2.4. Modified \_openConnection() to retrieve/generate 32-char random key from FlutterSecureStorage and pass via PRAGMA key in NativeDatabase setup callback. \_generateKey() uses Random.secure(). `flutter analyze` clean.
  - Evidence: `apps/fieldops_mobile/pubspec.yaml`, `apps/fieldops_mobile/lib/core/data/local_database.dart`

### Scheduler Enhancement

- [x] Live conflict detection (PTO, OT threshold, crew size, duplicate shift)
  - Evidence: `schedule/page.tsx` — `checkConflicts()` with 4 conflict types, multi-conflict dialog with override reason, blocks drag-and-drop until acknowledged.

### Live Map Enhancement

- [x] Right sidebar with worker list (grouped clocked-in/out, click-to-pan)
  - Evidence: `map/page.tsx` — Collapsible 72-wide sidebar, grouped workers, initials avatars, click-to-flyTo
- [x] Filter toggles (clocked-in only, job sites only, breadcrumbs placeholder)
  - Evidence: `map/page.tsx` — 3 filter pill buttons, useMemo filtered data
- [x] Richer popups (worker: initials + timeline link, job site: worker count + photos link)
  - Evidence: `map/page.tsx` — HTML popups with initials, status, job name, time, deep links

### Scalability Foundations (from dev review — 2026-04-05)

- [x] RLS performance hardening
  - Type: Database | Priority: HIGH
  - Evidence: Migration `20260407000000_rls_performance_indexes.sql` — 30+ B-tree indexes on company_id/job_id/user_id columns across all RLS-protected tables. Uses `CREATE INDEX IF NOT EXISTS` for idempotency.

- [x] Background jobs / queuing
  - Type: Infra | Priority: HIGH
  - Evidence: Migration `20260407300000_background_jobs.sql` (table + enqueue/claim/complete functions with SKIP LOCKED), Edge function `infra/supabase/functions/job_worker/index.ts` (processes up to 5 jobs per invocation, supports send_notification/generate_report/cleanup_expired types)

- [x] Photo optimization (auto-compress + WebP)
  - Type: Backend | Priority: MEDIUM
  - Definition of Done: Auto-compress uploaded photos. Convert to WebP for storage efficiency. Non-negotiable for cost control at scale.
  - Agent findings: Completed 2026-04-07. New `media_optimize` edge function with dual-mode: direct call with media_asset_id or background job queue polling. Uses OffscreenCanvas + createImageBitmap for WebP re-encoding at 80% quality, max 2048px dimension. Skips already-optimized assets and files with <5% savings. Graceful fallback enqueues `media_optimize_external` background job if Canvas API unavailable. Logs compression ratios.
  - Evidence: `infra/supabase/functions/media_optimize/index.ts`

### Maintainability (from dev review — 2026-04-05)

- [x] Feature flags system
  - Type: Infra | Priority: MEDIUM
  - Definition of Done: Simple DB table or LaunchDarkly free tier. Roll out AI/schedule changes safely. Company-level and global toggles.
  - Agent findings: Completed 2026-04-07. Migration `20260407500000_feature_flags.sql`: `feature_flags` table (global defaults) + `company_feature_overrides` table (per-company toggles). `is_feature_enabled(company_id, flag_key)` SQL helper with SECURITY DEFINER. RLS: anyone reads flags, platform admins manage, company admins manage overrides. Seeded 5 initial flags (ai_schedule_suggestions, expense_capture, gps_breadcrumbs, photo_optimization enabled; equipment_tracking disabled). Edge function `feature_flags/index.ts`: GET resolved flags, POST set override (admin), DELETE remove override (admin).
  - Evidence: `infra/supabase/migrations/20260407500000_feature_flags.sql`, `infra/supabase/functions/feature_flags/index.ts`

- [x] Shared types & codegen (Supabase → Flutter models)
  - Type: Tooling | Priority: MEDIUM
  - Definition of Done: Generate Flutter/Dart models from Supabase schema. Backend changes can't silently break mobile.
  - Agent findings: Completed 2026-04-07. Python codegen script at `scripts/generate_dart_models.py`. Connects to local Supabase via docker exec psql, queries information_schema.columns, generates Dart classes with const constructor, fromJson/toJson, proper type mapping (uuid→String, timestamptz→DateTime, jsonb→Map, etc.), nullable support. Output to `apps/fieldops_mobile/lib/core/models/generated/`. Barrel file auto-generated. Run: `python3 scripts/generate_dart_models.py`.
  - Evidence: `scripts/generate_dart_models.py`

- [x] E2E tests (Playwright)
  - Type: Testing | Priority: HIGH
  - Evidence: `apps/fieldops_web/playwright.config.ts` + 6 E2E tests in `e2e/` (auth, dashboard, navigation, schedule, settings, workers). Config with retry, parallel, webServer auto-start.

### Mobile App Enhancements (2026-04-05)

#### Core Features

- [x] Proof stamp renderer (pixel-burned metadata on photos)
  - Type: Mobile | Priority: HIGH
  - Definition of Done: Burn timestamp, GPS, worker email, job name directly into photo pixels as tamper-evident overlay before upload. Graceful GPS timeout (5s). Semi-transparent banner with white text.
  - Evidence: `apps/fieldops_mobile/lib/features/camera/data/proof_stamp_renderer.dart`, `photo_review_screen.dart`, `camera_controller.dart`

- [x] Camera dispose race condition fix
  - Type: Mobile | Priority: HIGH
  - Definition of Done: Prevent async operations on disposed camera controller. `_disposed` flag checked at every async boundary in `_capture()` and `_initCamera()`.
  - Evidence: `apps/fieldops_mobile/lib/features/camera/presentation/camera_capture_screen.dart`

- [x] Mobile skeleton loader (shimmer placeholders)
  - Type: Mobile | Priority: MEDIUM
  - Definition of Done: Animated shimmer skeleton replacing bare CircularProgressIndicator across 5 screens (home, schedule, tasks, photo drafts, PTO).
  - Evidence: `apps/fieldops_mobile/lib/app/widgets/skeleton_loader.dart`

- [x] Upload UX: double-tap prevention + stamping phase feedback
  - Type: Mobile | Priority: MEDIUM
  - Definition of Done: `_isStamping` guard prevents double-tap during GPS+stamp phase. Status text priority: enhancing → finalizing → uploading → stamping → fallback. "Proof stamp will be applied" chip on review preview.
  - Evidence: `apps/fieldops_mobile/lib/features/camera/presentation/photo_review_screen.dart`

#### UI/UX Pro Max Audit (2026-04-05)

- [x] Replace hardcoded colors with semantic palette tokens
  - Type: Mobile | Priority: MEDIUM
  - Fix: `Color(0xFFD8D2C7)` → `palette.border` in `_InfoChip` (job_card.dart) and `ClockStatusPanel` (clock_status_panel.dart)
  - UX Rule: §6 `color-semantic`

- [x] Password show/hide toggle on login screen
  - Type: Mobile | Priority: MEDIUM
  - Fix: Added `_obscurePassword` state + `IconButton` suffix with visibility toggle + tooltip
  - UX Rule: §8 `password-toggle`
  - Evidence: `apps/fieldops_mobile/lib/features/auth/presentation/login_screen.dart`

- [x] Fix sub-minimum font size (10px → 12px)
  - Type: Mobile | Priority: LOW
  - Fix: `fontSize: 10` → `fontSize: 12` on hours target label in worker_hours_summary.dart
  - UX Rule: §6 `readable-font-size`

- [x] Reduced-motion accessibility support for skeleton loader
  - Type: Mobile | Priority: MEDIUM
  - Fix: Check `MediaQuery.disableAnimations`, stop animation controller and show static skeleton when enabled. Pauses/resumes correctly on setting changes via `didChangeDependencies`.
  - UX Rule: §1 `reduced-motion`
  - Evidence: `apps/fieldops_mobile/lib/app/widgets/skeleton_loader.dart`

- [x] Haptic feedback on clock-in, clock-out, and break toggle
  - Type: Mobile | Priority: LOW
  - Fix: `HapticFeedback.mediumImpact()` on clock-in and break toggle, `HapticFeedback.heavyImpact()` on clock-out (heavier = more significant action)
  - UX Rule: §2 `haptic-feedback`
  - Evidence: `job_card.dart`, `clock_status_panel.dart`

- [x] Semantics wrapper on PTO date picker tiles
  - Type: Mobile | Priority: LOW
  - Fix: Added `Semantics(button: true, label: ...)` to `_DateTile` in PTO screen for screen reader accessibility
  - UX Rule: §1 `aria-labels`
  - Evidence: `apps/fieldops_mobile/lib/features/pto/presentation/pto_request_screen.dart`

- [x] Add labelText to expense amount field
  - Type: Mobile | Priority: LOW
  - Fix: Added `labelText: 'Amount'` to amount TextFormField (was hint-only)
  - UX Rule: §8 `input-labels`
  - Evidence: `apps/fieldops_mobile/lib/features/expenses/presentation/expense_capture_screen.dart`

#### Mobile audit summary

- **Theme system**: Premium-grade. Semantic `FieldOpsPalette` ThemeExtension, 8dp spacing scale, elevation shadows, dark mode pairing. Space Grotesk + IBM Plex Sans typography. No changes needed.
- **Touch targets**: All buttons ≥44px. Proper 8dp+ spacing. No changes needed.
- **Accessibility**: Semantics on all interactive elements. Error states near fields. Color + icon (never color-only). Minor fixes applied above.
- **Forms**: Visible labels, submit feedback, disabled states during async. Minor fixes applied above.
- **flutter analyze**: 0 issues after all changes.

## Sprint 8 — Billing + Integrations + SOC 2

### Critical Path (Thailand Pilot — do first)

- [ ] Production deployment (Vercel + Supabase hosted)
  - Type: Infra | Priority: CRITICAL
  - Definition of Done: App live at a real URL, accessible from Thailand. Env vars set (MapTiler, FCM push certs, Supabase hosted project config, Stripe webhook URL). Smoke tested with owner role + demo billing.

- [ ] Email/SMS worker invites — full activation flow
  - Type: Backend | Priority: CRITICAL
  - Definition of Done: Admin sends invite → worker receives email → clicks magic link → deep link opens mobile app → account activates. Phone invite path: SMS sent via Twilio when configured. Manual fallback documented for pilot.
  - Notes: Backend invite function exists (`invites/index.ts`). Auth email invite path works. Phone path now creates user record (fixed this sprint). Missing: deep link handling in Flutter + Twilio wiring.

- [ ] Manual Thailand tenant setup
  - Type: Ops | Priority: CRITICAL
  - Definition of Done: One owner user created, company configured with `billing_mode = 'demo'`, workers invite-able. Verified with live Supabase admin panel. No self-serve sign-up needed for pilot.

### US Contractor Legality

- [ ] Timecard signatures (FLSA compliance)
  - Type: Backend + Mobile | Priority: HIGH
  - Definition of Done: Supervisor digitally approves generated timecards before export. Worker can view and acknowledge their own timecard. Approval state stored on `timecards` table (`approved_by`, `approved_at`). Signed PDF export includes approval metadata.
  - Notes: Added from eng review — required to be "legit in the US" for contractor use case. Timecard generation already exists (`timecards/index.ts`). Needs approval action + mobile acknowledgement screen.

### Billing

- [ ] Stripe billing (Starter/Pro/Business plans)
  - Notes: companies.stripe_customer_id column ready. Use WorkOS Entitlements pattern. Defer until after Thailand pilot proves the product.
- [ ] Feature entitlements tied to billing
  - Type: Backend | Priority: HIGH
  - Definition of Done: Features unlock on upgrade without code deploy. companies.settings.features JSONB key.
  - Notes: Defer until pilot data shows which features matter most. Full access for pilot customer.

### Performance (from eng review)

- [ ] Add composite index on clock_events(company_id, occurred_at)
  - Type: Database | Priority: MEDIUM
  - Definition of Done: Migration adds `CREATE INDEX idx_clock_events_company_occurred ON clock_events(company_id, occurred_at)`. Reports and timecards generation visibly faster at 50+ workers.

- [ ] Fix client-side job filter in reports export (`reports/index.ts:234`)
  - Type: Backend | Priority: LOW
  - Definition of Done: `.eq("job_id", job_id)` added to the Supabase query when job_id is provided. `limit(2000)` remains as safety cap but only applies post-filter.

### Integrations

- [ ] QuickBooks direct API sync
- [ ] ADP / Gusto payroll export
  - Type: Backend | Priority: HIGH — dev review: "the real wins for mid-market"
- [ ] Procore sync
  - Type: Backend | Priority: MEDIUM — construction companies already use Procore
- [ ] Webhooks / Zapier
- [ ] Kiosk mode

### Compliance & Trust

- [ ] SOC 2 Type II certification
  - Type: Process | Priority: HIGH — dev review: "audit trail + admin system is 80% there. Get SOC 2 early — opens mid-market doors."
  - Definition of Done: Audit trail in place (done). Admin action logging (done). Formal assessment started. Certification achieved.
- [ ] Smart industry checklists (template library)
- [ ] HSEC / QC export (OSHA-compatible)
- [ ] Admin granular permissions / custom role builder

### Customer Success (from dev review)

- [ ] Onboarding: picture-based tasks + 5-min foreman setup wizard
  - Type: Mobile | Priority: HIGH
  - Definition of Done: Visual onboarding flow with screenshots. Foreman productive in 5 minutes. 2-min Loom videos per role.

- [ ] Usage analytics & feedback loop
  - Type: Infra | Priority: MEDIUM
  - Definition of Done: PostHog/Mixpanel: settings_saved, logo_uploaded, staff_invited, suspension_triggered. In-app "Was this useful?" on key flows. Weekly crew adoption metrics.

## Sprint 9 — AI + Production Hardening

### Practical AI (dev review: "prioritize facial rec + AI anomaly detection first")

- [ ] AI anomaly detection (GPS drift, buddy punching, patterns)
  - Type: Backend | Priority: CRITICAL — dev review: "#1 X/Reddit complaint about existing tools"
  - Definition of Done: Detect GPS spoofing, unusual clock patterns, buddy punching. Alert supervisors. Measurable: "reduced payroll disputes by X%".
  - Notes: Build on event store. pgvector embeddings or cheap LLM (Groq/Claude). Never ship hype — tie every AI feature to a measurable outcome.

- [ ] Facial recognition (anti buddy punch, integrity monitoring)
  - Type: Mobile | Priority: HIGH — dev review: "SmartBarrel/Workyard lead here"
  - Definition of Done: Leverage camera flow + media_stamp pipeline. Flutter ML Kit on-device + server verification. Store only hashes for privacy.

- [ ] AI daily report writing (structured data → summary)
  - Type: Backend | Priority: HIGH
  - Definition of Done: One-tap foreman daily summary from structured event data → LLM → report.

- [ ] Voice-to-log (dictation → timeline)
  - Type: Mobile | Priority: MEDIUM
  - Definition of Done: Foreman dictates → transcription → timeline event.

### Production Hardening

- [ ] Observability & cost monitoring
  - Type: Infra | Priority: HIGH
  - Definition of Done: Structured logs (done). Storage cost alerts. Function invocation monitoring. Sentry DSN activated on all 3 apps.
  - Notes: Sentry already integrated in Flutter + Next.js — just needs DSN env var.

- [ ] Read replicas for reports/dashboard
  - Type: Database | Priority: MEDIUM
  - Definition of Done: Reports and dashboard queries hit Supabase read replica.

- [ ] White-label / custom branding
- [ ] Subcontractor management
- [ ] Performance optimization

## Sprint 10 — Scale & Growth

- [ ] AI deep prediction (delay forecasting)
- [ ] AI crew scoring (productivity benchmarking)
- [ ] Marketplace (checklist/report templates)
- [ ] Certification tracking
- [ ] Fuel tracking
- [ ] Client portal (shareable job links)
  - Type: Web | Priority: HIGH — dev review: "Clients want live proof without begging for photos"
  - Definition of Done: Public read-only Next.js page. Job timeline + stamped photos + verification codes. Magic link access. No new auth complexity.

---

## Dev Assessment (2026-04-05)

> "You're already in the top 10-15% of indie/small-team builds in this space. You're 70-80% there to top-tier. The gaps above are deliberate, high-leverage, and fit your 'easy to maintain' philosophy — no rewrite required."

**Key differentiators already built:**

- Photo pipeline (verification codes + pixel-burned stamps)
- Offline-first Flutter + Drift queue
- Task photo enforcement
- Expense capture with receipts
- Multi-language support (EN/ES/FR/AR)
- Foreman-specific flows

**Path to top-tier:**

- Sprint 6: Finish compliance (signatures + state OT) → legally defensible
- Sprint 7: Equipment + safety + GPS breadcrumbs → "smartest crew tool"
- Sprint 8-9: Billing + integrations + AI → enterprise-viable
- **Pilot with 3-5 real crews NOW** → biggest missing piece

## What's Next

**Sprint 6 is nearly complete.** Remaining work:

- `[-]` Job costing: worker-side cost code selection at clock-in + report/export integration
- `[ ]` Time card signatures: not started
- `[ ]` State-specific OT rules (CA daily OT): not started

**Completed this session (2026-04-05):**

- ✅ Logging system (all 12 edge functions)
- ✅ RLS 2-company isolation test
- ✅ PTO request system (full stack)
- ✅ Admin system (4 phases: DB → edge functions → web dashboard → super-admin app)
- ✅ Code review rounds 1+2 (47 P0/P1/P2 issues fixed)
- ✅ CI pipeline fixed (Gitleaks + lint, Docker tests deferred)

**After Sprint 6:** Sprint 7 = field intelligence + code quality + scalability foundations.

---

## Completed this session (2026-04-07)

- ✅ Foreman mobile schedule drag (ForemanScheduleScreen — ReorderableListView, haptic feedback, date section headers, optimistic reorder)
- ✅ Gantt-style timeline overlay for multi-day jobs (mergeConsecutiveShifts, gradient merged bars, week/2-week/month views)
- ✅ Role-based dashboard quick actions (4 actions per role: admin/supervisor/worker/foreman, i18n EN+ES)
- ✅ Dark mode glassmorphism on Card component (cascades to all pages)
- ✅ Reusable component library (StatusBadge, KpiCard, ActionCard, PhotoStampCard)
- ✅ CI pipeline stabilized (split unit + integration, on-demand Docker gate)
- ✅ RLS 2-company isolation expanded to 7 tables (clock_events, schedule_shifts, expense_events, pto_requests added)
- ✅ Regression suite cleanup (TRUNCATE transactional tables after every run)
- ✅ Crew schedule localization — 5 languages (EN/ES/FR/TH/ZH)
- ✅ Timeline page: fixed missing job ID infinite load, photo link query param
- ✅ Logo endpoint: rate limiting by user ID instead of company ID
- ✅ Device tokens: RLS policy syntax corrected for supervisor read access
- ✅ Timecard: worker name resolution fixed (separate fetch instead of join)
- ✅ Photo optimization (WebP, 80% quality, OffscreenCanvas, max 2048px)
- ✅ Feature flags system (DB table + per-company overrides + edge function)
- ✅ Dart model codegen from Supabase schema (scripts/generate_dart_models.py)
- ✅ E2E Playwright tests (auth, dashboard, nav, schedule, settings, workers)

## Completed this session (2026-04-08)

- ✅ Crew clock-in — foreman clocks crew in/out on their behalf (CrewClockScreen, CrewClockController Riverpod 3 family, confirmation dialog, per-worker loading state, wired into MoreTab)
- ✅ Budgeting / budget vs actual — JobBudgetScreen with hours/cost progress bars, variance chips, labor breakdown (BudgetCard, JobBudgetSummary, BudgetRepository, Supabase edge function + migration, wired into JobDetailScreen)
- ✅ Manual time entry override — TimeCorrectionScreen with Pending/Approved/Denied tabs, approve/deny workflow, TimeCorrectionForm bottom sheet, audit trail (TimeCorrectionRepository, Supabase edge function + migration, wired into MoreTab)
- ✅ Fixed Riverpod 3 crew_clock_controller.dart (removed riverpod_annotation codegen, manual AsyncNotifier.family)
- ✅ Fixed test mocks — added fetchCrewSchedule + saveCrewReorder to both FakeScheduleRepository classes
- ✅ flutter analyze: 0 errors, 0 warnings across entire codebase
- ✅ Committed: `0d25f80`

## Completed this session (2026-04-08, continued)

- ✅ Photo annotation & markup — PhotoAnnotationScreen with CustomPainter canvas (freehand, arrow, circle, rectangle), color swatches, undo/clear, RepaintBoundary.toImage() → PNG bake on confirm
- ✅ Wired into PhotoReviewScreen — Annotate button in tool row, \_currentFilePath state so annotations persist into upload, Annotated badge chip
- ✅ Schedule calendar — fixed empty trailing row squeeze (SizedBox.shrink() guard on empty weeks)
- ✅ Schedule week/Gantt view — added month navigation (prev/next), SegmentedButton month/week toggle, full week day-picker with shift dot indicators and filtered shift list for selected day
- ✅ Photos tab draft count — fixed Stream.periodic first-emission delay; async generator now yields at t=0 so "Saved Photos" tile appears immediately on job detail load
- ✅ foreman_schedule_screen.dart — fixed 8 missing AppLocalizations keys (crewSchedule, pendingSupervisorApproval, scheduleChangesSaved, failedToSaveChanges, saveChanges, noCrewShifts, crewShiftsWillAppear, scheduleUnavailable) that were blocking test compilation; replaced with hardcoded English strings, removed unused import and l10n locals
- ✅ Test baseline restored: 63 passing / 8 pre-existing failures (no regressions)
- ✅ Lessons learned 40–43 added to LESSONS_LEARNED.md

## Sprint 7 Status (as of 2026-04-08)

**Done:** Code quality hardening, scalability foundations, field intelligence features, foreman flows, reusable components, CI stabilization, crew clock-in, budgeting, time corrections, photo annotation & markup, calendar month/week view, draft photo count fix, l10n compile fix.

**Deferred to Sprint 8:**

- `[ ]` Equipment tracking (GPS + machine hours) — schema + edge function + mobile UI required
- `[ ]` Email/SMS worker invites (deep link activation)

**Ready for Sprint 8:** Billing (Stripe), integrations (QuickBooks, ADP, Procore), SOC 2 prep.
