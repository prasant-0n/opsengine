"use client";

import React, { useState } from "react";
import { X, Send, AlertTriangle } from "lucide-react";
import {
  PORTAL_TICKET_TYPES,
  PORTAL_TICKET_PRIORITIES,
  SLA_TARGETS,
} from "../lib/portal-sla";

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    type: string;
    priority: string;
  }) => Promise<void>;
}

export function PortalNewTicketModal({
  isOpen,
  onClose,
  onSubmit,
}: NewTicketModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("bug");
  const [priority, setPriority] = useState<string>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ title, description, type, priority });
      setTitle("");
      setDescription("");
      setType("bug");
      setPriority("medium");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const currentSla = SLA_TARGETS[priority as keyof typeof SLA_TARGETS];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold">Submit Support Ticket</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Our technical support and delivery team will be notified immediately according to SLA targets.
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Ticket Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Authentication failure in staging environment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Category
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PORTAL_TICKET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm capitalize focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PORTAL_TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SLA Indicator */}
          {currentSla && (
            <div className="p-3 bg-muted/60 border rounded-lg text-xs flex justify-between items-center">
              <span className="text-muted-foreground">Guaranteed SLA Target:</span>
              <span className="font-semibold text-foreground">
                {currentSla.responseHours}h response / {currentSla.resolutionHours}h resolution
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Detailed Description
            </label>
            <textarea
              rows={4}
              placeholder="Describe the steps to reproduce, expected vs actual behavior, or service request details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
