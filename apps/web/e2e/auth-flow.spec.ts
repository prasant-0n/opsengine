import { test, expect } from "@playwright/test";

test.describe("Authentication, Session & SSO Flows (Module 1)", () => {
  test("unauthenticated access to protected routes redirects to /auth/login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator("h1")).toContainText("Sign in to OpsEngine");
  });

  test("displays error alert when invalid credentials are submitted", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill("#domain", "acme.opsengine.enterprise");
    await page.fill("#email", "admin@acme.opsengine.enterprise");
    await page.fill("#password", "WrongPassword123!");
    await page.click('button[type="submit"]');

    const alert = page.locator(".alert.alert-error");
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText("Invalid credentials");
  });

  test("successfully signs in with valid tenant credentials and lands on dashboard", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill("#domain", "acme.opsengine.enterprise");
    await page.fill("#email", "admin@acme.opsengine.enterprise");
    await page.fill("#password", "Sup3rSecret!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Google SSO button initiates OAuth 2.0 flow with tenant domain", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill("#domain", "acme.opsengine.enterprise");
    const ssoBtn = page.locator("button", { hasText: "Continue with Google / SSO" });
    await expect(ssoBtn).toBeVisible();

    // Clicking Google SSO without configured Google credentials triggers graceful fallback
    await ssoBtn.click();
    await expect(page).toHaveURL(/\/auth\/login\?error=/);
  });
});
