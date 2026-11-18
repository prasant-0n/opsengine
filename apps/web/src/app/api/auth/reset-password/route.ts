import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/auth";
import { resetPasswordUseCase } from "@/lib/auth/use-cases/sessions";
import { invalidateAuthContext } from "@/lib/permissions/context";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  if (!rateLimit(`reset-password:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  }
  try {
    const body = await req.json();
    const { resetToken, newPassword } = body;
    if (typeof resetToken !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    // Look up tenant before reset for cache invalidation
    const tokenRow = await prisma.resetToken.findFirst({
      where: { token: resetToken, usedAt: null },
    });
    const result = await resetPasswordUseCase({ resetToken, newPassword });
    if (tokenRow) {
      invalidateAuthContext(tokenRow.tenantId, tokenRow.userId);
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "Invalid request") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Invalid or expired reset token" },
      { status: 400 },
    );
  }
}
