// Feature #11 — Offers domain library (PRD Module 3 tail).
// Money is integer cents; never binary floating-point.

export const OFFER_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_RESPONSE_ACTIONS = ["accept", "decline", "withdraw"] as const;
export type OfferResponseAction = (typeof OFFER_RESPONSE_ACTIONS)[number];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "intern", "consultant"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export function isKnownOfferStatus(v: unknown): v is OfferStatus {
  return typeof v === "string" && (OFFER_STATUSES as readonly string[]).includes(v);
}

export function isKnownOfferResponseAction(v: unknown): v is OfferResponseAction {
  return typeof v === "string" && (OFFER_RESPONSE_ACTIONS as readonly string[]).includes(v);
}

export function isKnownEmploymentType(v: unknown): v is EmploymentType {
  return typeof v === "string" && (EMPLOYMENT_TYPES as readonly string[]).includes(v);
}

export function isKnownWorkMode(v: unknown): v is WorkMode {
  return typeof v === "string" && (WORK_MODES as readonly string[]).includes(v);
}

// ---- Money guards (integer cents only) ----

export function isValidAmountCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

// ---- Governed-action guards ----

// Only a draft offer is editable.
export function isOfferEditable(offer: { status: string }): boolean {
  return offer.status === "draft";
}

// An offer can be sent only after its approval instance is approved.
export function canSend(offer: { status: string }): boolean {
  return offer.status === "approved";
}

// Terminal statuses are locked to responses / further transitions.
const TERMINAL: readonly OfferStatus[] = ["accepted", "declined", "withdrawn", "expired"];
export function isOfferTerminal(offer: { status: string }): boolean {
  return (TERMINAL as readonly string[]).includes(offer.status);
}

// A response is allowed once the offer has been sent (or approved-but-sent).
export function canRespond(offer: { status: string }): boolean {
  return offer.status === "sent";
}

// ---- Offer numbering (per tenant): OFFER-YYYY-NNNN ----

export function offerNumber(sequence: number, year: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("sequence must be a positive integer");
  return `OFFER-${year}-${String(sequence).padStart(4, "0")}`;
}

// ---- Template placeholders: simple {{token}} substitution (data only, never executable) ----

export function renderTemplate(
  body: string,
  data: Record<string, string | number | null | undefined>,
): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = data[key];
    return v === null || v === undefined ? "" : String(v);
  });
}
