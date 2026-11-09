import { NextRequest, NextResponse } from "next/server";
import {
  createGoogleOAuthState,
  getGoogleAuthUrl,
} from "@/features/auth/lib/google-sso";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain") || undefined;
  const returnTo = searchParams.get("returnTo") || undefined;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const isMock = process.env.MOCK_GOOGLE_SSO === "true";

  if (!clientId && !isMock) {
    // Graceful fallback for unconfigured Google Cloud credentials
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("error", "sso_unconfigured");
    return NextResponse.redirect(loginUrl);
  }

  // Derive origin from request headers or environment
  const forwardedProto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3001";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${forwardedProto}://${host}`;

  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${baseUrl}/api/auth/google/callback`;

  const state = createGoogleOAuthState({ domain, returnTo });

  if (isMock && searchParams.get("mock") === "true") {
    // Automated dev/mock testing pathway
    const mockCallbackUrl = new URL("/api/auth/google/callback", req.url);
    mockCallbackUrl.searchParams.set("code", "mock-auth-code");
    mockCallbackUrl.searchParams.set("state", state);
    return NextResponse.redirect(mockCallbackUrl);
  }

  const authUrl = getGoogleAuthUrl({
    state,
    redirectUri,
    clientId,
  });

  return NextResponse.redirect(authUrl);
}
