-- Migration 001: Root authentication tables
-- Every tenant-owned table carries tenant_id for scoping.
-- RLS is defense-in-depth only; authorization is enforced server-side.

CREATE TABLE IF NOT EXISTS tenant_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  domain TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_workspaces_tenant_slug
  ON tenant_workspaces(tenant_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_workspaces_tenant_domain
  ON tenant_workspaces(tenant_id, domain)
  WHERE domain IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  is_root_admin BOOLEAN DEFAULT FALSE,
  is_superadmin BOOLEAN DEFAULT FALSE,
  break_glass_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_tenant_email
  ON auth_users(tenant_id, email);

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_tenant_user_purpose
  ON otp_codes(tenant_id, user_id, purpose);

CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at
  ON otp_codes(expires_at);

-- RLS (defense-in-depth only)
ALTER TABLE tenant_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_workspaces ON tenant_workspaces
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_users ON auth_users
  USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_otp ON otp_codes
  USING (tenant_id = current_setting('app.current_tenant_id', true));
