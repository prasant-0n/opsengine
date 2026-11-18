import { NextResponse } from "next/server";
import { getVapidKeys } from "@/features/pwa";

export const dynamic = "force-dynamic";

export async function GET() {
  const keys = getVapidKeys();
  return NextResponse.json({
    publicKey: keys.publicKey,
  });
}
