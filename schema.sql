-- ═══════════════════════════════════════════════════════════════════
-- ArcD Ponto PRO — schema
--
-- Agora o navegador NÃO fala com o banco. Quem fala é /api/data, no
-- servidor, usando a service_role key (que ignora RLS por natureza).
--
-- Logo, a política aqui é a mais restritiva possível: NINGUÉM entra
-- pelo cliente. Se alguém roubar a anon key do bundle, não consegue
-- ler uma linha.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.company_app_data (
  company_id  text        not null,
  key         text        not null,
  value       jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (company_id, key)
);

alter table public.company_app_data enable row level security;

-- Apaga a política insegura do SETUP antigo, se você chegou a rodá-la
drop policy if exists "allow_all" on public.company_app_data;

-- NENHUMA política de acesso para anon/authenticated.
-- Sem política = acesso negado por padrão. É exatamente o que queremos:
-- o único caminho até estes dados é a função serverless, que usa a
-- service_role key e confere o PIN antes de devolver qualquer coisa.

-- Linha inicial (o app preenche no primeiro acesso)
insert into public.company_app_data (company_id, key, value)
values ('arcd', 'arced_ponto_v1', '{}'::jsonb)
on conflict (company_id, key) do nothing;
