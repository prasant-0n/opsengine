import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext, authorize } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDocuments, getDocumentStats } from "@/features/documents/lib/document-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const authz = authorize(ctx, PERMISSIONS.DOCUMENT_READ, { tenantId: ctx.tenantId });
  if (!authz.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const ownerService = searchParams.get("ownerService") || undefined;
  const verificationStatus = searchParams.get("verificationStatus") || undefined;
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    const [data, stats] = await Promise.all([
      getDocuments(ctx.tenantId, { category, ownerService, verificationStatus, limit, offset }),
      getDocumentStats(ctx.tenantId),
    ]);

    return NextResponse.json({ ...data, stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch documents" }, { status: 500 });
  }
}
