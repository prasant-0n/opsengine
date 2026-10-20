import { describe, it, expect } from "vitest";
import { sendEmail } from "../features/notifications/lib/ses";

describe("Outbound SES Notification System", () => {
  it("exports sendEmail adapter function", () => {
    expect(typeof sendEmail).toBe("function");
  });

  it("gracefully handles missing credentials without throwing error", async () => {
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test Subject",
      htmlBody: "<p>Test body</p>",
    });
    expect(typeof result).toBe("boolean");
  });
});
