import { prisma } from "@/lib/prisma";

export async function isTenantAiEnabled(tenantId: string): Promise<boolean> {
  const ws = await prisma.tenantWorkspace.findFirst({
    where: { tenantId },
    select: { aiEnabled: true, isActive: true },
  });
  return !!ws && ws.isActive && ws.aiEnabled;
}

const CANDIDATE_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash",
];

export async function queryGemini(
  prompt: string,
  contextSummary: string,
  toneMode: string = "standard"
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      text: generateLocalFallback(prompt, contextSummary, toneMode),
      model: "OpsEngine Local Engine",
    };
  }

  let toneInstruction =
    "Provide a helpful, precise, and professional response in clean Markdown format with headers and bullet points where appropriate.";
  if (toneMode === "executive") {
    toneInstruction =
      "Provide an Executive Summary. Focus on high-level takeaways, metrics, and actionable bullets. Keep it under 200 words.";
  } else if (toneMode === "audit") {
    toneInstruction =
      "Provide a Forensic Compliance Audit view. Include specific regulatory governance clauses, Separation of Duties analysis, four-eyes policy citations, and verification status.";
  }

  // Iterate through candidate models in cascade order
  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are OpsEngine AI Assistant, a controlled enterprise operations helper.
Context about the organization:
${contextSummary}

User Prompt:
${prompt}

${toneInstruction} Never execute unauthorized actions or bypass permissions. When referencing facts from context, cite the source using brackets like [1] [Invoice Ledger] or [2] [Workforce Directory].`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return { text: text.trim(), model };
        }
      }

      // If 503 (high demand), 429, or 404, log warning and cascade to the next model
      const errText = await res.text().catch(() => "");
      console.warn(`[Gemini Cascade] Model ${model} returned ${res.status}: ${errText.slice(0, 120)}`);
    } catch (err: any) {
      console.warn(`[Gemini Cascade] Network error for model ${model}:`, err.message ?? err);
    }
  }

  // If all external LLM models are exhausted or down, fall back to authoritative enterprise engine
  return {
    text: generateLocalFallback(prompt, contextSummary, toneMode),
    model: "OpsEngine Policy Engine",
  };
}

function generateLocalFallback(prompt: string, contextSummary: string, toneMode: string = "standard"): string {
  const lower = prompt.toLowerCase();

  if (
    lower.includes("approval") ||
    lower.includes("separation of duties") ||
    lower.includes("sod") ||
    lower.includes("rule") ||
    lower.includes("policy")
  ) {
    return `**OpsEngine Governance Framework — Approval & Separation of Duties (SoD)**

OpsEngine enforces strict automated controls across all organizational workflows:

### 1. Separation of Duties (SoD)
* **The Four-Eyes Principle:** No individual can unilaterally create, approve, and execute sensitive financial or operational actions.
* **Author vs. Approver Isolation:** Requesters are blocked at the engine layer from approving their own purchase orders, invoices, or workflow steps.
* **Audited Policy Matrix:** Permission combinations that create toxic operational conflicts are automatically rejected by the authorization engine.

### 2. Multi-Step Approval Workflows
* **Hierarchical Routing:** Requests flow dynamically through designated management tiers (Team Lead → SBU Head → Finance Director).
* **Delegation Safety:** Temporary delegation requires valid time-bounds and an immutable audit trail.
* **Immutable Audit Trail:** All decisions, transitions, and break-glass overrides are signed and recorded permanently.

*Note: Powered by OpsEngine Policy Engine.*`;
  }

  if (lower.includes("employee") || lower.includes("headcount") || lower.includes("active") || lower.includes("who")) {
    return `**Workforce Intelligence Summary**

${contextSummary}

All employees are verified within your organization boundary. Access to directory records is governed by your assigned role permissions.`;
  }

  if (lower.includes("invoice") || lower.includes("unpaid") || lower.includes("due") || lower.includes("bill")) {
    return `**Financial Receivables & Invoices**

${contextSummary}

Please navigate to the **Finance & Billing** dashboard for complete payment gateway reconciliation and invoice download links.`;
  }

  if (lower.includes("project") || lower.includes("delivery") || lower.includes("sprint") || lower.includes("status")) {
    return `**Project Portfolio Overview**

${contextSummary}

Detailed sprint allocations, ticket queues, and milestone sign-offs are available in the **Projects** workspace.`;
  }

  return `**OpsEngine Enterprise Assistant**

Here is your current authorized workspace context:

${contextSummary}

Please ask about specific workforce, invoice, project, or approval rules, or navigate directly using the sidebar menu.`;
}
