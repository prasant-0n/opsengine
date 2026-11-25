"use client";

import * as React from "react";
import { useAssistant } from "./assistant-context";
import { AssistantConversationView } from "./assistant-conversation-view";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { MagneticTooltip } from "@/components/ui/magnetic-tooltip";
import {
  Sparkles,
  Bot,
  X,
  Minimize2,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function FloatingAssistant() {
  const {
    drawerState,
    openDrawer,
    closeDrawer,
    minimizeDrawer,
    canUse,
    enabled,
    messages,
  } = useAssistant();

  const drawerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Close drawer on Escape
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && drawerState === "open") {
        minimizeDrawer();
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerState, minimizeDrawer]);

  // If user does not have permission or AI is explicitly disabled, do not render launcher
  if (!canUse || enabled === false) {
    return null;
  }

  const hasUnreadOrActive = messages.length > 0;

  return (
    <>
      {/* =========================================================================
          State A: Floating Launcher Button (Aceternity / Animate UI Shimmer Standard)
          Visible ONLY when drawer is 'closed'
          ========================================================================= */}
      <AnimatePresence>
        {drawerState === "closed" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <MagneticTooltip content="Open Assistant">
              <button
                ref={triggerRef}
                type="button"
                onClick={openDrawer}
                className="w-12 h-12 rounded-full bg-card hover:bg-secondary text-foreground border border-border shadow-md flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open Assistant"
              >
                <Bot className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />

                {/* Subtle active status dot */}
                {hasUnreadOrActive && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                )}
              </button>
            </MagneticTooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          State C: Minimized Right-Edge Tab (Aceternity Spring Slider)
          Visible ONLY when drawer is 'minimized'
          ========================================================================= */}
      <AnimatePresence>
        {drawerState === "minimized" && (
          <motion.div
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40"
          >
            <MagneticTooltip content="Reopen Assistant">
              <button
                type="button"
                onClick={openDrawer}
                aria-label="Reopen Assistant"
                className="flex items-center gap-1.5 py-3 px-2 rounded-l-xl bg-card hover:bg-secondary text-foreground border-y border-l border-border hover:border-primary/50 shadow-lg transition-all duration-150 hover:-translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Bot className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium tracking-wide [writing-mode:vertical-lr] rotate-180 py-1 font-mono">
                  Assistant
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-180" />

                {hasUnreadOrActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary self-center mt-0.5" />
                )}
              </button>
            </MagneticTooltip>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          State B: Right-Side Assistant Drawer
          Visible ONLY when drawer is 'open'
          ========================================================================= */}
      <AnimatePresence>
        {drawerState === "open" && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={minimizeDrawer}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              aria-hidden="true"
            />

            <motion.aside
              ref={drawerRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 300 }}
              role="dialog"
              aria-label="OpsEngine Assistant"
              className="fixed top-0 right-0 h-[100dvh] w-full sm:w-[440px] max-w-full z-50 bg-card text-card-foreground border-l border-border shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <header className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm text-foreground tracking-tight">
                        OpsEngine Assistant
                      </h3>
                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      ReBAC Workspace Boundary
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={minimizeDrawer}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Minimize Assistant"
                    title="Minimize"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Close Assistant"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </header>

              {/* Conversation Content */}
              <div className="flex-1 overflow-hidden">
                <AssistantConversationView compact />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
