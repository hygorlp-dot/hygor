# Registro de envios e prazos de cotações

Entrega local de 30/10/2026. Sem push ou deploy. Não envia mensagens.

## Uso em Compras

Na cotação, em Fornecedores, Compras ou Administração registra o envio que já realizou: fornecedor, canal, destinatário, data/hora do envio e prazo de resposta. Gerar ou copiar o link do portal não registra envio. O prazo informado não renova a validade de sete dias do link.

A fila distingue envio não registrado, aguardando resposta, prazo vencido e retorno para conferência. O relógio atualiza a cada minuto com a tela aberta e recalcula ao reabrir. Não há cron, notificações ou lembretes automáticos.

Uma resposta efetiva pelo portal encerra a espera e segue para revisão de Compras. Para retorno por outro canal, o operador informa a data/hora e uma justificativa; isso encerra a espera e solicita conferência da proposta, sem importar preços ou aprovar compras. O primeiro recebimento conhecido determina se houve atraso.

Retificar o prazo exige justificativa e conserva o prazo anterior. Após o recebimento, o prazo não pode ser alterado para esconder atraso. Anular mantém o registro e seu histórico. Alterar itens ou fornecedor impede que um envio antigo controle o prazo da nova versão; o histórico permanece disponível.

## Integridade

Os comandos ENVIO_COTACAO_FORNECEDOR_REGISTRADO e ENVIO_COTACAO_FORNECEDOR_RETIFICADO usam o fluxo operacional transacional existente, com perfil, acesso à obra, versão da cotação e autor autenticado. O formulário conserva a versão e a chave de idempotência nas tentativas, evitando duplicar o envio após perda de conexão.

Os dados ficam em cotacoes[].enviosFornecedor, preservados na edição comum e no payload integral da projeção de cotações. Não é necessária migração. Datas inválidas/futuras, prazo anterior ao envio, fornecedor indisponível e registros duplicados são rejeitados. Atualizações guardam autor, data/hora, motivo e valores anteriores.

Não cria pedidos nem lançamentos financeiros e não altera alçadas. Nenhum provedor de mensagens foi integrado.

## Validação

- 152 testes direcionados de domínio, comandos, API, escopo, permissões e portal: artifacts/compras/dispatch-tests.log.
- Primeira regressão de Compras: 37 de 38 cenários passaram, incluindo registro, retificação, retorno e anulação em 390 e 1440 px. Evidência: artifacts/compras/dispatch-compras-regression.log. Após a correção da exportação, a suíte completa passou com 39 cenários: artifacts/compras/excel-compras-completa.log; também passaram os 307 testes de domínio, comandos, componentes e API: artifacts/compras/excel-compras-unit-completa.log.
- Na primeira rodada, a exportação para Excel excedeu 60 segundos aguardando download.path(). A investigação posterior reproduziu o cancelamento ao atrasar o consumo do endereço Blob, revogado após apenas um segundo. O helper agora mantém o endereço por 60 segundos antes de liberar a memória. Evidências e nova regressão: CORRECAO-EXPORTACAO-EXCEL-COMPRAS.md.
- Dois cenários do portal passaram: artifacts/compras/dispatch-portal-regression.log.
- Lint, tipos, arquitetura e build: dispatch-lint-final.log, dispatch-types-final.log, dispatch-architecture.log e dispatch-build.log em artifacts/compras/. Build mantém aviso de chunks acima de 650 kB.
- Detector de interface sem apontamentos: artifacts/compras/dispatch-design-detector.json; capturas dispatch-390.png e dispatch-1440.png.

Os testes usam APIs e dados simulados, sem alterar dados financeiros reais. A suíte dos demais módulos não foi repetida.
