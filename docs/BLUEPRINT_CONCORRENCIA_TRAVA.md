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
- **Migração de dado**: `scripts/seed-split-domain-rows.mjs` (novo,
  `npm run split-rows:seed`) cria as 4 linhas novas por empresa, semeadas
  com cópia dos campos correspondentes da linha core. Idempotente (upsert
  com `ignoreDuplicates`) - precisa rodar contra produção antes/junto do
  deploy; sem rodar, o código detecta a linha ausente e devolve
  `503 SPLIT_ROW_MIGRATION_REQUIRED` em vez de um erro confuso de
  concorrência.
- Fase 1.5 (partição de Ponto por obra) e Fase 2 (tabelas relacionais)
  continuam não implementadas, como planejado - nenhuma delas foi puxada
  para esta rodada.

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
