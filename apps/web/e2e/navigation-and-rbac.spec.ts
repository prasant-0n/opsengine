import { test, expect, Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/auth/login");
  await page.fill("#domain", "acme.opsengine.enterprise");
  await page.fill("#email", "admin@acme.opsengine.enterprise");
  await page.fill("#password", "Sup3rSecret!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

test.describe("Full Enterprise Navigation & RBAC Surface", () => {
  test("renders Workspace Overview & Team surfaces (/dashboard, /my-team, /people)", async ({ page }) => {
    await loginAsAdmin(page);
    const routes = [
      { path: "/dashboard", expectedText: "My Day" },
      { path: "/dashboard/my-team", expectedText: "Team" },
      { path: "/dashboard/people", expectedText: "Directory" },
    ];
    for (const r of routes) {
      const res = await page.goto(r.path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(r.expectedText, { timeout: 10000 });
    }
  });

  test("renders Time, Timesheets, Leave & Attendance surfaces", async ({ page }) => {
    await loginAsAdmin(page);
    const routes = [
      { path: "/dashboard/time", expectedText: "Time" },
      { path: "/dashboard/timesheets", expectedText: "Timesheet" },
      { path: "/dashboard/leave", expectedText: "Leave" },
      { path: "/dashboard/attendance", expectedText: "Attendance" },
    ];
    for (const r of routes) {
      const res = await page.goto(r.path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(r.expectedText, { timeout: 10000 });
    }
  });

  test("renders Projects, Tickets & CRM surfaces", async ({ page }) => {
    await loginAsAdmin(page);
    const routes = [
      { path: "/dashboard/projects", expectedText: "Project" },
      { path: "/dashboard/tickets", expectedText: "Ticket" },
      { path: "/dashboard/crm", expectedText: "CRM" },
    ];
    for (const r of routes) {
      const res = await page.goto(r.path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(r.expectedText, { timeout: 10000 });
    }
  });

  test("renders Finance, Invoices & Receivables surfaces", async ({ page }) => {
    await loginAsAdmin(page);
    const routes = [
      { path: "/dashboard/finance", expectedText: "Finance" },
      { path: "/dashboard/finance/invoices", expectedText: "Invoice" },
      { path: "/dashboard/finance/receivables", expectedText: "Receivable" },
    ];
    for (const r of routes) {
      const res = await page.goto(r.path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(r.expectedText, { timeout: 10000 });
    }
  });

  test("renders Approvals, Documents & Calendar surfaces", async ({ page }) => {
    await loginAsAdmin(page);
    const routes = [
      { path: "/dashboard/approvals", expectedText: "Approval" },
      { path: "/dashboard/approvals/workflows", expectedText: "Workflow" },
      { path: "/dashboard/documents", expectedText: "Document" },
      { path: "/dashboard/calendar", expectedText: "Calendar" },
    ];
    for (const r of routes) {
      const res = await page.goto(r.path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(r.expectedText, { timeout: 10000 });
    }
  });

  test("renders Executive Reports, Workspace Administration & SaaS Control Plane", async ({ page }) => {
    await loginAsAdmin(page);
    const routes = [
      { path: "/dashboard/reports", expectedText: "Report" },
      { path: "/dashboard/administration", expectedText: "Workspace" },
      { path: "/dashboard/control-plane", expectedText: "Control Plane" },
    ];
    for (const r of routes) {
      const res = await page.goto(r.path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toContainText(r.expectedText, { timeout: 10000 });
    }
  });
});
