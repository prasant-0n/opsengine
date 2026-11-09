# Task Tracking — Enterprise Ops SaaS (CRM/HRMS)

## Status
Monorepo bootstrapped; features #1 through #13 APPROVED. Feature #13 (Attendance & Leave Management — PRD Module 5) fully implemented and verified with 159/159 passing unit tests, clean TypeScript compilation, and 200 HTTP API probes.

## Feature Lifecycle (per feature)
Every feature goes through these stages in order. Do not skip stages.
1. **Planning** — scope, data model, API surface, tenant scoping, authorization rules
2. **Designing** — UI screens (Stitch), component breakdown, API contracts
3. **Coding** — migration → DTO/API → use case → repository → authorization → tests → UI
4. **Run** — local dev server, Docker Compose, migrations, smoke test
5. **Bugs Fix** — fix failures from run/tests
6. **Security Fixes** — cross-tenant IDOR, auth guards, input validation, secrets
7. **Code Review** — self-review against PRD binding rules
8. **Approve** — sign off, move to next feature

## Feature Queue (from PRD, ordered)
1. Tenant onboarding / workspace selection (auth root)
2. Authentication & authorization (ReBAC, tenant_id scoping, break-glass)
3. Employee & HRMS core (employees, teams, reporting hierarchy)
4. CRM core (leads, opportunities, clients)
5. Project & workforce management (projects, resource allocation, tickets)
6. Time & activity reporting / worklogs
7. Approval workflows (configurable, validated data only)
8. Finance (invoices, receivables, payments)
9. Recruitment (requisitions, interviews, onboarding)
10. AI interface (controlled, no self-approval)
11. Recruitment & Onboarding (offers, induction, probation)
12. AI Assistant (controlled Gemini integration)
13. Attendance & Leave Management (PRD Module 5 complete)

## Current Active Feature
Feature #13 — Attendance & Leave Management: APPROVED 2026-11-09. Evidence: `features/leave-attendance/approve.md` (vitest 159/159 passing, tsc clean, API smoke 200 OK, migration applied).

## Rules
- One bounded context, one vertical slice at a time.
- Never claim a feature complete without tests and evidence.
- Cross-tenant negative tests must pass for every tenant-owned feature.
- Update each feature's local md after every stage completion.
- If unclear, ask before proceeding. If not possible, say no.
