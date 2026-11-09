feature: administration
stage: running
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit

# Feature #15 — Tenant Administration, Role Governance & Organization Management (Run & Verification)

## 1. Test Suite Verification
- Vitest command: `npx vitest run` in `apps/web`.
- Result: **18 passed files (18), 173 passed tests (173)**.
- New test file: `apps/web/src/tests/administration.test.ts` (9 tests passing):
  - Retrieves tenant workspace details, system configuration, and stats.
  - Updates workspace settings and emits an audit event.
  - Queries system role catalog and active tenant role grants.
  - Grants a role to an employee, invalidates context, and records an audit log.
  - Revokes an existing role grant with audit tracking.
  - Creates an organizational team and queries teams scoped to tenant.
  - Creates an access group and queries groups scoped to tenant.
  - Lists tenant auth users and toggles emergency break-glass status with audit logging.
  - Cross-tenant negative isolation test: Tenant B cannot mutate Tenant A settings, grant roles, or view teams.

## 2. TypeScript Compilation Gate
- Command: `npx tsc --noEmit` in `apps/web`.
- Result: **0 errors**, clean compilation.

## 3. Live Server End-to-End Verification
- **Dev Server**: Running on `http://localhost:3001`.
- **Authentication**: Logged in as `admin@acme.opsengine.enterprise` on `acme.opsengine.enterprise`.
- **Workspace API**: `GET /api/admin/workspace` -> HTTP 200 (returns Acme Corp, 2 employees, 3 teams, 2 role grants).
- **Roles API**: `GET /api/admin/roles` -> HTTP 200 (returns full role templates catalog and enriched grants).
- **UI Route**: `GET /dashboard/administration` -> HTTP 200 OK.
