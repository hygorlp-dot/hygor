# API integrada ao DRE e vínculos parciais

O DRE agrega fatos dos módulos operacionais e títulos/liquidações nativos da API. Uma associação bancária comprova um fato de caixa existente; ela não cria nota fiscal, título, pagamento, receita ou custo adicional.

## Operação na interface

Em **DRE obras**, **DRE empresa** e **Conciliação**, abra **Conciliação integrada ao DRE**. Selecione o movimento importado, o registro de caixa existente e o valor. A tela mostra os saldos dos dois lados, os vínculos ativos e o resultado do salvamento. É possível associar vários movimentos a um registro ou distribuir um movimento entre vários registros, dentro dos respectivos saldos.

**Desfazer vínculo** exige motivo e reabre somente o saldo associado. O pagamento/recebimento original permanece intacto. Operações em períodos fechados são recusadas. O histórico de associações é preservado, inclusive após remoção.

O gestor exige perfil Administrador ou Financeiro sem restrição de obra. A API repete essa verificação; esconder a interface não é a autorização.

## Contratos da API

Todas as ações usam `POST /api/data` com a autenticação já utilizada pelo aplicativo.

- `financial-management-report`: leitura do razão, movimentos, saldos disponíveis, associações e pendências de classificação.
- `reconciliation-command` / `LINK_PARTIAL_CASH`: `payload: { transactionId, eventId, amount }`, com `idempotencyKey` estável nas retentativas. Os IDs vêm do relatório de gestão e o servidor relê os valores autoritativos.
- `reconciliation-command` / `REVERSE_PARTIAL_CASH`: `payload: { transactionId, allocationId, reason }`, também idempotente.
- `financial-command` continua gerindo títulos nativos. `CREATE_FINANCIAL_TITLE` exige `financialKind`: `cost`, `revenue`, `funding`, `loan` ou `transfer`. `REGISTER_SETTLEMENT` aceita um valor parcial e valida o saldo do título e do movimento bancário. Liquidações operacionais devem continuar usando o comando do módulo de origem; não podem ser regravadas pela API nativa.
- `financial-dre-report` e `financial-company-dre-report` incluem os fatos nativos e uma revisão de seu conteúdo. Criar ou desfazer uma liquidação nativa invalida a projeção anterior na próxima consulta.

Aportes, empréstimos e transferências não se tornam faturamento. Títulos nativos antigos sem natureza confirmada aparecem como pendência de classificação; o sistema não presume uma receita ou um custo. Seus movimentos de caixa efetivos continuam visíveis.

O seletor de registros existentes atende os módulos operacionais. Movimentos já associados a liquidações nativas continuam sendo completados pela API financeira, sem misturar esse caminho com uma segunda liquidação do mesmo pagamento.

## Persistência e preservação

`financial_dre_allocations` guarda somente associações, com RLS habilitada e acesso direto restrito. O snapshot compatível, a associação e a auditoria são confirmados na mesma transação PostgreSQL. A importação/projeção de um movimento bancário não gera uma liquidação. O reprocessamento financeiro reaplica as associações e confere saldos, sinais, datas e existência dos registros.

Os vínculos integrais antigos permanecem em `reconciliation_links`. A nova tabela não altera valores, datas, estados ou identidade dos pagamentos existentes. A integração não ativa globalmente o FIN-003, evitando mudar os caminhos de pagamento de outros módulos nesta entrega.

## Pendência de R$ 7.160,00

O movimento `mt7l9lt5xrta`, de 21/07/2026, permanece pendente. A finalidade informada é mão de obra da B2-04, mas ainda falta confirmar se o valor integra o APORTE GERAL de R$ 10.384,50. Não há vínculo automático, reativação de despesa cancelada nem nova receita para resolver essa pendência. Os comandos de conciliação, alteração de situação bancária e a associação SQL bloqueiam esse movimento até que exista evidência para uma correção específica.

## Validação

As fixtures são locais e isoladas. Os testes cobrem N:N, centavos, limites cumulativos, sinal, cancelamento, período fechado, reprocessamento de migration, idempotência, reversão de associação, RLS e bloqueio do movimento pendente. O navegador verifica desktop/celular, falha e retentativa com a mesma chave, saldos e preservação dos pagamentos. A conferência de produção compara os registros reais antes/depois sem criar transações de teste.
