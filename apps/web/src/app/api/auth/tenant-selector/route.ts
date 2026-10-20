import { NextRequest, NextResponse } from "next/server";
import { tenantSelectorUseCase, rateLimit, clientIp } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!rateLimit(`tenant-selector:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  try {
    const body = await req.json();
    const { identifier } = body;
    if (typeof identifier !== "string" || identifier.length === 0 || identifier.length > 254) {
      return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
    }
    const result = await tenantSelectorUseCase({ identifier });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 400 });
  }
}
