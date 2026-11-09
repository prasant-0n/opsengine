# OpsEngine Operational Runbooks

This directory contains the production Standard Operating Procedures (SOPs), emergency incident protocols, and disaster recovery procedures for OpsEngine Enterprise SaaS.

## Runbook Index

| Runbook | Focus Area | Key Procedures |
|---|---|---|
| [**disaster-recovery.md**](./disaster-recovery.md) | Business Continuity & Backups | RPO/RTO SLOs, `backup.sh`, `restore.sh`, automated `dr-drill.sh` execution, emergency recovery |
| [**tenant-quarantine.md**](./tenant-quarantine.md) | Security & Abuse Response | Emergency tenant suspension, session termination, token revocation, forensic snapshotting |
| [**break-glass-access.md**](./break-glass-access.md) | Incident Management | Dual-authorization protocol, time-bounded support sessions, least-privilege elevation, revocation |
| [**tenant-data-export.md**](./tenant-data-export.md) | Compliance (GDPR/SOC2) | Machine-readable JSON/CSV tenant export, right-to-be-forgotten cascade purge, zero-leakage verification |
| [**zero-downtime-migration.md**](./zero-downtime-migration.md) | Deployment & Database SRE | Expand-and-contract schema changes, concurrent index creation, rolling Next.js pod deployments |

---

## Daily Operations Quick Reference

### 1. Database Migrations (Prisma)
Schema source of truth lives in `services/identity-service/prisma/schema.prisma`.
```bash
cd services/identity-service
export DATABASE_URL="postgresql://opsengine:opsengine@localhost:5432/opsengine"
npx prisma migrate deploy              # Apply recorded migrations
npx prisma generate                    # Regenerate client types
```

### 2. Multi-Tenant Enterprise Seed Engine
Populates Enterprise showcase tenants (Acme Corp and Starlight Tech) with full hierarchy, CRM, and project data:
```bash
cd apps/web && DATABASE_URL="postgresql://opsengine:opsengine@localhost:5432/opsengine" node scripts/seed.mjs
```

### 3. Automated Disaster Recovery Drills
Execute end-to-end non-destructive backup, sandbox restore, 100% row parity, and multi-tenant isolation verification:
```bash
./scripts/dr-drill.sh
```

### 4. Health & Security Verification Gates
```bash
cd apps/web
npx vitest run          # 202+ ReBAC & business logic tests across 22 suites
npx tsc --noEmit        # TypeScript typecheck
pnpm test:e2e           # Playwright 13/13 E2E tests
curl -f http://localhost:3000/api/health
```
