import { NextRequest, NextResponse } from "next/server";
import { revokeSessionUseCase } from "@/lib/auth/use-cases/sessions";
import { getSessionToken } from "@/lib/auth/session-cookie";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const result = await revokeSessionUseCase(token, id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "Not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
