import { NextResponse } from "next/server";
import { listSessionsUseCase } from "@/lib/auth/use-cases/sessions";
import { getSessionToken } from "@/lib/auth/session-cookie";

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const result = await listSessionsUseCase(token);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
