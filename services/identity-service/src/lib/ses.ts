import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION,
  credentials: process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL ?? "noreply@opsengine.enterprise";

export async function sendOtpEmail(input: {
  to: string;
  code: string;
  expiresInMinutes: number;
}) {
  // If SES credentials not configured, log to stdout for dev (do not silently drop)
  if (!process.env.AWS_SES_ACCESS_KEY_ID || !process.env.AWS_SES_SECRET_ACCESS_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[DEV] OTP email to ${input.to}: code=${input.code} expires in ${input.expiresInMinutes} min`);
    return;
  }

  await sesClient.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [input.to] },
      Message: {
        Subject: { Data: `Your OpsEngine verification code: ${input.code}` },
        Body: {
          Text: {
            Data: `Your verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
          },
        },
      },
    })
  );
}
