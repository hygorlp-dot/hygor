# Contratos e medições em Compras — entrega local

Implementação autorizada em 30/10/2026, no repositório C:/dev/repositorio-mrc. Sem push, PR ou deploy. Os dados de produção não foram usados para testar gravações.

## Acesso e fluxo

Compras → Consultas e cadastros → Contratos e medições.

**Fornecimento:** reutiliza ContratosFornecimentoView e contratosFornecimento, com filtros de obra do módulo. Os pedidos vinculados abrem a ficha conjunta existente com recebimentos, notas e pagamentos. Um contrato geral continua considerando consumo de todas as obras para não oferecer saldo já reservado; os documentos exibidos respeitam o recorte da obra. Operadores vinculados a uma obra consultam os acordos; a edição dos acordos gerais permanece com Compras/Administração sem vínculo fixo de obra.

**Serviços e medições:** consulta os contratos por medição em terceirizados e os registros em medicoesTerc. Há busca por contrato/obra, filtros de revisão/saldo/ausência de medição e inclusão explícita do histórico de contratos arquivados e cancelados. A ficha reúne medições, documentos e movimentos financeiros de origem.

A operação abre o próprio TerceirosView com contratoInicial e obraIdFixo. Nova medição usa o formulário já existente, com evidência e aprovação financeira. Não há segunda coleção de contratos de serviço, medições ou pagamentos. Voltar preserva a consulta; mudar a obra encerra a abertura anterior.

## Valores e prevenção de duplicidade

- Contratado: valor do contrato ou soma das etapas, conforme a estrutura existente.
- Medido: aprovado mais medições enviadas e ainda em revisão. Rejeitadas não são somadas ao valor reconhecido.
- Aprovado, baixado e a pagar: derivados de buildFinancialLedger/selectAccountsPayable, por identidade da medição e obra. A consulta não recalcula o caixa somando pagsTerceiros e pagamentos de notas.
- A nota vinculada documenta a medição; não cria novo custo. Espelhos do mesmo pagamento seguem a deduplicação do razão.
- Um estorno volta a abrir o saldo da obrigação. Não se registra nova despesa para compensá-lo.
- Pagamentos sem medição permanecem apresentados separadamente, para conferência de vínculo. A consulta não associa por valor, nome ou proximidade de datas.
- Contratado a aprovar é contratado menos aprovado; a pagar é o saldo de cada obrigação após suas baixas. São conceitos diferentes.
- Medições de clientes (medicoes) não entram nesta visão de serviços contratados.
- Registros legados sem obra ou com vínculo divergente recebem indicação de conferência e não são agregados ao recorte. Não há backfill automático.

## Permissões

A leitura de serviços mantém podeAcessarAba(usuario, 'terc'), inclusive permissões personalizadas. Não foi concedido acesso a Terceiros ao perfil Compras. A operação mantém os perfis já existentes; registrar medição continua restrito aos perfis habilitados no módulo, e aprovar/pagar continua passando pelos comandos, versões e alçadas existentes. A autorização do servidor não foi ampliada.

Abrir a ficha, consultar documentos ou abrir o formulário não gera comandos nem movimentação financeira. Anexos são abertos somente com endereço HTTPS válido; documentos sem endereço continuam identificados para conferência.

## Arquivos

service-contract-position.js concentra a projeção de consulta. PurchaseContractsWorkspace.jsx organiza as duas abas e reutiliza a operação original. ServiceContractDetail.jsx apresenta origem, medições e documentos. ComprasView.jsx integra o acesso. Nenhuma alteração de persistência, migration, API ou motor financeiro foi necessária nesta etapa.

## Validação

- O lote de regressão de domínio passou com 75 testes em oito arquivos: contratos de fornecimento, medições de obra, razão, comandos de terceiros, mutações de pagamento, vínculos de nota e navegação já existente. Evidência: artifacts/compras/contracts-tests.log.
- O modelo desta entrega foi repetido com dez testes, incluindo dois casos adicionais de vínculo vazio e obra vazia. São 77 casos distintos ao considerar o lote anterior, sem contar as repetições. Evidência: contracts-domain-final.log.
- A suíte de Compras passou nos 36 cenários de navegador. Os três cenários novos verificam celular/desktop, nota/pagamento espelhados, formulário original de medição, retorno, troca de obra e restrição do perfil Compras. Evidência: contracts-compras-regression.log.
- Lint, tipos, arquitetura e build passaram. O build conserva o aviso de chunks acima de 650 kB. Detector das novas interfaces sem apontamentos. Evidências: contracts-lint-final.log, contracts-types-final.log, contracts-architecture.log, contracts-build-final.log e contracts-design-detector.json.
- Capturas em 390 e 1440 px revisadas em artifacts/compras/contracts-390.png e contracts-1440.png. Ações operacionais foram mantidas à esquerda para não coincidirem com o botão flutuante de chat.

Os testes de navegador usam APIs e anexos simulados. A suíte geral dos demais módulos não foi repetida em paralelo com o trabalho de outros chats. Nenhum registro financeiro real foi alterado, e alterações locais de Financeiro, RH e medições em andamento foram preservadas.
