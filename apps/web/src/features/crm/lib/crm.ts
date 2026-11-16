// CRM core domain helpers — PRD Module 9 (Feature #6)
export const ACCOUNT_STATUSES = ["prospect", "active", "on_hold", "churned"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const CLIENT_TIERS = ["standard", "strategic"] as const;
export type ClientTier = (typeof CLIENT_TIERS)[number];

export const LEAD_STATUSES = [
  "new",
  "working",
  "qualified",
  "unqualified",
  "converted",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["inbound", "outbound", "referral", "webinar", "partner", "event"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const OPPORTUNITY_STAGES = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const GOVERNED_OPPORTUNITY_STAGES: readonly OpportunityStage[] = ["won", "lost"];

export const FORECAST_CATEGORIES = ["pipeline", "best_case", "commit", "closed"] as const;
export type ForecastCategory = (typeof FORECAST_CATEGORIES)[number];

export type LeadConvertTarget = "account" | "opportunity" | "both";

export interface CrmAccount {
  id: string;
  tenantId: string;
  name: string;
  industry: string | null;
  website: string | null;
  source: string;
  status: AccountStatus;
  clientTier: ClientTier | null;
  ownerId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContact {
  id: string;
  tenantId: string;
  accountId: string;
  fullName: string;
  email: string;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmLead {
  id: string;
  tenantId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  status: LeadStatus;
  ownerId: string;
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
  convertedAccountId: string | null;
  convertedContactId: string | null;
  convertedOpportunityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmOpportunity {
  id: string;
  tenantId: string;
  accountId: string;
  name: string;
  stage: OpportunityStage;
  amountCents: string | number | bigint;
  currency: string;
  expectedCloseDate: string | null;
  probability: number | null;
  forecastCategory: ForecastCategory | null;
  ownerId: string;
  lostReason: string | null;
  competitorNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmStageHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
}

// --- Lead transitions (converted is unreachable via PATCH — governed convert only) ---
export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  const map: Record<LeadStatus, Set<LeadStatus>> = {
    new: new Set(["working", "qualified", "unqualified"]),
    working: new Set(["qualified", "unqualified"]),
    qualified: new Set(["working", "unqualified"]),
    unqualified: new Set(["working"]),
    converted: new Set([]),
  };
  return map[from]?.has(to) ?? false;
}

// --- Opportunity stage matrix (won/lost are terminal; reached via governed outcome) ---
export function canTransitionOpportunity(
  from: OpportunityStage,
  to: OpportunityStage,
): boolean {
  const map: Record<OpportunityStage, Set<OpportunityStage>> = {
    prospecting: new Set(["qualification", "lost"]),
    qualification: new Set(["proposal", "negotiation", "lost"]),
    proposal: new Set(["negotiation", "qualification", "lost"]),
    negotiation: new Set(["proposal", "lost"]),
    won: new Set([]),
    lost: new Set([]),
  };
  return map[from]?.has(to) ?? false;
}

// "won" is intentionally unreachable through plain transitions too —
// it must go through the governed outcome endpoint (reason allowed, audited).
export function isGovernedOpportunityStage(stage: string): boolean {
  return stage === "won" || stage === "lost";
}

export function canConvertLead(lead: CrmLead): boolean {
  return lead.status !== "converted";
}

export function isValidConvertTarget(target: string): target is LeadConvertTarget {
  return target === "account" || target === "opportunity" || target === "both";
}

// --- Money (integer cents; never binary float — PRD finance guardrail) ---
const CENTS_RE = /^-?\d+$/;

export function parseAmountToCents(input: string | number): number | null {
  if (typeof input === "number") {
    if (!Number.isInteger(input)) return null;
    return input;
  }
  const s = input.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const neg = s.startsWith("-");
  const [whole, frac = ""] = (neg ? s.slice(1) : s).split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return neg ? -cents : cents;
}

export function isValidCents(value: unknown): boolean {
  if (typeof value === "number") return Number.isSafeInteger(value);
  if (typeof value === "bigint") return true;
  if (typeof value === "string") return CENTS_RE.test(value);
  return false;
}

export function formatCents(cents: string | number | bigint, currency = "USD"): string {
  const n = typeof cents === "bigint" ? Number(cents) : Number(cents);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(n / 100);
}

export function isValidProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}
