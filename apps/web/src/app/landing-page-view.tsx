"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BrandMark } from "@/components/layout/brand";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  ShieldCheck,
  Users,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Terminal,
  Cpu,
  Lock,
  Workflow,
  Receipt,
  ChevronRight,
} from "lucide-react";

const STATS = [
  { value: "99.99%", label: "Uptime SLA", sub: "Enterprise High Availability" },
  { value: "< 24ms", label: "P99 Response", sub: "Global Edge Low Latency" },
  { value: "100%", label: "Tenant Isolation", sub: "Row-Level ReBAC & Encrypted" },
  { value: "14+", label: "Integrated Modules", sub: "CRM, HRMS, Projects & Ledger" },
];

const MODULE_TABS = [
  {
    id: "crm",
    name: "CRM & Presales",
    tag: "Revenue Engine",
    icon: BarChart3,
    headline: "Unified pipeline from prospecting to commercial proposal approval.",
    desc: "Track leads, accounts, and RFP estimates with automated margin calculation and multi-tier executive approval workflows before project handover.",
    bullets: [
      "Dynamic conversion stage pipeline with deal scoring",
      "Presales cost matrix & gross margin safety thresholds",
      "Automatic project handover upon contract closure",
      "Full revision audit trail on all discount exceptions",
    ],
    metric: "$4.2M Pipeline Managed",
  },
  {
    id: "workforce",
    name: "Workforce & HRMS",
    tag: "Darwinbox Grade",
    icon: Users,
    headline: "Complete employee lifecycle from ATS interview to probation sign-off.",
    desc: "Hierarchical reporting lines, automated shift check-in/out, biometric geo-fencing, leave balances, and confidential document vaults with fine-grained access control.",
    bullets: [
      "Multi-stage ATS recruitment pipeline & scorecards",
      "Reporting hierarchy with ReBAC scope boundary",
      "Geo-fenced attendance & daily work accomplishment tracking",
      "Granular document encryption for candidate PII",
    ],
    metric: "1,200+ Active Employees",
  },
  {
    id: "projects",
    name: "Projects & Tickets",
    tag: "Execution Velocity",
    icon: Workflow,
    headline: "Predictable delivery with capacity-aware sprint allocation.",
    desc: "Link customer agreements directly to milestones, sprint backlogs, and developer tickets. Real-time utilization heatmaps prevent burnout and delivery delays.",
    bullets: [
      "Milestone-linked ticketing with SLA breach escalations",
      "Resource allocation matrix with over-capacity warnings",
      "Automated Daily Activity Reports (DAR) rollups",
      "Continuous git releases & changelog sync",
    ],
    metric: "98.4% On-Time Milestones",
  },
  {
    id: "finance",
    name: "Finance & Billing",
    tag: "Audit Defensible",
    icon: Receipt,
    headline: "Commercial invoices tied directly to accepted project milestones.",
    desc: "Automate invoice generation from approved timesheets and milestone sign-offs. Reconcile client payments and track DSO with complete fiscal traceability.",
    bullets: [
      "One-click milestone-to-invoice transformation",
      "Taxation & multi-currency billing compliance",
      "Payment reconciliation with payment gateway hooks",
      "Immutable ledger audit log for enterprise audits",
    ],
    metric: "0% Billing Discrepancies",
  },
  {
    id: "ai",
    name: "OpsEngine AI",
    tag: "Context Aware",
    icon: Sparkles,
    headline: "Autonomous intelligence plugged into your enterprise state.",
    desc: "An ambient AI assistant that operates within your security boundary. Draft RFPs, summarize daily blockers, audit SLA risks, and generate executive briefs.",
    bullets: [
      "Zero prompt leakage: strictly tenant-isolated RAG",
      "Action draft mode: humans approve all consequential mutations",
      "Context-aware project risk and sprint delay forecasts",
      "Natural language SQL-free querying across HR & CRM",
    ],
    metric: "3.4 hrs Saved / Week / Lead",
  },
];

const SECURITY_PILLARS = [
  {
    icon: Lock,
    title: "SaaS-First Tenant Isolation",
    desc: "Every query, job, file, and event carries cryptographic tenant context. Cross-tenant access is physically impossible at the database and gateway levels.",
  },
  {
    icon: ShieldCheck,
    title: "Granular ReBAC & Hierarchy Engine",
    desc: "Permissions are computed in real-time based on managerial hierarchy, SBU division, and project assignments, never brittle static role strings.",
  },
  {
    icon: Terminal,
    title: "Immutable Business Audit Log",
    desc: "Every critical mutation—from discount overrides to employee promotions—is recorded with actor IP, tenant ID, and state diffs for audit compliance.",
  },
  {
    icon: Cpu,
    title: "Human-in-the-Loop Governance",
    desc: "AI prepares drafts, flags delivery anomalies, and generates insights, but cannot approve financial releases, hires, or code deployments without human sign-off.",
  },
];

const FAQS = [
  {
    q: "How does OpsEngine isolate data between multiple corporate tenants?",
    a: "Every tenant is isolated at the data layer using tenant_id foreign key constraints, Prisma middleware enforcement, and server-side ReBAC token verification. Request payloads cannot override authenticated tenant scope.",
  },
  {
    q: "Can OpsEngine replace standalone HRMS tools like Darwinbox or BambooHR?",
    a: "Yes. OpsEngine features candidate applicant tracking (ATS), document-verified preboarding, shift attendance, daily activity reports, team reporting lines, and leave workflows out of the box.",
  },
  {
    q: "How does the Floating AI Assistant integrate into our workflow?",
    a: "The assistant is integrated into the authenticated shell as a discrete floating launcher, dockable drawer, or compact right-edge tab. It shares runtime session context with dashboard views and complies with human-in-the-loop safety principles.",
  },
  {
    q: "Does OpsEngine support custom approvals for finance and proposals?",
    a: "Yes. You can configure multi-level approval hierarchies based on dollar thresholds, SBU division, and project seniority. Approvers receive instant notifications and can approve directly from the mobile-optimized topbar.",
  },
  {
    q: "What deployment options are supported?",
    a: "OpsEngine runs on Docker Compose for localized staging or Kubernetes/Cloud Run for high-volume enterprise clusters. It uses PostgreSQL, Next.js 16 App Router, and standard stateless microservice boundaries.",
  },
];

export default function LandingPageView() {
  const [activeTab, setActiveTab] = React.useState("crm");
  const [activeKpiIndex, setActiveKpiIndex] = React.useState(0);
  const selectedModule = MODULE_TABS.find((m) => m.id === activeTab) || MODULE_TABS[0];

  // Auto-cycle through the 5 modules every 3.5 seconds
  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab((curr) => {
        const currentIndex = MODULE_TABS.findIndex((m) => m.id === curr);
        const nextIndex = (currentIndex + 1) % MODULE_TABS.length;
        return MODULE_TABS[nextIndex].id;
      });
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // Auto-pulse each of the 4 mock dashboard cards every 1 second
  React.useEffect(() => {
    const kpiTimer = setInterval(() => {
      setActiveKpiIndex((curr) => (curr + 1) % 4);
    }, 1000);

    return () => clearInterval(kpiTimer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-[#f1f5f9] selection:bg-[#4f6bf7]/30 selection:text-[#93c5fd] font-sans relative overflow-x-hidden">
      {/* Background Ambient Glow Gradients (Aceternity style) */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] md:w-[1200px] h-[600px] bg-gradient-to-b from-[#4f6bf7]/15 via-[#22d3ee]/5 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-l from-[#6366f1]/10 to-transparent blur-3xl" />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-r from-[#0ea5e9]/10 to-transparent blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0f1d]/80 border-b border-[#1e293b]/70 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <BrandMark size={38} className="transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                OpsEngine
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#4f6bf7]/20 text-[#60a5fa] border border-[#4f6bf7]/30">
                  v1.2
                </span>
              </span>
              <span className="text-[11px] text-[#94a3b8] font-mono tracking-tight hidden sm:block">
                Enterprise Business OS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#94a3b8]">
            <a href="#features" className="hover:text-white transition-colors">
              Platform
            </a>
            <a href="#modules" className="hover:text-white transition-colors">
              Modules
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Security & ReBAC
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              Architecture FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/login"
              className="text-xs sm:text-sm font-medium px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-opacity"
            >
              Launch Console
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 sm:pt-24 lg:pt-28 pb-16 sm:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Enterprise Architecture Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground mb-8 shadow-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span>Multi-Tenant Operations &amp; Workforce ERP</span>
          <span className="text-muted-foreground/60">|</span>
          <span className="font-mono text-[11px] text-foreground">v1.47 Verified</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-[clamp(2.2rem,4vw+0.5rem,3.75rem)] max-w-4xl mx-auto text-foreground font-bold tracking-tight leading-[1.15] text-center"
        >
          Unified Enterprise Operations &amp; Workforce Management
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-body-lg max-w-2xl mx-auto text-muted-foreground mt-6 leading-relaxed font-normal"
        >
          Eliminate fragmented spreadsheets and point solutions. OpsEngine standardizes CRM pipelines,
          statutory HRMS, resource capacity planning, sprint delivery, and milestone-linked billing
          into a mathematically verified, tenant-isolated architecture.
        </motion.p>

        {/* Action CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/auth/login"
            className="w-full sm:w-auto h-11 px-6 rounded-md bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-opacity"
          >
            Launch Console
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#modules"
            className="w-full sm:w-auto h-11 px-6 rounded-md bg-secondary hover:bg-secondary/80 text-foreground border border-border text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            Explore Platform Architecture
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </a>
        </motion.div>

        {/* Trust Endorsements Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#64748b] font-medium"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />
            SOC-2 Type II Scoped
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />
            Zero-Leak Tenant Isolation
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />
            Self-Hosted or Cloud Cluster
          </span>
        </motion.div>

        {/* Dashboard Preview Frame with Glassmorphic Bevel */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-14 sm:mt-20 relative max-w-6xl mx-auto rounded-2xl p-2 bg-gradient-to-b from-[#334155]/60 via-[#1e293b]/30 to-[#0a0f1d] border border-[#334155]/40 shadow-2xl shadow-[#4f6bf7]/10"
        >
          <div className="rounded-xl overflow-hidden bg-[#0b1326] border border-[#1e293b]/90 shadow-2xl">
            {/* Topbar Mock */}
            <div className="h-10 bg-[#0f172a] border-b border-[#1e293b] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]/70" />
                <div className="w-3 h-3 rounded-full bg-[#eab308]/70" />
                <div className="w-3 h-3 rounded-full bg-[#22c55e]/70" />
                <span className="text-[11px] font-mono text-[#64748b] ml-2">opsengine.internal/dashboard</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#94a3b8]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active Session: SBU-Global
              </div>
            </div>

            {/* Dashboard Mock UI Grid */}
            <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-left">
              {[
                {
                  label: "Monthly Recurring Rev",
                  value: "$248,500",
                  sub: "+18.4% vs last month",
                  color: "text-[#22c55e]",
                  accent: "border-[#4f6bf7]",
                },
                {
                  label: "Active Headcount",
                  value: "1,420",
                  sub: "98.6% Check-in compliance",
                  color: "text-[#38bdf8]",
                  accent: "border-[#38bdf8]",
                },
                {
                  label: "Sprint Tickets SLA",
                  value: "99.1%",
                  sub: "0 Critical breaches",
                  color: "text-[#22c55e]",
                  accent: "border-[#22c55e]",
                },
                {
                  label: "Pending Approvals",
                  value: "3 Active",
                  sub: "Requires SBU sign-off",
                  color: "text-[#f59e0b]",
                  accent: "border-[#f59e0b]",
                },
              ].map((kpi, idx) => {
                const isActive = activeKpiIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border transition-colors ${
                      isActive
                        ? "border-primary/60 bg-secondary/70"
                        : "border-border bg-card/60"
                    }`}
                  >
                    <div className="text-xs text-muted-foreground font-medium">{kpi.label}</div>
                    <div className="text-xl sm:text-2xl font-bold text-foreground mt-1 tabular-nums">{kpi.value}</div>
                    <div className={`text-xs ${kpi.color} flex items-center gap-1 mt-2 font-medium`}>
                      {kpi.sub}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats Proof Ribbon */}
      <section className="relative z-10 border-y border-border bg-card/50 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            {STATS.map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <span className="font-display-xl font-bold text-foreground tabular-nums">
                  {stat.value}
                </span>
                <span className="text-sm font-semibold text-foreground mt-1">{stat.label}</span>
                <span className="text-xs text-muted-foreground mt-0.5">{stat.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Module Showcase Section */}
      <section id="modules" className="relative z-10 py-20 sm:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="mb-3 border-[#4f6bf7]/40 text-[#93c5fd]">
            Enterprise Modular Architecture
          </Badge>
          <h2 className="font-display-xl text-white tracking-tight">
            Integrated across the entire client-to-cash lifecycle.
          </h2>
          <p className="font-body-md text-[#94a3b8] mt-4">
            No more messy API webhooks between CRM, HR software, Jira, and accounting systems.
            OpsEngine unifies every business discipline onto one single PostgreSQL ledger.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-xl bg-[#0f172a] border border-[#1e293b] max-w-3xl mx-auto mb-10 relative">
          {MODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors duration-200 cursor-pointer ${isSelected
                  ? "text-white"
                  : "text-[#94a3b8] hover:text-white hover:bg-[#1e293b]/60"
                  }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="activeTabBadge"
                    className="absolute inset-0 bg-[#4f6bf7] rounded-lg shadow-md shadow-[#4f6bf7]/35 -z-10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Active Tab Card Preview with AnimatePresence */}
        <div className="relative min-h-[440px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.99 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl p-6 sm:p-10 bg-[#0f172a]/90 border border-[#1e293b] shadow-2xl backdrop-blur-md grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
            >
              <div className="lg:col-span-6 space-y-4">
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-1 rounded bg-[#4f6bf7]/20 text-[#60a5fa] border border-[#4f6bf7]/30">
                  {selectedModule.tag}
                </span>
                <h3 className="font-headline-xl text-white">{selectedModule.headline}</h3>
                <p className="font-body-md text-[#94a3b8] leading-relaxed">{selectedModule.desc}</p>
                <ul className="space-y-3 pt-2">
                  {selectedModule.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#cbd5e1]">
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 flex items-center gap-4">
                  <Link
                    href="/auth/login"
                    className="text-xs font-semibold px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors"
                  >
                    Configure {selectedModule.name}
                  </Link>
                  <span className="text-xs font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20">
                    {selectedModule.metric}
                  </span>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl bg-[#0a0f1d] border border-[#1e293b] p-4 sm:p-5 font-mono text-xs text-[#cbd5e1] space-y-3 shadow-inner overflow-x-auto w-full max-w-full">
                <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-[11px] text-[#64748b]">
                  <span>TENANT VERIFIED REBAC STREAM</span>
                  <span className="text-[#22c55e]">PASS (200 OK)</span>
                </div>
                <p className="text-[#94a3b8]">
                  {"//"} Zero cross-tenant data leak guarantee (PRD §1.1)
                </p>
                <div className="bg-[#0f172a] p-3 rounded border border-[#1e293b]/70 space-y-1.5">
                  <div>
                    <span className="text-[#f472b6]">mutation</span>{" "}
                    <span className="text-[#38bdf8]">ApproveTransition</span>(
                    <span className="text-[#fbbf24]">$id</span>: ID!) &#123;
                  </div>
                  <div className="pl-4 text-[#94a3b8]">
                    verifyTenantScope(<span className="text-[#60a5fa]">context.tenant_id</span>);
                  </div>
                  <div className="pl-4 text-[#94a3b8]">
                    verifyManagerHierarchy(<span className="text-[#60a5fa]">context.user_id</span>, target);
                  </div>
                  <div className="pl-4 text-[#22c55e]">
                    auditLog.append(event: &quot;APPROVED&quot;, actor: actor.id);
                  </div>
                  <div>&#125;</div>
                </div>
                <div className="text-[11px] text-[#64748b] flex items-center justify-between pt-1">
                  <span>Security Clearance: LEVEL_4_SBU</span>
                  <span>Encrypted TLS 1.3</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Security & ReBAC Trust Section */}
      <section id="security" className="relative z-10 py-20 bg-[#0c1222]/90 border-t border-[#1e293b]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="mb-3 border-[#22c55e]/40 text-[#4ade80]">
              Bank-Grade Compliance
            </Badge>
            <h2 className="font-display-xl text-white tracking-tight">
              Strict isolation. No compromises.
            </h2>
            <p className="font-body-md text-[#94a3b8] mt-3">
              Designed from first principles to pass SOC-2 Type II, ISO 27001, and HIPAA multi-tenant
              software audits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SECURITY_PILLARS.map((sec, idx) => {
              const Icon = sec.icon;
              return (
                <div
                  key={idx}
                  className="rounded-xl p-6 bg-[#0f172a]/70 border border-[#1e293b] hover:border-[#334155] transition-all hover:-translate-y-1 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#4f6bf7]/10 border border-[#4f6bf7]/20 flex items-center justify-center text-[#60a5fa] mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-headline-sm text-white font-semibold mb-2">{sec.title}</h3>
                  <p className="font-body-sm text-[#94a3b8] leading-relaxed">{sec.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Architecture FAQ Section */}
      <section id="faq" className="relative z-10 py-20 sm:py-28 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-3 border-[#38bdf8]/40 text-[#38bdf8]">
            Got Questions?
          </Badge>
          <h2 className="font-display-xl text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="font-body-md text-[#94a3b8] mt-3">
            Everything you need to know about OpsEngine&apos;s architecture and enterprise rollout.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {FAQS.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`faq-${index}`}
              className="rounded-xl bg-[#0f172a]/80 border border-[#1e293b] px-5 shadow-sm"
            >
              <AccordionTrigger className="text-left font-headline-sm text-white hover:text-[#93c5fd] py-4">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="font-body-sm text-[#94a3b8] pb-4 leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Pre-Footer Conversion CTA Banner */}
      <section className="relative z-10 py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl p-8 sm:p-12 bg-card border border-border shadow-md text-center">
          <h2 className="font-display-xl text-foreground font-bold tracking-tight max-w-3xl mx-auto">
            Ready to standardize your enterprise operations?
          </h2>
          <p className="font-body-lg text-muted-foreground max-w-xl mx-auto mt-4">
            Join forward-thinking technology services companies running on OpsEngine.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/login"
              className="w-full sm:w-auto h-12 px-8 rounded-md bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold shadow-sm flex items-center justify-center transition-opacity"
            >
              Access Production Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* Enterprise Footer */}
      <footer className="relative z-10 border-t border-[#1e293b] bg-[#070b16] py-12 text-[#64748b] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandMark size={28} />
            <span className="font-bold text-white tracking-tight">OpsEngine</span>
            <span className="text-[#475569]">|</span>
            <span>Enterprise Multi-Tenant SaaS</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-white transition-colors">
              Platform
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Security
            </a>
            <Link href="/auth/login" className="hover:text-white transition-colors">
              Console Sign In
            </Link>
          </div>
          <div className="text-center sm:text-right">
            &copy; {new Date().getFullYear()} OpsEngine Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
