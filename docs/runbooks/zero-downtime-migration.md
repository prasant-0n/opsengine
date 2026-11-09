# OpsEngine Operational Runbook: Zero-Downtime Database Schema Migrations

## 1. Principles & Architectural Guardrails
To maintain OpsEngine's high availability and meet the SLA requirement of continuous uptime during production deployments:

1. **Backwards Compatibility Rule**: The database schema must at all times be compatible with both the currently running application version ($N$) and the new incoming application version ($N+1$).
2. **Expand and Contract Pattern**: Breaking schema changes (renaming columns, changing types, splitting tables) must be executed in distinct deployment cycles across at least two consecutive releases.
3. **Non-Blocking DDL**: Avoid long-running exclusive table locks (`ACCESS EXCLUSIVE`) that block ongoing customer queries.

---

## 2. Safe Schema Evolution Strategy

### Pattern A: Adding New Columns
- **PostgreSQL 11+ Safety**: In PostgreSQL 18, `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` is an instant metadata-only operation and does not rewrite the table.
- **Rules**:
  - Always allow nullable or provide a default value.
  - Never add a column with `NOT NULL` without a default value directly.

### Pattern B: Adding Indexes Concurrently
Never run standard `CREATE INDEX` on high-traffic tables (e.g. `audit_events`, `tickets`, `time_entries`) as it locks concurrent writes.
- Write a raw migration using `CREATE INDEX CONCURRENTLY`:
  ```sql
  -- migrate.sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_events_tenant_timestamp 
  ON audit_events (tenant_id, created_at DESC);
  ```

### Pattern C: Renaming or Refactoring Columns (Expand & Contract)
Never directly run `ALTER TABLE ... RENAME COLUMN ...`.
1. **Release 1 (Expand)**:
   - Add the new column `new_name` (nullable).
   - Update application code to dual-write to both `old_name` and `new_name`.
   - Read from `old_name` with fallback to `new_name`.
2. **Between Releases (Backfill)**:
   - Run asynchronous batch backfill script:
     ```sql
     UPDATE target_table SET new_name = old_name WHERE new_name IS NULL LIMIT 1000;
     ```
3. **Release 2 (Switch)**:
   - Update application code to read from and write to `new_name` exclusively.
4. **Release 3 (Contract)**:
   - Drop the deprecated column `old_name`:
     ```sql
     ALTER TABLE target_table DROP COLUMN old_name;
     ```

---

## 3. Deployment Sequencing Runbook (SOP-REL-01)

### Pre-Deployment Checks
1. **Snapshot Database**:
   ```bash
   cd /home/prasanta/Documents/opsengine
   ./scripts/backup.sh
   ```
2. **Review Pending Migrations**:
   Inspect migration SQL files in `services/identity-service/prisma/migrations/` to ensure no blocking locks exist.

### Deployment Phase
1. **Apply Migrations Before Container Rollover**:
   ```bash
   cd services/identity-service
   npx prisma migrate deploy
   ```
2. **Verify Migration Status**:
   ```sql
   SELECT migration_name, finished_at, rolled_back_at 
   FROM _prisma_migrations 
   ORDER BY finished_at DESC LIMIT 3;
   ```
3. **Deploy New Application Pods**:
   Roll out updated Next.js application containers using rolling update strategy (e.g. Docker Compose or Kubernetes rolling update with `maxSurge=1, maxUnavailable=0`).
4. **Verify Health Probes**:
   ```bash
   curl -f http://localhost:3000/api/health
   ```

### Rollback Procedure (SOP-REL-02)
If application errors spike after deployment:
1. **Rollback Container Image First**: Revert web deployment to previous release tag ($N$). Because schema was designed backwards-compatible, release $N$ continues operating without errors.
2. **Do Not Rollback Schema Destructively**: Never drop added columns immediately during incident triage.
3. **Assess Root Cause**: Review logs, telemetry, and error rates before scheduling corrective forward migration.
