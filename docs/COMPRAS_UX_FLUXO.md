# Compras: fila operacional e acompanhamento por obra

## Objetivo

Permitir que Engenharia, Compras e Financeiro encontrem a próxima ação sem interpretar o mapa gerencial inteiro. A página é uma composição sobre o domínio existente; as decisões, recebimentos e pagamentos continuam nos comandos transacionais atuais.

## Diagnóstico e decisões

| Antes | Depois | Motivo |
| --- | --- | --- |
| Mapa gerencial e Kanban abriam antes da lista de tarefas. | Administrador e Compras entram na fila por prazo; análises permanecem em Consultas e cadastros. | Tornar a operação diária a primeira informação. |
| Solicitar, cotar, comprar e pagar pareciam uma sequência única. | Navegação operacional com Solicitar, Cotar, Aprovações, Pedidos e Receber; pagamentos e histórico separados. | Uma entrega a prazo não depende de quitação. |
| Indicadores e cartões dependiam de critérios diferentes de escopo. | A nova fila, os contadores e os filtros usam a mesma projeção por obras visíveis. | Evitar contagem sem correspondência na lista. |
| Busca de pedido limitada a número e fornecedor; frases completas nas cotações. | Todas as palavras podem estar em qualquer dos campos relevantes, sem ordem ou acento, na fila, pedidos, catálogo, cotações e histórico de compras. | Encontrar “central cimento” sem saber a descrição exata. |
| Reutilização do catálogo pouco evidente na solicitação. | Pesquisa local de materiais existentes; base SINAPI/ORSE em seção própria. | Evitar redigitação e duplicação de material. |
| Resumo somava quantidades de unidades diferentes. | Quantidades agrupadas por unidade de compra. | Não apresentar kg + m³ como um total físico. |
| Editor de pedido aberto de outra obra podia receber a lista de etapas da obra selecionada. | Cada editor recebe o orçamento da própria obra do registro. | Preservar a apropriação ao usar a fila de todas as obras. |
| Recebimento dizia “pagamento já verificado”. | Explicação do efeito físico no estoque e do pagamento separado, com saldo após a entrada. | Não induzir interpretação financeira incorreta. |
| Pedido podia fechar com alterações e não tinha espera explícita no salvamento. | Confirmação de descarte, campos bloqueados durante envio e retorno após confirmação. | Evitar perda de dados e submissões simultâneas. |
| Regras antigas da navegação truncavam o novo fluxo no celular. | CSS próprio sem reutilizar a classe visual antiga; seis ações visíveis. | Evitar dependência de regras globais conflitantes. |

## Organização

- Fila: obra, registro, material, situação, prazo, contato/solicitante e próxima ação; paginação de 20 registros.
- Aprovações: solicitações com decisão, configuração ou revisão pendente. A ação abre o registro; os botões de decisão continuam condicionados à elegibilidade existente.
- Recebimentos: pedidos emitidos ou parcialmente entregues, independentemente de pagamento. A data considera a primeira remessa ainda não atendida.
- Pedidos: acesso aos rascunhos e à consulta operacional existente.
- Acompanhamento: pagamentos e histórico.
- Consultas: mapa gerencial, Kanban, origem do pagamento, orçamento, fornecedores, contratos e análises existentes.

Filtros da fila ficam no componente pai e permanecem ao abrir e voltar dos detalhes. O estado de gravação só anuncia sucesso após `ok:true`. Uma falha mantém o formulário; a nova tentativa usa os comandos existentes. O bloqueio de submissão simultânea não implementa uma nova fila offline.

## Verificação

Os testes de navegador usam dados fictícios e o reducer real `applyOperationalCommand` atrás de uma API simulada. Eles não movimentam estoque ou pagamentos de clientes reais. Políticas de servidor permanecem cobertas pelos testes de domínio e integração existentes.

Casos automatizados em `e2e/purchase-workspace.spec.js`:

1. Escopo por obra, busca com palavras em campos distintos, aprovação e retorno aos filtros.
2. Recebimento parcial sem pagamento, bloqueio de excesso, estoque e saldo após recarregar.
3. Falha de gravação e nova tentativa sem perda do formulário, conversão SC → KG e apropriação.
4. Edição de rascunho de pedido e busca por fornecedor + material.
5. Reutilização de material existente sem cópia no catálogo.
6. Solicitação → cotação → pedido preservando material, quantidade e etapa.
7. Pagamento direto do cliente separado de entrega e transações da empresa.
8. Engenharia consulta cotações sem obter botões de decisão de Compras.
9. Layout e teclado em 390, 768, 1280 e 1440 px, com as seis ações visíveis e sem transbordamento da página.
10. Solicitação e cotação no celular, sem transbordamento e com confirmação de descarte.

As capturas de fila, solicitação, cotação e recebimento são geradas em `test-results/`, que permanece ignorado pelo Git. Executar também smoke dos módulos, ações críticas, lint, typecheck, arquitetura, testes e build antes da publicação.

## Limites

Não foram alteradas alçadas, fórmulas financeiras, custos, conversões do domínio, contrato de API ou schema. A interface não envia mensagens a fornecedores automaticamente, não escolhe propostas por arraste e não apresenta reversão fictícia de operações financeiras. O layout não adiciona dependências.
