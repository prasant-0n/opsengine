feature: administration
stage: coding
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit

# Feature #15 — Tenant Administration, Role Governance & Organization Management (Coding)

## 1. Domain Services & Library Layer
- **`apps/web/src/features/admin/lib/admin-service.ts`**:
  - `getWorkspaceDetails(tenantId)`: Fetches workspace record and aggregates real-time counts across employees, teams, access groups, users, and role grants.
  - `updateWorkspaceSettings(tenantId, actorUserId, update)`: Mutates tenant workspace settings (`name`, `domain`, `aiEnabled`) with audit logging (`workspace.update`).
  - `getRolesAndGrants(tenantId)`: Returns system role templates catalog and enriches active `role_grants` with linked auth user emails and employee records.
  - `grantRole(tenantId, actorUserId, input)`: Enforces tenant scoping on principal user, creates `role_grant`, invalidates user authorization cache (`invalidateAuthContext`), and writes audit event (`role.grant`).
  - `revokeRoleGrant(tenantId, actorUserId, grantId)`: Removes grant, invalidates cache, and writes audit event (`role.revoke`).
  - `getTeams(tenantId)` & `createTeam(tenantId, actorUserId, data)`: Manages organizational teams with audit logging (`team.create`).
  - `getAccessGroups(tenantId)` & `createAccessGroup(tenantId, actorUserId, data)`: Manages cross-functional access groups with group membership counts and audit logging (`access_group.create`).
  - `getTenantUsers(tenantId)`: Queries tenant auth accounts and maps linked employee profiles.
  - `toggleBreakGlass(tenantId, actorUserId, targetUserId, enabled, reason)`: Mutates `breakGlassEnabled` with high-priority emergency audit event (`break_glass.toggle`).

## 2. API Route Handlers
- `apps/web/src/app/api/admin/workspace/route.ts` (GET, PATCH)
- `apps/web/src/app/api/admin/roles/route.ts` (GET)
- `apps/web/src/app/api/admin/roles/grant/route.ts` (POST)
- `apps/web/src/app/api/admin/roles/revoke/route.ts` (POST)
- `apps/web/src/app/api/admin/teams/route.ts` (GET, POST)
- `apps/web/src/app/api/admin/access-groups/route.ts` (GET, POST)
- `apps/web/src/app/api/admin/users/route.ts` (GET)
- `apps/web/src/app/api/admin/users/break-glass/route.ts` (POST)

All routes enforce server-side ReBAC authorization with `PERMISSIONS.ORG_MANAGE_ROLES = "org.manage_roles"`.

## 3. UI Components & Pages
- `apps/web/src/features/admin/components/administration-page.tsx`: Client-side tabbed administration console with modal dialogs for role grants, team creation, group creation, and break-glass confirmation.
- `apps/web/src/features/admin/index.ts`: Barrel export.
- `apps/web/src/app/dashboard/administration/page.tsx`: Route page.
- `apps/web/src/app/dashboard/[section]/page.tsx`: Removed `administration` placeholder entry.
