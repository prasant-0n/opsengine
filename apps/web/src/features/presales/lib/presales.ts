// Feature #10 — Presales & Proposal Estimation (PRD Module 10).
// Integer-cent BigInt money representation per ADR-0012 principles.

export const PRESALES_STATUSES = ["draft", "submitted", "approved", "rejected", "expired"] as const;
export type PresalesStatus = (typeof PRESALES_STATUSES)[number];

export function isKnownPresalesStatus(v: unknown): v is PresalesStatus {
  return typeof v === "string" && (PRESALES_STATUSES as readonly string[]).includes(v);
}

export function isValidAmountCents(v: unknown): v is number | bigint {
  return (typeof v === "number" && Number.isInteger(v) && v >= 0) || (typeof v === "bigint" && v >= 0n);
}

export function deriveProposalTotals(lines: Array<{ hours: number; hourlyRateCents: bigint | number }>): {
  totalAmountCents: bigint;
} {
  let totalAmountCents = 0n;
  for (const line of lines) {
    const hrs = BigInt(Math.max(0, line.hours));
    const rate = BigInt(line.hourlyRateCents);
    totalAmountCents += hrs * rate;
  }
  return { totalAmountCents };
}
