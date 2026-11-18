import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize, type AuthorizationContext } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { writeAuditAsync } from "@/lib/permissions/audit";
import {
  readDocumentContent,
  verifyDownloadToken,
} from "@/features/documents/lib/document-service";

export const dynamic = "force-dynamic";

function buildTokenAuthContext(tenantId: string): AuthorizationContext {
  return {
    tenantId,
    userId: "signed_token_bearer",
    employeeId: null,
    membershipStatus: "active",
    assurance: { mfa: true },
    permissions: [
      { key: PERMISSIONS.DOCUMENT_READ, scopeType: "TENANT", scopeId: tenantId, validTo: null },
    ],
    roles: [],
    teamMemberships: [],
    reporting: { managerIds: [], reportIds: [] },
    accessGroupIds: [],
    policyVersion: 1,
    builtAt: Date.now(),
  };
}

async function resolveDownloadContext(
  req: NextRequest,
  documentId: string
): Promise<AuthorizationContext | null> {
  // Strategy 1: Active user session
  const sessionToken = await getSessionToken();
  if (sessionToken) {
    return await buildAuthContext(sessionToken);
  }

  // Strategy 2: Cryptographically verified download link
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const expires = searchParams.get("expires");

  if (!token || !expires) {
    return null;
  }

  const { prisma } = await import("@/lib/prisma");
  const docMeta = await prisma.document.findUnique({
    where: { id: documentId },
    select: { tenantId: true },
  });
  if (!docMeta) {
    return null;
  }

  const isVerified = verifyDownloadToken(docMeta.tenantId, documentId, expires, token);
  if (!isVerified) {
    return null;
  }

  return buildTokenAuthContext(docMeta.tenantId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await resolveDownloadContext(req, id);

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized access to document" }, { status: 401 });
  }

  const authz = authorize(ctx, PERMISSIONS.DOCUMENT_READ, { tenantId: ctx.tenantId });
  if (!authz.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = ctx.tenantId;
  const actorUserId = ctx.userId;

  try {
    const { buffer, doc } = await readDocumentContent(tenantId, id);

    // Audit log download event (no content logged)
    writeAuditAsync({
      tenantId,
      actorUserId,
      eventType: "document.download",
      resourceType: "document",
      resourceId: doc.id,
      decision: "allow",
      reasonCode: "DOWNLOAD_SERVED",
      metadata: { fileName: doc.fileName, fileSizeBytes: doc.fileSizeBytes },
    }).catch(() => {});

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to stream document" }, { status: 404 });
  }
}
