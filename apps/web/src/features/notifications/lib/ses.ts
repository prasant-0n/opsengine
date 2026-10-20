import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const region = process.env.AWS_SES_REGION || "us-east-1";
const fromEmail = process.env.AWS_SES_FROM_EMAIL || "noreply@opsengine.enterprise";

let sesClient: SESClient | null = null;

function getSesClient(): SESClient | null {
  if (sesClient) return sesClient;
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return null;
  }
  try {
    sesClient = new SESClient({ region });
    return sesClient;
  } catch (err) {
    console.error("Failed to initialize AWS SES client:", err);
    return null;
  }
}

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export async function sendEmail({ to, subject, htmlBody, textBody }: SendEmailParams): Promise<boolean> {
  const client = getSesClient();
  if (!client) {
    console.warn("[SES Mock] SES client not configured. Skipping outbound email to:", to);
    return false;
  }

  try {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody || htmlBody.replace(/<[^>]*>?/gm, ""), Charset: "UTF-8" },
        },
      },
    });

    await client.send(command);
    return true;
  } catch (err) {
    console.error("Failed to send email via AWS SES:", err);
    return false;
  }
}
