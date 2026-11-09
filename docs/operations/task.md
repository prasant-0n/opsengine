# Task Tracking — Enterprise Ops SaaS (CRM/HRMS)

## Status
Monorepo bootstrapped; features #1 through #19 APPROVED. Feature #19 (SaaS Control Plane, Tenant Lifecycle, Plans & Entitlements — PRD Module 0A) fully implemented and verified with 202/202 passing unit tests across 22 suites, clean TypeScript compilation, and 200 HTTP API & page probes.

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
14. Executive Reporting, Analytics & Audit Log Viewer (PRD Module 16 complete)
15. Tenant Administration, Role Governance & Organization Management (PRD Modules 0 & 15 complete)
16. Documents and Secure File Management (PRD Module 14 complete)
17. Google OAuth 2.0 / SSO Integration (PRD Module 1 complete)
18. Calendar, Meetings, Decisions & Internal Engagement Activities (PRD Module 15 complete)
19. SaaS Control Plane, Tenant Lifecycle, Plans & Entitlements (PRD Module 0A complete)
20. End-to-End Playwright Automated Test Suite, Health Probes & Multi-Service Hardening (PRD §1.3, §2.2, §4.1, §5 complete)
21. Full Stack Multi-Service Containerization & Docker Compose Production Topology (PRD §9.1, Phase 0 & Phase 6 complete)
22. Enterprise Multi-Tenant Showcase & Demo Seed Engine (PRD §1 & Phase 1 complete)
23. Production CI/CD GitHub Actions Pipeline Hardening (PRD Phase 0 & Phase 6 complete)
24. Production Runbooks & Disaster Recovery Automated Drills (PRD Phase 6 / §18.7 complete)
25. OpenTelemetry Observability, Distributed Tracing & Prometheus Metrics (PRD §7.3, §9.1 & §21 complete)
26. OpenAPI 3.1 Contract Generation & Interactive API Documentation (PRD §7.3 line 704 & §10 complete)
27. Rate Limiting & Web Application Firewall (WAF) Rule Hardening (PRD §4.1 & OWASP Top 10 complete)
28. Multi-Tenant Domain Event Bus & Outbox Integration Pipeline (PRD §11 & §14.2 complete)

## Current Active Feature
Feature #28 — Multi-Tenant Domain Event Bus & Outbox Integration Pipeline: APPROVED 2026-11-10. Evidence: `features/domain-events/approve.md` (Delivered packages/domain-events with 35+ domain event catalogue across 12 domains, transactional outbox engine with exponential backoff & DLQ escalation, sliding-window consumer idempotency store, strict tenant boundary isolation; live /api/events/outbox management endpoint and Admin Console inspector tab; 249/249 Vitest tests passing across 26 suites, 13/13 Playwright E2E tests, clean TypeScript compilation, live HTTP curl verified outbox batch processing).

## Rules
- One bounded context, one vertical slice at a time.
- Never claim a feature complete without tests and evidence.
- Cross-tenant negative tests must pass for every tenant-owned feature.
- Update each feature's local md after every stage completion.
- If unclear, ask before proceeding. If not possible, say no.
