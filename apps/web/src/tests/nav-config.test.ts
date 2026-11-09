import { describe, it, expect } from "vitest";
import { NAV_GROUPS, filterNavGroups } from "../components/layout/nav-config";

const all = () => true;
const none = () => false;
const has =
  (...keys: string[]) =>
  (p: string) =>
    keys.includes(p);

const flatten = (groups: ReturnType<typeof filterNavGroups>) =>
  groups.flatMap((g) => g.items.map((i) => i.href));

describe("filterNavGroups (navigation = usability only)", () => {
  it("shows all 12 PRD areas to a fully-permissioned user", () => {
    const hrefs = flatten(filterNavGroups(NAV_GROUPS, all));
    // 25 destinations (My Day + nav links + My Team, Recruitment siblings,
    // onboarding, time trio, approval trio, finance trio, assistant)
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/dashboard/my-team");
    expect(hrefs).toContain("/dashboard/reports");
    expect(hrefs).toContain("/dashboard/administration");
    expect(hrefs).toContain("/dashboard/crm");
    expect(hrefs).toContain("/dashboard/finance");
    expect(hrefs).toContain("/dashboard/finance/invoices");
    expect(hrefs).toContain("/dashboard/finance/receivables");
    expect(hrefs).toContain("/dashboard/assistant");
    expect(hrefs).toContain("/dashboard/recruit");
    expect(hrefs).toContain("/dashboard/recruit/offers");
    expect(hrefs).toContain("/dashboard/recruit/offer-templates");
    expect(hrefs).toContain("/dashboard/onboarding");
    expect(hrefs).toContain("/dashboard/projects");
    expect(hrefs).toContain("/dashboard/tickets");
    expect(hrefs).toContain("/dashboard/time");
    expect(hrefs).toContain("/dashboard/timesheets");
    expect(hrefs).toContain("/dashboard/time/team");
    expect(hrefs).toContain("/dashboard/approvals");
    expect(hrefs).toContain("/dashboard/approvals/workflows");
    expect(hrefs).toContain("/dashboard/approvals/delegations");
    expect(hrefs).toContain("/dashboard/assistant");
    expect(hrefs).toContain("/dashboard/releases");
    expect(hrefs).toContain("/dashboard/presales");
    expect(hrefs).toContain("/dashboard/resource-planning");
    expect(hrefs).toContain("/dashboard/attendance");
    expect(hrefs).toContain("/dashboard/leave");
    expect(hrefs).toContain("/dashboard/documents");
    expect(hrefs).toContain("/dashboard/calendar");
    expect(hrefs).toContain("/dashboard/control-plane");
    expect(hrefs.length).toBe(31);
  });

  it("hides Projects/Tickets from an employee without project/ticket perms", () => {
    const withPw = flatten(filterNavGroups(NAV_GROUPS, has("project.read", "ticket.read")));
    const without = flatten(filterNavGroups(NAV_GROUPS, has("org.read_directory")));
    expect(withPw).toContain("/dashboard/projects");
    expect(withPw).toContain("/dashboard/tickets");
    expect(without).not.toContain("/dashboard/projects");
    expect(without).not.toContain("/dashboard/tickets");
  });

  it("gates My Time/Timesheets on time.entry.read_self and Team Time on time.dar.review", () => {
    const selfOnly = flatten(filterNavGroups(NAV_GROUPS, has("time.entry.read_self")));
    expect(selfOnly).toContain("/dashboard/time");
    expect(selfOnly).toContain("/dashboard/timesheets");
    expect(selfOnly).not.toContain("/dashboard/time/team");

    const reviewer = flatten(filterNavGroups(NAV_GROUPS, has("time.entry.read_self", "time.dar.review")));
    expect(reviewer).toContain("/dashboard/time/team");

    const noneTime = flatten(filterNavGroups(NAV_GROUPS, has("org.read_directory")));
    expect(noneTime).not.toContain("/dashboard/time");
    expect(noneTime).not.toContain("/dashboard/timesheets");
    expect(noneTime).not.toContain("/dashboard/time/team");
  });

  it("shows Recruitment only when recruit.requisition.read is granted", () => {
    const withRecruit = flatten(filterNavGroups(NAV_GROUPS, has("recruit.requisition.read")));
    const withoutRecruit = flatten(filterNavGroups(NAV_GROUPS, has("org.read_directory")));
    expect(withRecruit).toContain("/dashboard/recruit");
    expect(withoutRecruit).not.toContain("/dashboard/recruit");
  });

  it("gates Offers/Offer Templates on recruit.offer.read and Onboarding/Probation accordingly", () => {
    const withOffer = flatten(filterNavGroups(NAV_GROUPS, has("recruit.offer.read")));
    expect(withOffer).toContain("/dashboard/recruit/offers");
    expect(withOffer).toContain("/dashboard/recruit/offer-templates");
    expect(withOffer).not.toContain("/dashboard/onboarding");

    const withPlan = flatten(filterNavGroups(NAV_GROUPS, has("onboarding.plan.read")));
    expect(withPlan).toContain("/dashboard/onboarding");

    const noneOffer = flatten(filterNavGroups(NAV_GROUPS, has("org.read_directory")));
    expect(noneOffer).not.toContain("/dashboard/recruit/offers");
    expect(noneOffer).not.toContain("/dashboard/onboarding");
  });

  it("hides permission-gated items from an employee with only SELF perms", () => {
    const hrefs = flatten(filterNavGroups(NAV_GROUPS, none));
    expect(hrefs).not.toContain("/dashboard/my-team");
    expect(hrefs).not.toContain("/dashboard/reports");
    expect(hrefs).not.toContain("/dashboard/administration");
    expect(hrefs).not.toContain("/dashboard/documents");
    expect(hrefs).not.toContain("/dashboard/calendar");
    expect(hrefs).not.toContain("/dashboard/control-plane");
    // lock-behavior items stay visible (dimmed), never hidden
    expect(hrefs).toContain("/dashboard/crm");
    expect(hrefs).not.toContain("/dashboard/finance");
    expect(hrefs).not.toContain("/dashboard/finance/invoices");
    expect(hrefs).not.toContain("/dashboard/finance/receivables");
  });

  it("shows Reports only when audit.read is granted", () => {
    const withAudit = flatten(filterNavGroups(NAV_GROUPS, has("audit.read")));
    const withoutAudit = flatten(filterNavGroups(NAV_GROUPS, has("org.read_directory")));
    expect(withAudit).toContain("/dashboard/reports");
    expect(withoutAudit).not.toContain("/dashboard/reports");
  });

  it("gates Approvals/Workflows/Delegations on their approval permissions", () => {
    const withApprovals = flatten(filterNavGroups(NAV_GROUPS, has("approval.read", "approval.workflow.read", "approval.delegate")));
    expect(withApprovals).toContain("/dashboard/approvals");
    expect(withApprovals).toContain("/dashboard/approvals/workflows");
    expect(withApprovals).toContain("/dashboard/approvals/delegations");

    const readOnly = flatten(filterNavGroups(NAV_GROUPS, has("approval.read")));
    expect(readOnly).toContain("/dashboard/approvals");
    expect(readOnly).not.toContain("/dashboard/approvals/workflows");
    expect(readOnly).not.toContain("/dashboard/approvals/delegations");
  });

  it("gates Finance/Invoices/Receivables on their finance permissions", () => {
    const withInvoice = flatten(filterNavGroups(NAV_GROUPS, has("finance.invoice.read")));
    expect(withInvoice).toContain("/dashboard/finance");
    expect(withInvoice).toContain("/dashboard/finance/invoices");
    expect(withInvoice).not.toContain("/dashboard/finance/receivables");

    const withAll = flatten(filterNavGroups(NAV_GROUPS, has("finance.invoice.read", "finance.receivable.read")));
    expect(withAll).toContain("/dashboard/finance/receivables");
  });

  it("drops groups that become empty after filtering", () => {
    const filtered = filterNavGroups(NAV_GROUPS, has("approval.read"));
    const governance = filtered.find((g) => g.label === "Governance");
    expect(governance).toBeDefined();
    expect(governance!.items.map((i) => i.label)).toEqual(["Approvals"]);
  });
});
