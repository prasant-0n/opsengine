import { prisma } from "@/lib/prisma";

export async function isTenantAiEnabled(tenantId: string): Promise<boolean> {
  const ws = await prisma.tenantWorkspace.findFirst({
    where: { tenantId },
    select: { aiEnabled: true, isActive: true },
  });
  return !!ws && ws.isActive && ws.aiEnabled;
}

export async function queryGemini(prompt: string, contextSummary: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "AI Assistant is active, but GEMINI_API_KEY is not configured in environment variables.";
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
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

Provide a helpful, precise, and professional response. Never execute unauthorized actions or bypass permissions.`
              }
            ]
          }
        ]
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return `AI service error (${res.status}): ${errText}`;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    return text || "No response generated.";
  } catch (err: any) {
    return `Failed to communicate with AI service: ${err.message ?? err}`;
  }
}
