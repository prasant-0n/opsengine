import { NextRequest, NextResponse } from "next/server";
import { verifyOtpUseCase, rateLimit, clientIp } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!rateLimit(`verify-otp:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  try {
    const body = await req.json();
    const { challengeId, code, purpose } = body;
    if (typeof challengeId !== "string" || typeof code !== "string") {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }
    const safePurpose = purpose === "email_verification" ? purpose : "password_reset";
    const result = await verifyOtpUseCase({ challengeId, code, purpose: safePurpose });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }
}
