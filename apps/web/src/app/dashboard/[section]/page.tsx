import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/feedback/placeholder-page";

const PLACEHOLDERS: Record<string, { title: string; feature: string }> = {
  "my-team": { title: "My Team", feature: "Module 16 — team dashboard" },
  tickets: { title: "Tickets", feature: "Module 7 — work management" },
  projects: { title: "Projects", feature: "Module 7 — work management" },
  releases: { title: "Releases", feature: "Module 12 — release governance" },
  crm: { title: "CRM & Sales", feature: "Module 6 — CRM" },
  presales: { title: "Presales", feature: "Module 5 — presales pipeline" },
  "resource-planning": { title: "Resource Planning", feature: "Module 9 — resource planning" },
  people: { title: "People / HR", feature: "Module 8 — HRMS" },
  finance: { title: "Finance", feature: "Module 10 — finance" },
  approvals: { title: "Approvals", feature: "Module 4 — approvals inbox" },
  assistant: { title: "AI Assistant", feature: "Module 17 — agentic console" },
};

export default async function PlaceholderRoute({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const entry = PLACEHOLDERS[section];
  if (!entry) notFound();

  return (
    <PlaceholderPage
      title={entry.title}
      feature={entry.feature}
      permissionNote="Access is decided by the authorization engine server-side."
    />
  );
}
