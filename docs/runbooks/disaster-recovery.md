# OpsEngine Operational Runbook: Disaster Recovery & Business Continuity

## 1. Overview & Service Level Objectives (SLOs)
This runbook governs business continuity and disaster recovery procedures for OpsEngine Enterprise SaaS.

- **Recovery Point Objective (RPO)**: **≤ 15 minutes** (maximum data loss window). In production, PostgreSQL Write-Ahead Log (WAL) archiving ships continuous segment streams to cold object storage (S3/GCS) alongside hourly snapshots.
- **Recovery Time Objective (RTO)**: **≤ 4 hours** (maximum downtime allowed for total infrastructure rebuilding). The local automated drill benchmark completes recovery and validation in **< 30 seconds**.
- **Backup Retention Policy**:
  - Hourly snapshots: Retained for 48 hours.
  - Daily snapshots: Retained for 30 days.
  - Weekly snapshots: Retained for 90 days.
  - Monthly snapshots: Retained for 1 year (regulatory compliance).

---

## 2. Automated Disaster Recovery Scripts
All disaster recovery operations are managed via version-controlled scripts located in `scripts/`:

| Script | Purpose | Arguments / Env |
|---|---|---|
| `scripts/backup.sh` | Generates compressed custom-format pg_dump, calculates cryptographic SHA-256 hash, and generates metadata manifest. | `DATABASE_URL`, `BACKUP_DIR`, `RETENTION_COUNT` |
| `scripts/restore.sh` | Cryptographically verifies SHA-256 checksum, terminates conflicting client sessions, and restores database cleanly. | `BACKUP_FILE`, `TARGET_DATABASE_URL`, `FORCE_RESTORE` |
| `scripts/dr-drill.sh` | End-to-end automated DR drill harness: dumps primary DB, provisions sandbox, restores snapshot, verifies 100% row parity, checks ReBAC isolation, and generates audit report. | `--source-url`, `--sandbox-db`, `--keep-sandbox`, `--output-report` |

---

## 3. Standard Operating Procedures (SOPs)

### SOP-DR-01: Scheduled & Manual Database Snapshot
To take an immediate full database snapshot:
```bash
cd /home/prasanta/Documents/opsengine
./scripts/backup.sh
```
**Verification**:
- Verify output states `Backup Completed Successfully!`.
- Verify `.dump`, `.dump.sha256`, and `.dump.manifest.json` files are created in `backups/`.

### SOP-DR-02: Executing an Automated Disaster Recovery Drill
Automated DR drills must be executed at least monthly (or prior to major schema releases) to certify restore readiness:
```bash
cd /home/prasanta/Documents/opsengine
./scripts/dr-drill.sh
```
**Expected Results**:
1. Zero human intervention required.
2. Snapshot taken and checksum verified.
3. Sandbox database `opsengine_dr_sandbox` provisioned.
4. Schema and data restored.
5. 14 core tables verified with 0 row parity discrepancies.
6. Multi-tenant isolation verified (Tenant A & B workspaces intact, 0 NULL `tenantId` records).
7. Referential integrity verified (0 orphan tickets, 0 orphan invoice lines).
8. RTO benchmark printed (typically 3-10s).
9. Audit report saved to `reports/dr-drill-report-<timestamp>.json`.
10. Sandbox database cleanly torn down.

### SOP-DR-03: Restoring a Snapshot to a New Database / Replica
To restore a specific backup into a designated target database (e.g. staging or standby):
```bash
cd /home/prasanta/Documents/opsengine
./scripts/restore.sh backups/opsengine_backup_YYYYMMDD_HHMMSSZ.dump postgresql://opsengine:opsengine@localhost:5432/opsengine_replica
```

### SOP-DR-04: Emergency Production Recovery (Disaster Declaration)
In the event of catastrophic data corruption or primary instance failure:
1. **Declare Incident**: Convene incident response team; notify tenant administrators per SLA.
2. **Identify Safe Snapshot**: Locate the latest verified backup in object storage or `backups/`:
   ```bash
   cat backups/opsengine_backup_*.manifest.json | grep -E "timestamp|latest_prisma_migration"
   ```
3. **Verify Integrity**: Confirm the SHA-256 hash matches the signed manifest:
   ```bash
   sha256sum -c backups/opsengine_backup_TARGET.dump.sha256
   ```
4. **Halt Application Traffic**: Scale down web application pods or enable edge maintenance banner to prevent writes during restoration.
5. **Execute Restoration with Force Flag**:
   ```bash
   FORCE_RESTORE=true ./scripts/restore.sh backups/opsengine_backup_TARGET.dump postgresql://opsengine:opsengine@localhost:5432/opsengine
   ```
6. **Verify Database Health**:
   ```bash
   psql "postgresql://opsengine:opsengine@localhost:5432/opsengine" -c "SELECT COUNT(*) FROM tenant_workspaces; SELECT COUNT(*) FROM auth_users;"
   ```
7. **Resume Traffic & Audit**: Restart web services, verify health probe at `/api/health`, and review audit events.
