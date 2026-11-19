# Portal do cliente — simulação e conferência

14/11/2026. Tudo local, com obra, pessoas, documentos e movimentos fictícios. Este relatório comprova os cenários testados; não homologa o cadastro de uma obra real nem o acesso real ao OneDrive.

## Prévia e reprodução

`node scripts/client-portal-local-server.mjs --simulation` abre a simulação em `http://127.0.0.1:4198/cliente`. Login: `cliente@example.test`; senha: `ClienteLocal1234`. O servidor usa PostgreSQL em memória e os manipuladores reais da API. Reiniciar apaga apenas o cenário de teste. O servidor original de revisão permanece em 4197.

Fonte: `server/client-portal-simulation.fixture.js`. Os testes fazem a leitura pela API autenticada e conferem a tela no computador e no celular. Não há acesso ao banco de produção.

## Valores e quantidades conferidos na referência

| Área | Origem e resultado esperado |
| --- | --- |
| Evolução | Boletim técnico aprovado: 78%; duas tarefas no cronograma |
| Diário | 14 diários concluídos, em 13 dias; dois registros no mesmo dia, serviços, quantidade, unidade e clima |
| Imagens | 13 imagens demonstrativas vinculadas aos IDs dos diários; diário sem foto continua disponível |
| Contrato | Original 100.000 + aditivo aprovado 10.000 = vigente 110.000 |
| Acumulado contratual | 50% = 55.000; distinto do avanço físico |
| Quinzena | Parcela emitida 10.000 − recebido 2.500 = saldo 7.500, vencimento em 20/11 |
| Resumo contratual | Medido 55.000; recebido 47.500; em aberto 7.500 |
| Custos | Material 3.500 + mão de obra 600 + benefícios 60 + outros 800 = 4.960 |
| Pagamentos de custos | 600 + 1.800 = 2.400; pagamento não reconhece o custo outra vez |
| Etapas | Fundação: previsto 6.000, realizado 1.000; Alvenaria: previsto 4.000, realizado 3.300; etapa ainda não informada: 660; soma realizada 4.960 |
| Caixa | Entradas 12.000 − saídas 2.400 = saldo 9.600; quatro movimentos até a referência |
| Compras e notas | Duas compras, entrega completa/parcial, duas notas com anexos vinculados pelos IDs |
| Documentos e alterações | Um documento liberado e um aditivo aprovado; documento interno permanece oculto |

O teste da API também reconstrói as origens separadas: diário na linha `__rdo`, orçamento na linha `__orcamentos` e ponto na linha própria da obra. Um título financeiro nativo adicional de 500 e sua liquidação de 200 elevam o custo para 5.460 e os pagamentos para 2.600. O espelho canônico de uma nota legada não soma outro custo. Essa etapa é exclusiva do teste da API; não altera a prévia.

Se um arquivo de custo histórico obrigatório estiver ausente, custos ficam em conferência, com valores indisponíveis, e os diários continuam visíveis. Dados privados de pessoas, rascunhos, outra obra e documento interno não aparecem na projeção.

## Correções encontradas pela simulação

O resumo contratual antecipava recebimentos futuros, enquanto a posição da quinzena os excluía. Ambos agora usam a mesma seleção de recebimentos e medições até a referência. O calendário é o da Bahia, inclusive na virada UTC. Não há retorno ao valor legado quando existe uma lista de recebimentos cancelados.

Aportes e despesas futuros ou sem data não compõem o caixa atual. Pedidos, notas e diários usam o mesmo critério de registro ativo do motor financeiro, incluindo exclusão lógica e desativação.

## Extrato amigável

Caixa da obra apresenta data, lançamento, entrada ou saída com sinal e cor, saldo após o movimento e acesso à nota fiscal. Tipo de movimentação fica à vista; Filtros abre datas e busca. Limpar filtros restaura a consulta completa. Intervalos invertidos recebem orientação, sem apresentar total filtrado enganoso. Atualizar consulta mantém os filtros na mesma obra.

Os saldos de linha permanecem os originais, mesmo quando há filtro; não são saldos bancários. O cabeçalho conserva o saldo total do caixa da obra. O vínculo fiscal usa `notaFiscalId` ou uma única nota do `pedidoId`; múltiplas notas sem vínculo individual exigem conferência. Não há associação por valor, fornecedor ou descrição semelhante. As notas e seus anexos respeitam a política de publicação, o perfil e a permissão de documentos. A referência privada do OneDrive não sai da API.

## Impacto no DRE

Nenhum efeito adicional no resultado realizado: transparência, filtros, consulta e abertura de notas não gravam fatos financeiros. O teste compara as linhas de dados antes/depois da consulta. Orçamento é previsão; pedido é compromisso; entrega é estoque; custo e pagamento são fatos distintos. Os exemplos de pagamento/espelho do caixa e título/espelho legado não repetem o custo.

## Limites

As imagens da galeria são demonstrativas e os links `files.example.test` não são documentos reais. A autorização e o redirecionamento dos originais protegidos foram testados com o conector Graph simulado; autenticação e download reais do OneDrive precisam de homologação posterior autorizada. Documentos e decisões publicados continuam sujeitos à revisão editorial; não são todas as informações internas da empresa. Apenas as áreas liberadas e permitidas ao perfil aparecem.

Validações: `npx playwright test -c playwright.client-portal-simulation.config.mjs`; testes de API, publicação, finanças, tema e sessão; lint, verificação de design/manual, TypeScript e build local. Capturas em `artifacts/portal-simulation-*.png`.


## Correções das quatro prioridades — 14/11/2026

Resumo do caixa concentrado em um único bloco, com saldo em destaque e entradas/saídas lado a lado. No celular, o cartão de movimento usa a receita compartilhada MobileRecordCard: lançamento primeiro, data e categoria na sequência, depois valor, saldo e nota. A explicação completa dos saldos foi mantida abaixo do extrato, com orientação curta antes da lista. A verificação em 390×844 exige que o primeiro lançamento esteja na primeira tela, antes de qualquer rolagem.

Ver contrato e recebimentos junto à cobrança do Início usa a rota existente e suas permissões. No destino, competências como 2026-11 aparecem como novembro de 2026; 40.9091% aparece como 40,91%. A descrição idêntica ao título da medição não se repete. O rótulo Percentual contratual informado corresponde à origem em medições do contrato, sem confundir avanço físico. A formatação não altera os valores persistidos.

O botão compartilhado de Ajuda recebeu uma opção para manter seu texto visível em contextos como o login móvel. Os demais cabeçalhos conservam sua regra responsiva. Ajuda e manual revisados na mesma alteração. Impacto no DRE: nenhum; esta rodada altera apresentação e navegação, sem gravar ou recalcular custos, pagamentos ou cobranças.


Conferência final desta rodada: navegação completa em 1440×1000 e 390×844 aprovada, incluindo o atalho do Início ao contrato e retorno pelo navegador; descrição do primeiro movimento visível antes de 844 px; formatação novembro de 2026 e 40,91%; filtros, anexos e saldo preservados. Ajuda visível no login conferida nos dois tamanhos. Testes de formatação, sessão, ajuda, padrões e DataTable aprovados. Lint, design/manual, TypeScript e build local aprovados; detector de fonte sem ocorrências. A tabela compartilhada deixou de renderizar uma barra vazia quando não há busca nem menu de colunas; os controles existentes continuam nos contextos em que se aplicam. Não há novos passos operacionais para essa remoção de espaço vazio. Capturas de primeira tela em artifacts/portal-priorities-statement-1440.png e artifacts/portal-priorities-statement-390.png. Prévia local reaberta e conferida nos dois tamanhos. As quatro prioridades do registro de crítica de 14/11/2026 foram tratadas, sem atribuir uma nova nota de crítica nesta rodada.
