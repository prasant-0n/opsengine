/**
 * Exponential Backoff & Transient Error Classification
 * Mandated by PRD §14.2 (Reliability and data integrity)
 */

/**
 * Calculates exponential backoff with full jitter to prevent thundering herd / retry storms.
 * Delay formula: min(base * 2^(attempt - 1), max) + random_jitter
 */
export function calculateBackoffDelay(
  attemptCount: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 3600000,
  addJitter: boolean = true
): number {
  if (attemptCount <= 0) return 0;

  const exponential = baseDelayMs * Math.pow(2, attemptCount - 1);
  const capped = Math.min(exponential, maxDelayMs);

  if (!addJitter) {
    return Math.floor(capped);
  }

  // Add random jitter up to 25% of the calculated delay
  const jitter = Math.floor(Math.random() * (capped * 0.25));
  return Math.floor(capped + jitter);
}

/**
 * Classifies an HTTP status code or network error as transient vs non-transient.
 * PRD §14.2 mandate: "Retry only transient failures; do not endlessly retry validation/auth failures."
 */
export function isTransientError(status?: number | null, errorMessage?: string | null): boolean {
  // If there's a low-level network timeout / socket error without an HTTP response
  if (!status || status === 0) {
    if (!errorMessage) return true;
    const lower = errorMessage.toLowerCase();
    return (
      lower.includes("timeout") ||
      lower.includes("econnrefused") ||
      lower.includes("econnreset") ||
      lower.includes("network") ||
      lower.includes("fetch failed") ||
      lower.includes("socket hang up")
    );
  }

  // Transient HTTP statuses that warrant retrying:
  // 408: Request Timeout
  // 429: Too Many Requests / Rate Limited
  // 500: Internal Server Error
  // 502: Bad Gateway
  // 503: Service Unavailable
  // 504: Gateway Timeout
  if (status === 408 || status === 429 || (status >= 500 && status <= 504)) {
    return true;
  }

  // Permanent Client Errors that must NOT be retried:
  // 400: Bad Request
  // 401: Unauthorized (Bad credentials/token)
  // 403: Forbidden
  // 404: Not Found
  // 405: Method Not Allowed
  // 410: Gone
  // 422: Unprocessable Entity
  return false;
}
