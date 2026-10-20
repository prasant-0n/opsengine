import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordUseCase, rateLimit, clientIp } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!rateLimit(`forgot-password:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  try {
    const body = await req.json();
    const { emailOrUsername, purpose } = body;
    if (typeof emailOrUsername !== "string" || emailOrUsername.length === 0 || emailOrUsername.length > 254) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const safePurpose = purpose === "email_verification" ? purpose : "password_reset";
    const result = await forgotPasswordUseCase({ emailOrUsername, purpose: safePurpose });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to send code" }, { status: 400 });
  }
}
