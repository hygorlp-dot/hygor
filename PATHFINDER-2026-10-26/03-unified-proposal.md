# Fase 3 · Proposta unificada (Compras e Suprimentos)

Base: `01-flowcharts/*` (14 funcionalidades + visão ponta a ponta), `02-duplication-report.md` e a execução dos redutores reais (`src/domains/compras/fluxo-compra-ponta-a-ponta*.test.js`). Respeita o `CLAUDE.md`: regra de negócio decidida pelo responsável não muda sem pedido explícito; nada destrutivo; nenhuma informação é apagada para "arrumar" dado.

## 1. O fluxo de uma compra de obra, como ele é hoje (verificado)

Solicitação → aprovação (alçada R$ 5.000) → cotação (mínimo 2 propostas, justificativa se não for a mais barata) → pedido → envio/aceite (link assinado) → recebimento (estoque) → NF (custo no DRE ao salvar) → aprovação da NF → pagamento (conferido ou adiantamento) → extrato (conciliação) → DRE / razão → portal do cliente.

Cada elo grava por **comando versionado** (`applyOperationalCommand`), exceto suprimentos, cotação de material e três ações da solicitação, que ainda usam `update()` direto.

### Vinculações pedidas pelo usuário — situação verificada

| Vinculação | Como está | Veredito |
|---|---|---|
| **DRE** | Pedido = só compromisso (líquido da NF). **Custo nasce na NF ao ser salva** (status `recebida`), antes da aprovação; competência = emissão. Pagamento = caixa. Pagamento de pedido sem NF = caixa "não alocado", sem custo. Executado: nota de R$ 5.080 sobre pedido de R$ 3.500 com 60% recebido vira R$ 5.080 de custo no ato. | Funciona e é coerente, com 4 pontos fracos: custo antes de aprovar, sem rejeição de NF, dois "comprometidos", `cliente_direto` contado como saída de caixa. |
| **Extrato bancário** | Importa OFX/CSV; candidatos por valor/documento/PIX/nome. A NF é candidata; **o pedido é invisível** (índice lê campo inexistente). Conciliação cria pagamento com `origem:"banco"`, fora do enum, e copia a NF no pedido sem teto. | Parcialmente quebrado (1 bug certo, 2 lacunas). |
| **Transparência ao cliente** | Portal publica pedidos, cotações, NFs e caixa da obra por flags. Filtro de status só no masculino; pedido recebido aparece "enviado"; unidade/quantidade na unidade de compra; descrição do caixa expõe número do pedido e fornecedor. | Lacunas de segurança/clareza, nenhuma de cálculo. |
| **Escolha do fornecedor** | Mapa com ≥2 propostas, justificativa fora do mais barato, nota 0-10 **só informativa**. Nota depende de `fornecedorId` que NF manual/IA/XML sem CNPJ não tem. Fornecedor sem inativação real, sem documentos/dados bancários. | Funciona; a decisão não usa o histórico. |

## 2. Decisões que são suas (não implementar sem resposta)

Cada uma muda regra de negócio ou número do DRE. Deixo a recomendação.

| # | Decisão | Recomendação | Impacto |
|---|---|---|---|
| D-A | NF **salva** já é custo, ou só a NF **aprovada**? (S6) | Manter como está (competência pela emissão é o desejado) e **criar o comando "Rejeitar/Cancelar NF"** com motivo, que hoje não existe. | Hoje uma NF errada fica no DRE até alguém editar por fora. |
| D-B | Qual é "o comprometido" oficial? (S5) | Definir **um** motor em `src/domains/compras/` (bruto do pedido vivo, sem rascunho) e um segundo número explícito "a faturar" = pedido − NF. Eliminar as cinco cópias. | Muda números exibidos em 4 telas. |
| D-C | Pagamento `cliente_direto` entra no caixa da empresa? | **Não**: manter a baixa da obrigação (`payable_decrease`), mas sem `cash_out` da empresa, com evento próprio `third_party_payment` visível. | Muda `saidasCaixa`/`saldoCaixa`; exige `DRE_PROJECTION_VERSION` e guardião do DRE. |
| D-D | Rascunho de pedido consome saldo de contrato / entra no "aberto" de suprimentos? | Não. | Muda saldo de contrato. |
| D-E | `CONFIRM_ALLOCATION` sem vínculo a documento: permitir duplicidade com a NF que chegar depois? | Avisar na conciliação quando houver NF/pedido de valor igual do mesmo fornecedor. | Só aviso. |
| D-F | Estornar entrada de estoque de um pedido deve reabrir o recebimento? | Sim: estorno de entrada **vinculada a pedido** passa pelo comando de recebimento (reverte `qtdRecebida`), nunca por `MOVIMENTO_ESTOQUE_ESTORNADO` solto. | Novo comando; toca estoque e preço médio. |
| D-G | A curva ABC do orçamento (A1: pipeline vazio) é a fonte da F13? | Sim: dar adaptador ao motor, em vez de manter três curvas. | Escopo médio, módulo isolado. |

## 3. Correções sem decisão de negócio (implementar já)

Todas com teste que **falha antes** da correção (`CLAUDE.md` §5), uma branch nova por assunto a partir de `origin/main`.

| Ordem | Correção | Evidência | Risco |
|---|---|---|---|
| C1 | **S1** — status inicial da solicitação gravado como `enviada` (o que a UI e todos os consumidores esperam) | `purchase-request-commands.js:82`; teste de execução falha com `aberta`; produção tem 0 `aberta` e 2 `enviada` (provável regravação da UI por cima do comando) | Baixo; sem dado `aberta` em produção. |
| C2 | **Extrato** — pedido volta a ser candidato (usar `totalPedido(p)` e conversão por item) | `selectors.js:98`, `matching.js:176`; teste de execução falha | Baixo; só amplia candidatos, nada é aplicado sem ação do usuário. |
| C3 | **H-A** — "último preço" da aba Preços deixa de depender da ordem da lista | `calculations.js:99` × `ComprasView.jsx:1085-1088` | Baixo; função pura. |
| C4 | **Portal (S2/S3/S19)** — status feminino no filtro, `clientStatus` do pedido derivado do recebimento, quantidade/preço na unidade de referência | `client-portal-publication.js:7,210,241-255` | Médio-baixo; muda o que o cliente vê, só para melhor. |
| C5 | **S18** — NF herda `fornecedorId` do pedido quando vem em branco (sem sobrescrever o que existir); filtro de avaliação inclui `rejeitada`/`estornado`; XML que não casa CNPJ não apaga `fornecedorId` existente | `invoice-commands.js:117`, `supplier-rating.js:31`, `LegacyApp.jsx:5269` | Baixo. |
| C6 | **`ativo`** do fornecedor deixa de ser forçado a `true` ao salvar | `ComprasView.jsx:1098`, `LegacyApp.jsx:14488` | Baixo. |
| C7 | **S8** — `banco` passa a ser origem válida e visível ("Banco/extrato"); espelho nota→pedido com teto de saldo e `notaFiscalId` | `mutations.js:128,148-152`, `LegacyApp.jsx:2417` | Médio (toca conciliação); precisa PGlite/teste de comando. |
| C8 | **"Chegou"** — rótulo na unidade de compra, trava de clique duplo | `LegacyApp.jsx:13234,13239,12850` | Baixo. |
| C9 | **Recebimento** — impedir estorno solto de entrada vinculada a pedido enquanto D-F não é decidido (mensagem orienta o caminho certo) | `estoque/commands.js:84-99` | Baixo; só bloqueia um beco sem saída. |
| C10 | **A2/A5 da solicitação** — cancelar a solicitação cancela a instância de aprovação pendente; fallback de admin respeita autoaprovação | `purchase-request-commands.js:141`, `engine.js:93,115` | Médio; toca o motor de aprovações. |

## 4. Arquitetura-alvo (o que unifica o resto)

1. **Um módulo de leitura da compra** (`src/domains/compras/purchase-position.js`): para cada pedido devolve `{ comprometido, recebido, faturado, pago, aPagar, aReceber, atrasado }` com **uma** definição, usado por Mapa, Financeiro, Compras por obra, Orçado × comprado, detalhe da obra e portal. Remove D1–D4 e D17.
2. **Fonte única de status**: `statusPedido` derivado em todo lugar; `p.status` gravado só para `rascunho/enviado/cancelado`.
3. **Todo write de compras por comando**: converter `atualizarStatusSolicitacao`, `registrarContatoSolicitacao`, suprimentos e cotação de material (D15, D6).
4. **`validateProcurementChain` também no caminho de comando** (S17).
5. **Rastro de informação**: guardar (sem apagar nada existente) `riskAccepted` + divergências aceitas na aprovação da NF, `solicitacaoItemId` no item do pedido, snapshot do pedido enviado (`envios[]`), diff por item em `ajustes[]`, pagador real de `cliente_direto`.

## 5. Informação que hoje se perde (a preservar nas mudanças)

Lista consolidada dos itens (e) dos 14 relatórios, em ordem de valor para auditoria: aceite de risco da NF (não gravado); XML original; histórico de edição de preço de contrato/pedido; justificativa de escolha do fornecedor quando o pedido é cancelado (limpa a cotação); `ultimoPrecoCompra`/`ultima*` sem leitor; categoria escolhida do novo insumo; motivo da reprovação no cartão; vínculo NF↔pedido quando o pedido é cancelado; origem `banco`; prazo prometido na cotação (sobrescrito pelo aceite).
Regra para qualquer correção: **somar campos, nunca remover**; migrações só aditivas.

## 6. Sequência sugerida
1. C1–C3 (hoje). 2. C4–C6 e C8. 3. Decisões D-A…D-G. 4. C7, C9, C10. 5. Módulo de posição (item 4.1) e converter escritas diretas. 6. Roadmap R2–R8 de `docs/COMPRAS_ROADMAP.md` sobre a base unificada.

## 7. Resultado da implementação (27/10/2026)

As decisões D-A a D-G foram aplicadas com as recomendações acima, mais as correções C7 a C10. Cada item entrou por PR próprio, com teste que falha sem a correção; mudanças financeiras passaram pelo `dre-integration-guardian`.

| Item | O que ficou | PR |
|---|---|---|
| C1–C3 | status inicial `enviada`; pedido como candidato do extrato; "último preço" independente da ordem | #132 |
| C4 | portal: status feminino, andamento da entrega, unidade de compra, caixa sem pedido/fornecedor | #133 |
| C5/C6 | NF herda `fornecedorId` do pedido; avaliação ignora NF rejeitada; `ativo` do fornecedor preservado | #134 |
| C10 | cancelar solicitação encerra a aprovação pendente; fallback de admin respeita autoaprovação | #138 |
| C9 + D-F | estornar entrada de pedido reabre o recebimento (`recebimentosEstornados`); recusa com NF ativa ou material consumido | #139 |
| C7 | pagamento do extrato é `empresa` + `viaExtrato`; espelho no pedido com teto no saldo e `notaFiscalId` | #140 |
| C8 | "Chegou" com unidade de compra e sem clique duplo | #141 |
| D-A | comando `NOTA_FISCAL_REJEITADA`; aprovar com divergência grava `riscoAceito` | #142 |
| D-B + D-D | `purchase-position.js` (comprometido, faturado, a faturar); rascunho fora do saldo de contrato | #143 |
| D-C | `cliente_direto` vira `third_party_payment` (baixa a obrigação, fora do caixa); `DRE_PROJECTION_VERSION` v7 | #144 |
| D-E | aviso (não bloqueia) ao apropriar o extrato quando há nota/pedido de mesmo valor na obra | #145 |
| D-G | motor de Suprimentos abre a composição serializada do orçamento e liga insumo por código único | #146 |

### Ainda aberto
- **D-G, itens SINAPI/ORSE puros:** o analítico deles só existe na base externa (consulta do servidor); o adaptador cobre composição própria. Falta ligar a consulta.
- **Dados antigos:** pagamentos `cliente_direto` já gravados mudam de efeito retroativamente (por isso a versão v7 da DRE).
- **Arquitetura-alvo (seção 4):** converter as escritas diretas restantes (suprimentos, cotação de material, três ações da solicitação) para comandos; `validateProcurementChain` no caminho de comando; trilha de informação (`solicitacaoItemId`, snapshot do pedido enviado, diff por item em `ajustes[]`).
- **Roadmap R2–R8** de `docs/COMPRAS_ROADMAP.md`.
