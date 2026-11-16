import crypto from "crypto";

export const PORTAL_TICKET_TYPES = ["bug", "service_request", "question", "incident"] as const;
export type PortalTicketType = (typeof PORTAL_TICKET_TYPES)[number];

export const PORTAL_TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type PortalTicketPriority = (typeof PORTAL_TICKET_PRIORITIES)[number];

export const SLA_TARGETS = {
  urgent: { responseHours: 1, resolutionHours: 4 },
  high: { responseHours: 4, resolutionHours: 12 },
  medium: { responseHours: 8, resolutionHours: 24 },
  low: { responseHours: 24, resolutionHours: 72 },
} as const;

export function isValidPortalTicketType(type: string): type is PortalTicketType {
  return (PORTAL_TICKET_TYPES as readonly string[]).includes(type);
}

export function isValidPortalTicketPriority(priority: string): priority is PortalTicketPriority {
  return (PORTAL_TICKET_PRIORITIES as readonly string[]).includes(priority);
}

/**
 * Calculates SLA due timestamp based on ticket priority
 */
export function calculateSlaTarget(
  priority: string,
  baseDate: Date = new Date(),
  type: "response" | "resolution" = "resolution"
): Date {
  const p = (isValidPortalTicketPriority(priority) ? priority : "medium") as PortalTicketPriority;
  const targetConfig = SLA_TARGETS[p];
  const hours = type === "response" ? targetConfig.responseHours : targetConfig.resolutionHours;
  
  const due = new Date(baseDate.getTime());
  due.setHours(due.getHours() + hours);
  return due;
}

/**
 * Evaluates SLA adherence given a target deadline and current or resolved time
 */
export function getSlaStatus(
  slaDueAt: Date | string | null | undefined,
  resolvedAt?: Date | string | null | undefined
): { isBreached: boolean; hoursRemaining: number; label: string } {
  if (!slaDueAt) {
    return { isBreached: false, hoursRemaining: 999, label: "No SLA" };
  }

  const due = new Date(slaDueAt).getTime();
  const evaluationTime = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const diffMs = due - evaluationTime;
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    return {
      isBreached: true,
      hoursRemaining: 0,
      label: `Breached by ${Math.abs(diffHours)}h`,
    };
  }

  return {
    isBreached: false,
    hoursRemaining: diffHours,
    label: `${diffHours}h remaining`,
  };
}

/**
 * Anti-Leakage Server-Side Filter:
 * Strictly purges any comment marked isInternal: true from customer-facing views.
 */
export function sanitizeTicketComments<T extends { isInternal?: boolean }>(
  comments: T[]
): T[] {
  return comments.filter((c) => !c.isInternal);
}

/**
 * Generates cryptographic SHA-256 signature hash for client formal sign-offs
 */
export function generateDeliverableSignatureHash(params: {
  deliverableId: string;
  accountId: string;
  signerEmail: string;
  status: string;
  timestamp: string;
}): string {
  const payload = [
    params.deliverableId,
    params.accountId,
    params.signerEmail.toLowerCase().trim(),
    params.status,
    params.timestamp,
  ].join("|");

  return crypto.createHash("sha256").update(payload).digest("hex");
}
