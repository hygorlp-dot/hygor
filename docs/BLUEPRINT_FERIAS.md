# Blueprint: módulo de Gestão de Férias (RH) — para revisão, sem implementação

Produzido em 20/08/2026 por leitura direta do código (não é especulação),
em resposta ao achado #1 de `docs/AUDITORIA_RH.md` ("Gestão de férias
durante o vínculo ativo — CONFIRMADA (lacuna total)"). **Nada deste
documento foi implementado** — é insumo para decisão, não um plano em
execução. As referências de arquivo:linha foram conferidas no estado do
repositório em 20/08/2026 e podem ter se movido desde então.

---

## 0. O que a leitura do código mudou em relação ao pedido original

Três achados de código restringem as opções de design e precisam entrar na
decisão do usuário antes de qualquer estimativa de esforço:

1. **`src/domains/ponto/attendance-engine.js:287`** — `isValidAttendanceStatus`
   só aceita `"P"`, `"M"`, `"F"`. Não existe (e nunca existiu) um status de
   dia "em férias" no ponto.
2. **`src/domains/ponto/payroll.js:13`** — o fator de dia pago é
   `status === "P" ? 1 : status === "M" ? 0.5 : 0`. Ou seja: **qualquer dia
   sem `P`/`M` marcado hoje é tratado como não pago.** Se um funcionário sai
   de férias e ninguém preenche o ponto manualmente todo dia como presença,
   a folha do período vai *descontar* os dias de férias como se fossem
   falta — o oposto do que a lei exige (férias é licença remunerada).
3. **`src/domains/rh/rescission-calculations.js:56-59`** (comentário no
   próprio código) — o cálculo de rescisão já admite explicitamente que
   "férias vencidas" (múltiplos períodos aquisitivos fechados sem gozo) não
   é rastreado hoje, e que se isso existir é "um valor à parte, fora deste
   cálculo (decisão de produto, não resolvida aqui)". Ou seja: mesmo depois
   de existir o módulo de férias, o cálculo de rescisão vigente **não vai
   automaticamente cobrar a multa em dobro de férias vencidas** — isso é um
   segundo pedaço de trabalho, não incluído neste blueprint, e deve ser
   tratado como item separado após o módulo base existir.

Esses três pontos aparecem de novo nas seções 5, 6 e 7.

---

## 1. Modelo de dado mínimo viável

Novo array no blob, seguindo o padrão de `data.rescisoes`/`data.advances`
(nenhuma tabela relacional nova — mesmo princípio já registrado em
`docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`). Nome sugerido:
**`data.ferias`** (mantém o vocabulário em português já usado em
`rescisoes`/`obras`, em vez de misturar com `vacationRequests`).

Cada registro (`FeriasRecord`):

```js
{
  id,                    // uid()
  empId,                 // FK data.employees — igual ao padrão de rescission-commands.js:47
  obraId,                // herdado do funcionário no momento da criação (mesmo padrão de rescissionCommandObraId)

  // Período aquisitivo a que este pedido se refere — não é derivado, é
  // FIXADO no momento da solicitação porque um funcionário pode ter mais de
  // um período aquisitivo em aberto (ex.: gozo atrasado de 2 anos).
  periodoAquisitivoInicio,  // "YYYY-MM-DD", aniversário de admissão que abriu o período
  periodoAquisitivoFim,     // periodoAquisitivoInicio + 12 meses (calculado na criação, congelado)
  periodoConcessivoFim,     // periodoAquisitivoFim + 12 meses (prazo legal para gozar; congelado)

  // Gozo
  dataInicioGozo,        // "YYYY-MM-DD" ou "" se ainda não agendado
  dataFimGozo,            // dataInicioGozo + diasGozo - 1
  diasGozo,               // dias corridos de gozo efetivo (máx. 30, respeita a regra de fracionamento se for fase 2)
  diasAbono,              // dias "vendidos" como abono pecuniário (0-10, CLT art. 143)
  valorAbono,             // dailyRate/30 * diasAbono (não é 1/3 constitucional; ver seção 5)
  valorTercoConstitucional, // 1/3 sobre os dias de gozo remunerado, calculado uma vez na aprovação/agendamento

  status,                 // "pendente" | "aprovada" | "em_gozo" | "concluida" | "cancelada"
                           // "vencida" NÃO é um status persistido — é derivado (ver seção 2)

  observacao,

  // Auditoria — mesmo padrão de employee-commands.js/rescission-commands.js
  version, createdAt, createdById, createdBy,
  updatedAt, updatedById, updatedBy,
  // aprovação
  approvedAt, approvedById, approvedBy,
  // cancelamento (mesmo padrão de isRescissionActive/isAdvanceActive)
  canceladoEm, canceladoPorId, canceladoPor, motivoCancelamento,
}
```

Decisões de modelo que valem justificar:

- **Congelar `periodoAquisitivo*`/`periodoConcessivoFim` no registro, em vez
  de derivar sempre de `employee.startDate`.** Isso é uma exceção
  deliberada ao princípio "não persistir o que dá para derivar" (usado em
  `employeeLifecycleStatus`). A razão: um funcionário pode ter **dois
  períodos aquisitivos fechados simultâneos** (ex.: nunca tirou férias em 2
  anos seguidos) e o sistema precisa saber a qual dos dois um pedido
  específico se refere. Se isso fosse só derivado de `startDate`, seria
  impossível registrar "gozei o período de 2024, ainda devo o de 2025" sem
  ambiguidade. O saldo de períodos em aberto (quantos períodos aquisitivos
  completos existem sem `FeriasRecord` com status `concluida` cobrindo-os)
  **esse sim é derivado**, nunca persistido — ver seção 2.
- **Sem campo de remuneração bruta do funcionário dentro do registro.**
  `dailyRate` já vive em `data.employees`; o registro de férias só guarda os
  valores monetários *calculados* (`valorAbono`, `valorTercoConstitucional`),
  no mesmo espírito de `rescisoes` guardar `totalLiquido` calculado em vez de
  reexpor `dailyRate`.

---

## 2. Derivação de "período aquisitivo atual" e "vencida?"

Novo arquivo `src/domains/rh/vacation-calculations.js` (paralelo a
`rescission-calculations.js`), 100% puro e testável, sem gravar nada. Segue
o mesmo padrão de `employeeLifecycleStatus`
(`src/domains/rh/employee-commands.js:17-23`): função pura, `referenceDate`
com default `new Date().toISOString().slice(0,10)`.

Funções sugeridas:

```js
// Lista todos os períodos aquisitivos já FECHADOS (12 meses completos desde
// a admissão ou desde o último aniversário de admissão) até referenceDate,
// cada um com { inicio, fimAquisitivo, fimConcessivo }. Não sabe nada sobre
// gozo — é geometria pura de datas a partir de employee.startDate, mesmo
// espírito de diffMeses/aniversarioAdmissao já usados em
// rescission-calculations.js:32-65 (reaproveitar essa lógica de aniversário,
// não reescrever um terceiro cálculo de "meses desde admissão").
acquisitivePeriodsUpTo(employee, referenceDate)

// Cruza os períodos fechados com data.ferias (registros com status
// "concluida" cujo periodoAquisitivoInicio bate) para achar quais períodos
// NÃO têm um FeriasRecord concluído cobrindo-os. Isso é o "saldo em aberto",
// deriva sempre, nunca persiste.
openAcquisitivePeriods(employee, feriasRecords, referenceDate)

// Para cada período aberto, classifica:
//  - "no_prazo"        : referenceDate <= fimAquisitivo (ainda acumulando)
//  - "concessivo"       : fimAquisitivo < referenceDate <= fimConcessivo (precisa agendar)
//  - "vencida"           : referenceDate > fimConcessivo (dobro por lei se não corrigido)
vacationStatusForPeriod(period, referenceDate)

// Agregado por funcionário, para a tela de lista (ver seção 4):
// { employeeId, periods: [...], mostUrgent: "vencida"|"concessivo"|"no_prazo"|null,
//   daysUntilConcessivoDeadline }
employeeVacationSummary(employee, feriasRecords, referenceDate)
```

Ponto de atenção deliberado: **`acquisitivePeriodsUpTo` deve reaproveitar a
mesma lógica de "aniversário de admissão mais recente" já escrita em
`rescission-calculations.js:60-63`** (`aniversarioAdmissao`), extraindo-a
para um utilitário compartilhado (ex. `src/domains/rh/date-anniversary.js`
ou movendo para `date-validation.js`) em vez de reimplementar uma segunda
versão do mesmo cálculo de data — os dois precisam concordar sempre, porque
o `avosFerias` da rescisão e o saldo de férias do novo módulo descrevem
literalmente a mesma régua de 12 meses.

---

## 3. Commands (novo `src/domains/rh/vacation-commands.js`)

Registrado em `OPERATIONAL_COMMAND` (`src/domains/sync/operational-commands.js:80-124`)
via spread, exatamente como `...RESCISSION_COMMAND`/`...EMPLOYEE_COMMAND`/
`...ADVANCE_COMMAND` hoje (linhas 102-104), e testado dentro de
`applyOperationalCommand` na mesma cadeia sequencial de `if (xResult) {...}`
(linhas 297-326) — inserir logo depois do bloco de `applyAdvanceCommand`
(linha 317-326), antes de `applyCompanyConfigCommand`.

```js
export const VACATION_COMMAND = Object.freeze({
  VACATION_REQUEST_CREATED:   "FERIAS_SOLICITADAS",
  VACATION_REQUEST_APPROVED:  "FERIAS_APROVADAS",
  VACATION_REQUEST_CANCELLED: "FERIAS_CANCELADAS",
  VACATION_GOZO_STARTED:      "FERIAS_GOZO_INICIADO",   // opcional no MVP, ver seção 6
  VACATION_GOZO_COMPLETED:    "FERIAS_GOZO_CONCLUIDO",
});
```

Payloads (seguindo literalmente a forma de `rescission-commands.js` —
`payload.rescission`/`payload.rescissionId`/`payload.reason`):

- **`VACATION_REQUEST_CREATED`** — `payload: { vacation: { id, empId,
  periodoAquisitivoInicio, dataInicioGozo, diasGozo, diasAbono, observacao } }`,
  `expectedVersion: 0`.
  Validações no command (mesmo estilo de `createRescission`, `fail(reason)`):
  - funcionário existe e está ativo (`employeeLifecycleStatus(employee) === "ativo"`,
    reaproveitando a função já existente em vez de reimplementar);
  - `periodoAquisitivoInicio` corresponde a um período retornado por
    `acquisitivePeriodsUpTo` para este funcionário (não deixa inventar
    período);
  - não existe já um `FeriasRecord` ativo (`pendente`/`aprovada`/`em_gozo`)
    cobrindo o mesmo `periodoAquisitivoInicio` para o mesmo funcionário —
    mesmo princípio do bloqueio de rescisão duplicada em
    `rescission-commands.js:75-77`;
  - `diasGozo + diasAbono <= 30`, `diasAbono <= 10` (CLT art. 143),
    `diasGozo >= 5` se não for venda total (regra simplificada de MVP, ver
    seção 6 sobre fracionamento);
  - datas de gozo não podem cair em período financeiro fechado se gerarem
    lançamento (reaproveitar `isDateInClosedPeriod`, mesmo padrão de
    `rescission-commands.js:96`), **só se a decisão da seção 5 for "sim,
    alimenta o DRE"**.

- **`VACATION_REQUEST_APPROVED`** — `payload: { vacationId, dataInicioGozo,
  diasGozo, diasAbono }`, `expectedVersion`. Calcula e congela
  `valorTercoConstitucional`/`valorAbono` neste momento (usa
  `employee.dailyRate` vigente na aprovação, não no momento da solicitação
  original, para refletir reajuste salarial recente).

- **`VACATION_REQUEST_CANCELLED`** — `payload: { vacationId, reason }`,
  mesmo padrão de `cancelRescission` (`rescission-commands.js:110-141`):
  exige `reason`, verifica `expectedVersion`, bloqueia cancelamento se já
  houver lançamento financeiro conciliado (reaproveitar o mesmo campo
  `transacaoId`/`reconciliationLinkId` se a seção 5 concluir que gera
  lançamento).

- **`VACATION_GOZO_STARTED`/`VACATION_GOZO_COMPLETED`** — transições de
  status simples por data (podem ser derivadas em vez de commands
  explícitos — ver seção 6, é candidato a corte de MVP).

Cada domínio de RH hoje expõe um `xCommandObraId(data, command)`
(`rescissionCommandObraId`, `employeeCommandObraId`, `advanceCommandObraId`)
— `vacation-commands.js` precisa do equivalente `vacationCommandObraId`.

---

## 4. Telas mínimas

Navegação: RH já tem 3 pontos de registro para uma aba nova (todos precisam
do mesmo id, ex. `"ferias"`), mesmo padrão usado para `"rh_indic"` em
20/08/2026 (**achado desta mesma rodada: existe um 4º ponto, `NAV_GROUPS`
em `LegacyApp.jsx:20193`, além dos 3 abaixo — não esquecer**):

1. `TAB_META` (grupo `rh_grp`) — adicionar
   `ferias: { label: "Férias", icon: "calendar", group: "rh_grp" }`.
2. `ACCESS_SECTORS`/`ROLE_TABS` — adicionar `["ferias","Férias"]` e liberar
   para os papéis `admin`/`rh`.
3. `NAV_GROUPS` (`rh_grp.tabs`) — adicionar `"ferias"` à lista, senão a aba
   fica autorizada mas não aparece na barra lateral.
4. Render condicional por `tab ===` — adicionar
   `{tab === "ferias" && <Suspense ...><FeriasView .../></Suspense>}`, com
   `const FeriasView = lazy(() => import("./domains/rh/components/FeriasView"));`
   no topo (mesmo padrão de `EquipeView`/`RescisaoView`/`IndicadoresView`).

Componente novo: `src/domains/rh/components/FeriasView.jsx`, extraído
*desde o início* como arquivo próprio (não escrito dentro de
`LegacyApp.jsx` e extraído depois) — este é um módulo novo, não uma
extração, então nasce fora do arquivo legado, mesmo padrão que
`IndicadoresView.jsx` já seguiu em 20/08/2026.

Duas visões dentro da mesma tela (like `FolhaView`'s `payrollView` toggle):

**Visão "Saldos" (lista, view principal):**
- Uma linha por funcionário ativo, com `employeeVacationSummary`;
- Coluna de status com `Badge` colorido: vencida (vermelho), em período
  concessivo com prazo curto (amarelo, ex. `daysUntilConcessivoDeadline <= 60`),
  no prazo (verde/neutro), em gozo agora (azul);
- Ordenação padrão: mais urgente primeiro;
- Ação rápida "Agendar férias" abre o formulário de solicitação
  pré-preenchido com o funcionário e o período aquisitivo mais urgente.

**Visão "Solicitação/Aprovação" (modal):**
- Seleção de funcionário (mesmo padrão de `selectEmp` em `RescisaoView.jsx:54-70`,
  incluindo herdar `obraId`);
- Seletor de qual período aquisitivo em aberto (lista vinda de
  `openAcquisitivePeriods`, mostrando os dois se houver dois);
- Datas de início/fim de gozo (fim calculado, não editável, a partir de
  `diasGozo`);
- Campo de dias de abono pecuniário (0-10), com aviso do valor calculado;
- Se `currentUser` tiver papel de aprovação, botão "Aprovar" separado de
  "Solicitar".

Alertas: **não precisa de tela dedicada de "central de alertas"** no MVP —
o próprio badge de urgência na lista de saldos já cobre o caso de uso. Uma
central de notificação cross-módulo não existe hoje em nenhum domínio do
projeto, então criar uma só para férias seria inconsistente com o resto do
sistema.

---

## 5. Abono pecuniário / 1/3 constitucional e o DRE

Leitura do precedente real (`src/domains/financeiro/ledger.js:533-544`):
rescisão vira um evento de **custo** (`effect:"cost", category:"rescisao"`)
construído dentro de `buildFinancialLedger`, direto de `data.rescisoes`,
sem passar por nenhuma tela. `calcVisaoFinanceira`/`calcDREObra` depois
somam por `category` (`sumCategory("rescisao")`,
`src/domains/dre/calculations.js:151`) para compor o DRE.
`scripts/check-financial-boundaries.mjs` garante que nenhuma tela
reimplemente essa soma na UI.

**Decisão recomendada: sim, o valor de abono pecuniário + 1/3 constitucional
deve alimentar o ledger — mas só quando o `FeriasRecord` chega a
`status:"aprovada"` (valor congelado) ou `"concluida"`, nunca em
`"pendente"`.** Mesmo espírito de rescisão: um pedido de férias ainda
pendente de aprovação não é um fato financeiro, é uma intenção.

Implementação equivalente a `ledger.js:533-544`:
```js
(data.ferias || []).filter(item => ["aprovada","em_gozo","concluida"].includes(item.status)).forEach(vacation => {
  const amount = Number(vacation.valorAbono||0) + Number(vacation.valorTercoConstitucional||0);
  if (amount <= 0) return; // férias só gozadas, sem abono, não é custo adicional (ver nota abaixo)
  add({
    id:`ferias:${vacation.id}:cost`, effect:"cost", amountCents: positiveCents(amount),
    date: vacation.dataInicioGozo, obraId: vacation.obraId||"",
    category:"ferias", description:"Férias (abono + 1/3 constitucional)",
    sourceType:"ferias", sourceId: vacation.id,
  });
});
```
E `sumCategory("ferias")` exposto em `calcDREObra`/`calcVisaoFinanceira` do
mesmo jeito que `rescTotal`, aparecendo como nova linha no DRE (paralela a
"Rescisões").

**Justificativa de por que só abono+1/3, e não o salário normal pago
durante o gozo:** o salário dos dias de férias *gozadas normalmente* já é
(ou deveria ser, ver risco no item 2 da seção 0) parte do custo de mão de
obra regular via `payroll.js`/attendance — lançá-lo de novo aqui duplicaria
o custo. O abono pecuniário e o 1/3 constitucional, ao contrário, são
**valores adicionais que não existem em nenhum outro lugar do sistema
hoje** — por isso, e só isso, precisa de um evento de custo novo.

Isso implica adicionar `"ferias"` à seção `financeiro`/`rh` de
`ROLE_SECTIONS` (`server/data-projection.js:14-21`) e escrever um
`sanitizeVacation` análogo a `sanitizeRescission`
(`server/data-projection.js:49-65`).

---

## 6. Recorte de MVP explícito

**Fatia 1 (MVP real, recomendação de por onde começar):**
- `data.ferias` + `vacation-commands.js` com só
  `VACATION_REQUEST_CREATED`/`VACATION_REQUEST_APPROVED`/`VACATION_REQUEST_CANCELLED`
  (sem `GOZO_STARTED`/`GOZO_COMPLETED` como commands — status
  `"em_gozo"`/`"concluida"` **derivados** por comparação de data);
- `vacation-calculations.js` com `acquisitivePeriodsUpTo`/
  `openAcquisitivePeriods`/`employeeVacationSummary`, testado isoladamente
  contra os mesmos casos de borda que `rescission-calculations.test.js` já
  cobre para avos;
- `FeriasView.jsx` só com a visão de lista de saldos + badge de urgência +
  modal de solicitação/aprovação;
- Integração com DRE (seção 5) incluída no MVP — sem ela o achado de
  compliance original continua parcialmente aberto do lado financeiro.
- **Sem integração com `attendance-engine.js`/`payroll.js`.** O dia de
  férias continua sendo marcado manualmente no Ponto como hoje (ou fica sem
  marcação, gerando o desconto indevido descrito na seção 0). O módulo de
  férias do MVP é uma **ferramenta de agendamento e compliance de prazo**,
  não uma correção completa do cálculo de folha durante o gozo — isso
  precisa ficar explícito para o usuário como limitação conhecida do dia 1.

**Fatia 2 (deliberadamente fora do MVP, para depois):**
- Novo status de ponto (`"FE"` ou similar) reconhecido por
  `isValidAttendanceStatus` e por `payroll.js` — mexe em dois arquivos
  usados por todo o resto do RH; merece decisão e revisão dedicada.
- Fracionamento de férias (até 3 períodos, um deles >= 14 dias, CLT art.
  134 §1º) — MVP assume gozo em período único.
- Cálculo automático de multa em dobro de férias vencidas dentro de
  `calculateRescission` — é um segundo blueprint, não uma tarefa incidental
  deste.
- Portal de autoatendimento do funcionário (lacuna #8 da auditoria).
- Central de alertas cross-módulo (não existe hoje para nada no sistema).
- Notificação por e-mail/push quando um período entra em concessivo.

---

## 7. Riscos e decisões que só o usuário pode tomar

1. **Dado histórico inexistente.** O sistema não tem hoje nenhum registro de
   férias já gozadas antes da existência deste módulo. No dia em que
   `data.ferias` nascer vazio, o cálculo de períodos em aberto vai gerar,
   para cada funcionário com mais de 12 meses de casa, alertas de "vencida"
   que na vida real já foram pagos/gozados fora do sistema — **uma tela
   cheia de alertas vermelhos falsos no primeiro dia**. Três saídas:
   - (a) Import inicial manual, por funcionário (trabalhoso, mas correto);
   - (b) "Data de corte": só considerar períodos que **começam** depois de
     uma data configurável (mais simples, recomendado, mas deixa um ponto
     cego real para férias vencidas acumuladas antes do corte);
   - (c) Aceitar o ruído inicial e o RH "silenciar" os falsos positivos um a
     um na primeira semana.
2. **Quem aprova férias hoje, na prática?** MVP proposto assume aprovação
   única pelo papel `rh`/`admin`. Um fluxo de duas etapas (gestor da obra +
   RH) é decisão de processo, não só de código, e muda o modelo de estado.
3. **Restrições de convenção coletiva sobre abono pecuniário** (comum em
   categoria de construção civil) não foram levantadas — o command validado
   aqui só verifica o limite genérico de 10 dias da CLT.
4. **Fracionamento fica fora do MVP — isso é aceitável?** Se for essencial
   desde o dia 1, o modelo de dado da seção 1 muda (um período aquisitivo
   pode ter *múltiplos* `FeriasRecord` ativos simultâneos) — vale confirmar
   antes de implementar a fatia 1, porque adicionar depois é migração de
   dado, não só feature nova.
5. **A integração com o DRE (seção 5) mexe em `ledger.js`**, arquivo
   compartilhado por todos os módulos financeiros e coberto por testes de
   regressão pesados — vale revisão dedicada de quem entende o motor de
   ledger, independente do resto do módulo.

---

## Arquivos referenciados nesta análise

- `docs/AUDITORIA_RH.md`
- `src/domains/rh/employee-commands.js:17-23` (`employeeLifecycleStatus`)
- `src/domains/rh/rescission-commands.js` (padrão de commands)
- `src/domains/rh/rescission-calculations.js:32-65` (cálculo de avos e
  aniversário de admissão, reaproveitável)
- `src/domains/rh/advance-commands.js` (padrão de parcelamento/datas)
- `src/domains/sync/operational-commands.js:80-124,186-326`
  (`OPERATIONAL_COMMAND`, `applyOperationalCommand`)
- `src/domains/financeiro/ledger.js:533-544` (evento de custo de rescisão
  no ledger)
- `src/domains/dre/calculations.js:125-151` (`sumCategory`)
- `server/data-projection.js:14-21,31-65` (`ROLE_SECTIONS`,
  `sanitizeEmployee`, `sanitizeRescission`)
- `scripts/check-financial-boundaries.mjs`
- `src/domains/ponto/attendance-engine.js:287` (`isValidAttendanceStatus`)
- `src/domains/ponto/payroll.js:13` (fator de dia pago)
- `src/domains/rh/components/EquipeView.jsx`,
  `src/domains/rh/components/RescisaoView.jsx`,
  `src/domains/rh/components/IndicadoresView.jsx` (padrão de tela extraída)
- `src/LegacyApp.jsx` (registro de navegação RH: `TAB_META`,
  `ACCESS_SECTORS`, `ROLE_TABS`, `NAV_GROUPS`)
