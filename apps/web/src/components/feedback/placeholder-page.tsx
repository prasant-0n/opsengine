import Link from "next/link";

// Standard panel for undelivered / restricted destinations (PRD §19 permission-denied state).
export function PlaceholderPage({
  title,
  feature,
  permissionNote,
}: {
  title: string;
  /** PRD feature area this placeholder stands in for, e.g. "Module 16 — Tickets". */
  feature: string;
  permissionNote?: string;
}) {
  return (
    <div className="page-stack">
      <div className="page-header">
        <h1 className="font-headline-lg">{title}</h1>
        <span className="badge badge-outline">{feature}</span>
      </div>

      <div className="state-panel" role="status">
        <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
          construction
        </span>
        <p className="state-panel-title">Module not yet available</p>
        <p className="state-panel-body">
          This area ships with a later phase. Data and actions will be enforced by
          the authorization engine on the server — nothing is granted by this screen.
        </p>
        {permissionNote && <p className="state-panel-note mono">{permissionNote}</p>}
        <Link href="/dashboard" className="btn btn-outline btn-sm">
          Back to My Day
        </Link>
      </div>
    </div>
  );
}
