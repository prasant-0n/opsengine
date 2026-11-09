feature: reporting-audit
stage: planning
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, crm-core, project-workforce, finance, leave-attendance

# Feature #14 — Executive Reporting, Analytics & Audit Log Viewer (PRD Module 16)

## 1. Scope & Requirements
- **Executive Metrics & Operational Overview**:
  - CRM Pipeline: Total opportunities, weighted pipeline, closed-won values.
  - Project Delivery: Active projects, open vs resolved tickets, delivery risks.
  - Workforce & Capacity: Employee headcount, allocation rates, today's attendance summary.
  - Financial Health: Total invoiced, outstanding receivables, payment realization.
  - Recruitment & Talent: Active requisitions, candidates in funnel, onboarding in-flight.
- **Audit Log Viewer**:
  - Live query interface for `audit_events` (actor, event type, decision `allow`/`deny`, reason code, metadata, timestamp).
  - Search and filter by event type, decision outcome, actor, and date range.
  - Export audit logs to CSV for compliance (SOC 2, ISO 27001).
- **Lifecycle & Governance Transitions**:
  - Live query interface for `stage_history` showing all audited state changes across entities (requisitions, offers, onboarding, probation, approvals, invoices, etc.).

## 2. Tenant Scoping & ReBAC Rules
- All queries strictly filtered by `tenantId: ctx.tenantId`.
- Access guarded by `PERMISSIONS.AUDIT_READ = "audit.read"`.
- Export endpoint logs an audit event (`AUDIT_LOG_EXPORTED`) when triggered.
- Cross-tenant negative tests must assert 403 / zero data exposure across tenant boundaries.

## 3. API Surface
- `GET /api/reports/executive-summary` — Aggregated cross-domain KPI overview.
- `GET /api/reports/audit-events` — Paginated and filtered audit events from `audit_events`.
- `GET /api/reports/stage-history` — Paginated and filtered lifecycle transitions from `stage_history`.
- `GET /api/reports/audit-events/export` — Streamed CSV export of filtered audit logs.

## 4. UI Surface
- `/dashboard/reports`: Dedicated executive analytics and compliance dashboard replacing the generic placeholder.
  - Tab 1: **Executive Overview** (KPI scorecards, pipeline metrics, workforce summary, financial receivables).
  - Tab 2: **Audit Log Viewer** (Filterable data table, decision badges, metadata inspector, CSV export).
  - Tab 3: **Governance & Lifecycle History** (Timeline of state transitions across requisitions, candidates, offers, projects, invoices).

## 5. Test Plan
- Unit tests for metric aggregation (revenue totals, headcount, open tickets, attendance rate).
- Unit tests for audit event filtering (by eventType, decision, date).
- Negative cross-tenant tests: Tenant B cannot query or export Tenant A's audit events or executive metrics.
