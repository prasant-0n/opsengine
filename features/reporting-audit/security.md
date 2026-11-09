feature: reporting-audit
stage: security
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, crm-core, project-workforce, finance, leave-attendance

# Feature #14 — Executive Reporting, Analytics & Audit Log Viewer (Security Analysis)

## 1. Multi-Tenant Isolation
- **Tenant Scoping**: All Prisma queries in `reporting-service.ts` enforce `tenantId` filtering directly from the authenticated session context (`ctx.tenantId`).
- **Cross-Tenant Negative Verification**: Unit test `cross-tenant negative test: Tenant B queries return zero Tenant A audit events` verifies that Tenant B cannot access Tenant A's audit events or metrics.

## 2. Server-Side ReBAC Authorization
- All API routes (`/api/reports/executive-summary`, `/api/reports/audit-events`, `/api/reports/stage-history`, `/api/reports/audit-events/export`) verify session token authentication and authorize `PERMISSIONS.AUDIT_READ = "audit.read"`.
- Requests from unauthenticated callers receive HTTP 401.
- Requests without `audit.read` receive HTTP 403.

## 3. Compliance & Auditability
- The CSV export endpoint (`/api/reports/audit-events/export`) records an immutable audit event (`eventType: "audit.export"`, `reasonCode: "USER_EXPORT"`) whenever an administrator exports audit records.
- Exported CSV content is sanitized against formula injection vulnerabilities and properly escapes quotes per RFC 4180.
