# Blueprint: destravar a concorrência entre módulos e usuários

Produzido em 20/08/2026 em resposta a um incidente real observado pelo
usuário: salvar um funcionário em Equipe levou ~20s, com 1 resposta 409
seguida de 3 respostas 503 visíveis no console do navegador, mesmo com
apenas um usuário/aba ativo no momento. **Nada deste documento foi
implementado** — é desenho para decisão, como pedido.

## Diagnóstico confirmado (não é suposição)

- Toda a base de uma empresa vive em **uma única linha** do Postgres:
  tabela `company_app_data`, chave primária `(company_id, key)`, e `key` é
  hoje sempre a mesma constante (`KEY = "arced_ponto_v1"`,
  `api/data.js:59`) — ou seja, uma linha só por empresa para Ponto, RH,
  financeiro, compras, equipamentos, comercial, engenharia, tudo.
- Toda escrita passa por `executarMutacaoEmpresaBloqueada`
  (`api/data.js:578-603`), que abre uma transação e faz
  `SELECT ... FOR UPDATE` **nessa mesma linha**, travando qualquer outra
  escrita da empresa inteira até terminar. Quando `POSTGRES_URL_NON_POOLING`
  não está configurado, existe um caminho alternativo por tentativa
  otimista (`for(let attempt=0;attempt<6;...)`, `api/data.js:1319-1338`),
  mas sofre da mesma limitação de fundo: o conflito é medido pela linha
  inteira, não pela entidade que de fato mudou.
- `EMPLOYEE_SAVED` está classificado como comando financeiro
  (`api/data.js:216`, porque `dailyRate` alimenta o DRE) e por isso passa
  pelo mesmo caminho travado.
- `ATTENDANCE_COMMANDS` (Ponto) usa a mesma trava de linha
  (`api/data.js:1210-1239`, `executarMutacaoEmpresaBloqueada` de novo) —
  **e é o candidato mais forte a maior gerador de tráfego de escrita**: em
  obra, múltiplos trabalhadores batem ponto ao longo do dia por
  tablets/dispositivos de campo, cada check-in já com até 4 tentativas no
  navegador (`LegacyApp.jsx:20739-20744`) e até 6 no servidor. Isso
  colide com qualquer ação mais rara de escritório (como editar um
  funcionário), gerando exatamente o padrão 409→503×N observado.
- **Achado que reduz o risco da correção**: `applyAttendanceCommand`
  (`server/attendance-command.js:288`) não lê nenhum campo de outro
  domínio (`data.employees`, `data.obras` etc. — grep exaustivo, zero
  ocorrências), com uma única exceção: `data.config.attendanceUnlockApproverIds`
  (`attendance-command.js:257`), uma leitura para checar quem pode aprovar
  destravamento de período — não precisa fazer parte da mesma transação de
  escrita.
- O código **já trata esses campos como um grupo coeso** em dois lugares
  (`commandOnlySections`, `api/data.js:1558,1735`):
  `attendance`, `attendanceLocks`, `unlockRequests`, `dailyCheckDate`,
  `attendanceOperationReceipts` — só falta usar essa fronteira já
  reconhecida para separar também o *armazenamento*, não só a resposta da
  API.
- O schema já comporta isso **sem nenhuma migration nova**: a chave
  primária é `(company_id, key)` (`schema.sql:12-19`), então uma segunda
  linha por empresa com outra `key` (ex.: `arced_ponto_attendance_v1`) é
  estruturalmente trivial — não precisa de `ALTER TABLE`, e a política de
  RLS já é "sem política = negado por padrão" para a tabela inteira.

## Solução proposta, em fases de risco crescente

### Fase 1 — separar a trava de Ponto do resto (resolve o incidente relatado)

- Nova linha por empresa: `company_id=<empresa>, key="arced_ponto_attendance_v1"`,
  contendo só as `commandOnlySections` já listadas acima. O resto (RH,
  financeiro, compras, equipamentos, comercial, engenharia...) continua na
  linha `arced_ponto_v1` como hoje.
- `lerLinha()` passa a fazer 2 leituras independentes (sem lock conjunto)
  e mesclar num único `payload` em memória antes de devolver ao resto do
  código — a aplicação inteira (toda tela, todo comando não-Ponto)
  continua enxergando um `data` unificado, sem saber que são duas linhas
  por baixo.
- `executarMutacaoEmpresaBloqueada` ganha qual `key` travar, decidido pelo
  tipo de comando: `ATTENDANCE_COMMANDS` trava só a linha de ponto; todo o
  resto continua travando a linha `core`, exatamente como hoje.
- A única leitura cross-domain do Ponto (`attendanceUnlockApproverIds`)
  passa a ler a linha `core` separadamente, fora da transação de escrita —
  consistência eventual aceitável (não é dado financeiro, muda raramente).
- **Resultado**: qualquer combinação de Ponto + (RH, financeiro, compras,
  o que for) nunca mais se bloqueia entre si. Dois check-ins de Ponto ao
  mesmo tempo ainda disputam a trava de ponto entre si; duas edições de
  RH/financeiro/compras simultâneas ainda disputam a trava `core` entre
  si — a Fase 1 resolve especificamente a colisão *entre módulos*, que é
  o que gerou o incidente relatado.

### Fase 1.5 (só se sobrar contenção dentro do próprio Ponto) — particionar por obra

- Trocar `arced_ponto_attendance_v1` fixo por
  `arced_ponto_attendance_v1:<obraId>` — uma linha de ponto por obra, não
  uma por empresa inteira. Destrava também usuários diferentes do mesmo
  módulo, desde que estejam em obras diferentes (padrão real: cada obra
  bate ponto para sua própria equipe). Duas pessoas na MESMA obra no mesmo
  segundo ainda disputam entre si, mas o volume nesse caso é baixo.

### Fase 2 (não é para agora) — o que "zero bloqueio entre quaisquer dois comandos" exige de verdade

Diz respeito à arquitetura de fundo: mover cada domínio (funcionários,
ponto por dia, compras...) para tabelas relacionais próprias com
concorrência por **linha/entidade** (um funcionário, um lançamento) em vez
de por **empresa inteira**. É exatamente a direção que
`docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md` já persegue módulo a módulo
(migração 007, `core_registry_projection`) — cada módulo migrado passa
pelo gate já estabelecido no projeto (migration+rollback, RLS por
papel/obra, comandos idempotentes, contagem batendo com o legado, testes,
observação em sombra). Isso garante por natureza que editar o funcionário
A nunca trava editar o funcionário B, não importa o módulo — é a solução
definitiva, mas é trabalho de meses, não algo a puxar para frente só por
causa deste sintoma.

## Riscos e decisões do usuário

1. **Migração de dado sem downtime**: os campos de Ponto que hoje estão
   dentro da linha `arced_ponto_v1` precisam ser copiados para a nova
   linha sem perder nada, com uma aba já aberta durante o deploy. Padrão
   recomendado (mesmo já usado no FIN-002/FIN-003 deste projeto): escrita
   espelhada por um tempo (grava nas duas linhas), depois corta a leitura
   para a nova — reversível a qualquer momento até o corte oficial.
2. **Rollback**: enquanto a linha nova não é a fonte de verdade de
   leitura, reverter é só parar de gravar nela e continuar lendo a antiga.
3. **A Fase 1.5 (partição por obra) muda a granularidade de auditoria por
   linha** — vale confirmar se isso é aceitável antes de implementar, já
   que hoje há uma auditoria por empresa e passaria a ter uma trilha por
   obra também.

## Esforço estimado

- Fase 1: médio. Concentrado em `api/data.js` (`lerLinha`,
  `executarMutacaoEmpresaBloqueada`, os dois handlers de comando que hoje
  chamam essa função) e `server/attendance-command.js` (isolar a leitura
  de `attendanceUnlockApproverIds`). **Nenhuma tela do frontend muda** — a
  UI continua recebendo um `data` unificado. Testes de integração
  cobrindo: escrita simultânea Ponto+RH não bloqueia; leitura confere os
  dois blocos mesclados corretamente; idempotência preservada nos dois
  caminhos.
- Fase 1.5: pequeno incremento sobre a Fase 1, se for necessária.
- Fase 2: fora de escopo de estimativa aqui — é a escala dos outros itens
  do `PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`.

## Status após a implementação (20/08/2026)

**Fase 1 implementada e com escopo ampliado**, a pedido do usuário ("Gostaria
que cada um tivesse sua própria trava" → "completo"): além de Ponto, uma
investigação adicional (mapeamento de acoplamento de campos entre todos os
grupos de `OPERATIONAL_COMMAND`, incorporada a `.claude/agents/
dre-integration-guardian.md`) encontrou mais 3 domínios igualmente
independentes - Lookahead, Config/Empresa e Equipamentos - e todos os 4
ganharam linha própria nesta rodada, não só Ponto.

- `server/domain-row-routing.js` (novo, testado em `domain-row-routing.test.js`):
  classifica cada `OPERATIONAL_COMMAND`/`ATTENDANCE_COMMAND` na linha certa,
  lista os campos exclusivos de cada domínio, e mescla as linhas separadas de
  volta num único `data` (`mergeDomainRows`) - inclusive o caso não trivial
  do razão de idempotência compartilhado (`operationalCommandReceipts`), que
  precisa de união por `idempotencyKey` em vez de sobrescrita simples porque
  Lookahead/Config/Equipamentos escrevem nele mesmo sendo domínios distintos.
- `api/data.js`: `lerLinha()` lê a linha core + as 4 linhas separadas em
  paralelo e mescla; `salvarComAuditoria`/`salvarFinanceiroComAuditoria`
  ganharam parâmetro `key`; os dois handlers CAS (ATTENDANCE_COMMANDS e
  operational-command) roteiam para a linha certa. **Só o caminho otimista
  (CAS, sem `POSTGRES_URL_NON_POOLING`) foi alterado** - é o que está de fato
  ativo em produção (confirmado pelo padrão 409→503 observado, que é a
  mensagem exclusiva desse caminho). O caminho travado
  (`executarMutacaoEmpresaBloqueada`, usado só se `POSTGRES_URL_NON_POOLING`
  estiver configurado) permanece com o comportamento antigo (trava sempre a
  linha core) - fica documentado aqui como *não* coberto por esta rodada,
  para não arriscar uma mudança não testável num caminho hoje inativo.
- **RDO ficou de fora, apesar de ter sido cogitado como "limpo" no
  levantamento inicial de acoplamento.** Achado durante a implementação:
  `LegacyApp.jsx` (função `salvarRDO`) ainda grava `data.rdos` via
  `update()` legado (3 pontos), em paralelo ao comando `FIELD_REPORT_*`.
  Separar a linha sem migrar esse caminho primeiro criaria um split-brain
  (duas linhas achando que são donas do mesmo campo) - fica como item
  separado, não resolvido aqui.
- **Migração de dado, sem exigir ordem de deploy**:
  `scripts/seed-split-domain-rows.mjs` (novo, `npm run split-rows:seed`)
  cria as 4 linhas novas por empresa, semeadas com cópia dos campos
  correspondentes da linha core. Idempotente (upsert com
  `ignoreDuplicates`). Enquanto ele não roda, `api/data.js` detecta a linha
  ausente e cai de volta a gravar a linha core inteira - exatamente o
  comportamento de hoje, sem quebrar nem bloquear nada -, e a escrita
  seguinte já migra sozinha assim que a linha existir. Rodar o script logo
  após o deploy é o que faz o benefício (fim da contenção cruzada) valer,
  mas **não é um pré-requisito bloqueante** para o deploy em si.
- Fase 1.5 (partição de Ponto por obra) e Fase 2 (tabelas relacionais)
  continuam não implementadas, como planejado - nenhuma delas foi puxada
  para esta rodada.

## Achado adicional (21/08/2026): bloat de escrita na linha core

Depois do deploy, o usuário reportou que salvar um funcionário continuava
lento (~25s, uma única tentativa, sem 409/503 - medido ao vivo com uma
sonda de `fetch` isolada no navegador). Causa raiz: `applyOperationalCommand`
recebe e devolve o `data` **inteiro mesclado** (precisa disso para comandos
que leem campo de outro domínio, ex. Produção lendo `employees`), então
`resultData` de um comando "core" (como `EMPLOYEE_SAVED`) carregava também
uma cópia inteira de Equipamentos/Ponto/Lookahead/Config vinda da
mesclagem de leitura em `lerLinha()` - e essa cópia inteira estava sendo
reenviada e regravada (com gzip) na linha core a cada comando core, sem
necessidade nenhuma (o dado já está persistido, correto e atualizado nas
próprias linhas separadas). Isso explica o tempo: codificar/transmitir um
blob várias vezes maior que o necessário a cada salvamento de RH.

Corrigido de forma centralizada: `server/domain-row-routing.js` ganhou
`coreFieldsOnly(data, rowVersions, keepDomain)`, que remove os campos de
qualquer domínio separado CUJA LINHA JÁ EXISTE (preserva os campos de um
domínio ainda não semeado, porque nesse caso a própria core é,
temporariamente, onde ele precisa continuar sendo gravado - mesma lógica
de `linhaEfetivaParaEscrita`). Aplicado dentro de
`salvarComAuditoria`/`salvarFinanceiroComAuditoria` (sempre que
`key===KEY`), então cobre automaticamente TODO chamador que grava a linha
core - não só os dois que eu tinha tocado originalmente. Uma varredura
completa por todo `api/data.js` (pedida explicitamente pelo usuário, "é
provável que existam mais erros parecidos?") encontrou o mesmo padrão em
mais 5 pontos, todos corrigidos nesta mesma rodada:

- As duas ações "save-sections" e "save" (o caminho de salvamento legado
  por seções/blob completo, usado por qualquer tela ainda não migrada para
  comando operacional - é provavelmente o caminho de MAIOR volume de
  escrita do sistema inteiro).
- `reconciliation-command` (conciliação bancária).
- O provisionamento de login (`auth_provision`, ligar e-mail/senha a um
  operador) e o upgrade de hash de PIN (`auth_pin_upgraded`) - escritas
  diretas na tabela, fora de `salvarComAuditoria`.
- O arquivamento/restauração de ponto por quinzena
  (`executarArquivoPontoTransacional`) - aqui com uma ressalva: `attendance`
  é o campo que de fato está sendo escrito (preservado via `keepDomain`),
  mas a transação continua sempre mirando a linha core
  (`p_main_key`) em vez de rotear para a linha de Ponto quando ela já
  existe. Isso significa que, depois que a linha de Ponto for semeada,
  arquivar/restaurar uma quinzena grava um `attendance` que a leitura
  normal vai ignorar (a mesclagem sempre prioriza a linha de Ponto sobre a
  core para esse campo) - **limitação conhecida, não corrigida nesta
  rodada** por exigir tornar a RPC de arquivamento (que já é uma transação
  de duas chaves) ciente de domínio; fica registrada aqui para não ser
  esquecida.
- **Correção (21/08/2026):** a suposição acima de que o caminho travado
  estava inativo em produção estava **errada** - instrumentação de tempo ao
  vivo (ver seção "Achado de 21/08/2026: sincronização financeira síncrona"
  abaixo) confirmou `POSTGRES_URL_NON_POOLING` ativo e sendo o caminho
  realmente usado por `EMPLOYEE_SAVED` e outros comandos financeiros.
  A limitação do arquivamento de ponto (parágrafo acima) permanece real e
  não corrigida nesse caminho.

## Achado de 21/08/2026: sincronização financeira síncrona dominava o tempo de escrita

Depois da separação de linhas por domínio (Fase 1 completa) e do fix de
`coreFieldsOnly` (achado anterior), salvar um funcionário continuava
levando ~25s em produção. Instrumentação `[TIMING]` ao vivo (logs reais do
Vercel, não suposição) isolou o problema: **100% do tempo estava dentro de
`gravarMutacaoNaTransacao`**, entre o fim de `mutate()` (~2,2s) e o retorno
da função (~27,2s) - abrir a conexão, travar a linha (`SELECT...FOR UPDATE`)
e validar a regra de negócio levaram, juntos, só ~1s.

**Causa raiz**: `EMPLOYEE_SAVED` está em `FINANCIAL_OPERATIONAL_COMMANDS`
(`api/data.js:246` - correto, diária/VT/VR afetam custo de mão de obra).
Com `FINANCIAL_ENGINE_ENFORCE=true` ativo em produção, toda gravação desse
tipo chama a função Postgres `financial_save_with_sync`
(`migrations/002...up.sql`), que chama `financial_sync_legacy_facts`
(`migrations/001...up.sql`). Essa função **não é incremental**: a cada
chamada, desativa e reconstrói do zero TODOS os fatos, transações
bancárias e (o item mais caro) os ~1.764 snapshots de DRE da empresa
inteira - milhares de statements SQL individuais numa única transação,
mesmo quando a gravação em questão (ex.: editar telefone de um
funcionário) não toca em nenhum desses dados.

**Por que dreSnapshots é seguro remover do caminho de escrita**: a tela de
DRE já se auto-repara na leitura (`api/data.js:1550-1621`, ação
`financial-dre-report`) comparando `sourceRevision`/`updated_at` e
reconstruindo só o período pedido - qualquer gravação já muda `updated_at`,
então essa reconstrução completa dentro da transação sempre foi redundante
para esse consumidor. Avaliação de risco feita pelo agente
`dre-integration-guardian` antes de mexer (ver citações abaixo) confirmou
que uma comparação simplista por "quais dos 7 campos financeiros legados
mudaram" seria insegura para decidir SE sincronizar dreSnapshots (que
depende de `employees`/`config`/`obras`/`equipamentos`/`rescisoes` - nenhum
dos 7 campos), mas é segura para decidir SE vale a pena chamar
`financial_save_with_sync` para os fatos/transações bancárias.

**Fix aplicado** (`migrations/008_skip_dre_snapshot_sync_on_write.up.sql`,
`api/data.js`, `server/financial-shadow.js`):
- `financial_sync_legacy_facts`/`financial_save_with_sync` ganharam o
  parâmetro `p_sync_dre_snapshots boolean default true` - o `default true`
  preserva o job manual/de deploy (`financial-shadow-sync`,
  `scripts/apply-financial-shadow.mjs`, que continuam sem passar esse
  argumento) intacto como gate de integridade antes de promover o FIN-003.
- O caminho transacional de escrita (`gravarMutacaoNaTransacao`,
  `salvarFinanceiroComAuditoria`) sempre passa `false` e chama
  `buildLegacyFinancialFacts(value,{includeDreSnapshots:false})` - nunca
  mais reconstrói dreSnapshots ali.
- `gravarMutacaoNaTransacao` também recebe `basePayload` (o dado completo
  de antes da mutação) e só chama `financial_save_with_sync` quando algum
  dos 7 campos que alimentam fatos/transações realmente mudou
  (`legacyFinancialFactsChanged`, `api/data.js`) - caso contrário, grava
  pelo caminho simples (update + `audit_events`).
- Testes: `server/operational-command-locking.test.js` (estrutura do fix +
  `legacyFinancialFactsChanged`), `server/financial-shadow.test.js`
  (`includeDreSnapshots:false`).
- **Limitação conhecida**: a instrumentação `[TIMING]` temporária
  (commit `99f9cde`) ainda não foi removida - fica para depois de
  confirmar em produção que o tempo caiu para a faixa de milissegundos
  esperada.

## Arquivos referenciados

- `api/data.js:59` (`KEY`), `:370-392` (`lerLinha`), `:578-635`
  (`executarMutacaoEmpresaBloqueada`/`executarComandoOperacionalBloqueado`),
  `:1210-1239` (handler de `ATTENDANCE_COMMANDS`), `:1269-1343` (handler de
  `operational-command`), `:1558,1735` (`commandOnlySections`)
- `server/attendance-command.js:257,288` (`applyAttendanceCommand`, leitura
  de `attendanceUnlockApproverIds`)
- `src/LegacyApp.jsx:20637-20744` (`dispatchOperationalCommand`,
  `executeAttendanceCommand`)
- `schema.sql:12-19` (definição de `company_app_data`)
- `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md` (direção de longo prazo, Fase 2)
