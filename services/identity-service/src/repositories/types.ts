export interface Workspace {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
}

export interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string | null;
  is_root_admin: boolean;
  is_superadmin: boolean;
  break_glass_enabled: boolean;
}

export interface OtpRow {
  id: string;
  tenant_id: string;
  user_id: string;
  code: string;
  purpose: string;
  expires_at: Date;
  used_at: Date | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  tenant_id: string;
  token: string;
  expires_at: Date;
}

export interface ResetTokenRow {
  token: string;
  user_id: string;
  tenant_id: string;
  expires_at: Date;
}
