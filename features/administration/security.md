feature: administration
stage: security
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit

# Feature #15 — Tenant Administration, Role Governance & Organization Management (Security Analysis)

## 1. Multi-Tenant Isolation
- **Tenant Scoping**: All Prisma queries in `admin-service.ts` enforce `tenantId` filtering directly from the authenticated session context (`ctx.tenantId`).
- **Principal User Scoping**: `grantRole` explicitly validates that the target user belongs to the caller's tenant. Attempting to assign a role to a cross-tenant user throws an error.
- **Cross-Tenant Negative Verification**: Unit test `cross-tenant negative test: Tenant B cannot mutate Tenant A settings, grant roles, or view teams` confirms zero cross-tenant leakage.

## 2. Server-Side ReBAC Authorization
- All API routes enforce `PERMISSIONS.ORG_MANAGE_ROLES = "org.manage_roles"`.
- Requests from unauthenticated callers receive HTTP 401.
- Requests without `org.manage_roles` receive HTTP 403.

## 3. Cache Invalidation on Role Changes
- Any role grant or revocation immediately triggers `invalidateAuthContext(tenantId, principalUserId)` to flush in-memory cached authorizations, preventing stale privilege retention.

## 4. Emergency Break-Glass Controls (SOC 2 / ISO 27001)
- Toggling emergency break-glass privileges requires a mandatory incident justification and emits a high-priority `break_glass.toggle` audit event with reason code `EMERGENCY_OVERRIDE`.
