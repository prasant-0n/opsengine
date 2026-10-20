# Enterprise Operations Platform (SaaS CRM + HRMS + Workforce)

Commercial-grade multi-tenant SaaS business operating system built with Next.js 16 App Router, React 19, Prisma, and PostgreSQL.

## Architecture & Features
- **Tenant Isolation & Auth:** Secure multi-tenant workspace isolation, password hashing (scrypt), OTP verification, and session management.
- **ReBAC Authorization:** Role-based and scope-aware permission engine (`authorize()`, context caching, tenant/team/reporting-tree/self scoping).
- **HRMS Core:** Employee directory, team memberships, and reporting lines.
- **ATS Recruitment:** Requisitions, candidate pipeline, interviews, and feedback.
- **CRM Core:** Accounts, contacts, leads, and sales opportunities.
- **Project Workforce:** Projects, milestones, ticketing, and resource allocation.
- **Time & Activity:** Daily plans, activity reports, timesheets, team reviews, and attendance.
- **Approval Workflows:** Configurable rule definitions, step routing, delegations, and Segregation of Duties (SoD).
- **Finance Operations:** Invoices, line items, receivables, payments, adjustments, and BigInt integer-cent money handling.
- **Recruitment Tail & Onboarding:** Offer templates, offers, onboarding checklist plans, induction events, probation reviews, and idempotent employee conversion.
- **Controlled AI Assistant:** Secure server-side Google Gemini (`gemini-3.8-flash`) integration with operator-gated tenant enablement and authorized domain context.
- **Notification System:** In-app notification center, unread badges, and optional AWS SES outbound email dispatch.

## Getting Started
1. Install dependencies: `pnpm install`
2. Configure environment: Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Run migrations & seed: `npx prisma migrate deploy && node apps/web/scripts/seed.mjs`
4. Start development server: `pnpm dev`
