feature: reporting-audit
stage: designing
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, crm-core, project-workforce, finance, leave-attendance

# Feature #14 — Executive Reporting, Analytics & Audit Log Viewer (Design)

## 1. UI Screens Delivered
- **`/dashboard/reports`**:
  - Replaced generic placeholder with interactive enterprise reporting & compliance console.
  - **Tab 1: Executive KPI Overview**:
    - Workforce & Operations: Active headcount, attendance rate %, today's attendance & leaves count.
    - Delivery & Engineering: Active projects, open vs resolved tickets, ticket completion rate %.
    - CRM & Revenue Pipeline: Total pipeline value ($), active opportunities, open leads.
    - Finance & Receivables: Total billed invoices ($), count of unpaid receivables.
    - Talent & Recruitment: Open requisitions, active onboarding plans.
    - Departmental breakdown with relative percentage distribution bars.
    - Governance health: Pending approval requests, total recorded audit events.
  - **Tab 2: Audit Trail**:
    - Filterable table displaying `audit_events` (Timestamp, Event Type, Decision `allow`/`deny` badge, Reason Code, Resource, Actor ID).
    - Real-time text filter by event type and dropdown filter by decision.
    - Pagination controls (Previous / Next / Page counter).
    - "Export CSV" compliance button triggering CSV download.
  - **Tab 3: Governance & Stage History**:
    - Filterable chronological timeline displaying `stage_history` across entities (approvals, attendance corrections, requisitions, invoices, candidates).
    - Entity Type, Entity ID, transition indicators (`fromStatus` → `toStatus`), Actor, and context notes.
    - Pagination controls.

## 2. API Contracts
- `GET /api/reports/executive-summary`: Returns aggregated workforce, delivery, CRM, finance, talent, and governance KPIs.
- `GET /api/reports/audit-events?eventType=&decision=&limit=&offset=`: Filterable and paginated query of immutable audit log entries.
- `GET /api/reports/stage-history?entityType=&limit=&offset=`: Filterable and paginated query of entity state transitions.
- `GET /api/reports/audit-events/export?eventType=&decision=`: Streamed CSV download of audit log with audit logging of the export action.
