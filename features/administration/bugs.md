feature: administration
stage: bugs
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit

# Feature #15 — Tenant Administration, Role Governance & Organization Management (Bugs & Fixes)

## 1. Fire-and-Forget `writeAudit` Race in Tests
- **Bug**: `writeAudit` in `apps/web/src/lib/permissions/audit.ts` used un-awaited fire-and-forget Promise handling, causing unit tests to query `prisma.auditEvent.findFirst` before the asynchronous database insert resolved.
- **Fix**: Added `writeAuditAsync(input): Promise<any>` to `audit.ts` and updated `admin-service.ts` to `await writeAuditAsync(...)`. Preserved fire-and-forget behavior for non-awaited callers while guaranteeing atomic database persistence in administrative services.

## 2. Seed Grant Missing for Tenant Administrator
- **Bug**: `seed.mjs` had not explicitly granted `org.manage_roles` to `USER_A`, which prevented the Administration navigation item from showing and blocked administrative API calls.
- **Fix**: Added `"org.manage_roles"` and `"org.manage_employees"` to `permissionsA` in `seed.mjs` and re-ran the seed script.
