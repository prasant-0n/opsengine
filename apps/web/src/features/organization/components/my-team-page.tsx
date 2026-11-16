"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";

interface Person {
  id: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  employmentStatus: string;
  relationshipType?: string;
}

interface MyTeam {
  employeeId: string | null;
  teams: Array<{ id: string; name: string; responsibility: string }>;
  directReports: Person[];
  teamMembers: Person[];
}

function PersonCard({ p }: { p: Person }) {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <Link href={`/dashboard/people/${p.id}`} className="link-plain">
          {p.displayName}
        </Link>
        <span className="badge badge-outline">{p.employmentStatus}</span>
      </div>
      <div className="kpi-note font-label-sm">
        {[p.jobTitle, p.department].filter(Boolean).join(" · ") || "—"}
      </div>
      {p.relationshipType && p.relationshipType !== "direct" ? (
        <div className="kpi-note font-label-sm mono" style={{ marginTop: 4 }}>
          {p.relationshipType}-line
        </div>
      ) : null}
    </div>
  );
}

export default function MyTeamPage() {
  const { can, whoami } = useShell();
  const [data, setData] = useState<MyTeam | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");

  const allowed =
    can("time.report.read_team") ||
    (can("org.read_directory") &&
      whoami?.permissions.some((p) => p.key === "org.read_directory" && p.scopeType !== "SELF"));

  useEffect(() => {
    if (!allowed) {
      setState("denied");
      return;
    }
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const res = await fetch("/api/org/my-team");
        if (res.status === 403) {
          if (!cancelled) setState("denied");
          return;
        }
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setState("ok");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="font-headline-lg">My Team</h1>
          <p className="page-subtitle">
            Direct reports and team memberships · effective relationships only
          </p>
        </div>
        <span className="badge badge-primary">Home</span>
      </div>

      {state === "denied" ? (
        <div className="panel">
          <div className="panel-empty">
            <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
              lock
            </span>
            <p className="state-panel-title">Permission denied</p>
            <p className="state-panel-note mono">missing: time.report.read_team</p>
          </div>
        </div>
      ) : state === "error" ? (
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-title">Failed to load team view</p>
          </div>
        </div>
      ) : state === "loading" || !data ? (
        <div className="panel">
          <div className="panel-empty">
            <p className="state-panel-body animate-pulse">Loading team…</p>
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Your teams</h2>
            </div>
            {data.teams.length === 0 ? (
              <div className="panel-empty">
                <p className="state-panel-body">No active team memberships.</p>
              </div>
            ) : (
              <div className="badge-row" style={{ justifyContent: "flex-start", padding: 16 }}>
                {data.teams.map((t) => (
                  <span key={t.id} className="badge badge-outline">
                    {t.name} · {t.responsibility.replace("_", " ")}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Direct reports</h2>
              <span className="font-label-sm text-outline-60">
                {data.directReports.length} active
              </span>
            </div>
            {data.directReports.length === 0 ? (
              <div className="panel-empty">
                <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
                  person
                </span>
                <p className="state-panel-body">No direct reports on your reporting line.</p>
              </div>
            ) : (
              <div className="kpi-grid">
                {data.directReports.map((p) => (
                  <PersonCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Team members</h2>
              <span className="font-label-sm text-outline-60">
                {data.teamMembers.length} active
              </span>
            </div>
            {data.teamMembers.length === 0 ? (
              <div className="panel-empty">
                <p className="state-panel-body">No other members in your teams.</p>
              </div>
            ) : (
              <div className="kpi-grid">
                {data.teamMembers.map((p) => (
                  <PersonCard key={p.id} p={p} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
