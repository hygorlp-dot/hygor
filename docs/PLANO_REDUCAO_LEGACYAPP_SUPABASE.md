# Redução do `LegacyApp` e migração gradual ao Supabase

## Estado medido em 17/08/2026

- `src/LegacyApp.jsx`: 21.656 linhas em 20/08 (era 22.579 em 18/08, era
  22.642 em 17/08, era 39.323 em 30/07 - a fila de extração de código da
  seção "Próximas extrações de código" foi fechada por completo em
  16-17/08, ver "Andamento das extrações de UI" abaixo; Equipamentos,
  AprovacoesPendentes e depois Equipe/Rescisao foram extraídas em
  seguida, fora da fila original).
- Grafo de produção: 628 módulos, 1.379 dependências, sem violação
  arquitetural (`npm run architecture:check`).
- Chunk principal (`LegacyApp-*.js`): ~590 kB gzip. Total JS/CSS gzip do
  app: ~1.482 kB (orçamento revisado para 1.520 kB em 17/08 - o aumento é
  um efeito de chunking do Rollup, não código duplicado; ver o comentário
  em `scripts/bundle-budgets.mjs` e o commit da extração de Equipamentos
  para a investigação completa).
- Testes: 218 arquivos e 1.135 testes aprovados.

Estado ainda **não medido nesta rodada** (herdado da medição de 30/07, não
recalculado): arquivos órfãos e imagens duplicadas removidas.

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

## Andamento das extrações de UI (fila fechada em 16-17/08/2026)

Os 8 itens abaixo já foram extraídos de `LegacyApp.jsx` para arquivo próprio,
com `React.lazy` no ponto de uso - mesma camada de dados (blob
`company_app_data`), sem nova migration/RLS:

1. `Orcamento` → `src/domains/orcamentos/components/OrcamentoView.jsx`;
2. `Conciliacao` → `src/features/conciliacao/ConciliacaoView.jsx`;
3. `Terceiros` → `src/domains/terceirizados/components/TerceirosView.jsx`;
4. `Compras` → `src/domains/compras/components/ComprasView.jsx`;
5. `Planejamento` → `src/domains/planejamento/components/PlanejamentoView.jsx`;
6. `CentralAdministrador` → `src/domains/administracao/components/CentralAdministradorView.jsx`;
7. `Comercial` → `src/domains/comercial/components/ComercialView.jsx`;
8. `Folha` → `src/domains/ponto/components/FolhaView.jsx` e `MedicoesView` →
   `src/domains/medicoes/components/MedicoesView.jsx`.

Cada feature recebeu rota com `React.lazy`, mantendo componentes, seletores e
testes próprios sem duplicar regra financeira.

Fora da fila original (medida em 17/08, ver tabela abaixo), extraídas na
sequência por serem as maiores telas ainda inline:

9. `Equipamentos` → `src/domains/equipamentos/components/EquipamentosView.jsx`
   (levou junto `gradeLocacaoEquip`/`resumoLocacaoEquip`, helpers exclusivos
   do mapa de ocupação que tinham ficado para trás na extração inicial -
   ver nota sobre orçamento de bundle no topo deste documento).
10. `AprovacoesPendentes` → `src/domains/aprovacoes/components/AprovacoesPendentesView.jsx`
    (18/08/2026) - a tela em si tinha só ~45 linhas; a estimativa de
    ~2.130 linhas da tabela original estava errada por um motivo
    importante, ver "Correção do método de medição" abaixo.
    `SETORES_APROVACAO`/`MOTORES_APROVACAO_POR_ENTIDADE` continuam em
    `LegacyApp.jsx` (agora exportados) porque `EditorEtapaAprovacao`
    (edição de política de aprovação, ainda inline) também os usa.
11. `Equipe` → `src/domains/rh/components/EquipeView.jsx` e `Rescisao` →
    `src/domains/rh/components/RescisaoView.jsx` (20/08/2026, parte da
    rodada de auditoria/correção do RH). Mesmo padrão da correção de
    método acima: a crítica de design tinha medido "Equipe" como ~3.381
    linhas, mas a função real tem ~515 linhas - a diferença era código
    intersticial não relacionado (`calcFrequenciaMensalFuncionario`,
    `Ponto` e outras telas ainda inline entre `Equipe` e `Rescisao`, que
    ficam ~2.900 linhas separadas fisicamente das duas telas extraídas).
    `Rescisao` tinha ~483 linhas, também sem código intersticial.
    `gerarFichaFuncionarioPDF` continua em `LegacyApp.jsx` (agora
    exportada) porque tem outro consumidor além de `Equipe`. Dois testes
    de wiring estático (`LegacyApp.employee-command-wiring.test.js`,
    `LegacyApp.rescission-command-wiring.test.js`) foram atualizados para
    ler os novos arquivos, seguindo o mesmo padrão já usado quando
    `Folha` foi extraída.

## Correção do método de medição (achado de 18/08/2026)

A tabela "Próximas extrações" original foi medida contando a distância até
a *próxima declaração `^function`* em `LegacyApp.jsx`. Isso **superestima**
o tamanho real de várias telas, porque entre um componente e o próximo
frequentemente existem dezenas a centenas de linhas de **funções/constantes
utilitárias exportadas**, sem relação com o componente anterior, usadas por
outras telas (inclusive já extraídas) via `import {...} from "./LegacyApp"`
- não são código do componente e não devem ser contadas nem movidas junto.

Caso mais extremo: `AprovacoesPendentes` "media" ~2.130 linhas pelo método
antigo, mas a função em si tinha **45 linhas** - as ~2.000 linhas restantes
eram funções de Planejamento (`curvaS`, `caminhoCritico`, `montarCronogramaIA`...),
Conciliação (`parseOFX`, `sugerirRateio`...) e Compras/Estoque
(`calcCompras`, `calcCurvaABC`...) soltas entre as duas funções, a maioria
já servindo os módulos extraídos desses domínios.

Remedição feita em 18/08/2026, com verificação manual de cada intervalo
(conferindo se há `const`/`export const` de outro domínio entre o início do
componente e a próxima função):

| Tela | Estimativa antiga (17/08) | Tamanho real (18/08) | Diferença |
| --- | ---: | ---: | ---: |
| `AprovacoesPendentes` | ~2.130 | 45 (extraído) | -98% |
| `ObraDetalhe` | ~1.055 | ~987 | -6% |
| `DREEmpresa` | ~1.015 | ~806 | -21% |
| `DRELegado` | ~970 | ~771 | -21% |
| `Ponto` | ~760 | ~507 | -33% |
| `DiarioObra` | ~730 | ~707 | -3% |
| `Cadastros` | ~560 | ~557 | -1% |
| `Estoque` | ~545 | ~544 | 0% |

A maioria estava só um pouco inflada (Cadastros/Estoque/DiarioObra batem
quase exato - não têm utilitário interstitial relevante). `Ponto` e
`DREEmpresa`/`DRELegado` tinham overcounting real (~500 linhas de
`buildAlertMessage`/`buildQuickAlerts` no caso de Ponto ficam de fora;
constantes/cálculos de Comercial e do modal de IA no caso de
DREEmpresa/DRELegado). `AprovacoesPendentes` foi o único caso extremo.

**`ObraDetalhe` (~987 linhas) é agora o maior candidato real.** É um caso
especial (roteador de abas da obra, já delega Orçamento/Terceiros/
Planejamento/Medições para os módulos extraídos) - antes de extrair,
mapear com cuidado quais abas ele ainda renderiza inline vs. delega, e
não presumir que o volume é lógica de negócio nova.

## Próximas extrações de código

Números já corrigidos - ver tabela acima. Antes de começar qualquer uma,
reconferir com `grep -n "^function NomeDaTela"` e o mesmo processo manual
de checar interstitials usado nesta remedição, porque o arquivo continua
encolhendo a cada extração e novos interstitials podem aparecer.

`Equipamentos` (~1.640 linhas) e `AprovacoesPendentes` (45 linhas) já
foram extraídas - ver "Andamento das extrações de UI" acima.

`ObraDetalhe` é um caso especial: é o orquestrador de abas de uma obra (já
delega Orçamento/Terceiros/Planejamento/Medições para os módulos extraídos
acima) - seu volume não é lógica de negócio nova, é o roteamento entre abas
mais os formulários de cadastro/edição da obra em si.

Cada feature deve receber rota com `React.lazy`, serviço de API, componentes,
seletores e testes próprios. A extração não autoriza duplicar regra
financeira.

## Gate obrigatório por módulo

- migration e rollback testados;
- RLS testada por papel e obra;
- comandos idempotentes e auditáveis;
- paginação e filtros no servidor;
- contagens e totais iguais ao legado;
- nenhuma perda de anexos ou vínculos;
- testes de integração, build e orçamento de bundle aprovados;
- observação em sombra antes de remover compatibilidade.
