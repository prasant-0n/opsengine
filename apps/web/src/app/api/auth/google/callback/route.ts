import { NextRequest, NextResponse } from "next/server";
import {
  verifyGoogleOAuthState,
  exchangeGoogleCode,
  fetchGoogleProfile,
  completeGoogleSSOFlow,
  type GoogleProfile,
} from "@/features/auth/lib/google-sso";
import { setSessionCookie } from "@/lib/auth/session-cookie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const errorParam = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const loginRedirect = (errorCode: string) => {
    const url = new URL("/auth/login", req.url);
    url.searchParams.set("error", errorCode);
    return NextResponse.redirect(url);
  };

  // Google returned an error or user cancelled
  if (errorParam) {
    return loginRedirect(errorParam);
  }

  if (!code || !state) {
    return loginRedirect("invalid_state");
  }

  // Verify HMAC-SHA256 signature and expiration
  const statePayload = verifyGoogleOAuthState(state);
  if (!statePayload) {
    return loginRedirect("invalid_state");
  }

  try {
    const isMock = process.env.MOCK_GOOGLE_SSO === "true";
    let profile: GoogleProfile;

    if (isMock && code.startsWith("mock-")) {
      // Mock profile for integration / automated tests
      const mockEmail =
        searchParams.get("mockEmail") ||
        (statePayload.domain
          ? `admin@${statePayload.domain}`
          : "admin@acme.opsengine.enterprise");

      profile = {
        sub: `google-mock-${Date.now()}`,
        email: mockEmail,
        email_verified: true,
        name: "Mock SSO Admin",
      };
    } else {
      const forwardedProto = req.headers.get("x-forwarded-proto") || "http";
      const host = req.headers.get("host") || "localhost:3001";
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || `${forwardedProto}://${host}`;
      const redirectUri =
        process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        `${baseUrl}/api/auth/google/callback`;

      const tokens = await exchangeGoogleCode(code, redirectUri);
      profile = await fetchGoogleProfile(tokens.accessToken);
    }

    const result = await completeGoogleSSOFlow({
      profile,
      domain: statePayload.domain,
      tenantId: statePayload.tenantId,
      returnTo: statePayload.returnTo,
    });

    const destination = new URL(result.returnTo || "/dashboard", req.url);
    const res = NextResponse.redirect(destination);
    setSessionCookie(res.headers, result.sessionToken, result.expiresAt);

    return res;
  } catch (err: any) {
    const message = err?.message || "";
    if (message.includes("USER_NOT_ENROLLED")) {
      return loginRedirect("user_not_enrolled");
    }
    if (message.includes("MEMBERSHIP_INACTIVE")) {
      return loginRedirect("membership_inactive");
    }
    if (message.includes("TENANT_NOT_FOUND") || message.includes("TENANT_INACTIVE")) {
      return loginRedirect("tenant_not_found");
    }
    if (message.includes("EMAIL_NOT_VERIFIED")) {
      return loginRedirect("email_not_verified");
    }
    return loginRedirect("auth_failed");
  }
}
