feature: documents
stage: designing
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit, administration

# Feature #16 — Documents and Secure File Management (Design)

## 1. UI Screens Delivered
- **`/dashboard/documents`**:
  - Dedicated document management and compliance verification console.
  - **KPI Metrics Cards**:
    - Total Documents stored.
    - Storage Used (formatted in KB / MB).
    - Pending Verification count (compliance backlog).
    - Legal Hold count (documents locked against deletion).
  - **Filter & Search Bar**:
    - Search by file name or category.
    - Category filter: Contracts, Resumes, Identification, Tax Forms, Policies, Invoice Attachments, General.
    - Verification status filter: All, Verified, Pending, Rejected.
  - **Document Data Table**:
    - File icon by MIME type (PDF, Image, Spreadsheet, Generic).
    - File name and truncated SHA-256 integrity hash.
    - Category and owning service badge.
    - Size and uploader email with upload date.
    - Verification status badge (`verified`, `pending`, `rejected`).
    - Retention status badge (`legal_hold` with lock icon).
    - Actions:
      - **Download**: calls `/api/documents/[id]/signed-url` and streams file via short-lived HMAC token.
      - **Verify / Review**: opens compliance sign-off modal dialog.
      - **Delete**: archives document (blocked if under active legal hold).
  - **Modals**:
    - **Upload Document Dialog**: File picker (max 15MB), category selector, owner service selector, visibility scope (`internal`, `confidential`, `private`), and retention policy (`standard`, `legal_hold`, `indefinite`).
    - **Document Verification Dialog**: Document summary with SHA-256 hash, Approve vs Reject radio options, and auditor review notes input.

## 2. API Contracts
- `GET /api/documents`: List documents with filters and tenant storage statistics.
- `POST /api/documents/upload`: Multipart upload with size/type validation, SHA-256 calculation, and disk storage.
- `GET /api/documents/[id]`: Retrieve single document metadata.
- `GET /api/documents/[id]/signed-url`: Generate short-lived HMAC download URL.
- `GET /api/documents/[id]/download`: Stream document bytes after validating session or HMAC token.
- `POST /api/documents/[id]/verify`: Verify or reject a document with auditor notes.
- `DELETE /api/documents/[id]`: Archive document (guarded against legal hold deletion).
