import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuditInput {
  tenantId: string;
  actorUserId?: string | null;
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  decision?: "allow" | "deny" | null;
  reasonCode?: string | null;
  policyVersion?: number | null;
  metadata?: Record<string, unknown> | null;
}

// Fire-and-forget audit write; never throws into the request path.
// Never log sensitive attributes (PRD §3.4.6).
export function writeAudit(input: AuditInput): void {
  writeAuditAsync(input).catch(() => {
    // audit failure must not break the request; ops monitoring catches this
  });
}

export async function writeAuditAsync(input: AuditInput): Promise<any> {
  return prisma.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      decision: input.decision ?? null,
      reasonCode: input.reasonCode ?? null,
      policyVersion: input.policyVersion ?? null,
      metadata: (input.metadata ?? undefined) as any,
    },
  });
}
