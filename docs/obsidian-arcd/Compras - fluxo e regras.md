---
tipo: regra-negocio
area: Compras
atualizado: 2026-07-23
tags:
  - compras
  - fornecedores
  - pagamentos
---

# Compras — fluxo e regras

## Fluxo principal

1. Solicitar
2. Cotar
3. Comprar
4. Pagar
5. Histórico

## Solicitações

- O insumo SINAPI, ORSE ou próprio deve ser cadastrado ou reutilizado no momento da solicitação.
- O mesmo `materialId` deve acompanhar cotação, pedido, pagamento, recebimento e histórico.
- A solicitação permanece editável enquanto estiver enviada ou em análise.
- Cada item pode iniciar uma cotação formal já preenchida.

## Cotações

- Comparar no mínimo duas propostas.
- Evidenciar menor preço, prazo, documentos e economia.
- Escolher uma proposta gera o pedido sem redigitação.
- Escolher proposta mais cara exige justificativa.
- A lista deve permitir busca, período, status, expansão e exclusão no próprio registro.

## Pedidos e pagamentos

- Origens: conta da empresa, caixa da obra e pagamento direto do cliente.
- Pagamentos podem ser reclassificados entre as três origens.
- Excluir um pagamento recalcula saldo e estorna o movimento correspondente do caixa.
- Excluir uma compra atualiza estoque, caixa e vínculos, com confirmação e auditoria.

## Gestão de fornecedores

- Ranking automático por preço, frete, prazo, qualidade e volume.
- Histórico por fornecedor e por insumo.
- Alertas de concentração, falta de concorrência, atraso e ausência de conciliação.

