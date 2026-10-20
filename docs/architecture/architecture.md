# Architecture — Enterprise Ops SaaS

Source of truth: `docs/product/requirements.md` (PRD v1.1 draft).

## Target Stack (from PRD — verify before installing)
- Next.js 16 App Router + React 19.3 (frontend)
- pnpm workspaces + Turborepo (monorepo)
- PostgreSQL 18 (transactional data)
- Docker + Docker Compose (local dev + integration tests)
- Playwright (E2E) + Vitest + Testing Library (component/unit)
- GitHub Actions (CI: lint, typecheck, tests, migrations, image build, scanning)

## Architectural Constraints (binding, from PRD)
1. **Multi-tenant isolation:** every tenant-owned row scoped to verified `tenant_id`; cross-tenant negative tests pass.
2. **Server-side authorization authoritative:** UI permission checks are navigation only.
3. **Workflow config as validated data:** never arbitrary tenant-supplied executable JS.
4. **AI is a controlled interface:** AI must not approve its own proposed actions; explicit confirmation for consequential mutations.
5. **Shared database/shared schema baseline:** strict `tenant_id` columns, tenant-qualified constraints, optional RLS defense-in-depth.
6. **Sagas/workflows for cross-domain processes:** compensating actions, not distributed DB transactions.
7. **Incremental delivery:** independently testable service packages; deploy coupled bounded contexts together initially.

## Data Flow (planned)
```
Browser (Next.js UI) → API Gateway/Route Handlers → Service (authz + biz logic) → Repository → PostgreSQL
                                            ↳ Event Publisher → Outbox → Consumers → Read Models
```

## What's NOT in the repo yet
No Docker/CI workflows yet. All stack choices above are target-state from the PRD — verify they exist before assuming.

## Implemented bounded contexts (as of 2026-10-19)
- **Auth + authz**: `services/identity-service` (Prisma/PostgreSQL 18), session cookie, deny-by-default permission grants, tenant scoping — features root-auth, authz.
- **Shell + dashboard**: `apps/web` Next 16 App Router, dark design system, hide/lock nav gating — feature dashboard-shell.
- **HRMS core**: employees/teams/reporting closure APIs + People/HR & My Team UI — feature hrms-core.
- **ATS/Recruitment**: `apps/web/app/api/ats/*` (requisitions with governed audited approval, candidates, interviews, panel, feedback, stage history) + `/dashboard/recruit` UI — feature ats-recruitment.
- Delivery is a single Next.js app with route handlers (coupled bounded contexts, per PRD incremental-delivery rule); service split remains target-state.
