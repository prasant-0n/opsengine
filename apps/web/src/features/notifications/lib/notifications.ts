import { prisma } from "@/lib/prisma";
import { sendEmail } from "./ses";
import { renderApprovalNotificationTemplate, renderOfferNotificationTemplate, renderInvoiceNotificationTemplate } from "./templates";

export interface CreateNotificationParams {
  tenantId: string;
  recipientUserId: string;
  recipientEmail?: string | null;
  category: "approval" | "task" | "ticket" | "interview" | "onboarding" | "finance" | "system";
  title: string;
  body: string;
  channel?: "in_app" | "email" | "both";
  metadata?: Record<string, any>;
  templateType?: "approval" | "offer" | "invoice";
  templateData?: any;
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
      let emailPayload = {
        subject: `[OpsEngine] ${params.title}`,
        htmlBody: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>${params.title}</h2><p>${params.body}</p></div>`,
        textBody: params.body,
      };

      if (params.templateType === "approval" && params.templateData) {
        emailPayload = renderApprovalNotificationTemplate(params.templateData);
      } else if (params.templateType === "offer" && params.templateData) {
        emailPayload = renderOfferNotificationTemplate(params.templateData);
      } else if (params.templateType === "invoice" && params.templateData) {
        emailPayload = renderInvoiceNotificationTemplate(params.templateData);
      }

      await sendEmail({
        to: params.recipientEmail,
        subject: emailPayload.subject,
        htmlBody: emailPayload.htmlBody,
        textBody: emailPayload.textBody,
      });
    }

    return notification;
  } catch (err) {
    console.error("Failed to create notification:", err);
    return null;
  }
}
