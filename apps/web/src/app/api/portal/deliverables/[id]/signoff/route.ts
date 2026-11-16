import { NextRequest, NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/auth/portal-auth";
import { prisma } from "@/lib/prisma";
import { generateDeliverableSignatureHash } from "@/features/portal/lib/portal-sla";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolvePortalSession(req);
  if (!auth.success) return auth.response;

  const { id } = await params;
  const { tenantId, accountId, contactId, contactName, contactEmail } = auth.ctx;

  // Authoritative IDOR check: deliverable must belong to this account and tenant
  const deliverable = await prisma.clientDeliverable.findFirst({
    where: { id, tenantId, accountId },
  });

  if (!deliverable) {
    return NextResponse.json(
      { error: "Deliverable not found or access denied" },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const status = (body.status ?? "").trim();
    const signerName = (body.signerName ?? contactName).trim();
    const signerEmail = (body.signerEmail ?? contactEmail).trim();
    const feedbackNotes = (body.feedbackNotes ?? "").trim();

    if (status !== "approved" && status !== "changes_requested") {
      return NextResponse.json(
        { error: "Invalid status. Allowed: 'approved' or 'changes_requested'" },
        { status: 400 }
      );
    }

    if (!signerName || !signerEmail) {
      return NextResponse.json(
        { error: "signerName and signerEmail are required for formal sign-off" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const signatureHash = generateDeliverableSignatureHash({
      deliverableId: deliverable.id,
      accountId,
      signerEmail,
      status,
      timestamp,
    });

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Create sign-off audit record and update deliverable status in transaction
    const [signOff, updatedDeliverable] = await prisma.$transaction([
      prisma.clientDeliverableSignOff.create({
        data: {
          tenantId,
          deliverableId: deliverable.id,
          accountId,
          contactId,
          signerName,
          signerEmail,
          status,
          signatureHash,
          feedbackNotes: feedbackNotes || null,
          ipAddress,
          userAgent,
        },
      }),
      prisma.clientDeliverable.update({
        where: { id: deliverable.id },
        data: {
          status,
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        signOff,
        deliverable: updatedDeliverable,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit deliverable sign-off" },
      { status: 400 }
    );
  }
}
