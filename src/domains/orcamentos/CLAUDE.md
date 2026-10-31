# src/domains/orcamentos

## `budget`/`orc` pode chegar `undefined`

`OrcamentoView.jsx` chama funções de auditoria/cálculo do orçamento (ex.:
`auditWholeBudget(orc)`, `auditStructuralLinks(orc)`, `structuralBudgetRows(orc)`)
em TODA renderização — inclusive quando a obra ainda não tem nenhum orçamento
selecionado ou criado, caso em que `orc` chega `undefined`.

Isso já derrubou a tela inteira em produção (referência ARCD-1ODFE4T,
2026-09): `itemMemoryRows`/`existingMemoryOwner` (`item-memory.js`) liam
`budget.itens`/`budget.memoriaCalculo` sem `?.`, enquanto toda função vizinha
na mesma cadeia de chamada (`memoryBudgetItems`, `auditStructuralLinks`) já
tratava o mesmo parâmetro com `budget?.`. Bastou uma função inconsistente
para quebrar `auditWholeBudget` para qualquer obra sem orçamento.

**Regra**: toda função exportada deste domínio que recebe `budget`/`orc` como
parâmetro deve tratá-lo como potencialmente `undefined`/`null` — use
`budget?.` em toda leitura de propriedade, nunca `budget.` direto. Antes de
inserir uma nova função numa cadeia já existente (ex.: mais um passo dentro
de `auditWholeBudget`), confira como as funções vizinhas tratam esse mesmo
parâmetro e siga o MESMO padrão, mesmo que o caminho que você está testando
manualmente sempre tenha um orçamento preenchido.

Cobertura de regressão: `item-memory.test.js`, teste "não quebra quando o
orçamento ainda não existe (obra sem orçamento selecionado)".
