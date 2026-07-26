-- ARCD Client Portal Foundation
-- Execute somente após revisão no Supabase SQL Editor. Esta migration não
-- altera o blob operacional, finanças, autenticação interna ou dados atuais.

create table if not exists public.client_portal_users (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  email text not null,
  phone text,
  password_hash text,
  status text not null default 'active' check (status in ('invited','active','revoked','archived')),
  two_factor_enabled boolean not null default false,
  trusted_devices jsonb not null default '[]'::jsonb,
  last_login_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, email)
);

create table if not exists public.client_portal_project_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  portal_user_id uuid not null references public.client_portal_users(id) on delete restrict,
  project_id text not null,
  profile text not null check (profile in ('owner','spouse','representative','financial','external_architect','observer')),
  grants jsonb not null default '[]'::jsonb,
  revokes jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, portal_user_id, project_id)
);

create table if not exists public.client_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  portal_user_id uuid not null references public.client_portal_users(id) on delete cascade,
  token_hash text not null unique,
  device_hash text,
  ip_hash text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.client_portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  portal_user_id uuid references public.client_portal_users(id) on delete set null,
  project_id text,
  event_type text not null,
  correlation_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.client_portal_publications (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  project_id text not null,
  domain text not null,
  status text not null default 'draft' check (status in ('draft','in_review','approved','published','archived','superseded')),
  visibility text not null default 'project_users' check (visibility in ('project_users','owners','financial','selected_profiles','selected_users')),
  visible_to_profiles jsonb not null default '[]'::jsonb,
  visible_to_user_ids jsonb not null default '[]'::jsonb,
  version integer not null default 1 check (version > 0),
  replaces_id uuid references public.client_portal_publications(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  created_by text not null,
  reviewed_by text,
  published_by text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists client_portal_memberships_lookup_idx on public.client_portal_project_memberships(company_id, portal_user_id, project_id) where active;
create index if not exists client_portal_sessions_lookup_idx on public.client_portal_sessions(company_id, token_hash) where revoked_at is null;
create index if not exists client_portal_audit_events_project_idx on public.client_portal_audit_events(company_id, project_id, created_at desc);
create index if not exists client_portal_publications_read_idx on public.client_portal_publications(company_id, project_id, domain, status, published_at desc);

alter table public.client_portal_users enable row level security;
alter table public.client_portal_project_memberships enable row level security;
alter table public.client_portal_sessions enable row level security;
alter table public.client_portal_audit_events enable row level security;
alter table public.client_portal_publications enable row level security;

-- Não criar políticas para anon/authenticated: somente as funções de servidor
-- com service role podem acessar estas tabelas. URLs, mídia e documentos serão
-- emitidos por endpoints autenticados em etapa posterior.
