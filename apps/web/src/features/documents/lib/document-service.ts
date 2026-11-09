import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { writeAuditAsync } from "@/lib/permissions/audit";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const TOKEN_SECRET = process.env.SESSION_SECRET || "opsengine-secure-download-token-secret-2026";
const STORAGE_ROOT = process.env.DOCUMENTS_STORAGE_DIR || path.join(process.cwd(), "storage/documents");

export interface DocumentFilter {
  category?: string;
  ownerService?: string;
  verificationStatus?: string;
  limit?: number;
  offset?: number;
}

export interface UploadDocumentInput {
  fileName: string;
  mimeType: string;
  contentBuffer: Buffer;
  ownerService?: string;
  ownerId?: string | null;
  category?: string;
  visibility?: string;
  retentionClass?: string;
}

export async function getDocumentStats(tenantId: string) {
  const [totalDocs, pendingVerification, legalHoldCount, sizeAgg] = await Promise.all([
    prisma.document.count({ where: { tenantId, isArchived: false } }),
    prisma.document.count({
      where: { tenantId, verificationStatus: "pending", isArchived: false },
    }),
    prisma.document.count({
      where: { tenantId, retentionClass: "legal_hold", isArchived: false },
    }),
    prisma.document.aggregate({
      where: { tenantId, isArchived: false },
      _sum: { fileSizeBytes: true },
    }),
  ]);

  return {
    totalDocs,
    pendingVerification,
    legalHoldCount,
    totalSizeBytes: sizeAgg._sum.fileSizeBytes || 0,
  };
}

export async function getDocuments(tenantId: string, filter: DocumentFilter = {}) {
  const { category, ownerService, verificationStatus, limit = 50, offset = 0 } = filter;

  const where: any = { tenantId, isArchived: false };
  if (category) where.category = category;
  if (ownerService) where.ownerService = ownerService;
  if (verificationStatus) where.verificationStatus = verificationStatus;

  const [total, docs] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
    }),
  ]);

  // Enrich with uploader user email
  const userIds = Array.from(new Set(docs.map((d) => d.uploaderUserId)));
  const users = await prisma.authUser.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  const enriched = docs.map((d) => ({
    ...d,
    uploaderEmail: userMap.get(d.uploaderUserId) || "unknown",
  }));

  return { total, documents: enriched, limit, offset };
}

export async function getDocumentById(tenantId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, tenantId, isArchived: false },
  });
  if (!doc) throw new Error("Document not found");
  return doc;
}

export async function uploadDocument(
  tenantId: string,
  uploaderUserId: string,
  input: UploadDocumentInput
) {
  const {
    fileName,
    mimeType,
    contentBuffer,
    ownerService = "general",
    ownerId = null,
    category = "general",
    visibility = "internal",
    retentionClass = "standard",
  } = input;

  // 1. Size check
  if (contentBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds 15MB limit (${(contentBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
  }

  // 2. MIME check
  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error(`File type ${mimeType} is not supported. Allowed: PDF, Images, Text, CSV, Word, Excel.`);
  }

  // 3. Compute SHA-256
  const checksumSha256 = crypto.createHash("sha256").update(contentBuffer).digest("hex");

  // 4. Sanitized file name & storage path
  const sanitized = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const docId = crypto.randomUUID();
  const storageKey = `${tenantId}/${docId}/${sanitized}`;
  const fullDiskPath = path.join(STORAGE_ROOT, storageKey);

  // Ensure parent directory
  await fs.mkdir(path.dirname(fullDiskPath), { recursive: true });
  await fs.writeFile(fullDiskPath, contentBuffer);

  // 5. DB insert
  const doc = await prisma.document.create({
    data: {
      id: docId,
      tenantId,
      ownerService,
      ownerId: ownerId || null,
      category,
      fileName: sanitized,
      mimeType,
      fileSizeBytes: contentBuffer.length,
      checksumSha256,
      storageKey,
      uploaderUserId,
      visibility,
      retentionClass,
      verificationStatus: "pending",
    },
  });

  // 6. Audit log (never log content or paths)
  await writeAuditAsync({
    tenantId,
    actorUserId: uploaderUserId,
    eventType: "document.upload",
    resourceType: "document",
    resourceId: doc.id,
    decision: "allow",
    reasonCode: "DOCUMENT_UPLOADED",
    metadata: {
      category: doc.category,
      ownerService: doc.ownerService,
      fileSizeBytes: doc.fileSizeBytes,
      mimeType: doc.mimeType,
      checksumSha256: doc.checksumSha256,
    },
  });

  return doc;
}

export function generateDownloadToken(tenantId: string, documentId: string, expiresInMs = 15 * 60 * 1000) {
  const expires = Date.now() + expiresInMs;
  const data = `${tenantId}:${documentId}:${expires}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("hex");
  return { token: sig, expires: expires.toString() };
}

export function verifyDownloadToken(tenantId: string, documentId: string, expiresStr: string, token: string): boolean {
  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires) || Date.now() > expires) {
    return false;
  }
  const data = `${tenantId}:${documentId}:${expires}`;
  const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("hex");
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedSig);
  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

export async function readDocumentContent(tenantId: string, documentId: string): Promise<{ buffer: Buffer; doc: any }> {
  const doc = await getDocumentById(tenantId, documentId);
  const fullDiskPath = path.join(STORAGE_ROOT, doc.storageKey);
  const buffer = await fs.readFile(fullDiskPath);
  return { buffer, doc };
}

export async function verifyDocument(
  tenantId: string,
  documentId: string,
  auditorUserId: string,
  status: "verified" | "rejected",
  notes?: string
) {
  const doc = await getDocumentById(tenantId, documentId);

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: {
      verificationStatus: status,
      verifiedBy: auditorUserId,
      verifiedAt: new Date(),
      verificationNotes: notes || null,
    },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId: auditorUserId,
    eventType: "document.verify",
    resourceType: "document",
    resourceId: doc.id,
    decision: "allow",
    reasonCode: status === "verified" ? "DOC_VERIFIED" : "DOC_REJECTED",
    metadata: { previousStatus: doc.verificationStatus, newStatus: status, notes },
  });

  return updated;
}

export async function deleteDocument(tenantId: string, documentId: string, actorUserId: string) {
  const doc = await getDocumentById(tenantId, documentId);

  if (doc.retentionClass === "legal_hold") {
    throw new Error("Cannot delete document under active legal hold");
  }

  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { isArchived: true },
  });

  await writeAuditAsync({
    tenantId,
    actorUserId,
    eventType: "document.delete",
    resourceType: "document",
    resourceId: doc.id,
    decision: "allow",
    reasonCode: "DOCUMENT_ARCHIVED",
    metadata: { fileName: doc.fileName, category: doc.category },
  });

  return { success: true, archivedId: doc.id };
}
