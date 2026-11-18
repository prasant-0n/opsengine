"use client";

import React, { useState } from "react";
import { CheckCircle2, ExternalLink, ShieldCheck, FileCheck } from "lucide-react";

interface DeliverablesTabProps {
  deliverables: any[];
  onOpenSignOff: (deliverable: any) => void;
}

export function PortalDeliverablesTab({
  deliverables,
  onOpenSignOff,
}: DeliverablesTabProps) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = deliverables.filter((d) => {
    if (filter === "all") return true;
    return d.status === filter;
  });

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        {["all", "pending_review", "approved", "changes_requested"].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
              filter === st
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {st.replace("_", " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center shadow-sm">
          <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h4 className="font-semibold text-base">No deliverables found</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            There are no deliverables currently matching this filter for your account.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-mono uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground">
                    {d.project ? `${d.project.code} · ${d.project.name}` : "General Delivery"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      d.status === "approved"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : d.status === "changes_requested"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {d.status.replace("_", " ")}
                  </span>
                </div>

                <h4 className="font-bold text-base mt-2 text-foreground">{d.title}</h4>
                {d.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{d.description}</p>
                )}

                {d.deliverableUrl && (
                  <a
                    href={d.deliverableUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline mt-3 font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Review Artifact / Deliverable Package
                  </a>
                )}
              </div>

              {/* Sign-off Audit Proof or Call to Action */}
              <div className="mt-5 pt-4 border-t">
                {d.signOffs && d.signOffs.length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>
                        Signed off by {d.signOffs[0].signerName} on{" "}
                        {new Date(d.signOffs[0].signedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground truncate" title={d.signOffs[0].signatureHash}>
                      SHA-256: {d.signOffs[0].signatureHash}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenSignOff(d)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Review & Execute Sign-Off
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
