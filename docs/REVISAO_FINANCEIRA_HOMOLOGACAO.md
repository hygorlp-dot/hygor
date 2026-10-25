# Revisão financeira da homologação

Data: 25/10/2026. Escopo: alterações de adiantamento, quinzena mista, CLT por diária, vigência de cadastro e conciliação. A revisão seguiu integralmente `.claude/agents/dre-integration-guardian.md`, com leitura do fluxo de tela, comando, servidor, razão e DRE. O revisor não alterou os arquivos financeiros; as correções foram executadas pela sessão coordenadora.

## Achados confirmados e correções

### 1. Relatório de diária comum incluía empregado CLT por diária

`src/domains/ponto/components/FolhaView.jsx` filtrava somente `remunerationMode`. Assim, um empregado com remuneração diária e vínculo CLT entrava no cálculo comum de dias, benefícios e descontos. A tela e os arquivos ofereciam esse resultado como **Líquido a pagar**, enquanto `buildMixedPayroll` exigia a apuração CLT identificada.

Cenário concreto: empregado CLT com diária de R$100 e dez presenças, sem memória da competência. A preparação mista bloqueava o envio ao financeiro, mas o relatório comum apresentava o resultado simples como valor final. Esse relatório não lançava um novo custo no DRE; o risco era orientar o pagamento por um resultado incompatível com o fechamento correto.

Correção: `src/domains/rh/payroll-classification.js` centraliza `isCltPayrollOnDate`, considerando modalidade mensal CLT ou vínculo CLT na data. O preparador e o relatório usam o mesmo predicado. O relatório comum encaminha esses empregados a **Holerites CLT**.

### 2. Pagamento ou reversão de adiantamento podia deixar a prévia antiga

O cálculo de `rows` em `FolhaView.jsx` passou a consultar `data.titulosFolha` para descontar apenas o adiantamento efetivamente liquidado. Essa coleção ainda não constava nas dependências do `useMemo`. Uma atualização que preservasse as referências do ponto/cadastro/adiantamentos mantinha o resultado anterior na tela.

Cenário concreto: o adiantamento permanecia com os mesmos dados cadastrais e recebia uma liquidação bancária. A prévia não precisava recalcular até que outro filtro ou coleção mudasse.

Correção: inclusão de `data.titulosFolha` nas dependências. A sessão coordenadora reproduziu ambos os achados em testes de componente inicialmente vermelhos, em `src/domains/ponto/components/FolhaView.test.jsx`.

## Contratos conferidos

| Trecho | Regra observada |
|---|---|
| `advance-commands.js` | Uma solicitação nova cria um adiantamento e um título próprio `kind: advance`; ainda não prova pagamento. |
| `advance-settlements.js` | A dedução considera liquidações ativas, válidas e positivas. Distribui os centavos pagos entre parcelas e desloca uma parcela vencida para a data efetiva do pagamento. |
| `reconciliation-command.js` e `conciliacao/mutations.js` | O servidor usa a mesma mutação de conciliação; confirma saída bancária e data do movimento. Pagamento parcial reduz o saldo sem recriar o custo. |
| Cancelamento e reversão | Liquidações e registros não são apagados. Pagamento já compensado em folha ou protegido por fechamento exige ajuste identificado. |
| `mixed-payroll.js`, `clt-review.js` e `clt-preparation.js` | Todos passam o contexto financeiro à dedução de adiantamentos. Títulos de adiantamento não são confundidos com fechamento salarial. |
| `clt-payslip.js` e `employee-commands.js` | CLT por diária exige memória, rubricas, incidências, tributos informados e conferência. O comando recalcula e carimba a auditoria; não converte diária em salário mensal. |
| Histórico contratual e valores | A classificação e os valores são consultados por data. Alterações com vigência futura não substituem automaticamente a origem de uma competência anterior. |
| `financeiro/ledger.js` | Títulos de folha geram obrigação; liquidações geram caixa e baixa de obrigação. Não emitem um segundo evento `cost`. |
| `server/dre-projection.js` | O servidor importa o mesmo `labor-cost-engine.js` do cliente; não reimplementa um cálculo paralelo de mão de obra. |

## Resultado da validação

A sessão coordenadora confirmou a suíte geral concluída após as correções financeiras: **3.059 testes aprovados e 13 ignorados; 411 arquivos aprovados e 2 ignorados; nenhuma falha**. A execução usou um worker e durou 881,22 segundos, com os processos nativos Android desligados para não disputar memória. Os dois testes de componente que reproduziam os achados fazem parte dessa validação.

Não foi encontrada outra divergência concreta nesse recorte. A revisão não declara conformidade trabalhista ou tributária geral, não substitui os testes completos da integração e não transforma dados de simulação em registros oficiais. As evidências de compilação e instalação Android ficam separadas desta revisão financeira.
