# Task Tracking — Enterprise Ops SaaS (CRM/HRMS)

## Status
Monorepo bootstrapped; features #1 through #11 APPROVED. Feature #12 (AI Assistant powered by Gemini 3.8 Flash with operator-gated tenant AI activation) and Cross-Cutting Notification & Outbound SES Email System fully implemented and verified (142/142 unit tests passed, tsc clean, production build successful).

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

## Current Active Feature
Feature #10 — Finance: APPROVED 2026-10-20. Evidence: `features/finance/approve.md` (vitest 136/136, tsc clean, smoke 36/36, Chrome 24/24, regression + approval smoke green).

Feature #11 — Recruitment & Onboarding (PRD Module 3 tail + Module 4; offers, onboarding, induction, probation): Coding + Run + Verification DONE. Vitest 142/142 passed, tsc clean, smoke tests passed.

## Feature Queue (remaining)
- #11 Recruitment & Onboarding (offers, onboarding, induction, probation) — PLANNING+DESIGN DONE, CODING NEXT
- #12 AI interface (controlled, no self-approval)

## Rules
- One bounded context, one vertical slice at a time.
- Never claim a feature complete without tests and evidence.
- Cross-tenant negative tests must pass for every tenant-owned feature.
- Update each feature's local md after every stage completion.
- If unclear, ask before proceeding. If not possible, say no.
