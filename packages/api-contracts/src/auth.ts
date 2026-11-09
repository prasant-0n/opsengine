// Auth API contracts — shared between services and frontend
// Every tenant-owned DTO carries tenant_id server-side (never client-supplied)

export interface LoginRequest {
  domain: string;
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  sessionToken: string;
  tenantId: string;
  userId: string;
  role: string[];
  expiresAt: string;
}

export interface TenantSelectorRequest {
  identifier: string; // email or domain
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  isActive: boolean;
}

export interface TenantSelectorResponse {
  workspaces: WorkspaceSummary[];
}

export interface ForgotPasswordRequest {
  emailOrUsername: string;
  purpose: "password_reset" | "email_verification";
}

export interface ForgotPasswordResponse {
  codeSent: boolean;
  expiresInMinutes: number;
}

export interface VerifyOtpRequest {
  code: string;
  purpose: "password_reset" | "email_verification";
}

export interface VerifyOtpResponse {
  verified: boolean;
  resetToken?: string;
}

export interface Session {
  userId: string;
  tenantId: string;
  roles: string[];
  expiresAt: Date;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  isRootAdmin: boolean;
  isSuperadmin: boolean;
  breakGlassEnabled: boolean;
}

export const AUTH_PURPOSES = {
  PASSWORD_RESET: "password_reset",
  EMAIL_VERIFICATION: "email_verification",
} as const;

export type AuthPurpose = (typeof AUTH_PURPOSES)[keyof typeof AUTH_PURPOSES];
