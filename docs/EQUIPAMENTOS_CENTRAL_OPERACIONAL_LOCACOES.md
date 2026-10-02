# Central operacional de locações (aba "Locações")

Rodada de 02/10/2026 sobre a aba **Locações** da Central de locação de
equipamentos (`src/domains/equipamentos/components/EquipamentosView.jsx`).
Escopo: arquitetura da informação, UI/UX, filtros e organização operacional.
**Nenhuma regra financeira, cálculo, contrato de locação, competência,
medição ou persistência foi alterada** — a tela só reorganiza o que já existe.

## Antes e depois

| | Antes | Depois |
|---|---|---|
| Estrutura | cabeçalho + 4 KPIs fixos da frota + bloco "Histórico de locações" + aviso azul + lista vertical de cartões | **contexto** (período, obra, cobrança, busca) → **indicadores** → **navegação por situação** → **tabela** |
| Período | texto "Setembro 2026" sem efeito | filtro funcional (atalhos, ‹ ›, personalizado, todo o período) que controla KPIs, contagens, lista e valores |
| Obra | só o código | filtro por obra, rótulo "K1-04 — Terras Alpha"; obra é coluna protagonista |
| Ações por linha | até 12 botões `ghost` + "Excluir" `danger` | 1 ação principal ("Medir competência", só em andamento) + menu `⋯`; exclusão isolada no fim do menu |
| Detalhe | inexistente | painel lateral (equipamento, obra, período, tarifa/valores, cobranças, faturas, histórico, ações) |
| Aviso de cobrança por ciclo | caixa azul de destaque | linha discreta recolhida ("Saiba mais") |
| Vazio | um único estado | 3 estados distintos: sem locações, filtro sem resultado, erro (+ carregando) |

## Arquivos

- `src/domains/equipamentos/rental-period.js` — calendário e resolução dos atalhos de período (puro).
- `src/domains/equipamentos/rental-operations.js` — linhas, situação, cobrança, filtros, ordenação, agrupamento, KPIs e o **modelo de tela** (chips, escopo, resultados paginados, textos de célula).
- `src/domains/equipamentos/rental-actions.js` — ações por locação, permissões, nota de ciclo e histórico.
- `src/domains/equipamentos/rental-command-roles.js` — papéis dos 11 comandos de locação: **fonte única**, usada por `api/data.js` (`OPERATIONAL_COMMAND_ROLES`) e pela tela.
- `src/domains/equipamentos/components/RentalOperationsPanel.jsx` — a aba.
- `components/RentalRowMenu.jsx`, `RentalDetailDrawer.jsx`, `RentalPills.jsx`, `rental-operations.css`.
- `EquipamentosView.jsx` — o bloco antigo foi substituído; `executarAcaoLocacao` liga cada ação aos **mesmos** modais e comandos de antes.
- Testes: `rental-period.test.js`, `rental-operations.test.js`, `rental-actions.test.js`, `RentalOperationsPanel.test.jsx`, `server/rental-action-permissions.test.js` (tela × servidor por ação, papel e obra), `e2e/equipment-rentals.spec.js`; `e2e/modules-smoke.spec.js` migrado para o fluxo novo.

## Como cada coisa funciona

**Período.** `Hoje`, `Esta semana` (segunda a domingo), `Este mês`, `Mês anterior`, `Últimos 30 dias`, `Personalizado`, `Todo o período` (acrescentado: sem ele não há como achar uma locação antiga sem digitar datas). "Este mês"/"Mês anterior" são o mesmo preset mensal com outro mês, por isso ‹ › funcionam a partir de qualquer um. Uma locação entra se tiver ao menos 1 dia dentro da janela (`diasLocacaoNoPeriodo`, a função que já alimenta os relatórios).

**Situação** (texto + ícone + tom): *cancelada* = `status:"cancelada"`; *programada* = início depois de hoje; *encerrada* = `fim` já vencido; *em andamento* = o resto (inclui contrato com término futuro). O ciclo de vida (`lifecycleState`) continua aparecendo como detalhe ("Ciclo · Ativa"). A aba abre em **Em andamento**; as contagens de cada aba refletem período + filtros.

**Cobrança** (coluna "Situação da cobrança", derivada só de registros existentes): *Pendente* (fatura com saldo e nenhum recebimento), *Parcial* (saldo com recebimento parcial), *A faturar* (linhas abertas/medidas sem fatura), *Sem medição* (sem linhas nem faturas), *Em dia* (tudo recebido), *Ciclo encerrado* (quitada em locação encerrada, ou locação excluída — nada mais a cobrar). A coluna "Situação da locação" usa *Em andamento / Programada / Encerrada / Cancelada*; um teste impede que as duas colunas voltem a ter rótulos iguais.

**Indicadores** (do contexto atual, todas as situações; cada cartão diz seu escopo — ex. "Setembro 2026 · K1-04 — Terras Alpha"):
- *Equipamentos locados*: pico de unidades simultâneas no período (+ nº de equipamentos e locações).
- *Taxa de ocupação*: unidades-dia locadas ÷ unidades-dia da frota no escopo (limitado a 1 por unidade/dia). Filtros de proprietário/categoria restringem a frota; obra e busca só restringem o numerador.
- *Receita contratual no período* ("Conforme tarifas das locações"): soma de `cobrancaLocacao(...).liquido` dos dias no período — **idêntica a `calcEquipamentosMes`** (teste compara os dois). Não depende de medição nem de fatura.
- *Faturas a receber* ("N faturas pendentes · Controle interno, ainda fora do DRE"): soma de `openAmountCents` das faturas emitidas das locações do recorte; o valor medido e ainda não faturado aparece separado, na nota. Não é a mesma grandeza do cartão anterior.
- Os quatro indicadores valem para o recorte (período + filtros) **em todas as situações** — a legenda diz isso ("Setembro 2026 · K1-04 — Terras Alpha · todas as situações"); a situação escolhida muda só a lista, e o resumo acima da tabela diz qual ("3 locações em andamento").
- *Livres no pico do período* (secundário): mesma conta do antigo "Livres no mês" (`disponibilidadeNoDia`); só para períodos de até ~3 meses.
- Os 4 KPIs fixos da frota (`Frota ativa`…) deixam de aparecer no cabeçalho **nesta aba** (continuam nas demais).

**Tabela.** Colunas: Equipamento (+ patrimônio, quantidade, proprietário), Obra (nome + código), Período (`01/09/26 → 30/09/26` + duração, previsto e "Vence em N dias"), Situação, Valor no período (+ composição de tarifa), Cobrança (+ saldo/medido), Proprietário, Ações. Ordenação por equipamento, obra, início, fim, valor, situação e cobrança, com `aria-sort`. Padrão por aba: histórico = mais recentes primeiro; em andamento = quem vence primeiro; programadas = a que entra primeiro. Agrupar por obra, equipamento, proprietário, situação ou mês de início (cabeçalho de grupo com contagem e total do período, do grupo inteiro). Paginação de 25 por página; filtrar volta à primeira página. Colunas secundárias saem conforme a largura **do painel** (container query): Proprietário ≤ 1200px, Período ≤ 1060px (passa a aparecer sob a obra), layout empilhado ≤ 640px.

**Ações e permissões.** As condições de cada ação são exatamente as da lista antiga (movidas para `rentalRowActions`). A tela só oferece o que o servidor aceitaria: `RENTAL_ACTION_ROLES` espelha `OPERATIONAL_COMMAND_ROLES` (contrato: admin/engenheiro/engenheiro_auditor/financeiro; cobrança: admin/financeiro) e, para perfil vinculado a obra, só a própria obra. `server/rental-action-permissions.test.js` impede o espelho de divergir do servidor. Perfil sem permissão vê só "Abrir detalhes".

## Decisões e desvios do pedido (para conferência)

1. **Sem dropdown de situação.** O pedido lista "Situação" como filtro e também como abas internas, mas proíbe dropdown + pills com a mesma função. Ficou só o controle segmentado, com um quinto segmento **Canceladas** (as locações excluídas continuam no histórico, como antes).
2. **Chip de situação** aparece quando ≠ "Em andamento" (como no exemplo do pedido); "Limpar filtros" devolve período (mês atual), filtros e situação ao padrão.
3. **Competência padrão de "Adicionar cobrança"** passa a ser o mês do período em exibição (antes: o mês global da central). É só o valor inicial do campo.
4. **"Medir competência" como ação principal** só em locações em andamento (nas encerradas seria ruído). A competência sugerida pelo modal de medição continua sendo a do início da locação (comportamento preservado).
5. A contagem na aba principal "Locações" continua sendo o total de registros (inclui canceladas), como antes.

## Pendências e regras ambíguas preservadas (não alteradas)

- **Duas bases de valor na mesma tela.** "Receita no período" vem do contrato (tarifa × dias); "A receber" vem de faturas/medições, que **ainda não alimentam o DRE** (docs/EQUIPAMENTOS_FASE_5_COBRANCA.md). O aviso recolhido e as notas dos cartões explicam, mas a integração é decisão de produto.
- **Situação × ações de ciclo de vida.** A situação usa datas; as ações de ciclo continuam usando "sem `fim`" (`emAberto`) como antes. Uma locação com `fim` futuro aparece "Em andamento" mas sem ações de ciclo — comportamento legado, não mexido.
- **Erro/carregando**: os dados de locação já estão em memória quando a aba abre; os estados existem (e são testados), mas hoje só dispara erro se os dados vierem malformados. Não há requisição própria para "tentar novamente".
- **Ordenação em telas < 640px**: o cabeçalho some no layout empilhado, então não há como reordenar no celular (fora do escopo pedido: desktop/notebook/tablet).
- **Histórico no detalhe** reúne só o que a locação já guarda (ciclo, checklists, aditivos, trocas, encerramento/exclusão); não lê `audit_events`.
- Sem virtualização: a paginação cobre o volume atual (~145) e o crescimento esperado.

## Revisão Impeccable

Ver `.impeccable/critique/2026-10-02T18-30-00Z__src-domains-equipamentos-components-rentaloperationspanel-jsx.md`: 1ª passada **31/40** (P0 0 · P1 1 · P2 5 · P3 3); 2ª passada, após o fechamento, **32/40** (P0 0 · P1 0 · P2 4 · P3 4) — o P1 das duas bases de valor caiu para P2 porque cada indicador passou a dizer a origem do número; a lacuna de produto (cobrança por ciclo fora do DRE) continua. Achados da crítica de 17/08/2026 tratados nesta aba: ações em excesso por linha, `danger` competindo com ações comuns, bordas decorativas de 3px (`.equipment-record::before` não é mais usado aqui), tamanhos de fonte soltos (agora só tokens `--arcd-type-*`), estado só por cor, cartões repetidos, grade sem hierarquia.

## Rodada de fechamento (02/10/2026)

Sem redesenho, sem regra financeira nova, sem mudança de contrato, competência ou persistência.

**Nomenclatura**

| Antes | Depois | Origem do dado |
|---|---|---|
| Receita no período | Receita contratual no período · "Conforme tarifas das locações" | `cobrancaLocacao` (tarifa × dias no período) |
| A receber · "N locação(ões) com saldo" | Faturas a receber · "N faturas pendentes · Controle interno, ainda fora do DRE" | `rentalInvoices.openAmountCents` |
| Situação / Cobrança (colunas) | Situação da locação / Situação da cobrança | — |
| Cobrança "Encerrada" | Cobrança "Ciclo encerrado" | mesmo estado, só o rótulo |
| (nada) | "Ciclo indisponível — término programado em dd/mm/aaaa" | locação em andamento com `fim` já preenchido |

**"Em andamento" sem ação de ciclo.** A regra legada continua: ações de ciclo (avançar, aditivo, substituir, encerrar) só existem para locação sem `fim`. Quando a data diz "em andamento" mas o término já foi programado, a linha, o menu e o detalhe dizem o motivo, como texto secundário (não alerta). Só aparece para quem operaria o contrato. A cobrança (medir, adicionar, faturar) continua disponível, como já era.

**Revisão estrutural.** `rental-operations.js` foi separado por responsabilidade real, não por tamanho: período (sem dependências), ações/permissões (dependem do ciclo de vida e dos papéis) e recorte de dados. Saíram do componente para o domínio: ordenação padrão (estava duplicada), próximo estado de ordenação, montagem e remoção de chips, legenda de escopo, agrupamento + paginação com cabeçalhos de grupo, e os textos de período, vencimento, valor e cobrança (antes repetidos na linha e no detalhe). O componente agora guarda um único objeto de estado e desenha o que o domínio devolve.

**Permissões sem cópia manual.** O espelho `RENTAL_ACTION_ROLES` foi removido: os papéis dos 11 comandos de locação moram em `rental-command-roles.js`, e `api/data.js` monta `OPERATIONAL_COMMAND_ROLES` a partir dele (valores idênticos — os 124 testes de autorização por comando seguem passando). Cada ação da tela carrega o comando que dispara; `server/rental-action-permissions.test.js` compara tela e servidor (papel + escopo de obra) para toda ação, papel e obra, e garante que toda ação visível é aceita pelo servidor.

**Outros ajustes**: "Fim" ordena por término (data de fim ou término planejado) e é o padrão de "Em andamento" — antes o padrão não correspondia a nenhum cabeçalho; locação programada em "Todo o período" mostra "—  inicia em dd/mm" em vez do valor de uma diária; o menu acompanha o botão na rolagem (e só fecha se o botão sair da tela); o foco volta ao nome do equipamento ao fechar o detalhe; o alerta de prazo acompanha o período quando a coluna some; cabeçalhos quebram linha em vez de alargar a tabela.

**Valores e rastreabilidade**: "Receita contratual" (`cobrancaLocacao`, = `calcEquipamentosMes`), "Valor no período" da linha (a mesma conta por locação), "Contratual acumulado" do detalhe (a mesma conta de início até hoje/fim — era o número da lista antiga), "Faturas a receber" (`openAmountCents`), "medido, sem fatura" (`netAmountCents` das linhas abertas/medidas), "Livres" (`disponibilidadeNoDia`, = antigo "Livres no mês"). Nenhuma fórmula nova.
