# Conciliação assistida — Fase 1

## Fonte de verdade

O ponto/folha é a fonte do custo de mão de obra no DRE. `titulosFolha` é uma
obrigação a pagar e `reconciliationLinks` registra a evidência de liquidação;
nenhuma conciliação de folha cria `outrasDesp` ou `despesasEmpresa`.

## Migração compatível

Não há migração destrutiva. Na primeira leitura, o normalizador cria coleções
vazias para instalações existentes. Os registros legados de `pagamentosFolha`
continuam sendo exibidos. Títulos novos devem ser criados no fechamento da
folha e preservam `snapshotCalculo` e `rateiosPorObra`.

## Operação

1. Importe o extrato; FITID, E2E/TxId e metadados disponíveis são preservados.
2. A fila encontra títulos de folha abertos e explica a pontuação.
3. O operador confere dados mascarados, cálculo e rateio e confirma.
4. A liquidação reduz o saldo do título e grava um `reconciliationLink`.
5. Desfazer a conciliação reverte exclusivamente a liquidação criada por ela.

## Limites desta fase

Contratos, caixa de obra, transferências, estornos e regras de aprendizado
continuam no modelo atual e serão migrados nas fases seguintes. A confirmação
automática permanece desabilitada.
