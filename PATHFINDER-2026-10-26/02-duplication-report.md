# Fase 2 · Relatório de duplicação (Compras e Suprimentos)

Cada duplicação abaixo tem pelo menos duas âncoras `arquivo:linha`, tiradas dos relatórios da Fase 1 (`01-flowcharts/*`) e conferidas por leitura. As marcadas **[executado]** foram comprovadas por teste (`src/domains/compras/fluxo-compra-ponta-a-ponta*.test.js`).

Nota de método: a skill pede dois subagentes de duplicação; como os 14 subagentes da Fase 1 já entregaram as listas com linhas, a consolidação foi feita pelo orquestrador a partir delas, sem novo fan-out (o limite de uso da conta já foi atingido uma vez nesta sessão).

## D1 · "Comprometido" tem ao menos cinco definições
- Mapa gerencial, bruto, com rascunho: `src/domains/compras/calculations.js:107,110`.
- Orçado × comprado, bruto, sem rascunho, por `p.status` gravado: `src/domains/compras/budget-tracking.js:15,65-71`.
- Compras por obra: Σ linhas + `semApropriacao` com controle, ou `totalPedido` filtrado por `statusPedido` sem controle: `src/domains/compras/by-work.js:44-46`.
- Detalhe da obra, com rascunho: `src/LegacyApp.jsx:11647-11652,11801,12939`.
- DRE/razão, líquido da NF, com data do pedido: `src/domains/financeiro/ledger.js:262-278` e `src/domains/dre/calculations.js:123,158`. **[executado]** (o abatimento leva a data do pedido: `fluxo-compra-ponta-a-ponta.test.js`, S5).
- Consequência: a mesma obra mostra números diferentes por tela. Nenhum indicador do F11 usa `notasFiscais`.

## D2 · "A pagar" tem quatro implementações
- `src/domains/compras/calculations.js:113` (inclui rascunho), `src/domains/compras/components/ComprasView.jsx:915` (exclui rascunho e cancelado), `src/domains/compras/by-work.js:56` (exclui rascunho), `src/LegacyApp.jsx:11817` (inclui rascunho).
- Dentro do mesmo cartão do Mapa, o valor inclui rascunho e a legenda não (`calculations.js:113-114,155`).

## D3 · Soma de pagamentos por origem em cinco lugares, com e sem `active`
- Com `active`: `src/domains/compras/calculations.js:146-150`.
- Sem `active` (estorno soma): `src/LegacyApp.jsx:11803-11806`, `src/domains/compras/components/ComprasView.jsx:914-920` e `:2269,2276-2278`.
- "Por quem pagou" agrupa o valor total do pedido pela origem declarada, não pelos pagamentos: `ComprasView.jsx:933-940,2128`.

## D4 · Status do pedido: gravado × derivado
- Gravado: `budget-tracking.js:65,68-69`, `calculations.js:107,114`, `ledger.js:262-264`, `supplier-acceptance-link.js:64-67`, `supply-contracts.js:20`.
- Derivado: `workspace.js:64-66`, `by-work.js:37,55-56`, `calculations.js:124,154,157`, `ComprasView.jsx:898-900,1002,2077`, `LegacyApp.jsx:12633`.
- `parcial` e `recebido` nunca são gravados (`operational-commands.js:820-823`); um pedido recebido por inteiro continua `enviado` e ainda aceita link de aceite. **[executado]** (`fluxo-compra-ponta-a-ponta.test.js`).

## D5 · Duas "curvas ABC" e uma terceira de estoque
- `src/domains/suprimentos/calculations.js:119-135` (motor com snapshot e aprovação, `before < limiteA`).
- `src/LegacyApp.jsx:11706-11794` (`calcCurvaMateriais`, `pct <= 80`).
- `src/domains/orcamentos/components/OrcamentoView.jsx:2019-2109` e `src/domains/estoque/calculations.js:80-99,110-137`.
- Duas leituras de "quando comprar": 21/14/7 dias fixos (`LegacyApp.jsx:11697,11756`) × lead time por perfil (`suprimentos/calculations.js:159`).

## D6 · Duas cotações
- Cotação de compra (comando, liga a pedido): `src/domains/compras/purchase-order-commands.js:409-443`, coleção `data.cotacoes` (`ComprasView.jsx:943,981`).
- Cotação de material da tela "Cotações" (escrita direta, não liga a nada): `src/LegacyApp.jsx:11921,11962`, coleção `data.cotacoesMaterial` (`LegacyApp.jsx:2692`), seção sem papel em `server/section-authorizations.js:4-34`.

## D7 · Duas "notas" de fornecedor (0-10 e 0-100)
- `src/domains/compras/supplier-rating.js:23-44` (50/30/20, mostrada no mapa de cotação, `ComprasView.jsx:2645,2791`).
- `src/LegacyApp.jsx:12192-12265,12305` (35/15/25/25, tela Fornecedores).

## D8 · Dois caminhos de recebimento na UI para o mesmo comando
- `src/domains/compras/components/ComprasView.jsx:1547-1595` (parcial, com proteção de clique duplo) e `src/LegacyApp.jsx:12850-12891` ("Chegou", sempre o saldo, sem proteção, rótulo de unidade trocado em `:13234,13239`).
- Mesmo reducer: `src/domains/sync/operational-commands.js:786-839`.

## D9 · Dois caminhos de pagamento na UI e um terceiro pelo extrato
- `ComprasView.jsx:1425-1477` (aceita adiantamento) e `LegacyApp.jsx:5445-5482` (Central de pagamentos, não envia adiantamento, texto "pagamento antecipado" enganoso).
- Extrato: `src/domains/conciliacao/mutations.js:81-161` grava `origem:"banco"`, fora do enum de `payable-payment-commands.js:27`, e espelha a NF no pedido sem teto nem `notaFiscalId` (`mutations.js:148-152` × `payable-payment-commands.js:171-180`).

## D10 · Normalização de origem do pagamento diverge entre coleções
- `src/LegacyApp.jsx:2417` (qualquer origem fora de `cliente_direto`/`empresa` vira `caixa_obra`, inclusive `banco`) × `src/LegacyApp.jsx:2448` (default inverso, `empresa`).

## D11 · Duas leituras de "disponível em estoque" e de "pedido aberto"
- `src/domains/suprimentos/calculations.js:8,145-157` × `src/domains/estoque/calculations.js:9,11,15-22` (listas de status diferentes; rascunho conta como pedido aberto em F13).

## D12 · Dois mecanismos de numeração
- Servidor numera só se vier vazio: `purchase-request-commands.js:51-52`, `purchase-order-commands.js:186-187`.
- Cliente envia número pronto: `EstoqueView.jsx:195` (`SC-${length+1}`), `LegacyApp.jsx:5225` (`PC-IA-${length+1}`, fora do regex de `calculations.js:25`).

## D13 · Pedido tratado como valor por função × como propriedade
- Função `totalPedido(pedido)`: `src/domains/compras/calculations.js:35` (usada em ~20 pontos).
- Propriedade inexistente `p.totalPedido`: `src/domains/conciliacao/selectors.js:98` e `src/domains/conciliacao/matching.js:176`. **[executado]** (o pedido é indexado com saldo zero, não aparece por valor).

## D14 · Fonte de verdade do DRE de compras fragmentada
- DRE servido = razão derivado do blob + títulos nativos: `server/financial-dre-integration.js:34`, `api/data.js:2637-2715`.
- Fatos canônicos de compras (`financial_titles`, `settlements`) só servem de sombra: `server/procurement-financial-facts.js:5-71`, e `LEGACY_FINANCIAL_FACT_FIELDS` não inclui `notasFiscais` nem `caixaObra` (`api/data.js:932-934`).
- Espelhos `purchase_requests`/`core_quotations`/`core_purchase_orders`: só com `POSTGRES_URL_NON_POOLING` (`api/data.js:2197-2210` × `:2275-2292`).
- Código morto: `calcObraComprasCost`/`purchases` (`server/dre-projection.js:59-61,88`; não desestruturado em `src/domains/dre/calculations.js:56-64`).

## D15 · Escritas diretas ao lado dos comandos (cadeia sem validação)
- `validateProcurementChain` só em `save`/`save-sections`: `api/data.js:2875-2878,2945-2948,3049-3052`; o caminho `operational-command` (`api/data.js:2183-2301`) não a roda.
- `update()` direto: `ComprasView.jsx:1256-1260,1283-1294`, `EstoqueView.jsx:201`, `MarcosCurvaASuprimentos.jsx:44,50,62`, `LegacyApp.jsx:11962,14478,14490`.

## D16 · Duas regras de filtro "ativo" para NF/cotação no portal e na avaliação
- Portal: `server/client-portal-publication.js:7,210` (só masculino + `rejeitada`).
- Razão e comando: `src/domains/financeiro/ledger.js:15-21` e `invoice-commands.js:26-28` (feminino e masculino).
- Avaliação do fornecedor: `supplier-rating.js:31` (sem `rejeitada`/`estornado`).

## D17 · Histórico de preço em escala diferente do custo
- `calculations.js:62-102` (preço na unidade de compra, sem fator) × `operational-commands.js:825-836` (`precoMedio` na unidade canônica). **[executado]** para a ordenação (`analisePreco` com lista crescente devolve o mais antigo como "último": `ComprasView.jsx:1085-1088` × `calculations.js:99`).
