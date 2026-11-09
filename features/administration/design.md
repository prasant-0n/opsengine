feature: administration
stage: designing
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit

# Feature #15 — Tenant Administration, Role Governance & Organization Management (Design)

## 1. UI Screens Delivered
- **`/dashboard/administration`**:
  - Replaced generic placeholder with unified administrative and role governance console.
  - **Tab 1: Workspace & General Settings**:
    - Tenant Workspace Profile: Name, slug, domain, active status, tenant UUID.
    - AI Assistant Feature Controls: Toggle switch with real-time API persistence (`aiEnabled`).
    - Operational Metrics Bar: Active employees, functional teams, access groups, auth accounts, active role grants.
  - **Tab 2: Roles & Permissions Governance**:
    - System Role Catalog: Role cards (`employee`, `lead`, `senior_lead`, `hr`, `finance`, `recruiter`, `sales`) displaying permission counts and scope rules.
    - Active Role Grants Table: Principal account email, linked employee name/department, role key, scope type (`TENANT`, `SBU`, `TEAM`), and Revoke action.
    - "Grant Role" Modal Dialog: User selector, role template selector, scope boundary dropdown, and mandatory audit justification.
  - **Tab 3: Teams & Access Groups**:
    - Organizational Teams List with team type, hierarchy indicators, and "+ New Team" modal dialog.
    - Cross-Functional Access Groups List with membership counts, purpose, and "+ New Group" modal dialog.
  - **Tab 4: Users & Emergency Break-Glass**:
    - Accounts Table: User email, linked employee profile, privilege badges (`Root Admin`, `Superadmin`, `Standard User`).
    - Emergency Break-Glass Status: Visual active/normal indicators and "+ Toggle Break-Glass" modal dialog requiring mandatory incident justification per SOC 2 standards.

## 2. API Contracts
- `GET /api/admin/workspace`
- `PATCH /api/admin/workspace`
- `GET /api/admin/roles`
- `POST /api/admin/roles/grant`
- `POST /api/admin/roles/revoke`
- `GET /api/admin/teams`
- `POST /api/admin/teams`
- `GET /api/admin/access-groups`
- `POST /api/admin/access-groups`
- `GET /api/admin/users`
- `POST /api/admin/users/break-glass`
