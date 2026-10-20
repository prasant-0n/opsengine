import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionToken } from "@/lib/auth/session-cookie";
import { buildAuthContext } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await buildAuthContext(token);
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prisma.authUser.findFirst({ where: { id: ctx.userId } });
  if (!user || !user.isRootAdmin) {
    return NextResponse.json({ error: "Operator privilege required" }, { status: 403 });
  }

  const { tenantId } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const aiEnabled = !!body.aiEnabled;

  const updated = await prisma.tenantWorkspace.updateMany({
    where: { tenantId },
    data: { aiEnabled },
  });

  return NextResponse.json({ success: true, count: updated.count, aiEnabled });
}
