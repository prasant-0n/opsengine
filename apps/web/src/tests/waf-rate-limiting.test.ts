import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  inspectWafThreats,
  SlidingWindowRateLimiter,
  resolveRateLimitTier,
  RATE_LIMIT_TIERS,
} from "../lib/security";
import { middleware } from "../proxy";

describe("Web Application Firewall (WAF) & Rate Limiting Engine (PRD §4.1 & §10)", () => {
  let rateLimiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    rateLimiter = new SlidingWindowRateLimiter();
  });

  describe("1. WAF Threat Signature Inspection", () => {
    it("blocks hostile reconnaissance vulnerability scanners", () => {
      const hostileAgents = [
        "sqlmap/1.5.2#stable",
        "Mozilla/5.0 (compatible; Nikto/2.1.6)",
        "masscan/1.0",
        "dirbuster-0.12",
        "gobuster/3.1.0",
      ];

      for (const ua of hostileAgents) {
        const res = inspectWafThreats({
          url: "http://localhost:3000/api/tickets",
          headers: { "user-agent": ua },
        });

        expect(res.allowed).toBe(false);
        expect(res.rule).toBe("WAF_SCANNER_BLOCKED");
        expect(res.reason).toContain("scanner");
      }
    });

    it("blocks SQL Injection (SQLi) attacks in URL and query parameters", () => {
      const sqliPayloads = [
        "http://localhost:3000/api/tickets?id=1%27%20UNION%20SELECT%20username%2Cpassword%20FROM%20users--",
        "http://localhost:3000/api/crm/accounts?query=%27%20OR%201=1--",
        "http://localhost:3000/api/finance/invoices?ref=INV;%20DROP%20TABLE%20invoices",
        "http://localhost:3000/api/employees?search=test%27%20OR%20%271%27=%271",
      ];

      for (const url of sqliPayloads) {
        const res = inspectWafThreats({ url });
        expect(res.allowed).toBe(false);
        expect(res.rule).toBe("WAF_SQLI_DETECTED");
      }
    });

    it("blocks Path Traversal and Local File Inclusion (LFI) attempts", () => {
      const traversalPayloads = [
        "http://localhost:3000/api/documents/../../etc/passwd",
        "http://localhost:3000/api/files?path=..%2F..%2Fetc%2Fshadow",
        "http://localhost:3000/api/download?file=..%5C..%5Cwindows%5Cwin.ini",
      ];

      for (const url of traversalPayloads) {
        const res = inspectWafThreats({ url });
        expect(res.allowed).toBe(false);
        expect(res.rule).toBe("WAF_PATH_TRAVERSAL");
      }
    });

    it("blocks Cross-Site Scripting (XSS) script injections", () => {
      const xssPayloads = [
        "http://localhost:3000/api/search?q=%3Cscript%3Ealert(document.cookie)%3C%2Fscript%3E",
        "http://localhost:3000/api/candidates?name=test%3Csvg%20onload=alert(1)%3E",
        "http://localhost:3000/api/projects?title=javascript:void(0)",
        "http://localhost:3000/api/feedback?comment=test%22%20onerror=%22alert(1)",
      ];

      for (const url of xssPayloads) {
        const res = inspectWafThreats({ url });
        expect(res.allowed).toBe(false);
        expect(res.rule).toBe("WAF_XSS_DETECTED");
      }
    });

    it("allows standard, benign production requests", () => {
      const benignUrls = [
        "http://localhost:3000/api/tickets?projectId=550e8400-e29b-41d4-a716-446655440000",
        "http://localhost:3000/api/org/employees?department=Engineering&status=active",
        "http://localhost:3000/api/finance/invoices?page=1&limit=25",
        "http://localhost:3000/api/health",
        "http://localhost:3000/api/metrics",
      ];

      for (const url of benignUrls) {
        const res = inspectWafThreats({
          url,
          headers: { "user-agent": "Mozilla/5.0 Chrome/120.0" },
        });
        expect(res.allowed).toBe(true);
        expect(res.rule).toBeUndefined();
      }
    });
  });

  describe("2. Sliding-Window Rate Limiting", () => {
    it("permits requests within quota and decrements remaining counter", () => {
      const key = "test:client:1";
      const limit = 5;
      const windowMs = 10_000;

      for (let i = 0; i < limit; i++) {
        const res = rateLimiter.check(key, limit, windowMs);
        expect(res.allowed).toBe(true);
        expect(res.limit).toBe(limit);
        expect(res.remaining).toBe(limit - 1 - i);
      }
    });

    it("rejects requests exceeding limit with 0 remaining and retryAfter", () => {
      const key = "test:client:2";
      const limit = 3;
      const windowMs = 5_000;

      // Exhaust quota
      for (let i = 0; i < limit; i++) {
        rateLimiter.check(key, limit, windowMs);
      }

      // Next request must be rejected
      const blocked = rateLimiter.check(key, limit, windowMs);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it("resolves correct rate limit tiers based on endpoint sensitivity", () => {
      expect(resolveRateLimitTier("/api/auth/login")).toEqual(RATE_LIMIT_TIERS.AUTH);
      expect(resolveRateLimitTier("/api/auth/verify-otp")).toEqual(RATE_LIMIT_TIERS.AUTH);
      expect(resolveRateLimitTier("/api/control-plane/workspaces/1/export")).toEqual(RATE_LIMIT_TIERS.SENSITIVE);
      expect(resolveRateLimitTier("/api/health")).toEqual(RATE_LIMIT_TIERS.PROBES);
      expect(resolveRateLimitTier("/api/tickets")).toEqual(RATE_LIMIT_TIERS.API_DEFAULT);
    });
  });

  describe("3. Next.js Middleware Integration", () => {
    it("middleware blocks hostile scanner user-agent with HTTP 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/tickets", {
        headers: { "user-agent": "sqlmap/1.5" },
      });

      const res = middleware(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.code).toBe("WAF_BLOCK");
      expect(json.rule).toBe("WAF_SCANNER_BLOCKED");
    });

    it("middleware blocks SQL injection attacks with HTTP 403", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/tickets?id=1%27%20UNION%20SELECT%201--",
        {
          headers: { "user-agent": "Mozilla/5.0" },
        }
      );

      const res = middleware(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.code).toBe("WAF_BLOCK");
      expect(json.rule).toBe("WAF_SQLI_DETECTED");
    });

    it("middleware attaches RateLimit headers on legitimate requests", async () => {
      const req = new NextRequest("http://localhost:3000/api/tickets", {
        headers: {
          "user-agent": "Mozilla/5.0",
          "x-real-ip": "192.168.1.100",
        },
      });

      const res = middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("RateLimit-Limit")).toBeDefined();
      expect(res.headers.get("RateLimit-Remaining")).toBeDefined();
      expect(res.headers.get("RateLimit-Reset")).toBeDefined();
    });

    it("middleware redirects unauthenticated dashboard access to /auth/login", () => {
      const req = new NextRequest("http://localhost:3000/dashboard/tickets");
      const res = middleware(req);

      expect(res.status).toBe(307); // NextResponse.redirect
      expect(res.headers.get("location")).toContain("/auth/login");
    });
  });
});
