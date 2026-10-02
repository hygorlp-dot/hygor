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

- `src/domains/equipamentos/rental-operations.js` — domínio puro (sem React): período, situação, cobrança, filtros, ordenação, agrupamento, KPIs, ações e permissões.
- `src/domains/equipamentos/components/RentalOperationsPanel.jsx` — a aba.
- `components/RentalRowMenu.jsx`, `RentalDetailDrawer.jsx`, `RentalPills.jsx`, `rental-operations.css`.
- `EquipamentosView.jsx` — o bloco antigo foi substituído; `executarAcaoLocacao` liga cada ação aos **mesmos** modais e comandos de antes.
- Testes: `rental-operations.test.js` (40), `RentalOperationsPanel.test.jsx` (32), `server/rental-action-permissions.test.js`, `e2e/equipment-rentals.spec.js`; `e2e/modules-smoke.spec.js` migrado para o fluxo novo.

## Como cada coisa funciona

**Período.** `Hoje`, `Esta semana` (segunda a domingo), `Este mês`, `Mês anterior`, `Últimos 30 dias`, `Personalizado`, `Todo o período` (acrescentado: sem ele não há como achar uma locação antiga sem digitar datas). "Este mês"/"Mês anterior" são o mesmo preset mensal com outro mês, por isso ‹ › funcionam a partir de qualquer um. Uma locação entra se tiver ao menos 1 dia dentro da janela (`diasLocacaoNoPeriodo`, a função que já alimenta os relatórios).

**Situação** (texto + ícone + tom): *cancelada* = `status:"cancelada"`; *programada* = início depois de hoje; *encerrada* = `fim` já vencido; *em andamento* = o resto (inclui contrato com término futuro). O ciclo de vida (`lifecycleState`) continua aparecendo como detalhe ("Ciclo · Ativa"). A aba abre em **Em andamento**; as contagens de cada aba refletem período + filtros.

**Cobrança** (derivada só de registros existentes): *Pendente* (fatura com saldo e nenhum recebimento), *Parcial* (saldo com recebimento parcial), *A faturar* (linhas abertas/medidas sem fatura), *Sem medição* (sem linhas nem faturas), *Em dia* (tudo recebido), *Encerrada* (quitada em locação encerrada, ou locação excluída).

**Indicadores** (do contexto atual, todas as situações; cada cartão diz seu escopo — ex. "Setembro 2026 · K1-04 — Terras Alpha"):
- *Equipamentos locados*: pico de unidades simultâneas no período (+ nº de equipamentos e locações).
- *Taxa de ocupação*: unidades-dia locadas ÷ unidades-dia da frota no escopo (limitado a 1 por unidade/dia). Filtros de proprietário/categoria restringem a frota; obra e busca só restringem o numerador.
- *Receita no período*: soma de `cobrancaLocacao(...).liquido` dos dias no período — **idêntica a `calcEquipamentosMes`** (teste compara os dois).
- *A receber*: soma de `openAmountCents` das faturas + valor medido a faturar.
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

Ver `.impeccable/critique/2026-10-02T18-30-00Z__src-domains-equipamentos-components-rentaloperationspanel-jsx.md`: **31/40**, P0 = 0, P1 = 1 (justificado: as duas bases de valor acima), P2 = 5, P3 = 3. Achados da crítica de 17/08/2026 tratados nesta aba: ações em excesso por linha, `danger` competindo com ações comuns, bordas decorativas de 3px (`.equipment-record::before` não é mais usado aqui), tamanhos de fonte soltos (agora só tokens `--arcd-type-*`), estado só por cor, cartões repetidos, grade sem hierarquia.
