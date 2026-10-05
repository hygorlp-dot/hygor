# Central de cobranças (Equipamentos › Cobrança por obra)

Painel financeiro/operacional da competência para a locação de equipamentos.
Substitui o antigo relatório-em-tela da aba "Cobrança por obra". **Nenhuma
regra financeira, fórmula, competência, medição, contrato, persistência ou DRE
foi alterada** — a tela só reorganiza e explica números que já existiam.

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/domains/equipamentos/billing-dashboard.js` | View-model puro (sem React): KPIs, recortes, pendências, fechamento, tendência, ranking e memória por obra. |
| `src/domains/equipamentos/billing-dashboard.fixture.js` | Cenário único usado nos testes de domínio, de componente e no e2e. |
| `src/domains/equipamentos/EquipmentBillingReports.jsx` | Componente: só apresenta o view-model (nenhuma fórmula). |
| `src/domains/equipamentos/BillingTrendChart.jsx` | Gráfico de tendência (Recharts), um eixo, paleta validada. |
| `src/domains/equipamentos/billing-center.css` | Estilos, com container queries (1180px / 860px). |
| `e2e/billing-center.spec.js` | Fluxo ponta a ponta + layout em 1440/1280/1024 (projeto `desktop-billing-center`). |

## De onde vem cada número

| Indicador | Origem |
|---|---|
| Receita contratual | `calcEquipamentosMes`: receita + descontos (= `calcEquipFaturamentoEmpresa.receitaBruta`). Em recorte: soma de `bruto` das locações (`calcEquipamentosPorObra`). |
| Descontos | `calcEquipamentosMes.descontos` / soma dos `descontos` das locações. |
| Receita líquida | `calcEquipamentosMes.receita` (a mesma do DRE de equipamentos) / soma de `receita`. |
| Custo total | repasse a terceiros + manutenção paga pela empresa (`calcEquipamentosMes.custo`). **O repasse de terceiro é exatamente o valor líquido da própria locação**; em recortes por obra/situação/busca o custo é só esse repasse (ver limitação). |
| Resultado / Margem | `lucro` e `lucro ÷ receita` de `calcEquipamentosMes`; em recorte, receita líquida − custo do recorte. |
| Próprios × terceiros | linhas `proprios`/`terceiros` de `calcEquipamentosMes`. |
| Faturamento (faturado, recebido, em aberto, vencido, medido sem fatura) | `rentalInvoices` e `rentalChargeItems` da competência. **Não entra no DRE** e nunca é somado à receita — a tela diz isso. |
| Utilização da frota | diárias-unidade ÷ (unidades ativas × dias da competência) — a fórmula que a tela antiga já usava. |
| Comparação temporal | mesma conta na competência anterior; só aparece quando ela tem dados. |

## Limitações preservadas (não são bugs desta tela)

- **Manutenção não é apropriada por obra.** O custo de manutenção é por
  equipamento; por isso o resultado por obra é *receita líquida − repasses*, e
  o custo dos recortes por obra avisa "só repasses".
- **Não existe fechamento/conferência formal da competência** no domínio de
  equipamentos. O bloco "Fechamento" é derivado dos lançamentos (tarifas,
  repasses, descontos, faturas vencidas) e diz explicitamente que a conferência
  formal não é registrada. Não foi criado fluxo novo de governança.
- **Faturas fora do DRE**: o ciclo de cobrança é controle interno.

## Pendências ("Atenção necessária")

Somente regras que já existiam nos dados: locação sem tarifa, desconto elevado
(≥ 20%, o mesmo limiar de `calcEquipamentosPorObra`), fatura vencida
(vencimento < hoje e saldo em aberto) e obra com resultado negativo. O repasse
de terceiros não possui tabela própria: acompanha o valor líquido da locação.
Cada item filtra o ranking por obra.

## Decisões

- PDF gerencial e PDF/exportação por obra continuam gerados pelas mesmas
  funções de `EquipamentosView.jsx` (sem mudança de conteúdo); o botão passou a
  se chamar "Relatório gerencial PDF".
- Máximo de dois gráficos (tendência de 6 meses e resultado por obra), cada um
  com tabela equivalente.
- As classes `equipment-report-*` de `src/index.css` ficaram quase todas sem
  uso (só `equipment-report-empty` segue no fallback do `Suspense`); a limpeza
  ficou fora deste escopo.


## Regra de repasse a terceiros

O valor a repassar ao proprietário de um equipamento terceiro é **o mesmo valor
líquido calculado para a locação no período**, já considerando quantidade,
combinação tarifária e descontos.

Campos legados `tarifasCusto` e `custoDiaria` podem permanecer em registros
antigos por compatibilidade estrutural, mas **não participam mais do cálculo do
repasse**.
