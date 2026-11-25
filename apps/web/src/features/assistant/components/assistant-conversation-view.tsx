"use client";

import * as React from "react";
import { useAssistant } from "./assistant-context";
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
} from "lucide-react";

const SUGGESTED_PROMPTS = [
  "How many active employees are in our organization?",
  "List unpaid invoices and upcoming due dates.",
  "What is the status of active delivery projects?",
  "Explain our approval and Separation of Duties rules.",
];

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
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
    return part;
  });
}

function FormattedMessageText({ text }: { text: string }) {
  const paragraphs = text.split("\n\n");

  return (
    <div className="space-y-2.5">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n");

        if (para.startsWith("```") && para.endsWith("```")) {
          const codeContent = para.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre
              key={pIdx}
              className="p-3 my-2 rounded-lg bg-muted/80 border border-border text-xs font-mono overflow-x-auto text-foreground"
            >
              <code>{codeContent}</code>
            </pre>
          );
        }

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
  } = useAssistant();

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
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

  return (
    <div className="flex flex-col h-full justify-between overflow-hidden bg-background">
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

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8 sm:py-12 px-2">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-4 shadow-xs">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
              OpsEngine AI Assistant
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Ask questions about your workforce, invoices, delivery sprints, or governance policies. All queries are audited within your tenant boundary.
            </p>

            <div className="w-full mt-6 space-y-2 text-left max-w-md">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block px-0.5">
                Suggested queries
              </span>
              <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-2`}>
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      send(prompt);
                      onPromptClick?.();
                    }}
                    disabled={loading || !canUse}
                    className="p-3 rounded-lg text-xs text-left bg-card hover:bg-secondary/70 border border-border hover:border-foreground/20 text-foreground transition-all duration-150 leading-snug group flex items-start justify-between gap-2 shadow-xs"
                  >
                    <span className="font-medium text-foreground/90 group-hover:text-foreground">{prompt}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2.5 items-start ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-card border border-border text-foreground flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
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

                {m.role === "assistant" && !m.isError && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                      OpsEngine AI · Gemini
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(m.text, m.id)}
                      className="opacity-70 group-hover:opacity-100 transition-opacity p-0.5 hover:text-foreground flex items-center gap-1"
                      title="Copy response"
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
                  </div>
                )}
              </div>

              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-2.5 items-start justify-start">
            <div className="w-7 h-7 rounded-lg bg-card border border-border text-foreground flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border border-border text-foreground rounded-2xl rounded-bl-xs px-4 py-3 text-xs shadow-xs flex items-center gap-2.5">
              <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
              </div>
              <span className="text-muted-foreground text-xs font-mono">Querying workspace graph &amp; context…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="p-3 border-t border-border bg-card/60 backdrop-blur-xs">
        <div className="relative flex flex-col bg-card rounded-xl border border-border shadow-xs focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all p-2">
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
                : "Ask OpsEngine AI... (Enter to send)"
            }
            className="w-full resize-none bg-transparent px-1.5 py-1 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none border-none max-h-32 overflow-y-auto no-scrollbar disabled:cursor-not-allowed leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Controlled ReBAC Engine
            </span>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground font-mono">
                <CornerDownLeft className="w-2.5 h-2.5 mr-0.5" /> Enter
              </span>
              <button
                type="button"
                onClick={() => send()}
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

        {messages.length > 0 && (
          <div className="flex items-center justify-end mt-1.5 px-1">
            <button
              type="button"
              onClick={clearConversation}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors text-[11px] font-mono"
            >
              <RotateCcw className="w-3 h-3" /> Clear conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
