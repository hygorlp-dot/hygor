# Auditoria funcional, técnica e de produto — ARCD

Data: 14 de agosto de 2026
Base auditada: commit `b87cc6b` (branch `main`, `origin/main` no momento da auditoria)
Auditoria anterior: 22 de julho de 2026, commit `d16a63c` — este documento revalida cada achado daquela rodada contra o código atual, item por item, em vez de reescrever do zero.
Escopo: os mesmos treze eixos da auditoria anterior — código-fonte, modelo de dados, APIs, autenticação, permissões, fluxos, navegação, integrações, build, dependências e prontidão comercial.

## 0. O que mudou desde 22/07 — resumo para quem já leu a auditoria anterior

Três semanas e meia de trabalho real, não cosmético. Os P0 de segurança e integridade da rodada anterior majoritariamente **foram corrigidos** — autorização por payload, autorização por escrita, ledger de auditoria imutável e backup automatizado passaram de "não existe" para "existe e está com teste/prova". O motor financeiro canônico que a auditoria recomendava **foi construído** — mas roda em modo sombra, não substituiu o caminho legado ainda. A migração de CRA para Vite **aconteceu**. Uma suíte de testes automatizados **existe agora** (1.010 testes) — inclusive com 3 falhas ativas neste exato commit, o que é normal para um projeto em movimento, mas precisa de acompanhamento.

O que não mudou, ou mudou menos do que a estrutura de pastas sugere à primeira vista:

- **O monólito de frontend não encolheu — mudou de lugar.** `src/App.jsx` caiu para 11 linhas, mas é uma casca de roteador. `src/LegacyApp.jsx` tem **40.311 linhas**, mais que as 33.175 do arquivo único de julho. A extração por domínio está real e ativa (~34 pastas em `src/domains/`), mas na ordem que o próprio time definiu (`docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`), o item #3 (Terceiros) só teve a camada de cálculo extraída — a UI inteira ainda mora no monólito.
- **O bundle não ficou menor — ficou mais bem dividido.** Total de ~1,27 MB gzip somando todos os chunks contra os 795 kB de um bundle único em julho. O chunk do `LegacyApp` sozinho (672 kB gzip) quase repete o tamanho do bundle antigo inteiro.
- **LGPD continua em zero.** Nenhum artefato de base legal, consentimento, retenção, exportação ou atendimento ao titular foi encontrado.
- **TypeScript é decoração, não proteção.** `tsconfig.quality.json` roda no CI, mas cobre 2 arquivos `.ts` contra 314 arquivos `.js`/`.jsx`.
- Duas duplicidades financeiras específicas que a auditoria de julho apontou como críticas continuam abertas: pagamento duplicado entre `pedido`/`nota` (mitigado por convenção de ID, não por schema) e ausência de catálogo único de documentos.

## 1. Parecer executivo

O ARCD manteve a cobertura funcional ampla já registrada em julho — comercial, orçamento, planejamento, execução, qualidade, compras, estoque, financeiro, RH, licenciamento, documentos, IA e portal do cliente — e ganhou um módulo novo completo (locação de equipamentos, 5 fases). O produto avançou de "piloto interno" para um estágio onde a maior parte dos bloqueadores **P0 de segurança e integridade já foi endereçada com evidência em código**, não apenas planejada.

Ainda não deve ser vendido como SaaS maduro para múltiplas empresas sem fechar os itens que seguem P0 nesta rodada: LGPD (inalterado, crítico), o motor financeiro canônico continuar em modo sombra sem data definida para ativação, e a duplicidade de pagamento entre pedido/nota.

Principais razões que sustentam essa posição:

- autorização por payload e por escrita agora existe no servidor (era o maior P0 de julho) — corrigido;
- ledger de auditoria imutável e backup automatizado diário — corrigidos;
- o motor financeiro canônico existe e tem testes, mas roda em modo sombra: o caminho legado (`outrasDesp`, `despesasEmpresa`, `caixaObra`, `transacoes`) continua sendo a fonte de verdade em produção;
- LGPD segue sem nenhum controle, apesar do sistema tratar CPF, RG, salário, PIX, endereço e fotos;
- o monólito de frontend não diminuiu — a extração por domínio está em andamento, mas incompleta mesmo nos itens já iniciados;
- dependências de alto risco caíram de 14 para 1 (produção) / 4 (incluindo build tooling) — melhora real, ainda não zero;
- 3 testes estão falhando neste commit — não é um retrocesso grave, mas é uma regressão ativa que merece triagem antes de crescer.

### Resultado resumido

| Dimensão | Avaliação em 22/07 | Avaliação em 14/08 | Observação |
|---|---|---|---|
| Cobertura funcional | Forte | Forte, maior | módulo de equipamentos novo, portal do cliente amadureceu |
| Segurança de acesso | Insuficiente para venda | Adequada para piloto ampliado | projeção por payload e por escrita agora reais no servidor |
| Integridade financeira | Múltiplos livros paralelos | Ledger canônico existe, não é a fonte ativa | modo sombra, `FINANCIAL_ENGINE_ENFORCE=false` |
| Concorrência | Média/baixa | Média/baixa | blob único continua primário; auditoria agora é imutável |
| Testabilidade | Baixa (zero testes) | Alta em volume, com ressalva | 1.010 testes, 1.007 passando, 3 falhando agora |
| Desempenho | Médio (795 kB gzip) | Médio, mudou de forma | ~1,27 MB gzip total, mas dividido em chunks lazy-loadable |
| Backup e continuidade | Não comprovado | Comprovado | cron diário, criptografado, com verificação |
| LGPD | Ausente | Ausente | nenhuma mudança |
| Prontidão comercial | Piloto | Piloto ampliado | P0 remanescentes: LGPD, ativação do motor financeiro, dedupe pedido/nota |

## 2. Método

Diferença de método em relação a julho: como o motor financeiro e a autorização por servidor agora existem, a verificação não pôde se basear só em leitura de código — foi preciso distinguir schema/função **existente** de comportamento **realmente ativo em produção** (ex.: uma tabela e uma função PL/pgSQL existirem não significa que o caminho legado parou de ser usado). Cada achado abaixo está marcado como corrigido, parcialmente corrigido ou aberto com essa distinção em mente, e cita o arquivo que comprova o status.

Foram inspecionados nesta rodada:

- `src/App.jsx` (11 linhas, shell de rotas) e `src/LegacyApp.jsx` (40.311 linhas);
- `src/domains/*` (~34 pastas) e `src/features/suprimentos`;
- `api/data.js`, `api/auth.js`, `api/client.js` e as demais rotas serverless;
- `server/data-projection.js`, `server/section-authorizations.js`, `server/app-auth-security.js`, `server/client-portal-auth.js`, `server/financial-write-policy.js`;
- `migrations/` (motor financeiro, auditoria append-only, rate limit persistente, registry projection, client portal);
- `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`, `docs/MOTOR_FINANCEIRO_TRANSACIONAL.md`, `docs/CONCILIACAO_ASSISTIDA_FASE_1.md`, `docs/BACKUP_ONEDRIVE.md`;
- `package.json`, `vite.config.mjs`, `vercel.json`, `.github/workflows/quality.yml`, `tsconfig.quality.json`;
- suíte de testes (`vitest`), `npm audit`, `npm run build`.

Validações executadas nesta rodada:

- `npm run build`: compilado com sucesso (Vite/rolldown), aviso de chunk grande (`LegacyApp`, 2,37 MB antes de gzip);
- bundle: sem um número único comparável a julho — ~1,27 MB gzip somando todos os chunks; `LegacyApp` isolado é 672,44 kB gzip;
- `npx vitest run`: **215 arquivos de teste (213 aprovados, 2 falhando), 1.010 testes (1.007 aprovados, 3 falhando)** — falhas em `src/login-mobile-layout.test.js` (2) e `src/LegacyApp.field-report-flow.test.js` (1);
- `npm audit --omit=dev`: **1 alerta alto** (`brace-expansion`, correção disponível via `npm audit fix`);
- `npm audit` completo (incluindo dependências de build/teste): 5 alertas (1 moderado, 4 altos) — a diferença para o número acima é só escopo (produção vs. toda a árvore de dependências), ambos com correção automática disponível.

## 3. Inventário funcional

Sem mudança estrutural relevante nos setores/módulos listados em julho, com um acréscimo: **Equipamentos** (locação, calendário, cadastro físico, ciclo de locação e cobrança — 5 fases documentadas em `docs/EQUIPAMENTOS_FASE_1..5_*.md`) passou a ser um módulo completo, não mais só um item dentro de Recursos. As coleções principais do estado normalizado seguem as mesmas descritas em julho, mais as tabelas canônicas novas (ver seção 8).

*(Seções 3.1/3.2 da auditoria anterior não foram reverificadas linha a linha nesta rodada — o inventário funcional não é onde a mudança de três semanas se concentrou.)*

## 4. Auditoria de clareza setorial

Não reverificada nesta rodada — nenhum dos quatro agentes de investigação cobriu navegação/UX. Os pontos positivos e as ambiguidades registradas em julho (Compras global vs. por obra, múltiplas portas de entrada no Financeiro, Cadastros gerais misturando entidades, telas antigas convivendo com novas, "Medição" ambíguo) devem ser tratados como possivelmente ainda válidos, mas não confirmados. Recomenda-se uma rodada dedicada a isso antes de decidir prioridade.

## 5. Duplicidades e fontes de verdade

### 5.1 Clientes — parcialmente corrigido

`clienteId` passou a ser usado mais amplamente — editar um cliente agora cascateia o nome (`contratante`) para os contratos vinculados por `clienteId` (`src/LegacyApp.jsx:37011`). Mas os campos livres `obra.cliente`/`contrato.contratante` continuam existindo em paralelo e são editáveis independentemente em pelo menos um formulário (`src/LegacyApp.jsx:19529`). Ainda não é o vínculo único e obrigatório recomendado.

### 5.2 Usuários versus funcionários — aberto

Sem mudança. `usuarios` (`src/LegacyApp.jsx:2886`) segue sem campo `employeeId` — a normalização do usuário tem `id, nome, pin, role, accessTabs, email, maxDesconto, obraId, active, createdAt`, nenhum vínculo com `employees`.

### 5.3 Responsável por ID e por nome — sem mudança (intencional)

Não reverificado especificamente nesta rodada; comportamento intencional, sem indício de mudança.

### 5.4 Pagamento em pedido e nota — aberto

**Sem correção arquitetural.** `src/domains/conciliacao/mutations.js` (`registrarPagamentoEConciliar`, ~linhas 147-161) continua escrevendo o mesmo objeto de pagamento em `notasFiscais[].pagamentos` e `pedidos[].pagamentos`, evitando dupla contagem por convenção de ID compartilhado — exatamente a mitigação (não a correção) que a auditoria de julho já havia descrito. Não existe coleção única `pagamentos`.

### 5.5 Pedido, nota, pagamento, caixa, transação e DRE — parcialmente corrigido, ainda não é a fonte ativa

O ledger financeiro canônico recomendado em julho **foi construído de verdade**: `migrations/20260725_financial_engine.sql` cria `financial_titles`, `settlements`, `bank_transactions`, `reconciliation_links`, `financial_events`, `journal_entries/lines`, `accounting_periods`, `idempotency_records`, `legacy_record_links` e `data_quality_cases`, com uma função transacional `financial_execute_command()` (idempotente, com lock, cobrindo `CREATE_FINANCIAL_TITLE`/`REGISTER_SETTLEMENT`/`REVERSE_SETTLEMENT`/`CLOSE_ACCOUNTING_PERIOD`). Isso é chamado por `api/data.js` (ação `financial-command`) e tem testes de integração próprios.

**Mas roda em modo sombra.** `FINANCIAL_ENGINE_ENFORCE=false` no ambiente atual; `server/financial-write-policy.js` mostra que o conjunto de seções legadas que ainda podem escrever direto (`FINANCIAL_SNAPSHOT_WRITER_SECTIONS`) está vazio — ou seja, tecnicamente pronto para ativar — mas a ativação continua desligada por decisão deliberada, não por bloqueio técnico, enquanto a sincronização em sombra (`financial-shadow-sync`) não demonstrar paridade total. **As coleções legadas (`pedidos`, `notasFiscais`, `caixaObra`, `transacoes`, `outrasDesp`, `despesasEmpresa`) continuam sendo a fonte viva em produção hoje.**

`data_quality_cases` é um mecanismo real e ativo (não só uma tabela vazia): `api/data.js` (~linha 1370) abre e resolve casos automaticamente a cada sincronização em sombra, e há um painel admin (`src/LegacyApp.jsx:~6735`) mostrando divergências ao vivo.

**Achado específico sobre folha/terceirizados** (o ponto que motivou uma investigação dedicada nesta sessão): a dupla contagem de custo de mão de obra/terceirizado via conciliação **está corrigida no caminho novo**. `src/domains/conciliacao/payroll.js` e `mutations.js` liquidam contra `titulosFolha` e gravam em `reconciliationLinks`, com comentário explícito "não recria custo de mão de obra" — nunca tocam `outrasDesp`/`despesasEmpresa`. O caminho legado (`pagamentosFolha`, tipo `"funcionario"`) ainda coexiste para compatibilidade, mas também não duplica. O único caminho que ainda escreve em `outrasDesp`/`despesasEmpresa` é a criação manual de lançamento novo, atrás de uma confirmação explícita do operador de que não há fato financeiro equivalente já registrado (`duplicidadeRevisada`) — é criação legítima de despesa nova, não o bug antigo.

### 5.6 Documentos — aberto

Sem correção. Nenhuma coleção/tabela `arquivos` unificada foi encontrada em `migrations/` ou `src/`. Um módulo `src/domains/documentos/` existe, mas cobre *revisões* de documentos de engenharia (`publishRevision`, `documentIsCurrent`) — um conceito diferente do catálogo de metadados de arquivo/OneDrive que a auditoria recomendava. `documentosMovimentacoes` e `obra.documentosOneDrive` continuam espalhados como antes.

### 5.7 Avanço físico — parcialmente corrigido

Continuam três fontes independentes (Planejamento, RDO, Medições de evolução), mas `fundirEvolucao` (`src/LegacyApp.jsx:~16983`) agora aplica uma regra de precedência explícita e centralizada: um valor com `progressoOrigem === "medicao_tecnica_aprovada"` é tratado como autoritativo e não pode ser sobrescrito pelo diário; caso contrário, vence quem foi atualizado mais recentemente entre Planejamento e RDO. É uma política de merge documentada, não mais divergência ad hoc — progresso real, mas ainda é um rollup no frontend sobre três coleções, não o livro de eventos único recomendado.

### 5.8 Bases de referência — sem mudança

Não reverificado especificamente nesta rodada.

### 5.9 Status distribuídos — sem mudança

Não reverificado especificamente nesta rodada.

### 5.10 Duplicidade literal no código — sem mudança

Não reverificado especificamente nesta rodada.

## 6. Segurança e permissões

### 6.1 Carga integral do dataset — ✅ corrigido

`server/data-projection.js` implementa `projectDataForUser(payload, user)`: lista de permissão por papel (`ROLE_SECTIONS`), escopo por obra (`hasObra`/`filterByObra`) e remoção de campo sensível (PIN, CPF, salário, PIX via `sanitizeUser`/`sanitizeEmployee`). Aplicado em todo caminho de resposta de `api/data.js` (`auth-login`, `load`, resultados de save/comando). Admin recebe o payload completo por design — correto.

### 6.2 Salvamento de seções sem política geral — ✅ corrigido

`server/section-authorizations.js` define `authorizeSectionChanges` com mapa explícito `SECTION_ROLES` cobrindo praticamente toda coleção de primeiro nível, negação por padrão para chaves não mapeadas, checagem de escopo por obra e validação de registro sem vínculo. Aplicado nos três caminhos de salvamento de `api/data.js`. Reforçado por `validateNoPhysicalDeletes` e políticas de imutabilidade de orçamento/baseline.

### 6.3 Primeiro administrador — ❌ ainda aberto

Sem mudança. Nenhum `SETUP_SECRET`, token de convite ou bloqueio pós-provisionamento foi encontrado. `api/data.js`, ação `setup`, ainda só verifica `usuarios.length === 0` — qualquer requisição não autenticada que alcançar uma instalação vazia ainda pode se autoprovisionar como admin.

### 6.4 PIN — parcialmente corrigido

`server/app-auth-security.js` trocou SHA-256 simples por **scrypt** (N=16384, salgado, formato `scrypt-v1$...`), com upgrade transparente do hash antigo no próximo login bem-sucedido. O rate limit deixou de ser só em memória e agora é **persistido no banco** (`applyPersistentAuthRateLimit`, `migrations/20260726_auth_rate_limit.sql`) — resolve diretamente a reclamação de julho sobre instâncias serverless não compartilharem bloqueio. Autenticação por e-mail/senha + sessão JWT também passou a existir (`auth-login`/`auth-provision`). Mas o PIN continua sendo credencial ativa e válida para a maioria dos operadores, não foi aposentado; MFA continua ausente.

### 6.5 Links de arquivo — ❌ ainda aberto

Sem mudança. `server/microsoft/graph.js`: `fileSignature = (driveId,itemId) => hmac(...)` continua sendo uma assinatura HMAC estática, sem componente de tempo/expiração, usada em `api/microsoft/onedrive.js`.

### 6.6 Portal do cliente — ✅ corrigido

`api/client.js` + `server/client-portal-auth.js`/`client-portal-runtime.js`: login real por e-mail/senha, sessões no servidor (`client_portal_sessions`, expiração de 12h, revogação, endpoint de logout), cookie em vez de token na URL, e eventos de auditoria (`auditPortalEvent`) em login/logout/visualização.

### 6.7 Dados pessoais e LGPD — ❌ ainda aberto, crítico

Sem nenhuma mudança. Busca por LGPD, consentimento, retenção, anonimização, política de privacidade e direitos do titular em `docs/`, `src/`, `api/`, `server/` não encontrou nada além de menções incidentais (ex.: campo `titularPix`) e uma nota que adia o Sentry justamente por risco de PII/LGPD (`docs/AVALIACAO_FERRAMENTAS_ARCD.md:38`). Nenhum documento posterior a 26/07 trata do tema. Dado que o sistema segue tratando CPF, RG, estado civil, salário, PIX, endereço, fotos e contratos, este continua sendo o item P0 mais crítico do relatório.

### 6.8 Pontos positivos de segurança adicionais desta rodada

- hash de PIN migrado para scrypt com upgrade transparente;
- rate limit de autenticação agora persistente entre instâncias;
- autenticação de e-mail/senha com sessão JWT para operadores e para o portal do cliente;
- auditoria de acesso ao portal do cliente (login/logout/visualização);
- backup diário automatizado, criptografado e com verificação (ver 7.4).

## 7. Integridade e concorrência

### 7.1 Blob único — ainda majoritariamente aberto

`company_app_data` continua sendo a fonte primária de leitura e escrita para a maior parte do sistema. As tabelas `core_*` (`migrations/007_create_core_registry_projection.up.sql`) e o motor financeiro existem, mas operam em modo sombra — o frontend ainda lê o blob como fonte principal, confirmado pelo próprio `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md` (30/07) e por `FINANCIAL_ENGINE_ENFORCE` continuar desligado por padrão.

### 7.2 Auditoria mutável — ✅ corrigido

`migrations/20260725_append_only_audit.sql` cria `audit_events` com triggers que bloqueiam UPDATE/DELETE, populada atomicamente junto com a escrita do blob via RPC `company_save_with_audit` (exclusiva de `service_role`). `changeLog` foi excluído das seções que o cliente pode escrever diretamente. Ressalva menor: o schema captura ator/ação/correlação, mas não IP/session ID como a auditoria original recomendava.

### 7.3 Arquivo de ponto — sem mudança

Continua sendo o padrão de referência para decomposição dos demais módulos, como já registrado em julho.

### 7.4 Backup — ✅ corrigido

`vercel.json` tem cron diário (`0 3 * * *`, ação `backup-create`) protegido por `CRON_SECRET`, saída criptografada em AES-256-GCM, manifesto com hash SHA-256, ação `backup-verify` e processo de restauração documentado em `docs/BACKUP_ONEDRIVE.md`.

## 8. Auditoria financeira

Ver detalhamento completo na seção 5.5. Resumo do que mudou desde julho:

- ledger canônico real, com testes, rodando em modo sombra — não é mais só uma recomendação;
- a dupla contagem específica de mão de obra/terceirizado via conciliação foi eliminada no caminho novo;
- `data_quality_cases` funciona de verdade como mecanismo de rastreio de divergência durante a migração;
- a duplicidade pedido/nota (5.4) e a ausência de uma Central de Pagamentos única continuam exatamente como em julho — mitigadas por convenção de ID, não por schema.

O fluxo canônico recomendado em julho (`Pedido → NF/Documento → Conferência → Autorização → Pagamento → Conciliação → DRE`) continua sendo a meta correta; o motor financeiro construído nesta janela é a peça de infraestrutura que faltava para chegar lá, mas ainda não é o caminho que os usuários realmente percorrem.

## 9. Qualidade e engenharia

Não reverificado em profundidade nesta rodada, com uma exceção relevante: a suíte de testes agora cobre boa parte da lista que a auditoria de julho pedia como cobertura mínima antes de venda (BDI, rescisão, rateio/conciliação, DRE têm testes de domínio dedicados) — ver seção 10.4 para os números. Os pontos positivos e riscos de qualidade de obra (conferência, FVS/FVM, RDO) registrados em julho não foram reconferidos.

## 10. Arquitetura e manutenção

### 10.1 Monólito de frontend — parcialmente corrigido, com ressalva importante

`src/App.jsx` caiu de 33.175 linhas para **11 linhas** — mas é uma casca (`lazy`/`Suspense` para `OperationalApp` ou o portal do cliente). O monólito não encolheu, migrou: `src/LegacyApp.jsx` tem **40.311 linhas**, maior que o arquivo original de julho. `src/domains/` já tem ~34 pastas extraídas e `src/features/suprimentos` existe, mas seguindo a própria ordem de extração do time (`docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`: Orçamento → Conciliação → **Terceiros** → Compras → Planejamento → ...), o item #3 (Terceiros) só teve os motores de cálculo puros extraídos (`src/domains/terceirizados/*.js` — catálogo, ciclo de vida, semana de pagamento, retenções) como "oráculo de golden master"; a UI (kanban, painéis de DRE, formulários — 237 ocorrências de "terceiro" em `LegacyApp.jsx`) continua no monólito.

### 10.2 Design system

Não reverificado nesta rodada.

### 10.3 Build e dependências — parcialmente corrigido

- CRA → Vite: **feito** (`vite build`, `rolldown`);
- code splitting: **existe de verdade agora** (33+ chunks JS/CSS), ao contrário do "praticamente inexistente" de julho;
- tamanho total: **piorou em bytes brutos** — soma de todos os chunks gzip ≈ 1,27 MB contra os 795 kB de um bundle único em julho. O chunk `LegacyApp` isolado (672 kB gzip) quase repete o bundle inteiro antigo. A arquitetura melhorou (lazy-loadable, cacheável por chunk), o payload total não diminuiu ainda;
- `npm audit`: caiu de 29 alertas (14 altos) para 1 alto em produção / 5 no total (1 moderado, 4 altos) incluindo ferramental de build — melhora grande, ainda não zero, com correção automática disponível para o que resta;
- CI real: `.github/workflows/quality.yml` conecta `lint` (`check-financial-boundaries.mjs`), `architecture:check` (dependency-cruiser), `typecheck`, `prebuild` (checagem de prontidão financeira + integridade de catálogo + migrações em sombra), `quality:bundle`, `npm audit --audit-level=high`, `test:coverage` e Playwright. Única exceção: `knip.json`/`quality:knip` existe mas não está conectado em nenhum lugar — aspiracional.

### 10.4 Testes — ✅ corrigido, com ressalva ativa

De zero testes em julho para **215 arquivos de teste, 1.010 testes** (`npx vitest run`). **1.007 passando, 3 falhando** neste commit exato — falhas em `src/login-mobile-layout.test.js` (2) e `src/LegacyApp.field-report-flow.test.js` (1). A lista de cobertura mínima que a auditoria de julho pedia está majoritariamente coberta: BDI (`src/domains/orcamentos/bdi.test.js`), rescisão (`src/domains/rh/rescission-commands.test.js`), rateio/conciliação (`src/domains/conciliacao/*.test.js`), DRE (`src/domains/dre/calculations.test.js`), além de `test:e2e` via Playwright e um cenário de golden master financeiro multi-obra (`src/fixtures/financial-golden-master.test.js`).

TypeScript é a exceção: `tsconfig.quality.json` roda no CI (`typecheck`), mas seu `include` cobre só **2 arquivos `.ts`** contra 198 `.js` + 116 `.jsx` no projeto — adoção real ainda é próxima de zero, apesar do CI já impor a checagem.

## 11. Prontidão comercial

### 11.1 O que já é demonstrável

Tudo que constava em julho, mais: módulo de equipamentos completo (5 fases), portal do cliente com autenticação real e auditoria de acesso, backup automatizado comprovado.

### 11.2 Condições para vender com segurança — status atualizado

#### P0 — antes de qualquer cliente externo

- ~~autorização server-side por módulo, ação e obra~~ — ✅ feito;
- ~~decompor ou proteger efetivamente os dados sensíveis~~ — ✅ proteção feita (projeção por payload); decomposição segue em andamento;
- razão financeiro canônico e teste contra duplicidade — **infraestrutura pronta, não ativada** (modo sombra);
- ~~testes automatizados dos fluxos críticos~~ — ✅ feito, com 3 falhas ativas para triar;
- ~~backup e restauração comprovados~~ — ✅ feito;
- **pacote LGPD mínimo — continua em zero, é o item mais crítico remanescente;**
- ~~logs imutáveis~~ — ✅ feito;
- ~~correção/mitigação das dependências de alto risco~~ — ✅ 14 → 1 (produção), correção automática disponível para o resto.

#### P1 — antes de crescer

- ~~migrar de CRA para Vite~~ — ✅ feito;
- dividir `App.jsx` por domínio — **em andamento, mas o monólito cresceu em vez de encolher (`LegacyApp.jsx`)**;
- observabilidade e monitoramento de erros — não reverificado nesta rodada (nota: Sentry foi deliberadamente adiado por risco de LGPD, per `docs/AVALIACAO_FERRAMENTAS_ARCD.md`);
- expiração de links e tokens — **parcial**: portal do cliente corrigido, links de arquivo/OneDrive continuam sem expiração;
- MFA e recuperação de senha — MFA continua ausente; login por e-mail/senha já existe como alternativa ao PIN;
- ~~migrations versionadas~~ — ✅ em uso extensivo;
- ambientes separados — não reverificado;
- contratos de SLA, suporte e incidente — não reverificado.

#### P2 — maturidade

Sem mudança relevante identificada nesta rodada.

## 12. Plano de execução recomendado — atualizado

### Concluído desde julho

1. Autorização server-side por payload e por escrita (Etapa 1, itens 1-3);
2. Ledger de auditoria imutável (Etapa 1, item 4);
3. Backup e restauração comprovados;
4. Modelo do financeiro canônico (Etapa 2, item 1) — construído, falta ativar;
5. Vite (Etapa 3, item 1);
6. Pastas por domínio (Etapa 3, item 2) — parcial, ~34 domínios extraídos;
7. Cobertura de testes dos fluxos críticos (Etapa 1, item 5).

### Continua pendente, em ordem de prioridade

1. **LGPD** — não tem nenhum progresso registrado; é o único P0 de julho que segue em zero absoluto.
2. **Ativar o motor financeiro canônico** — a infraestrutura está pronta (`financialEnforcementReadiness()` já reporta `ready:true`); falta decidir o critério e a janela para virar `FINANCIAL_ENGINE_ENFORCE=true`, e então efetivamente aposentar `outrasDesp`/`despesasEmpresa`/`caixaObra` como fonte primária.
3. **Terminar a extração de Terceiros** (item #3 da fila própria do time) — hoje só o motor de cálculo saiu do monólito; UI, rotas e serviço de API continuam pendentes, e os itens #4-#8 da fila (Compras, Planejamento, CentralAdministrador, Comercial, Folha/Medições) não foram iniciados.
4. **Resolver a duplicidade pedido/nota** (5.4) com uma coleção `pagamentos` real, não convenção de ID.
5. **Catálogo único de documentos** (5.6) — ainda não iniciado.
6. **Triar as 3 falhas de teste ativas** — baixo esforço, mas deveriam ser corrigidas antes de acumular.
7. Primeiro admin sem segredo de setup (6.3) e expiração de links de arquivo (6.5) — os dois P1 de segurança mais simples de fechar, ainda abertos.

## 13. Conclusão

A distância entre esta auditoria e a de julho não é incremental — é a diferença entre um sistema com boas intenções de arquitetura e um sistema que começou a colocá-las em produção, com prova em migração, teste e CI. A segurança de acesso deixou de ser o bloqueador central. O que ocupa esse lugar agora é mais estreito e mais claro: LGPD, que segue intocado apesar dos dados sensíveis que o sistema trata; e a lacuna entre "a infraestrutura financeira canônica existe" e "o sistema realmente opera sobre ela" — o modo sombra é a decisão certa para não arriscar dado real, mas não pode durar indefinidamente sem um critério público de quando vira produção.

Um ponto de atenção que não existia em julho, porque não havia nada para comparar: a extração do monólito está avançando em largura (muitos domínios com pelo menos o motor de cálculo extraído) mais rápido do que em profundidade (poucos domínios com UI, rotas e API completamente fora do `LegacyApp`). Vale decidir conscientemente se essa é a sequência certa, ou se vale fechar um domínio inteiro (por exemplo, terminar Terceiros) antes de abrir o próximo.

Prioridade recomendada, nesta ordem: LGPD, critério de ativação do motor financeiro, e fechamento completo de pelo menos um domínio da fila de extração — antes de iniciar o próximo módulo novo de produto.
