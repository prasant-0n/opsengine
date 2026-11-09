import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { uploadDocument } from "@/features/documents/lib/document-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.DOCUMENT_UPLOAD, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded in form data" }, { status: 400 });
    }

    const category = (formData.get("category") as string) || "general";
    const ownerService = (formData.get("ownerService") as string) || "general";
    const ownerId = (formData.get("ownerId") as string) || null;
    const visibility = (formData.get("visibility") as string) || "internal";
    const retentionClass = (formData.get("retentionClass") as string) || "standard";

    const contentBuffer = Buffer.from(await file.arrayBuffer());

    const doc = await uploadDocument(ctx.tenantId, ctx.userId, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      contentBuffer,
      category,
      ownerService,
      ownerId,
      visibility,
      retentionClass,
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to upload document" }, { status: 400 });
  }
}
