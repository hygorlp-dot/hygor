# Roadmap MARCELL a partir das atualizações da Vobi

Revisão: 14/11/2026. Autorização: traçar o roadmap e começar a implementação. Desenvolvimento e validação locais; sem push, PR, deployment, migração de banco ou operação sobre registros reais.

## Objetivo e referências

Completar controles e integrações aproveitando os módulos existentes. A comparação consultou as publicações de 2025 e 2026 da [central de atualizações da Vobi](https://ajuda.vobi.com.br/pt-br/collections/2612734-atualizacoes), com prioridade para [contratos e comprometido](https://ajuda.vobi.com.br/pt-br/articles/12956027-atualizacoes-vobi-22062026), [permissões e importações](https://ajuda.vobi.com.br/pt-br/articles/12956032-atualizacoes-vobi-14092026) e [orçamento e financeiro](https://ajuda.vobi.com.br/pt-br/articles/12956035-atualizacoes-vobi-03112026). As prioridades abaixo são decisões para o MARCELL, não uma reprodução integral dos recursos da Vobi.

## Sequência de entregas

| Etapa | Entrega | Dependência e aceite | Situação |
| --- | --- | --- | --- |
| 1A | Consulta de compromissos por origem em Custos por etapa | Compras ainda não faturadas pelo razão; contratado, medições aprovadas, em revisão, a pagar e saldo a medir de terceiros; memória e avisos; sem criar fatos ou somar bases sobrepostas | Concluída e validada localmente |
| 1B | Consolidar compromissos por etapa e alimentar a previsão | Vínculo do contrato inteiro a uma etapa de primeiro nível, pedidos do mesmo escopo, união de custos do razão e referência automática sem duplicidade; novas bases preservam a revisão manual e exigem reconferência | Concluída e validada localmente |
| 1C | Cobertura do estoque na previsão | Definir estoque disponível, reservado, aplicado e valorização; deduzir compras já recebidas sem reconhecer custo duas vezes; manter origem, unidade e obra | Concluída e validada localmente |
| 2 | Retenção técnica de garantia | Distinguir garantia de retenções tributárias; definir por medição, motivo, condição de liberação e beneficiário; comandos versionados e idempotentes, autorização e histórico; bruto, líquido pago e saldo retido conciliados | Concluída e validada localmente |
| 3A | Colunas configuráveis nas listas financeiras | Reutilizar DataTable e componentes existentes; preferência por usuário/lista, restaurar padrão, coerência com exportação e acesso; não mudar conteúdo ou valor persistido | Concluída e validada localmente |
| 3B | Reversão segura de importações bancárias | Lote, original e versões rastreáveis; prévia dos reversíveis e protegidos; preservar conciliados, pagos ou utilizados; justificativa, autorização e auditoria; demais origens exigem revisão | Concluída e validada localmente no escopo bancário |
| 4 | Completar seis níveis do orçamento | Limite único de seis etapas; criação, movimento de subárvore, cópia e importação com pais/numeração conferidos; itens no sexto, totais, planejamento, medições e exportação; rejeitar órfãos, ciclos e sétimo nível no servidor | Concluída e validada localmente |
| 5 | Perfis configuráveis por ação | Inventário das autorizações atuais e migração conservadora; separar consultar/criar/editar/excluir/aprovar; negar no servidor, incluindo chamada direta; preservar escopo de obra e exceções do domínio | Planejada; mudança transversal |
| 6 | Complementos de produtividade | Reutilizar consulta de CNPJ nos cadastros faltantes; exportação conjunta dos diários; auditar precisão dos unitários em importação/cálculo/saída; avaliar 180 parcelas somente diante de necessidade operacional | Backlog após prioridades anteriores |
| 7 | Integrações externas e multiempresa | Escopo próprio para captura/emissão fiscal, Open Finance, agentes WhatsApp/e-mail e assinatura eletrônica; multiempresa exige segregação real por CNPJ e consolidação, não troca de logomarca | Dependem de definição de serviço, credenciais e autorização de ativação |

Não há estimativa de calendário ou prazo contratual nesta sequência. Cada etapa deve terminar com regras verificadas, fluxo de navegador desktop/celular, ajuda/manual e pacotes dentro dos limites existentes antes de ampliar seu escopo.

## Primeira entrega: consulta sem gravação

Em Financeiro → Custos por etapa, cada obra passa a apresentar **Compromissos por origem**. A consulta usa a posição atual dos cadastros carregados; não reconstitui o que era conhecido na data de corte dos custos. A abrangência fica explícita na tela e no memorial.

- Compras: `selectCommitments` e `positionEntries` reutilizam o razão canônico, descontando o faturamento reconhecido. Consultar o saldo abre seu memorial existente.
- Serviços: reutiliza `serviceContractPositions`, compartilhando o razão já carregado. Mostra contratos por medição ativos, inclusive os que exigem conferência. Arquivados, cancelados, encerrados e inativos não geram novo saldo a medir nesta consulta; fatos históricos continuam no razão.
- Saldo a medir = máximo entre zero e contratado menos medições aprovadas. Rascunhos permanecem em revisão. Baixas financeiras afetam a obrigação a pagar, sem diminuir novamente o saldo a medir.
- Medição e nota/pagamento espelhados seguem a deduplicação existente. Medição de outra obra não é agregada; vínculo divergente exige conferência. Pagamento sem medição não é alocado por aproximação.
- Contrato sem valor confiável permanece visível com aviso. O valor não é fabricado e o agregado é identificado como subtotal calculável.
- As origens não são somadas em um novo total geral. Estoque, contratos de fornecimento que geram pedidos e contratos comerciais com clientes não viram compromissos adicionais por cópia. Isso evita apresentar uma consolidação sem comprovação de não sobreposição.
- A estimativa para concluir e o custo final vigentes permanecem com seus motores. O operador pode consultar os compromissos antes de revisar o restante; a integração automática depende de 1B/1C.

Implementação: `src/domains/financeiro/work-commitments.js`, `src/features/financeiro/WorkCommitments.jsx` e integração em `WorkStageCosts.jsx`. A projeção de Compras aceita o razão existente como parâmetro opcional, sem alterar seu comportamento padrão. Sem nova persistência ou ampliação de permissões; a consulta usa somente as informações já projetadas para a sessão.

## Restrições permanentes

- Preservar Comercial → Contratos, vínculo com Obras, cláusulas protegidas, revisões e permissões. PDF/DOCX continua desativado. Este roadmap não autoriza emissão ou alteração da minuta.
- Reutilizar a base visual MARCELL, tokens, componentes e controles. Não aumentar baseline de exceções ou limites de pacote.
- Não lançar pagamentos, baixar obrigações, aprovar medições ou enviar mensagens automaticamente.
- Não confundir implementação local de uma integração com ativação de um provedor externo ou publicação do ERP.

## Evidências

Validação da etapa 1A em `artifacts/vobi-roadmap/`:

- 454 testes passaram em 55 arquivos de Financeiro, integração de contratos de serviços, Contratos comerciais, projeção, autorização e ajuda (`tests.log`). O lote inicial de 22 testes também passou, sem ser somado novamente ao total.
- 16 cenários passaram no navegador em desktop 1440 × 1000 e celular emulado 390 × 844: consulta e busca, saldos separados, baixa espelhada, valor indisponível, memorial e retorno, ausência de comandos de escrita, ajuda, previsão e preservação do fluxo de Contratos (`browser.log`).
- Build local (`npx vite build`), lint/design/manual, TypeScript e arquitetura passaram. Ajuda contextual revisada e manual regenerado, com 119 guias cobrindo 65 abas.
- Pacotes gzip: global 1.876.631 bytes para limite de 1.891.328; financeiro 181.617 para limite de 208.896. Nenhum limite, baseline ou configuração de empacotamento foi aumentado (`bundle-metrics.json`).
- Detector da introdução retornou `[]`. Revisão visual independente pediu a troca dos dois acessos de consulta por RecordAction; aplicada e validada nas recapturas. Verdict final `ship`, restrito ao ajuste revisado, sem certificar outras superfícies do ERP.
- APIs, documentos e dados de navegador foram simulados. Sem gravação em banco real, upload, envio de mensagens, push ou deployment. A consulta não substitui homologação com a equipe em produção.

## Etapa 1B — vínculo e previsão sem dupla contagem

Em **Compromissos por origem → Conferir contratos de terceiros → Vincular à previsão**, Administrador e Financeiro com acesso à obra podem relacionar o contrato inteiro a uma etapa de primeiro nível do orçamento de controle. Não há distribuição automática entre várias etapas internas do mesmo contrato. Pedidos misturando etapas não podem ser declarados integralmente sobrepostos: precisam de apropriação coerente antes do vínculo.

O formulário exige justificativa. Selecionar pedidos exige confirmar que representam o serviço já incluído no contrato; materiais ou serviços adicionais ficam independentes. O comando `VINCULO_PREVISAO_TERCEIRO_SALVO` valida perfil, aba, obra, versões, orçamento, etapa, condições atuais e exclusividade do pedido entre contratos. Grava o vínculo e seu histórico em `obra.costPlanning`, com autoria da sessão. Remover o vínculo exige motivo e preserva o histórico. Snapshot não pode criar, modificar ou apagar vínculos nem remover obra com esse histórico. Nenhuma nota, medição, cláusula ou pagamento é reescrito.

Para cada grupo conferido:

1. Envelope = maior entre valor do contrato e soma dos valores dos pedidos declarados sobrepostos reconhecidos no razão. O total registrado do pedido é preservado mesmo quando difere da soma dos itens. Pedidos acima do contrato ficam sinalizados; não são descartados silenciosamente.
2. Custo já reconhecido = união dos eventos de custo da medição e das notas vinculadas, conforme o razão até a competência de corte. Nota espelhada em medição não entra novamente. Pagamento e rascunho não reduzem esse compromisso.
3. Saldo a incorrer = máximo entre zero e envelope menos custo reconhecido.
4. Compromissos remanescentes da etapa = grupos conferidos mais compras independentes ainda não faturadas. Os pedidos do grupo são retirados dessa segunda soma.
5. Referência automática para concluir = máximo entre zero, orçamento menos incorrido e compromissos remanescentes. Não somar novamente o saldo do orçamento aos compromissos.

Na falta de apropriação explícita divergente, custos do grupo passam a ser apresentados na etapa conferida, preservando os eventos e totais do razão. Etapas explícitas conflitantes, obra/rateio divergente e nota relacionada a outro contrato impedem o vínculo até correção. Serviços sem vínculo válido ficam visíveis para conferência e não são inventados na previsão. O relatório gerencial não apresenta custo final completo enquanto houver essa lacuna. O cálculo usa as condições atuais dos contratos e pedidos; não reconstrói condições contratuais históricas.

Mudanças nos termos do contrato, pedidos, orçamento ou etapa invalidam a conferência. Cancelar/inativar o contrato retira seu novo saldo a incorrer; não cancela automaticamente pedidos que continuam ativos, nem apaga custos reconhecidos. As revisões manuais continuam substituindo a referência automática: seus valores e histórico são preservados com aviso quando a base muda, e os compromissos não são somados novamente. A metodologia das previsões e exportações passa a `2026-11-13.1`.

Exemplo de validação: contrato e pedido do mesmo serviço de R$ 50 mil, R$ 20 mil em nota de pedido e R$ 3 mil em medição já reconhecidos deixam R$ 27 mil a incorrer. Com R$ 103 mil incorridos totais da etapa, a referência final é R$ 130 mil. Não é somado outro saldo de R$ 30 mil da compra nem o saldo isolado de R$ 47 mil do contrato. Revisão manual de R$ 28 mil substitui o restante e resulta em R$ 131 mil; retirar o vínculo preserva essa revisão e exige reconferência.

Fontes: `src/domains/financeiro/service-forecast.js`, `cost-control.js`, `cost-forecast.js`, `work-stage-costs.js`, `management-forecasts.js`; interface `ServiceLinkEditor.jsx`, `WorkCommitments.jsx`, `WorkStageCosts.jsx` e `CostControlReview.jsx`. Ajuda específica `fin_vinculos`, guias de custos e previsão revisados; manual regenerado. Evidências desta etapa em `artifacts/service-forecast/`.

Validação final da etapa 1B:

- 517 testes em 58 arquivos aprovados (`tests.log`), incluindo vínculo, deduplicação, totais canônicos de pedidos sobrepostos e independentes, recorte por competência, cancelamento, remoção, mudança de base, relatório gerencial, preservação de revisão, permissões e snapshot protegido. O handler real da API, com banco simulado, verificou persistência, autoria autenticada, replay, perfil/aba/obra e conflito de versão.
- 18 cenários de navegador aprovados em desktop/celular (`browser.log`), com 2 repetições direcionadas para ajuda e capturas (`link-browser.log`, não somadas ao total). Foram conferidos falha recuperável, mesma chave na tentativa, recarga, soma sem duplicidade, revisão manual, remoção com histórico e regressão de Comercial → Contratos.
- Build, lint/design/manual, TypeScript, arquitetura e diff sem erros. Manual sincronizado: 120 guias e 65 abas. Detector da introdução retornou `[]`.
- Pacotes gzip finais: global 1.881.128 bytes para limite de 1.891.328; financeiro 183.754 para limite de 208.896. Não foram aumentados limites, baseline, dependências ou configuração de build (`bundle-metrics.json`).
- Revisão visual independente das quatro capturas do editor e integração em desktop/celular: nenhum ajuste visual material solicitado. A única correção foi atualizar o guia `fin_previsoes_cost` e o manual à nova fórmula. Verdict Pass `ship`, restrito a essa correção; cálculos e autorização são sustentados pelos testes, não pelo parecer visual.
- Tudo local, com API/dados isolados nos testes; sem banco real, migração, push, PR, deployment, upload, envio de mensagens ou emissão de documento contratual. Cláusulas e fluxo de Comercial → Contratos preservados, PDF/DOCX continua desativado.

A etapa seguinte 1C está descrita abaixo; os critérios acima registram a entrega da fase 1B.

## Etapa 1C — cobertura física e reposição na previsão

Concluída localmente em 13/11/2026. Detalhes, exemplos e evidências em [INTEGRACAO-ESTOQUE-PREVISAO-LOCAL.md](INTEGRACAO-ESTOQUE-PREVISAO-LOCAL.md).

- A demanda reutiliza composições e vínculos do orçamento de controle; recebimentos reaproveitam material, unidade convertida, pedido/item e etapa. Consumo utiliza a tarefa de origem. Não há outro cadastro no Financeiro.
- Falta comprar = máximo entre zero e demanda menos aplicado líquido, saldo físico e pedidos a receber. Reserva da mesma etapa está dentro do saldo físico; não se soma novamente. Perdas exigem reposição.
- Reposição é valorizada pelo preço médio orçado. Referência restante = máximo entre zero, orçamento menos incorrido, compromissos sem sobreposição e reposição mais compras independentes ainda não faturadas. Os pisos são comparados, sem somar materiais ao contrato nem reabrir pedidos já agrupados.
- Estoque e compras são posições atuais; os custos seguem o corte financeiro. Origem financeira desconhecida, etapa ambígua, unidade divergente, saldo ou recebimento inconsistente exigem conciliação ou revisão explícita da etapa. Nenhum valor ausente é inventado.
- Movimentos, reservas, composição e catálogo usado mudam a base da revisão; o valor manual é preservado com aviso. A projeção de leitura do Financeiro recebe estoque e reservas da obra permitida; não amplia escrita no estoque.
- Impacto no DRE: nenhum novo lançamento por entrada, reserva, consumo, perda ou consulta. Notas e demais fontes financeiras continuam reconhecendo custo uma vez. A integração muda a estimativa, não reclassifica custos já contabilizados.
- Validação local: 852 testes em 105 arquivos; 20 cenários de navegador de previsão/Contratos em desktop/celular, mais repetição dos dois de estoque após ajustes finais; lint, tipos, arquitetura, manual e build verificados. Limites dos pacotes e baseline de interface preservados. Nenhum dado real, serviço remoto, cláusula ou emissão PDF/DOCX alterado.

A etapa seguinte 2 está descrita abaixo; o trecho acima registra a conclusão da fase 1C.


## Etapa 2 — retenção técnica de garantia

Concluída localmente em 13/11/2026. Regras, origem dos dados, memória do DRE, autorizações e limites em [RETENCAO-TECNICA-TERCEIROS-LOCAL.md](RETENCAO-TECNICA-TERCEIROS-LOCAL.md).

- A garantia é definida por medição existente, com beneficiário/obra/bruto reaproveitados, condição, motivo, versão e trilha. O financeiro confere o principal líquido e registra liberação integral expressa com evidência e vencimento antes de pagar o retido.
- O bruto aprovado permanece como custo uma vez. Principal e garantia dividem a obrigação; a garantia não vira nova despesa ou outra estimativa restante. O caixa considera o líquido do novo pagamento com garantia; ISS/INSS ficam distintos e não são retidos novamente na garantia.
- Pagamentos prévios, dados inválidos, condição não confirmada, competência fechada para definição, datas de operação fechadas, versão alterada ou acesso incompatível exigem correção. A medição antiga fechada não impede liberar/pagar sua garantia em período aberto.
- Nota e extrato não podem criar baixa alternativa sobre o retido. Conciliação vincula o líquido do pagamento existente; estorno reabre somente a parcela correspondente. Snapshots não reescrevem garantia/histórico ou baixas.
- Administrador/financeiro operam com aba e obra autorizadas. Os comandos usam a persistência e idempotência existentes, sem tabela, migração ou operação real.
- Ajuda/manual, navegação pelo Financeiro e Terceiros, revisão visual desktop/celular, cenários de conservação do DRE e regressão de Contratos/fases 1B–1C foram incluídos. Emissão PDF/DOCX continua desativada.

## Etapa 3A — colunas das tabelas financeiras

Implementada localmente em 14/11/2026: Hoje em Tabela, Custos por etapa e consultas de contratos de terceiros, materiais e garantias. Preferências por empresa/usuário/lista neste navegador, restauração do padrão, campos essenciais protegidos e fallback com aviso quando não for possível gravar. Origem, permissões, cálculos, fichas e exportações preservados, sem efeito no DRE. Documentos, Pagamentos e Kanban mantêm a composição existente.

Encerrada em 14/11/2026 com 1.576 testes e 24 cenários de navegador aprovados, incluindo Contratos e fases 1B–2; 208 verificações de inicialização no build e 133 telas no desenvolvimento. Ajuda e manual revisados. Detalhes e evidências em [COLUNAS-FINANCEIRO-LOCAL.md](COLUNAS-FINANCEIRO-LOCAL.md).

O bloqueio de tamanho foi corrigido compartilhando auxiliares repetidos dos gráficos durante o build, preservando a biblioteca instalada, os gráficos e o minificador global. Total JS/CSS gzip: 1.890.078 de 1.891.328 bytes permitidos; financeiro: 190.442 de 208.896. Redução de 11.804 bytes na comparação final com o adaptador desligado, sem elevar limites, excluir assets da medição ou descartar alterações locais. Configuração de produção também compilada e aprovada localmente. Sem publicação. Estes valores registram o encerramento da etapa 3A; a etapa 3B está descrita abaixo.

## Etapa 3B — reversão segura de extratos bancários

Implementada localmente em 14/11/2026 no escopo confirmado pelo usuário: extratos bancários nesta etapa; outras origens sinalizadas para revisão. Regras, fluxo de origem, persistência, proteção e evidências em [REVERSAO-IMPORTACOES-BANCARIAS-LOCAL.md](REVERSAO-IMPORTACOES-BANCARIAS-LOCAL.md).

- Novos extratos conservam bytes do original, manifesto dos movimentos e versões. A prévia reutiliza esses dados; não solicita outro cadastro de obra, valor ou conta. Legados sem rastreabilidade não recebem reversão automática.
- Em Extratos → Revisar reversão, Financeiro consulta; administrador irrestrito confirma com motivo e conferência explícita. Movimento pago, conciliado, utilizado, alterado ou em período fechado fica protegido, inclusive quando seu vínculo histórico foi estornado.
- Comando autenticado, horário do servidor, recibo idempotente permanente e nova validação da origem/versões na gravação. Conflitos rejeitam a seleção inteira. Snapshots e conciliação não podem contornar a proteção; nenhuma exclusão física de original, movimento ou histórico.
- A reversão retira apenas pendências sem uso da fila bancária. DRE, receitas, custos, pagamentos, previsão e estoque permanecem nos fatos de origem. Baixas produzidas pela conciliação automática existente ficam protegidas. Não libera reimportação duplicada do mesmo arquivo.
- Ajuda específica e manual acompanham o fluxo. Contratos, cláusulas e emissão PDF/DOCX desativada permanecem preservados. Limites de pacotes e baseline não foram elevados.

Encerrada com 1.621 testes em 176 arquivos e 28 cenários de navegador aprovados em desktop/celular; 208 verificações de inicialização do build e 133 telas em desenvolvimento. Lint, tipos, arquitetura, ajuda/manual e builds locais padrão/produção verificados. O único achado material da revisão visual, legenda estreita no celular, foi corrigido no componente compartilhado; as oito recapturas sustentaram o Verdict Pass `ship` no escopo da correção. Global JS/CSS gzip: 1.886.434 de 1.891.328 bytes; financeiro: 190.029 de 208.896. Nenhum dado real ou recurso remoto alterado.

A etapa seguinte foi a 4, seis níveis do orçamento, registrada abaixo.

## Etapa 4 — seis níveis do orçamento

Concluída localmente em 14/11/2026. Fluxo de origem, regras, impacto no DRE e evidências em [ORCAMENTO-SEIS-NIVEIS-LOCAL.md](ORCAMENTO-SEIS-NIVEIS-LOCAL.md).

- Seis níveis de etapas por IDs e `parentId`, com serviços vinculados por `etapaId`. Itens no sexto podem ter sete segmentos de numeração sem criar uma sétima etapa. Criar, mover e copiar preservam a hierarquia e os vínculos próprios da operação; não há novo cadastro de obra, unidade ou valor.
- Importação deixa de achatar subetapas no segundo nível. Confirmação de Numeração da etapa, Nível da etapa e Tipo; prévia bloqueia pai ausente, salto e origem divergente, sem promoção silenciosa. A entrada da aba Orçamento passa a mostrar os mesmos diálogos da aba Insumos. As opções usam checkboxes compartilhados, inclusive por teclado.
- UI, cópia e servidor recusam origem inválida; aprovação e adoção de nova baseline não legitimam legado com hierarquia quebrada. Versões aprovadas e permissões existentes permanecem protegidas. Falha mantém o formulário; repetir uma criação recusada não duplica a etapa.
- Orçamento continua sendo previsão. Totalização, planejamento, medições técnicas e resumo financeiro reutilizam o sexto nível; pai e filho não viram lançamentos separados. DRE e caixa permanecem nos fatos financeiros de origem. Contratos e emissão PDF/DOCX desativada preservados.
- Ajuda/manual atualizados; revisão visual independente `ship` sem achados materiais. Validação cobre criação, mudança de pai, cópia, importação, totais, medição, DRE, exportação XLSX real e regressão das etapas anteriores. Nenhuma alteração de limite, baseline ou publicação.

Encerrada com 2.078 testes em 231 arquivos, 32 cenários desktop/celular e 208 verificações de inicialização aprovados, além de repetições direcionadas do fluxo final. Lint, tipos, arquitetura e manual conferidos. Builds padrão e com configuração de produção: global JS/CSS gzip 1.891.320 de 1.891.328 bytes; financeiro 190.029 de 208.896. A folga global é de 8 bytes, exigindo nova medição nas próximas introduções. Os 1.813 arquivos originais acompanhados pela conferência dirigida dos inputs ficaram preservados; scripts de revisão locais de outro trabalho foram mantidos separadamente, sem participação no build.

A etapa funcional seguinte é a 5, perfis configuráveis por ação; não integra esta entrega.
