export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export function renderApprovalNotificationTemplate(data: {
  approverName?: string;
  subjectType: string;
  reason?: string | null;
  amountCents?: string | null;
}): EmailTemplate {
  const subject = `[OpsEngine] Action Required: New ${data.subjectType} approval request`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #6366f1; margin-top: 0;">OpsEngine Enterprise Ops</h2>
        <h3 style="margin-bottom: 15px;">Approval Request Pending</h3>
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          Hello${data.approverName ? ` ${data.approverName}` : ""},
        </p>
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          A new <strong>${data.subjectType}</strong> approval request has been raised requiring your review and decision${data.amountCents ? ` for amount <strong>${data.amountCents}</strong>` : ""}.
        </p>
        ${data.reason ? `<p style="font-size: 14px; background: #f1f5f9; padding: 10px; border-left: 4px solid #6366f1;"><strong>Reason:</strong> ${data.reason}</p>` : ""}
        <p style="margin-top: 25px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/approvals" style="background: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Review in Dashboard</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #64748b;">This is an automated notification from your OpsEngine workspace.</p>
      </div>
    </div>
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
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #6366f1; margin-top: 0;">OpsEngine Enterprise Ops</h2>
        <h3 style="margin-bottom: 15px;">Congratulations on your Offer!</h3>
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          Dear <strong>${data.candidateName}</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          We are thrilled to offer you the position of <strong>${data.jobTitle}</strong> at OpsEngine.
        </p>
        <p style="font-size: 14px; background: #f1f5f9; padding: 12px; border-radius: 6px;">
          <strong>Compensation:</strong> ${data.baseCompCents} ${data.currency}
        </p>
        <p style="margin-top: 25px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/recruit/offers" style="background: #10b981; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Offer Details</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #64748b;">Welcome to the team!</p>
      </div>
    </div>
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
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #6366f1; margin-top: 0;">OpsEngine Enterprise Ops</h2>
        <h3 style="margin-bottom: 15px;">New Invoice Issued</h3>
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          Invoice <strong>${data.invoiceNumber}</strong> has been issued for <strong>${data.totalCents} ${data.currency}</strong>${data.dueOn ? ` due on <strong>${new Date(data.dueOn).toISOString().slice(0, 10)}</strong>` : ""}.
        </p>
        <p style="margin-top: 25px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/finance/invoices" style="background: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Invoice</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
        <p style="font-size: 12px; color: #64748b;">Thank you for your business.</p>
      </div>
    </div>
  `;
  const textBody = `Invoice ${data.invoiceNumber} for ${data.totalCents} ${data.currency} has been issued.`;
  return { subject, htmlBody, textBody };
}
