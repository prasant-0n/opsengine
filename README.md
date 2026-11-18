# OpsEngine — Enterprise Operations Platform (SaaS CRM + HRMS + Workforce)

[![CI Pipeline](https://github.com/prasant-0n/opsengine/actions/workflows/ci.yml/badge.svg)](https://github.com/prasant-0n/opsengine/actions/workflows/ci.yml)
[![Tests Passing](https://img.shields.io/badge/tests-460%2F460%20passing-brightgreen.svg)](https://github.com/prasant-0n/opsengine)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.0%20App%20Router-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x%20FULL%20TURBO-ef4444?logo=turborepo)](https://turbo.build/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.x-2D3748?logo=prisma)](https://www.prisma.io/)
[![Neon Postgres](https://img.shields.io/badge/Neon-Serverless%20Postgres-00E599?logo=postgresql)](https://neon.tech/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare%20R2-Zero%20Egress%20Storage-F38020?logo=cloudflare)](https://cloudflare.com/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Serverless%20Edge-black?logo=vercel)](https://vercel.com/)
[![Zero Cost Mesh](https://img.shields.io/badge/Cost-%240.00%2Fmonth%20Forever-success.svg)](https://github.com/prasant-0n/opsengine)

**OpsEngine** is a commercial-grade, multi-tenant SaaS business operating system unifying **CRM, Human Capital Management (HRMS), Workforce Scheduling, Presales Estimation, Project Delivery, Invoicing, Payment Gateways, and Controlled Agentic AI** into a unified, high-performance platform.

Built from the ground up for strict multi-tenant isolation, cryptographically verifiable audit trails, zero-cost serverless cloud infrastructure, and server-side authoritative Relationship-Based Access Control (ReBAC).

---

## Table of Contents

1. [Architectural Overview](#architectural-overview)
2. [Modern Zero-Cost Cloud Infrastructure Mesh](#modern-zero-cost-cloud-infrastructure-mesh)
3. [Comprehensive Feature Catalog](#comprehensive-feature-catalog)
4. [Monorepo Structure](#monorepo-structure)
5. [Local Development Setup](#local-development-setup)
6. [Demo Showcase Accounts & Seed Data](#demo-showcase-accounts--seed-data)
7. [Automated CI/CD & Testing Matrix](#automated-cicd--testing-matrix)
8. [Automated Disaster Recovery (DR) & Backup](#automated-disaster-recovery-dr--backup)
9. [Production Cloud Deployment](#production-cloud-deployment)
10. [Security & Architectural Guardrails](#security--architectural-guardrails)

---

## Architectural Overview

```
                                  +---------------------------------------+
                                  |         Global Internet Traffic       |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |       Vercel Edge Network (Free)       |
                                  |   Next.js 16 App Router (apps/web)    |
                                  |   - Edge Middleware & WAF Defense     |
                                  |   - Server Actions & Serverless APIs  |
                                  +---------------------------------------+
                                                 /         \
                      Object Storage API        /           \  Prisma ORM (Dual URL)
               (100% S3 Compatible, $0 Egress) /             \ (Pooled App / Direct DDL)
                                              v               v
                +--------------------------------+   +------------------------------------+
                |   Cloudflare R2 Object Store   |   |   Neon Serverless Postgres (Free)  |
                |   - opsengine-documents        |   |   - PgBouncer Pooling (Port 6543)  |
                |   - opsengine-backups          |   |   - Direct Compute (Port 5432)     |
                |   - Zero Egress Bandwidth Fees |   |   - Scale-to-Zero Auto Suspend     |
                +--------------------------------+   +------------------------------------+
                               ^                                 |
                               |       Nightly Cron Backup       |
                               |      (Encrypted AES-256)        |
                               +---------------------------------+
                                               |
                              +-----------------------------------+
                              |  GitHub Actions CI/CD & DR Cron   |
                              |  - 4-Stage Multi-Job CI Pipeline  |
                              |  - Nightly Automated DR to R2     |
                              +-----------------------------------+
```

---

## Modern Zero-Cost Cloud Infrastructure Mesh

OpsEngine runs on **Path 1: Modern Serverless Cloud Mesh**, delivering enterprise-grade performance, scalability, and disaster recovery on a strict **$0.00/month recurring budget**:

| Component | Cloud Provider | Free Tier Specification | OpsEngine Role | Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Application & Edge** | **Vercel** | 100 GB bandwidth, unlimited invocations | Next.js 16 App Router standalone hosting | **$0.00** |
| **Primary Database** | **Neon** | 0.5 GiB storage, scale-to-zero compute | Serverless PostgreSQL with PgBouncer connection pooling | **$0.00** |
| **Object & Blob Storage** | **Cloudflare R2** | 10 GB free forever, **$0 egress fees** | Document storage, agreements, encrypted backup archives | **$0.00** |
| **Continuous Integration** | **GitHub Actions** | 2,000 CI minutes/month | 4-Stage automated pipeline (Gitleaks, Vitest, E2E) | **$0.00** |
| **Automated Backups** | **GitHub Actions + R2**| Scheduled cron (`0 2 * * *`) | OpenSSL AES-256-CBC encrypted nightly `pg_dump` | **$0.00** |
| **Object Store Alternative** | **AWS S3** | *Eliminated* | Completely replaced by Cloudflare R2 | **$0.00** |

---

## Comprehensive Feature Catalog

### 1. Identity, Security & SaaS Control Plane
- **Multi-Tenant Workspace Partitioning**: Cryptographically isolated tenants with dedicated slugs, domain routing, and lifecycle states (`active`, `suspended`, `purged`).
- **ReBAC Authorization Engine**: Policy-driven `authorize(subject, action, resource, context)` contract with hierarchical scope evaluation (`TENANT` > `TEAM` > `REPORTING_TREE` > `SELF`).
- **Enterprise Multi-Factor Authentication (TOTP 2FA)**: RFC 6238 TOTP authentication, QR provisioning, cryptographic backup codes, and session step-up escalation for critical actions.
- **Google OAuth 2.0 / SSO Integration**: OpenID Connect authorization with CSRF-protected HMAC state tokens, open redirect sanitization, and automatic tenant identity linking.
- **Cryptographic Audit Trail Verification**: SHA-256 hash-chained tamper-evident audit ledger with forward-secure integrity verification.
- **WAF & Rate Limiting**: In-memory token bucket rate limiting with route tier classification (`PROBES`, `AUTH`, `MUTATION`, `READ`) and security header enforcement (CSP, HSTS, X-Frame-Options).

### 2. Human Capital Management (HRMS) & Talent Acquisition (ATS)
- **Employee Directory & Hierarchy**: Unified directory with department allocations, title tracking, and dynamic manager-employee reporting tree traversal.
- **Time & Attendance Tracking**: Shift check-in/out, activity reporting, daily work plans, Daily Activity Reports (DAR), and historical correction versioning.
- **Leave Management Engine**: Tiered leave allocations, policy accruals, multi-approver leave requests, and team calendar heatmaps.
- **Applicant Tracking System (ATS)**: Requisitions with hiring manager approvals, candidate pipelines, interview scorecards, and stage transitions.
- **Offer Management & Onboarding**: Requisition-linked offer letter generation with approval chains, onboarding checklist templates, task assignments, induction events, and 90-day probation review cycles.

### 3. CRM, Presales & Delivery Pipeline
- **CRM & Client Relationships**: Account profiles, contacts, lead qualification, sales activity logging, and opportunity pipelines with stage confidence scoring.
- **Presales Estimation & Commercial Handover**: Role-based effort estimation, rate card application, gross margin guardrails, proposal versioning, and one-click project conversion.
- **Project Portfolio & Workforce Scheduling**: Multi-project tracking, milestone management, capacity planning, resource allocation heatmaps, and sprint ticket management.
- **Release Controls & QA Deployment Gates**: Release records with mandatory technical, QA, security, and rollback gates. Releases cannot be approved if required gates are missing.

### 4. Finance, Invoicing & Payment Gateways
- **Enterprise Invoicing Engine**: Invoices with multi-line items, tax calculation, receivables tracking, aging analysis, and **BigInt integer-cent money arithmetic** to eliminate floating-point drift.
- **Multi-Gateway Payment Integration**: Direct checkout session creation for **Stripe** and **Razorpay**, signed 72-hour payment links, and public verification screens.
- **Automated Webhook Ledger Reconciliation**: HMAC-SHA256 webhook signature verification with replay attack defense (timestamp drift tolerance) and exactly-once idempotency deduplication.

### 5. Platform Operations & Cloud Storage
- **Cloudflare R2 Object Storage Adapter**: Zero-cost, 100% S3-compatible document storage using `@aws-sdk/client-s3` targeting Cloudflare R2 endpoints with zero egress bandwidth charges.
- **Verified Document Repository**: Multi-tenant document uploads, presigned download URLs, MIME-type validation, and SHA-256 file checksum verification.
- **Outbound Webhook Delivery Engine & DLQ**: Real-time event dispatch with HMAC signatures (`X-OpsEngine-Signature-256`), exponential backoff retries (1s to 60s), SSRF DNS-rebinding protection, and Dead Letter Queue (DLQ) manual replay.
- **Real-Time Notifications & Calendar**: Server-Sent Events (SSE) notification stream, in-app notification center, meeting scheduling with structured decision logs, and action items.

### 6. Controlled Agentic AI Assistant
- **Google Gemini Integration**: Server-side Google Gemini (`gemini-3.8-flash`) integration with operator-gated workspace enablement.
- **Deterministic AI Guardrails**: Strict multi-tenant sandboxed retrieval, prompt injection defense, and automated PII redaction.
- **Human Confirmation Pipeline**: Critical operational actions (project creation, financial adjustments, user transfers) are emitted as proposals requiring explicit human confirmation. The AI assistant **cannot self-approve** any mutating action.

### 7. Customer Self-Service Support Portal & Deliverable Sign-Off
- **Account-Scoped Client Access**: Dedicated customer collaboration portal (`/portal`) restricted strictly to authenticated client account contacts with multi-tenant ReBAC isolation.
- **Support Desk & SLA Engine**: Bug, incident, and service request tracking with automated priority-driven SLA targets (Urgent: 1h/4h, High: 4h/12h, Medium: 8h/24h, Low: 24h/72h).
- **Anti-Leakage Comment Separation**: Multi-layered server-side filtration guaranteeing internal employee deliberations (`isInternal: true`) are never leaked to external client API responses.
- **Milestone Deliverable Review & Digital Sign-Off**: Deliverable artifact inspection and legal acceptance sign-off with SHA-256 tamper-evident digital signatures and audit evidence.
- **Client Invoices & Online Settlement**: Direct billing visibility with one-click payment checkout links powered by the integrated payment gateway.

### 8. Employee Expense Management & Reimbursements
- **Per-Diem Policy Engine**: Automated compliance checks for daily meal ($75.00) and lodging ($250.00) caps, plus mandatory receipt upload enforcement for expenses exceeding $50.00.
- **Cloudflare R2 Receipt Storage**: Tamper-evident receipt storage with SHA-256 file checksums and zero AWS S3 dependencies ($0 egress bandwidth fees).
- **Two-Stage Approval & SoD**: Stage 1 direct reporting manager approval, Stage 2 finance officer audit with strict Segregation of Duties (self-approval prohibited).
- **Payment Voucher Disbursement**: Automated reimbursement voucher generation (`VOU-YYYY-XXXXXXXX`) and financial ledger reconciliation.

### 9. Statutory Payroll, Taxes & Tamper-Evident Payslips
- **Compensation & Salary Structure Engine**: Itemized salary components (Basic, HRA, Special Allowances, PF/401k employee/employer contributions, and Tax TDS withholdings) represented purely in BigInt integer cents to eliminate floating-point drift.
- **Attendance & LOP Integration**: Automatic calculation of working days, worked days, and attendance-linked Loss of Pay (LOP) deductions computed from verified unpaid leave records.
- **Cryptographic SHA-256 Checksums**: Tamper-evident hash chaining securing every payslip record (`PAY-YYYYMM-XXXX`) against database manipulation or unauthorized salary adjustments.
- **NACHA / ACH & NEFT Banking Direct Deposit**: Automated batch file export generator formatting compliant bank transfer records with header, detail lines, and checksum trailer control.
- **Segregation of Duties (SoD)**: Enforces separation between the payroll calculation executor and the approving finance officer (self-approval strictly prohibited).

### 10. Performance Management, OKRs & 360-Degree Feedback
- **Hierarchical OKR Alignment**: Multi-level Objectives & Key Results (Company, Department, Individual) with aggregate progress calculation linked to project delivery milestones.
- **360-Degree Evaluation Engine**: Multi-perspective performance reviews (Self-assessment, Manager evaluation, Peer reviews, and Upward feedback) with customizable 1-to-5 competency rubrics.
- **Weighted Composite Scoring**: Automated composite scoring engine integrating Manager evaluation (50%), Self review (15%), Peer reviews (20%), and quantitative OKR progress (15%).
- **Bell-Curve Calibration Board**: Executive rating calibration matrix visualizing distribution across 5 performance bands with standard deviation controls and promotion/merit recommendation workflows.

### 11. Mobile Progressive Web App (PWA) & Web Push Notifications
- **Progressive Web App Shell**: Add-to-Home-Screen installability with standalone windowing, dark-theme styling, app shortcuts (Attendance, Daily Plan, Approvals, DAR), and touch-optimized mobile bottom navigation.
- **Offline Resilience & Service Worker**: Cache-first asset precaching and stale-while-revalidate navigation with dedicated offline fallback page (`/offline`).
- **Web Push Protocol (RFC 8030 / RFC 8292)**: Zero-dependency VAPID ECDSA P-256 key signing, subscription management, and push notification dispatcher.
- **Anti-SSRF Protection**: Strict host allowlisting (Google FCM, Apple APNs, Mozilla autopush, Windows WNS) and private IP/loopback filtering for endpoint registration.
- **ReBAC & Multi-Tenant Device Isolation**: Granular push subscriptions scoped strictly by tenant and user with automated cleanup of deactivated devices.

### 12. Accounting ERP Integrations (QuickBooks Online & Xero)
- **General Ledger Synchronization**: Automated bi-directional sync converting integer-cent invoices and payment reconciliations into Intuit QuickBooks Online and Xero JSON DTOs.
- **Chart of Accounts (COA) Mapping**: Tenant-configurable mapping for professional services revenue, accounts receivable, sales tax liability, and bank deposits.
- **Cryptographic Idempotency & Replay Defense**: SHA-256 payload hashing guaranteeing zero duplicate journal entries under high concurrency or retry loops.
- **Sync Audit Ledger & Error Resolution**: Complete audit trail of outbound and inbound journal syncs with one-click retry for failed entries.

---

## Monorepo Structure

OpsEngine is organized as a high-performance monorepo managed with **pnpm workspaces** and **Turborepo 2**:

```
opsengine/
├── apps/
│   └── web/                           # Next.js 16 App Router application
│       ├── e2e/                       # Playwright browser integration tests
│       ├── public/                    # Static brand assets & icons
│       ├── scripts/                   # Database seed showcase script
│       └── src/
│           ├── app/                   # App Router pages and API routes
│           ├── components/            # Reusable UI & Shell primitives
│           ├── features/              # Vertical domain slices (HRMS, CRM, Finance)
│           ├── lib/                   # Infrastructure clients (Prisma, R2, Webhooks, Telemetry)
│           └── tests/                 # 42 Vitest unit & ReBAC test suites (460 tests)
├── packages/
│   ├── api-contracts/                 # Shared TypeScript DTOs, schemas & env contracts
│   ├── authorization-policy/          # ReBAC policy engine contracts
│   ├── authz-client/                  # Client-side permission helpers
│   ├── domain-events/                 # Typed asynchronous event bus contracts
│   ├── logger/                        # Structured JSON Winston logger
│   └── telemetry/                     # OpenTelemetry metrics & W3C traceparent context
├── services/
│   └── identity-service/              # Core authentication & Prisma schema service
│       └── prisma/
│           ├── migrations/            # Numbered, version-controlled SQL migrations
│           └── schema.prisma          # PostgreSQL schema (Neon pooled & direct DDL URLs)
├── docs/
│   ├── operations/                    # Cloud deployment runbooks & task tracking
│   └── product/                       # Comprehensive PRD & requirements specification
├── scripts/
│   └── cloud-backup-r2.sh             # AES-256 encrypted pg_dump Cloudflare R2 backup script
├── .github/
│   └── workflows/
│       ├── ci.yml                     # 4-stage GitHub Actions CI pipeline
│       └── db-backup-cron.yml         # Automated nightly backup cron to Cloudflare R2
├── .gitleaks.toml                     # Gitleaks secret scanning configuration
├── pnpm-workspace.yaml                # Workspace boundary configuration
├── turbo.json                         # Turborepo 2 pipeline & passThroughEnv config
└── vercel.json                        # Vercel Next.js 16 monorepo configuration
```

---

## Local Development Setup

### Prerequisites
- **Node.js**: `v20.0.0` or higher (`v22+` recommended)
- **pnpm**: `v9.0.0` or higher (`corepack enable pnpm`)
- **Docker & Docker Compose**: For local PostgreSQL (or connect to a free Neon branch)

### Step-by-Step Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/prasant-0n/opsengine.git
   cd opsengine
   ```

2. **Install monorepo dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure local environment variables**:
   ```bash
   cp .env.example .env
   cp apps/web/.env.example apps/web/.env
   cp .env.example services/identity-service/.env
   ```

4. **Boot local database services**:
   ```bash
   docker compose up -d postgres
   ```

5. **Apply Prisma schema migrations**:
   ```bash
   cd services/identity-service
   npx prisma migrate deploy
   cd ../..
   ```

6. **Seed the multi-tenant showcase database**:
   ```bash
   node apps/web/scripts/seed.mjs
   ```

7. **Start the local development server**:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Demo Showcase Accounts & Seed Data

The database is pre-seeded with two fully isolated enterprise tenants:

### Tenant A: Acme Global Enterprise (`acme.opsengine.enterprise`)
- **Tier**: Enterprise Tier (500 seats)
- **Structure**: 10 Employees across 5 Teams with full manager reporting lines
- **Data**: CRM Accounts ($1.5M+ pipeline), Projects Apollo & Titan, Invoices INV-2026-001 & 002, Verified Documents, Calendar Events

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Superadmin (Admin)** | Alex Mercer | `admin@acme.opsengine.enterprise` | `Sup3rSecret!` |
| **SBU Head** | Sarah Connor | `sarah.connor@acme.opsengine.enterprise` | `Sup3rSecret!` |
| **Engineering Lead** | David Vance | `david.vance@acme.opsengine.enterprise` | `Sup3rSecret!` |
| **Senior Dev** | Liam O'Connor | `liam.oconnor@acme.opsengine.enterprise` | `Sup3rSecret!` |

### Tenant B: Starlight Global Technologies (`starlight.opsengine.enterprise`)
- **Tier**: Professional Tier (50 seats)
- **Isolation**: Completely partitioned database records with zero cross-tenant leakage

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Tenant Admin** | Bob Globex | `user@globex.opsengine.enterprise` | `GlobexAdmin2026!` |
| **Engineering Lead** | Rachel Zane | `rachel.zane@starlight.opsengine.enterprise` | `GlobexAdmin2026!` |

---

## Automated CI/CD & Testing Matrix

OpsEngine enforces strict quality and security gates on every pull request and push to `main` via `.github/workflows/ci.yml`:

```
+-----------------------------------------------------------------------------------+
|                            OpsEngine CI/CD Pipeline                               |
+-----------------------------------------------------------------------------------+
  Stage 1: Quality & Security Guardrails
  ├── Gitleaks Secret Scanner (0 Leaks Allowed)
  ├── Prisma Client Type Generation
  └── Turborepo Full Monorepo Typecheck (6/6 packages passing)
        |
        v
  Stage 2: Database & Vitest Suites
  ├── PostgreSQL 16 Alpine Service Container
  ├── Prisma Migration Deployment (Direct Connection)
  ├── Enterprise Multi-Tenant Baseline Seed
  └── 42 Vitest Suites (460/460 Unit, ReBAC & Negative Tests Passing)
        |
        v
  Stage 3: Standalone Production Build
  ├── Next.js 16 App Router Turbopack Build
  └── Static Pre-rendering of 75+ Routes Verified
        |
        v
  Stage 4: Playwright E2E Integration Suite
  ├── Headless Chromium Browser with OS Dependencies
  ├── Live Webserver Cold Start (Port 3001)
  └── 13/13 User Journey & ReBAC Negative Gate Scenarios Passing
```

### Running Tests Locally

```bash
# Run all 42 Vitest test suites (460 tests)
pnpm test

# Run TypeScript type checking across all 6 monorepo packages
pnpm typecheck

# Run Playwright end-to-end browser tests
pnpm test:e2e
```

---

## Automated Disaster Recovery (DR) & Backup

OpsEngine features a fully automated, zero-cost disaster recovery pipeline (`.github/workflows/db-backup-cron.yml`):

1. **Nightly Cron Trigger**: Runs automatically at `02:00 UTC` without manual intervention.
2. **Encrypted Backup Pipeline** (`scripts/cloud-backup-r2.sh`):
   - Executes `pg_dump -Fc` (PostgreSQL custom compressed format).
   - Computes a cryptographic **SHA-256 checksum**.
   - Encrypts the archive using **OpenSSL AES-256-CBC** with PBKDF2 (100,000 iterations and salt).
   - Generates an RFC-compliant JSON Disaster Recovery manifest.
   - Securely shreds the unencrypted dump from disk.
   - Uploads the encrypted payload directly to Cloudflare R2 bucket `opsengine-backups/nightly/`.
3. **Cold Restoration**: Full step-by-step restore instructions with checksum verification are detailed in the [Cloud Deployment Runbook](docs/operations/cloud-deployment.md#6-automated-disaster-recovery-dr--backup-runbook).

---

## Production Cloud Deployment

For complete, copy-paste setup guides for **Neon**, **Cloudflare R2**, and **Vercel**, refer to the comprehensive operational runbook:

📖 **[Cloud Deployment & Operations Runbook (Path 1)](docs/operations/cloud-deployment.md)**

### Required Environment Variables

```ini
# Database (Neon Serverless Postgres)
DATABASE_URL="postgresql://user:pass@ep-xyz-pooler.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"

# Object Storage (Cloudflare R2 - 100% S3 Compatible, Zero Egress)
CLOUDFLARE_R2_ACCOUNT_ID="your-cloudflare-account-id"
CLOUDFLARE_R2_ACCESS_KEY_ID="your-r2-access-key-id"
CLOUDFLARE_R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
CLOUDFLARE_R2_BUCKET_NAME="opsengine-documents"
CLOUDFLARE_R2_PUBLIC_URL="https://pub-yourhash.r2.dev"

# Authentication & Application URL
NEXTAUTH_SECRET="your-32-character-cryptographic-secret"
NEXT_PUBLIC_APP_URL="https://opsengine.vercel.app"
```

---

## Security & Architectural Guardrails

- **Zero Client-Side Authoritative Decisions**: UI navigation reflects permissions for user experience only. Server-side middleware and domain use cases independently evaluate permissions on every request.
- **Tenant Scoping Mandatory**: Every database row, document, webhook, background task, and audit entry is bound to a verified `tenant_id`. Cross-tenant queries are blocked and tested via automated negative tests.
- **Integer Arithmetic for Money**: All financial calculations use `BigInt` integer cents to prevent floating-point rounding errors.
- **Controlled AI Autonomy**: The AI assistant operates strictly within user permissions and cannot approve its own proposals or execute irreversible state mutations without human confirmation.
- **Data Protection in Transit and at Rest**: TLS 1.3 encryption in transit; AES-256-CBC encryption for cloud backup archives; scrypt password hashing with high work factors.

---

## License

This project is proprietary commercial software. All rights reserved.
