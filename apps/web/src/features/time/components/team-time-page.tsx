"use client";

import { useCallback, useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";
import { formatMinutes } from "@/features/time/lib/time";

const TODAY = new Date().toISOString().slice(0, 10);

function planBadge(status: string | null): string {
  switch (status) {
    case "reviewed":
      return "badge badge-tertiary";
    case "submitted":
      return "badge badge-primary";
    case "draft":
      return "badge badge-outline";
    default:
      return "badge badge-outline";
  }
}

interface Member { id: string; displayName: string; managerId: string | null }

export default function TeamTimePage() {
  const { can, whoami } = useShell();
  const [members, setMembers] = useState<Member[]>([]);
  const [date, setDate] = useState(TODAY);
  const [reports, setReports] = useState<Record<string, any>>({});
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [deciding, setDeciding] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(() => {
    setState("loading");
    fetch("/api/org/employees?limit=100")
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) { setState("denied"); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(async (d) => {
        if (!d) return;
        const all: Member[] = d.employees ?? [];
        const selfId = whoami?.employeeId ?? null;
        const team = selfId
          ? all.filter((e) => e.managerId === selfId || e.id === selfId)
          : all;
        const withoutSelf = team.filter((e) => e.id !== selfId);
        const list = withoutSelf.length ? withoutSelf : team;
        setMembers(list);
        const results: Record<string, any> = {};
        await Promise.all(
          list.map(async (m) => {
            const res = await fetch(`/api/time/reports/${m.id}?date=${date}`);
            if (res.ok) results[m.id] = await res.json();
          }),
        );
        setReports(results);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, [date, whoami?.employeeId]);

  useEffect(() => {
    if (can("time.dar.review")) load(); else setState("denied");
  }, [can, load]);

  async function openPlan(report: any) {
    if (!report?.planStatus) return;
    setMsg(null);
    // Look up the plan id via the reports payload (plan is not embedded) — fetch via plans endpoint.
    const res = await fetch(`/api/time/plans?date=${date}&employeeId=${report.employee.id}`);
    if (!res.ok) { setMsg({ type: "error", text: "Could not load plan." }); return; }
    const d = await res.json().catch(() => ({}));
    if (!d.plan) { setMsg({ type: "error", text: "No plan for this date." }); return; }
    setDeciding(d.plan.id);
  }

  async function review(planId: string) {
    setMsg(null);
    const res = await fetch(`/api/time/plans/${planId}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ type: "error", text: d.error ?? `HTTP ${res.status}` }); return; }
    setMsg({ type: "ok", text: "Plan reviewed." });
    setDeciding(null);
    load();
  }

  if (state === "denied") return <div className="state-panel-error">You do not have permission to review team time.</div>;
  if (state === "error") return <div className="state-panel-error">Failed to load team time.</div>;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Team Time</h1>
          <p className="muted">time.dar.review · daily plans &amp; attendance</p>
        </div>
      </div>

      {msg && <div className={msg.type === "ok" ? "state-panel-ok" : "state-panel-error"}>{msg.text}</div>}

      <div className="panel">
        <div className="toolbar">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {state === "loading" ? (
          <div className="state-panel-info">Loading…</div>
        ) : members.length === 0 ? (
          <div className="state-panel-empty">No team members in your reporting line.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Employee</th><th>Plan</th><th>Planned</th><th>Actual</th><th>Done</th><th>Blocked</th><th>Recorded</th><th></th></tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const r = reports[m.id];
                return (
                  <tr key={m.id}>
                    <td>{m.displayName}</td>
                    <td>{r?.planStatus ? <span className={planBadge(r.planStatus)}>{r.planStatus}</span> : <span className="muted">—</span>}</td>
                    <td className="mono">{r ? formatMinutes(r.report?.plannedMinutes) : "—"}</td>
                    <td className="mono">{r ? formatMinutes(r.report?.actualMinutes) : "—"}</td>
                    <td className="mono">{r?.report?.completed ?? "—"}</td>
                    <td className="mono">{r?.report?.blocked ?? "—"}</td>
                    <td className="mono">{r ? formatMinutes(r.recordedMinutes) : "—"}</td>
                    <td>
                      {r?.planStatus === "submitted" && (
                        <button className="btn btn-secondary" onClick={() => openPlan(r)}>Review</button>
                      )}
                      {deciding && r?.planStatus === "submitted" && (
                        <button className="btn btn-primary" style={{ marginLeft: 6 }} onClick={() => review(deciding)}>Confirm review</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
