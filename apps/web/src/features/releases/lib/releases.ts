// Feature #8 — Release Management & Deployment Gates (PRD Module 8).

export const RELEASE_STATUSES = ["draft", "review", "approved", "deployed", "rolled_back", "cancelled"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_GATE_TYPES = ["qa", "security", "change_management", "technical"] as const;
export type ReleaseGateType = (typeof RELEASE_GATE_TYPES)[number];

export const RELEASE_GATE_STATUSES = ["pending", "passed", "failed", "waived"] as const;
export type ReleaseGateStatus = (typeof RELEASE_GATE_STATUSES)[number];

export function isKnownReleaseStatus(v: unknown): v is ReleaseStatus {
  return typeof v === "string" && (RELEASE_STATUSES as readonly string[]).includes(v);
}

export function isKnownGateType(v: unknown): v is ReleaseGateType {
  return typeof v === "string" && (RELEASE_GATE_TYPES as readonly string[]).includes(v);
}

export function isKnownGateStatus(v: unknown): v is ReleaseGateStatus {
  return typeof v === "string" && (RELEASE_GATE_STATUSES as readonly string[]).includes(v);
}

// PRD rule: A production release cannot be approved or deployed if any required gate is failed or pending.
export function canApproveRelease(gates: Array<{ gateType: string; status: string }>): boolean {
  if (gates.length === 0) return false;
  return gates.every((g) => g.status === "passed" || g.status === "waived");
}
