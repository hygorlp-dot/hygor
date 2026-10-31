# Condições de faturamento e entrega preservadas nos pedidos

Etapa 7 de Compras, implementada localmente em 30/10/2026. Sem push ou deploy.

## Operação

Nos formulários de proposta e pedido, “Faturamento e entrega” reúne destinatário/documento e condições de faturamento, endereço, contato e condições de entrega. Condições de pagamento e previsão continuam disponíveis. Campos vazios significam “Não registrado”; a origem do pagamento não determina o destinatário da nota.

Ao gerar pedidos pela cotação, os campos vêm da proposta escolhida no servidor, inclusive quando a decisão divide a compra entre fornecedores. Cada pedido guarda suas próprias condições e o prazo em dias da proposta, quando registrado. O caminho antigo de cotação com um material também copia as condições.

O carregamento da aplicação também preserva os campos adicionais da proposta (incluindo custo final e pagamento). A edição mantém o número existente da cotação. A ausência de prazo permanece desconhecida após recarregar a página. O teste de condições comerciais reabre a cotação após a recarga e confere esses valores.

A ficha conjunta apresenta a versão vigente e o histórico das condições, com autor, data/hora e motivo. O texto de envio manual e o documento imprimível incluem as condições preservadas, com escape de HTML. Nenhuma mensagem é enviada automaticamente.

## Histórico e integridade

- Pedidos novos recebem a primeira versão das condições no comando de criação. A captura usa dados existentes nesse momento, sem inferir destinatário da nota ou endereço de entrega pelos cadastros.
- Alterações de condições, fornecedor/obra, origem do pagamento, previsão ou programação por item geram nova versão. Quantidades, unidades, datas próprias e remessas planejadas ficam preservadas. Recebimentos efetivos não são tratados como renegociação. A revisão comum continua exigindo motivo e versão do pedido aberto no formulário. A previsão confirmada no aceite do fornecedor também conserva a anterior.
- Alterar nomes, documentos ou endereços nos cadastros não reescreve o histórico do pedido. Leituras não consultam esses cadastros para completar as condições preservadas.
- O formulário não substitui nem apaga historicoCondicoesPedido: a trilha é montada pelo comando no servidor, com autor autenticado. Um ajuste sem mudança de condições não cria nova versão. Há limite de 100 versões, com rejeição explícita, sem truncamento.
- Pedidos antigos permanecem sem snapshot até uma mudança de condições. Quando são complementados, a trilha registra os dados anteriormente disponíveis como “legado”, sem atribuir nomes ou documentos atuais ao passado. O acordo original permanece explicitamente não comprovado. A data de registro é a data da conferência, sem retroagir à emissão do pedido.
- O prazo ausente em novas cotações fica desconhecido (null), em vez de ser convertido em zero. Dados históricos já gravados não são reinterpretados.

Os snapshots ficam dentro do pedido, na projeção existente cujo payload conserva o objeto completo. Não há migração nem preenchimento em lote. O fluxo reutiliza os comandos, travas, permissões e alçadas existentes. Não cria notas, pagamentos ou lançamentos financeiros.

## Evidências locais

Em artifacts/compras/:

- conditions-first.log: 57 testes iniciais passaram.
- conditions-browser.log: dois fluxos completos, em 390 e 1440 px, passaram, incluindo edição, recarga, versão anterior e mudanças cadastrais simuladas.
- conditions-final-tests.log: 323 testes passaram em 38 arquivos de domínio, componentes, comandos, portal e API.
- conditions-reload-confirmed.log: teste reforçado de recarga da cotação passou, incluindo faturamento, entrega, pagamento, frete e ausência de prazo.
- conditions-final-browser.log: 41 de 41 cenários de navegador de Compras passaram, após os ajustes do carregamento e número da cotação; inclui a recarga das condições comerciais e as duas exportações para Excel.
- Lint, tipos, arquitetura e build passaram: conditions-final-lint.log, conditions-final-types.log, conditions-quality-architecture.log e conditions-final-build.log. O build mantém o aviso de pacotes acima de 650 kB.
- conditions-design-detector.json: detector sem apontamentos; conditions-390.png e conditions-1440.png: capturas revisadas.

Todos os testes usam dados e APIs simulados. Nenhum registro financeiro real foi alterado.
