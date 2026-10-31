# Roadmap de Compras a partir da varredura da Vobi

Autorização: 30/10/2026. Entrega local, sem push, PR, preview ou deploy. Base: VARREDURA-VOBI-COMPRAS-2026-10-30.md. Manter as alçadas, revisão de Compras e registros financeiros existentes.

Situação: etapas 1 a 7 implementadas localmente. Contratos e medições reutilizam os cadastros, comandos e lançamentos existentes. O acompanhamento de envios não dispara mensagens. Os pedidos agora preservam versões das condições de faturamento e entrega.

## Etapa 1 — retorno e revisão dos fornecedores

Implementação local: fila nas cotações, respeitando obra, busca e período da lista. Situações distintas para aguardando retorno, aguardando revisão, aceita, rejeitada e proposta cadastrada fora do portal. Prioridade para revisão pendente; acesso direto à cotação. Data de recebimento vem da resposta efetiva. Um link gerado não comprova envio nem abertura.

Critérios: propostas legadas não aparecem como respostas recebidas; uma troca de fornecedor não herda a resposta anterior; consultar a fila não dispara comandos ou mensagens; aceitar resposta continua exigindo justificativa e versão e não gera pedido.

## Etapa 2 — comparação visual

Implementação local: detalhe inline com contexto da cotação e abas Comparativo, Fornecedores, Histórico de preços e Documentos. A primeira abertura prioriza Fornecedores quando existe resposta para revisar. O mapa mantém cabeçalhos e identificação do material durante a rolagem interna. As ofertas pendentes não aparecem como preço elegível. Custo final, adicionais, cobertura e nota do fornecedor permanecem visíveis no contexto de comparação. Edição e geração de pedidos preservam os comandos e permissões existentes.

Critérios: navegação por teclado; sem rolagem horizontal da página em celular; revisão continua acessível; não apresentar totais pendentes como zero nem inferir ausência de frete pela falta de dado.

## Etapa 3 — histórico no momento da decisão

Implementação local: referência na própria cotação, por identidade do material e unidade, usando recebimentos com custo final documentado da mesma obra até a data da cotação. Excluir a própria compra para evitar comparação circular. Mostrar variação por oferta elegível e permitir consultar a compra de origem. Ofertas e históricos sem conversão/custo documentado ficam sem comparação numérica.

Histórico geral: exportação do recorte filtrado para Excel com base, unidade, quantidade, preço dos itens, custo final e indicação de dados incompletos. Exportação local, sem consulta adicional ao servidor.

Critérios: não misturar homônimos, obras, unidades ou dados posteriores à cotação; preservar números e datas como tipos de planilha; exportar somente as linhas selecionadas pelos filtros.

## Etapa 4 — ficha e pendências

Implementação local: resumo de conferência, contagem de pedidos com entrega pendente, pedidos sem nota vinculada e anexos com endereço inválido. Links internos levam à seção correspondente; navegação permanece visível durante a consulta. Quantidade a receber explícita por item, sem somar unidades incompatíveis.

Critérios: indicação de conferência não é bloqueio novo de pagamento nem aprovação; pedido cancelado não produz pendência; nota cancelada não resolve a ausência de nota ativa; anexos e vínculos existentes continuam acessíveis.

## Etapa 5 — contratos e medições integrados

Implementada em Compras → Consultas e cadastros → Contratos e medições. Fornecimento reutiliza seus contratos e saldos, com acesso aos pedidos. Serviços reutilizam terceirizados/medicoesTerc, com ficha de documentos e origem dos movimentos. A operação abre o TerceirosView existente, respeitando perfil e obra.

Valores aprovados, baixados e a pagar vêm do razão financeiro. Notas e pagamentos espelhados seguem a deduplicação existente; abrir a ficha não cria lançamentos. Permissões de Terceiros não foram ampliadas. Detalhes e evidências: CONTRATOS-MEDICOES-COMPRAS.md.

## Etapa 6 — registro de envios e prazos

Implementada: registro declarado do envio por fornecedor, canal, destinatário, data/hora e prazo. Fila com envios não registrados, respostas aguardadas e atrasos; recebimentos pelo portal ou declarados por outro canal encerram a espera. Retificações e anulações mantêm justificativa e histórico. Gerar link não comprova envio, não dispara comunicação e não prorroga o token. Perfis, escopo de obra, versão e idempotência são verificados. Detalhes e evidências: ENVIOS-PRAZOS-COTACOES.md.

## Etapa 7 — preservação de dados históricos

Implementada: propostas e pedidos registram faturamento e entrega; a geração de pedidos copia as condições da proposta vencedora e mantém snapshots versionados no pedido. A ficha e o documento imprimível usam os dados preservados. Ajustes e aceite com alteração de previsão conservam as versões anteriores. Dados ausentes e acordos legados não comprovados ficam explícitos, sem preenchimento retroativo pelos cadastros atuais. Permissões, alçadas e lançamentos financeiros existentes são mantidos. Detalhes e evidências: CONDICOES-HISTORICAS-PEDIDOS.md. Comunicação automática continua fora do escopo autorizado.

## Validação

Resultados desta rodada:

- 142 testes direcionados passaram em dez arquivos: domínio, API, permissões, comandos, exportação e segurança do portal. Evidência: artifacts/compras/roadmap-tests.log.
- 33 cenários de navegador de Compras passaram, incluindo os dois novos fluxos em 390 e 1440 px. Evidência: artifacts/compras/roadmap-compras-regression.log.
- Dois cenários completos do portal passaram na repetição. A primeira execução encontrou a página pública vazia no prazo de cinco segundos; a repetição passou sem alteração funcional. Evidências: roadmap-portal-regression.log e roadmap-portal-retry.log, em artifacts/compras/.
- Após os últimos ajustes de conferência/rolagem/rótulo, os 17 testes de domínio afetados e três cenários de navegador de retornos e ficha passaram novamente. Evidências: roadmap-domain-final.log e roadmap-ui-final.log.
- Lint, tipos, arquitetura e build passaram. O build mantém o aviso de chunks acima de 650 kB. Evidências: roadmap-lint-final.log, roadmap-types-final.log, roadmap-architecture.log e roadmap-build-final.log.
- Detector das novas interfaces sem apontamentos; capturas móveis e desktop revisadas. Evidência: roadmap-design-detector.json.

Somente APIs e dados simulados nos testes de navegador. Nenhum dado real da Vobi ou do ERP foi alterado. A suíte geral dos demais módulos não foi repetida; alterações concorrentes de outros chats foram preservadas. Nada foi enviado ou publicado.
