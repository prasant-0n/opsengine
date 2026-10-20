import { prisma } from "@/lib/prisma";
import { sendEmail } from "./ses";

export interface CreateNotificationParams {
  tenantId: string;
  recipientUserId: string;
  recipientEmail?: string | null;
  category: "approval" | "task" | "ticket" | "interview" | "onboarding" | "finance" | "system";
  title: string;
  body: string;
  channel?: "in_app" | "email" | "both";
  metadata?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const channel = params.channel ?? "in_app";
    const persistChannel = channel === "both" ? "in_app" : channel;

    const notification = await prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        recipientUserId: params.recipientUserId,
        channel: persistChannel,
        category: params.category,
        title: params.title,
        body: params.body,
        metadata: params.metadata ?? undefined,
        deliveredAt: new Date(),
      },
    });

    if ((channel === "email" || channel === "both") && params.recipientEmail) {
      await sendEmail({
        to: params.recipientEmail,
        subject: `[OpsEngine] ${params.title}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; color: #0f172a;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <h2 style="color: #6366f1; margin-top: 0;">OpsEngine Enterprise Ops</h2>
              <h3 style="margin-bottom: 15px;">${params.title}</h3>
              <p style="font-size: 16px; line-height: 1.5; color: #334155;">${params.body}</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">This is an automated notification from your OpsEngine workspace. Please do not reply directly to this email.</p>
            </div>
          </div>
        `,
      });
    }

    return notification;
  } catch (err) {
    console.error("Failed to create notification:", err);
    return null;
  }
}
