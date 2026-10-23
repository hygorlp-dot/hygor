# Avaliação de fornecedor (C2.3)

Nota de **0 a 10** por fornecedor, calculada sobre os **últimos 12 meses**. Aparece ao lado de cada fornecedor no mapa de cotação e nas opções da decisão por item. Código: `src/domains/compras/supplier-rating.js`.

## Critérios

| Critério | Peso | Cálculo | Origem |
| --- | --- | --- | --- |
| Pontualidade | 50% | 10 × remessas no prazo ÷ remessas avaliadas | Entrega programada por item (C2.2) |
| Notas fiscais | 30% | 10 × notas sem divergência ÷ notas do fornecedor | Conferência pedido × recebimento × nota (C1.4), gravada em `notaFiscal.divergencias` |
| Cancelamentos | 20% | 10 × pedidos não cancelados ÷ pedidos emitidos | Pedidos do fornecedor (rascunho não conta) |

## Regras

- **Remessa avaliada:** é a remessa já vencida ou já atendida.
  - Ela está no prazo se o recebido acumulado do item alcançou a remessa até a data dela.
  - Se a remessa venceu e não chegou, conta como atrasada.
  - Item sem remessas usa a própria data ou a previsão do pedido.
- **Janela de 12 meses:** pontualidade usa a data da remessa, notas fiscais usam a emissão e cancelamentos usam a data do pedido.
- **Critério sem registro no período:** fica de fora, e os pesos dos demais são redistribuídos. Por exemplo, sem notas fiscais, a pontualidade vale 50/70 e os cancelamentos 20/70.
- **Sem nenhum registro:** o fornecedor fica sem nota ("sem histórico"). Não há nota zero por falta de dados.
- **Arredondamento:** uma casa decimal.

## Exemplo

Considere um fornecedor com:
- 4 remessas avaliadas, 3 no prazo: pontualidade 7,5;
- 2 notas, 1 com divergência: notas fiscais 5,0;
- 5 pedidos, 1 cancelado: cancelamentos 8,0.

A nota final é 0,5 × 7,5 + 0,3 × 5,0 + 0,2 × 8,0 = **6,9**. O mesmo cenário está em `supplier-rating.test.js`.
