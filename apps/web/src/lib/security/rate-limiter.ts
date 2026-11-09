export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfter?: number;
}

export interface RateLimitTierConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_TIERS: Record<string, RateLimitTierConfig> = {
  AUTH: { limit: 10, windowMs: 60_000 }, // 10 req/min (anti-bruteforce)
  SENSITIVE: { limit: 15, windowMs: 60_000 }, // 15 req/min (exports, break-glass)
  API_DEFAULT: { limit: 120, windowMs: 60_000 }, // 120 req/min
  PROBES: { limit: 600, windowMs: 60_000 }, // 600 req/min (monitoring)
};

export class SlidingWindowRateLimiter {
  private timestamps = new Map<string, number[]>();
  private lastCleanup = Date.now();
  private cleanupIntervalMs = 60_000;

  /**
   * Evaluates if a request is permitted under the sliding-window policy.
   */
  public check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    this.maybeCleanup(now);

    const windowStart = now - windowMs;
    let list = this.timestamps.get(key) || [];

    // Filter out timestamps outside the sliding window
    list = list.filter((ts) => ts > windowStart);

    const count = list.length;
    const remaining = Math.max(0, limit - count - 1);
    const oldestTimestamp = list[0] || now;
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

    if (count >= limit) {
      this.timestamps.set(key, list);
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds,
        retryAfter: resetSeconds,
      };
    }

    list.push(now);
    this.timestamps.set(key, list);

    return {
      allowed: true,
      limit,
      remaining,
      resetSeconds,
    };
  }

  public reset(key?: string): void {
    if (key) {
      this.timestamps.delete(key);
    } else {
      this.timestamps.clear();
    }
  }

  private maybeCleanup(now: number): void {
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      for (const [key, list] of this.timestamps.entries()) {
        const fresh = list.filter((ts) => ts > now - 120_000);
        if (fresh.length === 0) {
          this.timestamps.delete(key);
        } else {
          this.timestamps.set(key, fresh);
        }
      }
      this.lastCleanup = now;
    }
  }
}

// Global default rate limiter instance
export const globalRateLimiter = new SlidingWindowRateLimiter();

/**
 * Resolves the appropriate rate-limiting tier configuration based on URL path.
 */
export function resolveRateLimitTier(pathname: string): RateLimitTierConfig {
  if (
    pathname.includes("/api/auth/login") ||
    pathname.includes("/api/auth/verify-otp") ||
    pathname.includes("/api/auth/reset-password") ||
    pathname.includes("/api/auth/forgot-password")
  ) {
    return RATE_LIMIT_TIERS.AUTH;
  }

  if (
    pathname.includes("/api/control-plane/") ||
    pathname.includes("/api/admin/users/break-glass") ||
    pathname.includes("/export")
  ) {
    return RATE_LIMIT_TIERS.SENSITIVE;
  }

  if (pathname === "/api/health" || pathname === "/api/metrics") {
    return RATE_LIMIT_TIERS.PROBES;
  }

  return RATE_LIMIT_TIERS.API_DEFAULT;
}

/**
 * Extracts the client IP from standard HTTP headers.
 */
export function extractClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    return fwd.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
