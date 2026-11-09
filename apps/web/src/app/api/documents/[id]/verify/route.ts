import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { verifyDocument } from "@/features/documents/lib/document-service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.DOCUMENT_VERIFY, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { status, notes } = body;
    if (status !== "verified" && status !== "rejected") {
      return NextResponse.json({ error: "Status must be 'verified' or 'rejected'" }, { status: 400 });
    }

    const updated = await verifyDocument(ctx.tenantId, id, ctx.userId, status, notes);
    return NextResponse.json({ document: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to verify document" }, { status: 400 });
  }
}
