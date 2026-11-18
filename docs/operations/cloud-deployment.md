# OpsEngine Cloud Deployment & Operations Runbook
## Path 1: 100% Zero-Cost Enterprise Cloud Infrastructure

This runbook details the production architecture, cloud provisioning steps, automated disaster recovery, and operational runbooks for OpsEngine on a strict **$0.00/month recurring cost budget** across all tools and infrastructure.

---

## 1. Architectural Topology Overview

```
                      +---------------------------------------+
                      |         Global Internet Traffic       |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |       Vercel Edge Network (Free)       |
                      |   Next.js 16 App Router (apps/web)    |
                      |   - Static ISR & Edge Routes          |
                      |   - Standalone Node Serverless APIs   |
                      +---------------------------------------+
                                     /         \
                 Object Storage API /           \ Database Queries
            (Zero Egress, Free 10GB)             \ (Dual Pooled / Direct)
                                  v               v
    +--------------------------------+   +------------------------------------+
    |   Cloudflare R2 Object Store   |   |   Neon Serverless Postgres (Free)  |
    |   - opsengine-documents        |   |   - Pooled URL (App traffic/PgBouncer)|
    |   - opsengine-backups          |   |   - Direct URL (Prisma DDL migrations) |
    |   - 100% S3 API Compatible     |   |   - Scale-to-Zero Auto Suspend        |
    +--------------------------------+   +------------------------------------+
                   ^                                 |
                   |       Nightly Cron Backup       |
                   |      (Encrypted AES-256)        |
                   +---------------------------------+
                                   |
                  +-----------------------------------+
                  |  GitHub Actions CI/CD & DR Cron   |
                  |  - 4-Stage Multi-Job CI Pipeline  |
                  |  - Automated DR Backup to R2      |
                  +-----------------------------------+
```

---

## 2. Infrastructure Cost Matrix ($0.00 Recurring)

| Service | Role | Free Tier Allowance | OpsEngine Utilization | Recurring Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Frontend & API Gateway | 100 GB bandwidth, unlimited serverless invocations | ~5–10 GB bandwidth | **$0.00 / mo** |
| **Neon** | Primary Relational DB | 0.5 GiB storage, 1 compute branch, scale-to-zero | ~150 MB relational data | **$0.00 / mo** |
| **Cloudflare R2** | Document & Backup Store | 10 GB storage free forever, **zero egress fees** | ~1–2 GB documents & dumps | **$0.00 / mo** |
| **GitHub Actions** | Multi-Stage CI & DR Cron | 2,000 CI minutes/month (free on public repos) | ~150 minutes/month | **$0.00 / mo** |
| **AWS S3** | *Replaced by Cloudflare R2* | *Eliminated* | 0 bytes | **$0.00 / mo** |
| **Total** | — | — | — | **$0.00 / mo** |

---

## 3. Cloud Service Provisioning Steps

### Step 1: Neon Serverless Postgres Setup
1. Register for a free account at [https://neon.tech](https://neon.tech).
2. Create a new project named `opsengine-production` in your preferred cloud region (e.g. `us-east-1` or `eu-central-1`).
3. Neon automatically creates a primary database named `neondb`.
4. Navigate to **Dashboard > Connection Details**:
   - Check **Connection pooling** to obtain the pooled connection string:
     ```
     postgresql://<username>:<password>@ep-<project-id>-pooler.<region>.neon.tech/neondb?sslmode=require
     ```
     Assign this value to `DATABASE_URL`.
   - Uncheck **Connection pooling** to obtain the direct compute connection string:
     ```
     postgresql://<username>:<password>@ep-<project-id>.<region>.neon.tech/neondb?sslmode=require
     ```
     Assign this value to `DIRECT_URL`.
5. Neon auto-scales and suspends compute when idle, preserving 100% free tier capacity.

### Step 2: Cloudflare R2 Object Storage Setup
1. Register for a free Cloudflare account at [https://cloudflare.com](https://cloudflare.com).
2. In the sidebar, navigate to **R2 Storage**:
   - Click **Create bucket** and create:
     - `opsengine-documents` (tenant uploads, candidate resumes, signed agreements, invoices)
     - `opsengine-backups` (nightly AES-256 encrypted database archives)
3. Navigate to **Manage R2 API Tokens > Create API Token**:
   - Permission: **Object Read & Write**
   - Apply to: **Specific buckets** or **All buckets**
   - Save the credentials:
     - `Account ID` (found in the right-hand panel of R2 dashboard)
     - `Access Key ID`
     - `Secret Access Key`
4. The Cloudflare R2 S3 endpoint will follow this format:
   ```
   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   ```
5. *(Optional)* In bucket settings, enable a public development domain `pub-<hash>.r2.dev` or attach a custom subdomain (e.g. `cdn.opsengine.enterprise`).

### Step 3: Vercel Production Deployment Setup (Serverless)
1. Log in to [https://vercel.com](https://vercel.com) and click **Add New > Project**.
2. Select your GitHub repository `opsengine`.
3. In the project setup wizard:
   - **Framework Preset**: Next.js
   - **Root Directory**: `.` (or root of monorepo; root `vercel.json` configures everything)
   - **Build Command**: `pnpm --filter @opsengine/identity-service db:generate && pnpm --filter @opsengine/web build`
   - **Output Directory**: `apps/web/.next`
   - **Install Command**: `pnpm install`
4. Expand **Environment Variables** and configure:
   - `DATABASE_URL`: Neon pooled connection string or Render Postgres external connection string
   - `DIRECT_URL`: Neon direct connection string or same as DATABASE_URL
   - `NEXTAUTH_SECRET`: 32+ character random secret
   - `NEXT_PUBLIC_APP_URL`: Your Vercel production URL (e.g. `https://opsengine.vercel.app`)
   - `MOCK_GOOGLE_SSO`: `true` (mock Google SSO until Google Cloud OAuth credentials are configured)
5. Click **Deploy**. Vercel will trigger the standalone Next.js 16 App Router build and provision global Edge CDN endpoints.

### Step 4: Render Production Deployment Setup (Docker Blueprint)
OpsEngine includes a ready-to-use Render Blueprint (`render.yaml`) that spins up a managed PostgreSQL database and a Docker web service with automatic migrations.

1. Log in to [https://dashboard.render.com](https://dashboard.render.com).
2. Click **New > Blueprint**.
3. Connect your GitHub repository `prasant-0n/opsengine` and select branch `main`.
4. Render detects `render.yaml` and displays the Blueprint resources:
   - **Database**: `opsengine-postgres` (Free tier PostgreSQL)
   - **Web Service**: `opsengine-web` (Docker runtime, free plan, health check `/api/health`)
5. Under `opsengine-web` environment variables:
   - `DATABASE_URL` & `DIRECT_URL`: Auto-linked from `opsengine-postgres`
   - `NEXTAUTH_SECRET`: Auto-generated high entropy key
   - `MOCK_GOOGLE_SSO`: Pre-set to `"true"`
   - `NEXT_PUBLIC_APP_URL`: Enter your Render service URL (e.g. `https://opsengine-web.onrender.com`)
6. Click **Apply Blueprint**. Render builds the Docker image, applies database migrations via `entrypoint.sh`, and starts the container.
7. Verify deployment health:
   ```bash
   curl -i https://<your-render-subdomain>.onrender.com/api/health
   ```

---

## 4. Environment Variables & GitHub Secrets

### Production Environment Variables (Vercel & Runtime)

| Variable | Description | Example / Format |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon pooled connection string (PgBouncer) | `postgresql://user:pass@ep-xyz-pooler.neon.tech/neondb?sslmode=require` |
| `DIRECT_URL` | Neon direct connection string (migrations) | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare 32-hex Account ID | `0123456789abcdef0123456789abcdef` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Cloudflare R2 S3 Access Key | `abc123def456` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 S3 Secret Key | `secret_hex_token` |
| `CLOUDFLARE_R2_BUCKET_NAME` | Primary application document bucket | `opsengine-documents` |
| `CLOUDFLARE_R2_PUBLIC_URL` | Public CDN URL (optional) | `https://pub-yourhash.r2.dev` |
| `NEXTAUTH_SECRET` | 32-byte cryptographic session secret | `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Canonical public application URL | `https://opsengine.vercel.app` |

### Repository Secrets (GitHub Actions CI/CD)

Configure these secrets in GitHub under **Settings > Secrets and variables > Actions**:

| Secret Name | Purpose |
| :--- | :--- |
| `DATABASE_URL` | Remote connection for automated database testing / migrations |
| `DIRECT_URL` | Direct remote PostgreSQL connection for DDL execution |
| `BACKUP_ENCRYPTION_KEY` | Strong passphrase for AES-256 backup encryption (`openssl rand -hex 32`) |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare Account ID for DR backup uploads |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key ID for backup bucket |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Access Key for backup bucket |
| `CLOUDFLARE_R2_BACKUP_BUCKET` | Target backup bucket (`opsengine-backups`) |

---

## 5. Automated CI/CD Pipeline Specification

The OpsEngine CI/CD workflow (`.github/workflows/ci.yml`) runs on every pull request and push to `main` across four distinct stages:

1. **Stage 1 — Quality, Security & Typecheck**:
   - Scans commits for credential leaks using **Gitleaks**.
   - Generates Prisma client types.
   - Runs TypeScript static analysis (`pnpm --filter @opsengine/web typecheck` and monorepo typecheck).
2. **Stage 2 — Database & Vitest Suites**:
   - Boots isolated PostgreSQL 16 container service.
   - Executes numbered schema migrations (`prisma migrate deploy`).
   - Executes baseline enterprise multi-tenant seed script (`seed.mjs`).
   - Runs all 36+ Vitest test suites (375+ unit, authorization, and ReBAC tests).
3. **Stage 3 — Standalone Production Build**:
   - Executes Next.js 16 Turbopack production build (`pnpm --filter @opsengine/web build`).
   - Verifies zero hydration errors, static prerendering of 75+ routes, and bundle integrity.
4. **Stage 4 — Playwright E2E Integration Suite**:
   - Launches Next.js standalone web server on port 3001.
   - Executes end-to-end user journeys (login, tenant switcher, onboarding, approvals, tickets).
   - Generates and uploads failure artifacts on regression.

---

## 6. Automated Disaster Recovery (DR) & Backup Runbook

### Automated Nightly Snapshot Process
Every night at 02:00 UTC, `.github/workflows/db-backup-cron.yml` executes `scripts/cloud-backup-r2.sh`:
1. Executes `pg_dump -Fc --no-owner --no-privileges` against the database.
2. Generates a cryptographic SHA-256 hash of the raw dump.
3. Encrypts the dump with **OpenSSL AES-256-CBC** using PBKDF2 with 100,000 iterations and salt.
4. Generates an RFC-compliant JSON Disaster Recovery Manifest with table counts, migration version, and hashes.
5. Securely shreds and removes the unencrypted dump from runner memory and disk.
6. Archives the encrypted payload (`.dump.enc`), hash (`.sha256`), and manifest (`.manifest.json`) to Cloudflare R2 bucket `opsengine-backups/nightly/`.

### Disaster Recovery Restoration Runbook (Cold Recovery)

In the event of database corruption, regional outage, or accidental deletion, follow these steps to restore service:

#### Step 1: Download the Encrypted Backup Artifact from Cloudflare R2
```bash
export AWS_ACCESS_KEY_ID="<CLOUDFLARE_R2_ACCESS_KEY_ID>"
export AWS_SECRET_ACCESS_KEY="<CLOUDFLARE_R2_SECRET_ACCESS_KEY>"
export R2_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
export BACKUP_FILE="opsengine_backup_YYYYMMDD_HHMMSSZ.dump"

# Download encrypted dump and checksum
aws s3 cp "s3://opsengine-backups/nightly/${BACKUP_FILE}.enc" . --endpoint-url "${R2_ENDPOINT}"
aws s3 cp "s3://opsengine-backups/nightly/${BACKUP_FILE}.sha256" . --endpoint-url "${R2_ENDPOINT}"
```

#### Step 2: Decrypt the Backup Archive
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in "${BACKUP_FILE}.enc" \
  -out "${BACKUP_FILE}" \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}"
```

#### Step 3: Verify Cryptographic Integrity
```bash
sha256sum -c "${BACKUP_FILE}.sha256"
# Expected output: opsengine_backup_YYYYMMDD_HHMMSSZ.dump: OK
```

#### Step 4: Restore into Target Neon Postgres Instance
```bash
# Connect with direct connection URL and restore
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="${DIRECT_URL}" \
  --verbose "${BACKUP_FILE}"
```

#### Step 5: Verify Schema & Migration State
```bash
cd services/identity-service
npx prisma migrate status
```

---

## 7. Zero-Cost Maintenance Guidelines

1. **Database Autoscaling**: Neon's free tier auto-suspends databases during zero-traffic windows (5 minutes idle timeout). The Next.js Prisma connection pool reconnects with ~500ms cold start when the next HTTP request arrives.
2. **Object Storage Life-Cycle**: Configure a 30-day lifecycle rule on Cloudflare R2 bucket `opsengine-backups` to automatically delete older backup snapshots, keeping total storage well below the 10 GB free ceiling.
3. **No S3 Egress Bills**: Always direct file downloads through pre-signed Cloudflare R2 URLs or custom CDN domains, ensuring zero egress bandwidth charges.
