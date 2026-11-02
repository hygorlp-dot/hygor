# Refinamento visual e comparação de fluxos — 31/10/2026

Continuação da [expansão visual MARCELL](REBRANDING-EXPANSAO-MARCELL.md). Implementação e validação locais, sem publicação ou migração de banco.

## Implementado nesta rodada

- **Estoque:** ações no cabeçalho, obra e indicadores em faixa compacta, navegação compartilhada entre saldo, movimentos e consultas. A explicação sobre DRE permanece em expansão depois da área de trabalho. Alertas de reposição continuam visíveis. O cabeçalho usa nível de seção quando o estoque é aberto dentro de uma obra.
- **Equipamentos:** um único período de referência, busca sem painel redundante, nome completo do equipamento e composição móvel que reserva espaço para imagem, identificação e ações sem sobreposição.
- **Fornecedores:** filtros com rótulos visíveis e controles existentes, obra e período lado a lado no celular, indicadores compactos e ranking móvel com notas alinhadas. Removidos rótulos redundantes acima de títulos.
- **Patrimônio:** filtros adaptativos e mudança da tabela para linhas compostas em larguras intermediárias. Corrigido o extravasamento de ações em 768 px; valor de aquisição identificado também na versão compacta.
- **Cotações:** busca sempre visível; datas recolhidas no celular, com contagem de filtros ativos. Recolher preserva as datas; limpar filtros também está disponível no celular. Desktop mantém campos diretamente acessíveis. Retornos sem pendência ficam em expansão; uma resposta nova ou fornecedor sem envio registrado abre a fila automaticamente. A coluna de ações tem espaço reservado e a lista permite rolagem interna em desktop estreito.
- **Acessibilidade compartilhada:** os seletores legados recebem nome acessível explícito a partir do rótulo.
- **Prévia:** exemplos fictícios preenchidos de estoque, equipamentos e patrimônio; arquivos de evidência em `artifacts/` não provocam recargas da aplicação.

## Comparação com Vobi: observação direta

Acesso autenticado confirmado no navegador nesta rodada. Foram consultadas solicitações, lista de cotações, detalhe com mapa de propostas, lista de projetos e uma obra com orçamento, planejamento e resumo financeiro. No MARCELL, foram abertas a fila de Compras e uma cotação a partir da ação contextual da fila.

A consulta foi de leitura e navegação. Nenhuma aprovação, envio, edição de preço, compra, pagamento ou compartilhamento foi executado no Vobi. Este documento descreve a interface e não reproduz dados cadastrais ou financeiros da conta.

| Evidência observada no Vobi | Situação do MARCELL | Melhoria a priorizar |
| --- | --- | --- |
| A obra permanece identificada ao trocar Orçamento, Obra, Compras e Financeiro. | A tela interna da obra já agrupa seus módulos, com seletor único no celular. | Tornar a volta ao ponto de origem consistente em todos os detalhes, preservando obra, filtros e posição da lista. Verificar fluxo por fluxo antes de alterar persistência. |
| Solicitações e cotações têm filtros de situação e listas com necessidade, responsável e origem. | A fila local já reúne prazo, obra e próxima ação, com agrupamentos e busca. | Preservar essa entrada orientada a pendências e reduzir cabeçalhos duplicados nas telas de destino. Não criar mais um painel com os mesmos indicadores. |
| A lista de cotações expande fornecedores; o detalhe reúne Dados, Fornecedores e Mapa. | Há análise por cotação com Comparativo, Fornecedores, Histórico e Documentos. | Aproximar a ação de decisão do resumo da análise em telas longas; manter o custo final e dados ausentes explícitos antes da decisão. |
| Orçamento mostra etapas recolhíveis, total e ferramentas junto à planilha. | O editor já tem etapas, totais, dados/versões e ferramentas expansíveis. | Manter a planilha como conteúdo principal; revisar seleção de colunas e ações por linha em 768–1024 px, onde painel lateral e planilha competem por largura. |
| Planejamento, Medições, Físico-Financeiro, Curva S e Diário ficam agrupados em Obra. | Planejamento e medições já existem no contexto da obra; o cronograma precede análises complementares. | Facilitar a passagem de uma etapa atrasada para sua demanda de suprimentos, com identidade e datas preservadas. A existência de cada vínculo precisa ser verificada antes de criar atalhos. |
| O resumo financeiro da obra separa receitas/despesas abertas, vencidas e realizadas. | O MARCELL tem Financeiro por obra, razão canônico e integração com Compras. | Manter entrega, aprovação e pagamento como estados independentes; dar acesso ao documento de origem sem induzir lançamento duplicado. |

As prioridades acima são avaliação de UX a partir das telas observadas e da implementação local. Não significam que as funcionalidades estejam ausentes nem que todos os fluxos tenham sido executados até sua gravação. O planejamento consultado no Vobi tinha etapas sem datas; seu Gantt preenchido não foi validado. O resumo financeiro consultado estava sem movimentos nesse recorte.

## Referências oficiais e implicações

- [Gestão de Compras](https://ajuda.vobi.com.br/pt-br/articles/8775687-utilizando-a-gestao-de-compras-na-vobi): sequência entre necessidade, cotação, contratação e controle financeiro. No MARCELL, usar essa continuidade para orientar ações entre módulos existentes.
- [Cotações](https://ajuda.vobi.com.br/pt-br/articles/9060523-como-criar-e-gerenciar-as-suas-cotacoes): origem em solicitação ou orçamento, resposta de fornecedores e comparação. A análise local já acrescenta referência histórica e conferência do custo final; preservar essas capacidades.
- [Planejamento](https://ajuda.vobi.com.br/pt-br/articles/9833043-como-utilizar-o-planejamento-de-obra-na-vobi): vínculo com orçamento, dependências e linhas de base. Inferência de produto: a integração entre etapa, necessidade de compra e prazo merece prioridade sobre novos indicadores isolados.
- [Ordem de Compra](https://ajuda.vobi.com.br/pt-br/articles/8776426-como-criar-uma-ordem-de-compra-e-contratacao-na-vobi): documento como origem das informações financeiras. Qualquer melhoria local deve conservar deduplicação e regras do razão financeiro.

## Revisão local

Prévia: http://127.0.0.1:4198 · `piloto@local.test` · senha `piloto-local`. Dados fictícios em memória.

Evidências desta rodada em `artifacts/rebranding-refinement/`; regressão de navegação em `artifacts/rebranding-app/refinement-regression/`. Os testes usam o código real da interface com APIs simuladas e não validam integrações de produção.

- 77 testes relevantes aprovados. Incluem abertura automática de pendências de fornecedores, destino da cotação e consultas preservadas ao recolher a fila.
- Capturas antes/depois em 320, 390, 768 e 1440 px; cenários adicionais de filtros, vazio, menus, movimentos de estoque e desktop de 1100 px.
- Regressão de 46 rotas operacionais em desktop e celular, em 100 capturas, sem extravasamento horizontal da página, títulos principais ausentes ou erros JavaScript. A revisão foi executada antes da inclusão concorrente do módulo Projetos, que não faz parte desta regressão.
- Lint, TypeScript e build Vite local aprovados. O aviso de chunks acima de 650 kB permanece.
- Detector Impeccable sem ocorrências no arquivo de tema operacional.
