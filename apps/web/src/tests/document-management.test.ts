import { describe, it, expect } from "vitest";
import { prisma } from "../lib/prisma";
import {
  uploadDocument,
  getDocuments,
  getDocumentStats,
  getDocumentById,
  generateDownloadToken,
  verifyDownloadToken,
  readDocumentContent,
  verifyDocument,
  deleteDocument,
} from "../features/documents/lib/document-service";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";

describe("Module 14 — Documents and Secure File Management Engine", () => {
  it("uploads a document, computes SHA-256 checksum, stores metadata and writes audit log", async () => {
    const dummyContent = Buffer.from("Employment Agreement and NDA - Confidential");
    const doc = await uploadDocument(TENANT_A, USER_A, {
      fileName: "employment_contract.pdf",
      mimeType: "application/pdf",
      contentBuffer: dummyContent,
      category: "contract",
      ownerService: "hrms",
      visibility: "confidential",
      retentionClass: "standard",
    });

    expect(doc).toBeDefined();
    expect(doc.tenantId).toBe(TENANT_A);
    expect(doc.fileName).toBe("employment_contract.pdf");
    expect(doc.mimeType).toBe("application/pdf");
    expect(doc.fileSizeBytes).toBe(dummyContent.length);
    expect(doc.verificationStatus).toBe("pending");
    expect(doc.checksumSha256.length).toBe(64); // SHA-256 hex string

    // Verify stored content
    const { buffer } = await readDocumentContent(TENANT_A, doc.id);
    expect(buffer.toString()).toBe("Employment Agreement and NDA - Confidential");

    // Verify audit log
    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId: TENANT_A, eventType: "document.upload", resourceId: doc.id },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorUserId).toBe(USER_A);
    expect(audit?.decision).toBe("allow");
  });

  it("retrieves document listings and aggregates storage stats", async () => {
    const { documents, total } = await getDocuments(TENANT_A);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(documents.length).toBeGreaterThanOrEqual(1);
    expect(documents.every((d) => d.tenantId === TENANT_A)).toBe(true);

    const stats = await getDocumentStats(TENANT_A);
    expect(stats.totalDocs).toBeGreaterThanOrEqual(1);
    expect(stats.totalSizeBytes).toBeGreaterThan(0);
  });

  it("generates and verifies short-lived HMAC download tokens", () => {
    const docId = "00000000-0000-4000-8000-00000000d0c1";
    const { token, expires } = generateDownloadToken(TENANT_A, docId, 60_000);

    // Valid token
    const isValid = verifyDownloadToken(TENANT_A, docId, expires, token);
    expect(isValid).toBe(true);

    // Tampered token
    const isTampered = verifyDownloadToken(TENANT_A, docId, expires, "invalid-token-signature");
    expect(isTampered).toBe(false);

    // Expired token
    const isExpired = verifyDownloadToken(TENANT_A, docId, (Date.now() - 1000).toString(), token);
    expect(isExpired).toBe(false);
  });

  it("rejects uploads exceeding size limit or unsupported MIME types", async () => {
    // Unsupported MIME
    await expect(
      uploadDocument(TENANT_A, USER_A, {
        fileName: "malicious.exe",
        mimeType: "application/x-msdownload",
        contentBuffer: Buffer.from("bad-exe-content"),
      })
    ).rejects.toThrow("File type application/x-msdownload is not supported");

    // Size limit
    const oversizeBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
    await expect(
      uploadDocument(TENANT_A, USER_A, {
        fileName: "huge.pdf",
        mimeType: "application/pdf",
        contentBuffer: oversizeBuffer,
      })
    ).rejects.toThrow("File size exceeds 15MB limit");
  });

  it("verifies document status with audit notes", async () => {
    const doc = await uploadDocument(TENANT_A, USER_A, {
      fileName: "passport_scan.png",
      mimeType: "image/png",
      contentBuffer: Buffer.from("dummy-passport-image-bytes"),
      category: "identification",
    });

    const verified = await verifyDocument(TENANT_A, doc.id, USER_A, "verified", "Government ID authenticated");
    expect(verified.verificationStatus).toBe("verified");
    expect(verified.verifiedBy).toBe(USER_A);
    expect(verified.verificationNotes).toBe("Government ID authenticated");

    // Verify audit
    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId: TENANT_A, eventType: "document.verify", resourceId: doc.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeDefined();
    expect(audit?.reasonCode).toBe("DOC_VERIFIED");
  });

  it("enforces legal hold protection against document deletion", async () => {
    const doc = await uploadDocument(TENANT_A, USER_A, {
      fileName: "financial_audit_2026.pdf",
      mimeType: "application/pdf",
      contentBuffer: Buffer.from("financial ledger records"),
      category: "tax_form",
      retentionClass: "legal_hold",
    });

    // Attempt delete
    await expect(deleteDocument(TENANT_A, doc.id, USER_A)).rejects.toThrow(
      "Cannot delete document under active legal hold"
    );

    // Standard document can be deleted
    const normalDoc = await uploadDocument(TENANT_A, USER_A, {
      fileName: "temporary_scratch.txt",
      mimeType: "text/plain",
      contentBuffer: Buffer.from("scratchpad"),
      retentionClass: "standard",
    });
    const delRes = await deleteDocument(TENANT_A, normalDoc.id, USER_A);
    expect(delRes.success).toBe(true);

    const check = await prisma.document.findUnique({ where: { id: normalDoc.id } });
    expect(check?.isArchived).toBe(true);
  });

  it("cross-tenant negative test: Tenant B cannot query, download, or verify Tenant A documents", async () => {
    const docA = await uploadDocument(TENANT_A, USER_A, {
      fileName: "secret_plan_a.pdf",
      mimeType: "application/pdf",
      contentBuffer: Buffer.from("top secret plan for Acme"),
      category: "contract",
    });

    // Tenant B cannot get by ID
    await expect(getDocumentById(TENANT_B, docA.id)).rejects.toThrow("Document not found");

    // Tenant B cannot read content
    await expect(readDocumentContent(TENANT_B, docA.id)).rejects.toThrow("Document not found");

    // Tenant B cannot verify
    await expect(verifyDocument(TENANT_B, docA.id, USER_B, "verified")).rejects.toThrow("Document not found");

    // Tenant B cannot delete
    await expect(deleteDocument(TENANT_B, docA.id, USER_B)).rejects.toThrow("Document not found");

    // Tenant B listings do not include docA
    const { documents: docsB } = await getDocuments(TENANT_B);
    expect(docsB.some((d) => d.id === docA.id)).toBe(false);
  });
});
