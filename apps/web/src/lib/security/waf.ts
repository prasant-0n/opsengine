export interface WafInspectionResult {
  allowed: boolean;
  rule?: string;
  reason?: string;
}

const SCANNER_REGEX = /(sqlmap|nikto|masscan|dirbuster|gobuster|wprecon|acunetix|nessus|zgrab)/i;
const PATH_TRAVERSAL_REGEX = /((\.\.[\/\\])|\/etc\/(passwd|shadow|hosts)|\/windows\/win\.ini|boot\.ini)/i;
const SQLI_REGEX = /(union\s+(all\s+)?select|;\s*drop\s+table|;\s*delete\s+from|'\s+or\s+1\s*=\s*1|'\s+or\s+'1'\s*=\s*'1|--|\/\*|\*\/)/i;
const XSS_REGEX = /(<script|<\/script|javascript:|onerror\s*=|onload\s*=|onclick\s*=|document\.cookie|<iframe|<svg\s+onload)/i;

/**
 * Inspects an incoming HTTP request for common OWASP Top 10 web application threats.
 */
export function inspectWafThreats(req: {
  url: string;
  method?: string;
  headers?: Headers | Record<string, string | null | undefined>;
}): WafInspectionResult {
  let decodedUrl = req.url;
  try {
    decodedUrl = decodeURIComponent(req.url);
  } catch {
    // Malformed URI encoding is suspicious; inspect raw
  }

  // 1. User-Agent Scanner Inspection
  let userAgent = "";
  if (req.headers) {
    if (typeof (req.headers as Headers).get === "function") {
      userAgent = (req.headers as Headers).get("user-agent") || "";
    } else {
      userAgent = (req.headers as Record<string, string>)["user-agent"] || "";
    }
  }

  if (userAgent && SCANNER_REGEX.test(userAgent)) {
    return {
      allowed: false,
      rule: "WAF_SCANNER_BLOCKED",
      reason: `Automated vulnerability scanner signature detected: ${userAgent.slice(0, 32)}`,
    };
  }

  // 2. Path Traversal & LFI Inspection
  if (PATH_TRAVERSAL_REGEX.test(decodedUrl)) {
    return {
      allowed: false,
      rule: "WAF_PATH_TRAVERSAL",
      reason: "Path traversal or unauthorized local file inclusion sequence detected",
    };
  }

  // 3. SQL Injection (SQLi) Inspection
  if (SQLI_REGEX.test(decodedUrl)) {
    return {
      allowed: false,
      rule: "WAF_SQLI_DETECTED",
      reason: "SQL injection signature detected in request query or path parameters",
    };
  }

  // 4. Cross-Site Scripting (XSS) Inspection
  if (XSS_REGEX.test(decodedUrl)) {
    return {
      allowed: false,
      rule: "WAF_XSS_DETECTED",
      reason: "Cross-site scripting (XSS) script injection tag detected in request",
    };
  }

  return { allowed: true };
}
