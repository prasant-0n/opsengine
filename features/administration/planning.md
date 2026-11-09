feature: administration
stage: planning
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit

# Feature #15 — Tenant Administration, Role Governance & Organization Management (PRD Modules 0 & 15)

## 1. Scope & Requirements
- **Tenant Workspace & Settings Configuration**:
  - View & update workspace profile: name, primary domain, and AI features enablement (`aiEnabled`).
  - High-level tenant organizational statistics (headcount, teams, roles assigned, access groups).
- **Role & ReBAC Governance (`org.manage_roles`)**:
  - Role catalog: inspect system roles (`employee`, `lead`, `senior_lead`, `hr`, `finance`, `recruiter`, `sales`) and their permission templates.
  - Role assignments (`role_grants`): grant and revoke role assignments with explicit scopes (`TENANT`, `SBU`, `TEAM`, `SELF`), validity windows, and mandatory reasons.
  - Direct permission grants (`permission_grants`) inspector.
  - Role mutations automatically invalidate cached authorization contexts (`invalidateAuthContext`).
- **Teams & Organizational Units**:
  - Manage organizational teams (`teams`), parent team hierarchies, and team types.
- **Cross-Functional Access Groups**:
  - Manage access groups (`access_groups`) and memberships (`access_group_memberships`).
- **Emergency Break-Glass Governance**:
  - View tenant authentication accounts (`auth_users`) with admin and break-glass flags.
  - Emergency break-glass toggle with mandatory security audit event (`break_glass.toggle`).

## 2. Multi-Tenant Scoping & ReBAC Rules
- All database queries and writes strictly filtered by `tenantId: ctx.tenantId`.
- Server-side authorization enforced via `PERMISSIONS.ORG_MANAGE_ROLES = "org.manage_roles"`.
- All administrative mutations emit immutable audit log entries (`writeAudit`).
- Cross-tenant negative tests must verify 403 / zero data exposure across tenant boundaries.

## 3. API Surface
- `GET /api/admin/workspace` — Get tenant workspace info and metrics.
- `PATCH /api/admin/workspace` — Update tenant workspace name or AI toggle.
- `GET /api/admin/roles` — List role templates and active tenant role grants.
- `POST /api/admin/roles/grant` — Grant a role to a user/employee.
- `POST /api/admin/roles/revoke` — Revoke an existing role grant.
- `GET /api/admin/permissions` — List system permissions catalog and active grants.
- `GET /api/admin/teams` — List organizational teams.
- `POST /api/admin/teams` — Create a new organizational team.
- `GET /api/admin/access-groups` — List access groups and membership counts.
- `POST /api/admin/access-groups` — Create an access group.
- `GET /api/admin/users` — List tenant users with roles, admin flags, and break-glass status.
- `POST /api/admin/users/[id]/break-glass` — Toggle emergency break-glass status.

## 4. UI Surface
- `/dashboard/administration`: Comprehensive administrative console replacing the placeholder:
  - Tab 1: **Workspace & Settings** (Workspace profile, AI toggle, organizational metrics).
  - Tab 2: **Roles & ReBAC Governance** (Role catalog, active grants table, "Grant Role" modal dialog).
  - Tab 3: **Teams & Access Groups** (Teams hierarchy table, "Create Team" dialog, Access Groups list).
  - Tab 4: **Users & Break-Glass** (User accounts, admin badges, break-glass toggles).

## 5. Test Plan
- Unit tests in `apps/web/src/tests/administration.test.ts`:
  1. Retrieve workspace configuration and mutate workspace settings.
  2. Grant a role to a user, assert role grant creation and audit event.
  3. Revoke a role grant, assert invalidation and audit event.
  4. Create an organizational team scoped to tenant.
  5. Create an access group scoped to tenant.
  6. Toggle emergency break-glass status on a user and verify audit logging.
  7. Cross-tenant negative isolation test: Tenant B cannot read or mutate Tenant A administrative resources.
