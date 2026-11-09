feature: documents
stage: planning
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit, administration

# Feature #16 — Documents and Secure File Management (PRD Module 14)

## 1. Scope & Requirements
- **Centralized Document Metadata Service**:
  - Metadata record per document: `id`, `tenantId`, `ownerService` (`recruitment`, `hrms`, `finance`, `compliance`, `project`, `general`), `ownerId`, `category` (`resume`, `contract`, `identification`, `tax_form`, `invoice_attachment`, `policy`, `report`), `fileName`, `mimeType`, `fileSizeBytes`, `checksumSha256`, `storageKey`, `uploaderUserId`, `visibility` (`private`, `internal`, `confidential`), `verificationStatus` (`pending`, `verified`, `rejected`, `quarantined`), `retentionClass` (`standard`, `legal_hold`, `indefinite`), `version`.
- **Secure File Storage & Access**:
  - Storage abstraction (Local file disk storage / S3 compatible) using partition keys (`${tenantId}/${documentId}/${fileName}`).
  - Never make candidate, employee, or financial documents public.
  - Short-lived signed download tokens (`/api/documents/[id]/download?token=...` or signed URL expiring in 15 minutes).
  - Validation: file type allowlist, max size check (15MB limit), SHA-256 checksum calculation.
  - Document verification workflow: HR or Compliance officers can verify or reject uploaded documents (`hr.employee_document.verify`, `document.verify`).
  - Legal Hold / Retention management.
- **Audit Logging**:
  - Emits immutable audit events on: `document.upload`, `document.download`, `document.verify`, `document.delete`.
  - Never log document contents or signed URLs in plaintext audit logs.
- **Multi-Tenant Scoping**:
  - All documents strictly scoped to `tenantId`. Cross-tenant negative tests verify that Tenant B cannot read, download, verify, or delete Tenant A documents.

## 2. Permissions & ReBAC Rules
- `PERMISSIONS.DOCUMENT_READ = "document.read"`
- `PERMISSIONS.DOCUMENT_UPLOAD = "document.upload"`
- `PERMISSIONS.DOCUMENT_VERIFY = "document.verify"`
- `PERMISSIONS.DOCUMENT_DELETE = "document.delete"`
- `PERMISSIONS.HR_EMPLOYEE_DOCUMENT_VERIFY = "hr.employee_document.verify"`

## 3. API Surface
- `GET /api/documents` — List documents for the tenant with optional filters (`category`, `ownerService`, `verificationStatus`).
- `POST /api/documents/upload` — Upload a new document (multipart form data with validation, checksum computation, and storage persistence).
- `GET /api/documents/[id]` — Retrieve document metadata.
- `GET /api/documents/[id]/signed-url` — Generate a short-lived expiring download URL after ReBAC check.
- `GET /api/documents/[id]/download` — Stream document bytes if token/session is valid.
- `POST /api/documents/[id]/verify` — Verify or reject a document with mandatory notes.
- `DELETE /api/documents/[id]` — Archive / delete a document with audit log.

## 4. UI Surface
- `/dashboard/documents`: Dedicated document management console.
  - Header: KPI scorecards (Total Documents, Storage Used, Pending Verification, Legal Holds).
  - Filters: Category, Status, text search.
  - Action: "+ Upload Document" modal dialog with file input, category, visibility, retention.
  - Action: "Verify / Review Document" dialog for compliance sign-off.
  - Table: Document list with badges and download triggers.

## 5. Test Plan
- Unit tests in `apps/web/src/tests/document-management.test.ts`:
  1. Upload document: stores file, computes SHA-256 checksum, sets status `pending`, emits audit event.
  2. Generates short-lived signed download token and downloads file content securely.
  3. Rejects file upload exceeding maximum allowed size or with disallowed MIME types.
  4. Verifies document: transitions status to `verified`, logs auditor ID and notes, emits audit event.
  5. Deletes / archives document with audit logging.
  6. Cross-tenant negative isolation test: Tenant B cannot query, download, or verify Tenant A documents.
