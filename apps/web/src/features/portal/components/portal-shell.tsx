"use client";

import React from "react";
import { LifeBuoy, FileCheck, FileText, LayoutDashboard, Building2, User } from "lucide-react";

interface PortalShellProps {
  accountName: string;
  contactName: string;
  contactEmail: string;
  activeTab: "overview" | "tickets" | "deliverables" | "invoices";
  onTabChange: (tab: "overview" | "tickets" | "deliverables" | "invoices") => void;
  children: React.ReactNode;
}

export function PortalShell({
  accountName,
  contactName,
  contactEmail,
  activeTab,
  onTabChange,
  children,
}: PortalShellProps) {
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "tickets", label: "Support Desk", icon: LifeBuoy },
    { id: "deliverables", label: "Deliverables & Approvals", icon: FileCheck },
    { id: "invoices", label: "Invoices & Billing", icon: FileText },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">{accountName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Client Portal
                </span>
              </div>
              <p className="text-xs text-muted-foreground">OpsEngine Customer Collaboration Desk</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-foreground">{contactName}</span>
              <span className="text-[11px] text-muted-foreground">{contactEmail}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground border">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Tab Links */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-border/40 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <p>Secured by OpsEngine Enterprise Multi-Tenant Trust & Compliance Mesh</p>
      </footer>
    </div>
  );
}
