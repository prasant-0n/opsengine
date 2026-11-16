"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";
import { formatMinutes, weekRange, sumTimeEntries } from "@/features/time/lib/time";

const TODAY = new Date().toISOString().slice(0, 10);

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Employee { id: string; displayName: string }

export default function TimesheetsPage() {
  const { can } = useShell();
  const [weekAnchor, setWeekAnchor] = useState(TODAY);
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");

  const range = weekRange(weekAnchor);
  const isTeamView = can("time.dar.review");

  useEffect(() => {
    if (!isTeamView) return;
    fetch("/api/org/employees?limit=100")
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => setEmployees((d.employees ?? []).map((e: any) => ({ id: e.id, displayName: e.displayName }))))
      .catch(() => {});
  }, [isTeamView]);

  const load = useCallback(() => {
    setState("loading");
    const params = new URLSearchParams({ from: range.start, to: range.end });
    if (employeeId) params.set("employeeId", employeeId);
    fetch(`/api/time/entries?${params.toString()}`)
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) { setState("denied"); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { if (d) { setEntries(d.entries ?? []); setTotals(d.totals ?? sumTimeEntries(d.entries ?? [])); setState("ok"); } })
      .catch(() => setState("error"));
  }, [range.start, range.end, employeeId]);

  useEffect(() => {
    if (can("time.entry.read_self")) load(); else setState("denied");
  }, [can, load]);

  if (state === "denied") return <div className="state-panel-error">You do not have permission to view time entries.</div>;
  if (state === "error") return <div className="state-panel-error">Failed to load timesheets.</div>;

  // Group by date
  const byDate = new Map<string, any[]>();
  for (const e of entries) {
    const key = new Date(e.entryDate).toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(e);
  }
  const days = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Timesheets</h1>
          <p className="muted">time.entry.read_self · weekly worklog</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => setWeekAnchor(shiftDate(weekAnchor, -7))}>← Prev</button>
          <button className="btn btn-secondary" onClick={() => setWeekAnchor(TODAY)}>This week</button>
          <button className="btn btn-secondary" onClick={() => setWeekAnchor(shiftDate(weekAnchor, 7))}>Next →</button>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <span className="mono muted">{range.start} → {range.end}</span>
          {isTeamView && (
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">— me —</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.displayName}</option>)}
            </select>
          )}
        </div>

        {state === "loading" ? (
          <div className="state-panel-info">Loading…</div>
        ) : days.length === 0 ? (
          <div className="state-panel-empty">No time logged in this week.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Project</th><th>Ticket</th><th>Minutes</th><th>Billable</th><th>Note</th></tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <Fragment key={day}>
                  <tr className="row-group">
                    <td colSpan={6}><strong className="mono">{day}</strong></td>
                  </tr>
                  {byDate.get(day)!.map((e) => (
                    <tr key={e.id}>
                      <td />
                      <td className="muted">{e.projectName ?? "—"}</td>
                      <td className="muted">{e.ticketTitle ?? "—"}</td>
                      <td className="mono">{formatMinutes(e.minutes)}</td>
                      <td>{e.billable ? <span className="badge badge-tertiary">billable</span> : <span className="badge badge-outline">—</span>}</td>
                      <td className="muted">{e.note ?? "—"}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}

        {totals && (
          <p className="muted mono" style={{ marginTop: 8 }}>
            total {formatMinutes(totals.totalMinutes)} · billable {formatMinutes(totals.billableMinutes)} · non-billable {formatMinutes(totals.nonBillableMinutes)}
          </p>
        )}
      </div>
    </div>
  );
}
