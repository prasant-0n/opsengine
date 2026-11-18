"use client";

import { useEffect, useState } from "react";
import { useShell } from "@/components/layout/shell-context";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface AuditRow {
  id: string;
  action: string;
  actorUserId: string | null;
  resourceType: string;
  createdAt: string;
}

const KPIS = [
  { label: "Check-in", value: "—", note: "attendance module pending", icon: "schedule" },
  { label: "Tickets", value: "—", note: "work module pending", icon: "checklist" },
  { label: "Approvals", value: "—", note: "approvals module pending", icon: "task_alt" },
  { label: "Daily report", value: "—", note: "reports module pending", icon: "edit_note" },
];

function KpiCard({ label, value, note, icon }: (typeof KPIS)[number]) {
  return (
    <div className="kpi-card group cursor-default">
      <div className="kpi-header">
        <span className="kpi-label font-label-sm text-muted-foreground group-hover:text-primary transition-colors">
          {label}
        </span>
        <span className="material-symbols-outlined icon-sm kpi-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="kpi-value group-hover:scale-105 transition-transform duration-200 origin-left">
        {value}
      </div>
      <div className="kpi-note font-label-sm text-muted-foreground">{note}</div>
    </div>
  );
}

function EmptyPanel({ title, body, icon: Icon }: { title: string; body: string; icon: any }) {
  return (
    <div className="panel flex-1">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <h2 className="panel-title">{title}</h2>
        </div>
      </div>
      <div className="panel-empty">
        <span className="material-symbols-outlined state-panel-icon" aria-hidden="true">
          inbox
        </span>
        <p className="state-panel-body">{body}</p>
      </div>
    </div>
  );
}

function RecentActivity() {
  const { can } = useShell();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");

  const canReadAudit = can("audit.read");

  useEffect(() => {
    if (!canReadAudit) {
      setState("denied");
      return;
    }
    let cancelled = false;
    fetch("/api/admin/audit-events?limit=10")
      .then(async (res) => {
        if (res.status === 403 || res.status === 401) {
          if (!cancelled) setState("denied");
          return null;
        }
        if (!res.ok) {
          if (!cancelled) setState("error");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) {
          setRows(data.events ?? []);
          setState("ok");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [canReadAudit]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="panel-title">Recent activity (audit log)</h2>
        </div>
        <span className="font-label-sm mono text-muted-foreground">last 10 events</span>
      </div>

      {state === "loading" && (
        <div className="panel-empty">
          <p className="state-panel-body animate-pulse">Loading audit log…</p>
        </div>
      )}

      {state === "denied" && (
        <div className="state-panel-denied" role="status">
          <p className="state-panel-body">
            Permission required: <code className="mono">audit.read</code>.
          </p>
          <p className="font-label-sm text-muted-foreground">
            Activity is filtered server-side. Ask your administrator for the Audit
            Reader role.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="state-panel-error" role="alert">
          <p className="state-panel-body">Failed to load recent activity.</p>
        </div>
      )}

      {state === "ok" && rows.length === 0 && (
        <div className="panel-empty">
          <p className="state-panel-body">No audit events recorded for this tenant yet.</p>
        </div>
      )}

      {state === "ok" && rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Resource</th>
                <th scope="col">Actor</th>
                <th scope="col">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono font-semibold text-primary">{r.action}</td>
                  <td>{r.resourceType}</td>
                  <td className="mono text-muted-foreground">
                    {r.actorUserId ? r.actorUserId.slice(0, 8) : "system"}
                  </td>
                  <td className="mono font-label-sm text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { whoami } = useShell();

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="font-headline-lg flex items-center gap-2">
            My Day
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </h1>
          <p className="page-subtitle">
            {whoami
              ? `Signed in · policy v${whoami.policyVersion} · ${whoami.membershipStatus}`
              : "Loading context…"}
          </p>
        </div>
        <Badge variant="default" className="shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5" />
          Enterprise Workspace
        </Badge>
      </div>

      <div className="kpi-grid">
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EmptyPanel
          title="Today's work plan"
          body="No plan items yet — the work module will populate this panel."
          icon={CalendarCheck}
        />
        <EmptyPanel
          title="Team blockers"
          body="No blockers reported — the team module will populate this panel."
          icon={AlertCircle}
        />
      </div>

      {/* Premium SaaS Accordion Overview */}
      <div className="panel">
        <div className="panel-header mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="panel-title">Operations &amp; Security Quick Guide</h2>
          </div>
          <span className="font-label-sm mono text-muted-foreground">SaaS Overview</span>
        </div>

        <Accordion type="single" collapsible defaultValue="tenant-isolation">
          <AccordionItem value="tenant-isolation">
            <AccordionTrigger>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Multi-Tenant Row-Level Isolation (ReBAC Engine)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              Every API request, query, and background job is bounded by your verified
              <code className="mono mx-1.5 px-1 py-0.5 rounded bg-secondary text-primary">tenant_id</code>.
              Data never crosses tenant perimeters, verified with SOC 2 negative test criteria.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="governed-workflows">
            <AccordionTrigger>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <span>Governed Approvals &amp; Separation of Duties (SoD)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              Critical transitions across recruitment, finance invoices, time corrections, and
              software releases require multi-tier authorization with strict self-approval prevention.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="audit-readiness">
            <AccordionTrigger>
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Immutable Audit Trail &amp; Break-Glass Protocol</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              System events are continuously streamed to an append-only audit log with actor ID,
              IP, and change diffs. Break-glass operations trigger emergency security alerts.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <RecentActivity />
    </div>
  );
}
