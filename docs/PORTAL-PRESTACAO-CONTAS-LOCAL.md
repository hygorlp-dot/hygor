# Prestação de contas e incidência da administração

Revisão em 14/11/2026. Implementação e testes locais, sem push, publicação ou envio a clientes.

## Origem dos valores e DRE

O PDF usa o mesmo razão canônico da obra e competência da consulta. Categorias são custos reconhecidos; pagamentos usam datas efetivas e são mostrados separadamente. Benefícios e rescisões são mantidos em suas categorias. Reservas e encargos complementares vêm do modelo de equipe já aprovado, com desconto do que está embutido no custo. Compras/compromissos, estoque, reconhecimento e desembolso não são somados como se fossem fatos distintos de custo.

O extrato provém do caixa da obra, com o saldo original de cada movimento. Saldo anterior + entradas − saídas = saldo final do recorte. Notas são vinculadas por IDs e seus anexos continuam no leitor autenticado do portal; o PDF apresenta o índice, sem incorporar os documentos fiscais originais.

Cobranças emitidas são separadas de estimativas. Na consulta histórica, pagamentos posteriores ao fim do período não reduzem o saldo daquela posição. Uma previsão da administração não gera título, cobrança, pagamento ou lançamento no DRE. Reservas adicionais continuam gerenciais e não alteram o resultado realizado.

Foi corrigida a composição da base da administração: notas fiscais deixam de ser classificadas integralmente como material apenas por serem notas. O cálculo usa as categorias do razão, incluindo materiais pagos diretamente pelo caixa. Equipamentos e engenharia não podem reaparecer em outras parcelas da base.

## Opções do contrato

Equipamentos / locação e Engenharia de campo têm incidência independente. Desmarcar remove apenas sua participação na base da taxa, preservando o custo total da obra e o DRE realizado. A configuração exige categoria explícita para excluir engenharia; não classifica profissionais ou despesas por semelhança de nomes. A categoria é escolhida entre os cadastros existentes. Contratos anteriores sem essas opções conservam a incidência anterior até alteração explícita. A regra vale também no contrato misto quando a inclusão for expressa.

## PDF, e-mail e WhatsApp

Em Administração e equipe, o arquivo acompanha o Mês da consulta. Em Financeiro, usa o mês atual. Baixar prestação de contas retorna um PDF real. Compartilhar PDF usa compartilhamento de arquivo do aparelho; sem suporte, baixa o arquivo para anexação manual. Preparar e-mail com PDF gera `.eml` com o PDF incorporado, destinatário igual ao usuário conectado, remetente previsto financeiro@marcelleng.com.br e marcador de rascunho. Não envia e-mail nem garante a autenticação do remetente.

O endpoint revalida sessão, vínculo com a obra, publicação atual dos custos, custos disponíveis e permissão de download. Seções e anexos respeitam as permissões de cada área. CPF, PIX, dados médicos e custos de outra obra não entram no relatório.

O financeiro foi informado pelo usuário como +55 (81) 98975-1300. A consulta somente de leitura da sessão WAHA `marcell-test`, reaproveitada da automação local de comprovantes, confirmou estado WORKING e identidade correspondente ao financeiro. Não foram alterados o worker, fila, políticas, certificado, contatos ou comprovantes dos funcionários.

`server/client-statement-delivery.js` prepara os dois canais, confere o remetente da sessão WAHA e resolve o destinatário antes de chamar o mesmo protocolo de envio de PDF. O dispatcher exige ativação explícita, transporte configurado e reserva atômica. Simulações não executam transportes; aceitação pelo provedor é distinta de entrega. Resultados incertos permanecem reservados e não são reenviados automaticamente. Revisões alteradas exigem número de revisão explícito para nova entrega. A integração de e-mail continua pendente de uma conta/serviço autenticado para envio pelo remetente solicitado; nenhum segredo foi criado ou solicitado para a simulação.

Não há agendamento nem disparo real ativado. O dispatcher não substitui emissão de cobrança e usa somente saldos de cobranças já emitidas no texto de cobrança, sem transformar custos ou estimativas em dívida nova. A fila de prestação de contas é independente do cofre fiscal de ponto.

## Simulação e evidências

Servidor isolado: `node scripts/client-portal-local-server.mjs --accountability`, porta 4200. Banco PostgreSQL em memória, dados fictícios, sem leitura de `.env` ou escrita remota. A revisão B2-04 na porta 4199 permanece separada.

Ensaio: `node scripts/client-portal-accountability-audit.mjs`. Confere quatro áreas no desktop/celular, download do PDF pela interface, quatro anexos fictícios, totais, saldos, os dois canais em modo simulado e repetição bloqueada. O ensaio grava PDF em `output/pdf` e evidências privadas em `C:/dev/marcell-local-review/accountability`.

Resultados do cenário: custo registrado R$ 10.140,00; complementos da equipe R$ 392,19; repasse previsto R$ 10.532,19. Taxa de 12% sobre base de R$ 8.532,19: R$ 1.023,86; já emitida R$ 500,00; a emitir estimado R$ 523,86. Locações R$ 800,00 e engenharia R$ 1.200,00 permanecem no custo, excluídas da taxa. Caixa: entradas R$ 12.000,00, saídas R$ 3.380,00, saldo R$ 8.620,00. Cobranças emitidas em aberto: R$ 8.000,00. Os R$ 523,86 previstos não foram somados a esse saldo.

Ajuda e manual revisados junto aos fluxos. Validação inclui testes de regras, permissões, histórico, valores e duplicidade, lint, tipos, build local e inspeção do PDF renderizado.
