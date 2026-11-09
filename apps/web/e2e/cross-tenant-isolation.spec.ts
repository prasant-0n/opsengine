import { test, expect } from "@playwright/test";

test.describe("Security Hardening & Multi-Tenant Negative Gates", () => {
  test("health check endpoint reports healthy database and system telemetry", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.database.status).toBe("connected");
    expect(typeof body.database.latencyMs).toBe("number");
    expect(typeof body.system.heapUsedMB).toBe("number");
  });

  test("enforces security headers across all responses", async ({ request }) => {
    const res = await request.get("/auth/login");
    const headers = res.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("rejects unauthenticated requests to protected APIs with 401/403", async ({ request }) => {
    const endpoints = [
      "/api/documents",
      "/api/calendar/events",
      "/api/control-plane/workspaces",
      "/api/reports/executive-summary",
      "/api/admin/workspace",
    ];

    for (const ep of endpoints) {
      const res = await request.get(ep);
      expect([401, 403]).toContain(res.status());
    }
  });
});
