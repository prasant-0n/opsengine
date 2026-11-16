"use client";

import React, { useState, useEffect } from "react";
import {
  PortalShell,
  PortalOverviewTab,
  PortalTicketsTab,
  PortalNewTicketModal,
  PortalTicketDetailModal,
  PortalDeliverablesTab,
  PortalSignOffModal,
  PortalInvoicesTab,
} from "@/features/portal";
import { LifeBuoy, AlertTriangle } from "lucide-react";

export default function CustomerPortalPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "tickets" | "deliverables" | "invoices">("overview");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [selectedDeliverable, setSelectedDeliverable] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Auth profile
      const authRes = await fetch("/api/portal/auth/me");
      if (!authRes.ok) {
        throw new Error("Unable to resolve client portal authorization context");
      }
      const authData = await authRes.json();
      setUserProfile(authData.data.user);
      setAccount(authData.data.account);

      // 2. Parallel data fetching
      const [ticketsRes, deliverablesRes, invoicesRes] = await Promise.all([
        fetch("/api/portal/tickets"),
        fetch("/api/portal/deliverables"),
        fetch("/api/portal/invoices"),
      ]);

      const [ticketsJson, deliverablesJson, invoicesJson] = await Promise.all([
        ticketsRes.json(),
        deliverablesRes.json(),
        invoicesRes.json(),
      ]);

      setTickets(ticketsJson.data || []);
      setDeliverables(deliverablesJson.data || []);
      setInvoices(invoicesJson.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load customer portal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers
  const handleCreateTicket = async (data: {
    title: string;
    description: string;
    type: string;
    priority: string;
  }) => {
    const res = await fetch("/api/portal/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create ticket");
    }
    const created = await res.json();
    setTickets((prev) => [created.data, ...prev]);
  };

  const handlePostComment = async (ticketId: string, body: string) => {
    const res = await fetch(`/api/portal/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to post comment");
    }
    const data = await res.json();
    return data.data;
  };

  const handleSignOffDeliverable = async (
    deliverableId: string,
    data: {
      status: "approved" | "changes_requested";
      signerName: string;
      signerEmail: string;
      feedbackNotes?: string;
    }
  ) => {
    const res = await fetch(`/api/portal/deliverables/${deliverableId}/signoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to sign off deliverable");
    }
    await loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        <div className="flex flex-col items-center gap-2">
          <LifeBuoy className="w-8 h-8 text-blue-600 animate-spin" />
          <p>Connecting to secure Customer Portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card border rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold">Portal Access Notice</h3>
          <p className="text-xs text-muted-foreground mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <PortalShell
      accountName={account?.name || "Client Workspace"}
      contactName={userProfile?.name || "Client Contact"}
      contactEmail={userProfile?.email || ""}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "overview" && (
        <PortalOverviewTab
          tickets={tickets}
          deliverables={deliverables}
          invoices={invoices}
          onSelectTab={setActiveTab}
          onOpenNewTicket={() => setIsNewTicketOpen(true)}
        />
      )}

      {activeTab === "tickets" && (
        <PortalTicketsTab
          tickets={tickets}
          onOpenTicket={setSelectedTicket}
          onOpenNewTicketModal={() => setIsNewTicketOpen(true)}
        />
      )}

      {activeTab === "deliverables" && (
        <PortalDeliverablesTab
          deliverables={deliverables}
          onOpenSignOff={setSelectedDeliverable}
        />
      )}

      {activeTab === "invoices" && <PortalInvoicesTab invoices={invoices} />}

      {/* Modals */}
      <PortalNewTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onSubmit={handleCreateTicket}
      />

      <PortalTicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onPostComment={handlePostComment}
      />

      <PortalSignOffModal
        deliverable={selectedDeliverable}
        onClose={() => setSelectedDeliverable(null)}
        onSubmit={handleSignOffDeliverable}
        defaultSignerName={userProfile?.name || ""}
        defaultSignerEmail={userProfile?.email || ""}
      />
    </PortalShell>
  );
}
