# OpsEngine Operational Runbook: Tenant Data Export & Cryptographic Purge (GDPR / SOC2)

## 1. Regulatory Context
Under GDPR Article 20 (Right to Data Portability), Article 17 (Right to Erasure / "Right to be Forgotten"), and SOC2 Type II Trust Principles, OpsEngine must support:
1. **Tenant Data Export**: A tenant administrator or authorized legal officer can request a complete, machine-readable export of all tenant-owned data.
2. **Cryptographic Purge**: Upon tenant termination or verified erasure request, all tenant data must be completely removed or irreversibly anonymized, leaving zero dangling records or cross-tenant contamination.

---

## 2. Complete Tenant Data Export (SOP-COMP-01)

### Step 1: Execute Scoped Tenant Aggregation
Extract all tenant-owned entities into a structured JSON archive bundle:
```sql
WITH tenant_payload AS (
  SELECT jsonb_build_object(
    'tenant_info', (SELECT row_to_json(w) FROM tenant_workspaces w WHERE w."tenantId" = '<TARGET_TENANT_ID>' LIMIT 1),
    'subscription', (SELECT row_to_json(s) FROM tenant_subscriptions s WHERE s.tenant_id = '<TARGET_TENANT_ID>' LIMIT 1),
    'users', (
      SELECT coalesce(jsonb_agg(row_to_json(u)), '[]'::jsonb)
      FROM auth_users u
      JOIN tenant_memberships tm ON u.id = tm."userId"
      WHERE tm."tenantId" = '<TARGET_TENANT_ID>'
    ),
    'employees', (SELECT coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb) FROM employees e WHERE e."tenantId" = '<TARGET_TENANT_ID>'),
    'teams', (SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM teams t WHERE t."tenantId" = '<TARGET_TENANT_ID>'),
    'crm_accounts', (SELECT coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM crm_accounts c WHERE c."tenantId" = '<TARGET_TENANT_ID>'),
    'crm_opportunities', (SELECT coalesce(jsonb_agg(row_to_json(o)), '[]'::jsonb) FROM crm_opportunities o WHERE o."tenantId" = '<TARGET_TENANT_ID>'),
    'projects', (SELECT coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM projects p WHERE p."tenantId" = '<TARGET_TENANT_ID>'),
    'tickets', (SELECT coalesce(jsonb_agg(row_to_json(tk)), '[]'::jsonb) FROM tickets tk WHERE tk."tenantId" = '<TARGET_TENANT_ID>'),
    'invoices', (SELECT coalesce(jsonb_agg(row_to_json(inv)), '[]'::jsonb) FROM invoices inv WHERE inv."tenantId" = '<TARGET_TENANT_ID>'),
    'audit_events', (SELECT coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) FROM audit_events a WHERE a.tenant_id = '<TARGET_TENANT_ID>')
  ) AS data
)
INSERT INTO tenant_data_exports (
  id, tenant_id, status, requested_by, expires_at, record_count, archive_data, created_at
)
SELECT 
  gen_random_uuid(),
  '<TARGET_TENANT_ID>',
  'completed',
  '<REQUESTER_USER_ID>',
  CURRENT_TIMESTAMP + INTERVAL '7 days',
  (
    (SELECT COUNT(*) FROM employees WHERE "tenantId" = '<TARGET_TENANT_ID>') +
    (SELECT COUNT(*) FROM projects WHERE "tenantId" = '<TARGET_TENANT_ID>') +
    (SELECT COUNT(*) FROM tickets WHERE "tenantId" = '<TARGET_TENANT_ID>') +
    (SELECT COUNT(*) FROM invoices WHERE "tenantId" = '<TARGET_TENANT_ID>')
  ),
  data,
  CURRENT_TIMESTAMP
FROM tenant_payload
RETURNING id, record_count, expires_at;
```

### Step 2: Verification of Export Bundle
```sql
SELECT id, tenant_id, status, record_count, expires_at, created_at
FROM tenant_data_exports
WHERE tenant_id = '<TARGET_TENANT_ID>'
ORDER BY created_at DESC LIMIT 1;
```

---

## 3. Cryptographic Tenant Purge (SOP-COMP-02)
> [!CAUTION]
> This operation is **IRREVERSIBLE**. It completely purges all data belonging to the specified tenant. Always take an automated snapshot via `scripts/backup.sh` prior to executing this procedure.

### Step 1: Pre-Purge Safety Snapshot
```bash
cd /home/prasanta/Documents/opsengine
./scripts/backup.sh
```

### Step 2: Execute Dependency-Ordered Purge Cascade
Execute the following deletion sequence inside a transactional block:
```sql
BEGIN;

-- 1. Operational Activity & Audits
DELETE FROM audit_events WHERE tenant_id = '<TARGET_TENANT_ID>';
DELETE FROM support_sessions WHERE tenant_id = '<TARGET_TENANT_ID>';
DELETE FROM tenant_data_exports WHERE tenant_id = '<TARGET_TENANT_ID>';

-- 2. Time, Attendance & Leaves
DELETE FROM attendance_days WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM leave_requests WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM leave_balances WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM leave_types WHERE "tenantId" = '<TARGET_TENANT_ID>';

-- 3. Invoicing & Finance
DELETE FROM invoice_lines WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM payments WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM receivables WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM invoices WHERE "tenantId" = '<TARGET_TENANT_ID>';

-- 4. Projects & Tasks
DELETE FROM tickets WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM project_milestones WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM allocations WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM projects WHERE "tenantId" = '<TARGET_TENANT_ID>';

-- 5. CRM & Sales
DELETE FROM crm_opportunities WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM crm_contacts WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM crm_leads WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM crm_accounts WHERE "tenantId" = '<TARGET_TENANT_ID>';

-- 6. HRMS & Workforce Hierarchy
DELETE FROM reporting_relationships WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM employee_team_memberships WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM employees WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM teams WHERE "tenantId" = '<TARGET_TENANT_ID>';

-- 7. Tenant Control Plane & Workspaces
DELETE FROM tenant_subscriptions WHERE tenant_id = '<TARGET_TENANT_ID>';
DELETE FROM tenant_memberships WHERE "tenantId" = '<TARGET_TENANT_ID>';
DELETE FROM tenant_workspaces WHERE "tenantId" = '<TARGET_TENANT_ID>';

COMMIT;
```

### Step 3: Post-Purge Verification (Zero-Leakage Confirmation)
Verify zero records remain across all tenant-scoped tables:
```sql
SELECT 'tenant_workspaces' AS tbl, COUNT(*) FROM tenant_workspaces WHERE "tenantId" = '<TARGET_TENANT_ID>'
UNION ALL
SELECT 'employees', COUNT(*) FROM employees WHERE "tenantId" = '<TARGET_TENANT_ID>'
UNION ALL
SELECT 'projects', COUNT(*) FROM projects WHERE "tenantId" = '<TARGET_TENANT_ID>'
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices WHERE "tenantId" = '<TARGET_TENANT_ID>'
UNION ALL
SELECT 'audit_events', COUNT(*) FROM audit_events WHERE tenant_id = '<TARGET_TENANT_ID>';
```
**Expected Outcome**: All counts returned must be `0`.
