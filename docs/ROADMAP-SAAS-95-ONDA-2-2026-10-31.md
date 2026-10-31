# Onda 2 — Continuidade e resolução em Compras

31/10/2026. MARCELL preservada; implementação e validação locais, sem push, PR, deploy ou migrações. Aplicadas Impeccable e shadcn sobre os componentes existentes.

## O que mudou

**WF03 — Solicitar, cotar e decidir.** Solicitações, cotações e pedidos mostram a providência seguinte e botões para os registros vinculados. As relações usam identidade e obra; descrição parecida não cria vínculo. Aprovação pendente continua explícita e obedece às alçadas existentes. Solicitante ausente aparece como não informado.

Uma cotação parcialmente decidida informa quantos itens ainda precisam de decisão e mantém acesso aos pedidos já gerados. Respostas de fornecedor pendentes de revisão são distinguidas; cotação sem propostas pede a inclusão delas. Cancelamento não aparece como oportunidade de gerar outra decisão. Pedido vinculado não comprova atendimento integral das quantidades de uma solicitação.

Ao gerar pedidos, a lista abre apenas os registros confirmados por essa decisão. O retorno recupera busca, situação, datas, seleção de pedidos e cotação expandida do recorte anterior. A navegação guarda até oito origens na sessão do app; não persiste rascunhos nem grava na API. Mudar a obra ou escolher outra área pela navegação encerra essa trilha. Os destinos são revalidados contra os registros disponíveis no recorte.

Se a decisão mudar a situação da cotação e ela sair do filtro anterior, o app explica o resultado e oferece “Mostrar cotação de origem”. Os filtros são mantidos até essa ação explícita. O retorno dá foco ao registro, sem exigir nova busca.

**WF04 — Pedido, entrega e exceções.** O pedido mostra saldo de entrega por item, separa o recebimento físico do pagamento e explica a próxima providência para rascunho, entrega parcial, recebimento completo e cancelamento. A ficha de notas e anexos fica junto da ação principal; no desktop, ambas compartilham a linha. No celular, a consulta se acomoda abaixo, preservando o alvo de toque da ação.

Os filtros desktop voltaram a uma linha útil: uma regra de exibição do botão compartilhado estava sobrepondo a regra que recolhe o acionador móvel. A correção usa seletor específico para o controle de filtros, sem alterar o renderizador de botões. No celular, o acionador continua disponível e conserva os campos ao recolher.

“Pedidos” agora conta todos os pedidos da obra, inclusive concluídos/cancelados, em vez de anunciar apenas os rascunhos sobre uma lista mais ampla. As etapas “Cotar”, “Aprovações” e “Receber” continuam indicando pendências. Filtros de Cotações usam seleção nativa com rótulo e contagens legíveis, substituindo os atalhos apertados. Padronizados “Situação”, flexão de pedido/dia/item e o significado do valor “A receber em materiais”. Esse valor é físico, não saldo financeiro.

## Evidências

| Verificação | Resultado |
|---|---|
| Regressão de Compras | 44 casos aprovados; inclui 390/768/1280/1440 px nos cenários responsivos existentes |
| Novos percursos de vínculos e retorno | Em 390 e 1440 px, com perfis Compras e Administração; consulta não envia comandos |
| Recebimento parcial | 4 já recebidos + 2 confirmados = 6 de 10; um comando, sem pagamento |
| Cancelamento | Pedido sem recebimento é cancelado e permanece consultável; pedido com recebimento mantém o bloqueio existente e não envia comando |
| Decisão concluída e filtro anterior | Pedidos exatos da decisão; retorno mantém filtro e explica cotação fora dele; visualização da origem é explícita |
| Perfis restritos | Regressão conserva consulta de Engenharia sem ações de decisão e restrições de Compras em Terceiros |
| Financeiro | 14 regressões aprovadas após a correção compartilhada dos filtros |
| Regras puras | 38 testes em cinco arquivos: vínculos, lista de pedidos, decisão, recebimento e revisão de propostas |
| Referências J01–J08 | Oito casos aprovados, 16 sessões no protocolo atual |
| Revisão visual | 100 capturas de 25 superfícies em 1440/768/390/320 px; sem overflow de página, erros JavaScript ou comandos de gravação nessa varredura de consulta |
| Qualidade | Build direto do Vite, lint e typecheck aprovados; detector de layout sem achados nos arquivos delimitados |

Evidências locais em `artifacts/wf-purchasing/`: `purchase-regression-final.log`, `finance-regression.log`, `unit.log`, `visual-final/verification.json` e `regression-results/`. Protocolo de referência em `artifacts/wf-foundation/wf-purchasing/baseline.json`. As capturas de vínculos e recebimento estão nos resultados dos casos `WF03/WF04`.

O roteiro atual de J01 também confirma a formalização da solicitação originada de Planejamento e o retorno com o vínculo. É ampliação da cobertura atual, não uma nova medição comparável ao roteiro inicial. J07 ainda verifica consulta/prioridade do fechamento; J08 ainda cobre falha e retomada da solicitação, sem representar todas as condições adversas previstas. Os tempos automatizados continuam incluindo preparação e assertions; não são tempo de tarefa humano.

## Nota e posição no roadmap

**Nota provisória: 9,0/10 nas superfícies verificadas.** Avaliação heurística: fluxo 9,0; próxima ação 9,2; continuidade/recuperação 9,0; consistência 9,2; responsividade/acessibilidade 9,0; resposta 8,5. Com os pesos do roadmap, resultado 9,045. O ganho de continuidade está sustentado nos percursos exercitados; não foi medido ganho percentual de tempo, cliques ou satisfação.

**Onda 2 entregue no escopo WF03/WF04.** São três entregas concluídas (WF02–WF04), uma parcial (WF01) e seis planejadas. A validação acompanhada e os cenários integrais de recuperação continuam pendentes. Próxima frente: **onda 3, WF05/WF06**, com continuidade documental, obrigação, pagamento, conciliação e correção na origem do fechamento.

A nota não atesta 9,5 para todo o app. Ainda faltam passagem real entre operadores, falhas de conexão/sessão, revisão em volume e o piloto acompanhado da WF10. Esta entrega reutiliza os comandos, permissões, confirmações, bloqueios de cancelamento e regras de saldo existentes.
