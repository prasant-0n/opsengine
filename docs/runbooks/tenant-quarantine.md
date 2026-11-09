# OpsEngine Operational Runbook: Emergency Tenant Quarantine & Isolation

## 1. Trigger Conditions
An emergency tenant quarantine must be executed when any of the following occur:
1. **Security Compromise**: Detected credential stuffing, token exfiltration, or rogue insider activity within a specific tenant.
2. **Abusive Workloads / Denial of Service**: A tenant's automated integrations generate pathological load threatening multi-tenant platform stability.
3. **Legal Hold / Subpoena**: Formal directive requiring immediate freeze and preservation of tenant records.
4. **Delinquency / Contractual Breach**: Administrative suspension for non-payment or compliance violations.

---

## 2. Immediate Quarantine Protocol (SOP-SEC-01)

### Step 1: Suspend Tenant Workspace Lifecycle
Suspending the workspace immediately causes the tenant control plane to reject all API and web requests with HTTP 403 / "Tenant Suspended".

**Via SQL**:
```sql
UPDATE tenant_workspaces
SET lifecycle_status = 'suspended',
    suspended_reason = 'EMERGENCY_SECURITY_QUARANTINE: Incident SEC-2026-001',
    suspended_at = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tenantId" = '<TARGET_TENANT_ID>';
```

**Verification**:
```sql
SELECT id, "tenantId", name, slug, lifecycle_status, suspended_reason, suspended_at
FROM tenant_workspaces
WHERE "tenantId" = '<TARGET_TENANT_ID>';
```

### Step 2: Invalidate Active Tenant Sessions
Immediately terminate all open web and mobile sessions for all users belonging to this tenant:
```sql
DELETE FROM sessions
WHERE "userId" IN (
  SELECT "userId" FROM tenant_memberships WHERE "tenantId" = '<TARGET_TENANT_ID>'
);
```

### Step 3: Revoke Active Support & Break-Glass Sessions
Ensure no active support operator or break-glass session remains open for the quarantined tenant:
```sql
UPDATE support_sessions
SET revoked_at = CURRENT_TIMESTAMP
WHERE tenant_id = '<TARGET_TENANT_ID>' AND revoked_at IS NULL;
```

### Step 4: Emit Security Audit Event
Log an immutable security audit event recording the quarantine action:
```sql
INSERT INTO audit_events (
  id, tenant_id, actor_user_id, event_type, action, status,
  metadata, ip_address, created_at
) VALUES (
  gen_random_uuid(),
  '<TARGET_TENANT_ID>',
  '<OPERATOR_USER_ID>',
  'SECURITY_QUARANTINE_APPLIED',
  'EMERGENCY_QUARANTINE',
  'SUCCESS',
  '{"reason": "Suspected credential leak", "authorized_by": "SecOps Lead"}'::jsonb,
  '127.0.0.1',
  CURRENT_TIMESTAMP
);
```

### Step 5: Snapshot Tenant State for Forensic Preservation
Export the quarantined tenant's complete state for forensic analysis before any modifications take place:
```sql
INSERT INTO tenant_data_exports (
  id, tenant_id, status, requested_by, expires_at, record_count, archive_data, created_at
) VALUES (
  gen_random_uuid(),
  '<TARGET_TENANT_ID>',
  'completed',
  '<OPERATOR_USER_ID>',
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  (SELECT COUNT(*) FROM employees WHERE "tenantId" = '<TARGET_TENANT_ID>'),
  jsonb_build_object(
    'quarantine_timestamp', CURRENT_TIMESTAMP,
    'workspace', (SELECT row_to_json(w) FROM tenant_workspaces w WHERE w."tenantId" = '<TARGET_TENANT_ID>' LIMIT 1),
    'employee_count', (SELECT COUNT(*) FROM employees WHERE "tenantId" = '<TARGET_TENANT_ID>'),
    'user_count', (SELECT COUNT(*) FROM tenant_memberships WHERE "tenantId" = '<TARGET_TENANT_ID>')
  ),
  CURRENT_TIMESTAMP
);
```

---

## 3. Reinstatement / De-Quarantine Protocol (SOP-SEC-02)
Once the incident has been formally resolved and SecOps approval is documented:

1. **Reactivate Workspace**:
   ```sql
   UPDATE tenant_workspaces
   SET lifecycle_status = 'active',
       suspended_reason = NULL,
       suspended_at = NULL,
       "updatedAt" = CURRENT_TIMESTAMP
   WHERE "tenantId" = '<TARGET_TENANT_ID>';
   ```
2. **Force Password Reset on Tenant Admins**:
   Flag primary tenant administrator accounts for mandatory credential rotation upon next login.
3. **Log Audit Clearance**:
   Record `SECURITY_QUARANTINE_LIFTED` event in `audit_events`.
4. **Notify Tenant Point of Contact**: Send formal resolution notice with post-incident security findings.
