"use client";

import { useCallback, useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";

function statusBadge(status: string): string {
  switch (status) {
    case "optimal":
      return "badge badge-tertiary";
    case "under_utilized":
      return "badge badge-outline";
    case "over_utilized":
      return "badge badge-error";
    default:
      return "badge badge-outline";
  }
}

export default function ResourcePlanningPage() {
  const { can } = useShell();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resource-planning/capacity", { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="page-stack"><div className="state-panel state-panel-empty">Loading capacity heatmap…</div></div>;
  if (error) return <div className="page-stack"><div className="state-panel state-panel-error">{error}</div></div>;

  const summaries = data?.summaries ?? [];
  const metrics = data?.metrics ?? { totalEmployees: 0, avgAllocationPct: 0, overUtilizedCount: 0 };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Resource Planning & Capacity</h1>
          <p className="muted mono">resource_planning.read · Workforce Heatmap</p>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="muted">Total Headcount</p>
          <h2 className="mono" style={{ fontSize: "1.75rem", marginTop: "0.25rem" }}>{metrics.totalEmployees}</h2>
        </div>
        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="muted">Average Utilization</p>
          <h2 className="mono" style={{ fontSize: "1.75rem", marginTop: "0.25rem" }}>{metrics.avgAllocationPct}%</h2>
        </div>
        <div className="panel" style={{ padding: "1.25rem" }}>
          <p className="muted">Over-Allocated Staff</p>
          <h2 className="mono" style={{ fontSize: "1.75rem", marginTop: "0.25rem", color: metrics.overUtilizedCount > 0 ? "#ef4444" : "inherit" }}>
            {metrics.overUtilizedCount}
          </h2>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Staff Allocation & Capacity Heatmap</h2>
        </div>
        {summaries.length === 0 ? (
          <div className="state-panel state-panel-empty">No active employee records found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Job Title</th>
                <th>Allocation %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s: any) => (
                <tr key={s.employeeId}>
                  <td><strong>{s.displayName}</strong></td>
                  <td>{s.department}</td>
                  <td>{s.jobTitle}</td>
                  <td className="mono">{s.totalAllocatedPct}%</td>
                  <td>
                    <span className={statusBadge(s.utilizationStatus)}>{s.utilizationStatus.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
