# Compras: roadmap de melhorias (26/10/2026)

Complementa `docs/COMPRAS_UX_FLUXO.md` (fila operacional, feita antes). Este roadmap nasce de uma análise do módulo com dados fictícios (4 obras, ~40 registros, desktop) e do código. Cada fase é um PR pequeno, com teste, que não muda regra financeira, alçada, contrato de API ou schema.

## Diagnóstico

| Área | Achado | Efeito para o usuário |
| --- | --- | --- |
| Visão por obra | Não existe comparativo entre obras; "Orçado × comprado" em "Todas as obras" mostra só "selecione uma obra". | Para saber qual obra está pior é preciso trocar o seletor e olhar uma por vez. |
| Orçado × comprado | Barras cheias e vermelhas para qualquer estouro (35% ou 2.114%); ordem pelo valor comprometido, não pelo risco; linhas sem detalhamento; a mensagem "sem orçamento vinculado" também aparece quando existe orçamento mas falta a baseline de controle aprovada. | Não dá para priorizar nem descobrir qual pedido causou o estouro; a orientação pode mandar criar o que já existe. |
| Cabeçalho | Quatro blocos antes do conteúdo; título "Fila de trabalho" repetido; item "Cotações" do menu lateral abre a curva ABC e preços de referência, não a cotação de compra (aba "Cotar"). | A primeira linha da fila mal aparece em 1000 px; nomes iguais para coisas diferentes. |
| Pedidos | Até 6 botões por cartão, com "Excluir definitivamente" ao lado de "Receber material"; pedido "Enviado" ainda oferece "Enviar ao fornecedor"; sem filtros além da busca. | Risco de clique errado e lista longa de cartões altos. |
| Painel (Mapa gerencial) | Seis ideias numa rolagem (Kanban, pedidos, contadores repetidos, maturidade, exceções, veredicto); botão "Excluir" dentro de tela de leitura; a parte mais acionável ("Exceções para decidir agora") fica no meio. | Painel que informa pouco e não leva à ação. |
| Recebimento | "Chegou" (tela da obra) assume que TODO o material chegou; "Receber" (módulo) aceita recebimento parcial e confere pagamento. | A mesma ação com duas regras. |
| Fila | Em "Todas as obras" é uma lista plana; contadores sem valor em R$. | Sem noção de tamanho financeiro nem de agrupamento por obra ou fornecedor. |

## Fases

| Fase | Entrega | Critério de aceite | Status |
| --- | --- | --- | --- |
| R1 | Tabela "Compras por obra" (orçado, comprometido, % do orçamento, a receber, a pagar, prazos) na fila e no "Orçado × comprado" em "Todas as obras"; mensagem correta quando falta baseline. | Uma linha por obra, ordenada por risco; clicar abre aquela obra; obra sem baseline explica o motivo real; totais conferem com as telas por obra. | Entregue (PR R1) |
| R2 | "Orçado × comprado": ordenar por risco, barra proporcional à gravidade, detalhe dos pedidos de cada etapa. | O maior estouro percentual aparece primeiro; cada etapa lista os pedidos que a compõem. | Entregue (PR R2) |
| R3 | Cabeçalho compacto, título sem repetição; renomear o item "Cotações" do menu para o que ele é. | A primeira linha da fila aparece em 1000 px; nenhum nome duplicado entre menu e abas. | Entregue (PR R3) |
| R4 | Pedidos: ação principal conforme o status, "Cancelar" e "Excluir" num menu "⋯", filtros por status, fornecedor, atraso e obra. | No máximo uma ação principal visível por cartão; destrutivas fora da linha de ações comuns. | Planejado |
| R5 | Painel: separar "Resumo" (KPIs, exceções clicáveis, tabela por obra) de "Análises" (Kanban, maturidade, veredicto); sem "Excluir" em tela de leitura. | Cada exceção abre a fila já filtrada; nenhuma ação destrutiva no painel. | Planejado |
| R6 | Recebimento único: "Chegou" abre o mesmo modal de recebimento, já preenchido com tudo. | Uma só regra de recebimento (parcial, conferência de pagamento) nos dois caminhos. | Planejado |
| R7 | Fila agrupável por obra e por fornecedor, contadores com valor em R$. | Cobrar três entregas atrasadas do mesmo fornecedor em uma visão. | Planejado |
| R8 | Avaliação e ajuste em celular real. | Roteiro de uso em 390 px sem rolagem lateral e com ações alcançáveis. | Planejado (precisa de dispositivo) |

## Limites da análise

Dados fictícios; só o papel administrador foi observado (engenharia, compras e financeiro veem menos ações); o celular não foi avaliado de forma confiável. Antes de priorizar R6 e R7, vale ouvir quem compra e quem recebe.

## Registro das entregas

(Atualizado a cada PR.)

### R1 · Compras por obra (26/10/2026)

- **Comparativo**: `src/domains/compras/by-work.js` (`buildPurchasesByWork`, função pura) cruza o orçado × comprometido de cada obra (`calcOrcadoComprado`) com a fila (`buildPurchaseWorkspace`). Ordena por gravidade: estourou o orçamento, entrega atrasada, perto do limite (90%), sem alerta. `PurchasesByWork.jsx` mostra a tabela na fila e no "Orçado × comprado" em "Todas as obras"; clicar em "Abrir" troca o escopo para a obra e zera os filtros da fila. Sem orçamento de controle, a obra mostra o comprometido pelos pedidos e fica fora do percentual do total.
- **Motivo real da falta de orçamento**: `calcOrcadoComprado` passou a devolver `motivo` (`baseline_ausente`, `baseline_ambigua`, `versao_ausente`) e `temOrcamento`. A tela antes dizia "ainda não tem orçamento vinculado" também quando o orçamento existia e faltava aprovar a baseline; agora diz qual é o caso e a providência (a aprovação é só do administrador).
- **Achado corrigido** em `getActiveBudgetBaseline` (orcamentos/calculations.js): com `versionId` do orçamento e `budgetVersionId` da baseline ambos indefinidos (dado não normalizado), `undefined === undefined` fazia qualquer baseline resolver para o primeiro orçamento da lista, de outra obra. No app a normalização (`LegacyApp.jsx`) sempre preenche `versionId`, então não ocorria, mas a comparação agora só usa a versão quando a baseline tem `budgetVersionId`.
- **Menu "Consultas e cadastros"**: ficava aberto depois de escolher um item e cobria o conteúdo. Agora fecha ao escolher e o botão mostra onde você está ("Consultas e cadastros · Orçado x comprado").
- **Design**: o CSS novo usa só tokens do design system (`--arcd-color-*`, `--arcd-radius-*`); o hook de design apontou 17 cores/raios literais e todos foram trocados por tokens, nenhum suprimido. As células de cabeçalho de linha são `<td role="rowheader">` porque a regra global `.arcd-main th` (pensada para cabeçalho de coluna) força fundo e borda em qualquer `th`.
- **Verificação**: `by-work.test.js` (10 casos, inclusive a conferência com a tela "Orçado × comprado"), `PurchasesByWork.test.jsx` (9), dois testes novos em `orcamentos/calculations.test.js` e o caso 11 do `e2e/purchase-workspace.spec.js` (ordem por risco, abrir a obra, motivo da baseline, menu fechando); os 4 testes de layout em 390, 768, 1280 e 1440 px seguem passando com a tabela na página.

### R2 · Orçado × comprado em ordem de risco (27/10/2026)

- **Ordem**: `calcOrcadoComprado` (`src/domains/compras/budget-tracking.js`) ordena as etapas por `ordemDeRisco`: estourou, atenção (90%), ok; dentro de cada grupo, o maior percentual primeiro e, no empate, o maior comprometido. Antes a ordem era só pelo valor comprometido, e um estouro de 2.000% numa etapa pequena ficava no fim da lista.
- **Barra proporcional à gravidade**: `segmentosBarraOrcamento(pct)` usa como escala o maior entre orçado e comprometido. Até 100% a barra é a de sempre; acima disso, o trecho dentro do orçado fica neutro e o excesso em vermelho, na proporção real (105% vira uma faixa fina; 2.000% ocupa 95% da barra). Vale também para a barra do total.
- **Pedidos de cada etapa**: cada linha traz `pedidos` (número, fornecedor, situação, valor na etapa). Pedidos vivos primeiro, pelo valor; rascunho aparece marcado como "não comprometido"; cancelado não aparece. A soma dos pedidos vivos é o comprometido da linha (conferido em teste). Na tela, "Ver os N pedidos desta etapa" abre a lista.
- **Sem mudança de regra**: comprometido continua sendo o de `pedidoVivo` (`purchase-position.js`); nada muda no que é gravado nem na DRE.
- **Verificação**: três testes novos em `budget-tracking.test.js` (falham no código anterior) e o caso 12 do `e2e/purchase-workspace.spec.js` (ordem, largura do trecho vermelho, lista de pedidos com o rascunho separado).

### R3 · Cabeçalho compacto e nomes sem repetição (27/10/2026)

- **Cabeçalho único**: título, seletor de obra, aviso de salvamento e as ações ("Analisar documento", "Nova solicitação") ficam num só bloco; a barra separada da obra deixou de existir (a classe `purchase-context-bar` continua, agora dentro do cabeçalho). A frase de apresentação encurtou para "Materiais na obra, no prazo.". Em 1280 × 1000 a primeira linha da fila passou de 981 px (fora da tela) para 826 px.
- **Título sem repetição**: na fila, em aprovações e em recebimentos o painel já tem título próprio ("O que precisa da sua atenção" etc.), então o nome da área ("Fila de trabalho") fica só para leitor de tela e como destino do foco (`data-compact`). Nas demais áreas o título e o "Voltar à fila" continuam como antes.
- **Nomes**: o item "Cotações" do menu lateral abria a curva de necessidade e a comparação de preços, não a cotação de compra (aba "Cotar"); passou a se chamar **"Curva e preços"**, e o título da tela, "Curva de compra e preços". A aba interna "Fornecedores" (cadastro) virou **"Cadastro de fornecedores"**, porque o "Fornecedores" do menu é o ranking de desempenho. O título da área de pagamentos dizia "Financeiro" enquanto a navegação dizia "Pagamentos"; agora os dois dizem "Pagamentos".
- **Verificação**: caso novo no `e2e/purchase-workspace.spec.js` (posição da primeira linha em 1000 px, título da área escondido, nenhum nome do menu de Compras repetido nas abas, título de Pagamentos), que falha no código anterior; `modules-smoke` atualizado para o novo rótulo; conferido em 390, 768, 1280 e 1440 px.

