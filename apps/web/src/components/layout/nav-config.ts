export type NavBehavior = "always" | "hide" | "lock";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** Governing permission key; only meaningful for hide/lock behaviors. */
  permission?: string;
  behavior?: NavBehavior;
  /** Module not yet delivered — shows a mono "soon" badge. */
  soon?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Filter nav groups for a permission set — navigation usability only;
// hiding/locking never grants or denies API access (server is authoritative).
export function filterNavGroups(
  groups: NavGroup[],
  can: (permission: string) => boolean,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.behavior === "hide" && item.permission) return can(item.permission);
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

// PRD §19 — 12 top-level areas, grouped.
// Navigation is usability only: hide/lock never grants access (API enforcement is authoritative).
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    items: [
      { label: "My Day", href: "/dashboard", icon: "home" },
      {
        label: "My Team",
        href: "/dashboard/my-team",
        icon: "groups",
        permission: "time.report.read_team",
        behavior: "hide",
      },
    ],
  },
  {
    label: "Work",
    items: [
      {
        label: "Tickets",
        href: "/dashboard/tickets",
        icon: "checklist",
        permission: "ticket.read",
        behavior: "hide",
      },
      {
        label: "Projects",
        href: "/dashboard/projects",
        icon: "folder",
        permission: "project.read",
        behavior: "hide",
      },
      {
        label: "My Time",
        href: "/dashboard/time",
        icon: "schedule",
        permission: "time.entry.read_self",
        behavior: "hide",
      },
      {
        label: "Timesheets",
        href: "/dashboard/timesheets",
        icon: "table_chart",
        permission: "time.entry.read_self",
        behavior: "hide",
      },
      {
        label: "Team Time",
        href: "/dashboard/time/team",
        icon: "groups",
        permission: "time.dar.review",
        behavior: "hide",
      },
      {
        label: "Releases",
        href: "/dashboard/releases",
        icon: "rocket_launch",
        permission: "release.read",
        behavior: "hide",
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        label: "CRM & Sales",
        href: "/dashboard/crm",
        icon: "handshake",
        permission: "crm.opportunity.read",
        behavior: "lock",
      },
      {
        label: "Presales",
        href: "/dashboard/presales",
        icon: "science",
        permission: "presales.proposal.read",
        behavior: "hide",
      },
      {
        label: "Resource Planning",
        href: "/dashboard/resource-planning",
        icon: "calendar_month",
        soon: true,
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "People / HR",
        href: "/dashboard/people",
        icon: "badge",
        permission: "org.read_directory",
        behavior: "hide",
      },
      {
        label: "Recruitment",
        href: "/dashboard/recruit",
        icon: "person_search",
        permission: "recruit.requisition.read",
        behavior: "hide",
      },
      {
        label: "Offers",
        href: "/dashboard/recruit/offers",
        icon: "contract",
        permission: "recruit.offer.read",
        behavior: "hide",
      },
      {
        label: "Offer Templates",
        href: "/dashboard/recruit/offer-templates",
        icon: "description",
        permission: "recruit.offer.read",
        behavior: "hide",
      },
      {
        label: "Onboarding",
        href: "/dashboard/onboarding",
        icon: "how_to_reg",
        permission: "onboarding.plan.read",
        behavior: "hide",
      },
      {
        label: "Probation",
        href: "/dashboard/onboarding",
        icon: "fact_check",
        permission: "onboarding.probation.read",
        behavior: "hide",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Finance",
        href: "/dashboard/finance",
        icon: "payments",
        permission: "finance.invoice.read",
        behavior: "hide",
      },
      {
        label: "Invoices",
        href: "/dashboard/finance/invoices",
        icon: "receipt_long",
        permission: "finance.invoice.read",
        behavior: "hide",
      },
      {
        label: "Receivables",
        href: "/dashboard/finance/receivables",
        icon: "account_balance_wallet",
        permission: "finance.receivable.read",
        behavior: "hide",
      },
    ],
  },
  {
    label: "Governance",
    items: [
      {
        label: "Approvals",
        href: "/dashboard/approvals",
        icon: "task_alt",
        permission: "approval.read",
        behavior: "hide",
      },
      {
        label: "Workflows",
        href: "/dashboard/approvals/workflows",
        icon: "account_tree",
        permission: "approval.workflow.read",
        behavior: "hide",
      },
      {
        label: "Delegations",
        href: "/dashboard/approvals/delegations",
        icon: "swap_horiz",
        permission: "approval.delegate",
        behavior: "hide",
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        icon: "monitoring",
        permission: "audit.read",
        behavior: "hide",
      },
      {
        label: "Administration",
        href: "/dashboard/administration",
        icon: "admin_panel_settings",
        permission: "org.manage_roles",
        behavior: "hide",
      },
    ],
  },
  {
    label: "Assistant",
    items: [
      {
        label: "AI Assistant",
        href: "/dashboard/assistant",
        icon: "spark",
        permission: "assistant.use",
        behavior: "hide",
      },
    ],
  },
];
