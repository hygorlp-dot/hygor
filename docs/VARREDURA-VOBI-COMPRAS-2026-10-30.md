# Varredura funcional de Compras na Vobi — 30/10/2026

## Escopo e acesso

Acesso autenticado confirmado pelas ferramentas de navegador. A aba disponível inicialmente estava em Financeiro → Relatórios; a consulta de Compras ocorreu em outra aba. Isso comprova acesso à Vobi nesta sessão, sem comprovar que a ferramenta controla o mesmo painel nativo mostrado na conversa.

Somente consultas, abertura de detalhes, troca de abas e pesquisa. Nenhuma aprovação, alteração de preço, recebimento, envio ao fornecedor, criação de pedido ou lançamento financeiro. Nenhum push ou deploy. Esta é uma varredura funcional e comparação com fontes locais, não uma auditoria exaustiva nem uma execução dos fluxos de gravação da Vobi.

## Evidências observadas

### Solicitações

Rota: https://plataforma.vobi.com.br/profissional/gestao-de-compras/solicitacoes

Busca por código/nome, período, filtro adicional e contadores por etapa: rascunho, abertas, aprovadas, cotação, compra e contratação, recusadas, finalizadas e todas. A tabela reúne projeto, criação, necessidade, custo previsto, prioridade, responsável, autor e origem. Existe ação para consultar histórico do agente de IA; seu conteúdo não foi inspecionado.

### Cotações e fornecedores

Rota: https://plataforma.vobi.com.br/profissional/gestao-de-compras/cotacoes

A lista mostra custo orçado junto do nome e permite expandir fornecedores com oferta e status. Os contadores distinguem aberta, resposta pendente e cotada. O detalhe abre em painel amplo com resumo de contexto, abas Dados, Fornecedores e Mapa de cotações.

O mapa compara fornecedor por coluna e item por linha, incluindo quantidade, unidade, necessidade, quantidade ofertada, valor unitário, total e subtotal. Foram observadas ações de exportação, compartilhamento com cliente e visualização como fornecedor; não foram acionadas.

A aba Fornecedores reúne status da resposta, oferta, data de envio, data de resposta e contato. Há links de WhatsApp por fornecedor, não acionados. A existência de links não comprova disparo automático nem rastreio de abertura.

### Ordens de compras

Rota: https://plataforma.vobi.com.br/profissional/gestao-de-compras/ordem-de-compras

A lista separa situação do pedido da ação de recebimento e mantém vínculos com solicitação/cotação. O detalhe consultado mostra aprovação com autor/data, quantidades compradas, a receber e recebidas, anexos, parcelas/vencimentos, dados de faturamento, endereço de entrega e observações. Ações de gerar lançamento e receber itens foram apenas observadas.

### Contratos

Rota: https://plataforma.vobi.com.br/profissional/gestao-de-compras/contratos

Alternância entre Contratos e Medições. Indicadores de valor contratado, medido, pago e saldo, além de progresso por contrato. A tela de medições e os detalhes contratuais não foram abertos.

### Panorama

Rota: https://plataforma.vobi.com.br/profissional/gestao-de-compras/panorama

Seleção de projeto, orçado/realizado e colunas de quantidades orçadas/compradas, custo médio e desvio de custo total. O projeto consultado retornou ausência de visualização; não foi validado um panorama preenchido nem o cálculo dos indicadores.

### Histórico de preços

Rota: https://plataforma.vobi.com.br/profissional/gestao-de-compras/historico-de-precos

Pesquisa por nome e período, grade ordenável com item, unidade, custo unitário, data, projeto, fornecedor e ordem de compra. Exportações PDF e CSV disponíveis; nenhum arquivo foi exportado.

Uma pesquisa por CIMENTO retornou materiais cuja descrição contém esse termo, incluindo argamassa. Um resultado apresentou unidade ausente. Isso reforça a necessidade de manter a seleção por identidade cadastral e não calcular médias indiscriminadas por correspondência textual.

## Comparação com nossa implementação local

- O histórico local já separa pedidos de recebimentos, usa identidade do material, normaliza unidades com fator, distingue preço do item de custo final e oferece média ponderada e abertura da compra de origem. Preservar essas regras. O componente MaterialPriceHistory não oferece exportação nem referência contextual diretamente dentro da cotação.
- O portal local já recebe propostas separadamente e exige revisão de Compras, versão atual e justificativa; aceitar não gera pedido. SupplierQuotePanel ainda apresenta respostas em sequência, sem uma fila consolidada de fornecedores aguardando retorno. A geração de um link, por si só, não comprova seu envio ou abertura.
- O comparativo local já inclui frete, desconto, impostos e despesas e restringe o destaque a cestas completas comparáveis. A oportunidade é organizar o espaço visual, não substituir essas regras pela simples marcação do menor preço.
- A ficha conjunta local já reúne pedidos, notas, aprovações, pagamentos e anexos. A navegação pode usar resumo permanente e seções claras para reduzir a rolagem.
- A fila local já permite filtros por obra, risco, aprovação e recebimento e agrupamento por fornecedor. Enriquecer suas pendências com resposta de cotação é mais coerente que criar outro painel desconectado.
- O repositório possui ContratosFornecimentoView e supply-contracts para preços e saldos de fornecimento. Isso não estabelece equivalência com o fluxo de medições de serviços observado na Vobi; avaliar esse fluxo separadamente antes de ampliar o escopo.

## Melhorias prioritárias sugeridas

1. **Fila de fornecedores da cotação:** aguardando retorno, recebido e aguardando revisão, aceito e rejeitado. Mostrar prazo solicitado, data real de envio quando registrada e data de recebimento. Lembretes inicialmente preparados para envio manual, sem mensagens automáticas.
2. **Comparação visual:** painel amplo com resumo de obra/prazo/orçamento, abas de proposta e documentos, identificação do item sempre visível e totais claros. Manter leitura por padrão; edição e decisão continuam explícitas e sujeitas às permissões existentes.
3. **Histórico útil na decisão:** mostrar último preço comparável e variação ao lado da proposta, com origem consultável. Exportar somente o recorte filtrado, com unidade e base de preço explícitas.
4. **Ficha da compra mais fácil de consultar:** resumo de aprovação, entrega, faturamento e pagamentos; documentos agrupados e contadores de pendências. Avaliar snapshot dos dados de entrega/faturamento se o cadastro atual não preservar o contexto histórico.
5. **Contratos e medições:** estudo próprio para distinguir contratação, execução medida e pagamento. Não tratar medição como recebimento de material nem gerar lançamentos duplicados.

## Limites

Não foi testado o portal público da Vobi, envio de mensagens, aprovação, anexos com conteúdo, exportações, medições ou comportamento móvel. Não se presume que funcionalidades locais estejam publicadas. Nenhuma mudança funcional adicional foi implementada nesta varredura.
