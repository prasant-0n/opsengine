import { NextResponse } from "next/server";
import { logoutUseCase } from "@/lib/auth/use-cases/sessions";
import { getSessionToken, clearSessionCookie } from "@/lib/auth/session-cookie";

export async function POST() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    await logoutUseCase(token);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const res = NextResponse.json({ revoked: true });
  clearSessionCookie(res.headers);
  return res;
}
