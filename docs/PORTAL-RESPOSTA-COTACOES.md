# Portal de resposta às cotações — implementação local

Autorizado em 30/10/2026. Tudo permanece local; sem push, PR, preview remoto ou deploy.

## Fluxo

Compras expande uma cotação aberta e gera um link individual para cada fornecedor já cadastrado no mapa. Copia o endereço e o envia pelo canal escolhido. O app não dispara mensagens automaticamente.

O fornecedor abre `/responder-cotacao#codigo`, informa nome, preços por item, frete, desconto, impostos adicionais, despesas, prazo, condições, observações e até cinco anexos por link HTTPS. Zero representa item não fornecido ou cobrança inexistente. Arquivos binários não são hospedados por este portal; o destinatário precisa ter acesso aos links anexados.

A resposta é armazenada em `cotacoes[].respostasFornecedor` como pendente, com valores e itens originais. Não altera a proposta aprovada nem gera pedidos, pagamentos ou lançamentos financeiros. Enquanto houver resposta pendente, a oferta do fornecedor fica fora das escolhas do mapa e do destaque de menor custo.

Compras/Administração aceita ou rejeita com justificativa e versão atual. Aceitar importa preços, condições e documentos para a proposta daquele fornecedor. A cotação continua aberta e sua decisão/geração de pedidos passa pelos comandos e alçadas existentes. Respostas recebidas são preservadas ao editar a cotação.

## Segurança e persistência

Código HMAC com chave derivada da configuração existente de aceite de pedidos, separado por finalidade; validade de sete dias, empresa, cotação, fornecedor e impressão dos itens. Código no fragmento da URL, enviado somente no corpo do POST. A visão pública expõe apenas número, fornecedor e itens/quantidades; não expõe preços concorrentes, orçamento, dados financeiros nem cadastros internos.

Alterar itens ou trocar fornecedor invalida o link. Cotação encerrada, cancelada, apagada ou com pedidos já decididos não recebe respostas. Reenvio do mesmo código não duplica nem altera a resposta anterior. Novos códigos permitem nova resposta após revisão, respeitando o limite por cotação.

Rotas públicas aplicam limite persistente de tentativas e conferem o código antes de ler a empresa. O envio requer a conexão transacional já usada no ERP: cotação é relida dentro da trava, resposta e auditoria são salvas juntas; indisponibilidade retorna erro, sem sucesso fictício. A resposta é depois projetada na estrutura de Compras existente. Nenhuma migration nova.

A rota pública e a rota autenticada de emissão ficam em api/data.js. A revisão reutiliza o comando operacional, a autorização por obra e a idempotência do ERP. A configuração de rewrite da nova página foi adicionada localmente ao vercel.json; não foi publicada.

## Arquivos e coordenação

Domínio: supplier-quote-response.js. Código assinado e visão pública: server/supplier-quote-link.js. Interface pública: supplier-quote/SupplierQuotePage.jsx. Revisão: components/SupplierQuotePanel.jsx. Integração pontual: App.jsx, api.js, ComprasView.jsx, PurchaseFinalCost.jsx, quote-map.js e purchase-order-commands.js.

Alterações anteriores de Financeiro e histórico de preços preservadas. Não foi feito commit conjunto de arquivos compartilhados em andamento em outros chats.

## Validação local em 30/10/2026

- 119 testes direcionados de domínio, API, códigos assinados, permissões e comandos passaram em seis arquivos. Evidência: artifacts/compras/portal-tests-final.log.
- Dois testes de navegador do portal passaram em 390 e 1440 px: envio, anexos HTTPS, revisão obrigatória, total ofertado e ausência de geração automática de pedido. Evidência: artifacts/compras/portal-browser.log.
- Os 31 testes de regressão de Compras passaram, incluindo ficha conjunta, condições comerciais, permissões, recebimento parcial e histórico por material. Evidência: artifacts/compras/portal-compras-regression.log.
- Lint, tipos, arquitetura (1177 módulos) e build Vite passaram. O build manteve o aviso de chunks maiores que 650 kB.
- APIs e dados simulados no navegador; nenhum registro financeiro real foi alterado. Estes testes não substituem uma validação futura da conexão transacional no ambiente publicado.

A ferramenta de navegador desta sessão mostrou somente about:blank, sem acesso à aba nativa autenticada da Vobi. Portanto não houve nova varredura ao vivo da Vobi nesta validação.
