-- ATS Core migration
CREATE TABLE IF NOT EXISTS requisitions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT,
  job_title TEXT NOT NULL,
  job_family TEXT,
  grade TEXT,
  headcount INT NOT NULL DEFAULT 1,
  budget_band TEXT,
  hiring_manager_id UUID,
  justification TEXT,
  expected_start_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_req_tenant_status_created ON requisitions(tenant_id,status,created_at);
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  source TEXT,
  resume_url TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  consent_ip TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  linked_requisition_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cand_tenant_email_status ON candidates(tenant_id,email,status);
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  requisition_id UUID,
  candidate_id UUID,
  type TEXT NOT NULL DEFAULT 'phone',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  location TEXT,
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intv_tenant_cand_start ON interviews(tenant_id,candidate_id,start_at);
CREATE TABLE IF NOT EXISTS interview_panel_members (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  interview_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'interviewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ipm_tenant_interview_emp UNIQUE (tenant_id,interview_id,employee_id)
);
CREATE TABLE IF NOT EXISTS interview_feedback (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  interview_id UUID NOT NULL,
  interviewer_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating >=1 AND rating <=5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ifb_tenant_interview_intr ON interview_feedback(tenant_id,interview_id,interviewer_id);
CREATE TABLE IF NOT EXISTS stage_history (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sh_tenant_ent_created ON stage_history(tenant_id,entity_type,entity_id,created_at);
