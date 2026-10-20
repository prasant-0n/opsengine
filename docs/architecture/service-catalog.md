# Component Graph — Package & Boundary Map

Based on PRD target architecture (not yet implemented). Update as code is written.

## Implemented today (2026-10-19) — single-app delivery
```
apps/web/
  app/api/auth/…            # login, sessions, OTP, tenant selector (root-auth)
  app/api/org/…             # employees, my-team (hrms-core)
  app/api/ats/…             # requisitions (governed approve), candidates, interviews (ats-recruitment)
  app/dashboard/…           # shell, people, my-team, recruit UI
  lib/permissions/…               # deny-by-default permission engine
  lib/hr/…, lib/ats/…       # domain helpers (unit-tested)
services/identity-service/prisma/  # schema + migrations for all tables
```

## Monorepo Layout (planned, verify before creating)
```
packages/
  authorization-policy/   # shared policy schemas, action catalogue, fixtures; no bypass API
  contracts/              # shared API DTOs, event schemas, OpenAPI
  ui-core/                # design-system primitives (Inter, JetBrains Mono, dark theme)
services/
  identity-service/           # tenant onboarding, login, SSO, break-glass, OTP
  employee-service/       # HRMS: employees, teams, reporting hierarchy
  crm-service/            # leads, opportunities, clients
  project-service/        # projects, resource allocation, tickets
  time-service/           # worklogs, time & activity reports
  approval-service/       # configurable workflow definitions & decisions
  finance-service/        # invoices, receivables, payments
  recruitment-service/    # requisitions, interviews, onboarding
  ai-service/             # controlled AI interface to authorized workflows
```

## Dependency Direction (planned)
- All services depend on `packages/api-contracts` and `packages/authorization-policy`
- UI depends on `packages/ui-core` and typed API clients from `packages/api-contracts`
- Services do NOT import domain entities from other services (use events/DTOs)
- No giant `shared` package with domain entities

## Data Boundaries
- Every tenant-owned table: `tenant_id` column, tenant-qualified FKs, tenant-scoped unique indexes
- PostgreSQL RLS as defense in depth only (not a substitute for authorization logic)
- Cross-domain views via event-fed read models / materialized projections, not live joins

## Update Rule
Edit this file whenever you add, remove, or re-bound a package or service.
