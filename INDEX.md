---
title: FieldOps AI — Vault Index
tags:
  - index
  - moc
aliases:
  - Home
  - MOC
---

# FieldOps AI — Vault Index

> [!abstract] This is the central hub for all FieldOps project documentation.
> Open any linked doc to navigate deeper. All docs use `[[wikilinks]]` for cross-referencing.

---

## Product

| Doc | Purpose |
|-----|---------|
| [[PRD]] | Product requirements, pillars, and MVP scope |
| [[ROADMAP]] | Master plan from Step 0 to Step 10 |
| [[architecture]] | Tech stack, system design, and infrastructure |
| [[DATA_MODEL]] | Database schema, events, and RLS model |
| [[OPENAPI]] | API contract documentation |

---

## Execution

| Doc | Purpose |
|-----|---------|
| [[SPRINT_TRACKER]] | Current sprint status — mirrors Notion board |
| [[LESSONS_LEARNED]] | What we learned each sprint |
| [[TESTING_GUIDE]] | How to run backend, mobile, and web locally |

---

## Guides & References

| Doc | Purpose |
|-----|---------|
| [[README_GUIDE]] | GitHub README best practices — structure, badges, tech stack visuals |

---

## Sprint Status at a Glance

| Sprint | Goal | Status |
|--------|------|--------|
| Sprint 1 | Core backend endpoints | ✅ Done |
| Sprint 2 | MVP worker loop + supervisor view | ✅ Done |
| Sprint 3 | Structured tasks with photo enforcement | ✅ Done |
| Sprint 4 | Overtime verification | ✅ Done |
| Sprint 5 | Reporting engine | ✅ Done |
| Sprint 6 | Competitive parity + pilot readiness | 🔄 In Progress (~50%) |
| Sprint 7 | Field intelligence | ⬜ Backlog |
| Sprint 8 | Billing + integrations | ⬜ Backlog |
| Sprint 9 | AI layer | ⬜ Backlog |
| Sprint 10 | Scale + platform | ⬜ Backlog |

---

## Codebase

| Component | Path | Stack |
|-----------|------|-------|
| Mobile app | `apps/fieldops_mobile/` | Flutter + Riverpod + Drift |
| Web dashboard | `apps/fieldops_web/` | Next.js + React + Tailwind |
| Edge functions | `infra/supabase/functions/` | Deno + TypeScript |
| Backend tests | `execution/` | Python |
| CI/CD | `.github/workflows/` | GitHub Actions |

---

## Quick Commands

```bash
# Backend
cd infra && supabase start
python3 execution/run_backend_regression_suite.py

# Mobile
cd apps/fieldops_mobile
flutter analyze && flutter test
flutter run -d macos --dart-define=SUPABASE_URL=http://127.0.0.1:54321 --dart-define=SUPABASE_ANON_KEY=<key>

# Web
cd apps/fieldops_web
npm run dev
```
