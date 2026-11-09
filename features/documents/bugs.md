feature: documents
stage: bugs
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit, administration

# Feature #16 — Documents and Secure File Management (Bugs & Fixes)

## 1. Missing Prisma Column Mapping on `verificationStatus`
- **Bug**: In `services/identity-service/prisma/schema.prisma`, `verificationStatus` was declared without `@map("verification_status")`, causing PostgreSQL queries to fail with `The column verificationStatus does not exist`.
- **Fix**: Added `@map("verification_status")` to `Document` model in `schema.prisma` and regenerated the Prisma client.

## 2. `crypto.timingSafeEqual` Buffer Length Mismatch
- **Bug**: Calling `crypto.timingSafeEqual` with unequal buffer lengths throws `RangeError: Input buffers must have the same byte length`.
- **Fix**: In `verifyDownloadToken`, checked `tokenBuf.length !== expectedBuf.length` and returned `false` before invoking `timingSafeEqual`.

## 3. Stale Prisma Client in Background Dev Server
- **Bug**: Next.js background process retained previous Prisma client memory before migration `20261110000000_document_management`.
- **Fix**: Restarted dev server process on port 3001 (`task-1034`), which loaded the newly generated Prisma Client.
