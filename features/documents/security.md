feature: documents
stage: security
status: done
last-updated: 2026-11-09
depends-on: authz, hrms-core, reporting-audit, administration

# Feature #16 — Documents and Secure File Management (Security Analysis)

## 1. Multi-Tenant Scoping & Storage Partitioning
- **Storage Partitioning**: Files are written to partition directories strictly scoped by `${tenantId}/${docId}/${fileName}`.
- **Tenant Isolation**: Every database query and file read enforces `tenantId` filtering directly from the authenticated session context.
- **Cross-Tenant Negative Verification**: Unit test `cross-tenant negative test: Tenant B cannot query, download, or verify Tenant A documents` confirms 404 / zero data access across tenants.

## 2. Server-Side ReBAC Authorization
- All API routes enforce server-side authorization:
  - `PERMISSIONS.DOCUMENT_READ = "document.read"`
  - `PERMISSIONS.DOCUMENT_UPLOAD = "document.upload"`
  - `PERMISSIONS.DOCUMENT_VERIFY = "document.verify"`
  - `PERMISSIONS.DOCUMENT_DELETE = "document.delete"`
- Unauthenticated requests receive HTTP 401; unauthorized requests receive HTTP 403.

## 3. Short-Lived Expiring Signed Links
- File downloads require either an active authenticated session with `document.read` or a cryptographically signed HMAC-SHA256 download token expiring in 15 minutes.
- Timing-safe byte comparison prevents side-channel timing attacks.

## 4. Input Validation & Legal Hold Protection
- File size enforced to a maximum of 15MB.
- MIME types restricted to strict allowlist (PDF, Images, Text, CSV, Word, Excel).
- Documents flagged with `retentionClass: "legal_hold"` cannot be deleted, satisfying compliance and retention preservation rules.
- Plaintext binary contents and signed URLs are never logged to `audit_events`.
