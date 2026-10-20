import { NextRequest, NextResponse } from "next/server";
import { loginUseCase, rateLimit, clientIp } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth/session-cookie";

export async function POST(req: NextRequest) {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  try {
    const body = await req.json();
    const { domain, email, password, rememberMe } = body;
    if (typeof domain !== "string" || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const result = await loginUseCase({ domain, email, password, rememberMe });
    const res = NextResponse.json({
      tenantId: result.tenantId,
      userId: result.userId,
      role: result.role,
      expiresAt: result.expiresAt,
    });
    setSessionCookie(res.headers, result.sessionToken, new Date(result.expiresAt));
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}
