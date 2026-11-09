import { NextResponse } from "next/server";
import { generateOpenApiSpec } from "@opsengine/api-contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  const spec = generateOpenApiSpec();
  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
