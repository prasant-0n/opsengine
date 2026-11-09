# OpsEngine Operational Runbook: Break-Glass Emergency Administrative Access

## 1. Overview & Policy
The "Break-Glass" protocol grants temporary, elevated, emergency administrative privileges to authorized operators during severe production outages (P0/P1 incidents), system lockouts, or critical data corruption where regular role-based access control (RBAC) is insufficient.

### Mandatory Compliance Rules
1. **Dual-Control Authorization**: No individual can unilaterally grant themselves break-glass access. Approval must be provided by the Incident Commander and SecOps Lead.
2. **Time-Bounded**: Break-glass sessions automatically expire after **2 hours** (maximum permissible extension: 4 hours).
3. **Tenant-Scoped**: Privileges are strictly scoped to the impacted `tenant_id` whenever possible.
4. **Mandatory Post-Mortem**: Every break-glass activation triggers an automated security review within 24 hours.

---

## 2. Break-Glass Procedure (SOP-OPS-01)

### Step 1: Record Justification & Obtain Incident Ticket
A formal P0/P1 incident ticket must exist (e.g. `INC-2026-901`). The ticket must document:
- Impacted Tenant(s)
- Nature of the outage
- Operator user ID
- Authorizing incident commander

### Step 2: Generate Ephemeral Break-Glass Support Session
Issue a time-bounded support session directly in the `support_sessions` table:
```sql
INSERT INTO support_sessions (
  id, tenant_id, operator_user_id, reason, token, expires_at, created_at
) VALUES (
  gen_random_uuid(),
  '<TARGET_TENANT_ID>',
  '<OPERATOR_USER_ID>',
  'BREAK-GLASS INCIDENT: INC-2026-901 - Database lock recovery',
  encode(gen_random_bytes(32), 'hex'),
  CURRENT_TIMESTAMP + INTERVAL '2 hours',
  CURRENT_TIMESTAMP
)
RETURNING id, token, expires_at;
```

### Step 3: Grant Temporary Elevated Tenant Membership
If the operator requires UI console access:
```sql
INSERT INTO tenant_memberships (
  id, "tenantId", "userId", role, status, "createdAt"
) VALUES (
  gen_random_uuid(),
  '<TARGET_TENANT_ID>',
  '<OPERATOR_USER_ID>',
  'SUPERADMIN',
  'active',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("tenantId", "userId") 
DO UPDATE SET role = 'SUPERADMIN', status = 'active';
```

### Step 4: Emit Immutable Audit Trail
```sql
INSERT INTO audit_events (
  id, tenant_id, actor_user_id, event_type, action, status,
  metadata, ip_address, created_at
) VALUES (
  gen_random_uuid(),
  '<TARGET_TENANT_ID>',
  '<OPERATOR_USER_ID>',
  'BREAK_GLASS_SESSION_INITIATED',
  'ELEVATE_PRIVILEGES',
  'SUCCESS',
  '{"incident_id": "INC-2026-901", "duration": "2h", "approver": "SecOps-OnCall"}'::jsonb,
  '127.0.0.1',
  CURRENT_TIMESTAMP
);
```

---

## 3. Session Revocation & De-escalation (SOP-OPS-02)
Immediately upon incident resolution (or at the 2-hour mark):

### Step 1: Revoke Support Session
```sql
UPDATE support_sessions
SET revoked_at = CURRENT_TIMESTAMP
WHERE tenant_id = '<TARGET_TENANT_ID>' 
  AND operator_user_id = '<OPERATOR_USER_ID>'
  AND revoked_at IS NULL;
```

### Step 2: Revoke Elevated Tenant Role
```sql
DELETE FROM tenant_memberships
WHERE "tenantId" = '<TARGET_TENANT_ID>'
  AND "userId" = '<OPERATOR_USER_ID>';
```

### Step 3: Invalidate Active Session Tokens
```sql
DELETE FROM sessions WHERE "userId" = '<OPERATOR_USER_ID>';
```

### Step 4: Emit Session Termination Audit Event
```sql
INSERT INTO audit_events (
  id, tenant_id, actor_user_id, event_type, action, status,
  metadata, ip_address, created_at
) VALUES (
  gen_random_uuid(),
  '<TARGET_TENANT_ID>',
  '<OPERATOR_USER_ID>',
  'BREAK_GLASS_SESSION_TERMINATED',
  'REVOKE_PRIVILEGES',
  'SUCCESS',
  '{"incident_id": "INC-2026-901", "resolution": "Incident resolved cleanly"}'::jsonb,
  '127.0.0.1',
  CURRENT_TIMESTAMP
);
```
