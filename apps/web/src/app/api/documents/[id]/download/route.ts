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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tokenParam = searchParams.get("token");
  const expiresParam = searchParams.get("expires");

  let ctx: AuthorizationContext | null = null;

  // Resolve authorization context via session token or verified HMAC download token
  const sessionToken = await getSessionToken();
  if (sessionToken) {
    ctx = await buildAuthContext(sessionToken);
  } else if (tokenParam && expiresParam) {
    const { prisma } = await import("@/lib/prisma");
    const docMeta = await prisma.document.findUnique({ where: { id } });
    if (docMeta && verifyDownloadToken(docMeta.tenantId, id, expiresParam, tokenParam)) {
      ctx = buildTokenAuthContext(docMeta.tenantId);
    }
  }

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
