feature: documents
stage: coding
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit, administration

# Feature #16 — Documents and Secure File Management (Coding)

## 1. Data Model & Migration
- Model: `Document` in `services/identity-service/prisma/schema.prisma`.
  - Fields: `id`, `tenantId`, `ownerService`, `ownerId`, `category`, `fileName`, `mimeType`, `fileSizeBytes`, `checksumSha256`, `storageKey`, `uploaderUserId`, `visibility`, `verificationStatus`, `verifiedBy`, `verifiedAt`, `verificationNotes`, `retentionClass`, `version`, `isArchived`, `createdAt`, `updatedAt`.
  - Applied via migration `20261110000000_document_management`.

## 2. Domain Services & Library Layer
- **`apps/web/src/features/documents/lib/document-service.ts`**:
  - `uploadDocument(tenantId, uploaderUserId, input)`:
    - Enforces 15MB file size limit.
    - Validates MIME type allowlist.
    - Computes SHA-256 integrity checksum.
    - Saves buffer to disk under partitioned storage key `${tenantId}/${docId}/${fileName}`.
    - Emits audit event `document.upload` (never logs binary content or sensitive URLs).
  - `getDocuments(tenantId, filter)` & `getDocumentStats(tenantId)`: Filtered listing and storage aggregation.
  - `generateDownloadToken(tenantId, documentId, expiresInMs)`: Creates HMAC-SHA256 signed token.
  - `verifyDownloadToken(tenantId, documentId, expiresStr, token)`: Validates HMAC signature with byte-length check and timing-safe comparison.
  - `readDocumentContent(tenantId, documentId)`: Reads file bytes from storage.
  - `verifyDocument(tenantId, documentId, auditorUserId, status, notes)`: Updates status with audit trail (`document.verify`).
  - `deleteDocument(tenantId, documentId, actorUserId)`: Soft-deletes document; enforces guard preventing deletion of documents under `legal_hold`.

## 3. API Route Handlers
- `apps/web/src/app/api/documents/route.ts` (GET)
- `apps/web/src/app/api/documents/upload/route.ts` (POST)
- `apps/web/src/app/api/documents/[id]/route.ts` (GET, DELETE)
- `apps/web/src/app/api/documents/[id]/signed-url/route.ts` (GET)
- `apps/web/src/app/api/documents/[id]/download/route.ts` (GET)
- `apps/web/src/app/api/documents/[id]/verify/route.ts` (POST)

## 4. UI Components & Pages
- `apps/web/src/features/documents/components/documents-page.tsx`: Client component with KPI cards, searchable table, upload modal, review modal.
- `apps/web/src/features/documents/index.ts`: Barrel export.
- `apps/web/src/app/dashboard/documents/page.tsx`: Route page.
- `apps/web/src/components/layout/nav-config.ts`: Added `/dashboard/documents` under Governance.
