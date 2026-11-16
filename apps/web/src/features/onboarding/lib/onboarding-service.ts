// Feature #11 — Onboarding service helpers (plan instantiation + derived status).
import { prisma } from "@/lib/prisma";
import { deriveCompletionPct, type OnboardingTaskStatus } from "./onboarding";

interface ChecklistTaskDef {
  title: string;
  category?: string;
  ownerRole?: string;
  dueOffsetDays?: number;
}

export interface ChecklistTask {
  title: string;
  category: string;
  ownerRole: string | null;
  dueOn: Date | null;
}

// Resolve the checklist template for a plan and snapshot its task definitions.
// tasks JSON is validated data (shape-checked here), never executable.
export function resolveChecklistTasks(
  template: { tasks: unknown } | null,
  startedOn: Date,
): ChecklistTask[] {
  if (!template) return [];
  const raw = Array.isArray(template.tasks) ? template.tasks : [];
  const defs: ChecklistTaskDef[] = [];
  for (const t of raw) {
    if (t && typeof t === "object" && typeof (t as any).title === "string" && (t as any).title.trim()) {
      defs.push(t as ChecklistTaskDef);
    }
  }
  return defs.map((d) => ({
    title: d.title.trim(),
    category: typeof d.category === "string" && d.category ? d.category : "hr",
    ownerRole: typeof d.ownerRole === "string" && d.ownerRole ? d.ownerRole : null,
    dueOn:
      typeof d.dueOffsetDays === "number" && Number.isInteger(d.dueOffsetDays)
        ? new Date(startedOn.getTime() + d.dueOffsetDays * 24 * 60 * 60 * 1000)
        : null,
  }));
}

// Pick the most specific active checklist template for the plan attributes.
export async function pickChecklistTemplate(
  tenantId: string,
  attrs: { jobFamily?: string | null; location?: string | null; employmentType?: string | null },
) {
  const candidates = await prisma.onboardingChecklistTemplate.findMany({
    where: { tenantId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const score = (t: any): number => {
    let s = 0;
    if (t.jobFamily && t.jobFamily === attrs.jobFamily) s += 4;
    else if (t.jobFamily) return -1;
    if (t.location && t.location === attrs.location) s += 2;
    else if (t.location) return -1;
    if (t.employmentType && t.employmentType === attrs.employmentType) s += 1;
    else if (t.employmentType) return -1;
    return s;
  };
  let best: any = null;
  let bestScore = -1;
  for (const t of candidates) {
    const s = score(t);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return best;
}

export interface InstantiateResult {
  planId: string;
  created: boolean;
}

// Idempotently create an onboarding plan for an accepted offer (unique on tenant+candidate+offer).
export async function instantiatePlanForOffer(
  tenantId: string,
  offer: { id: string; candidateId: string; jobTitle: string; location?: string | null; employmentType?: string | null; startDate?: Date | null },
  createdBy: string | null,
): Promise<InstantiateResult> {
  const existing = await prisma.onboardingPlan.findFirst({
    where: { tenantId, candidateId: offer.candidateId, offerId: offer.id },
    select: { id: true },
  });
  if (existing) return { planId: existing.id, created: false };

  const startedOn = offer.startDate ?? new Date();
  const template = await pickChecklistTemplate(tenantId, {
    jobFamily: null,
    location: offer.location ?? null,
    employmentType: offer.employmentType ?? null,
  });
  const checklist = resolveChecklistTasks(template, startedOn);

  const plan = await prisma.$transaction(async (tx) => {
    const p = await tx.onboardingPlan.create({
      data: {
        tenantId,
        candidateId: offer.candidateId,
        offerId: offer.id,
        jobFamily: null,
        location: offer.location ?? null,
        employmentType: offer.employmentType ?? null,
        status: checklist.length > 0 ? "in_progress" : "pending",
        startedOn,
        createdBy,
      },
    });
    for (const t of checklist) {
      await tx.onboardingTask.create({
        data: {
          tenantId,
          planId: p.id,
          title: t.title,
          category: t.category,
          ownerRole: t.ownerRole,
          dueOn: t.dueOn,
          status: "pending",
          createdBy,
        },
      });
    }
    await tx.stageHistory.create({
      data: {
        tenantId,
        entityType: "onboarding_plan",
        entityId: p.id,
        toStatus: p.status,
        actorId: createdBy,
        reason: `Instantiated from offer ${offer.id}`,
      },
    });
    return p;
  });

  return { planId: plan.id, created: true };
}

// Recompute plan status from its tasks (does not override cancelled).
export async function recomputePlanStatus(tenantId: string, planId: string): Promise<void> {
  const plan = await prisma.onboardingPlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan || plan.status === "cancelled") return;
  const tasks = await prisma.onboardingTask.findMany({ where: { tenantId, planId } });
  const pct = deriveCompletionPct(tasks.map((t) => ({ status: t.status as OnboardingTaskStatus })));
  let status = plan.status;
  if (pct === 100 && tasks.length > 0) status = "completed";
  else if (tasks.length > 0) status = "in_progress";
  const data: any = { status };
  if (status === "completed" && !plan.completedOn) data.completedOn = new Date();
  if (status !== "completed") data.completedOn = null;
  if (status !== plan.status || data.completedOn !== undefined) {
    await prisma.onboardingPlan.update({ where: { id: plan.id }, data });
  }
}
