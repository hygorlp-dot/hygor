# Redução do `LegacyApp` e migração gradual ao Supabase

## Estado medido em 30/07/2026

- `src/LegacyApp.jsx`: 39.323 para 38.802 linhas nesta rodada.
- Arquivos órfãos removidos: 30.
- Imagens PNG duplicadas e sem uso removidas: 3,78 MB no repositório.
- Grafo de produção: 530 para 500 módulos, sem violação arquitetural.
- Chunk principal: 600,79 para 569,95 kB gzip.
- Motores de DRE, financeiro e conciliação: chunk próprio de 31,75 kB gzip.
- Testes: 153 arquivos e 698 testes aprovados.

O maior acoplamento restante não é somente visual. O frontend ainda lê muitas
coleções do documento único `company_app_data` e reconstrói seleções,
relacionamentos e indicadores. Em `LegacyApp.jsx`, as coleções mais consultadas
são `obras`, `employees`, `pedidos`, `usuarios`, `materiais`, `transacoes`,
`rdos`, `solicitacoesCompra`, `fornecedores`, `planos` e `terceirizados`.

## O que deve ir para o Supabase

### 1. Cadastros e vínculos operacionais

Normalizar primeiro os dados que têm identidade, relacionamento, permissão e
histórico próprios:

- `projects`, `project_memberships` e `project_settings`;
- `employees`, `employee_assignments` e `employee_pix_identifiers`;
- `suppliers`, `supplier_contacts` e `supplier_categories`;
- `third_party_contracts`, `third_party_contract_stages` e
  `third_party_measurements`;
- `equipment`, `equipment_allocations`, `equipment_rentals` e
  `equipment_maintenance_events`;
- `reference_items`, `reference_compositions`, `reference_coefficients` e
  `unit_conversions`.

Isso retira do React buscas repetidas por obra, colaborador, contrato e insumo,
além de permitir RLS por papel e obra.

### 2. Fluxos transacionais

Cada mudança deve ser um comando idempotente no servidor, com versão esperada e
auditoria append-only:

- compras:
  `purchase_requests → quotations → purchase_orders → goods_receipts →
  supplier_invoices`;
- RH:
  `attendance_events → payroll_periods → payroll_titles → settlements`;
- planejamento:
  `plan_versions → schedule_activities → dependencies → progress_events`;
- qualidade:
  `inspections → inspection_items → nonconformities → reinspections`;
- comercial:
  `leads → lead_events → meetings → proposals → contracts`;
- documentos:
  metadados, permissões e versões no banco; binários em Storage/OneDrive.

O motor financeiro já possui tabelas canônicas para títulos, transações
bancárias, liquidações, eventos, razão, conciliação e idempotência. Não devem ser
criadas coleções financeiras paralelas.

### 3. Projeções de leitura

As telas devem consumir views/RPCs filtradas, em vez de baixar o blob e executar
`filter()`/`reduce()`:

- `v_dre_company_period`;
- `v_dre_project_period`;
- `v_cash_flow_project`;
- `v_accounts_receivable`;
- `v_accounts_payable`;
- `v_unallocated_bank_movements`;
- `v_procurement_pipeline`;
- `v_supplier_ranking`;
- `v_payroll_period_summary`;
- `v_project_progress`;
- `v_client_portal_publication`.

As views financeiras devem ser derivadas exclusivamente do razão canônico. DRE,
caixa, contas a pagar e contas a receber não podem ter implementações
independentes no cliente.

### 4. Automação de servidor

Edge Functions ou jobs podem assumir:

- importação e classificação de OFX;
- processamento assíncrono de SINAPI/ORSE;
- geração de relatórios e exportações;
- avisos de prazo, restrições e vencimentos;
- preparação do contexto gerencial para o CFO Gemini;
- miniaturas, antivírus e metadados de anexos.

Essas tarefas devem publicar status e resultado; a interface não deve permanecer
travada durante o processamento.

## O que deve permanecer no frontend

- componentes, rotas, tema, responsividade e acessibilidade;
- formatação e validações de resposta imediata;
- estado temporário de formulários;
- fila offline e captura mobile;
- cálculos puramente visuais, sem efeito contábil;
- os motores puros compartilhados como oráculo de teste durante a migração.

Regra financeira autoritativa não deve existir somente em uma Edge Function
opaca nem somente no React. O comando e a projeção oficiais ficam no banco/API;
os motores puros permanecem como especificação executável e golden master.

## Sequência sem ruptura

1. Criar tabelas, RLS, índices e views sem alterar a leitura atual.
2. Fazer carga idempotente do blob, preservando `legacy_id`.
3. Comparar contagens, vínculos e totais por empresa, obra e período.
4. Ativar escrita transacional por módulo, mantendo projeção em sombra.
5. Trocar a leitura de uma rota por vez por APIs paginadas.
6. Excluir do `LegacyApp` apenas a implementação cujo gate estiver com
   divergência zero.
7. Tornar a coleção legada somente leitura e removê-la após a janela de
   homologação.

### Andamento

- `CORE-001` iniciado em 30/07/2026:
  `core_projects`, `core_employees`, `core_employee_assignments`,
  `core_employee_identifiers`, `core_suppliers`,
  `core_third_party_profiles` e `core_third_party_contracts`.
- A migration `007_create_core_registry_projection` é aditiva, possui rollback,
  RLS sem política direta para navegador e RPC exclusiva da `service_role`.
- A carga é executada em sombra durante o deploy, compara IDs e hashes e bloqueia
  a publicação se houver divergência.
- O `company_app_data` continua sendo a fonte operacional até os gates de
  contagem, vínculo, permissão e escrita transacional serem aprovados.

## Próximas extrações de código

Ordem recomendada pelo volume e isolamento atuais:

1. `Orcamento` e importadores SINAPI/ORSE;
2. `Conciliacao`;
3. `Terceiros`;
4. `Compras`;
5. `Planejamento`;
6. `CentralAdministrador`;
7. `Comercial`;
8. `Folha` e `MedicoesView`.

Cada feature deve receber rota com `React.lazy`, serviço de API, componentes,
seletores e testes próprios. A extração não autoriza duplicar regra financeira.

## Gate obrigatório por módulo

- migration e rollback testados;
- RLS testada por papel e obra;
- comandos idempotentes e auditáveis;
- paginação e filtros no servidor;
- contagens e totais iguais ao legado;
- nenhuma perda de anexos ou vínculos;
- testes de integração, build e orçamento de bundle aprovados;
- observação em sombra antes de remover compatibilidade.
