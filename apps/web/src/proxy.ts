import { NextRequest, NextResponse } from "next/server";
import {
  inspectWafThreats,
  globalRateLimiter,
  resolveRateLimitTier,
  extractClientIp,
} from "./lib/security";
import { globalTenantLifecycleService } from "./lib/tenancy";

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Dashboard UX Session Guard (cookie presence redirect)
  if (pathname.startsWith("/dashboard")) {
    const hasSession = req.cookies.has("ops_session");
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 2. API Routes Security & WAF Inspection Pipeline
  if (pathname.startsWith("/api")) {
    // A. Web Application Firewall (WAF) Threat Inspection
    const wafResult = inspectWafThreats(req);
    if (!wafResult.allowed) {
      return NextResponse.json(
        {
          error: "Request blocked by Web Application Firewall (WAF) security policy",
          code: "WAF_BLOCK",
          rule: wafResult.rule,
          reason: wafResult.reason,
          timestamp: new Date().toISOString(),
        },
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-WAF-Protection": "BLOCK",
            "X-WAF-Rule": wafResult.rule || "UNKNOWN",
          },
        }
      );
    }

    // B. Precision Sliding-Window Rate Limiter
    const ip = extractClientIp(req);
    const tier = resolveRateLimitTier(pathname);
    // Rate limit scope key: coarse path + client IP
    const rateLimitKey = `${pathname.split("/").slice(0, 4).join("/")}:${ip}`;
    const rateResult = globalRateLimiter.check(rateLimitKey, tier.limit, tier.windowMs);

    if (!rateResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait before retrying.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: rateResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateResult.retryAfter || 60),
            "RateLimit-Limit": String(rateResult.limit),
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": String(rateResult.resetSeconds),
          },
        }
      );
    }

    // C. Tenant Lifecycle & Quarantine Edge Enforcement (PRD §18.7)
    const isLifecycleAdminEndpoint = pathname.startsWith("/api/admin/tenants/lifecycle");
    if (!isLifecycleAdminEndpoint) {
      const tenantHeader = req.headers.get("x-tenant-id");
      if (tenantHeader && globalTenantLifecycleService.isQuarantined(tenantHeader)) {
        return NextResponse.json(
          {
            error: `Tenant '${tenantHeader}' has been quarantined or suspended by platform operations.`,
            code: "TENANT_QUARANTINED",
            tenantId: tenantHeader,
            timestamp: new Date().toISOString(),
          },
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "X-Tenant-Status": "QUARANTINED",
            },
          }
        );
      }
    }

    // D. Forward request with standard RateLimit headers attached
    const res = NextResponse.next();
    res.headers.set("RateLimit-Limit", String(rateResult.limit));
    res.headers.set("RateLimit-Remaining", String(rateResult.remaining));
    res.headers.set("RateLimit-Reset", String(rateResult.resetSeconds));
    return res;
  }

  return NextResponse.next();
}

export { proxy, proxy as middleware };

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
