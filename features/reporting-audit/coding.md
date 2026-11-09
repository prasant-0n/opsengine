feature: reporting-audit
stage: coding
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, crm-core, project-workforce, finance, leave-attendance

# Feature #14 — Executive Reporting, Analytics & Audit Log Viewer (Coding)

## 1. Domain Services & Library Layer
- **`apps/web/src/features/reporting/lib/reporting-service.ts`**:
  - `getExecutiveSummary(tenantId)`:
    - Runs parallel queries across `Employee`, `AttendanceDay`, `Project`, `Ticket`, `CrmOpportunity`, `CrmLead`, `Invoice`, `Receivable`, `Requisition`, `OnboardingPlan`, `ApprovalInstance`, and `AuditEvent`.
    - Correctly calculates pipeline totals handling `BigInt` amount values (`amountCents`, `totalCents`).
    - Produces percentage calculations for attendance rate and ticket completion rate.
  - `getAuditEvents(tenantId, filter)`:
    - Queries `AuditEvent` scoped strictly to `tenantId`.
    - Supports filtering by `eventType`, `decision`, `actorUserId`, with limit/offset pagination.
  - `getStageHistory(tenantId, filter)`:
    - Queries `StageHistory` scoped strictly to `tenantId`.
    - Supports filtering by `entityType`, with limit/offset pagination.
  - `exportAuditEventsCsv(tenantId, filter)`:
    - Generates RFC 4180 compliant CSV string with sanitized headers and row escaping.

## 2. API Routes
- **`apps/web/src/app/api/reports/executive-summary/route.ts`**:
  - Session authentication + ReBAC authorization using `PERMISSIONS.AUDIT_READ`.
  - Scoped to `ctx.tenantId`.
- **`apps/web/src/app/api/reports/audit-events/route.ts`**:
  - Session authentication + ReBAC authorization using `PERMISSIONS.AUDIT_READ`.
  - Supports query parameters `eventType`, `decision`, `limit`, `offset`.
- **`apps/web/src/app/api/reports/stage-history/route.ts`**:
  - Session authentication + ReBAC authorization using `PERMISSIONS.AUDIT_READ`.
  - Supports query parameters `entityType`, `limit`, `offset`.
- **`apps/web/src/app/api/reports/audit-events/export/route.ts`**:
  - Session authentication + ReBAC authorization using `PERMISSIONS.AUDIT_READ`.
  - Emits audit log entry `writeAudit({ eventType: "audit.export", decision: "allow" })`.
  - Returns `text/csv` stream with `Content-Disposition: attachment`.

## 3. UI Components & Pages
- **`apps/web/src/features/reporting/components/reports-page.tsx`**:
  - Comprehensive client component with 3 tabs: Executive Overview, Audit Logs, Stage History.
  - Live filtering, pagination, and CSV download integration.
- **`apps/web/src/features/reporting/index.ts`**:
  - Barrel exports for page component and service library.
- **`apps/web/src/app/dashboard/reports/page.tsx`**:
  - Dedicated route override replacing placeholder route.
- **`apps/web/src/app/dashboard/[section]/page.tsx`**:
  - Removed `reports` placeholder mapping.
