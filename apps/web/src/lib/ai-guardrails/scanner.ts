export class InjectionScanner {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|past)\s+(instructions|directives|prompts)/i,
    /system\s+prompt\s+override/i,
    /you\s+are\s+now\s+(in\s+)?(developer|unrestricted|god|dan|jailbreak)\s+mode/i,
    /(exfiltrate|leak|dump|reveal)\s+(all\s+)?(data|secrets|keys|passwords|database|tenants)/i,
    /<script\b[^>]*>[\s\S]*?<\/script\s*>/i,
    /bypass\s+(all\s+)?(security|auth|checks|rules|policies)/i,
  ];

  /**
   * Evaluates text for prompt injection, jailbreaking, or unauthorized exfiltration patterns.
   */
  public static scan(input: string): { isMalicious: boolean; reason?: string } {
    if (!input || typeof input !== "string") {
      return { isMalicious: false };
    }

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        return {
          isMalicious: true,
          reason: `Input violates security policy: matched prompt injection heuristic (${pattern.source})`,
        };
      }
    }

    return { isMalicious: false };
  }
}

export class DataRedactor {
  private static readonly CC_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
  private static readonly SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
  private static readonly BEARER_REGEX = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
  private static readonly API_KEY_REGEX = /(?:AIzaSy|sk-[a-zA-Z0-9]{20,})[a-zA-Z0-9_\-]*/g;

  /**
   * Sanitizes output and context to ensure credentials, payment details, and PII are redacted.
   */
  public static redact(text: string): string {
    if (!text || typeof text !== "string") {
      return text;
    }

    return text
      .replace(this.CC_REGEX, "****-****-****-XXXX")
      .replace(this.SSN_REGEX, "***-**-XXXX")
      .replace(this.BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
      .replace(this.API_KEY_REGEX, "[REDACTED_API_KEY]");
  }
}
