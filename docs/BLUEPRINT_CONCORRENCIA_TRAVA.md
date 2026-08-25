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
- **Resolvido (21/08/2026, de forma pragmática - ver seção "Limitação do
  arquivamento de ponto: fechada" abaixo)**: em vez da migration
  transacional de três chaves (que exigiria reabrir e testar a RPC de
  arquivamento com risco maior do que o benefício justifica para uma ação
  rara), uma segunda escrita best-effort (`sincronizarPontoAposArquivo`)
  sincroniza `attendance` na linha de Ponto logo depois que o arquivamento/
  restauração confirma na core, fechando a lacuna sem tocar a RPC.

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
- **Removida (21/08/2026)**: a instrumentação `[TIMING]` temporária
  (commit `99f9cde`) cumpriu o papel - foi o que permitiu achar tanto o
  bloat de DRE quanto, depois, o achado crítico de que o caminho travado
  nunca roteava por domínio (ver seções abaixo) - e foi removida (`__mark`/
  `__reqStart`/`onMark`) depois de confirmar em produção, ao vivo, que o
  tempo caiu para a faixa esperada em cada domínio (core, equipamentos,
  RDO).

## RDO ganha linha própria (21/08/2026)

O RDO (`data.rdos`) havia sido deliberadamente excluído da separação de
linhas em 20/08/2026 porque `LegacyApp.jsx` ainda tinha um caminho de
escrita legado (`update()`) rodando em paralelo ao comando
`FIELD_REPORT_CHANGED` - separar a linha sem migrar esse caminho primeiro
criaria um split-brain (duas linhas achando que são donas do mesmo campo).

Nesta sessão, `duplicarRdo` foi migrado para `dispatchCommand`
(`FIELD_REPORT_CHANGED`), e uma reverificação completa confirmou que os
outros dois escritores (`executarSalvarRDO`, `excluirRdo`) só chamam
`update()` dentro de `if(!dispatchCommand){...}` - código morto, já que o
único ponto de renderização de `<DiarioObra>` que importa
(`<ObraDetalhe>`, chamado uma única vez em `LegacyApp.jsx:21535`) sempre
passa `dispatchCommand={dispatchOperationalCommand}`. Com o caminho legado
comprovadamente limpo, RDO entrou no `DOMAIN_ROW` com a mesma garantia dos
outros 4 domínios:

- `server/domain-row-routing.js`: `DOMAIN_ROW.RDO`, `RDO_COMMAND_TYPES`
  (`FIELD_REPORT_CHANGED`/`CANCELLED`/`REOPENED`, os únicos 3 comandos que
  tocam `data.rdos`), `DOMAIN_FIELDS[DOMAIN_ROW.RDO] = ["rdos",
  operationalCommandReceipts]`, incluído em `SPLITTABLE_DOMAINS` e no loop
  de `mergeDomainRows`.
- `api/data.js`: `RDO_KEY = `${KEY}__rdo`` adicionada a `SPLIT_ROW_KEYS`
  (`lerLinha`/`coreFieldsOnly`/`keyForDomain` já eram genéricos sobre esse
  mapa, então passaram a cobrir RDO automaticamente, sem mudança adicional
  de código).
- `scripts/seed-split-domain-rows.mjs`: passa a criar também a linha
  `arced_ponto_v1__rdo` (idempotente, mesmo padrão dos outros 4 - ainda
  precisa rodar contra produção para o benefício realmente entrar em
  vigor).
- Testes: `server/domain-row-routing.test.js` (classificação dos 3
  comandos, `pickDomainFields`, `mergeDomainRows`, `coreFieldsOnly` com
  RDO) e `src/integration/operational-command-split-rows.test.js`
  (`RDO_CAMPO_ALTERADO` grava na própria linha e cai de volta para a core
  quando a linha ainda não existe).
- **Pendente**: rodar `npm run split-rows:seed` contra produção para criar
  a linha `arced_ponto_v1__rdo` (mesmo passo manual já feito para os
  outros 4 domínios nesta sessão) - sem isso, o código já funciona
  (fallback gracioso para a core), só não ganha o benefício ainda.
  **Concluído** logo em seguida, na mesma sessão.

## Achado crítico de 21/08/2026: o caminho travado nunca respeitou o roteamento por domínio

Ao dar ao RDO sua própria linha, uma releitura cuidadosa de
`executarMutacaoEmpresaBloqueada`/`gravarMutacaoNaTransacao` revelou que **a
separação de linhas inteira (Ponto/Lookahead/Config/Equipamentos/RDO) nunca
funcionou de verdade em produção**. O caminho travado - o que está
realmente ativo, já que `POSTGRES_URL_NON_POOLING` está configurado -
travava e gravava **sempre** `key=KEY` (a linha core), sem nenhum
parâmetro de domínio. Conferido nos 6 pontos de chamada (operational-
command, RDO/Ponto/Equipamentos/Lookahead/Config via
`executarComandoOperacionalBloqueado`, ATTENDANCE_COMMANDS, conciliação,
auth, save-sections): nenhum passava uma chave de domínio antes desta
correção. Só o caminho otimista (CAS, usado quando essa variável de
ambiente NÃO está configurada) já respeitava o roteamento desde 20/08.

Consequência prática: a contenção cruzada que toda a Fase 1 deveria ter
eliminado (o motivo original desta investigação) **continuava existindo**
sempre que `POSTGRES_URL_NON_POOLING` estivesse configurado - todo comando,
de qualquer domínio, disputava a mesma linha/lock. As linhas separadas
existiam e tinham dado (seed script já rodado, leitura via `lerLinha()`
mesclando corretamente), mas nunca eram as gravadas pelo caminho ativo.
Nenhum teste existente pegava isso: nenhum arquivo mockava o pacote
`postgres` antes desta correção, só o cliente Supabase - ou seja, o
caminho travado nunca tinha cobertura automatizada nenhuma.

**Fix** (`api/data.js`):
- `executarMutacaoEmpresaBloqueada` ganhou o parâmetro `domain` (default
  `DOMAIN_ROW.CORE`, preserva o comportamento de quem não passa nada). Usa
  `lerLinha()` (leitura sem lock, já paralelizada) para decidir
  `effectiveDomain` via `linhaEfetivaParaEscrita` e travar/gravar
  `keyForDomain(effectiveDomain)` em vez de `KEY`.
- Como `mutate()` (ex.: `applyOperationalCommand`) pode precisar ler campos
  de OUTRO domínio (ex.: Produção lendo `employees`), a visão passada para
  `mutate()` continua sendo a mesclagem completa - só que agora o valor do
  domínio efetivamente travado vem da leitura FEITA DENTRO DO LOCK
  (`freshSlice`), nunca da cópia sem lock de `lerLinha()` (que poderia
  estar desatualizada por uma escrita concorrente na janela entre a
  leitura e a aquisição do lock - isso evitaria perder uma escrita, um bug
  de "lost update"). A consistência de quem só é LIDO (não travado)
  continua garantida por `expectedVersion` dentro de `mutate()`, a mesma
  proteção que o caminho CAS já usa sem lock nenhum.
- `gravarMutacaoNaTransacao` ganhou `key`/`rowVersions`/`keepDomain`
  (mesmos parâmetros que `salvarComAuditoria`/`salvarFinanceiroComAuditoria`
  já tinham) - grava em `key` em vez de `KEY` sempre, e só aplica
  `coreFieldsOnly` quando `key===KEY` (quando é uma linha separada, o
  valor já chega recortado via `pickDomainFields`).
- `executarComandoOperacionalBloqueado` passa
  `domain:rowForOperationalCommand(command.type)`; o handler de
  `ATTENDANCE_COMMANDS` passa `domain:rowForAttendanceCommand()` (sempre
  Ponto) - os dois pontos que realmente precisavam de roteamento por
  domínio. `auth_pin_set`/`auth_provision`/conciliação/`save-sections`
  continuam no default (`CORE`) - nenhum desses grava campo de domínio
  separado por fora do pipeline de comando (verificado por grep, mesma
  garantia do resto do documento), então não precisam de mudança.
- **Teste novo**: `src/integration/operational-command-locked-path.test.js`
  - primeiro teste do repositório a mockar o pacote `postgres` inteiro
    (conexão direta, transação, `for update`), exercitando o caminho
    realmente ativo em produção. Confirma EQUIPAMENTO_SALVO/
    LOOKAHEAD_CRIADO/CONFIGURACAO_EMPRESA_SALVA/RDO_CAMPO_ALTERADO
    gravando na própria linha sem tocar a core, FUNCIONARIO_SALVO
    continuando na core, e o fallback gracioso quando uma linha separada
    ainda não existe - sem este fix, todos esses 4 primeiros teriam
    falhado (a asserção de que a linha separada mudou).

**Otimização (confirmada ao vivo em produção logo após o deploy)**: a
primeira versão do fix fazia uma SEGUNDA `lerLinha()` dentro de
`executarMutacaoEmpresaBloqueada` (para decidir o domínio efetivo antes de
travar), redundante com a que o topo do handler já faz para todo request
(`Promise.all([lerLinha(), tokenAuth])`). Medido ao vivo: +634-659ms por
requisição (`FUNCIONARIO_SALVO` foi de ~2,42s para ~3,53s). Corrigido
passando `linha:{payload:atual,rowVersions}` (já disponível no escopo do
handler) para os 6 pontos de chamada de `executarMutacaoEmpresaBloqueada`
- a função só faz sua própria `lerLinha()` se ninguém passar `linha`
(preserva chamadores futuros que não tiverem essa leitura em mãos). Teste
de regressão: `src/integration/operational-command-locked-path.test.js`
conta as chamadas ao mock do Supabase e exige exatamente 2 (uma
`lerLinha()`), não 4.

## Limitação do arquivamento de ponto: fechada (21/08/2026)

Retomando a limitação documentada duas vezes ("Achado adicional" acima):
`executarArquivoPontoTransacional` (RPC `attendance_archive_transaction`/
`attendance_restore_transaction`, `migrations/006`) sempre grava
`attendance` na linha core, porque tornar essa RPC de duas chaves
(`p_main_key`, `p_archive_key`) ciente de uma TERCEIRA chave (a linha de
Ponto) exigiria uma nova migration transacional - reabrir e testar uma RPC
que já lida com concorrência (`for update` em duas linhas) tem risco maior
do que o benefício justifica para uma ação rara (admin/RH, periódica, sem
concorrência real com o check-in normal).

Como agora a linha de Ponto genuinamente existe em produção (seed script
já rodado nesta sessão), a leitura normal (que sempre prioriza a linha de
Ponto sobre a core para `attendance`) estava **de fato ignorando** o
resultado de qualquer arquivamento/restauração feito a partir de agora -
não era mais hipotético.

**Fix pragmático, sem migration**: `sincronizarPontoAposArquivo`
(`api/data.js`) roda logo depois que `executarArquivoPontoTransacional`
confirma a transação principal na core. Se `rowVersions[DOMAIN_ROW.PONTO]`
existir, faz uma segunda escrita (via `salvarComAuditoria`, o mesmo RPC
`company_save_with_audit` de sempre) com `pickDomainFields(novoPrincipal,
DOMAIN_ROW.PONTO)` na linha de Ponto, usando o `rowVersions` capturado no
início do request como CAS. Se essa segunda escrita falhar (conflito de
versão por um check-in concorrente raríssimo), a resposta ainda é `200`
- o arquivamento em si já está correto e seguro na core; só fica um log
de erro no servidor, sem repetir tentativa e sem bloquear a resposta.

Não é atômico com a transação principal (uma janela mínima entre as duas
escritas), mas é estritamente melhor que o estado anterior (a lacuna
existia sempre, incondicionalmente) e evita o risco de reabrir uma RPC
transacional financeiro-adjacente sem revisão dedicada.

Testes: `src/integration/attendance-archive-ponto-sync.test.js` (novo -
mock completo de `db.rpc`, cobre: sem sincronizar quando a linha de Ponto
não existe ainda; sincronizando corretamente quando existe, removendo só
as datas arquivadas; e a resposta continuando `200` mesmo se a
sincronização falhar) e `src/integration/attendance-persistence-
contract.test.js` (assinatura estrutural de que os dois call sites
chamam `sincronizarPontoAposArquivo`).

## Fase 1.5 reduzida: attendance particionado por obra (22/08/2026)

O plano original de Fase 1.5 (dar a cada obra sua própria "sub-linha" de
Ponto completa) não sobrevivia a uma investigação mais de perto: alguns
comandos de Ponto não têm conceito de obra (`attendance-daily-check`),
outros não carregam `obraId` no payload (`attendance-unlock-approve`/
`-reject`, que descobrem a obra indiretamente via `unlockRequests`), e
`attendance-batch-upsert` pode legitimamente abranger várias obras num
único lote - tanto de propósito (`PontoGeral.limparLinha`, funcionário
transferido no meio do ciclo) quanto sem querer (a fila de coalescência do
cliente, `createAttendanceCommandQueue`, mescla `attendance-upsert`
disparados em rajada de obras diferentes num único request). Forçar esses
7 comandos a escolher uma partição fixa por obra não é natural ao negócio.

**Redesenho reduzido, decidido com o usuário**: só `data.attendance`
(o único campo que `attendance-upsert`/`attendance-batch-upsert` tocam) é
particionado por obra. `attendanceLocks`/`unlockRequests`/`dailyCheckDate`/
`attendanceOperationReceipts` continuam numa única linha compartilhada
(`DOMAIN_ROW.PONTO`, a linha "meta") - sem mudança para os outros 5
comandos.

- **`server/attendance-obra-routing.js`** (novo, puro, sem I/O): chave por
  obra (`attendanceObraKey`/`attendanceObraKeyPrefix`/`obraBucketFromKey`,
  padrão `${PONTO_KEY}__obra__<obraId|"sem_obra">"`), mescla de leitura
  (`mergeAttendanceObjects` - fontes posteriores vencem no mesmo
  funcionário+data), agrupamento por obra dos registros já resolvidos que
  `applyAttendanceCommand` devolve (`groupAttendanceEntriesByObra`), e a
  aplicação de um lote de mudanças sobre o `attendance` de UMA linha sem
  conhecer as outras obras (`applyEntriesToAttendance`, replica a mesma
  semântica de exclusão de `applyValidatedPatch` em
  `attendance-command.js`). `applyAttendanceCommand` em si não mudou nem
  precisou mudar - é uma função pura sobre o `data` já mesclado; a divisão
  física em linhas é inteiramente uma decisão da camada de persistência
  (`api/data.js`), do mesmo jeito que `applyOperationalCommand` já é alheio
  ao layout físico das linhas separadas.
- **Descoberta por padrão de chave, não lista fixa**: diferente de
  Ponto/Lookahead/Config/Equipamentos/RDO (`SPLIT_ROW_KEYS`, um dicionário
  fixo de 5 entradas), o número de obras muda com o tempo - `lerLinha()`
  descobre as linhas de obra via `like("key", "${PONTO_KEY}__obra__%")` em
  vez de um `.in()` de lista conhecida.
- **Migração sem seed obrigatório**: uma linha de obra é criada sob
  demanda (`insert ... on conflict (company_id,key) do nothing` seguido de
  `select ... for update`, dentro da mesma transação - evita a corrida
  entre dois primeiros-escritores da MESMA obra nova) na primeira vez que
  algum funcionário/data daquela obra é editado. Não precisa de
  `scripts/seed-split-domain-rows.mjs` rodar antes: cada edição migra
  sozinha a célula (funcionário,data) tocada; o que ainda não migrou
  continua sendo lido da cópia legada na linha de Ponto
  (`mergeAttendanceObjects`, linha de obra sempre vence quando existe).
- **`coreFieldsOnly` (server/domain-row-routing.js)**: `attendance` saiu
  de `DOMAIN_FIELDS[PONTO]`, mas precisa continuar sendo removido
  incondicionalmente da linha core (nunca deve voltar a ser gravado lá,
  ou reintroduz o mesmo bug de bloat resolvido no achado de DRE-sync mais
  acima - só que agora para um blob de attendance multi-obra
  potencialmente maior). Corrigido com uma exclusão incondicional de
  `attendance`, com uma única exceção: `keepDomain===DOMAIN_ROW.PONTO`
  (o arquivamento/restauração de quinzena é a única gravação legítima que
  escreve `attendance` na core de propósito).
- **`executarComandoPontoBloqueado` (api/data.js, novo)**: caminho travado
  dedicado só para `attendance-upsert`/`attendance-batch-upsert` - trava a
  linha meta de Ponto (ou a core, no fallback de sempre, se a linha meta
  ainda não existir) MAIS uma linha por obra distinta tocada pelo lote, na
  MESMA transação Postgres. A leitura de `attendance` usada para validar o
  comando dentro de `applyAttendanceCommand` vem da cópia sem lock de
  `lerLinha()` (mesma tolerância que o caminho otimista/CAS já aceita hoje
  - só fica desatualizada no raro caso de dois usuários editando o EXATO
  mesmo funcionário+data ao mesmo tempo). A GRAVAÇÃO em si não corre esse
  risco: cada linha de obra é travada (`for update`) e mesclada contra o
  valor recém-lido via `applyEntriesToAttendance`, nunca sobrescrita às
  cegas. Os outros 5 comandos de Ponto continuam no
  `executarMutacaoEmpresaBloqueada` genérico, domínio PONTO, sem mudança.
- **Caminho CAS (hoje inativo em produção)**: não ganhou a divisão por
  obra (o custo de uma CAS multi-linha não se justificava para um caminho
  que não roda enquanto `POSTGRES_URL_NON_POOLING` estiver configurado) -
  só recebeu a correção mínima para não regredir: como `attendance` saiu
  de `DOMAIN_FIELDS[PONTO]`, `pickDomainFields` sozinho pararia de incluir
  esse campo na gravação, apagando silenciosamente todo attendance desse
  caminho. Continua gravando o blob inteiro na linha de Ponto, como sempre
  fez - seguro na leitura, porque uma linha de obra (quando existir)
  sempre vence essa cópia no merge.
- **`sincronizarPontoAposArquivo` reconciliado**: pelo mesmo motivo do
  item acima, `pickDomainFields(novoPrincipal, DOMAIN_ROW.PONTO)` sozinho
  vira um no-op para attendance. O arquivamento/restauração não distingue
  obra (a RPC de duas chaves opera a quinzena inteira, todos os
  funcionários de uma vez) - dividir o resultado por obra exigiria
  diferenciar entrada a entrada antes/depois, risco maior do que uma ação
  rara e sem concorrência real justifica. Mantido como estava
  conceitualmente: grava o blob completo de `novoPrincipal.attendance`
  como cópia legada na linha de Ponto, com a mesma tolerância de
  melhor-esforço que essa sincronização já tinha antes desta fase.

**Testes**: `server/attendance-obra-routing.test.js` (16, módulo puro),
`server/domain-row-routing.test.js` (atualizado para a exclusão
incondicional de `attendance`), `src/integration/attendance-obra-locked-
path.test.js` (novo - upsert de uma obra só toca a própria linha; lote com
duas obras grava as duas linhas na mesma transação; reenvio do mesmo
`operationId` é idempotente sem gravação; fallback para a core quando a
linha meta ainda não existe, com a linha de obra continuando
autossuficiente). Suíte inteira: 1240 testes, build, lint
(`check-financial-boundaries.mjs`) e `architecture:check`
(dependency-cruiser) sem violação nova.

## Fase 2, primeiro passo: observabilidade do CORE-001 (22/08/2026)

Pedido do usuário para avançar à Fase 2 (mover domínios para tabelas
relacionais). Como a Fase 2 é "trabalho de meses" (ver seção acima), o
escopo desta rodada foi decidido explicitamente com o usuário: **verificar
e reforçar o CORE-001 já existente**, sem tocar em RLS por papel/obra nem
em nenhum caminho de leitura real.

**Achado**: CORE-001 (7 tabelas de cadastro em sombra - projetos,
funcionários, vínculos, identificadores, fornecedores, perfis e contratos
de terceiro, migration `007_create_core_registry_projection`) nasceu num
único commit em 30/07/2026 e nunca foi tocado de novo. O gate de sombra
roda automaticamente em todo build de produção (`npm run prebuild` →
`registry:migrate-shadow`) e **derruba o build inteiro** se achar
divergência - como dezenas de deploys já aconteceram com sucesso desde
então, havia evidência indireta forte de que o gate vem passando limpo,
mas nada tornava isso explícito ou fácil de confirmar sem vasculhar o log
bruto de build da Vercel.

O mecanismo de observabilidade em si **já existia**: `core_registry_sync_
legacy` (a RPC que o script de sombra chama) já grava uma linha em
`core_registry_shadow_runs` a cada sincronização bem-sucedida
(migration 007, linhas 410-419) - só que nada nunca consultava essa
tabela.

**O que foi feito**:
- `server/core-registry-shadow-status.js` (novo, puro, sem I/O):
  `summarizeCoreRegistryShadowStatus` compara a última sincronização
  registrada contra a contagem ATUAL de linhas ativas de cada tabela
  `core_*` (deveriam sempre bater, já que a RPC arquiva tudo que sai do
  snapshot) e contra a sincronização anterior (detecta uma seção que caiu
  a zero de uma vez, sinal de possível perda de dado). `format
  CoreRegistryShadowStatus` formata o resultado em texto legível.
- `scripts/check-core-registry-shadow-status.mjs` (novo, só leitura -
  nenhum insert/update/upsert): busca as últimas 20 sincronizações de
  `core_registry_shadow_runs` e a contagem ativa de cada tabela `core_*`,
  chama o módulo acima e imprime o resumo. Roda com
  `npm run registry:shadow-status` (mesmo padrão de autenticação dos
  scripts `seed-*`).
- Testes: `server/core-registry-shadow-status.test.js` (8 testes -
  ausência total de histórico, contagens batendo, divergência de
  contagem, queda a zero, formatação com e sem alertas).

**Resultado confirmado contra produção** (rodado pelo usuário em
23-24/08/2026, via `npm run registry:shadow-status`): gate passando limpo,
última sincronização ~15h antes da checagem, **0 divergências** - 15
`core_projects`, 78 `core_employees`, 78 `core_employee_assignments`, 124
`core_employee_identifiers`, 35 `core_suppliers`, 5
`core_third_party_profiles`, 16 `core_third_party_contracts`. A hipótese
levantada acima (evidência indireta pelos deploys nunca falharem) se
confirmou: o CORE-001 vem sincronizando corretamente desde 30/07/2026, só
nunca tinha sido verificado explicitamente até agora.

## Fase 2, primeiro consumidor real: `core-registry-report` (23/08/2026)

**Achado que corrige o gate do `PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`**:
"RLS testada por papel e obra" não se aplica a esta arquitetura. Grep
exaustivo em `api/*.js`/`server/*.js` confirmou que nenhuma query real usa
o token do próprio usuário para falar com o Postgres - toda leitura/
escrita passa por um único cliente Supabase instanciado com
`SUPABASE_SERVICE_ROLE_KEY` (`db`, `api/data.js:279`), que ignora RLS por
definição. Existe uma sessão/token de login (`db.auth.getUser(accessToken)`,
`api/data.js:1256`), mas ela só identifica QUEM está pedindo - a
autorização por papel/obra sempre acontece depois, em JavaScript (ex.:
`OPERATIONAL_COMMAND_ROLES`), nunca em política de RLS do Postgres.
Escrever RLS por papel/obra para as tabelas `core_*` seria código morto:
nunca seria exercitado, porque nenhuma requisição chega no Postgres com
outra credencial que não seja `service_role`. Esse mesmo mal-entendido
provavelmente se repetiria em qualquer módulo futuro de Fase 2 se não
fosse corrigido aqui - vale revisar a redação do gate no
`PLANO_REDUCAO_LEGACYAPP_SUPABASE.md` numa próxima rodada.

**O que foi feito**: nova ação `core-registry-report` em `api/data.js`
(mesmo padrão de `financial-shadow-report`/`financial-shadow-sync` -
`if(usuario.role!=="admin")return res.status(403)...`, só leitura, sem
tela própria). Reaproveita `summarizeCoreRegistryShadowStatus` (o mesmo
módulo puro usado por `scripts/check-core-registry-shadow-status.mjs`) e
devolve, além do resumo, uma amostra de até 5 linhas mais recentes de cada
uma das 7 tabelas `core_*`.

**Achado adicional, real, descoberto ao testar contra produção (24/08/2026)**:
a primeira versão desta ação usava o `db` compartilhado de escopo de
módulo (o mesmo usado por `lerLinha()` e por todo o resto de
`api/data.js`) e falhava com `permission denied for table
core_registry_shadow_runs` (código Postgres `42501`, dica do PostgREST
sugerindo conceder a `authenticated`). Causa: `db.auth.getUser(
accessToken)` - chamado mais acima no handler, ao resolver `usuario` a
partir da sessão do navegador - muda o estado interno de autenticação do
próprio `db`, fazendo chamadas `.from()` **posteriores** nessa mesma
requisição usarem o JWT do usuário logado em vez da `service_role` key
com que `db` foi criado. Como as tabelas `core_*` revogam tudo exceto
`service_role` (migration 007), a query falhava; `company_app_data`, sem
revoke explícito, não teria mostrado o mesmo sintoma tão claramente.
Corrigido isolando esta ação com um cliente Supabase próprio, criado só
para ela (mesmo padrão que `scripts/check-core-registry-shadow-status.mjs`
já usa, por nunca compartilhar cliente entre requisições) - confirmado
funcionando em produção com dados reais (15 projetos, 78 funcionários,
etc., 0 alertas).

**Isso pode afetar outras ações admin que também usam `db` depois da
mesma resolução de sessão** (`financial-shadow-report`,
`financial-shadow-sync`, `financial-shadow-migrate` e qualquer ação
futura no mesmo padrão) - elas podem estar silenciosamente rodando com o
papel do usuário logado em vez de `service_role` para suas próprias
queries.

## Correção na raiz: `authDb` isolado de `db` (24/08/2026)

Em vez de isolar cada ação afetada uma por uma, corrigido na fonte: `db`
(escopo de módulo em `api/data.js`, compartilhado entre TODA ação de uma
mesma requisição e potencialmente entre requisições numa instância
"quente" da função serverless) nunca mais recebe uma chamada `.auth.*`.
Criado `authDb`, um segundo cliente Supabase com a mesma configuração,
usado exclusivamente pelas 7 chamadas `.auth.*` do arquivo
(`signInWithPassword`, `refreshSession`, `getUser`, `admin.updateUserById`
×2, `admin.listUsers`, `admin.createUser`) - `db` fica reservado só para
`.from()`/`.rpc()` de dado, nunca mais é tocado por resolução de sessão.
Mesmo padrão aplicado em `api/auth.js` (`authenticateAppContext`), onde o
risco era menor (cliente criado por chamada, não por módulo) mas o mesmo
bug de classe existia.

Verificado em produção após o deploy (mesma sessão de admin já logada,
sem precisar de nova credencial): `load` (o caminho mais comum - toda
sessão retornando usa `accessToken` + `authDb.auth.getUser`), `core-
registry-report` e `financial-shadow-report` - os três voltando `200,
ok:true`, mais um reload completo da página confirmando a sessão e o
dashboard renderizando normalmente. Não foi possível testar
`signInWithPassword` (login do zero) ponta a ponta sem credenciais reais,
mas a mudança é um redirecionamento mecânico para um cliente
idêntico na configuração, de risco muito baixo.

## Auditoria do impacto real: `financial-shadow-sync`/`financial-shadow-migrate` (24/08/2026)

Pedido do usuário para confirmar se as outras ações admin que usam `db`
depois da resolução de sessão realmente sofreram o bug de contaminação
(seção acima), além de `financial-shadow-report` (já testado, sem
problema). Auditoria estática, sem precisar rodar as duas ações de
escrita em produção:

- **`financial-shadow-migrate`**: usa só uma conexão `postgres()` direta
  (`POSTGRES_URL_NON_POOLING`) - nunca toca `db`/`authDb`. Uma conexão por
  string de conexão autentica como usuário de banco, sem passar pelo
  mapeamento de papel do PostgREST (`service_role`/`authenticated`/`anon`)
  - imune a este bug por construção, não por sorte.
- **`financial-shadow-sync`**: a escrita crítica (`insert into
  financial_shadow_runs`, dentro de `financial_sync_legacy_facts`) também
  roda pela mesma conexão `postgres()` direta - imune pelo mesmo motivo.
  Só as dois `db.from("data_quality_cases")` no fim da ação (marcar casos
  antigos como resolvidos, registrar novas divergências) usavam o `db`
  compartilhado e teriam rodado sob o papel errado antes da correção.
- **Achado que fecha a auditoria**: nenhuma das tabelas do motor
  financeiro (`financial_titles`, `settlements`, `financial_events`,
  `reconciliation_links`, `data_quality_cases`, `financial_shadow_runs`,
  `audit_events` etc. - `migrations/20260725_financial_engine.sql`
  inteiro) tem `enable row level security` nem grant/revoke explícito -
  grep confirmando zero ocorrências. Sem RLS habilitada, Postgres não
  distingue `service_role` de `authenticated` para essas tabelas
  (dependem só do grant padrão do schema, igual para os dois papéis) - ou
  seja, a contaminação realmente acontecia nessas duas chamadas, mas
  nunca teve efeito observável: não havia nenhuma política capaz de
  bloquear ou filtrar a query de um jeito diferente entre os dois papéis.
- **Conclusão**: o bug era real (confirmado ao vivo com `core-registry-
  report`, a única ação que já lia de uma tabela com RLS de verdade
  travada - migration 007), mas nunca causou incidente silencioso em
  produção antes desta sessão, porque nenhum código anterior lia de uma
  tabela com essa trava. A correção (`authDb` isolado) segue sendo valiosa
  como proteção para o futuro - especialmente à medida que mais tabelas
  de Fase 2 nascerem já travadas como as `core_*`, no mesmo padrão da
  migration 007 - mas não havia dado incorreto para corrigir retroativamente.

**Fora do escopo desta rodada, por decisão do usuário**: políticas de RLS
por papel/obra para as tabelas `core_*`; qualquer tela/endpoint que
efetivamente consuma `core_projects`/`core_employees`/etc.; infraestrutura
de Postgres real para testes (o projeto não tem pglite/testcontainers -
`core-registry-migration.test.js` continua fazendo só asserções estáticas
sobre o texto do SQL); começar um novo domínio relacional do zero. Definir
qual desses é o próximo passo real de Fase 2 fica para uma decisão futura
com o usuário, quando ele quiser avançar de novo.

## CORE-002: projeção cadastral de equipamentos (24/08/2026)

Pedido do usuário para continuar Fase 2 "sem parar" - escolhido, seguindo a
ordem de `PLANO_REDUCAO_LEGACYAPP_SUPABASE.md` ("Cadastros e vínculos
operacionais"), completar a única parte de cadastro que o CORE-001 não
cobriu: equipamentos (`reference_items`/`reference_compositions`, os outros
itens da mesma lista, já existem como `budget_reference_bases`/
`budget_reference_items` desde antes desta sessão - tabelas relacionais
próprias, fora do padrão `company_app_data`).

**Mesmo padrão do CORE-001**, migration `009_create_equipment_registry_
projection`: `core_equipment` (de `data.equipamentos` - a fonte canônica
ainda editada via `EQUIPAMENTO_SALVO`, não a normalização interna
`equipmentModels`/`Lots`/`Units`, que é derivada e re-derivável a qualquer
momento por `migrateLegacyEquipmentRegistry`), `core_equipment_owners` (de
`proprietariosEquip`), `core_equipment_allocations` (de `locacoesEquip` - no
código a locação JÁ É o vínculo equipamento-obra, não existe um conceito de
"alocação" separado; um único projeta os dois nomes que o plano de redução
lista) e `core_equipment_maintenance_events` (de `manutencoesEquip`). RLS
travando tudo exceto `service_role` (sem política por papel/obra, mesmo
critério corrigido acima). RPC `equipment_registry_sync_legacy`, tabela de
auditoria `equipment_registry_shadow_runs`, script `apply-equipment-
registry-shadow.mjs` no `prebuild` de produção, `check-equipment-registry-
shadow-status.mjs` e ação `equipment-registry-report` (mesmo padrão dos
equivalentes do CORE-001).

**Escopo deliberadamente limitado** à camada de cadastro/vínculo, mesma
disciplina do CORE-001: faturamento de locação (`rentalChargeItems`/
`Invoices`/`Receipts`), o calendário de indisponibilidade derivado
(`equipmentUnavailability`) e a normalização interna
(`equipmentModels`/`Lots`/`Units`) ficam de fora - preservados dentro do
`payload` de `core_equipment_allocations` quando relevante (tarifas,
descontos, `lifecycleState`), nunca modelados em coluna própria. A fase
transacional completa (fluxo de locação como comando idempotente) fica
para depois.

**Bug real encontrado e corrigido ao verificar o primeiro deploy**:
`apply-equipment-registry-shadow.mjs` lia só a linha core
(`company_app_data`, `key=arced_ponto_v1`) - mas os campos de equipamento
já saem dela desde a Fase 1 de separação de linhas desta mesma sessão
(`server/domain-row-routing.js`, `DOMAIN_ROW.EQUIPAMENTOS`, linha própria
`${key}__equipamentos`). O gate "passou" no primeiro deploy com um
snapshot sempre vazio - um **falso negativo silencioso** (0 divergências
porque nada foi comparado, não porque estava tudo certo). Só foi pego
porque `equipment-registry-report` (construído e verificado ao vivo na
mesma rodada, mesmo padrão do CORE-001) mostrou `liveCounts` zerado contra
21 equipamentos/48 locações reais confirmados via `load`. Corrigido
mesclando as duas linhas antes de projetar (`mergeDomainRows`, mesmo
utilitário que `lerLinha()` já usa) - **CORE-001 não tem esse problema**:
`obras`/`employees`/`fornecedores`/`terceirizados` nunca saem da linha
core (confirmado em `DOMAIN_FIELDS`, nenhum dos 4 outros domínios os
lista).

**Verificado em produção após a correção**: `equipment-registry-report`
- 21 `core_equipment`, 2 `core_equipment_owners`, 48
`core_equipment_allocations`, 0 `core_equipment_maintenance_events`
(dataset real não tem nenhuma manutenção registrada ainda), 0
divergências - contagens batendo exatamente com `data.equipamentos`/
`locacoesEquip`/`proprietariosEquip` lidos via `load`.

**Lição para o próximo domínio de Fase 2**: antes de escrever o script de
sombra de qualquer campo novo, confirmar em `DOMAIN_FIELDS`
(`server/domain-row-routing.js`) se esse campo já saiu da linha core - se
sim, o script precisa ler e mesclar a linha separada correspondente, não
só a core (como este achado mostrou, o silêncio de "0 divergências" não
distingue "está tudo certo" de "não achei nada para comparar").

## Avaliação qualitativa do código (24/08/2026)

Pedido do usuário, no meio da rodada de Fase 2, por uma leitura honesta do
estado do código - não uma auditoria numérica, mas um julgamento
qualitativo baseado no que foi diretamente observado nesta sessão (código
lido, testes rodados, bugs achados e corrigidos ao vivo).

**Ranking por qualidade, do mais forte ao mais fraco**:

1. **Engenharia global** - checks automatizados reais
   (`architecture:check` via dependency-cruiser, `check-financial-
   boundaries.mjs`, orçamento de bundle no CI), 1263+ testes, disciplina
   consistente de migração aditiva com verificação em sombra antes de
   qualquer corte (CORE-001, CORE-002, esta sessão inteira).
2. **Roadmap** - este documento e `PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`
   mantidos vivos e honestos, com gates explícitos e decisões de escopo
   registradas, inclusive os "não é para agora".
3. **Core pericial** (motores de cálculo) - DRE, custo de mão de obra
   etc. isolados como "motores puros", com uma regra de lint
   (`check-financial-boundaries.mjs`) impedindo a UI de reimplementar
   essa lógica. Fronteira arquitetural real, garantida por ferramenta.
4. **Maturidade do produto hoje** - app de produção real, uso diário
   (ponto, compras, financeiro), dado financeiro real. Dívida técnica
   reconhecida e sendo trabalhada, não escondida.
5. **Frontend foundation** - `LegacyApp.jsx` caiu de ~40 mil linhas via
   extração para componentes de domínio; ainda tem núcleo legado grande.
6. **Application/persistência** - cada vez mais sofisticada
   (particionamento de linha, sombra de sincronização), mas é
   sofisticação para compensar uma base estrutural desconfortável.
7. **Fundação arquitetural** - o ponto mais fraco estruturalmente:
   quase tudo mora num único blob JSONB por empresa
   (`company_app_data`). Execução cuidadosa em cima de uma escolha de
   base desconfortável.
8. **Local API** - `api/data.js` é um handler monolítico com dezenas de
   ramos `if(action===...)`. Funciona e é bem testado, mas separação de
   responsabilidades fraca no nível do arquivo.
9. **Segurança/integridade** - a mais fraca hoje, com evidência
   concreta desta sessão (ver "Fragilidades" abaixo).

**Fragilidades concretas** (evidenciadas nesta sessão, não suposição):

- `api/data.js` monolítico - foi exatamente a distância entre a
  resolução de `usuario` e o uso de `db` que escondeu o bug de
  contaminação de sessão corrigido acima (seção "Correção na raiz:
  `authDb` isolado de `db`"); só auditei `api/data.js`/`api/auth.js`
  para esse padrão, não o resto do projeto.
- Tabelas do motor financeiro (`financial_titles`, `settlements`,
  `financial_events` etc., `migrations/20260725_financial_engine.sql`)
  sem RLS nenhuma - dependem inteiramente da ausência de política para
  `anon`/`authenticated`, não de uma trava ativa como as `core_*` têm
  (`revoke all... grant só a service_role`).
- `company_app_data` como blob único por empresa - mesmo com a
  separação de linhas por domínio (Fase 1 desta sessão), campos
  não-relacionados na mesma linha ainda competem por lock.
- Zero infraestrutura de teste com Postgres real (sem pglite/
  testcontainers/docker) - toda a lógica SQL das migrations 007/009 só
  é testada por asserção de texto (`toContain("create table...")`),
  nunca executada de verdade.
- Os scripts de sombra (`apply-core-registry-shadow.mjs`, `apply-
  equipment-registry-shadow.mjs`) só rodam quando `VERCEL_ENV===
  "production"` - ninguém nunca os viu rodar com sucesso antes do
  deploy real. Foi por isso que o bug do CORE-002 (lendo só a linha
  core, cego à linha separada de equipamentos) só apareceu depois de ir
  pro ar.
- Autenticação híbrida PIN + Supabase Auth coexistindo
  (`usaPin=!accessToken`, `api/data.js`) - fonte real de complexidade
  condicional espalhada pelo handler.
- Segredo de produção (`SUPABASE_SERVICE_ROLE_KEY`) exposto
  repetidamente em texto puro no chat desta sessão - mais um problema
  de processo/tooling do que de código, mas reflete falta de um jeito
  mais seguro do usuário rodar scripts administrativos.

**Melhorias priorizadas** (nesta ordem, por esforço/valor):

1. Auditar todo uso de cliente Supabase no projeto pelo mesmo padrão do
   bug de `db.auth.*` (baixo esforço, já há o critério de busca pronto).
2. RLS real nas tabelas financeiras, fechando a lacuna de segurança
   mais concreta encontrada.
3. pglite (leve, sem Docker) para testar as RPCs SQL de verdade, não só
   o texto - teria pego o bug do CORE-002 antes do deploy.
4. Quebrar `api/data.js` por domínio, preservando os testes existentes.
5. `vercel env pull` ou equivalente, eliminando a necessidade de colar
   a chave de produção no chat.
6. Continuar a migração de Fase 2 - cada domínio migrado reduz a
   pressão sobre o blob único.

**Duas auditorias independentes rodadas em paralelo neste meio-tempo**
(ambas só investigação, sem mudança de código):
- Auditoria completa de todo `createClient` do repositório pelo mesmo
  padrão do bug de `db.auth.*`: confirmado que a correção em
  `api/data.js`/`api/auth.js` é completa - nenhum outro arquivo mistura
  chamada de auth com `.from()`/`.rpc()` no mesmo cliente. Só riscos
  latentes de baixa probabilidade (`api/presence.js`, `api/upload.js`,
  `api/references.js`, `server/microsoft/graph.js` têm clientes de escopo
  de módulo que hoje nunca tocam `.auth.*`, mas poderiam se alguém
  adicionar isso no futuro em vez de delegar para `api/auth.js`).
- Viabilidade de `@electric-sql/pglite` para testar as migrations de
  verdade: recomendado adotar. Testaria a lógica SQL/PL-pgSQL real
  (upserts, arquivamento por ausência, constraints) - teria pego o bug do
  CORE-002 antes do deploy. Limitação importante: pglite não modela
  múltiplas roles/RLS via JWT como o PostgREST real, então não substitui
  verificação de RLS/GRANT contra Supabase de verdade - só complementa.

## Fase 2, primeiro passo na camada transacional: `purchase_requests` (24/08/2026)

Pedido do usuário para avançar da camada de cadastro (CORE-001/CORE-002,
só leitura) para a camada transacional de Fase 2
(`PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`, "Fluxos transacionais"). Escolhido
com o usuário: domínio Compras (`purchase_requests` primeiro, é o início
da cadeia `purchase_requests → quotations → purchase_orders →
goods_receipts`, sem sobreposição com o motor financeiro existente,
diferente de RH/settlements) e profundidade "começar a escrita
transacional real" - diferente do CORE-001/002, que ficaram só em sombra.

**Desenho**: `SOLICITACAO_COMPRA_SALVA` continua gravando o blob
exatamente como sempre (caminho existente, inalterado - `data.
solicitacoesCompra`, `src/domains/compras/purchase-request-commands.js`).
Depois que esse comando é processado com sucesso no caminho travado
(`api/data.js`, ação `operational-command`), uma nova função,
`sincronizarSolicitacaoCompraAoVivo`, grava a MESMA solicitação também em
`purchase_requests` (migration 010) - mas como efeito colateral de melhor
esforço: se essa gravação falhar, a resposta ao usuário não muda em nada,
mesma tolerância de `sincronizarPontoAposArquivo`. O blob continua sendo a
única fonte de verdade operacional.

`purchase_requests` referencia `core_projects` (migration 007) por FK
- uma solicitação para uma obra muito recém-criada pode falhar a escrita
ao vivo até o próximo deploy resincronizar o CORE-001; tolerado pelo mesmo
best-effort (a criação da solicitação em si nunca é bloqueada por isso).

**Escopo mínimo de propósito**: não modela `itens`/histórico de aprovação
em colunas próprias - ficam inteiros dentro de `payload`, mesmo princípio
do CORE-001/CORE-002. Sem RPC dedicada (diferente do CORE-001/002, que
sincronizam em LOTE) - é um upsert direto de UM registro por vez, o
cliente `db` (já isolado de `.auth.*` desde a correção na raiz) já tem
grant suficiente.

**Verificado em produção com um registro de teste real** (criado e depois
removido): `SOLICITACAO_COMPRA_SALVA` respondeu `200 ok:true`
normalmente, e `purchase-requests-report` (endpoint admin novo, mesmo
padrão de verificação do CORE-001/002) confirmou o registro chegando em
`purchase_requests` com todos os campos corretos (`project_id`,
`priority`, `needed_by`, `notes`, `payload` com os itens). Limpeza:
`purchase_requests` não tinha `delete` concedido (migration 010, mesmo
padrão "sem exclusão física" das `core_*`) - migration 011 concedeu
`delete` só para o registro de teste, e uma ação estreita
(`purchase-requests-delete-test-row`, só apaga linhas com
`request_number` começando em `"TESTE-"`) removeu o registro da tabela
relacional.

**Pendência conhecida na hora, resolvida na sessão seguinte**: o registro
de teste ("TESTE-CLAUDE-VERIFICACAO") ficou em `data.solicitacoesCompra`
no blob quando este parágrafo foi escrito, porque não existe comando de
cancelamento/exclusão de solicitação de compra no aplicativo (só
`SOLICITACAO_COMPRA_SALVA`, criar/editar). Removido via
`purchase-requests-cleanup-test-blob-entry` (ver seção "Três pendências
resolvidas em paralelo" logo abaixo) - confirmado ausente em produção via
`load`. A lacuna de fundo (nenhum comando de cancelamento de solicitação
de compra existe no app) continua real e não foi endereçada; só o
registro de teste específico foi limpo.

## Três pendências resolvidas em paralelo (24/08/2026)

Pedido do usuário para resolver todas as pendências documentadas antes de
avançar, em paralelo quando possível. As três eram independentes entre si
(arquivos diferentes, sem sobreposição de edição) - a adoção do pglite
rodou como agente em segundo plano enquanto a limpeza do blob e a RLS
financeira foram feitas em primeiro plano.

1. **Limpeza do registro de teste no blob**: `purchase-requests-cleanup-
   test-blob-entry` (mesma guarda de segurança do utilitário irmão para a
   tabela relacional - só remove `numero` começando em `"TESTE-"`) remove
   a entrada de `data.solicitacoesCompra` e o material associado
   (`data.materiais`, via `solicitacaoOrigemId`) usando o caminho travado
   genérico (`executarMutacaoEmpresaBloqueada`). Verificado em produção:
   registro e material confirmados ausentes via `load` depois da limpeza,
   contagem de solicitações voltou ao total original (5).

2. **RLS real nas tabelas do motor financeiro** (migration 012):
   `financial_titles`, `settlements`, `financial_events`,
   `reconciliation_links`, `data_quality_cases`, `financial_shadow_runs`
   ganham `enable row level security` + `revoke all` + grant mínimo a
   `service_role` (só `select` nas 5 tabelas nunca escritas via
   `db.from()`; `select, insert, update` em `data_quality_cases`, a única
   também escrita por `financial-shadow-sync`). As RPCs de escrita do
   motor financeiro (`financial_sync_legacy_facts`/
   `financial_save_with_sync`) usam conexão `postgres()` direta, imunes a
   GRANT/RLS do PostgREST por construção - nada muda para elas. Verificado
   em produção: `financial-shadow-report` continuou respondendo `200
   ok:true` normalmente depois do deploy, confirmando que a trava nova não
   quebrou o único consumidor real dessas tabelas via Supabase JS.

3. **Primeira infraestrutura de teste com Postgres real**: adotado
   `@electric-sql/pglite` (recomendado pela auditoria da rodada anterior).
   `server/core-registry-sync-legacy.pglite.test.js` executa
   `core_registry_sync_legacy` de verdade contra um Postgres real em WASM
   (não só asserção de texto) - upsert com valores corretos, arquivamento
   e desarquivamento por ausência/reaparecimento no snapshot, e as duas
   exceções de validação (`core_registry_invalid_actor_or_company`/
   `core_registry_invalid_snapshot`). Limitação confirmada e documentada
   no próprio arquivo: pglite não modela múltiplas roles via JWT como o
   PostgREST real, então RLS/GRANT continuam precisando de verificação
   contra Supabase de verdade (como o item 2 acima fez) - pglite cobre a
   lógica SQL/PL-pgSQL das RPCs, não substitui isso.

Suíte inteira (239 arquivos, 1291 testes), build, lint e
`architecture:check` verdes antes do commit único que consolidou as três
frentes.

## Duas pendências reais encontradas ao reconferir o documento inteiro (24/08/2026)

Pedido do usuário para confirmar, lendo o blueprint inteiro (não só grep
por palavra-chave), se realmente não sobrava nenhuma pendência - e depois
para corrigir tudo que fosse encontrado. Um agente de auditoria
independente rodou em paralelo enquanto a correção da lacuna já conhecida
(comando de cancelamento) era implementada em primeiro plano.

**Achado 1 (já sabido, corrigido nesta rodada)**: não existia comando de
cancelamento/exclusão de solicitação de compra. Adicionado
`SOLICITACAO_COMPRA_CANCELADA` (`src/domains/compras/purchase-request-
commands.js`) - soft-delete via `status:"cancelada"`, mesmo padrão de
`EQUIPMENT_RENTAL_CANCELLED` (`src/domains/equipamentos/commands.js`):
nunca remove o registro do array, grava motivo/autor/data do
cancelamento, protegido por versão otimista, e uma solicitação cancelada
não pode mais ser editada. Também passou a alimentar `purchase_requests`
(a escrita ao vivo). **Verificado em produção**: criei e cancelei uma
solicitação de teste real - `status:"cancelada"` confirmado tanto no
blob quanto na tabela relacional.

**Achado 2 (novo, encontrado pelo agente de auditoria)**: a migration 011
(concede `DELETE` em `purchase_requests` a `service_role`) tinha ficado
**permanente em produção por omissão** - `scripts/apply-purchase-
requests-live.mjs` reaplicava essa migration em TODO deploy, apesar do
comentário original dizer "só para limpar um registro de teste" (uso
único). Migration 013 revoga o privilégio (idempotente); 011 saiu da
cadeia recorrente do script. A ação `purchase-requests-delete-test-row`,
cuja única razão de existir era esse grant, foi removida - **verificado
em produção**: chamá-la agora devolve "Ação desconhecida" (400),
confirmando que o privilégio já não é mais exercitável.

**Resíduo aceito, não um problema**: a solicitação de teste usada para
verificar o cancelamento (`TESTE-CANCEL-VERIFICACAO`) foi removida do
blob (via `purchase-requests-cleanup-test-blob-entry`), mas continua como
uma linha em `purchase_requests` com `status:"cancelada"` no payload -
sem `DELETE` mais concedido (de propósito, achado 2), não há como
removê-la por aqui. Inofensiva e claramente identificável pelo prefixo
`TESTE-`; é o comportamento correto agora que a tabela segue o mesmo
princípio "sem exclusão física" das `core_*`.

**Auditoria independente, sem outros achados**: rollback das migrations
007/009 confirmado completo (drop na ordem certa); cobertura de RLS da
migration 012 confirmada exaustiva contra todo uso real de `db.from()`/
`db.rpc()` no motor financeiro; caminho CAS confirmado consistente com o
precedente já estabelecido (inativo em produção, não precisa do gancho de
escrita ao vivo); as três ações de relatório (`core-registry-report`/
`equipment-registry-report`/`purchase-requests-report`) confirmadas como
diagnóstico de backend puro, sem superfície de UI - consistente com o
escopo já documentado, não uma lacuna.

Suíte inteira (240 arquivos, 1301 testes - inclui um ajuste de timeout
real nos testes de pglite, que estouravam o padrão de 10s sob a suíte
inteira em paralelo), build, lint e `architecture:check` verdes antes do
commit.

## Cadeia de Compras: parada deliberada em `purchase_requests` (24/08/2026)

Ao mapear o próximo elo da cadeia (`purchase_requests → quotations →
purchase_orders`, per `PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`), a
investigação encontrou um bug real antes de qualquer código novo: o
comando de cancelamento adicionado na rodada anterior
(`SOLICITACAO_COMPRA_CANCELADA`) não sabia que `saveOrder`
(`src/domains/compras/purchase-order-commands.js`) marca a solicitação
como `status:"pedido_gerado"` + `pedidoId` ao convertê-la num pedido real
- cancelar a solicitação nesse ponto criaria uma solicitação "cancelada"
com um pedido ativo ainda apontando para ela. Corrigido antes de seguir
adiante (`cancelRequest` agora recusa com `pedidoId` presente, apontando
para o cancelamento correto - o do pedido, via `PURCHASE_CANCELLED`/
`COMPRA_CANCELADA`, `purchase-cancellation-command.js`).

Esse achado expôs a escala real do próximo elo: diferente de
`purchase_requests` (um registro isolado, sem efeito colateral em outro
domínio), `cotacoes`/`pedidos` têm referências cruzadas profundas -
cancelar um pedido reverte pagamentos (`data.pagamentos`), estornos de
caixa de obra (`cancelWorkCashMovementFromPayment`), movimentos de
estoque, desvincula notas fiscais e reabre a solicitação de origem, tudo
numa única transação de domínio (~130 linhas só no comando de
cancelamento). Replicar essa lógica como projeção com escrita ao vivo
(mesmo padrão de `purchase_requests`) exigiria o mesmo nível de cuidado
que já quase produziu um bug nesta rodada - só que numa escala
significativamente maior, com dinheiro real em movimento.

**Decisão do usuário, explícita**: parar a cadeia de Compras aqui.
`purchase_requests` fica como está - sólido, testado, verificado em
produção (criação e cancelamento). Cotações e pedidos ficam documentados
como o próximo passo natural da Fase 2 transacional, mas reservados para
uma sessão dedicada, não continuados por inércia nesta.

**Ainda não mapeado** (para quem retomar): onde exatamente uma cotação é
CRIADA (`purchase-order-commands.js` só tem `createFromQuote` - decide
uma cotação existente, gerando o pedido - e `cancelQuote`; a criação em si
não foi localizada nesta investigação) - primeiro passo de uma
investigação futura, antes de qualquer desenho de schema.

## Comando de criação de cotação: a lacuna fundamental fechada (24/08/2026)

Retomando a cadeia de Compras (usuário: "abrir a cadeia de Compras"), o
mapeamento pedido (agente Explore, muito completo) achou a resposta ao
"ainda não mapeado" acima: **a criação de uma cotação nunca foi um
comando operacional** - era `update()` direto do componente
(`ComprasView.jsx`, `salvarCotacao`), sem versão, sem autoria e sem
nenhum teste de comportamento. Todo o resto do domínio Compras (decidir
cotação, cancelar cotação, cancelar pedido, pagamentos, recebimento) já é
comando operacional adequado - só a criação ficou pra trás, provavelmente
por ter nascido antes da extração de Compras para `src/domains/compras/`.

Isso muda a ordem certa de trabalho: desenhar uma tabela relacional para
`cotacoes`/`pedidos` antes de consertar essa lacuna significaria migrar
um caminho de escrita que ainda nem é comandado - o mesmo problema que
`purchase_requests` já tinha sido corrigido antes de virar tabela viva.
Corrigido primeiro, por ser pré-requisito e ser a peça de menor risco:

- Novo comando `QUOTATION_SAVED`/`COTACAO_COMPRA_SALVA`
  (`src/domains/compras/purchase-order-commands.js`), no mesmo arquivo que
  já trata `createFromQuote`/`cancelQuote` (mesmo domínio, mesma
  entidade). Espelha exatamente a validação que já existia no cliente
  (material, quantidade, mínimo de 2 propostas válidas) e acrescenta o
  que só faltava: versionamento otimista (`version`, `expectedVersion`),
  autoria (`criadoPorId`/`criadoPor`/`criadoEm`), e a mesma checagem de
  conversão de unidade que `normalizeItems` já aplica aos itens do
  pedido - `createFromQuote` copia esses campos da cotação direto para o
  item do pedido, então validar na criação da cotação só antecipa um erro
  que hoje só aparece depois, na hora de decidir a cotação.
- Editar uma cotação existente agora exige que ela ainda esteja `"aberta"`
  (rejeita edição de cotação já decidida/cancelada) - defesa em
  profundidade, já que a UI só abre o modal de edição para cotações
  `"aberta"` (`kanbanCompras`, `ComprasView.jsx:846`), mas o comando não
  dependia disso até agora.
- O vínculo `solicitacaoId` passa a ser imutável após a criação (só a
  criação pode atribuí-lo) - o código antigo recalculava esse vínculo a
  cada salvamento sem nunca reverter `cotacaoIds` da solicitação anterior
  se o vínculo mudasse; como a UI nunca expõe esse campo como editável,
  travar por comando fecha uma inconsistência que só existia em teoria.
- `ComprasView.jsx`: `salvarCotacao` passou de `update()` síncrono para
  `dispatchCommand` assíncrono (mesmo padrão de `excluirCotacao`/
  `excluirCompra`, já existentes no mesmo arquivo); `ModalCotacao` ganhou
  estado `salvando` e desabilita os botões durante o envio (mesmo padrão
  já usado em `ModalSolicitacaoCompra`).
- Papéis (`api/data.js`, `OPERATIONAL_COMMAND_ROLES`) e persistência
  financeira (`FINANCIAL_OPERATIONAL_COMMANDS`) registrados iguais aos
  outros comandos de cotação (`["admin","compras"]`) - mesma seção
  (`cotacoes`) que `section-authorizations.js` já protegia para o
  caminho antigo de `update()`.

**Fechado em seguida (24/08/2026, mesma sessão, "continue e seja
autonomo")**: a anexação de documento a uma proposta
(`salvarDocumentoCotacao`, `ComprasView.jsx`) era a última escrita do
domínio Compras ainda feita por `update()` direto. Virou o comando
`PURCHASE_QUOTE_DOCUMENT_ATTACHED`/`DOCUMENTO_COTACAO_COMPRA_ANEXADO`
(`purchase-order-commands.js`), espelhando `attachDocument` (pedidos) -
a diferença é que o documento pertence a uma PROPOSTA dentro da cotação,
não à cotação diretamente, e a cotação precisa estar `"aberta"` (mesma
defesa em profundidade do `QUOTATION_SAVED`). O cache da pasta do
OneDrive em `data.obras` ficou de propósito FORA do comando: mesmo padrão
já usado por `PURCHASE_ORDER_DOCUMENT_ATTACHED` em `LegacyApp.jsx:5262-
5278` - o comando cobre só o dado auditável (a cotação/proposta), e a
atualização do campo de cache em `obras` continua um `update()` best-
effort separado, feito depois que o comando já confirmou. Esse padrão de
dois passos (achado ao investigar como o comando já existente de pedidos
resolvia o mesmo problema) é o que tornou essa conversão segura sem
precisar resolver a questão mais ampla de `obras:["admin"]` restringir
quem pode gravar o cache de pasta - fora de escopo, não é um problema
nesta lacuna específica.

Testes novos: 7 casos em `purchase-order-commands.test.js` (anexa e
versiona; cotação inexistente; proposta que não pertence à cotação;
documento incompleto; documento duplicado na mesma proposta; bloqueio
pós-decisão/cancelamento; concorrência otimista).

## Cancelamento de solicitação: comando já existia, mas nunca tinha sido conectado (24/08/2026)

Antes de fechar a rodada, um `grep` por `update({` em `ComprasView.jsx`
(hábito já estabelecido nesta sessão de conferir antes de declarar uma
lacuna fechada) achou mais dois pontos, e um deles era sério:

- **`atualizarStatusSolicitacao(sol,"cancelada")`** - o botão CANCELAR de
  solicitações de compra gravava `status:"cancelada"` por `update()`
  direto, **apesar de `PURCHASE_REQUEST_CANCELLED` já existir e já estar
  testado** desde a rodada em que a cadeia de Compras foi investigada
  nesta mesma sessão (`purchase-request-commands.js`). O comando nunca
  tinha sido ligado a
  nenhum botão - existia e passava nos testes, mas era código morto do
  ponto de vista de uso real. Cancelar pelo caminho antigo pulava: a
  checagem de `pedidoId` (uma solicitação que já gerou pedido só pode ser
  cancelada cancelando o PEDIDO - a mesma inconsistência que motivou essa
  guarda ao criar o comando), a concorrência otimista (`expectedVersion`),
  e os campos de auditoria (`motivoCancelamento`/`canceladoEm`/
  `canceladoPor` nunca eram gravados). Corrigido: nova função
  `cancelarSolicitacao` (mesmo padrão de `excluirCotacao` - `window.prompt`
  para o motivo, `dispatchCommand` com versão lida ao vivo do estado
  atual) substitui a chamada antiga no botão CANCELAR.
- **`registrarContatoSolicitacao`** (registra quando uma solicitação foi
  "emitida" por WhatsApp para um fornecedor, `data.solicitacoesCompra[].
  contatos[]`) continua sendo `update()` direto - dado informativo/trilha
  de contato, sem comando equivalente hoje. Diferente do cancelamento,
  aqui não existe nenhuma proteção sendo pulada (não há comando
  equivalente para pular) - registrado como gap conhecido, não como bug,
  já que criar um comando novo do zero para isso é uma decisão de escopo
  maior do que esta rodada comporta.
- **`atualizarStatusSolicitacao(sol,"em_analise")`** continua por
  `update()` direto pelo mesmo motivo - não existe comando para essa
  transição específica (`PURCHASE_REQUEST_SAVED` preserva sempre o status
  atual da solicitação existente, nunca aceita trocá-lo). Mesma categoria
  de gap conhecido que o item acima.

Testado: `npx vitest run` completo (245 arquivos/1343 testes) permanece
verde após a mudança - não havia teste cobrindo o caminho antigo do botão
CANCELAR (mais uma lacuna de cobertura que essa correção também fecha
indiretamente, ao mover para um comando que já tinha 7 casos de teste
próprios).

Com isso, a escrita de Compras que representa risco real de auditoria/
integridade (solicitação, cotação, pedido, decisão, cancelamento,
pagamento, recebimento, documentos) passa por comando operacional. Os dois
itens que restam por `update()` direto (contato via WhatsApp, marcar
"em análise") são trilha informativa sem proteção equivalente sendo
pulada - não é urgência, mas fica registrado para não reaparecer como
"já resolvido" por engano numa sessão futura.

Testes novos: `src/domains/compras/purchase-order-commands.test.js` ganhou
6 casos para `QUOTATION_SAVED` (criação com autoria/versão/atualização da
solicitação, mínimo de propostas, conversão de unidade inválida, obra
divergente da solicitação, edição preservando o vínculo original,
concorrência otimista, bloqueio de edição pós-decisão/cancelamento).

Verificação: suíte completa 241 arquivos/1313 testes verdes, `npm run
build`, `npm run lint` e `npm run architecture:check` sem violação nova.

## CORE-003: cotações e pedidos em modo sombra (24/08/2026)

Usuário: "continue e seja autonomo". Com o pré-requisito fechado (seção
acima), segui direto para a projeção relacional em modo sombra de
`cotacoes`/`pedidos` - mesmo padrão do CORE-001 (`migrations/007`) e
CORE-002 (`migrations/009`): só leitura, sem trocar nenhum caminho real do
aplicativo, gate de build (`npm run prebuild`) derruba o deploy se achar
divergência entre o blob e a projeção.

**Migration 014** (`migrations/014_create_procurement_projection.up.sql`):
- `core_quotations` - id, obra, insumo, `request_id` (vínculo com a
  solicitação de origem), status, quantidade. Propostas ficam inteiras em
  `payload` (nenhum outro domínio referencia uma proposta pelo próprio id
  - mesmo princípio de escopo mínimo do CORE-001/CORE-002).
- `core_purchase_orders` - id, obra, fornecedor, `quote_id`, `request_id`,
  número, status. Itens/pagamentos/recebimentos ficam inteiros em
  `payload`.
- `procurement_registry_shadow_runs` - histórico de sincronizações, mesmo
  padrão de `core_registry_shadow_runs`/`equipment_registry_shadow_runs`.
- RPC `procurement_registry_sync_legacy` - upsert-on-conflict + arquiva
  (nunca apaga) o que sai do snapshot, mesma estrutura das RPCs anteriores.
- **Decisão de design registrada explicitamente**: `request_id` (vínculo
  com `solicitacaoId`) NÃO tem chave estrangeira para `purchase_requests`
  (migration 010) de propósito - `purchase_requests` é escrita AO VIVO de
  melhor esforço desde 24/08/2026, sem garantia de cobertura de
  solicitações anteriores a essa data (é dual-write best-effort, não um
  sync em lote como este). Uma FK ali quebraria a sincronização de
  qualquer cotação/pedido histórico vinculado a uma solicitação nunca
  duplicada na tabela viva. Já `project_id`/`supplier_id` SÃO chave
  estrangeira para `core_projects`/`core_suppliers` (CORE-001) porque
  essas são projeção completa em lote, sempre atualizada antes desta no
  encadeamento do `prebuild`, e nunca fazem DELETE físico (só
  `archived_at`) - uma referência antiga permanece válida mesmo que o
  cadastro de origem tenha sumido do blob depois.
- Testado com execução real de Postgres via pglite
  (`server/procurement-registry-sync-legacy.pglite.test.js`), incluindo um
  caso que prova a FK de verdade rejeitando um pedido com fornecedor
  inexistente - não só asserção estática de texto do SQL.

**Camada JS**: `server/procurement-registry-shadow.js` (snapshot +
comparação por hash, mesmo padrão de `equipment-registry-shadow.js`;
filtra pedidos cuja `cotacaoId` não está no próprio snapshot antes de
enviar à RPC, mesma auto-consistência que `allocations` já faz contra
`equipmentIds`), `server/procurement-registry-shadow-status.js`
(formatação do resumo, testado sem rede),
`scripts/apply-procurement-shadow.mjs` (só roda quando
`VERCEL_ENV==="production"`, adicionado ao fim do encadeamento do
`prebuild`, depois de `financial-engine:rls` - depende de
`registry:migrate-shadow` já ter rodado antes, mesmo `npm run prebuild`,
para que `core_suppliers` já exista quando a FK for verificada),
`scripts/check-procurement-registry-shadow-status.mjs`
(`npm run procurement-registry:shadow-status`, mesmo padrão dos dois
scripts de status anteriores). Ação `procurement-registry-report`
adicionada a `api/data.js` (admin-only), mesmo padrão de
`core-registry-report`/`equipment-registry-report`.

Cotações e pedidos vivem na linha `core` (nunca saíram dela -
`server/domain-row-routing.js`, `DOMAIN_FIELDS`), diferente de
equipamentos (CORE-002 precisou mesclar duas linhas) - o script de
aplicação lê só a linha core, mesmo padrão simples do CORE-001.

**Ainda em aberto, por decisão deliberada (mesma disciplina de
CORE-001/CORE-002)**: nenhuma política de RLS por papel/obra, nenhum
caminho de leitura real (tela/endpoint fora do relatório admin) consome
esta projeção. Virar consumidor real é o próximo passo natural, mas fica
para quando houver necessidade concreta - não faz sentido construir uma
tela sobre uma tabela ainda não comprovada em produção.

Verificação: suíte completa 245 arquivos/1335 testes verdes, `npm run
build`, `npm run lint` e `npm run architecture:check` sem violação nova.
Script de aplicação testado localmente (no-op fora de produção, conforme
esperado).

## Investigação da integração com o agente de IA (24/08/2026)

Pedido do usuário para confirmar se a integração com o agente de IA (o
Gemini/"CFO Gemini" citado em `PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`,
implementada em `api/ai-agent.js`) estava sendo documentada. Não estava -
é uma área completamente separada da migração de Fase 2, nunca tocada
nesta sessão. Investigação dedicada, mesmo rigor da auditoria de
contaminação de cliente Supabase feita mais acima.

**Confirmado seguro**:
- `database()` (`api/ai-agent.js:33`) é uma fábrica por chamada (não um
  cliente de módulo compartilhado) - mesmo padrão "seguro" já confirmado
  pela auditoria de `.auth.*` para o resto do projeto.
- A autenticação passa por `authenticateAppUser` → `authenticateAppContext`
  (`api/auth.js`) - a MESMA função já corrigida nesta sessão (`authDb`
  isolado de `db`). O agente de IA já herda essa correção sem precisar de
  nenhuma mudança própria.
- A chave da API Gemini nunca é devolvida ao navegador (`safeStatus()` só
  expõe `configured`/`model`/`source`/timestamps), fica criptografada em
  repouso (AES-256-GCM, `server/ai-secret.js`), e configurar/remover exige
  papel admin.

**Achado real, conectado ao risco já conhecido da chave exposta**: quando
`AI_ENCRYPTION_KEY` não está configurada, a chave Gemini é criptografada
usando um segredo DERIVADO de `SUPABASE_SERVICE_ROLE_KEY`
(`server/ai-secret.js`, `legacySecret`/`keyVersion !=="ai-v1"`) - o mesmo
valor que foi exposto repetidamente em texto puro nesta sessão. Isso
significa que o risco da chave de serviço exposta (cuja rotação o usuário
decidiu adiar, duas vezes, nesta sessão) pode se estender além do acesso
direto ao banco: também compromete a confidencialidade da chave da API
Gemini armazenada, **se** `AI_ENCRYPTION_KEY` não estiver definida
separadamente no ambiente (não verificado se está - não tenho acesso às
variáveis de ambiente da Vercel). Registro factual, não uma nova
solicitação de rotação - o usuário já foi claro sobre isso.

**Achados menores, não corrigidos (fora do escopo deste pedido, que era
investigar e documentar)**:
- Sem limite de requisições por usuário na ação de chat/análise em si -
  só existe limite para tentativas de PIN incorretas
  (`applyPersistentAuthRateLimit`, herdado de `authenticateAppContext`).
  Um usuário autenticado poderia gerar custo real no Gemini sem
  throttling (até 5.200 tokens de saída no módulo DRE, mais até 6 imagens
  e 3 PDFs por requisição).
- Dado operacional/financeiro real (`contexto`, até 24.000 caracteres)
  é enviado ao Gemini (Google) como parte do prompt - característica de
  design esperada para a funcionalidade, não um bug, mas vale estar
  ciente do fluxo de dado para terceiro.

Nenhuma mudança de código feita nesta investigação - só leitura e
documentação, conforme pedido.

## Correção dos achados do agente de IA (24/08/2026)

Pedido do usuário ("corrija") para corrigir o que foi encontrado na
investigação acima. Duas mudanças, uma delas revelando um bug de
autenticação real e pré-existente, sem relação nenhuma com IA.

**1. Limite de requisições na ação de chat/análise** (`api/ai-agent.js`):
um limitador em memória (`aiRequestLog`, `Map` de escopo de módulo -
mesmo padrão do limitador de tentativas de PIN em `api/auth.js`), janela
deslizante de 5 minutos, 20 requisições por usuário
(`AI_RATE_WINDOW_MS`/`AI_RATE_MAX_REQUESTS`). Aplicado só no caminho que
de fato chama o Gemini (chat/análise) - `status`, `configure`, `remove` e
resumo diário continuam sem limite, pois não geram custo de API externa.
Ao estourar, devolve `429`/`code:"AI_RATE_LIMIT_LOCAL"`. Mesma limitação
já assumida conscientemente no limitador de PIN: não sobrevive a cold
starts entre instâncias serverless diferentes, então não é defesa contra
um atacante determinado com múltiplas instâncias - é proteção contra uso
descontrolado acidental de um usuário já autenticado, mesmo julgamento de
risco já usado alhures no projeto.

**2. Bug real e pré-existente descoberto por acidente**
(`api/auth.js:80-94`, `authenticateAppContext`): ao escrever o teste do
limitador acima (`src/integration/ai-agent-rate-limit.test.js`), usuários
de teste diferentes resolviam sempre para o MESMO usuário do ArcD,
independente do token usado. Causa raiz: o fallback de correspondência
por e-mail, `String(u.email||"").toLowerCase()===email`, sempre que TANTO
a sessão do Supabase Auth quanto um usuário do ArcD têm e-mail vazio
(comum - muitos usuários operam só com PIN, sem e-mail cadastrado),
`"" === ""` é sempre verdadeiro. Isso fazia a comparação casar por engano
com o PRIMEIRO usuário sem e-mail da lista, resolvendo a pessoa errada em
vez de falhar a autenticação por e-mail - o `authUserId` continuava
funcionando normalmente; só esse fallback por e-mail tinha o buraco.
Corrigido com uma guarda `email &&` antes da comparação, para que o
fallback por e-mail só valha quando há um e-mail de verdade, não-vazio,
para comparar.

Este achado é significativo por si só: é um bug de autenticação em
produção, não relacionado a IA, que existia antes desta sessão e nunca
tinha sido notado - só veio à tona como efeito colateral de escrever um
teste para outra coisa. Cobertura de teste dedicada adicionada em
`api/auth.test.js` (3 casos: não casa por engano dois usuários sem
e-mail; continua casando por `authUserId`; continua casando por e-mail
quando ele existe de verdade) - até esta correção, `api/auth.js` não
tinha nenhum arquivo de teste próprio, apesar de ser o ponto central de
autenticação usado por todos os endpoints.

O achado da chave Gemini criptografada com segredo derivado de
`SUPABASE_SERVICE_ROLE_KEY` (seção anterior) permanece sem correção -
depende de definir `AI_ENCRYPTION_KEY` no ambiente da Vercel ou de
reconsiderar a rotação da chave de serviço, decisão que continua sendo do
usuário.

Verificação: suíte completa (`npx vitest run`) 241 arquivos/1305 testes
verdes, `npm run build`, `npm run lint` e `npm run architecture:check`
sem violação nova.

## Auditoria de comandos operacionais nunca conectados (24/08/2026)

Depois de achar `PURCHASE_REQUEST_CANCELLED` (comando existente, testado,
mas nunca ligado a nenhum botão), a suspeita óbvia era: existe o mesmo
padrão em outro lugar do app? Auditoria automatizada (não manual - um
script varreu todo `export const *_COMMAND=Object.freeze({...})` em
`src/domains/**` e `server/*.js`, extraiu as 103 chaves de comando
encontradas, e verificou se `OPERATIONAL_COMMAND.<chave>` aparece em
algum arquivo `.jsx`/`.js` de `src/` fora do próprio arquivo de definição
e de testes - ou seja, se existe um ponto de disparo real na interface).

**Resultado**: 8 dos 10 "sem uso" encontrados eram falso positivo do
método - `CONFIRM_RECEIPT`/`CONFIRM_PAYMENT`/etc. (`server/reconciliation-
command.js`) são um namespace de comando PRÓPRIO (`RECONCILIATION_COMMAND`,
mesmo padrão de `ATTENDANCE_COMMAND` - pipeline separado de
`OPERATIONAL_COMMAND`), e de fato são disparados em
`src/features/conciliacao/ConciliacaoView.jsx`, só que via
`RECONCILIATION_COMMAND.X`, não `OPERATIONAL_COMMAND.X` (o texto que o
script procurava).

Sobraram 2 achados genuínos, nenhum deles com a mesma gravidade do
cancelamento de solicitação (que tinha um CAMINHO ANTIGO ativo pulando a
proteção do comando) - aqui não existe caminho antigo nenhum, é
capacidade construída e testada que nunca ganhou uma tela:

- **`EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED`**
  (`src/domains/equipamentos/commands.js:509-523`) - vincula um
  recebimento bancário a uma fatura de locação de equipamento
  (`rentalInvoiceReceipts`), atualiza `receivedAmountCents`/status da
  fatura. Módulo de validação (`rental-invoices.js`) e comando existem e
  são testados (`commands.test.js:237-241`); nenhuma tela em `src/`
  referencia `rentalInvoiceReceipts` - não há como disparar isso pela
  interface hoje.
- **`LOOKAHEAD_PACKAGE_COMMITTED`**
  (`src/domains/sync/operational-commands.js:508-517`,
  `commitWorkPackage` em `src/domains/lookahead/commands.js`) - mesma
  situação: comando testado (`operational-commands.test.js:198`), nenhuma
  tela referencia `commitWorkPackage`/`packageId`.

**Por que não corrigido nesta rodada**: ao contrário do cancelamento de
solicitação (só religar um botão a um comando já pronto), estes dois
exigiriam CONSTRUIR a tela/ação que falta - decisão de produto (o que
essa tela mostra, onde ela entra no fluxo de Locação/Lookahead), não uma
correção de lacuna. Registrado para que uma sessão futura saiba que a
capacidade já existe no backend, testada, só falta o consumidor.

Nenhuma mudança de código nesta auditoria - só leitura, e a comparação
final linha a linha de cada um dos 2 achados genuínos foi feita manualmente
(grep dedicado) antes de descartar os 8 falsos positivos, para não deixar
passar um caso real disfarçado de falso positivo.

## Tela de recebimento de fatura de locação (24/08/2026)

Usuário escolheu, dos dois achados da auditoria acima, construir o
primeiro: uma ação para vincular um recebimento bancário ao saldo em
aberto de uma fatura de locação de equipamento
(`EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED`).

**Onde entrou**: `src/domains/equipamentos/components/EquipamentosView.jsx`,
na aba de locações (`Cobrança por ciclo`, ainda em desenvolvimento - não
entra no DRE, ver aviso já existente na tela). Cada fatura em aberto
(`status` `issued`/`partially_paid` e `openAmountCents>0`) de uma locação
ganhou uma linha própria com o número, o saldo, e um botão "Vincular
recebimento". O modal (`rentalReceiptModal`) deixa escolher uma transação
bancária já importada (`data.transacoes`, filtrada só por `valor>0` -
mesmo critério, sem excluir por status, já usado no seletor de transação
do pagamento de pedidos de compra em `ComprasView.jsx`, para não divergir
de uma convenção de UI já estabelecida), valor recebido (pré-preenchido
com o saldo em aberto, editável para recebimento parcial), data e
observação.

**Por que a UI não filtra transações já conciliadas**: a validação de
reuso de uma transação bancária (`rental-receipts.js`,
`validateRentalInvoiceReceipt`) já é feita pelo comando, contra
`rentalInvoiceReceipts` (não contra `transacoes.status`). O seletor de
transação já existente para pagamento de pedidos (`ComprasView.jsx`)
segue a mesma prática - não filtra por status, confia na validação do
comando. Reproduzida aqui por consistência, não por análise nova.

**Verificação**: `npm run build` (JSX válido, bundle de Equipamentos
compilou), suíte completa (245 arquivos/1343 testes, sem teste novo
necessário - a lógica do comando já tinha cobertura própria desde antes
desta rodada, `commands.test.js:237-241`; este código é só a ligação de
UI, e este projeto não tem convenção de teste de componente React para
`EquipamentosView.jsx`, mesmo padrão já observado em `ComprasView.jsx`),
`lint` e `architecture:check` sem violação. **Limitação explícita**: não
foi possível testar visualmente o fluxo em produção - a aba do navegador
desta sessão não tem sessão autenticada salva (mesma limitação já
registrada nas rodadas anteriores desta sessão) e não tenho o PIN para
logar. Só a compilação e os testes automatizados confirmam corretude de
código, não a experiência real da tela.

## INCIDENTE: 6 deploys seguidos falharam silenciosamente (25/08/2026)

Usuário pediu "teste" depois de logar manualmente no navegador desta
sessão para permitir verificação real da tela de recebimento de fatura de
locação (seção anterior). Ao tentar abrir a tela em produção, o código
novo simplesmente não estava lá - o chunk JS servido não continha
`Vincular recebimento` nem `rentalReceiptModal`.

**Investigação**: comparar o conteúdo do chunk servido (`fetch` direto do
arquivo, `x-vercel-cache: HIT`, `last-modified` de ~8 minutos antes do
`index.html` mais recente) já indicava dessincronia. A confirmação
definitiva veio de `gh api repos/.../commits/<sha>/status`, que expõe o
check de deploy da Vercel por commit:

```
38ab91d (tela de recebimento)........... failure
8befb5e (doc auditoria).................. failure
2c61235 (doc. cotação + cancelamento).... failure
7d54baf (CORE-003)........................ failure
823bef6 (QUOTATION_SAVED)................ failure
7844206 (fix agente IA + bug de e-mail).. failure
115ad1e (doc. investigação agente IA).... SUCCESS  ← produção real ficou aqui
```

**Seis commits seguidos falharam no deploy, e ninguém percebeu** -
inclusive eu, que "confirmei em produção" cada uma dessas rodadas ao
longo da sessão. A verificação usada até aqui (`fetch` a `/api/data` sem
sessão, esperando `401`) tem um defeito grave: uma função serverless
INTOCADA da última versão QUE FUNCIONOU continua respondendo `401`
perfeitamente bem - o teste não distingue "a versão nova está no ar" de
"uma versão antiga qualquer ainda está no ar". Todo "verificado em
produção" desta sessão a partir do commit `7844206` estava, na prática,
testando a versão de `115ad1e` sem saber disso.

**Causa raiz**: `api/auth.test.js` (criado na rodada do commit `7844206`,
ver seção "Correção dos achados do agente de IA"). A Vercel, com
`"framework":"vite"` e a convenção de pasta `api/`, trata TODO arquivo
`.js` dentro de `api/` como candidato a função serverless própria -
inclusive um arquivo de teste. `api/auth.test.js` importa `vitest`
(devDependency, não disponível no empacotamento de função da Vercel) e
não exporta nenhum handler - isso quebra o build de função da Vercel,
silenciosamente, sem aparecer em `npm run build` local (que não faz esse
empacotamento de função nenhuma vez). Nenhum outro arquivo de teste de
`api/*.js` já existente cometia esse erro - todos os outros sempre
viveram em `src/integration/` (ex.: `ai-agent-rate-limit.test.js`,
testando `api/ai-agent.js` de fora). Este foi o único caso, desta sessão,
em que um teste de handler de API nasceu dentro da própria pasta `api/`.

**Corrigido**: `api/auth.test.js` movido para
`src/integration/auth-email-matching.test.js` (import ajustado para
`../../api/auth.js`, mesmo padrão dos demais). `.vercelignore` ganhou
`api/*.test.js` como cinto de segurança - mesmo que um teste volte a
nascer ali por engano numa sessão futura, não deve mais derrubar o
deploy.

**O que isso significa para todo o trabalho de `7844206` a `38ab91d`**:
nenhuma correção de bug, nenhum comando novo, nenhuma tela e nenhuma
migration dessas seis rodadas chegou a rodar em produção até agora -
inclusive a migration 014 (CORE-003) nunca foi de fato aplicada contra o
Postgres de produção, porque o deploy nunca completou o `prebuild`. Isso
é bom, no sentido de que "nunca rodou" é mais seguro que "rodou errado" -
mas significa que a rodada de verificação em produção precisa ser
refeita do zero para tudo isso assim que o próximo deploy realmente
suceder.

**Lição sobre verificação, para não repetir**: checar `401`/"função não
crashou" NUNCA prova que o código atual está no ar. A partir de agora,
depois de um push, checar o status real do deploy via
`gh api repos/<owner>/<repo>/commits/<sha>/status` (campo `state`) antes
de declarar qualquer coisa "verificado em produção".

**Resolução, mesmo incidente**: mesmo depois do commit `83ef92f` (a
correção) reportar deploy `success` via `gh api`, o chunk
`EquipamentosView-*.js` continuou servindo o hash ANTIGO (pré-38ab91d) -
segundo problema, distinto do primeiro: cache de build da Vercel
dessincronizado, provavelmente por reaproveitar o cache incremental do
último build bem-sucedido (`115ad1e`, 6 commits atrás) sem invalidar
corretamente os arquivos alterados nos commits que falharam no meio do
caminho. Diagnosticado comparando o hash produzido por um `npm run build`
local limpo (`EquipamentosView-BXPfaBpY.js`) contra o hash servido em
produção (`EquipamentosView-B7iQ9QTv.js`, antigo) - eram diferentes.
Corrigido com o usuário aprovando explicitamente (`AskUserQuestion`) um
redeploy de produção manual via Vercel CLI (`vercel --prod --force`,
ignora cache de build) - a CLI já estava autenticada nesta máquina.
`vercel link` (necessário antes do deploy manual) criou por engano um
projeto novo vazio ("hygor", por adivinhar o nome pelo repositório em vez
do projeto real "pontos") - identificado e removido (`vercel remove`,
também com aprovação do usuário) antes de prosseguir com o link correto.
O redeploy forçado produziu exatamente o hash esperado
(`EquipamentosView-BXPfaBpY.js`, idêntico ao build local) e foi
promovido/aliasado para `pontosarcd.vercel.app`.

**Verificado de ponta a ponta, com o usuário logado na sessão real**: a
tela "Vincular recebimento" abre com o número da fatura, saldo em aberto
e valor pré-preenchido corretos; o seletor de transação bancária mostra
corretamente "Selecione..." como única opção (não há transação bancária
de entrada cadastrada nesta empresa agora - comportamento correto do
filtro, não um bug; não foi possível testar o envio completo por falta de
dado de transação bancária de teste). Dado de teste criado durante a
verificação (uma linha de cobrança "Teste vinculo recebimento - CORE-003"
de R$ 50,00 e a fatura `FAT-202608-001` dela, na locação de
"VIBRADOR DE CONCRETO" da obra CA1-06) fica registrado aqui para quem
notar esse registro no banco depois e estranhar a origem.

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

## Verificação do módulo de Conciliação Bancária (25/08/2026)

Usuário pediu uma verificação de código e funcionamento do módulo de
Conciliação (~4.600 linhas: `src/domains/conciliacao/*`,
`src/features/conciliacao/ConciliacaoView.jsx`,
`server/reconciliation-*.js`).

**Arquitetura, confirmada sólida**: o núcleo (`mutations.js`,
`matching.js`, `selectors.js`, `identity.js`, `engine.js`, `payroll.js`)
é 100% funções puras, sem React/DOM/persistência, com comentários
explicando o PORQUÊ de cada regra de negócio (ex.: por que medição/entrada
de contrato admitem recebimento parcial e reuso no índice, mas os demais
fatos não; por que crédito sem obra/medição não pode virar estorno de
despesa). O motor de candidatos (`matching.js`) nunca decide sozinho -
só classifica confiança; toda confirmação passa pelo operador. O caminho
servidor (`server/reconciliation-command.js` +
`server/reconciliation-policy.js` + `server/reconciliation-execution.js`)
já é 100% comando operacional com trava real
(`executarMutacaoEmpresaBloqueada`), idempotência
(`reconciliationCommandLog`), autorização por papel verificada DENTRO da
trava (evita corrida entre checar permissão e persistir), e uma política
de RH corretamente restrita (só saída de folha/mão de obra, só da própria
obra do RH).

**Achado real, corrigido**: 4 seções que `ConciliacaoView.jsx` sempre
gravou por `update()` direto (contas bancárias, regras de
auto-classificação, fechamento/reabertura de período bancário, rejeição
de candidata) nunca tiveram entrada em `SECTION_ROLES`
(`server/section-authorizations.js`). Como `authorizeSectionChanges`
rejeita qualquer seção desconhecida para todo perfil que não seja
`admin`, e `src/domains/conciliacao/permissions.js` explicitamente
autoriza o perfil **"financeiro"** a operar essas 4 telas
(`CONCILIACAO_OPERAR_ROLES=["admin","financeiro"]`), qualquer usuário
financeiro (não-admin) que tentasse fechar um período, cadastrar conta
bancária, criar/editar regra ou rejeitar uma candidata recebia
`"a seção X não pode ser alterada por esta rota"` do servidor - **só
administrador conseguia usar essas 4 funcionalidades na prática**, apesar
da tela mostrar os botões para financeiro normalmente. Verificado
diretamente contra a função real (`authorizeSectionChanges({role:
"financeiro"}, {fechamentosBancarios:[...]})` devolvia a mensagem de
erro) antes de corrigir, não só por leitura de código.

Corrigido: as 4 seções entraram em `SECTION_ROLES` (`admin`+`financeiro`),
mais um novo `validateBankReconciliationPolicy` (mesmo padrão de
`validateBudgetBaselinePolicy`/`validatePlanningBaselinePolicy`) que
mantém exclusivas do administrador as duas transições que uma checagem de
seção inteira não consegue distinguir: reabrir um período JÁ fechado
(`status:"fechado"→"reaberto"`) e excluir fisicamente uma regra - as duas
já eram admin-only no cliente (`podeReabrirFechamento`/
`podeDesfazerConciliacao`), agora também no servidor. `arquivarExtrato` e
`extratos`/`historicoConc` foram conferidos e NÃO tinham o mesmo problema
- são admin-only de propósito, e administrador sempre ignora
`SECTION_ROLES` (`if(user.role==="admin")return "";`), então o
bypass client-side coincidia com o único papel que também passa no
servidor. Testes novos em `server/section-authorizations.test.js` (7
casos: financeiro autorizado nas 4 seções; rh/engenheiro continuam
bloqueados; reabrir fechamento e excluir regra continuam admin-only;
financeiro consegue fechar um período novo e criar/desativar uma regra
sem removê-la).

Verificação: suíte completa (246 arquivos/1352 testes), `build`, `lint` e
`architecture:check` sem violação. Deploy confirmado via
`gh api .../commits/<sha>/status` (`state:"success"`) - mudança é só de
backend (`api/data.js`, `server/section-authorizations.js`), sem risco do
cache de chunk de frontend já documentado no incidente anterior desta
sessão. **Limitação**: não foi possível testar a restrição de papel ao
vivo em produção (a sessão do navegador está autenticada como
administrador, que ignora `SECTION_ROLES` por inteiro - não há como
reproduzir o bloqueio original nem confirmar a liberação para
"financeiro" sem uma sessão real desse perfil).

## Melhoria: extrair contraparte da descrição do PIX (25/08/2026)

Usuário perguntou se havia "condições de melhoria" depois de ver, em
produção, que a confirmação em lote (seção anterior) não achou nenhuma
transação "pronta" entre 794 pendentes. Investigação dos dados reais
(via `/api/data`, ação `load`, só estatísticas agregadas - nunca
imprimi nome/documento completo de ninguém neste processo) achou a causa
exata:

- **PIX/CPF-CNPJ estruturado: ~0%** das 794 transações pendentes têm
  `chavePix`/`contraparteDocumento` preenchidos - o extrato desta conta
  (Banco Inter, identificado no OFX pelo nome corporativo antigo "Banco
  Intermedium S/A") nunca envia essas tags. Isso é uma limitação real do
  banco, não um bug de código.
- **Mas o nome completo da contraparte está embutido no texto livre da
  descrição** (`MEMO`), em um de dois formatos extremamente consistentes
  (confirmado contra os 794 registros reais, ~77% só nos 15 formatos mais
  comuns):
  - `Pix enviado: "Cp :18236120-JOAO DA SILVA"`
  - `Pix enviado: "00019 247280631 JOAO DA SILVA"`
- **Achado adicional, mais grave que parecia**: existiam DUAS
  implementações de `parseOFX` - uma em
  `src/domains/conciliacao/calculations.js` (testada, mas nunca importada
  por nenhum código real) e outra, mais rica, dentro de `LegacyApp.jsx`
  (a que o app de fato usa ao importar um extrato, `descricao`/`fitid`/
  `txid`/`tipoOperacao` etc.). A divergência escondia que a extração de
  contraparte nunca rodava de verdade e dava falsa confiança de teste
  (o `parseOFX` testado não era o `parseOFX` usado).

**Corrigido**: as duas implementações foram consolidadas em
`src/domains/conciliacao/calculations.js` (única fonte agora -
`LegacyApp.jsx` importa de lá). Nova função pura
`extrairContraparteDescricaoPix(descricao)` reconhece os dois formatos do
Banco Inter e preenche `contraparteNome` como fallback só quando a tag
`<NAME>` estruturada não existe - nunca sobrescreve um nome já
estruturado, e nunca inventa um nome a partir de um código numérico ou
texto sem cara de nome (exige no mínimo duas palavras alfabéticas; falha
em `""` em qualquer caso ambíguo). Nenhuma mudança no motor de casamento
(`matching.js`) foi necessária - ele já sabia usar `contraparteNome`,
só nunca recebia o dado.

**Fora de escopo por falta de dado real**: o usuário também usa
**Nubank**, mas nenhuma transação pendente na base atual veio de lá (só
Banco Inter). Não constrói um parser para um formato nunca visto - fica
pendente até existir uma amostra real (arquivo de exemplo ou descrição
do formato) para verificar contra dados de verdade, mesmo princípio já
seguido a sessão inteira.

**Retroatividade, decisão deliberada**: as 794 transações já importadas
NÃO foram atualizadas retroativamente (isso exigiria um script tocando
registros financeiros já persistidos, fora do fluxo normal de comando) -
a melhoria vale a partir do próximo extrato importado. Se fizer sentido
reprocessar o histórico, é uma decisão separada, a ser pedida
explicitamente.

Testes novos: `calculations.test.js` ganhou 5 casos (extração com tag
`<NAME>` estruturada tem prioridade; fallback para a descrição quando não
há tag; os dois formatos confirmados do Banco Inter; nunca inventa nome a
partir de texto sem esse formato, incluindo os casos de uma palavra só ou
puramente numérico).

Verificação: suíte completa (246 arquivos/1362 testes), `build`, `lint`
e `architecture:check` sem violação.

## Backfill retroativo do contraparteNome nas 794 transações pendentes (25/08/2026)

Pedido explícito do usuário: a decisão de "não retroagir", registrada na
seção anterior, foi revisitada e o usuário pediu para de fato reprocessar
o histórico.

`scripts/backfill-conciliacao-contraparte-pix.mjs` (registrado como
`npm run conciliacao:backfill-contraparte-pix`) reaplica
`extrairContraparteDescricaoPix` sobre as transações já importadas -
mesma função, mesma garantia de nunca inventar nome, já testada em
`calculations.test.js`. Escopo deliberadamente restrito:

- só toca transações com `status==="pendente"` (conciliadas/ignoradas
  ficam como estão - não há motivo para reabrir um registro já fechado);
- só preenche `contraparteNome` quando esse campo está **vazio** hoje -
  nunca sobrescreve um valor já existente (mesma garantia da extração
  em si);
- roda em modo `--dry-run` por padrão (só lê e relata quantas
  transações seriam afetadas, com amostra mascarada); `--apply` grava
  de verdade.

Gravação usa a RPC `company_save_with_audit` (a mesma que toda escrita
de `api/data.js` usa) - CAS por `updated_at` da linha core e evento em
`audit_events` na mesma transação, com retry (recalculando os
candidatos do zero a cada tentativa) se outra gravação concorrente
mudar a linha entre a leitura e a escrita. `coreFieldsOnly` é reutilizado
para não regravar por engano os campos que hoje moram em linhas
separadas (Ponto/Lookahead/Config/Equipamentos/RDO).

Não roda como parte do build/deploy (é uma migração de dado, não de
schema - mesmo padrão de `apply-financial-shadow.mjs` e
`seed-split-domain-rows.mjs`) - precisa ser rodado manualmente com as
credenciais de produção (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

Verificação: suíte completa, `build`, `lint` e `architecture:check` sem
violação nova (o script fica fora do escopo do dependency-cruiser, como
os demais em `scripts/`, mas as outras três checagens continuam
cobrindo o repositório inteiro).

## Correção: pagamento direto a terceiro caía como custo da empresa, não da obra (25/08/2026)

Pedido do usuário ("está tudo correto com o DRE? sendo gravada por obra
ou empresa? na categoria correta?") levou a uma auditoria do caminho
completo candidata → comando → mutação → DRE para os 3 tipos de comando
que o lote de confirmação automática (seção anterior) pode aprovar sem
revisão individual: nota, pedido, medição, medição de terceiro,
funcionário, título de folha e **terceiro** (pagamento direto a um
terceirizado, sem medição vinculada).

Categoria sempre esteve correta (herdada da entidade de origem, ou fixa
e certa para pagamento a terceiro). Obra estava correta em todos os
casos MENOS um: `tipo==="terceiro"`. A cadeia completa:

- `matching.js` já monta a candidata com um campo `obraId` (herdado do
  índice construído em `selectors.js`) - mas **`selectors.js` era o
  único indexador que não passava `obraId` ao indexar terceirizados**
  (`nota`, `pedido`, `medicao`, `medicaoTerc` sempre passaram; só
  `terceiro` faltava), apesar do cadastro de terceirizados já exigir
  obra (`TerceirosView.jsx`).
- Mesmo se a candidata tivesse `obraId`, nada o levava adiante: nem o
  clique manual de "Confirmar" na tela (`ConciliacaoView.jsx`), nem o
  tradutor do lote automático (`comandoConciliacaoAutomatica`),
  passavam esse campo no payload do comando `CONFIRM_PAYMENT`.
- E a mutação (`registrarPagamentoEConciliar`, branch `tipo==="terceiro"`
  em `mutations.js`) usava `tr.obraId` como única fonte - um campo que
  **nunca é preenchido em lugar nenhum do sistema** (nem na importação
  do OFX, nem em nenhuma tela), confirmado por busca no domínio inteiro.

Resultado antes da correção: o custo não se perdia (entrava no DRE
normalmente, com categoria certa), mas caía como custo da empresa em vez
da obra certa, com um aviso de qualidade de dado
(`THIRD_PARTY_PAYMENT_WITHOUT_MEASUREMENT`, severidade "warning") sem
nenhuma tela existente para realocar depois - um beco sem saída.

Correção (5 pontos, sem UI nova - o dado já existia, só não fluía):

1. `selectors.js`: indexador de terceirizados passa a incluir
   `obraId: t.obraId`.
2. `ConciliacaoView.jsx`: o clique manual de confirmar passa
   `targetObraId: c.obraId` no payload.
3. `engine.js` (`comandoConciliacaoAutomatica`): o tradutor do lote
   automático também passa `targetObraId: candidata.obraId`.
4. `reconciliation-command.js`: o handler de `CONFIRM_PAYMENT` valida
   `targetObraId` contra `data.obras` (mesma cautela de `knownWorks` em
   `allocateTransaction` - um id inventado é ignorado, nunca persistido
   cru) e repassa para a mutação.
5. `mutations.js`: `registrarPagamentoEConciliar` aceita o novo
   parâmetro `obraId` e o usa como fonte primária (`obraId || tr.obraId
   || null`), preservando o fallback antigo (hoje sempre vazio, mas
   inofensivo mantê-lo).

Testes novos: candidata de terceiro carrega `obraId` do cadastro
(`matching.test.js`); mutação usa o `obraId` informado e cai para `null`
sem ele, nunca inventando (`mutations.test.js`); comando do servidor
valida contra `data.obras` e ignora id inexistente
(`reconciliation-command.test.js`); tradutor do lote propaga
`targetObraId` (`engine.test.js`).

Verificação: suíte completa (246 arquivos/1368 testes), `build`, `lint`
e `architecture:check` sem violação.

## Amplia o lote de confirmação automática além de só "pronta" (25/08/2026)

Pedido do usuário ("corrija e automatize"), escolhendo explicitamente a
opção de ampliar o lote existente (não uma regra 100% sem clique humano).

O motor (`engine.js`, `analisarMovimentoConciliacao`) passa a devolver um
campo `elegivelLote` (booleano) além de `classificacaoOperacional`:

- `"pronta"` (score ≥95, sem segunda candidata a menos de 15 pontos)
  sempre foi e continua elegível.
- Dentro de `"revisar"` (score 80-94), **só** entra o subconjunto sem uma
  segunda candidata próxima. `classification()` já classificava como
  `"revisar"` mesmo quando o score da melhor candidata era ≥95, se
  houvesse uma segunda candidata forte a menos de 15 pontos - esse
  subconjunto é ambiguidade real (não dá para saber com segurança qual
  das duas é o fato certo) e **fica de fora do lote**, mesmo estando
  tecnicamente em "revisar". Confirmar isso às cegas arriscaria
  pagar/receber contra o registro errado.
- `"investigar"`, `"bloqueada"` e `"sem_correspondencia"` continuam fora,
  como sempre.

`comandoConciliacaoAutomatica` não mudou de comportamento (os mesmos 3
tipos de `acaoRecomendada` continuam sendo os únicos alcançáveis, agora
tanto por "pronta" quanto pelo subconjunto elegível de "revisar" - a
mesma prova estrutural documentada no comentário da função ainda vale).

`ConciliacaoView.jsx`: renomeado `transacoesProntas` →
`transacoesElegiveisLote` (reflete a nova composição); botão e modal
atualizados para não afirmar "prontas" quando o lote agora pode incluir
itens de "revisar" sem ambiguidade; cada linha do modal ganhou um selo
(`pronta`/`revisar`) para o usuário saber a origem daquela linha antes
de confirmar. Continua exigindo o mesmo clique humano de sempre - nada
muda no requisito de revisão, só no que entra na lista revisável.

Testes novos em `engine.test.js`: `elegivelLote` verdadeiro para
"pronta"; verdadeiro para "revisar" sem segunda candidata próxima;
falso para "revisar" causado por ambiguidade real entre duas candidatas
fortes (mesmo fitid, mesmo CNPJ, mesmo valor - score 100 nas duas,
margem zero).

Verificação: suíte completa (246 arquivos/1371 testes), `build`, `lint`
e `architecture:check` sem violação. Mudança de UI (modal de lote) não
verificada em navegador nesta rodada - a tela exige login e dados
financeiros reais para exercitar o cenário "revisar sem ambiguidade";
coberta pelos testes de domínio (`engine.test.js`) e pela compilação
bem-sucedida do JSX.

## Auditoria completa do motor do DRE e correção: despesa do caixa da obra nunca virava custo (25/08/2026)

Pergunta do usuário ("partindo do DRE, todas as informações estão
corretas?") levou a uma auditoria completa de `ledger.js`/`calculations.js`
(agente `dre-integration-guardian`, achados confirmados por leitura direta
do código antes de agir).

**Achado real, mais sério que o do terceiro**: uma despesa lançada direto
na tela "Caixa da obra" (material, mão de obra ou terceirizado pago com
dinheiro da obra, sem nota/pedido/medição vinculada) sempre reduzia o
saldo do caixa (`cash_out`) mas **nunca virava custo no DRE**. O campo
`efeitoDRE:"custo_obra"` já era gravado em `work-cash-commands.js` desde
sempre - a intenção estava lá -, mas `ledger.js` só guardava esse valor
dentro de `metadata` (dado inerte), nunca emitindo o evento `effect:"cost"`
que `selectDRE` de fato soma. Diferente de todo outro caminho "não
alocado" do arquivo (terceiro sem medição, folha sem título), esse nem
emitia aviso de qualidade de dado - o gap era completamente silencioso.
Confirmado com o usuário: a funcionalidade é usada de verdade em produção.

Confirmado também com o usuário: "aporte" (entrada de capital na obra)
**nunca deve virar receita da empresa** - só "despesa" vira custo.

Correção em `ledger.js` (bloco `data.caixaObra`): quando a despesa **não**
está vinculada a nota/pedido/medição/pagamento existente, além do
`cash_out` de sempre, agora também emite `effect:"cost"` (mesma categoria
do lançamento) e um aviso informativo (`WORK_CASH_EXPENSE_WITHOUT_DOCUMENT`).
Quando **está** vinculada (ex.: pagamento de nota que também espelha uma
saída no caixa da obra, via `payable-payment-commands.js`), o custo já foi
reconhecido pelo bloco de nota/pedido - **não** emite `cost` de novo, para
não duplicar (a deduplicação automática de `add()` por `sourceSubId` só
cobre `cash_in`/`cash_out`, não `cost` - por isso essa checagem manual por
`linked` é necessária). "Aporte" continua gerando só `cash_in`, nunca
`cost`/`revenue`.

Como o DRE é recalculado ao vivo a partir do blob de dados (não há
snapshot armazenado que precise de backfill - `financial-shadow.js` é só
homologação em sombra, não o que a tela lê), essa correção passa a valer
retroativamente para todas as despesas do caixa da obra já lançadas, assim
que o deploy sobe - sem precisar de script de migração.

Testes novos em `ledger.test.js` (`describe("caixa da obra - despesa vira
custo, aporte nunca vira receita")`): despesa sem vínculo gera custo E
saída, sem duplicar; despesa já vinculada a um pagamento não duplica o
custo; aporte nunca vira receita nem custo.

**Achado secundário, sem impacto hoje (não corrigido nesta rodada - código
morto, baixa prioridade)**: `server/dre-projection.js` passa 4 parâmetros
(`calcObraTercCost` e outros) para o motor do DRE que nunca são lidos por
`calculations.js` - sobra de uma refatoração anterior. Fica documentado
para uma limpeza futura.

**Pontos auditados e confirmados sãos**: os 3 problemas de calibragem já
documentados anteriormente continuam corrigidos; dedução de duplicidade
caixa↔nota funciona; filtro de cancelado/estornado é uniforme em todos os
blocos; "recebimento avulso nunca vira receita" é arquitetura deliberada e
testada; custo de mão de obra vem exclusivamente do motor de ponto
(`calcObraLaborCost`), nunca da folha diretamente - não há duplicidade
entre eles.

Verificação: suíte completa (246 arquivos/1374 testes), `build`, `lint` e
`architecture:check` sem violação. Não verificado ao vivo em produção
nesta rodada - a navegação até a tela "Caixa da obra" pelo navegador não
respondeu durante a investigação; a correção se apoia nos testes de
domínio e na leitura direta do código de escrita e leitura.

## Crítica de design (DRE por Obra e DRE Empresa) e correções (25/08/2026)

Pedido do usuário: crítica de design/UX das telas `DRE por Obra`
(`DRELegado`, `LegacyApp.jsx`) e `DRE Empresa` (`DREEmpresa`,
`LegacyApp.jsx`), no mesmo rigor usado em revisão de design deste
projeto (hover/press state, curva de easing, consistência entre
componentes). Achados confirmados por leitura direta do CSS/JSX (não
suposição), depois implementados a pedido do usuário ("implemente
tudo"):

1. **`.dre-kpi-card` sem `:active` próprio** ([index.css:3910-3912](src/index.css#L3910-L3912))
   - tinha hover (`translateY(-1px)`) mas o clique caía só no
   `button:active{filter:brightness(.94)}` genérico. Adicionado
   `.dre-kpi-card:active{transform:translateY(0) scale(.98);...}`.
2. **Gráficos Recharts (`BarChart`/`PieChart`/`LineChart`) das duas telas
   sem `isAnimationActive` em nenhum lugar** - replay da animação padrão
   (~1500ms) a cada troca de ano/mês/quinzena/aba, a ação mais repetida
   de quem usa o DRE no dia a dia. Adicionado `isAnimationActive={false}`
   em todos os `<Bar>`/`<Pie>`/`<Line>` das duas telas (não nas demais
   telas do app, que não fizeram parte desta revisão).
3. **Duas caixas de diálogo na mesma tela (DRE por Obra) com motion
   oposto**: o modal legado (`Modal`, `detalheKpi`) já tinha entrada
   `scale(.97)+opacity` com curva própria (`--arcd-ease-standard`,
   `cubic-bezier(0.2,0,0,1)`) e tokens de duração; o `DesignSystemDialog`
   (`despModal`) não tinha nenhuma transição - aparecia/sumia instantâneo
   ([Dialog.jsx](src/design-system/primitives/Dialog.jsx),
   [styles.css:46-47](src/design-system/primitives/styles.css#L46-L47)).
   Adicionada a mesma entrada (`scale(.97)+opacity+translateY`, mesmos
   tokens `--arcd-motion-*`/`--arcd-ease-standard`) em
   `.arcd-dialog`/`.arcd-dialog-backdrop` - agora todo `Dialog` do design
   system (não só o do DRE) ganha a mesma qualidade de entrada.
4. **DRE Empresa: KPIs renderizavam `R$ 0,00` real (de `dreVazio`)
   enquanto a projeção canônica carregava**, antes do valor de verdade
   chegar - um número financeiro passando por zero antes do resultado
   real é o tipo exato de mudança brusca que confunde quem bate o olho
   rápido. Trocado por um placeholder de shimmer
   (`.dre-kpi-loading`, respeitando `prefers-reduced-motion`) enquanto
   `razaoCarregando` - nada de "R$ 0,00" chega a ser renderizado no DOM
   nesse meio-tempo.

O que já estava bem feito e não foi mexido: o sistema de modal legado em
si (nunca `scale(0)`, curva custom, tokens de duração,
`prefers-reduced-motion` zerando tudo) - o problema era só a falta de
uniformidade entre os dois sistemas de diálogo, não o sistema em si.

Verificação: suíte completa (246 arquivos/1374 testes), `build`, `lint`
e `architecture:check` sem violação. Mudança puramente visual/CSS+JSX
sem lógica de dado - não verificada interativamente no navegador nesta
rodada (login de produção não disponível neste ambiente; tentativa de
rodar o dev server local também não permitiu navegação). Apoiada na
leitura direta do código contra os padrões de motion já estabelecidos
no design system (`motion.css`).
