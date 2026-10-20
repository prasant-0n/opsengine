-- Feature #6: CRM core (PRD Module 9). Flat, tenant-scoped tables (same style as ats_core).

CREATE TABLE IF NOT EXISTS crm_accounts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    source TEXT NOT NULL DEFAULT 'inbound',
    status TEXT NOT NULL DEFAULT 'prospect', -- prospect | active | on_hold | churned
    client_tier TEXT, -- standard | strategic
    owner_id UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMP(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT crm_accounts_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_crm_acc_tenant_status_created ON crm_accounts(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    account_id UUID NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    title TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT crm_contacts_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_crm_con_tenant_account ON crm_contacts(tenant_id, account_id);

CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    source TEXT NOT NULL DEFAULT 'inbound',
    status TEXT NOT NULL DEFAULT 'new', -- new | working | qualified | unqualified | converted
    owner_id UUID NOT NULL,
    next_action TEXT,
    next_action_at TIMESTAMP(6) with time zone,
    notes TEXT,
    converted_account_id UUID,
    converted_contact_id UUID,
    converted_opportunity_id UUID,
    created_at TIMESTAMP(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT crm_leads_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_crm_lead_tenant_status_created ON crm_leads(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS crm_opportunities (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    account_id UUID NOT NULL,
    name TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'prospecting', -- prospecting | qualification | proposal | negotiation | won | lost
    amount_cents BIGINT NOT NULL DEFAULT 0, -- integer cents; never binary float
    currency TEXT NOT NULL DEFAULT 'USD',
    expected_close_date TIMESTAMP(6) with time zone,
    probability INTEGER,
    forecast_category TEXT, -- pipeline | best_case | commit | closed
    owner_id UUID NOT NULL,
    lost_reason TEXT,
    competitor_notes TEXT,
    created_at TIMESTAMP(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_crm_opp_tenant_stage_created ON crm_opportunities(tenant_id, stage, created_at);
