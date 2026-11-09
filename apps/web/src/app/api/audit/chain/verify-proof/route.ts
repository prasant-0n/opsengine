import { NextRequest, NextResponse } from "next/server";
import { AuditChainService } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const proof = body.proof;

    if (!proof) {
      return NextResponse.json(
        { error: "proof object is required in request body" },
        { status: 400 }
      );
    }

    const signingKey = body.signingKey || undefined;
    const verification = AuditChainService.verifyProof(proof, signingKey);

    return NextResponse.json({
      success: true,
      ...verification,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to verify audit proof", details: err?.message },
      { status: 500 }
    );
  }
}
