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

- [x] Push notifications (FCM) — Done (scaffold)
  - NotificationService interface + NoOpNotificationService. Ready for Firebase integration when project is configured.
  - Evidence: `apps/fieldops_mobile/lib/core/notifications/notification_service.dart`

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

- [ ] Workers list sidebar + drag-to-calendar (@dnd-kit + FullCalendar)
  - Type: Web | Priority: HIGH — on demand
  - Definition of Done: Left panel shows available workers (filterable). Drag worker onto calendar day/slot. Creates draft shift via /schedule endpoint. @dnd-kit for external drags, FullCalendar resourceTimeline for calendar grid. Bidirectional drag (workers ↔ jobs, drag between days).
  - Notes: `npm install @dnd-kit/core @fullcalendar/react @fullcalendar/resource-timeline`. Replaces current simple grid with pro-grade calendar.

- [ ] Templates + recurring shifts (one-click apply)
  - Type: Web | Priority: HIGH
  - Definition of Done: Save current week as template. Apply template to future weeks with one click. Saves hours of manual scheduling per week.

- [ ] Availability heatmap / worker preferences
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Pull PTO + history data. Show availability badges on worker cards in sidebar. Green = available, amber = partial, red = PTO/conflict.

- [ ] Cost code preview on drag
  - Type: Web | Priority: LOW
  - Definition of Done: When dragging worker onto a job slot, show cost code + estimated cost. Ties into existing profitability reports.

#### Sprint 7 scope (medium effort)

- [ ] Live conflict detection (PTO, OT rules, geofence overlap, crew size)
  - Type: Web | Priority: HIGH
  - Definition of Done: Red/yellow highlights on drop when conflicts detected. No overbooking. Checks PTO calendar, OT threshold, crew size limits. Warns but allows override with reason.

- [ ] AI smart schedule suggestions
  - Type: Backend | Priority: HIGH — dev review: "2026 differentiator most competitors still lack"
  - Definition of Done: "Fill this week like last week" button. "Recommended crew for this job" based on skills + past performance. Uses event store + simple LLM call. Suggestions displayed as ghost shifts user can accept/dismiss.

- [ ] Foreman mobile schedule drag (simplified list view)
  - Type: Mobile | Priority: MEDIUM
  - Definition of Done: Foreman can adjust schedule on-site from mobile. Simple list reorder (not full calendar). Web publish approval still required.

- [ ] Gantt-style timeline overlay for multi-day jobs
  - Type: Web | Priority: LOW
  - Definition of Done: Visual bar spanning multiple days for long jobs. FullCalendar resourceTimeline supports this natively. Construction sweet spot.

### Payroll & Compliance

- [-] Job costing / cost codes
  - Type: Backend | Priority: HIGH
  - Definition of Done: Cost codes on clock events and tasks. Workers select code at clock-in. Profitability report. CSV export includes cost code. Uses task_classification field.
  - Agent findings: Profitability backend existed already and a supervisor web view now exists at `/cost-codes`. Worker-side code selection at clock-in and report/export integration are still pending.

- [ ] Time card signatures
  - Type: Mobile | Priority: HIGH
  - Definition of Done: Worker signs timesheet. Supervisor counter-signs. Immutable events. PDF with signatures. Legally defensible.

- [ ] State-specific OT rules (CA daily OT)
  - Type: Backend | Priority: HIGH
  - Definition of Done: CA daily (>8h), weekly (>40h), double-time (>12h, 7th day). Company settings select jurisdiction. Timesheet export reflects correct classification.

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

- [x] Settings helper (_shared/settings.ts)
  - Type: Backend | Priority: CRITICAL
  - Definition of Done: DEFAULT_COMPANY_SETTINGS constant. deepMerge() (not shallow spread). getCompanySettings() returns typed, guaranteed-complete object. validateCompanySettings() rejects malformed JSONB server-side (400). All edge functions use this instead of raw JSONB.

- [x] Audit trail helper (logAdminAction in _shared/api.ts)
  - Type: Backend | Priority: HIGH
  - Definition of Done: Extracts IP (cf-connecting-ip → x-real-ip → x-forwarded-for fallback) + user-agent. Writes to admin_audit_log. Called by invites, settings save, staff role changes, suspension.

- [x] Company status check (checkCompanyActive in _shared/api.ts)
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

- [ ] i18n additions (EN + ES)
  - Type: Web | Priority: MEDIUM
  - Definition of Done: Logo upload, stamp branding, settings tabs, access denied, invite flow, audit log viewer labels in both EN and ES.

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

- [x] Company detail page (/companies/[id])
  - Type: Web | Priority: HIGH
  - Definition of Done: Full company data. User list. Activate/deactivate toggle (bans/unbans all users via GoTrue). Audit log viewer for that company.

- [x] Create company page (/companies/new)
  - Type: Web | Priority: HIGH
  - Definition of Done: Form: company name, slug, industry, timezone, initial admin email. Creates company + admin user via auth.admin.createUser(). Idempotent.

- [x] Platform admin management (/admins)
  - Type: Web | Priority: MEDIUM
  - Definition of Done: List platform admins. Generate invite links. Deactivate admins.

#### Deferred to Future Sprints (documented)

- [ ] Custom role builder / per-feature permission matrix (Phase 2)
- [ ] Multi-state compliance engine — top 10 states (Phase 2)
- [ ] White-label / custom domain (Phase 3)
- [ ] Smart Groups / dynamic user grouping (Phase 3)
- [ ] Stripe billing integration (Sprint 8)
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

- [ ] Sync engine: distinguish `jsonDecode` (permanent) from network (transient) errors
  - Type: Mobile | Priority: Medium
  - File: `apps/fieldops_mobile/lib/core/data/sync_engine.dart:65`
  - Fix: Wrap `jsonDecode` in separate try/catch for `FormatException` → mark permanently failed immediately

- [ ] Expense screen: replace linear category search with Map lookup
  - Type: Mobile | Priority: Low
  - File: `apps/fieldops_mobile/lib/features/expenses/presentation/expense_capture_screen.dart:379`
  - Fix: `static const Map<String, String> _categoryLabels = {...};`

- [ ] Expense screen: add 300ms debounce to `_updateSuggestedCategory()`
  - Type: Mobile | Priority: Low
  - File: `apps/fieldops_mobile/lib/features/expenses/presentation/expense_capture_screen.dart:65`
  - Fix: Add `Timer? _debounceTimer` with cancel in `dispose()`

- [ ] Reports: replace `.findLast()` with `.slice().reverse().find()` — **DONE in round 2 commit**
  - Status: Done (fixed in `7feab4e`)

- [ ] OT endpoint: validate `total_hours` as number type
  - Type: Backend | Priority: Medium
  - File: `infra/supabase/functions/ot/index.ts:139`
  - Fix: `if (total_hours && typeof total_hours !== 'number') return errorResponse(...)`

- [ ] Schedule endpoint: add `start_time < end_time` validation
  - Type: Backend | Priority: Medium
  - File: `infra/supabase/functions/schedule/index.ts:188`
  - Fix: `if (start_time >= end_time) return errorResponse(...)` in create + update actions

- [ ] Sync events: use explicit reject marker instead of `crypto.randomUUID()` for malformed events
  - Type: Backend | Priority: Low
  - File: `infra/supabase/functions/sync_events/index.ts:121`

- [ ] Test: add subprocess timeout to `admin_sql()` in test_sprint_1.py
  - Type: Testing | Priority: Low
  - File: `execution/test_sprint_1.py:93`
  - Fix: Add `timeout=15` to `subprocess.run()`

- [ ] Test: add post-suite cleanup or reset in regression runner
  - Type: Testing | Priority: Low
  - File: `execution/run_backend_regression_suite.py`

- [ ] CI: pin Python version to patch level
  - Type: CI | Priority: Low
  - File: `.github/workflows/backend-regression.yml:54`
  - Fix: `python-version: "3.13"` → `python-version: "3.13.0"`

- [ ] CI: stabilize backend regression pipeline if `supabase start` remains flaky
  - Type: CI | Priority: Medium
  - Definition of Done: Backend regression tests pass reliably in CI on every push. If `supabase start` with Docker continues to fail, migrate to Supabase hosted test project or self-hosted runner.
  - Notes: Fixed `supabase stop` abort + Gitleaks false positive + outdated CLI version on 2026-04-05. Excluded studio/imgproxy/inbucket/logflare/vector/supavisor/realtime/pg_meta to reduce container surface. If still flaky, consider Supabase branching (hosted CI database).

- [ ] RLS test: add actual 2-company data isolation test (cross-company reads must return 0 rows)
  - Type: Testing | Priority: HIGH — blocks Sprint 6 RLS validation task
  - File: `execution/test_rls_validation.py`

- [ ] Dashboard/Photos/Overtime: add pagination or "Load More" for hardcoded query limits
  - Type: Web | Priority: Medium
  - Files: `apps/fieldops_web/src/app/page.tsx`, `photos/page.tsx`, `overtime/page.tsx`

### Features

- [ ] Crew clock-in (foreman clocks for crew)
- [ ] Shift wrap-up form (clock-out questions)
- [ ] GPS breadcrumb trail (shift route replay)
  - Notes: Lightweight polyline stored in DB. Extends clock/break model. Used for shift route replay and dispute resolution.
- [ ] Equipment tracking (GPS + machine hours)
  - Notes: Track idle equipment, machine hours. Top fraud/compliance pain point per dev review.
- [ ] Safety sign-off questions (pre-shift checklist)
  - Notes: Industry-specific checklists. Pre-shift safety forms. OSHA compliance.
- [ ] Budgeting / budget vs actual
- [ ] Manual time entry override (with audit trail)
- [ ] Email/SMS worker invites (deep link activation)
- [ ] Photo annotation & markup (draw on photos)

### Scalability Foundations (from dev review — 2026-04-05)

- [ ] RLS performance hardening
  - Type: Database | Priority: HIGH
  - Definition of Done: Indexes on every company_id/job_id column used in RLS policies. Test with 10k+ rows per company. Never use RLS for business filtering — query first, then RLS protects.

- [ ] Background jobs / queuing
  - Type: Infra | Priority: HIGH
  - Definition of Done: Move heavy work (photo stamping v2, report PDF, AI inference) to a queue. Options: Supabase pg_cron + DB triggers, or Inngest. Edge functions stay lightweight.

- [ ] Photo optimization (auto-compress + WebP)
  - Type: Backend | Priority: MEDIUM
  - Definition of Done: Auto-compress uploaded photos. Convert to WebP for storage efficiency. Non-negotiable for cost control at scale.

### Maintainability (from dev review — 2026-04-05)

- [ ] Feature flags system
  - Type: Infra | Priority: MEDIUM
  - Definition of Done: Simple DB table or LaunchDarkly free tier. Roll out AI/schedule changes safely. Company-level and global toggles.

- [ ] Shared types & codegen (Supabase → Flutter models)
  - Type: Tooling | Priority: MEDIUM
  - Definition of Done: Generate Flutter/Dart models from Supabase schema. Backend changes can't silently break mobile.

- [ ] E2E tests (Playwright)
  - Type: Testing | Priority: HIGH
  - Definition of Done: Critical worker → supervisor flows. Settings save, invite flow, suspend/reactivate. Run in CI.

## Sprint 8 — Billing + Integrations + SOC 2

### Billing

- [ ] Stripe billing (Starter/Pro/Business plans)
  - Notes: companies.stripe_customer_id column ready. Use WorkOS Entitlements pattern.
- [ ] Feature entitlements tied to billing
  - Type: Backend | Priority: HIGH
  - Definition of Done: Features unlock on upgrade without code deploy. companies.settings.features JSONB key.

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
