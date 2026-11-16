"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useShell } from "@/components/layout/shell-context";

interface EmployeeListItem {
  id: string;
  displayName: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  grade: string | null;
  employmentStatus: string;
  location: string | null;
  isSelf: boolean;
}

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "probation", label: "Probation" },
  { value: "notice", label: "Notice period" },
  { value: "preboarding", label: "Preboarding" },
  { value: "exited", label: "Exited" },
];

function statusBadge(status: string): string {
  switch (status) {
    case "active":
      return "badge badge-tertiary";
    case "probation":
    case "preboarding":
      return "badge badge-primary";
    case "notice":
      return "badge badge-outline";
    default:
      return "badge badge-outline";
  }
}

export default function PeoplePage() {
  const { can } = useShell();
  const [rows, setRows] = useState<EmployeeListItem[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const allowed = can("org.read_directory");

  const load = useCallback(
    async (pageNo: number) => {
      setState("loading");
      try {
        const params = new URLSearchParams({ page: String(pageNo), limit: "25" });
        if (q) params.set("q", q);
        if (status) params.set("status", status);
        const res = await fetch(`/api/org/employees?${params.toString()}`);
        if (res.status === 403) {
          setState("denied");
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setRows(data.employees ?? []);
        setHasMore(Boolean(data.hasMore));
        setTotal(data.total ?? 0);
        setPage(pageNo);
        setState("ok");
      } catch {
        setState("error");
      }
    },
    [q, status],
  );

  useEffect(() => {
    if (!allowed) {
      setState("denied");
      return;
    }
    const t = setTimeout(() => load(1), 250); // debounce search
    return () => clearTimeout(t);
  }, [allowed, load]);

  if (!allowed) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h1 className="font-headline-lg">People / HR</h1>
        </div>
        <div className="panel">
          <div className="panel-empty">
            <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
              lock
            </span>
            <p className="state-panel-title">Permission denied</p>
            <p className="state-panel-note mono">missing: org.read_directory</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="font-headline-lg">People / HR</h1>
          <p className="page-subtitle">
            Employee directory · scope-filtered server-side
            {state === "ok" ? ` · ${total} employee${total === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <span className="badge badge-primary">People</span>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Directory</h2>
          <div className="badge-row">
            <input
              className="input input-sm"
              type="search"
              placeholder="Search name, number, job title…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search employees"
            />
            <select
              className="input input-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state === "loading" ? (
          <div className="panel-empty">
            <p className="state-panel-body animate-pulse">Loading directory…</p>
          </div>
        ) : state === "denied" ? (
          <div className="panel-empty">
            <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
              lock
            </span>
            <p className="state-panel-title">Permission denied</p>
            <p className="state-panel-note mono">missing: org.read_directory</p>
          </div>
        ) : state === "error" ? (
          <div className="panel-empty">
            <p className="state-panel-title">Failed to load directory</p>
            <p className="state-panel-note">Try again in a moment.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-empty">
            <p className="state-panel-body">No employees match this view.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Employee #</th>
                  <th scope="col">Job title</th>
                  <th scope="col">Department</th>
                  <th scope="col">Location</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/dashboard/people/${e.id}`} className="link-plain">
                        {e.displayName}
                        {e.isSelf ? (
                          <span className="badge badge-outline" style={{ marginLeft: 8 }}>
                            you
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="mono">{e.employeeNumber ?? "—"}</td>
                    <td>{e.jobTitle ?? "—"}</td>
                    <td>{e.department ?? "—"}</td>
                    <td>{e.location ?? "—"}</td>
                    <td>
                      <span className={statusBadge(e.employmentStatus)}>{e.employmentStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {state === "ok" && (page > 1 || hasMore) ? (
          <div className="panel-header" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => load(page - 1)}
            >
              Previous
            </button>
            <span className="font-label-sm mono">page {page}</span>
            <button
              className="btn btn-outline btn-sm"
              disabled={!hasMore}
              onClick={() => load(page + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
