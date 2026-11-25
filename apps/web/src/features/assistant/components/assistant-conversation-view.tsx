"use client";

import * as React from "react";
import { useAssistant, ChatMessage, ToneMode } from "./assistant-context";
import { useShell } from "@/components/layout/shell-context";
import {
  Send,
  Loader2,
  Bot,
  User,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  ArrowUpRight,
  ShieldCheck,
  CornerDownLeft,
  Sparkles,
  Plus,
  Clock,
  Download,
  FileText,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  Trash2,
  Command,
  CheckCircle2,
  Share2,
  Printer,
  X,
} from "lucide-react";

const SUGGESTED_PROMPTS = [
  {
    category: "Governance & SoD",
    prompt: "Explain our approval and Separation of Duties rules.",
    desc: "Four-Eyes controls, approval state machine, and delegation safety",
  },
  {
    category: "Workforce & Headcount",
    prompt: "How many active employees are in our organization?",
    desc: "Active headcount, department distribution, and seat utilization",
  },
  {
    category: "Finance & Invoices",
    prompt: "List unpaid invoices and upcoming due dates.",
    desc: "Overdue client receivables, totals in currency, and aging",
  },
  {
    category: "Project Delivery",
    prompt: "What is the status of active delivery projects?",
    desc: "Milestones, sprint allocations, and client deliverable sign-offs",
  },
];

const SLASH_COMMANDS = [
  {
    cmd: "/audit",
    title: "Separation of Duties & Approval Rules",
    desc: "Scan authorization matrices, 4-Eyes policy, and delegation rules",
    prompt: "Explain our approval and Separation of Duties rules.",
  },
  {
    cmd: "/headcount",
    title: "Workforce Directory & Headcount",
    desc: "Summarize active employees, departments, and seat allocation",
    prompt: "How many active employees are in our organization?",
  },
  {
    cmd: "/invoices",
    title: "Unpaid Invoices & Receivables",
    desc: "List overdue customer invoices, due dates, and totals",
    prompt: "List unpaid invoices and upcoming due dates.",
  },
  {
    cmd: "/projects",
    title: "Project Delivery Sprints",
    desc: "Scan active projects, milestones, and deliverables status",
    prompt: "What is the status of active delivery projects?",
  },
  {
    cmd: "/clear",
    title: "Clear Current Conversation",
    desc: "Reset the active chat session context",
    isAction: true,
  },
];

function renderInlineMarkdown(text: string) {
  // Regex to match **bold**, `code`, and citations like [1] or [Invoice Ledger]
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[(?:\d+|[A-Za-z\s]+)\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground border border-border/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("[") && part.endsWith("]")) {
      const label = part.slice(1, -1);
      return (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-1.5 py-0.2 mx-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-medium hover:bg-primary/20 transition-colors cursor-help select-none"
          title={`Verified source citation: ${label}`}
        >
          <ShieldCheck className="w-2.5 h-2.5 text-primary shrink-0" />
          {label}
        </span>
      );
    }
    return part;
  });
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = React.useState(false);
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg border border-border overflow-hidden bg-card shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80 border-b border-border text-[11px] font-mono text-muted-foreground">
        <span className="uppercase font-semibold tracking-wider">{lang || "CODE"}</span>
        <button
          type="button"
          onClick={copyCode}
          className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3 text-xs font-mono overflow-x-auto text-foreground leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function parseMarkdownTable(para: string) {
  const lines = para.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length >= 2 && lines[0].includes("|") && lines[1].includes("---")) {
    const headers = lines[0]
      .split("|")
      .map((h) => h.trim())
      .filter((h) => h.length > 0);
    const rows = lines.slice(2).map((row) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""))
    );
    return { headers, rows };
  }
  return null;
}

function FormattedMessageText({ text }: { text: string }) {
  const paragraphs = text.split("\n\n");

  return (
    <div className="space-y-3">
      {paragraphs.map((para, pIdx) => {
        // Check for code blocks
        if (para.startsWith("```") && para.endsWith("```")) {
          const lines = para.split("\n");
          const firstLine = lines[0] ?? "```";
          const lang = firstLine.replace(/^```/, "").trim();
          const codeContent = lines.slice(1, -1).join("\n");
          return <CodeBlock key={pIdx} code={codeContent} lang={lang} />;
        }

        // Check for markdown tables
        const table = parseMarkdownTable(para);
        if (table) {
          return (
            <div key={pIdx} className="overflow-x-auto my-3 rounded-lg border border-border shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-secondary/70 text-foreground font-semibold border-b border-border">
                  <tr>
                    {table.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 font-medium">
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {table.rows.map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-secondary/20 transition-colors odd:bg-secondary/10">
                      {r.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 tabular-nums">
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const lines = para.split("\n");

        // Check if all lines in this paragraph are bullet points
        const isBulletList =
          lines.length > 0 &&
          lines.every(
            (line) =>
              line.trim().startsWith("- ") ||
              line.trim().startsWith("* ") ||
              /^\d+\.\s/.test(line.trim())
          );

        if (isBulletList) {
          return (
            <ul key={pIdx} className="space-y-1.5 my-1 pl-1">
              {lines.map((line, lIdx) => {
                const cleanLine = line.trim().replace(/^[-*]\s+|\d+\.\s+/, "");
                return (
                  <li key={lIdx} className="flex items-start gap-2 text-xs sm:text-sm">
                    <span className="text-muted-foreground mt-1 text-[8px] leading-none select-none">•</span>
                    <span className="leading-relaxed">{renderInlineMarkdown(cleanLine)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Check for markdown headers
        if (para.startsWith("### ")) {
          return (
            <h4 key={pIdx} className="font-semibold text-sm text-foreground tracking-tight mt-3 mb-1">
              {renderInlineMarkdown(para.replace(/^###\s+/, ""))}
            </h4>
          );
        }
        if (para.startsWith("## ")) {
          return (
            <h3 key={pIdx} className="font-semibold text-base text-foreground tracking-tight mt-4 mb-1 border-b border-border/40 pb-1">
              {renderInlineMarkdown(para.replace(/^##\s+/, ""))}
            </h3>
          );
        }

        return (
          <p key={pIdx} className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInlineMarkdown(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function AssistantConversationView({
  compact = false,
  onPromptClick,
}: {
  compact?: boolean;
  onPromptClick?: () => void;
}) {
  const {
    messages,
    input,
    setInput,
    loading,
    error,
    enabled,
    canUse,
    send,
    clearConversation,
    threads,
    currentThreadId,
    createNewThread,
    selectThread,
    deleteThread,
    toneMode,
    setToneMode,
    setMessageFeedback,
    regenerateLastMessage,
  } = useAssistant();

  const { whoami } = useShell();

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // UI state for menus
  const [historyMenuOpen, setHistoryMenuOpen] = React.useState(false);
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = React.useState(0);
  const [lastUserPrompt, setLastUserPrompt] = React.useState("");

  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Auto-expand textarea height
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportMarkdown = () => {
    const content = messages
      .map((m) => `### ${m.role === "user" ? "User" : "OpsEngine AI"}\n${m.text}\n`)
      .join("\n---\n\n");
    navigator.clipboard.writeText(content);
    setExportMenuOpen(false);
    alert("Full conversation copied to clipboard as Markdown!");
  };

  const handleDownloadReport = () => {
    const activeThread = threads.find((t) => t.id === currentThreadId);
    const title = activeThread?.title ?? "OpsEngine Report";
    const content =
      `# OpsEngine AI Report — ${title}\n` +
      `Tenant: ${whoami?.tenantName ?? "Default"} (${whoami?.tenantSlug ?? "default"})\n` +
      `Generated on: ${new Date().toLocaleString()}\n` +
      `Policy Engine: Verified ReBAC Boundary\n\n` +
      messages.map((m) => `### ${m.role === "user" ? "User" : "OpsEngine AI"}\n${m.text}\n`).join("\n---\n\n");

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OpsEngine_Report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  // Slash commands filtering
  const showSlashMenu = input.startsWith("/");
  const filteredSlash = React.useMemo(() => {
    if (!showSlashMenu) return [];
    const query = input.slice(1).toLowerCase();
    return SLASH_COMMANDS.filter(
      (c) => c.cmd.slice(1).includes(query) || c.title.toLowerCase().includes(query)
    );
  }, [input, showSlashMenu]);

  const handleSelectSlash = (item: (typeof SLASH_COMMANDS)[0]) => {
    setInput("");
    if (item.isAction) {
      clearConversation();
      return;
    }
    if (item.prompt) {
      setLastUserPrompt(item.prompt);
      send(item.prompt);
      onPromptClick?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If slash menu is active, handle ArrowUp/Down and Enter selection
    if (showSlashMenu && filteredSlash.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredSlash.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredSlash.length) % filteredSlash.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const selected = filteredSlash[selectedSlashIndex] ?? filteredSlash[0];
        if (selected) handleSelectSlash(selected);
        return;
      }
      if (e.key === "Escape") {
        setInput("");
        return;
      }
    }

    // Up Arrow in empty input recalls last prompt
    if (e.key === "ArrowUp" && !input.trim() && lastUserPrompt) {
      e.preventDefault();
      setInput(lastUserPrompt);
      return;
    }

    // Normal Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        setLastUserPrompt(input.trim());
        send();
      }
    }
  };

  if (enabled === null) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
        <p className="text-xs font-mono text-muted-foreground">Checking AI workspace entitlement…</p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 mb-3 inline-flex">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">AI Module Disabled</h3>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          AI assistant capabilities are currently inactive for this organization workspace. Please contact your system administrator to activate AI entitlements.
        </p>
      </div>
    );
  }

  const activeThread = threads.find((t) => t.id === currentThreadId);

  return (
    <div className="flex flex-col h-full justify-between overflow-hidden bg-background relative">
      {/* Top Header Bar: Session Switcher, Tone Pill, Export */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/60 shrink-0 text-xs gap-2">
        {/* Left: Thread History Dropdown & New Chat */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setHistoryMenuOpen(!historyMenuOpen)}
              className="px-2.5 py-1 rounded-md bg-secondary/80 hover:bg-secondary border border-border flex items-center gap-1.5 text-foreground transition-colors font-medium truncate max-w-[150px] sm:max-w-[200px]"
              title={activeThread?.title}
            >
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{activeThread?.title || "Conversations"}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>

            {/* History Dropdown */}
            {historyMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border/50">
                  <span>Chat Threads</span>
                  <button
                    type="button"
                    onClick={() => {
                      createNewThread();
                      setHistoryMenuOpen(false);
                    }}
                    className="text-primary hover:underline font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-2.5 h-2.5" /> New
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                  {threads.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors group ${
                        t.id === currentThreadId
                          ? "bg-primary/10 text-primary font-medium border border-primary/20"
                          : "hover:bg-secondary text-foreground"
                      }`}
                      onClick={() => {
                        selectThread(t.id);
                        setHistoryMenuOpen(false);
                      }}
                    >
                      <span className="truncate flex-1 mr-2">{t.title}</span>
                      {threads.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteThread(t.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 transition-opacity"
                          title="Delete thread"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={createNewThread}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Start New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Tone Mode Switcher */}
        <div className="hidden sm:inline-flex items-center p-0.5 rounded-lg bg-secondary/80 border border-border text-[11px] font-medium text-muted-foreground">
          {(["standard", "executive", "audit"] as ToneMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setToneMode(mode)}
              className={`px-2 py-0.5 rounded capitalize transition-all ${
                toneMode === mode
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Right: Export Menu & Clear */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Export Report"
            >
              <Download className="w-4 h-4" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-card border border-border rounded-xl shadow-2xl p-1 z-50 space-y-0.5 text-xs">
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-secondary flex items-center gap-2 text-foreground"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Copy as Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-secondary flex items-center gap-2 text-foreground"
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Download .md Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-secondary flex items-center gap-2 text-foreground"
                >
                  <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Clear Thread"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Top Banner if error */}
      {error && (
        <div className="mx-3 mt-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between">
          <span className="truncate">{error}</span>
          <button
            type="button"
            onClick={() => send()}
            className="text-[11px] underline ml-2 font-medium shrink-0 hover:opacity-80 transition-opacity"
          >
            Retry
          </button>
        </div>
      )}

      {/* Messages Scroll Area (Focused Column) */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-6 space-y-6">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-8 sm:py-14 px-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-4 shadow-sm">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                OpsEngine Enterprise Intelligence
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
                Autonomous, policy-bounded operations assistant for your workforce, invoices, projects, and regulatory Separation of Duties.
              </p>

              {/* Active Governance Pills */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                  🏢 {whoami?.tenantName ?? "Acme Global Enterprise"}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                  🛡️ {whoami?.roles?.map((r) => r.key).join(", ") || "ADMIN"}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  ⚡ ReBAC Governed
                </span>
              </div>

              {/* 4 Rich Domain Cards in 2x2 Grid */}
              <div className="w-full mt-8 space-y-2.5 text-left">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block px-0.5">
                  Operational Command Capabilities
                </span>
                <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-2.5`}>
                  {SUGGESTED_PROMPTS.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setLastUserPrompt(item.prompt);
                        send(item.prompt);
                        onPromptClick?.();
                      }}
                      disabled={loading || !canUse}
                      className="p-3.5 rounded-xl text-xs text-left bg-card hover:bg-secondary/70 border border-border hover:border-foreground/20 text-foreground transition-all duration-150 group flex flex-col justify-between gap-2 shadow-xs hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-foreground tracking-tight">{item.category}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                      </div>
                      <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-2">
                        {item.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 items-start ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-card border border-border text-foreground flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] rounded-2xl px-4 py-3.5 text-xs sm:text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground font-medium rounded-br-xs shadow-xs"
                      : m.isError
                      ? "bg-destructive/10 border border-destructive/20 text-destructive rounded-bl-xs"
                      : "bg-card border border-border text-foreground rounded-bl-xs shadow-xs"
                  }`}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap select-text">{m.text}</p>
                  ) : (
                    <FormattedMessageText text={m.text} />
                  )}

                  {/* Assistant Footer & Action Toolbar */}
                  {m.role === "assistant" && !m.isError && (
                    <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span>{m.modelUsed ?? "Gemini 1.5"} · Verified</span>
                      </span>

                      {/* Interactive Action Toolbar */}
                      <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        {/* Copy button */}
                        <button
                          type="button"
                          onClick={() => handleCopy(m.text, m.id)}
                          className="p-1 rounded hover:bg-secondary hover:text-foreground transition-colors flex items-center gap-1"
                          title="Copy text"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Regenerate button */}
                        <button
                          type="button"
                          onClick={regenerateLastMessage}
                          className="p-1 rounded hover:bg-secondary hover:text-foreground transition-colors flex items-center gap-0.5"
                          title="Regenerate answer"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>

                        {/* Feedback buttons */}
                        <button
                          type="button"
                          onClick={() => setMessageFeedback(m.id, m.feedback === "helpful" ? null : "helpful")}
                          className={`p-1 rounded transition-colors ${
                            m.feedback === "helpful" ? "text-emerald-500 bg-emerald-500/10" : "hover:text-foreground"
                          }`}
                          title="Helpful"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessageFeedback(m.id, m.feedback === "unhelpful" ? null : "unhelpful")}
                          className={`p-1 rounded transition-colors ${
                            m.feedback === "unhelpful" ? "text-rose-500 bg-rose-500/10" : "hover:text-foreground"
                          }`}
                          title="Not helpful"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5 text-xs font-semibold">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Thinking / Streaming Indicator */}
          {loading && (
            <div className="flex gap-3 items-start justify-start">
              <div className="w-8 h-8 rounded-xl bg-card border border-border text-foreground flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border text-foreground rounded-2xl rounded-bl-xs px-4 py-3 text-xs shadow-xs flex items-center gap-3">
                <div className="flex space-x-1.5">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                </div>
                <span className="text-muted-foreground text-xs font-mono">
                  Synthesizing enterprise intelligence…
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Glassmorphic Composer Dock */}
      <div className="p-3 sm:p-4 border-t border-border bg-card/70 backdrop-blur-md relative z-20">
        <div className="max-w-3xl mx-auto w-full relative">
          {/* Slash Commands Palette Popover */}
          {showSlashMenu && filteredSlash.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 right-0 bg-card border border-border rounded-xl shadow-2xl p-1 z-50 max-h-56 overflow-y-auto no-scrollbar">
              <div className="px-2.5 py-1 text-[10px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border/40">
                Quick Commands (Enter to run)
              </div>
              {filteredSlash.map((item, index) => (
                <button
                  key={item.cmd}
                  type="button"
                  onClick={() => handleSelectSlash(item)}
                  className={`w-full text-left p-2 rounded-lg flex items-center justify-between text-xs transition-colors ${
                    index === selectedSlashIndex
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold px-1 py-0.5 rounded bg-muted/50 text-[10px]">
                      {item.cmd}
                    </span>
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[10px] opacity-70 truncate max-w-[150px]">{item.desc}</span>
                </button>
              ))}
            </div>
          )}

          <div className="relative flex flex-col bg-card rounded-2xl border border-border shadow-md focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all p-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !canUse}
              placeholder={
                !canUse
                  ? "Permission required: assistant.use"
                  : "Ask anything, or type / for commands..."
              }
              className="w-full resize-none bg-transparent px-2 py-1 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none border-none max-h-36 overflow-y-auto no-scrollbar disabled:cursor-not-allowed leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1.5 border-t border-border/40 mt-1.5">
              {/* Context Indicator Badges */}
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <span className="hidden sm:inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {whoami?.tenantName ?? "Acme Global"}
                </span>
                <span className="text-border">·</span>
                <span className="capitalize">{toneMode} Mode</span>
              </div>

              {/* Shortcut hint & Send button */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground font-mono">
                  <CornerDownLeft className="w-2.5 h-2.5 mr-0.5" /> ↵ Send
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (input.trim()) {
                      setLastUserPrompt(input.trim());
                      send();
                    }
                  }}
                  disabled={loading || !input.trim() || !canUse}
                  className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                  aria-label="Send message"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
