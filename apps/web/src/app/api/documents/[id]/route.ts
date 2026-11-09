import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDocumentById, deleteDocument } from "@/features/documents/lib/document-service";

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
    const document = await getDocumentById(ctx.tenantId, id);
    return NextResponse.json({ document });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch document" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.DOCUMENT_DELETE, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await deleteDocument(ctx.tenantId, id, ctx.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to delete document" }, { status: 400 });
  }
}
