# Compras, Supabase e DRE

Pedido representa compromisso. Recebimento movimenta estoque. Pagamento representa saída de caixa. O custo de compras exige documento de competência reconhecido e usa a mesma regra do razão consumido pelo DRE. Nenhuma dessas etapas cria nota fiscal automaticamente.

`server/procurement-financial-facts.js` projeta os documentos reconhecidos e seus rateios por obra a partir do razão. Pedidos mantêm seus títulos e liquidações existentes, com reconhecimento de custo zero e metadados `financialKind: commitment`. A sincronização idempotente desativa os antigos eventos de custo de pedido, preservando seu histórico. Documentos vinculados à medição de terceiro não geram outro custo de compras.

O gate `compareProcurementDreRecognition` compara os eventos persistidos com o razão por obra e competência, independentemente da comparação da sombra com seu próprio escritor. É executado na publicação e disponibilizado em `divergenciasComprasDRE` no diagnóstico financeiro. Custo de pedido indevido, documento omitido e competência/obra incorretas impedem a aprovação do gate.

O prebuild de solicitações executa backfill transacional sob bloqueio da linha operacional. Atualiza os registros existentes, inclusive cancelados, preserva a data original de criação e mantém registros extras para rastreabilidade. Não exclui registros de teste automaticamente. O payload e a versão são conferidos após a gravação.

Recebimentos e alterações financeiras também atualizam o payload do pedido em `core_purchase_orders`. Uma repetição idempotente pode reparar o espelho sem repetir a operação financeira ou de estoque. Mapas de cotação usam o primeiro material real nas colunas de compatibilidade e conservam todos os itens no payload, sem somar quantidades de unidades diferentes.

## Validação de uma publicação

- Executar testes do razão, projeção financeira/DRE, comandos e integrações de Compras, além do fluxo no navegador.
- Conferir no PostgreSQL que uma segunda sincronização não duplica títulos/liquidações e preserva ID, valor, data e vínculo dos pagamentos.
- Capturar antes e depois os registros operacionais de pagamento e notas; verificar que o reparo não os alterou nem criou documentos.
- Consultar presença e conteúdo de solicitações, cotações e pedidos, além dos custos reconhecidos por obra/competência.
- Não classificar pagamentos sem documento como custo automaticamente. Manter a pendência visível no razão até o registro do documento real.

A auditoria de 23/10/2026 identificou pagamentos de compras sem documento reconhecido. O reparo corrige o critério da projeção, sem decidir datas ou valores de documentos ausentes. Excedentes de recebimentos de clientes e transações bancárias não classificadas exigem documentação própria; não são corrigidos por alterar pagamentos ou receitas arbitrariamente.
