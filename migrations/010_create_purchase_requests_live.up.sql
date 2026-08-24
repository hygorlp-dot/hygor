-- Primeira escrita transacional real de Fase 2 (24/08/2026, ver
-- docs/BLUEPRINT_CONCORRENCIA_TRAVA.md, seção "Fase 2, primeiro passo na
-- camada transacional"). Diferente do CORE-001/CORE-002 (projeção em
-- sombra, sincronização em lote, só leitura até aqui), esta tabela recebe
-- escrita ao vivo: toda vez que SOLICITACAO_COMPRA_SALVA é processado com
-- sucesso (api/data.js, ação "operational-command"), a linha correspondente
-- é gravada aqui como efeito colateral de MELHOR ESFORÇO - se essa
-- gravação falhar, a resposta ao usuário continua exatamente igual (o
-- blob em company_app_data continua sendo a fonte de verdade operacional;
-- só fica um log de erro no servidor), mesmo padrão de tolerância já usado
-- em sincronizarPontoAposArquivo.
--
-- Por ser uma gravação individual por comando (não um sync em lote como
-- core_registry_sync_legacy), não precisa de RPC dedicada nem de lógica de
-- arquivamento por ausência - é um upsert direto pelo cliente service_role
-- já usado no resto de api/data.js, protegido pelo mesmo padrão de RLS das
-- migrations anteriores.
--
-- Não modela `itens`/`observacao`/histórico de aprovação em colunas
-- próprias - ficam inteiros dentro de `payload`, mesmo princípio de escopo
-- mínimo do CORE-001/CORE-002 (cadastro/vínculo primeiro, detalhe
-- transacional fica em jsonb até haver necessidade real de consultá-lo
-- normalizado).

create table if not exists public.purchase_requests (
  company_id      text        not null,
  id              text        not null,
  request_number  text        not null default '',
  project_id      text        not null,
  needed_by       date,
  priority        text        not null default 'normal',
  notes           text        not null default '',
  source_version  integer     not null default 0 check (source_version >= 0),
  payload         jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, project_id)
    references public.core_projects(company_id, id) on delete restrict,
  check (btrim(id) <> '')
);
create index if not exists idx_purchase_requests_company_project
  on public.purchase_requests(company_id, project_id);

alter table public.purchase_requests enable row level security;

revoke all on table public.purchase_requests from public, anon, authenticated;

grant select, insert, update on table public.purchase_requests to service_role;

notify pgrst,'reload schema';
