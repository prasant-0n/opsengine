export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

const EMAIL_HEADER = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 30px; background: #0b1326; color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background: #1e293b; padding: 40px; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="display: flex; align-items: center; margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 20px;">
        <span style="background: #6366f1; color: #ffffff; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: bold; font-size: 18px; margin-right: 12px;">OE</span>
        <span style="font-size: 20px; font-weight: bold; letter-spacing: -0.5px; color: #f8fafc;">OpsEngine Enterprise</span>
      </div>
`;

const EMAIL_FOOTER = `
      <hr style="border: none; border-top: 1px solid #334155; margin: 30px 0;" />
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.4; margin: 0;">
        This is an automated notification from your secure OpsEngine workspace. Please do not reply directly to this email.
      </p>
    </div>
  </div>
`;

export function renderApprovalNotificationTemplate(data: {
  approverName?: string;
  subjectType: string;
  reason?: string | null;
  amountCents?: string | null;
}): EmailTemplate {
  const subject = `[OpsEngine] Action Required: New ${data.subjectType} approval request`;
  const htmlBody = `
    ${EMAIL_HEADER}
      <h2 style="color: #f8fafc; margin-top: 0; font-size: 22px; font-weight: 600;">Approval Request Pending</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
        Hello${data.approverName ? ` <strong>${data.approverName}</strong>` : ""},
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
        A new <strong>${data.subjectType}</strong> approval request has been raised requiring your review and decision${data.amountCents ? ` for amount <strong>${data.amountCents}</strong>` : ""}.
      </p>
      ${data.reason ? `<div style="font-size: 14px; background: #0f172a; padding: 14px; border-radius: 6px; border-left: 4px solid #6366f1; color: #e2e8f0; margin: 20px 0;"><strong>Reason:</strong> ${data.reason}</div>` : ""}
      <p style="margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/approvals" style="background: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">Review in Dashboard</a>
      </p>
    ${EMAIL_FOOTER}
  `;
  const textBody = `New ${data.subjectType} approval request requires your review.${data.reason ? ` Reason: ${data.reason}` : ""}`;
  return { subject, htmlBody, textBody };
}

export function renderOfferNotificationTemplate(data: {
  candidateName: string;
  jobTitle: string;
  baseCompCents: string;
  currency: string;
}): EmailTemplate {
  const subject = `[OpsEngine] Employment Offer: ${data.jobTitle}`;
  const htmlBody = `
    ${EMAIL_HEADER}
      <h2 style="color: #f8fafc; margin-top: 0; font-size: 22px; font-weight: 600;">Congratulations on your Offer!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
        Dear <strong>${data.candidateName}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
        We are thrilled to offer you the position of <strong>${data.jobTitle}</strong> at OpsEngine.
      </p>
      <div style="font-size: 14px; background: #0f172a; padding: 16px; border-radius: 6px; border: 1px solid #334155; color: #e2e8f0; margin: 20px 0;">
        <strong>Compensation:</strong> ${data.baseCompCents} ${data.currency}
      </div>
      <p style="margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/recruit/offers" style="background: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">View Offer Details</a>
      </p>
    ${EMAIL_FOOTER}
  `;
  const textBody = `Congratulations ${data.candidateName}! You have received an employment offer for ${data.jobTitle}.`;
  return { subject, htmlBody, textBody };
}

export function renderInvoiceNotificationTemplate(data: {
  invoiceNumber: string;
  totalCents: string;
  currency: string;
  dueOn?: string | null;
}): EmailTemplate {
  const subject = `[OpsEngine] Invoice Issued: ${data.invoiceNumber}`;
  const htmlBody = `
    ${EMAIL_HEADER}
      <h2 style="color: #f8fafc; margin-top: 0; font-size: 22px; font-weight: 600;">New Invoice Issued</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
        Invoice <strong>${data.invoiceNumber}</strong> has been issued for <strong>${data.totalCents} ${data.currency}</strong>${data.dueOn ? ` due on <strong>${new Date(data.dueOn).toISOString().slice(0, 10)}</strong>` : ""}.
      </p>
      <p style="margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/finance/invoices" style="background: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">View Invoice</a>
      </p>
    ${EMAIL_FOOTER}
  `;
  const textBody = `Invoice ${data.invoiceNumber} for ${data.totalCents} ${data.currency} has been issued.`;
  return { subject, htmlBody, textBody };
}
