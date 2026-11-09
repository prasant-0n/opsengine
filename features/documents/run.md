feature: documents
stage: running
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit, administration

# Feature #16 — Documents and Secure File Management (Run & Verification)

## 1. Test Suite Verification
- Vitest command: `npx vitest run` in `apps/web`.
- Result: **19 passed files (19), 180 passed tests (180)**.
- New test file: `apps/web/src/tests/document-management.test.ts` (7 tests passing):
  - Uploads document, computes SHA-256 checksum, stores metadata and writes audit log.
  - Retrieves document listings and aggregates storage stats.
  - Generates and verifies short-lived HMAC download tokens.
  - Rejects uploads exceeding size limit or unsupported MIME types.
  - Verifies document status with audit notes.
  - Enforces legal hold protection against document deletion.
  - Cross-tenant negative isolation test: Tenant B cannot query, download, or verify Tenant A documents.

## 2. TypeScript Compilation Gate
- Command: `npx tsc --noEmit` in `apps/web`.
- Result: **0 errors**, clean compilation.

## 3. Live Server End-to-End Verification
- **Dev Server**: Running on `http://localhost:3001`.
- **Authentication**: Logged in as `admin@acme.opsengine.enterprise`.
- **Documents API**: `GET /api/documents` -> HTTP 200 (returned 8 documents, 234 bytes, 6 pending, 2 legal holds).
- **UI Route**: `GET /dashboard/documents` -> HTTP 200 OK.
