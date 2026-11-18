/**
 * OpsEngine Travel Management Engine (Feature #46)
 * PRD Modules 12, 18 & §18.7: Corporate Travel, Itineraries, Policy Engine, and Expense Bridging
 */

export interface DestinationTierConfig {
  name: string;
  dailyLimitCents: number; // in cents (e.g., $350.00 = 35000)
}

export const DESTINATION_TIERS: Record<"tier_1" | "tier_2" | "tier_3", DestinationTierConfig> = {
  tier_1: {
    name: "Tier 1 — High-Cost Global Metros",
    dailyLimitCents: 35000, // $350 / day
  },
  tier_2: {
    name: "Tier 2 — Standard Commercial Cities",
    dailyLimitCents: 22000, // $220 / day
  },
  tier_3: {
    name: "Tier 3 — Regional & Secondary Hubs",
    dailyLimitCents: 14000, // $140 / day
  },
};

const TIER_1_CITIES = new Set([
  "new york",
  "nyc",
  "london",
  "san francisco",
  "sf",
  "tokyo",
  "paris",
  "singapore",
  "dubai",
  "zurich",
  "geneva",
  "hong kong",
  "sydney",
]);

const TIER_2_CITIES = new Set([
  "berlin",
  "toronto",
  "amsterdam",
  "chicago",
  "seattle",
  "boston",
  "austin",
  "bangalore",
  "bengaluru",
  "mumbai",
  "munich",
  "dublin",
  "frankfurt",
]);

/**
 * Resolves per-diem destination tier based on city.
 */
export function getDestinationTier(city: string, _country?: string): "tier_1" | "tier_2" | "tier_3" {
  if (!city) return "tier_3";
  const normalized = city.trim().toLowerCase();
  if (TIER_1_CITIES.has(normalized)) return "tier_1";
  if (TIER_2_CITIES.has(normalized)) return "tier_2";
  return "tier_3";
}

/**
 * Calculates calendar trip duration in days (inclusive).
 * Start and end on same day = 1 day.
 */
export function calculateTripDurationDays(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid start or end date provided");
  }

  // Normalize to UTC midnight dates
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  if (endUtc < startUtc) {
    throw new Error("Trip end date cannot be earlier than start date");
  }

  const diffMs = endUtc - startUtc;
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

export interface PerDiemComplianceResult {
  compliant: boolean;
  dailyRateCents: number;
  maxAllowedTotalCents: number;
  varianceCents: number;
  tier: "tier_1" | "tier_2" | "tier_3";
  dailyLimitCents: number;
}

/**
 * Evaluates whether estimated trip cost is compliant with corporate per-diem policy.
 */
export function evaluatePerDiemCompliance(
  estimatedTotalCents: number | bigint | string,
  days: number,
  tier: "tier_1" | "tier_2" | "tier_3"
): PerDiemComplianceResult {
  const safeDays = Math.max(1, days);
  const total = Number(estimatedTotalCents);
  const tierConfig = DESTINATION_TIERS[tier];
  const maxAllowed = tierConfig.dailyLimitCents * safeDays;
  const dailyRate = Math.round(total / safeDays);
  const variance = total - maxAllowed;

  return {
    compliant: total <= maxAllowed,
    dailyRateCents: dailyRate,
    maxAllowedTotalCents: maxAllowed,
    varianceCents: variance,
    tier,
    dailyLimitCents: tierConfig.dailyLimitCents,
  };
}

export type TravelerDutyStatus = "planned" | "in_transit" | "on_site" | "returned" | "cancelled";

/**
 * Derives current operational duty of the traveler relative to trip dates.
 */
export function deriveTravelerDutyStatus(
  startDate: string | Date,
  endDate: string | Date,
  requestStatus: string,
  referenceDate: Date = new Date()
): TravelerDutyStatus {
  if (requestStatus === "cancelled" || requestStatus === "rejected") {
    return "cancelled";
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const ref = new Date(referenceDate);

  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();

  if (refDay < startDay) {
    return "planned";
  }
  if (refDay > endDay) {
    return "returned";
  }
  if (refDay === startDay || refDay === endDay) {
    return "in_transit";
  }
  return "on_site";
}

/**
 * Sums costs of itinerary items using BigInt arithmetic.
 */
export function calculateItineraryTotalCents(items: Array<{ costCents: bigint | number }>): bigint {
  return items.reduce<bigint>((acc, item) => acc + BigInt(item.costCents || 0), 0n);
}

export interface ExpenseBridgeItem {
  category: "travel" | "lodging" | "meals" | "other";
  description: string;
  amountCents: bigint;
}

export interface ExpenseBridgePayload {
  title: string;
  description: string;
  currency: string;
  totalAmountCents: bigint;
  items: ExpenseBridgeItem[];
  linkedTravelRequestId: string;
}

/**
 * Bridges approved travel request & itinerary items into a standardized ExpenseReport draft payload.
 */
export function buildExpenseBridgeDraft(
  travelRequest: {
    id: string;
    title: string;
    currency: string;
    estimatedTotalCents: bigint | number;
    advanceAmountCents: bigint | number;
    destinationCity: string;
    employeeId: string;
  },
  items: Array<{
    type: string;
    carrierOrVendor: string;
    costCents: bigint | number;
    bookingReference?: string | null;
  }>
): ExpenseBridgePayload {
  const expenseItems: ExpenseBridgeItem[] = [];

  for (const item of items) {
    let category: "travel" | "lodging" | "meals" | "other" = "other";
    if (item.type === "flight" || item.type === "train" || item.type === "rental_car") {
      category = "travel";
    } else if (item.type === "hotel") {
      category = "lodging";
    }

    const ref = item.bookingReference ? ` (Ref: ${item.bookingReference})` : "";
    expenseItems.push({
      category,
      description: `${item.type.toUpperCase()}: ${item.carrierOrVendor}${ref}`,
      amountCents: BigInt(item.costCents),
    });
  }

  // If no detailed itinerary items were registered, fallback to a single item matching the estimated cost
  let totalCents: bigint;
  if (expenseItems.length > 0) {
    totalCents = expenseItems.reduce((acc, it) => acc + it.amountCents, 0n);
  } else {
    totalCents = BigInt(travelRequest.estimatedTotalCents || 0);
    expenseItems.push({
      category: "travel",
      description: `Travel to ${travelRequest.destinationCity} — ${travelRequest.title}`,
      amountCents: totalCents,
    });
  }

  const advanceCents = BigInt(travelRequest.advanceAmountCents || 0);
  const advanceFormatted = (Number(advanceCents) / 100).toFixed(2);

  return {
    title: `Travel Claim: ${travelRequest.title} (${travelRequest.destinationCity})`,
    description: `Auto-reconciled travel expenses for Travel Request #${travelRequest.id.slice(0, 8)}. Disbursed cash advance: $${advanceFormatted} ${travelRequest.currency}.`,
    currency: travelRequest.currency || "USD",
    totalAmountCents: totalCents,
    items: expenseItems,
    linkedTravelRequestId: travelRequest.id,
  };
}

export function serializeItineraryItem(item: any) {
  if (!item) return null;
  return {
    ...item,
    costCents: item.costCents !== undefined && item.costCents !== null ? item.costCents.toString() : "0",
  };
}

export function serializeTravelRequest(req: any) {
  if (!req) return null;
  return {
    ...req,
    estimatedTotalCents:
      req.estimatedTotalCents !== undefined && req.estimatedTotalCents !== null
        ? req.estimatedTotalCents.toString()
        : "0",
    advanceAmountCents:
      req.advanceAmountCents !== undefined && req.advanceAmountCents !== null
        ? req.advanceAmountCents.toString()
        : "0",
    itineraryItems: Array.isArray(req.itineraryItems) ? req.itineraryItems.map(serializeItineraryItem) : undefined,
  };
}

