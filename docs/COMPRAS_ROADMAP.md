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
| R4 | Pedidos: ação principal conforme o status, "Cancelar" e "Excluir" num menu "⋯", filtros por status, fornecedor, atraso e obra. | No máximo uma ação principal visível por cartão; destrutivas fora da linha de ações comuns. | Entregue (PR R4) |
| R5 | Painel: separar "Resumo" (KPIs, exceções clicáveis, tabela por obra) de "Análises" (Kanban, maturidade, veredicto); sem "Excluir" em tela de leitura. | Cada exceção abre a fila já filtrada; nenhuma ação destrutiva no painel. | Entregue (PR R5) |
| R6 | Recebimento único: "Chegou" abre o mesmo modal de recebimento, já preenchido com tudo. | Uma só regra de recebimento (parcial, conferência de pagamento) nos dois caminhos. | Entregue (PR R6) |
| R7 | Fila agrupável por obra e por fornecedor, contadores com valor em R$. | Cobrar três entregas atrasadas do mesmo fornecedor em uma visão. | Entregue (PR R7) |
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

### R4 · Pedidos: uma ação principal, menu "⋯" e filtros (27/10/2026)

- **Ação principal conforme o status** (`acoesDoPedido`, `src/domains/compras/order-list.js`, função pura): rascunho mostra "Revisar pedido"; enviado e parcial mostram "Receber material"; recebido e cancelado não têm ação principal. O cartão tem no máximo um botão de ação visível, mais o botão do menu.
- **Menu "⋯"** (`OrderActionMenu.jsx`): o resto das ações (Editar pedido, Enviar ou Reenviar ao fornecedor, Registrar aceite, Ver saldo em aberto, Cobrar entrega, WhatsApp) fica nele; **Cancelar pedido… e Excluir definitivamente…** ficam num grupo separado no fim, fora da linha de ações. "Enviar ao fornecedor" vira **"Reenviar ao fornecedor"** quando o pedido já tem envio registrado (`envios[]`). Teclado: Enter, Espaço ou ↓ abrem no primeiro item, ↑ no último; ↑ ↓ Home End navegam; Esc fecha e devolve o foco ao botão; Tab e clique fora fecham. O menu abre para cima quando não cabe embaixo; no celular os alvos têm 44 px.
- **Filtros** da aba Pedidos, por cima da busca: status (inclui "A receber" = enviado ou parcial, com contagem em cada opção), fornecedor, obra (só quando há mais de uma obra no escopo) e "Só entregas atrasadas"; "Limpar filtros" e contagem "N de M pedido(s)". O aviso de entregas atrasadas ganhou "Ver só os atrasados". Quem navega para a aba por outro caminho (abrir pedido de outra tela, gerar pedido pela cotação) zera os filtros, para que um filtro antigo não esconda o pedido procurado.
- **Sem mudança de regra**: cancelar continua pedindo o motivo, excluir continua pedindo motivo e a digitação do número do pedido, e os papéis são os de antes (`podeEnviarPedido`, `canManagePurchases`); a autorização segue no servidor. Nenhum comando, contrato de API nem schema mudou.
- **Verificação**: `order-list.test.js` (9 casos: ação principal por status, "Reenviar", papéis, filtros combinados e contagem), `OrderActionMenu.test.jsx` (7: teclado, foco, grupo destrutivo, ocupado) e três casos novos em `e2e/purchase-workspace.spec.js` (cartão com um botão de ação, menu por teclado e exclusão a partir dele, filtros, engenharia sem as ações de Compras, e a aba em 390, 768, 1280 e 1440 px sem rolagem lateral).

### R7 · Fila agrupada por obra e por fornecedor (28/10/2026)

- **Agrupamento**: "Agrupar por" (sem agrupamento, obra, fornecedor) na fila de trabalho, aprovações e recebimentos. `agruparFilaCompras` (`src/domains/compras/queue-groups.js`, função pura) soma por grupo a quantidade, o valor em R$, os atrasados e o valor atrasado, e ordena pelos mais atrasados (depois valor atrasado, valor e nome). Fornecedor só existe no pedido: solicitações e cotações (com vários fornecedores em disputa) ficam em "Sem fornecedor definido", sempre por último. Agrupado, a lista mostra todos os registros (sem paginação); "Limpar filtros" não desfaz o agrupamento. As linhas da fila passaram a levar `obraId` e `supplierId` (`buildPurchaseWorkspace`).
- **Cobrança em uma visão**: no grupo de um fornecedor com telefone e entregas atrasadas, "Cobrar as N entregas atrasadas" abre o WhatsApp com uma só mensagem (`mensagemCobrancaFornecedor`) listando cada pedido, a obra, a data combinada, os dias de atraso e o que falta chegar (o mesmo cálculo de atraso por item do aviso de entregas atrasadas).
- **Valores em R$**: os contadores da fila (em andamento, prazo vencido, atenção ao prazo) e a contagem de registros mostram o valor dos pedidos envolvidos; solicitações e cotações não têm valor e não entram na soma.
- **Sem mudança de regra**: só projeção e leitura; nada é gravado.
- **Verificação**: `queue-groups.test.js` (4 casos: três atrasos do mesmo fornecedor em duas obras, agrupamento por obra, resumo, mensagem) e o caso novo do `e2e/purchase-workspace.spec.js` (grupo do fornecedor primeiro, link com os três pedidos atrasados e sem o que está no prazo, fornecedor sem atraso sem botão, agrupamento mantido ao limpar filtros), que falha no código anterior; conferido em 1280 e 390 px.

### R5 · Painel com Resumo e Análises (28/10/2026)

- **Duas vistas**: o "Mapa gerencial" ganhou as abas **Resumo** (indicadores, "Exceções para decidir agora", "Fluxo sob responsabilidade" e a tabela "Compras por obra" quando há mais de uma obra) e **Análises** (Kanban, maturidade do controle, dependência de fornecedores, origem dos pagamentos, veredicto e a lista de controle dos pedidos). Abre no Resumo.
- **Sem ação destrutiva**: a lista "Controle dos pedidos" perdeu o botão "Excluir"; cada linha tem "Abrir", que leva à aba Pedidos já buscando aquele número (cancelar e excluir continuam lá, no menu "⋯", com as mesmas regras).
- **Exceção abre a lista filtrada**: `mapaGerencialCompras` passou a devolver `filtro` em cada exceção. Entregas atrasadas → Pedidos com "Só entregas atrasadas"; pedidos sem previsão, sem concorrência ou recebidos sem quitação → Pedidos com a lista exata (`ids`) e o aviso "Mostrando os pedidos da exceção … · Ver todos os pedidos"; valor a pagar → Financeiro "pendentes"; pagamentos sem conciliação → Financeiro "não conciliados". A concentração em fornecedores continua levando ao cadastro de fornecedores (não é lista de pendências). Os atalhos do "Fluxo sob responsabilidade" também filtram: Pagamentos → pendentes, Recebimentos → pedidos a receber.
- **Filtro por ids**: `FILTROS_PEDIDOS_VAZIOS` ganhou `ids` e `origem`; `filtrarPedidos` respeita a lista, e "Limpar filtros" a remove.
- **Sem mudança de regra**: só navegação e leitura.
- **Verificação**: `panel-exceptions.test.js` (5 casos) e o caso novo do `e2e/purchase-workspace.spec.js` (Resumo por padrão, nenhum "Excluir" nas duas vistas, exceção de atraso abre "só atrasadas", exceção sem concorrência abre os 2 pedidos com a origem visível, "Abrir" leva ao pedido), que falha no código anterior; conferido em 1280 e 390 px.

### R6 · Recebimento único (28/10/2026)

- **Uma regra**: `montarRecebimento` (`src/domains/compras/receipt.js`, função pura) valida e monta o recebimento para os dois caminhos: ao menos uma quantidade, nenhuma acima do que falta (receber a mais esconde erro de nota), nada negativo ou inválido; converte da unidade de compra para a do cadastro e devolve `receivedQuantities` e `stockEntries` para o comando `PURCHASE_RECEIPT_RECORDED`. `quantidadesQueFaltam` dá o "chegou tudo" sugerido.
- **Um modal**: o modal de recebimento saiu da `ComprasView` para `components/ReceiptModal.jsx`. O "Receber" de Compras e o "Chegou" da tela da obra abrem o mesmo modal, já preenchido com tudo o que falta; quem recebeu só uma parte ajusta a quantidade. Antes, o "Chegou" tinha um modal próprio que só aceitava "Sim, chegou tudo" e mandava fazer o parcial em Compras. Na obra o modal é carregado sob demanda (`lazy`), para não puxar a tela de Compras inteira.
- **Conferência de pagamento**: o modal mostra a situação do pagamento ("quitado" ou "R$ X em aberto. O recebimento não depende dele."), nos dois caminhos. Receber continua sem depender de pagamento (decisão da C1.2).
- **Sem mudança no servidor**: o comando, as permissões e o que é gravado são os mesmos; a trava de clique duplo da obra (C8) continua.
- **Verificação**: `receipt.test.js` (5 casos, inclusive o comando real do servidor aceitando o recebimento montado sem pagamento), os testes de formato do `LegacyApp.purchase-workflow-fixes.test.js` atualizados para o novo lugar das mesmas garantias (conversão de unidade, unidade de compra no rótulo, trava de clique duplo) e o caso novo do `e2e/purchase-workspace.spec.js` (na obra, "Chegou" abre o modal preenchido com 10 UN e o saldo em aberto, recusa 11, registra 4), que falha no código anterior; conferido em 1280 e 390 px.


## Roadmap de 7,6 para 9 (28/10/2026)

O quadro com os 14 itens, as fases e as decisões D1–D5 fica no documento "Roadmap de Compras: de 7,6 para 9". Decisões de 28/10: D1 = tipo novo de devolução ao fornecedor; D2 = certificado A1 autorizado como segredo do servidor, cadastrado pelo responsável; D3 = IPI, ICMS-ST e frete no custo; D4 = fornecedor não homologado só gera aviso; D5 = estouro de orçamento só gera aviso (o G4.1 sai do roadmap).

### A0.1 · Painel de uso da equipe (28/10/2026)

- **Onde**: terceira vista do "Mapa gerencial", **Uso da equipe**, ao lado de Resumo e Análises. Segue o escopo do mapa (empresa ou obra selecionada).
- **O que mede**: `painelAdocaoCompras` (`src/domains/compras/adoption.js`, função pura) conta, nas últimas 8 semanas (segunda a domingo, a última até hoje), as solicitações, cotações, pedidos, recebimentos e notas lançados, por semana, por obra e por pessoa. Usa o que os comandos já gravam: `criadoEm`/`criadoPor` (com `data`/`emissao` para registro antigo) e o `recebimentos[]` dos itens, contando uma chegada com vários itens como um recebimento. Rascunho não conta; registro sem autor aparece como "Sem autor registrado". Obra sem lançamento no período fica marcada.
- **Tempo entre etapas**: média em dias da solicitação ao pedido (pedidos feitos a partir de solicitação) e do pedido à primeira entrega.
- **Compra fora do fluxo**: nota de material sem pedido (nota de terceirizado, ligada a medição, não conta) e despesa de material no caixa da obra sem pedido nem nota, com valor, obra, data e quem lançou.
- **Sem mudança de regra**: só leitura; nada é gravado e o servidor não muda.
- **Conferência com o banco (leitura)**: nas tabelas espelho `core_purchase_orders` e `core_quotations`, o último pedido, a única cotação e o último recebimento são de 21/08/2026. Logo, nas 8 semanas até 28/10 o painel mostra 0 pedidos, 0 cotações e 0 recebimentos em produção. Solicitações e notas ficam na linha compactada (`arcd-gzip-base64-v1`) e não são inspecionáveis por SQL.
- **Verificação**: `adoption.test.js` (7 casos: janela de semanas, contagem sem rascunho e fora da janela, por obra, autores, tempos, fora do fluxo, escopo de obras) e o caso novo do `e2e/purchase-workspace.spec.js` em 390 e 1280 px (totais, autor do recebimento, nota sem pedido com obra e valor, sem rolagem lateral da página).

### A0.3 · Exportar para Excel (28/10/2026)

- **Onde**: botão "Exportar para Excel" ao lado da contagem em **Pedidos**, na **fila de trabalho**/aprovações/recebimentos e no topo de **Orçado × comprado** (uma obra ou todas).
- **O que vai no arquivo** (`src/domains/compras/export-sheets.js`, funções puras): exatamente a lista que a tela mostra, com os filtros aplicados. Pedidos saem com três abas: Pedidos (valor, recebido, pago, a pagar, situação, quem paga), Itens dos pedidos (quantidade, recebida, falta, preço) e Notas fiscais dos pedidos exportados (valores e divergências). Orçado × comprometido sai por etapa (uma obra) ou por obra (todas).
- **Número é número**: valores em R$, quantidades e percentuais vão como número, com formato de exibição (`"R$" #,##0.00`, `0.0%`); datas vão como data (`dd/mm/aaaa`), sem fuso. Cabeçalho em negrito, congelado e com filtro.
- **Perfil**: o arquivo é montado no navegador a partir do que a pessoa já vê na tela; nada novo sai do servidor. A biblioteca de planilha (`exceljs`, via `writeTables` em `src/lib/spreadsheet.js`) só é carregada no clique.
- **Verificação**: `export-sheets.test.js` (6 casos; gera o `.xlsx` de verdade com ExcelJS, lê de volta e confere número, data e formato) e o caso novo do `e2e/purchase-workspace.spec.js` (Pedidos filtrados por "só atrasadas" baixam só o PC-001 nas três abas; a fila baixa a mesma quantidade de registros da tela); conferido em 390 e 1280 px.
