import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDocumentById, generateDownloadToken } from "@/features/documents/lib/document-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.DOCUMENT_READ, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const doc = await getDocumentById(ctx.tenantId, id);
    const { token: downloadToken, expires } = generateDownloadToken(ctx.tenantId, doc.id);
    const downloadUrl = `/api/documents/${doc.id}/download?token=${downloadToken}&expires=${expires}`;

    return NextResponse.json({
      downloadUrl,
      expiresAt: new Date(parseInt(expires, 10)).toISOString(),
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to generate download URL" }, { status: 404 });
  }
}
