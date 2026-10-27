# Fase 4 · Prompts de implementação (um por correção)

> **Estado em 27/10/2026:** todas as correções C1–C10 e as decisões D-A a D-G já foram implementadas (ver `03-unified-proposal.md`, seção 7). Os prompts abaixo ficam como registro do que foi pedido.

Cada prompt é autocontido para uma sessão nova. Regras comuns (do `CLAUDE.md`): branch nova a partir de `origin/main`; teste novo que falhe sem a correção; `npm run lint`, `npm run architecture:check`, `npm run typecheck`, `npm test`, `npx vite build` verdes antes do PR; só somar campos (nada de apagar informação); alteração que afete DRE roda o agente `dre-integration-guardian` e sobe `DRE_PROJECTION_VERSION`; em português.

## C1 · Status inicial da solicitação (S1)
Em `src/domains/compras/purchase-request-commands.js:82`, trocar o padrão `"aberta"` por `"enviada"` (único status que a aba Solicitações, o KPI do mapa, o SLA e os botões Cotar/Gerar pedido reconhecem; a UI já envia `enviada`). Teste em `purchase-request-commands.test.js`: criar solicitação e afirmar `status === "enviada"`; editar preserva o status; `buildPurchaseWorkspace` a mostra "Aguardando análise". Conferir no espelho `purchase_requests` (somente leitura) que não há linhas `aberta`.

## C2 · Pedido como candidato do extrato
`src/domains/conciliacao/selectors.js:98` e `matching.js:176` leem `p.totalPedido` (inexistente). Usar `totalPedido(p)` de `src/domains/compras/calculations.js`. Testes: o pedido de 100×35 entra por valor 350000; com pagamento parcial o saldo cai; cancelado não entra; candidatos continuam sem aplicar nada automaticamente.

## C3 · Último preço da análise
Tornar `analisePreco` (`src/domains/compras/calculations.js:94-102`) independente da ordem recebida (ordenar por data internamente) e corrigir a chamada em `ComprasView.jsx:1085-1088`. Teste com lista crescente e decrescente: `ultimo` = preço da compra mais recente.

## C4 · Portal do cliente
`server/client-portal-publication.js`: (a) `active` e o filtro de NF/cotação incluem `cancelada`, `estornada`, `rascunho`, `rejeitada` (feminino); (b) `clientStatus` do pedido a partir de `statusPedido` (parcial/recebido); (c) quantidade e preço em unidade de referência, ou rótulo explícito da unidade de compra; (d) descrição do caixa publicada sem número do pedido e nome do fornecedor quando `publicarCompras` estiver desligado. Testes em `client-portal-publication.test.js` com 403/ausência para cada status.

## C5 · Fornecedor da NF (S18)
`src/domains/financeiro/invoice-commands.js`: se `fornecedorId` vier vazio e houver `pedidoId`, herdar o do pedido (nunca sobrescrever valor existente). `supplier-rating.js:31`: incluir `rejeitada`/`rejeitado`/`estornado`. `LegacyApp.jsx:5269`: XML sem CNPJ casado não apaga `fornecedorId` já existente.

## C6 · Fornecedor ativo
`ComprasView.jsx:1098` e `LegacyApp.jsx:14488` preservam `ativo` (como `LegacyApp.jsx:12276`). Teste: editar fornecedor inativo mantém `ativo:false`.

## C7 · Origem "banco" e espelho nota→pedido (S8)
`mutations.js:128,148-152`: aceitar `banco` no enum de origem (`payable-payment-commands.js:27`, `calculations.js:146-150`, normalização `LegacyApp.jsx:2417`); espelho no pedido com `min(valor, saldo do pedido)` e `notaFiscalId`. Teste de comando com PGlite se tocar persistência.

## C8 · Botão "Chegou"
`LegacyApp.jsx:13234,13239`: mostrar `falta` com `unidadeCompra`; estado de envio para evitar clique duplo (`12850-12891`).

## C9 · Estorno solto de entrada de pedido
`src/domains/estoque/commands.js:84-99`: recusar estorno de movimento com `pedidoId` ativo, com mensagem "Cancele a compra ou reverta o recebimento pelo pedido". Teste de recusa; movimentos manuais continuam estornáveis.

## C10 · Solicitação cancelada e aprovações
`purchase-request-commands.js:116-143`: cancelar também a instância de aprovação `em_andamento`. `engine.js:115`: o fallback `administradores` respeita a autoaprovação proibida. Testes nos dois casos.

## Decisões pendentes (D-A…D-G em `03-unified-proposal.md`)
Só iniciar após resposta do responsável: rejeição de NF; definição oficial de "comprometido"; `cliente_direto` no caixa; rascunho em saldo de contrato/suprimentos; aviso de duplicidade na alocação; reversão de recebimento; fonte da curva ABC.
