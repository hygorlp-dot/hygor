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
