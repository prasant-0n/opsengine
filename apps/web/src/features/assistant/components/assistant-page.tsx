"use client";

import { useAssistant } from "./assistant-context";
import { AssistantConversationView } from "./assistant-conversation-view";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AssistantPage() {
  const { enabled } = useAssistant();

  if (enabled === null) {
    return (
      <div className="page-stack">
        <div className="state-panel state-panel-empty">Checking AI entitlement…</div>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <div>
            <h1>AI Assistant</h1>
            <p className="muted">Controlled enterprise AI interface</p>
          </div>
        </header>
        <div className="state-panel state-panel-error">
          AI features are not enabled for this organization. Please contact your platform operator to activate this premium feature for your workspace membership.
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack h-[calc(100vh-8rem)]">
      <header className="page-header shrink-0">
        <div>
          <h1 className="flex items-center gap-2">
            AI Assistant
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </h1>
          <p className="muted mono">assistant.use · Powered by Gemini</p>
        </div>
        <Badge variant="default" className="shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5" /> Enterprise Governed
        </Badge>
      </header>

      <div className="panel flex-1 overflow-hidden p-0 rounded-xl border border-border/80 shadow-md">
        <AssistantConversationView />
      </div>
    </div>
  );
}
