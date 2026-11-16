import type { AuthorizationContext } from "../../../lib/permissions/context";
import { PERMISSIONS } from "../../../lib/permissions/permissions";

// PRD §3.4.1 step 6 — fields restricted beyond resource-level read.
// SENSITIVE_FIELDS has no schema-backed entries yet; these are the Module 2
// restricted projections (extend when compensation/bank columns arrive).
export const RESTRICTED_EMPLOYEE_FIELDS = ["workEmail", "probationEndsAt"] as const;

export type DirectoryScope =
  | { mode: "all" }
  | { mode: "team"; teamIds: string[] }
  | { mode: "ids"; employeeIds: string[] }
  | { mode: "none" };

const DIRECTORY_ACTION = PERMISSIONS.ORG_READ_DIRECTORY;

// Strongest org.read_directory grant wins: TENANT > TEAM > REPORTING_TREE > none.
// Never treat an absent grant as visibility (PRD §3.4.4).
export function directoryScopeFilter(ctx: AuthorizationContext): DirectoryScope {
  const grants = ctx.permissions.filter((p) => p.key === DIRECTORY_ACTION);
  if (grants.some((g) => g.scopeType === "TENANT")) return { mode: "all" };

  const teamIds = new Set<string>();
  let hasTeam = false;
  for (const g of grants) {
    if (g.scopeType !== "TEAM") continue;
    hasTeam = true;
    if (g.scopeId) {
      teamIds.add(g.scopeId);
    } else {
      for (const t of ctx.teamMemberships) teamIds.add(t.teamId);
    }
  }
  if (hasTeam && teamIds.size > 0) return { mode: "team", teamIds: [...teamIds] };

  if (grants.some((g) => g.scopeType === "REPORTING_TREE")) {
    return { mode: "ids", employeeIds: [...new Set([...ctx.reporting.reportIds, ...(ctx.employeeId ? [ctx.employeeId] : [])])] };
  }

  return { mode: "none" };
}

export interface EmployeeRow {
  id: string;
  tenantId: string;
  displayName: string;
  employeeNumber: string | null;
  workEmail: string | null;
  jobTitle: string | null;
  jobFamily: string | null;
  grade: string | null;
  seniority: string | null;
  department: string | null;
  sbuId: string | null;
  employmentType: string | null;
  location: string | null;
  startDate: Date | null;
  probationEndsAt: Date | null;
  employmentStatus: string;
}

export interface ViewerFacts {
  employeeId: string | null;
  closureIds: ReadonlySet<string>; // employees this viewer manages (downward, policy-allowed types)
  canManage: boolean; // holds org.manage_employees covering tenant
}

// Basic projection for directory rows; restricted fields redacted per viewer.
export function projectEmployee(row: EmployeeRow, viewer: ViewerFacts): Partial<EmployeeRow> {
  const full =
    (viewer.employeeId !== null && row.id === viewer.employeeId) ||
    viewer.closureIds.has(row.id) ||
    viewer.canManage;

  if (full) return { ...row };

  const out: Partial<EmployeeRow> = { ...row };
  for (const key of RESTRICTED_EMPLOYEE_FIELDS) {
    (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

export interface ReportingEdge {
  managerEmployeeId: string;
  reportEmployeeId: string;
  relationshipType: string;
}

const PRIMARY_CHAIN_TYPES = new Set(["direct", "acting"]);

export interface ClosureOptions {
  maxDepth?: number;
  allowedTypes?: ReadonlySet<string>;
}

// Downward closure from `rootId` (reports tree). Depth-capped and cycle-guarded;
// only policy-allowed relationship types traverse (PRD §3.4.2).
export function closureFromRows(
  rootId: string,
  edges: readonly ReportingEdge[],
  options: ClosureOptions = {},
): Set<string> {
  const maxDepth = options.maxDepth ?? 10;
  const allowed = options.allowedTypes ?? PRIMARY_CHAIN_TYPES;
  const byManager = new Map<string, ReportingEdge[]>();
  for (const e of edges) {
    if (!allowed.has(e.relationshipType)) continue;
    const list = byManager.get(e.managerEmployeeId);
    if (list) list.push(e);
    else byManager.set(e.managerEmployeeId, [e]);
  }

  const visited = new Set<string>([rootId]);
  const out = new Set<string>();
  let frontier = [rootId];
  let depth = 0;
  while (frontier.length > 0 && depth < maxDepth) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of byManager.get(id) ?? []) {
        if (visited.has(e.reportEmployeeId)) continue; // cycle guard
        visited.add(e.reportEmployeeId);
        out.add(e.reportEmployeeId);
        next.push(e.reportEmployeeId);
      }
    }
    frontier = next;
    depth += 1;
  }
  return out;
}

export const EMPLOYMENT_STATUSES = [
  "preboarding",
  "active",
  "probation",
  "notice",
  "exited",
  "on_leave",
  "terminated",
] as const;

const PATCHABLE_KEYS = [
  "jobTitle",
  "jobFamily",
  "grade",
  "seniority",
  "department",
  "employmentType",
  "location",
  "employmentStatus",
  "probationEndsAt",
  "employeeNumber",
  "displayName",
] as const;

export interface PatchResult {
  ok: boolean;
  data?: Partial<Pick<EmployeeRow, (typeof PATCHABLE_KEYS)[number]>>;
  error?: string;
}

// Validates a PATCH body server-side: whitelist only, status enum, probation sanity.
export function validateEmployeePatch(
  body: unknown,
  now: Date = new Date(),
): PatchResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Body must be an object" };
  }
  const input = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (!PATCHABLE_KEYS.includes(k as (typeof PATCHABLE_KEYS)[number])) {
      return { ok: false, error: `Field not allowed: ${k}` };
    }
    if (k === "employmentStatus") {
      if (typeof v !== "string" || !EMPLOYMENT_STATUSES.includes(v as never)) {
        return { ok: false, error: `Invalid employmentStatus: ${String(v)}` };
      }
      data[k] = v;
    } else if (k === "probationEndsAt") {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid probationEndsAt" };
      if (d.getTime() > now.getTime() + 2 * 365 * 24 * 3600 * 1000) {
        return { ok: false, error: "probationEndsAt beyond 2 years" };
      }
      data[k] = d;
      continue;
    } else if (typeof v !== "string") {
      return { ok: false, error: `Field ${k} must be a string` };
    } else if (v.length > 300) {
      return { ok: false, error: `Field ${k} too long` };
    } else {
      data[k] = v;
    }
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "No valid fields" };
  return { ok: true, data: data as PatchResult["data"] };
}
