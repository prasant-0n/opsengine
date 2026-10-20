import { cookies } from "next/headers";

export const SESSION_COOKIE = "ops_session";

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

// For route handlers: set/clear the httpOnly session cookie on the response.
export function setSessionCookie(
  headers: Headers,
  token: string,
  expiresAt: Date,
) {
  const cookie = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ].join("; ");
  headers.append("Set-Cookie", cookie);
}

export function clearSessionCookie(headers: Headers) {
  const cookie = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
  headers.append("Set-Cookie", cookie);
}
