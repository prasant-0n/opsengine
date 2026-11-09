feature: reporting-audit
stage: bugs
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, crm-core, project-workforce, finance, leave-attendance

# Feature #14 — Executive Reporting, Analytics & Audit Log Viewer (Bugs & Fixes)

## 1. Prisma Column Name Discrepancies
- **Bug**: Initial query in `reporting-service.ts` attempted to select `valueCents` on `CrmOpportunity` and `totalAmountCents` on `Invoice`, throwing `PrismaClientValidationError`.
- **Fix**: Inspected `prisma/schema.prisma` and corrected field names to `amountCents` on `CrmOpportunity` and `totalCents` on `Invoice`. Handled BigInt conversions cleanly to avoid JSON serialization exceptions.

## 2. Catch-All Route Placeholder Collision
- **Bug**: The catch-all `apps/web/src/app/dashboard/[section]/page.tsx` intercepted requests to `/dashboard/reports` and rendered the generic `PlaceholderPage`.
- **Fix**: Created dedicated route file `apps/web/src/app/dashboard/reports/page.tsx` rendering `<ReportsPage />` and removed `reports` from the `PLACEHOLDERS` dictionary in the catch-all page.
