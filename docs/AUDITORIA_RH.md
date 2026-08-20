# Auditoria do módulo RH — completude funcional frente a mercado

Esta é a segunda rodada de auditoria do módulo de RH (`src/domains/rh/`,
`src/domains/ponto/`, telas `Equipe`/`Rescisao`/`Folha` em `LegacyApp.jsx`)
nesta sessão. A primeira rodada já cobriu funcionamento, DRE, código/
arquitetura e segurança, com correções aplicadas: 2 achados P0 corrigidos
(vazamento de remuneração entre papéis e avos de rescisão sem limite,
commit `4059d9d`; vazamento de CPF nas rescisões, commit `5a9024c`) e uma
crítica de design completa (skill `impeccable`) que levou a nota de 23 para
29/40, com correções aplicadas. Nota combinada final dessa rodada: 8,8/10.
Nenhum desse conteúdo é repetido aqui — este documento cobre só a dimensão
que faltava: **completude funcional frente a sistemas de mercado de RH
para construção civil**.

Avaliação por conhecimento geral de domínio (Sienge RH, Ábaco, Datacoper e
prática de departamento pessoal para construção civil no Brasil como
referência) — **não é benchmark medido**, é comparação qualitativa. Cada
lacuna abaixo foi checada por grep exaustivo e leitura de código antes de
ser listada; onde algo existe parcialmente, isso é descrito com precisão
em vez de contado como ausência total.

## As 3 lacunas apontadas de relance — confirmação com evidência

### 1. Gestão de férias durante o vínculo ativo — CONFIRMADA (lacuna total)

O sistema só lida com férias no momento da rescisão. `grep` exaustivo por
`ferias`/`periodoAquisitivo`/`gozo` em `src/domains/rh/`, `src/domains/ponto/`
e nas funções `Equipe`/`Rescisao`/`Folha` de `src/LegacyApp.jsx` retorna
ocorrências **só dentro do cálculo de rescisão**:

- `src/domains/rh/rescission-calculations.js:54-65` — calcula `avosFerias`
  (avos do período aquisitivo em aberto na data de desligamento) só para
  compor o valor da rescisão.
- `src/LegacyApp.jsx:10542,10658,10889,10902` — as 4 únicas ocorrências de
  "Férias" em todo o arquivo, todas dentro do formulário/preview de
  rescisão (`incluirFerias`, `feriasTotal`).
- `src/domains/ponto/` (grep exaustivo em todos os 18 arquivos) — zero
  ocorrências de `ferias`/`periodoAquisitivo`/`gozo`.

O modelo de dado do funcionário (`emptyEmp` em `LegacyApp.jsx:7114-7136`)
não tem nenhum campo de férias (nem saldo, nem data de início do período
aquisitivo, nem histórico de gozo). `employeeLifecycleStatus`
(`src/domains/rh/employee-commands.js:17-23`) só reconhece 4 estados:
`arquivado`, `desligamento_agendado`, `desligado`, `ativo` — não existe
estado "em férias". Não há: pedido de férias, fluxo de aprovação,
agendamento do período de gozo, rastreamento de saldo ano a ano, nem
alerta de "férias vencidas" (período aquisitivo completo sem gozo, que
gera pagamento em dobro por força de lei se não corrigido a tempo). Isso é
uma lacuna de compliance real, não só de conveniência: o cálculo de
rescisão está correto, mas o sistema não ajuda a *evitar* chegar a uma
rescisão com múltiplos períodos vencidos acumulados.

### 2. Documentos/certificações do funcionário com vencimento — CONFIRMADA COM RESSALVA (o motor existe e está conectado; falta a fonte de dado e a tela)

Este é mais sutil que "ausente": existe um domínio dedicado,
`src/domains/seguranca/` (`calculations.js`, `constants.js`), com
`evaluateWorkerEligibility` (`calculations.js:3-11`) que já verifica
exatamente isso — `worker.documents`, `worker.trainings[chave].expiresAt`
(inclui NR-35 no teste: `seguranca.test.js:2`) e `worker.examExpiresAt`
(exame ocupacional) — e `validateActivitySafety`
(`calculations.js:12`), que bloqueia atividade crítica se algum
trabalhador estiver com documentação/treinamento/exame vencido. Essa
função **está de fato conectada** ao fluxo real de avanço físico:
`src/domains/sync/operational-commands.js:158-173`
(`validateProgressSafety`) chama `validateActivitySafety` passando
`data.employees` (a mesma lista de funcionários do RH) sempre que um
registro de avanço físico é lançado numa atividade crítica.

A ressalva que rebaixa isto de "presente" para "lacuna real": **não existe
em lugar nenhum do projeto uma tela ou comando que grave
`worker.documents`, `worker.trainings` ou `worker.examExpiresAt`** — grep
exaustivo por esses 3 nomes de campo em todo `src/` (excluindo o próprio
`domains/seguranca` e `operational-commands.js` que os leem) retorna zero
ocorrências. `employee-commands.js` e o formulário `Equipe`
(`LegacyApp.jsx:7114-7136`) não têm nenhum campo de ASO, NR, exame ou
validade de documento. Na prática, como `overdue()` (`calculations.js:2`)
só considera vencido quando existe uma data (`!!date && ...`), todo
funcionário sem esses campos preenchidos (ou seja, 100% deles hoje) é
sempre avaliado como apto — o motor de bloqueio existe e está testado
(`seguranca.test.js`), mas está **inerte** por falta de dado de entrada. Já
o irmão desse mecanismo — APR (Análise Preliminar de Risco) e PT
(Permissão de Trabalho), na tela `SegurancaObra`
(`LegacyApp.jsx:16717-16744`) — esse sim é real e usado: tem formulário,
comando (`SAFETY_RISK_ANALYSIS_SAVED`/`SAFETY_WORK_PERMIT_SAVED`) e bloqueia
atividade crítica sem APR aprovada + PT liberada. Resumo: a lacuna
confirmada não é "falta o conceito", é "falta o cadastro de ASO/NR/exame
por funcionário e a central de alertas de vencimento" — o motor de
avaliação e o ponto de bloqueio já existem prontos para recebê-lo.

### 3. Analytics/relatórios de RH dedicados — CONFIRMADA (lacuna total)

`FolhaView.jsx` (`src/domains/ponto/components/FolhaView.jsx`) tem
exatamente 2 visões, controladas por `payrollView`
(`FolhaView.jsx:38,770-771`): "Folha da quinzena" (`payroll`) e "Sindicato"
(`union`, contribuição sindical). Não há terceira aba, nem em `FolhaView`
nem em nenhum outro lugar do projeto. `grep` exaustivo por
`turnover`/`absenteismo`/`headcount`/`indicador` em `src/domains/rh/` e
`src/domains/ponto/` retorna zero ocorrências relevantes. Não existe
domínio de `dashboard` ou `relatorios` genérico no projeto (listagem de
`src/domains/`: 32 domínios, nenhum chamado `dashboard`, `analytics`,
`indicadores` ou `relatorios`) — cada módulo, quando tem relatório, embute
o próprio (como o dashboard de conversão do Comercial). RH não tem
equivalente: nenhum turnover, custo médio por obra/função, absenteísmo ou
evolução de headcount ao longo do tempo — apesar de os dados brutos para
calcular todos esses 4 indicadores já existirem no sistema
(`data.employees` tem `startDate`/`endDate`/`obra`/`role`; `data.att`/
`attendance-engine.js` tem presença diária).

## Completude funcional frente a sistemas de mercado (tabela completa)

| # | Lacuna | Evidência de ausência | Valor | Esforço |
| --- | --- | --- | --- | --- |
| 1 | Gestão de férias durante o vínculo ativo (pedido, aprovação, agendamento do gozo, saldo do período aquisitivo, alerta de férias vencidas) | Zero campos de férias em `emptyEmp` (`LegacyApp.jsx:7114-7136`); `employeeLifecycleStatus` não tem estado "em férias" (`employee-commands.js:17-23`); único uso de "férias" em todo o projeto é dentro do cálculo de rescisão | Alto (risco de compliance: férias vencidas geram pagamento em dobro por lei; hoje nada avisa até a rescisão) | Alto (módulo novo completo: máquina de estado, tela de solicitação/aprovação, cálculo de saldo por período aquisitivo, notificação de vencimento) |
| 2 | Cadastro de documentos/certificações do funcionário com vencimento (ASO, NR-35/NR-18/NR-06, exame periódico, CNH) e central de alertas | O motor `evaluateWorkerEligibility`/`validateActivitySafety` já existe e está conectado a `validateProgressSafety` (`operational-commands.js:158-173`), mas `worker.documents`/`worker.trainings`/`worker.examExpiresAt` nunca são gravados em lugar nenhum (grep exaustivo, zero ocorrências fora do próprio motor) — hoje todo funcionário é sempre avaliado como apto por falta de dado | Alto (o gate de segurança que já existe está inerte; funcionário com ASO vencido hoje libera atividade crítica sem barreira) | Médio (não é do zero — falta "só" a tela de cadastro por funcionário + comando de gravação + central de alertas; a lógica de avaliação e o ponto de bloqueio já estão prontos e testados) |
| 3 | Analytics/relatórios de RH dedicados (turnover, custo médio por obra/função, absenteísmo, evolução de headcount) | `FolhaView` só tem `payroll`/`union` (`FolhaView.jsx:38,770-771`); nenhum domínio `dashboard`/`relatorios`/`indicadores` existe no projeto; zero ocorrências de `turnover`/`absenteismo`/`headcount` em `rh/`+`ponto/` | Médio-alto (dados brutos já existem em `data.employees`+presença diária; é 100% trabalho de agregação/visualização, não de captura) | Médio |
| 4 | Banco de horas / compensação de hora extra (folga em vez de pagamento) | `payroll.js:53-90` só calcula `overtimePay` (hora extra sempre paga); zero ocorrências de `compensat`/`folga`/`bancoHoras` em `payroll.js`/`attendance-engine.js` | Médio-alto (comum em obra por picos de prazo; hoje só há a opção de pagar, nunca compensar) | Médio |
| 5 | Escala de trabalho / turnos (mais de um turno, plantão, revezamento) | `workdayHours`/`workStart` em `emptyEmp` (`LegacyApp.jsx:7127-7128`) são valores únicos e fixos por funcionário — não há conceito de turno, nem de escala compartilhada/revezamento | Médio (a maioria das obras opera turno único; relevante para vigia/plantão e obras com 2-3 turnos) | Médio |
| 6 | Integração com eSocial/CAGED/RAIS/GFIP/SEFIP (órgãos governamentais) | Zero ocorrências de `esocial`/`caged`/`rais`/`gfip`/`sefip` em todo `src/` | Alto (obrigação legal federal; hoje presumivelmente feito 100% fora do sistema, com risco de dado divergente entre o que o RH calcula aqui e o que é declarado ao governo) | Alto (integração com layout de órgão público, certificado digital, geralmente terceirizada até em ERPs maduros) |
| 7 | Assinatura eletrônica de documentos trabalhistas (recibo de férias, TRCT, advertência) | `FolhaView.jsx:499-500,575` só tem uma linha de assinatura estática para impressão em papel ("Responsável RH: ___"); nenhuma integração com provedor de assinatura eletrônica em nenhum domínio de RH | Médio (reduz papel/deslocamento, mas não é bloqueante hoje) | Médio |
| 8 | Portal de autoatendimento do funcionário (ver holerite, solicitar férias, atualizar dado cadastral) | `src/client-portal/` existe mas é exclusivo para clientes externos da obra, não para funcionários; zero ocorrências de "autoatendimento"/"self-service"/"meu holerite" ligadas a funcionário | Médio-alto (reduz carga do RH em pedidos repetitivos) | Alto (novo perfil de acesso e autenticação, superfície de ataque nova) |
| 9 | Gestão de EPI por funcionário (ficha de entrega, controle de vencimento/troca) | `epi` só existe como categoria de compra de fornecedor (`domains/suppliers/categories.js:10`, "EPI e segurança") — é uma tag de o que se compra, não um controle de o que foi entregue a quem e quando trocar; zero ocorrências de ficha/entrega/devolução de EPI ligada a funcionário | Médio-alto (exigência de NR-6 comum em fiscalização de obra) | Médio |

Nenhum item desta tabela foi corrigido ou implementado nesta sessão — é
investigação e priorização apenas, como pedido. Os itens #1 e #2 são os de
maior valor por serem risco de compliance direto (férias vencidas em dobro;
gate de segurança de atividade crítica hoje inerte por falta de dado). O
item #2 tem a melhor relação valor/esforço da tabela porque a metade mais
difícil (motor de avaliação, integração com o bloqueio de avanço físico)
já está pronta e testada — falta "só" o cadastro e o alerta.
