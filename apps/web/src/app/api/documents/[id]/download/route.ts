import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { writeAuditAsync } from "@/lib/permissions/audit";
import {
  getDocumentById,
  readDocumentContent,
  verifyDownloadToken,
} from "@/features/documents/lib/document-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tokenParam = searchParams.get("token");
  const expiresParam = searchParams.get("expires");

  let tenantId: string | null = null;
  let actorUserId: string | null = null;

  // Check 1: Session Cookie
  const sessionToken = await getSessionToken();
  if (sessionToken) {
    const ctx = await buildAuthContext(sessionToken);
    if (ctx) {
      const authz = authorize(ctx, PERMISSIONS.DOCUMENT_READ, { tenantId: ctx.tenantId });
      if (authz.allowed) {
        tenantId = ctx.tenantId;
        actorUserId = ctx.userId;
      }
    }
  }

  // Check 2: Signed Download Token fallback if not authenticated by cookie
  if (!tenantId && tokenParam && expiresParam) {
    const { prisma } = await import("@/lib/prisma");
    const docMeta = await prisma.document.findUnique({ where: { id } });

    if (docMeta) {
      const isValid = verifyDownloadToken(docMeta.tenantId, id, expiresParam, tokenParam);
      if (isValid) {
        tenantId = docMeta.tenantId;
        actorUserId = "signed_token_bearer";
      }
    }
  }

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized access to document" }, { status: 401 });
  }

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
