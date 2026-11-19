# Manual de uso do app MARCELL

Revisão do conteúdo: 19/11/2026.

Este guia explica o uso das telas em linguagem simples. No aplicativo, clique em **Ajuda**, no cabeçalho, para ler o fluxo da página aberta. Em **Manual completo**, pesquise uma tarefa ou tela. As áreas exibidas no aplicativo respeitam seu perfil de acesso.

Conteúdo gerado de `src/features/help/help-content.js`, a mesma fonte da ajuda no aplicativo. Atualize essa fonte e execute `npm run manual:generate`; não edite este arquivo diretamente.

## Primeiros passos

1. Entre com sua conta individual. Se não conseguir acessar, procure o administrador.
2. Escolha a área de trabalho e confirme a obra e o período.
3. Clique em Ajuda e leia o que preparar e a sequência de ações.
4. Depois de uma alteração, confira a mensagem da ação, o indicador de salvamento e o registro de destino.
5. Se não encontrar um registro, confira a busca, os filtros e o seu acesso.

## Fluxos que atravessam várias telas

- Obra: cadastro → orçamento → planejamento → acompanhamento da execução e documentos.
- Compra: necessidade → solicitação/cotação → pedido → recebimento físico e entrada no estoque. Aprovação, documento fiscal e pagamento têm situações próprias e podem ocorrer em outra ordem; pendências geram avisos, sem impedir o avanço manual.
- Financeiro: conferir documento, obrigação e pagamentos anteriores → registrar a quitação real → acompanhar pendências e conciliar o movimento bancário, quando aplicável. Pagar não aprova a conferência fiscal.
- Comercial: contato → oportunidade → proposta → negociação → contrato. Confira os requisitos antes de abrir a execução.
- Equipe: cadastro e lotação → captura ou registro autorizado do ponto → conferência do período → revisão da folha.

## Índice das telas

- [Financeiro · Previsões gerenciais](#guia-fin_previsoes)
- [Previsões · Relatório para diretoria](#guia-fin_previsoes_executive)
- [Previsões · Indicadores da obra](#guia-fin_previsoes_kpis)
- [Previsões · Caixa de 13 semanas](#guia-fin_previsoes_cash)
- [Previsões · Custo final por obra](#guia-fin_previsoes_cost)
- [Previsões · Mão de obra](#guia-fin_previsoes_labor)
- [Ponto diário · Pessoal de obra](#guia-ponto_obras)
- [Ponto diário · Administrativo](#guia-ponto_central)
- [Gestão do ponto · Pessoal de obra](#guia-ponto_geral_obras)
- [Gestão do ponto · Administrativo](#guia-ponto_geral_central)
- [Folha · Pessoal de obra](#guia-folha_obras)
- [Folha · Administrativo](#guia-folha_central)
- [Dashboard](#guia-home)
- [Modo TV](#guia-tv)
- [Comunicação](#guia-chat)
- [Minhas aprovações](#guia-aprov_pend)
- [Central do administrador](#guia-admin_central)
- [Obras](#guia-obras)
- [Visão geral da obra](#guia-obra_geral)
- [Orçamento](#guia-orc)
- [Planejamento](#guia-plan)
- [Marcos e Curva A](#guia-plan_suprimentos)
- [Projetos](#guia-projetos)
- [Diário de obra](#guia-rdo)
- [Conferência](#guia-conferencia)
- [Avanço físico](#guia-med)
- [Estoque](#guia-est)
- [Compras](#guia-cmp)
- [Compras · Solicitar](#guia-cmp_solicitacoes)
- [Compras · Pedido por texto ou print](#guia-cmp_mensagem)
- [Compras · Cotar](#guia-cmp_cotacoes)
- [Compras · Aprovações](#guia-cmp_aprovacoes)
- [Compras · Pedidos](#guia-cmp_pedidos)
- [Compras · Receber](#guia-cmp_recebimentos)
- [Fornecedores](#guia-fornecedores)
- [Curva e preços](#guia-suprimentos)
- [Ponto por obra](#guia-ponto)
- [Gestão do ponto](#guia-ponto_geral)
- [Ponto eletrônico (app)](#guia-ponto_app)
- [Equipes](#guia-equipe)
- [Equipe nas Obras](#guia-equipe_obras)
- [Terceirizados](#guia-terc)
- [Folha · Pendências do RH](#guia-folha_pendencias)
- [Folha](#guia-folha)
- [Rescisão](#guia-resc)
- [Indicadores de RH](#guia-rh_indic)
- [DRE empresa](#guia-dre_emp)
- [DRE obras](#guia-dre)
- [Gestão financeira](#guia-fin)
- [Financeiro · Hoje](#guia-fin_hoje)
- [Financeiro · Documentos](#guia-fin_documentos)
- [Financeiro · Conferência fiscal](#guia-fin_fiscal)
- [Financeiro · Pagamentos](#guia-fin_pagamentos)
- [Financeiro · Caixa](#guia-fin_caixa)
- [Financeiro · Fechamento](#guia-fin_fechamento)
- [Financeiro · Visão financeira](#guia-fin_visao)
- [Financeiro · Custos por etapa](#guia-fin_etapas)
- [Financeiro · Vínculo de contratos à previsão](#guia-fin_vinculos)
- [Financeiro · Relatórios financeiros](#guia-fin_relatorios)
- [Financeiro · Administrativo](#guia-fin_administrativo)
- [Financeiro · Homologação](#guia-fin_homologacao)
- [Financeiro · Modo IA](#guia-fin_ia)
- [Conciliação](#guia-conc)
- [Medições a faturar](#guia-medicoes)
- [Caixa da obra](#guia-caixa)
- [Relatórios](#guia-relat)
- [Equipamentos](#guia-equip)
- [Locação de equipamentos](#guia-equip_fin)
- [Patrimônio da empresa](#guia-patrimonio)
- [Cadastros](#guia-cad)
- [IA](#guia-ia)
- [Configurar Gemini](#guia-ia_config)
- [Ajustes · Minha equipe](#guia-config_membros)
- [Financeiro · Relatório completo por obra](#guia-fin_relatorios_obra)
- [Ajustes](#guia-config)
- [Telas antigas](#guia-obsoletos)
- [FVS / FVM](#guia-obra_qualidade)
- [Segurança da obra](#guia-obra_seguranca)
- [Portal do cliente](#guia-obra_portal)
- [Dashboard comercial](#guia-com_dash)
- [Comercial da empresa](#guia-com_workspace)
- [Venda de imóveis](#guia-com_real_estate)
- [Pipeline](#guia-com_pipeline)
- [Relacionamentos](#guia-com_relationships)
- [Propostas e contratos](#guia-com_deals)
- [Gestão comercial](#guia-com_management)
- [Indicações](#guia-com_indicacoes)
- [Leads](#guia-com_leads)
- [Funil](#guia-com_funil)
- [Jornada](#guia-com_jornada)
- [Agenda](#guia-com_agenda)
- [Reuniões](#guia-com_reunioes)
- [Tarefas comerciais](#guia-com_tarefas)
- [Propostas](#guia-com_propostas)
- [Negociações](#guia-com_negociacoes)
- [Comercial · Contratos](#guia-com_contratos)
- [Clientes](#guia-com_clientes)
- [Parceiros](#guia-com_parceiros)
- [Metas e comissões](#guia-com_metas)
- [Perdas](#guia-com_perdas)
- [Relatórios comerciais](#guia-com_relatorios)
- [Financeiro · Previsão de custo final](#guia-fin_previsao)
- [Obra · Mudanças e aditivos](#guia-obra_aditivos)
- [Arquivos e permissões](#guia-arquivos)
- [Arquivos · Revisões, busca e comparação](#guia-arquivos_revisoes)
- [Arquivos · Dossiê de licenciamento](#guia-arquivos_dossie)
- [Licenciamento](#guia-licenca)
- [Compras · Contratos e medições](#guia-cmp_contratos)
- [Compras · Ficha rápida](#guia-cmp_ficha)
- [Financeiro · Ficha rápida](#guia-fin_ficha)
- [Compras · Registrar pagamento](#guia-cmp_pagamento)
- [Retomar trabalho salvo](#guia-fin_recuperacao)
- [Retomar trabalho salvo](#guia-cmp_recuperacao)
- [Recuperar salvamento](#guia-home_recuperacao)
- [Planejamento · Linha de base aprovada e SPI](#guia-plan_baseline)
- [Previsões · Indicadores contábeis](#guia-fin_previsoes_accounting)
- [Previsões · Bases contábeis e conferência](#guia-fin_previsoes_accounting_base)
- [Relatórios · Identidade do documento](#guia-report_identity)
- [Comercial · Preenchimento e revisão de contratos](#guia-com_contratos_editor)
- [Comercial · Modelos e contratada](#guia-com_contratos_modelos)
- [Financeiro · Cobertura do estoque](#guia-fin_estoque)
- [Terceiros · Garantia técnica das medições](#guia-terc_garantia)
- [Financeiro · Colunas das tabelas](#guia-fin_colunas)
- [Cliente · Entrar no portal](#guia-cliente_login)
- [Cliente · Acompanhamento da obra](#guia-cliente_inicio)
- [Cliente · Diário da obra](#guia-cliente_fotos)
- [Cliente · Avanço físico](#guia-cliente_progresso)
- [Cliente · Gastos por categoria](#guia-cliente_gastos)
- [Cliente · Extrato do caixa da obra](#guia-cliente_caixa)
- [Cliente · Previsto e realizado por etapa](#guia-cliente_orcamento)
- [Cliente · Compras e notas fiscais](#guia-cliente_compras)
- [Folha · Reservas no repasse ao cliente](#guia-folha_repasse)
- [Cliente · Administração e equipe](#guia-cliente_administracao_equipe)
- [Cliente · Contrato e recebimentos](#guia-cliente_financeiro)
- [Cliente · Documentos da obra](#guia-cliente_documentos)
- [Cliente · Decisões e alterações](#guia-cliente_decisoes)
- [Cliente · Consulta de transparência](#guia-cliente_transparencia)
- [Cliente · Alterar senha e sair](#guia-cliente_conta)
- [Administrador · Login e senha dos clientes](#guia-cliente_acessos)
- [Conciliação · Reversão de importações bancárias](#guia-conc_reverter)
- [Orçamento · Hierarquia de seis níveis](#guia-orc_estrutura)
- [Orçamento · Comparar revisões](#guia-orc_revisoes)
- [Conexão local do financeiro](#guia-cliente_conexao_financeiro)
- [Arquivos · Exclusão e lixeira](#guia-arquivos_exclusao)
- [Terceirizados · Recuperar medição](#guia-terc_rascunho)
- [Apagar conciliação na simulação local](#guia-conc_apagar_local)

<a id="guia-fin_previsoes"></a>

## Financeiro · Previsões gerenciais

Antecipar caixa, custo final e necessidade de equipe, conferir indicadores e preparar o relatório para a diretoria.

### Antes de começar

Use perfil administrador ou financeiro e confira a obra e a data de referência.

### Como fazer

1. Em Financeiro, abra Mais áreas e escolha Previsões gerenciais. No celular, use Áreas do financeiro.
2. Escolha Caixa de 13 semanas, Custo final por obra, Previsão de mão de obra, Indicadores da obra, Relatório para diretoria ou Indicadores contábeis. No celular, use Consulta de previsões. O relatório abre no Resumo do CEO; expanda Obra e referência para conferir ou mudar esse contexto.
3. Confira as fontes, preencha as premissas e consulte a memória antes de interpretar o resultado.
4. Exporte o CSV para guardar o cenário. Em Relatório para diretoria, no cabeçalho Relatório executivo por obra, abra Exportar relatório e escolha Exportar relatório executivo CSV ou Preparar apresentação / PDF em qualquer seção válida. A segunda opção abre o documento para impressão. A ajuda acompanha a consulta aberta.
5. Para rentabilidade, liquidez e endividamento da empresa inteira, escolha Indicadores contábeis e Todas as obras e empresa. Importe e confira o balancete em Bases e conferência; a Ajuda acompanha a seção. Bases contábeis ficam registradas no histórico, separadas dos cenários de previsão da sessão.

### Como conferir se deu certo

As seis consultas mostram o recorte escolhido, os dados de origem e as pendências para conferência.

### O que merece atenção

A simulação temporal é guardada por obra enquanto você navega entre as consultas. Cenários ficam na sessão aberta deste usuário; recarregar a página ou sair do sistema os descarta. Exporte a memória antes de fechar. Não criam títulos, pagamentos ou contratações. Dados atuais são recalculados; a data de referência não reconstrói o que era conhecido no passado. Sem base suficiente, o resultado fica indisponível ou identificado como parcial.

<a id="guia-fin_previsoes_executive"></a>

## Previsões · Relatório para diretoria

Reunir os gastos registrados, previsões e indicadores das obras em um relatório conferível para a diretoria.

### Antes de começar

Use perfil administrador ou financeiro. Confira orçamento de controle, início da obra, custos por etapa, documentos, ponto, diários revisados e planejamento. Separe o saldo inicial confirmado se quiser consultar saldos futuros.

### Como fazer

1. Em Previsões gerenciais, escolha Relatório para diretoria. O cabeçalho mostra Relatório executivo por obra e a consulta abre no Resumo do CEO. Expanda Obra e referência para conferir Obra da previsão e Data de referência da previsão; Todas as obras e empresa compara as obras disponíveis. O total de despesas da empresa sem rateio aparece somente no recorte geral autorizado; escolher uma obra não mostra esse total.
2. Abra Ajustar período e saldo e preencha Início do relatório executivo. O intervalo pode abranger até 12 competências mensais. Custos e receitas usam os meses inteiros; pagamentos usam as datas exatas. Gastos incorridos acumulados incluem também os meses anteriores ao início informado.
3. Se tiver o valor confirmado, preencha Saldo inicial do caixa executivo (R$) para as obras e a referência escolhidas. Sem ele, entradas e saídas continuam disponíveis, mas saldo e necessidade de cobertura ficam indisponíveis. Trocar obra ou referência exige conferir novamente o saldo.
4. No Resumo do CEO, leia os três totais, o aviso de cobertura e a quantidade de pendências junto aos valores. Confira a referência, o acumulado, a necessidade máxima de cobertura e o menor saldo diário das 13 semanas. Em Sinais financeiros da carteira, confira o saldo vencido a receber, as compras comprometidas a faturar e a variação do custo executado, junto à base e à quantidade de obras comparáveis. Use Conferir pendências para abrir Pendências para decisão: confira obra, área, data e registro quando disponíveis e a Providência indicada. Corrija na área de origem e consulte novamente; esse botão não corrige os registros. Em Sinais de prazo por obra, compare atraso confirmado, falta de levantamento, entregas próximas e cobertura. Pendências de prazo também aparecem em Conferir pendências, com origem e providência.
5. Em Seções do relatório executivo, escolha Caixa, Custos ou Execução; no celular, use o seletor com esse nome. Em Caixa, confira Posição da inadimplência. Abra Conferir atrasos e títulos a receber para ver as faixas de 1 a 30, 31 a 60, 61 a 90 e mais de 90 dias e a Memória dos recebíveis, com saldo e origem. Confira também Resultado e caixa realizado no período e Evolução mensal da carteira. Leia as competências inteiras dos custos e receitas e as datas exatas dos pagamentos e recebimentos. Abra Conferir as 13 semanas do caixa para a memória semanal. Volte ao Resumo do CEO para comparar as obras e conferir as pendências.
6. Em Custos, use Obra do detalhamento executivo para escolher a obra. Confira Compromissos financeiros da obra e abra Conferir compras a faturar para ver o pedido de origem e o saldo. Em Variação de custo por valor agregado, confira o valor agregado, o custo incorrido e as variações CV e VAC com sua leitura ou motivo de indisponibilidade. Depois confira Gastos acumulados por categoria, Gastos incorridos por função e Gastos e pagamentos de terceirizados. Compare pedreiro, ajudante e as demais funções da equipe própria; confira cada prestador, contrato e especialidade dos terceiros. Abra Evolução e comparação dos gastos por função e Evolução e comparação dos gastos por terceirizado. Confira a evolução mensal e compare o período escolhido com o mesmo número de competências imediatamente anteriores. Depois revise as etapas e abra Todos os gastos registrados e Títulos em aberto e pagamentos do período para conferir as origens. Em Execução, confira a equipe prevista, os indicadores e Produtividade e dispersão da obra.
7. Em Indicadores da obra ou em Relatório para diretoria → Execução, confira Prazo da obra. Leia Atividades vencidas com saldo confirmado, Vencidas sem medição confirmada, Entregas nos próximos 7 dias e Cobertura das atividades pelo diário. O recorte é a Data de referência da previsão; o período inicial não limita o último avanço acumulado consultado.
8. Abra Conferir atividades, marcos e semanas. Em Memória do prazo por atividade, confira identificação, datas vigentes, avanço, diário e data da medição. Corrija as datas no Planejamento e faça o levantamento no Diário de obra; conclua o relatório com revisão técnica para que a medição seja reaproveitada. Consultar os indicadores não grava nem conclui o diário.
9. Confira Marcos do planejamento e Confiabilidade semanal do planejamento. Uma data de marco passada exige confirmação da entrega na origem. O percentual de planos concluídos (PPC) usa compromissos elegíveis no prazo, apenas de semanas inteiras encerradas e verificadas; bloqueados e fechamentos pendentes ficam separados.
10. No cabeçalho Relatório executivo por obra, abra Exportar relatório. Escolha Exportar relatório executivo CSV para baixar as 25 seções do relatório, incluindo SPI, SPI itens, Prazos, Atividades prazo, Marcos prazo, Inadimplência, Compromissos, Variação custo, Funções, Terceirizados, Evolução pessoal e Comparação pessoal, ou Preparar apresentação / PDF para abrir o documento. No documento, use Imprimir / salvar PDF para escolher a impressão ou o PDF no navegador. O painel de opções fecha após a escolha. Exportar relatório fica disponível em qualquer seção quando o recorte é válido; não é preciso voltar ao Resumo do CEO para exportar. Ambos incluem todas as obras do recorte e as pendências com providências, independentemente da seção aberta; Obra do detalhamento executivo altera somente o detalhe na tela.
11. Em SPI da obra, confira a versão aprovada, o valor planejado (PV), o valor agregado (EV), SPI e SV. Abra Conferir memória do SPI para conferir item, peso orçamentário, diário e data de medição. Para preparar, aprovar ou consultar outra versão, use Linha de base aprovada e SPI no Planejamento. O relatório usa a última aprovação até a referência; a fotografia legada não calcula SPI.

### Como conferir se deu certo

A diretoria recebe o comparativo das obras, gastos por categoria, função e etapa, terceirizados por prestador e contrato, evolução mensal e comparação dos custos de pessoal, caixa de 13 semanas, equipe, indicadores, memória dos gastos, títulos, pagamentos e pendências, com inadimplência, compromissos de compra e variação de custo, referência e limites identificados. Os indicadores de prazo e sua memória acompanham os dados de origem carregados, sem formulário adicional.

### O que merece atenção

Sem avisos detectados no cálculo não comprova fechamento nem que todos os gastos foram registrados. A contagem identifica avisos de conferência, não obrigações corrigidas automaticamente. Data não informada e avisos de cobertura sem registro exigem conferência das fontes; não representam uma origem individual comprovada. O relatório usa os registros atualmente carregados; não recupera arquivos históricos nem comprova que todos os gastos foram cadastrados. Custo, pagamento, pedido e recebimento físico são visões diferentes e não devem ser somados. Gastos incorridos por função mostram o custo já apurado da equipe própria, com encargos e benefícios incluídos no demonstrativo de resultado (DRE); não acrescente esse detalhamento ao total por categoria. A função vem do registro do dia quando disponível e, na falta dele, do cadastro atual. Histórico e lançamentos sem função permanecem identificados; confira a origem quando houver diferença. Previsão executiva de mão de obra estima a equipe e o custo restantes, não o gasto já realizado. Em Gastos e pagamentos de terceirizados, Incorrido acumulado é custo reconhecido por medição ou documento; Pago no período e Cliente direto no período usam as datas dos pagamentos, enquanto Saldo a pagar é a posição na referência. Uma nota vinculada à medição não deve gerar custo duas vezes. Sem custo reconhecido nas fontes significa falta de reconhecimento na base carregada, não comprova gasto zero. A evolução de pessoal usa custos por competências mensais inteiras, com encargos e benefícios da equipe própria; pagamentos não entram nessa comparação. Se faltar base em um dos períodos, o valor correspondente aparece como Não disponível. Ausência de registro não comprova custo zero. Diferença e Variação só ficam disponíveis quando a referência é o último dia do mês e há valores nos dois períodos; o percentual também exige custo anterior positivo. No mês de referência em andamento, os valores são provisórios. Diferença de gasto não comprova economia ou ganho de produtividade: confira também equipe, produção e escopo. Mês encerrado no calendário não comprova fechamento contábil. Pagamento direto do cliente ao fornecedor fica separado das saídas do caixa da empresa. Custo final = incorrido + restante + risco + mudanças adicionais; compras a faturar já estão no restante. Revisão antiga, orçamento vazio ou inválido, início inválido, valores ou totais fora do limite seguro e divergência na memória impedem o total confiável. Gastos ou compras sem etapa exigem apropriação ou revisão válida explícita de Sem apropriação para evitar sobreposição do orçamento; se uma obra estiver pendente, o total da carteira fica indisponível e o subtotal das obras calculáveis aparece identificado. Inadimplência usa o saldo ainda aberto na referência: vencimento anterior à referência é atraso; vence hoje e a vencer ficam fora do atraso. O percentual divide o vencido pelo total aberto com vencimento válido, incluindo os títulos futuros. Sem base positiva, o percentual fica indisponível. Títulos sem vencimento válido ficam separados e não são considerados em dia. A posição usa os registros carregados e não reconstrói o que se sabia historicamente. Compras a faturar são saldos de pedidos na referência, separados dos títulos a pagar. Não comprovam todos os compromissos futuros: contratos sem medição, folha futura e serviços sem obrigação cadastrada não estão completos nessa posição. Não some pedidos, títulos e incorrido. CV, variação de custo, é valor agregado menos custo incorrido; negativo indica custo acima do valor agregado, positivo não comprova lucro. Exige mês encerrado, medição integral e orçamento e custos comparáveis, como o CPI. A carteira só mostra CV completo quando todas as obras são comparáveis. VAC, variação ao término, é orçamento menos custo final previsto; negativo indica previsão acima do orçamento. Seu sinal é o inverso de Desvio previsto, que usa custo final menos orçamento. CV nesta tabela é variação monetária de custo; CV em Produtividade e dispersão é coeficiente de variação, uma medida estatística diferente. Resultado é receita reconhecida menos custo do período; margem exige receita positiva e não representa lucro final do contrato. CPI, índice de eficiência de custo, divide valor agregado pelo incorrido e exige último dia do mês, orçamento completo, medição integral e mesmo escopo de custos e avanço; sem isso fica indisponível. SPI exige valor planejado e avanço compatíveis com a mesma versão aprovada. PPC é o percentual de compromissos cumpridos no prazo nas semanas completas verificadas; bloqueados ficam separados. RUP é horas-pessoa por unidade produzida; não some unidades nem produção compartilhada entre funções. A previsão de mão de obra é dimensionamento condicional aos registros e ao calendário, sem garantia de equipe futura e sem soma automática ao custo final. Falta de base não é zero. CSV usa proporções de zero a um. Consultar, exportar e imprimir não altera registros; confira as pendências antes de compartilhar. Atividades com datas ou identificação inválidas exigem correção no Planejamento; ficam fora das contagens de vencimento e próximas entregas. Prazo usa o último avanço acumulado em diário concluído e revisado, até a referência, vinculado pela identificação exata da atividade. Progresso digitado no Planejamento não substitui essa evidência. Sem medição não significa avanço zero nem atraso confirmado. Diários duplicados ou medição inválida exigem conferência. Dias de atraso são corridos desde o fim vigente; não estimam atraso de conclusão da obra. A data de conclusão é o primeiro registro de 100% do ciclo atual e pode ser posterior à execução. Desvio positivo contra a fotografia da base significa postergação das datas, não atraso realizado. A fotografia atual pode ser substituída e não reconstrói versões passadas. SPI (índice de desempenho de prazo) usa a linha de base aprovada e versionada; sem medição compatível integral ou valor planejado positivo fica indisponível com motivo.

<a id="guia-fin_previsoes_kpis"></a>

## Previsões · Indicadores da obra

Conferir produção, avanço acumulado, cumprimento do plano e qualidade dos registros da obra.

### Antes de começar

Use perfil administrador ou financeiro. Confira orçamento de controle, diários concluídos e revisados, ponto com horários completos e compromissos com avanços confirmados no Planejamento.

### Como fazer

1. Em Previsões gerenciais, escolha Indicadores da obra. Em Obra da previsão, selecione uma obra; Todas as obras e empresa não reúne os indicadores.
2. Confira Data de referência da previsão, que também encerra o período. Em Janela dos indicadores, escolha Últimos 7 dias, Últimos 28 dias ou Últimos 90 dias. Para outro início, preencha Período inicial dos indicadores; o limite é 366 dias.
3. Leia Avanço ponderado do orçamento, PPC das semanas verificadas e Cobertura dos diários nos dias com presença. Não disponível indica base insuficiente; confira avisos e subtotais antes de interpretar.
4. Em Produtividade por serviço e função, abra Amostra para conferir dias, diários, horas, produção e Ponto de origem. Compare a RUP com o período anterior de mesma duração.
5. Confira Avanço acumulado com peso do orçamento e Cumprimento do planejamento semanal. Abra Compromissos e motivos para verificar meta, prazo e avanços de origem.
6. Em Registro diário e pendências, confira os dias sem diário revisado e horários incompletos. Abra Pendências e exclusões da base e Memória, fórmulas e limites dos indicadores.
7. Em Indicadores da obra ou em Relatório para diretoria → Execução, confira Prazo da obra. Leia Atividades vencidas com saldo confirmado, Vencidas sem medição confirmada, Entregas nos próximos 7 dias e Cobertura das atividades pelo diário. O recorte é a Data de referência da previsão; o período inicial não limita o último avanço acumulado consultado.
8. Abra Conferir atividades, marcos e semanas. Em Memória do prazo por atividade, confira identificação, datas vigentes, avanço, diário e data da medição. Corrija as datas no Planejamento e faça o levantamento no Diário de obra; conclua o relatório com revisão técnica para que a medição seja reaproveitada. Consultar os indicadores não grava nem conclui o diário.
9. Confira Marcos do planejamento e Confiabilidade semanal do planejamento. Uma data de marco passada exige confirmação da entrega na origem. O percentual de planos concluídos (PPC) usa compromissos elegíveis no prazo, apenas de semanas inteiras encerradas e verificadas; bloqueados e fechamentos pendentes ficam separados.
10. Use Exportar indicadores da obra para guardar o CSV com período, fontes, fórmulas e pendências. Corrija os registros nas áreas de origem quando necessário.
11. Em SPI da obra, confira a versão aprovada, o valor planejado (PV), o valor agregado (EV), SPI e SV. Abra Conferir memória do SPI para conferir item, peso orçamentário, diário e data de medição. Para preparar, aprovar ou consultar outra versão, use Linha de base aprovada e SPI no Planejamento. O relatório usa a última aprovação até a referência; a fotografia legada não calcula SPI.

### Como conferir se deu certo

Cada resultado mostra sua própria base e os registros que permitem conferi-lo. Avanço físico é acumulado até a referência; produtividade e cobertura usam o período escolhido. A comparação da produtividade usa o intervalo anterior de mesma duração. Os indicadores de prazo e sua memória acompanham os dados de origem carregados, sem formulário adicional.

### O que merece atenção

RUP é razão unitária de produção: soma das horas-pessoa dividida pela quantidade dos mesmos dias válidos; menor RUP significa menos horas por unidade. Horas de dias com produção zero permanecem nessa soma. A média simples das RUP diárias pode ser diferente da RUP agregada, ponderada pela quantidade. Desvio padrão amostral usa n menos 1; desvio e coeficiente de variação (CV, desvio dividido pela média) exigem pelo menos dois dias com produção e média positiva. Dias com produção zero ficam fora dessa dispersão. Essas estatísticas não são previsão nem comprovam causa. Não some unidades diferentes nem a produção compartilhada entre funções. PPC significa percentual de compromissos cumpridos como prometido: considera semanas inteiras de segunda a domingo encerradas, com fechamento verificável de todos os elegíveis. Quantidade confirmada depois da data prometida não conta como cumprimento no prazo; bloqueados ficam separados e fora da base conforme a política atual do Planejamento. Sem plano ou medição suficiente, o resultado fica indisponível, não zero. Cobertura dos diários usa somente dias com presença confirmada; não mede todos os dias previstos da obra. Dados atualmente carregados e suas correções são usados; a consulta não recupera arquivos históricos nem reconstrói o que era conhecido no passado. Consultar e exportar não altera ponto, diário, produção ou registros financeiros. No CSV, proporções usam escala de zero a um. Atividades com datas ou identificação inválidas exigem correção no Planejamento; ficam fora das contagens de vencimento e próximas entregas. Prazo usa o último avanço acumulado em diário concluído e revisado, até a referência, vinculado pela identificação exata da atividade. Progresso digitado no Planejamento não substitui essa evidência. Sem medição não significa avanço zero nem atraso confirmado. Diários duplicados ou medição inválida exigem conferência. Dias de atraso são corridos desde o fim vigente; não estimam atraso de conclusão da obra. A data de conclusão é o primeiro registro de 100% do ciclo atual e pode ser posterior à execução. Desvio positivo contra a fotografia da base significa postergação das datas, não atraso realizado. A fotografia atual pode ser substituída e não reconstrói versões passadas. SPI (índice de desempenho de prazo) usa a linha de base aprovada e versionada; sem medição compatível integral ou valor planejado positivo fica indisponível com motivo.

<a id="guia-fin_previsoes_cash"></a>

## Previsões · Caixa de 13 semanas

Consultar entradas e saídas previstas em treze intervalos consecutivos de sete dias.

### Antes de começar

Confira a obra, a data de referência e a conta prevista dos títulos.

### Como fazer

1. Informe o Saldo inicial do cenário (R$) para este recorte. Se quiser testar sem dinheiro inicial, use Simular saldo inicial zero.
2. Escolha o Atraso simulado de recebimentos e o Tratamento dos títulos vencidos. Vencidos ficam separados até você escolher simulá-los na referência.
3. Leia entradas, saídas, saldos e necessidade máxima de cobertura. O menor saldo é calculado por dia; um total semanal positivo pode esconder falta de dinheiro durante a semana.
4. Use Ver títulos para abrir a memória da semana; confira vencidos e títulos sem data nas ações próprias.
5. Use Exportar caixa de 13 semanas para baixar o recorte e as premissas.

### Como conferir se deu certo

A tabela cobre 91 dias e informa os títulos que compõem cada semana. Saldo e necessidade aparecem somente com saldo inicial confirmado para obra, conta e data.

### O que merece atenção

A conta é a destinação prevista no título, não uma inferência do pagamento anterior. Mudar obra, conta ou referência exige conferir novamente o saldo inicial. A projeção inclui apenas títulos existentes; folha futura, tributos, pedidos e serviços sem obrigação cadastrada não são estimados automaticamente. Recebimentos não são garantidos; datas não são ajustadas ao calendário bancário.

<a id="guia-fin_previsoes_cost"></a>

## Previsões · Custo final por obra

Comparar o custo final estimado das obras com o orçamento de controle.

### Antes de começar

Confira a obra e a data de referência; tenha orçamento de controle, início da obra e estimativas restantes conferidos.

### Como fazer

1. Leia orçamento, custo incorrido, compromissos vinculados, compras independentes pendentes, restante, risco, mudanças adicionais e custo final por obra.
2. Escolha a Obra da memória de custo final e leia os alertas e a composição por etapa.
3. Use Conferir em Custos por etapa para revisar a estimativa na área de origem. Use Voltar às previsões gerenciais para retomar a consulta.
4. Use Exportar custo final por obra para guardar o relatório e seus avisos.

### Como conferir se deu certo

O custo final é incorrido + restante + reserva de risco + impactos de mudanças adicionais. O restante já inclui os compromissos pendentes; contratos vinculados e pedidos do mesmo escopo entram uma vez, e pagamentos não entram novamente.

### O que merece atenção

Incorrido segue a competência até o mês da referência. A referência automática usa o maior entre zero, orçamento menos incorrido, compromissos remanescentes sem sobreposição e reposição de materiais mais compras independentes ainda não faturadas. Cada vínculo considera o maior valor do contrato e dos pedidos do mesmo escopo, menos a união dos custos reconhecidos no razão até a competência de corte. Compras independentes permanecem separadas. Contrato sem vínculo válido exige conferência e deixa o custo final gerencial indisponível; não é previsão estatística. Revisão com base alterada ou etapa removida exige reconferência e deixa o custo final indisponível nas previsões gerenciais. Sem orçamento de controle com itens válidos, início válido para o acumulado ou com quantidade, preço, valor ou total fora do limite seguro, o custo final também permanece indisponível. Gastos ou compras sem etapa exigem apropriação ou revisão válida explícita de Sem apropriação, pois a referência automática pode repetir o orçamento. Restante abaixo dos compromissos pendentes pede revisão. Os registros de origem são preservados; subtotais não comprovam cobertura integral.

<a id="guia-fin_previsoes_labor"></a>

## Previsões · Mão de obra

Antecipar horas e equipe usando os registros diários da obra.

### Antes de começar

Escolha uma obra com orçamento de controle, ponto atualizado e diário revisado pelo engenheiro.

### Como fazer

1. A fonte padrão é Automático · ponto e diário de obras. Não precisa repetir quantidade, função, jornada, equipe ou produtividade na previsão.
2. Leia Origem e pendências da integração. Jornada indisponível deve ser conferida pelo RH no cadastro e no ponto; Aguardando levantamento diário exige que o engenheiro registre, vincule e revise as atividades na origem. Sem orçamento de controle, defina essa base antes de esperar o cálculo. Quantidade restante vem do avanço acumulado revisado; produtividade usa a soma das horas do ponto dividida pela produção registrada nos mesmos dias, serviços e funções. Para cada função, entram somente os dias em que ela teve horas apropriadas maiores que zero; a produção de um dia em que essa função não trabalhou não reduz sua necessidade prevista. As datas da amostra e o ponto de origem seguem esse mesmo recorte.
3. Confira Levantamento por serviço e função e as referências dos diários. Equipe é a última presença observada na obra nos últimos 14 dias, sem garantir disponibilidade futura.
4. Ajuste apenas o intervalo e o calendário da simulação. Feriados do calendário de Planejamento/Folha são excluídos automaticamente na fonte integrada.
5. Confira dimensionamento, déficit e histograma. Exporte previsão de mão de obra para guardar fontes, premissas e resultados.
6. Para testar hipóteses separadas dos registros, escolha Simulação manual separada em Fonte das premissas da mão de obra.

### Como conferir se deu certo

Os resultados se atualizam com os dados carregados do diário e do ponto. Corrigir os registros de origem recalcula a previsão; reabrir ou cancelar um diário retira sua produção da base confirmada.

### O que merece atenção

Diários em preparação, duplicados ou sem revisão não confirmam produtividade. Presença sem horários completos, função ausente, terceiros sem horas e divisão de jornada pendente ficam identificados. Custo-hora usa somente parcelas apuradas e completas do ciclo corrente no motor da folha, divididas por horas do ponto; não representa todos os custos futuros do contrato. Este dimensionamento é paramétrico, sem previsão estatística validada. Distribuição uniforme, sem nivelar frentes; ausências e alocações futuras precisam de planejamento. Nenhuma consulta altera ponto, folha ou cria pagamentos. Simulações manuais são descartadas ao recarregar.

<a id="guia-ponto_obras"></a>

## Ponto diário · Pessoal de obra

Conferir separadamente os registros de Pessoal de obra.

### Antes de começar

Escolha o grupo, a competência e a obra. A aba Administrativo inclui engenheiros e mestres, mesmo quando estão lotados em obra.

### Como fazer

1. Escolha Pessoal de obra ou Administrativo no início da tela.
2. Confira o período e a obra; trocar de grupo preserva esses filtros.
3. Revise os registros das pessoas do grupo. Use Todos para conferir a empresa completa.
4. No celular, abra Obras com ponto pendente para escolher uma obra que precisa de conferência. Pesquisar no ponto consulta todo o recorte em páginas de até seis pessoas. Abra Ações em lote para ler o alcance e usar Todos presentes ou Todos com falta.

### Como conferir se deu certo

A lista e os totais mostram o grupo selecionado.

### O que merece atenção

O grupo é um filtro de consulta; não transfere pessoas nem altera o histórico. Finalizar ponto exige Todos; arquivar a quinzena exige também Todas as obras.

<a id="guia-ponto_central"></a>

## Ponto diário · Administrativo

Conferir separadamente os registros de Administrativo.

### Antes de começar

Escolha o grupo, a competência e a obra. A aba Administrativo inclui engenheiros e mestres, mesmo quando estão lotados em obra.

### Como fazer

1. Escolha Pessoal de obra ou Administrativo no início da tela.
2. Confira o período e a obra; trocar de grupo preserva esses filtros.
3. Revise os registros das pessoas do grupo. Use Todos para conferir a empresa completa.
4. No celular, abra Obras com ponto pendente para escolher uma obra que precisa de conferência. Pesquisar no ponto consulta todo o recorte em páginas de até seis pessoas. Abra Ações em lote para ler o alcance e usar Todos presentes ou Todos com falta.

### Como conferir se deu certo

A lista e os totais mostram o grupo selecionado.

### O que merece atenção

O grupo é um filtro de consulta; não transfere pessoas nem altera o histórico. Finalizar ponto exige Todos; arquivar a quinzena exige também Todas as obras.

<a id="guia-ponto_geral_obras"></a>

## Gestão do ponto · Pessoal de obra

Conferir separadamente os registros de Pessoal de obra.

### Antes de começar

Escolha o grupo, a competência e a obra. A aba Administrativo inclui engenheiros e mestres, mesmo quando estão lotados em obra.

### Como fazer

1. Escolha Pessoal de obra ou Administrativo no início da tela.
2. Confira o período e a obra; trocar de grupo preserva esses filtros.
3. Revise os registros das pessoas do grupo. Use Todos para conferir a empresa completa.

### Como conferir se deu certo

A lista e os totais mostram o grupo selecionado.

### O que merece atenção

O grupo é um filtro de consulta; não transfere pessoas nem altera o histórico. Finalizar ponto exige Todos; arquivar a quinzena exige também Todas as obras.

<a id="guia-ponto_geral_central"></a>

## Gestão do ponto · Administrativo

Conferir separadamente os registros de Administrativo.

### Antes de começar

Escolha o grupo, a competência e a obra. A aba Administrativo inclui engenheiros e mestres, mesmo quando estão lotados em obra.

### Como fazer

1. Escolha Pessoal de obra ou Administrativo no início da tela.
2. Confira o período e a obra; trocar de grupo preserva esses filtros.
3. Revise os registros das pessoas do grupo. Use Todos para conferir a empresa completa.

### Como conferir se deu certo

A lista e os totais mostram o grupo selecionado.

### O que merece atenção

O grupo é um filtro de consulta; não transfere pessoas nem altera o histórico. Finalizar ponto exige Todos; arquivar a quinzena exige também Todas as obras.

<a id="guia-folha_obras"></a>

## Folha · Pessoal de obra

Conferir separadamente os registros de Pessoal de obra.

### Antes de começar

Escolha o grupo, a competência e a obra. A aba Administrativo inclui engenheiros e mestres, mesmo quando estão lotados em obra.

### Como fazer

1. Escolha Pessoal de obra ou Administrativo no início da tela.
2. Confira a competência, o ciclo e a obra. No celular, abra Competência e escopo para alterá-los e use Buscar funcionário na folha para localizar uma pessoa. Na Folha da quinzena, totais, pendências e relatórios respeitam o grupo.
3. Em Holerites CLT, escolha uma pessoa do grupo. Confirme o descarte se houver edição não salva antes de trocar de grupo.
4. Para fechar ou reabrir a quinzena da empresa inteira, escolha Todos e Todas as obras e revise as pendências.
5. No celular, Buscar funcionário na folha consulta todo o recorte em páginas de até seis pessoas. Abra Indicadores da área para consultar os totais e Pendências para conferir para ver a lista de alertas da quinzena, quando houver.

### Como conferir se deu certo

A lista e os totais mostram o grupo selecionado.

### O que merece atenção

O fechamento inclui os dois grupos. As áreas gerais, como encargos e projeção, mantêm seu escopo próprio; nelas o seletor de grupo não aparece. O grupo não muda a lotação nem o cálculo individual.

<a id="guia-folha_central"></a>

## Folha · Administrativo

Conferir separadamente os registros de Administrativo.

### Antes de começar

Escolha o grupo, a competência e a obra. A aba Administrativo inclui engenheiros e mestres, mesmo quando estão lotados em obra.

### Como fazer

1. Escolha Pessoal de obra ou Administrativo no início da tela.
2. Confira a competência, o ciclo e a obra. No celular, abra Competência e escopo para alterá-los e use Buscar funcionário na folha para localizar uma pessoa. Na Folha da quinzena, totais, pendências e relatórios respeitam o grupo.
3. Em Holerites CLT, escolha uma pessoa do grupo. Confirme o descarte se houver edição não salva antes de trocar de grupo.
4. Para fechar ou reabrir a quinzena da empresa inteira, escolha Todos e Todas as obras e revise as pendências.
5. No celular, Buscar funcionário na folha consulta todo o recorte em páginas de até seis pessoas. Abra Indicadores da área para consultar os totais e Pendências para conferir para ver a lista de alertas da quinzena, quando houver.

### Como conferir se deu certo

A lista e os totais mostram o grupo selecionado.

### O que merece atenção

O fechamento inclui os dois grupos. As áreas gerais, como encargos e projeção, mantêm seu escopo próprio; nelas o seletor de grupo não aparece. O grupo não muda a lotação nem o cálculo individual.

<a id="guia-home"></a>

## Dashboard

Entender a situação da empresa e decidir o que conferir primeiro.

### Antes de começar

Escolha o mês. Os indicadores consolidam os dados do seu acesso; Obra em foco não filtra o painel.

### Como fazer

1. Leia Entradas de caixa, Custos reconhecidos e Movimento líquido de caixa.
2. Abra Como ler os indicadores para conferir faturamento por competência, entradas, saídas e os critérios de situação das obras.
3. Ao abrir um indicador financeiro, confira o mesmo mês e o recorte consolidado no DRE de destino. Obra em foco permanece disponível para as telas operacionais.
4. Abra uma obra ou uma pendência e confira os registros de origem antes de tomar uma decisão.
5. Se Atualizar falhar, a consulta mantém os dados exibidos. Sem conexão, reconecte-se antes de tentar novamente. A mensagem só menciona edição protegida quando houver edição pendente; atualizar não reenvia uma confirmação operacional.

### Como conferir se deu certo

Você distingue resultado por competência de movimento de caixa e identifica o recorte da consulta.

### O que merece atenção

Entradas menos saídas no mês não é saldo bancário acumulado. O percentual de custos usa faturamento por competência; sem faturamento positivo, não se apresenta percentual. A contagem de críticas do critério executivo usa o cadastro completo disponível; Suas obras hoje usa a classificação operacional descrita no quadro.

<a id="guia-tv"></a>

## Modo TV

Acompanhar os indicadores em uma tela de apresentação.

### Antes de começar

Confirme a data da última atualização.

### Como fazer

1. Escolha a visão disponível para apresentação.
2. Leia os dados e os alertas apresentados.
3. Use a atualização disponível quando precisar de dados recentes.

### Como conferir se deu certo

A visão está pronta para acompanhamento.

### O que merece atenção

Esta tela é de consulta; alterações são feitas nos módulos de origem.

<a id="guia-chat"></a>

## Comunicação

Encontrar prioridades da equipe e consultar tarefas na origem.

### Antes de começar

Confira seu acesso, a obra e quem é responsável pelo ajuste e pela validação.

### Como fazer

1. Em Notificações, escolha Situação das tarefas e use Buscar tarefas por obra, responsável, descrição ou código. Use Anterior e Próxima para percorrer os registros.
2. Confira o registro, a obra, o responsável pelo ajuste, o prazo e a próxima ação. Prazo não definido significa que a origem não informou uma data.
3. Use Abrir pendência para consultar somente aquele achado na vistoria. A decisão e as evidências continuam na Conferência. Mostrar todas as pendências amplia a consulta dentro da vistoria.
4. Use Voltar a Comunicação para retornar. A situação selecionada nas tarefas permanece na sessão. Resolvidas ou canceladas mostra o encerramento informado pela origem.
5. Para conversar, use Abrir chat da equipe no cabeçalho. Confira a conversa antes de enviar. O ranking e as prioridades de ponto e diário continuam nas respectivas áreas.
6. Conversa, decisões e acompanhamento reúne as explicações adicionais. As tarefas e decisões disponíveis aparecem primeiro para facilitar o uso no celular.
7. No celular, a lista mostra até seis tarefas por página. Buscar tarefas consulta todos os resultados. Abra Prioridades da equipe para conferir ponto, diário e conferências por engenheiro.
8. Voltar a Comunicação também restaura a Obra em foco que estava selecionada antes de abrir a pendência. Isso não transfere o achado de obra.

### Como conferir se deu certo

A pendência abre no registro correto, sem criar outra tarefa. Depois da confirmação operacional, o quadro acompanha a situação de origem.

### O que merece atenção

Uma mensagem não substitui aprovação, pagamento, evidência de correção ou validação técnica. A lista respeita as permissões e a obra do perfil; nenhuma conversa é enviada ao abrir uma tarefa.

<a id="guia-aprov_pend"></a>

## Minhas aprovações

Conferir as decisões formais que aguardam sua análise.

### Antes de começar

Tenha a solicitação e seus documentos disponíveis para conferência.

### Como fazer

1. Leia O que entra nesta fila. Só aparecem decisões em andamento em que você é elegível nesta etapa.
2. Quando disponível, use Consultar solicitação para conferir o registro em Compras. Voltar a Minhas aprovações retorna à fila sem decidir.
3. Confira os dados e registre Aprovar ou Reprovar apenas depois da análise. Para reprovar, informe a justificativa.
4. Abra Solicitações sem fluxo de aprovação compatível para consultar o diagnóstico separado: use Abrir solicitação e peça ao administrador para conferir o fluxo. Não há botão de decisão nesse diagnóstico.

### Como conferir se deu certo

Uma decisão só é concluída quando o servidor confirma. Consultar a origem não aprova nem recria o fluxo.

### O que merece atenção

A lista de Compras também inclui etapas de outras pessoas, solicitações em análise e registros anteriores. Estar citado em um aviso não garante elegibilidade na etapa atual. Não confunda fila vazia com todas as solicitações aprovadas.

<a id="guia-admin_central"></a>

## Central do administrador

Conferir acessos, pendências e funcionamento do sistema.

### Antes de começar

Entre com um perfil autorizado para administração.

### Como fazer

1. Escolha o painel em Áreas da administração. Na auditoria, use Pesquisar e abra Filtros para refinar. Anterior e Próxima percorrem todos os resultados. Abra Indicadores e ferramentas da auditoria para consultar o resumo ou exportar.
2. Abra a pendência e confira o usuário, a obra ou o registro de origem.
3. Trate o problema na função correspondente e confira o retorno.

### Como conferir se deu certo

Você conhece a origem da pendência e a situação após o tratamento.

### O que merece atenção

Confira o alcance de cada ação. Em Motor financeiro, leia a ativação separadamente das verificações pendentes.

<a id="guia-obras"></a>

## Obras

Localizar, cadastrar e abrir uma obra.

### Antes de começar

Tenha o nome, o cliente e os dados contratuais da obra.

### Como fazer

1. Pesquise a obra na lista ou use Nova obra quando tiver permissão.
2. No cadastro, preencha os dados solicitados, revise e salve. Informe datas que existam no calendário.
3. Abra a obra para acessar orçamento, planejamento, equipe e demais áreas.
4. Para organizar pastas no OneDrive, o administrador abre Arquivos e pastas e usa Preparar pastas quando a integração estiver conectada. Abrir a Central de obras só consulta os dados.
5. No contrato por administração, escolha separadamente Equipamentos / locação e Engenharia de campo para definir se esses custos recebem a taxa. Para excluir engenharia, selecione a Categoria de custo da engenharia de campo já usada nos lançamentos. Não há vínculo por nome ou descrição. Revise a base antes de salvar.
6. Na lista, confira o intervalo de resultados. Anterior e Próxima mostram até 12 registros por página; a busca considera toda a lista disponível, não só a página atual. Alterar o recorte volta à primeira página. Totais e relatórios continuam usando o conjunto completo.
7. No celular, Indicadores da área reúne os totais da carteira sem afastar a busca. Abra para consultar; os filtros e a paginação ficam antes dos cartões.

### Como conferir se deu certo

A obra aparece na lista e seu painel abre com o nome correto.

### O que merece atenção

A exclusão é bloqueada quando há orçamento, planejamento, contrato, documento ou histórico vinculado, inclusive lotação anterior de funcionário. Para preservar a obra e seus registros, altere o Status para Pausada ou Concluída conforme a situação. Isso não apaga receitas, custos ou pagamentos. Desmarcar a incidência da taxa mantém o custo da obra e o resultado realizado no DRE. As opções alteram a previsão de administração; não emitem cobranças. Contratos existentes mantêm a regra anterior até alteração explícita.

<a id="guia-obra_geral"></a>

## Visão geral da obra

Consultar o resumo e acessar as áreas de uma obra.

### Antes de começar

Confira o nome da obra no cabeçalho.

### Como fazer

1. Leia o resumo e as ações disponíveis.
2. Escolha a área da obra pelo menu ou seletor de telas.
3. Consulte os detalhes na área escolhida e retorne à visão geral quando necessário.
4. Nos atalhos da visão geral, Abrir Medições a faturar consulta cobranças do cliente. Em Obra → Medição física, acompanhe o avanço dos serviços. Ao escolher um grupo do menu, sua primeira tela abre imediatamente.

### Como conferir se deu certo

Você está na área desejada, mantendo a obra selecionada.

### O que merece atenção

A lotação administrativa da equipe e a obra onde o ponto foi capturado são informações diferentes.

<a id="guia-orc"></a>

## Orçamento

Organizar os serviços, quantidades e preços previstos para a obra.

### Antes de começar

Selecione a obra e confira a versão do orçamento.

### Como fazer

1. Use Novo orçamento para cadastrar ou abra um orçamento existente. Ao vincular uma obra no novo orçamento, Cliente, Local / Endereço e Área construída são preenchidos a partir dessa obra. Confira os valores; suas edições são preservadas ao trocar a obra. Guia do orçamento explica os recursos desta tela.
2. Cadastre até seis níveis de etapas e confira os serviços.
3. Revise unidade, quantidade, composição e preço de cada item.
4. Confira os totais, salve as alterações e use a saída de relatório disponível.
5. Em Análises e ferramentas, abra Conferência do orçamento inteiro. Use Tipo de ocorrência para ver A medir, A cotar ou Fora do escopo. Filtre por Etapa da ocorrência ou busque pelo item. Selecione a ocorrência para abrir a linha e revisar quantidade, preço ou composição.
6. Em uma versão editável, use Excluir do escopo somente depois de confirmar que o serviço pendente não faz parte da obra. Informe o Motivo da exclusão e confirme. Use Fora do escopo para consultar o responsável e a data ou para Reincluir no escopo. Alterar os dados do serviço pode reabrir a pendência.
7. Confira Total parcial na tela, no PDF e no Excel enquanto houver serviços a medir ou a cotar. No PDF, as exclusões aparecem junto aos itens. No Excel, consulte a aba Fora do escopo para ver os motivos e responsáveis.
8. Em Dados e versões, use Comparar revisões para consultar as diferenças por serviço entre versões do mesmo orçamento.

### Como conferir se deu certo

A versão consultada contém os itens e totais esperados.

### O que merece atenção

Não altere quantidades só para ajustar o total. Confira a versão antes de editar.

<a id="guia-plan"></a>

## Planejamento

Distribuir os serviços no tempo e acompanhar o andamento.

### Antes de começar

Confirme a obra e o orçamento usado no planejamento.

### Como fazer

1. Confira a obra e o cronograma. Se as etapas estiverem pendentes, use Atualizar cronograma pelo orçamento. A abertura da tela só consulta o plano. A ação exige permissão de edição e disponibilidade para salvar.
2. Se aparecer Resolver salvamento, confira a edição protegida antes de continuar. Após falha de armazenamento, use Verificar armazenamento na recuperação; após conflito, consulte a versão atual e faça a escolha indicada. A abertura da tela não deve reenviar uma edição recusada.
3. Selecione as atividades e revise os vínculos com o orçamento. Se aparecer Vínculos do cronograma exigem conferência, confira com o administrador os planos, as tarefas e as identificações das versões. Não apague uma tarefa nem escolha um orçamento só pela semelhança do nome. Enquanto houver ambiguidade, a tela permite escolher outra obra e ler a orientação, sem editar o cronograma.
4. Defina datas e duração no cronograma.
5. Acompanhe o realizado e compare com a linha de base, quando houver.
6. Para aprovação e versões preservadas, abra Linha de base aprovada e SPI. Prepare uma proposta, confira os itens e calendário e solicite aprovação ao administrador ou à diretoria. A Ajuda passa a mostrar o guia específico enquanto essa área estiver aberta. Fotografias legadas de datas não calculam SPI.
7. Evolução informada acompanha os percentuais do planejamento. O avanço oficial depende de boletins técnicos aprovados, disponíveis em Medição física. Abra Escala, calendário e colunas quando precisar ajustar a visualização.

### Como conferir se deu certo

O cronograma mostra as atividades nas datas esperadas. Completar um vínculo antigo preserva as tarefas já planejadas, suas datas, progresso e linha de base.

### O que merece atenção

Linha de base é a referência aprovada para comparação; confira antes de substituí-la. A sincronização do cronograma não confirma compras, estoque, custos ou pagamentos na Demonstração do Resultado (DRE).

### Quando o fluxo acontece de outro jeito

- **Necessidade e compra parcial:** Na consulta temporal do Financeiro, confira a necessidade revisada e a quantidade comprovada por item. A diferença exige decisão em Compras. Conversão sem fator ou vínculo sem identidade ficam para conferência.
- **Entrega posterior à etapa simulada:** Abra o pedido para revisar o prazo com Compras. A simulação não reagenda nem muda o vencimento financeiro.

<a id="guia-plan_suprimentos"></a>

## Marcos e Curva A

Relacionar os insumos de maior impacto do orçamento aos prazos da obra.

### Antes de começar

Confira a obra, o orçamento com insumos vinculados e o cronograma. A aprovação da proposta exige administrador ou engenheiro auditor.

### Como fazer

1. Selecione a Obra. No celular, use Áreas dos suprimentos estratégicos para escolher a consulta.
2. Em Visão geral, use Gerar proposta ABC e revise a proposta antes de Aprovar proposta, quando seu perfil permitir.
3. Escolha o Perfil de fornecimento e use Gerar planos dos itens A depois da aprovação.
4. Consulte Insumos A, Gantt de suprimentos e Detalhe para conferir necessidade, prazo sugerido e compromisso.
5. Em Configuração, confira os limites das classes A e B e os perfis de prazo de fornecimento.

### Como conferir se deu certo

Os planos dos itens prioritários mostram necessidade e prazo para revisão.

### O que merece atenção

A Curva A destaca itens de maior peso; gerar proposta ou plano não confirma compra nem entrega. Alterar parâmetros não modifica propostas já aprovadas.

<a id="guia-projetos"></a>

## Projetos

Organizar o acompanhamento dos projetos de engenharia.

### Antes de começar

Confira o projeto, a obra e seu responsável.

### Como fazer

1. Localize ou cadastre o projeto, conforme seu acesso.
2. Abra o projeto para consultar tarefas, documentos e registros disponíveis.
3. Atualize a atividade ou o acompanhamento e confira o retorno.

### Como conferir se deu certo

O projeto apresenta a informação atualizada na área correta.

### O que merece atenção

Ao usar o controle de tempo, confira a sessão ativa e encerre-a ao concluir a atividade.

<a id="guia-rdo"></a>

## Diário de obra

Levantar diariamente as atividades e a produção da obra, sem repetir dados já cadastrados.

### Antes de começar

O engenheiro deve conferir a obra, a data, o planejamento, o orçamento de controle e o ponto do dia.

### Como fazer

1. Pesquise por código, obra ou descrição. No celular, toque em Filtros para ajustar datas, obra, status e clima.
2. Abra Novo relatório ou o diário em preparação.
3. Leia as atividades previstas no planejamento e use Levantar para abrir a atividade, ou + Serviço para outra atividade.
4. Selecione o serviço. Quando houver um único item na etapa, o vínculo orçamentário e a unidade vêm preenchidos. Caso contrário, escolha Item do orçamento da atividade uma vez.
5. Use Vincular equipe presente do ponto e confira quem realmente executou. Registre Quantidade executada hoje, inclusive zero se não houve produção aceita. O acumulado anterior revisado sugere o novo percentual; confira o Progresso acumulado.
6. Horas do ponto vêm dos horários completos, com intervalo descontado. Se a pessoa participou de várias atividades, distribua Horas nesta atividade sem superar sua jornada. Horários pendentes devem ser resolvidos no ponto.
7. Salve o serviço e confira a confirmação do servidor. Complete o relato e o clima de manhã e tarde; o clima noturno é opcional. Faça a revisão técnica e use Concluir relatório. Apenas o engenheiro pode revisar e concluir.
8. Após concluir, use Consultar no histórico para conferir Produção do dia, Unidade registrada, Item do orçamento, Progresso acumulado e horas de cada pessoa. PDF abre a impressão com os mesmos dados. Horas de atividade única identificam o ponto consultado e a data; divisões explícitas aparecem como apropriação registrada. Registros antigos mostram Não informado quando não possuem o dado.
9. Em Previsões gerenciais, os dados confirmados alimentam automaticamente saldo a executar, produtividade e dimensionamento.

### Como conferir se deu certo

O levantamento fica vinculado à atividade, ao item do orçamento, às pessoas e à data. As previsões consultam somente os diários concluídos e revisados.

### O que merece atenção

RDO significa Relatório Diário de Obra. O ponto não comprova qual atividade foi executada nem sua quantidade; o engenheiro registra esses fatos. Diário com ponto incompleto pode ser documentado, mas sua produtividade fica pendente. Alterar serviços invalida a revisão anterior. Reabertura ou cancelamento retira a produção da previsão. Duplicar um diário cria um rascunho sem copiar produção, equipe ou uso de equipamento de outro dia. Fotos, voz e sugestões de IA exigem revisão e não viram medição confirmada automaticamente.

<a id="guia-conferencia"></a>

## Conferência

Registrar vistorias e validar correções.

### Antes de começar

Confira obra e responsável pela vistoria.

### Como fazer

1. Ao chegar de uma tarefa da Comunicação, Pendência de origem identifica o achado aberto por vínculo. Mostrar todas as pendências amplia a consulta dentro da mesma vistoria. Use Voltar a Comunicação para retornar sem registrar uma validação.
2. Confira Escopo do ranking. Na central, o ranking compara todas as obras disponíveis; o filtro Obra seleciona a lista de conferências. Ao abrir uma obra fixa, o ranking se limita a ela.
3. Abra a foto. Em Ferramentas e zoom, escolha ferramenta, cor e espessura.
4. Desfazer recupera Limpar anotações. Salvar preserva o original; no formulário, confirme também Salvar achado.
5. Fechar ou Escape pede confirmação das alterações. Continuar editando mantém o rascunho. Ao fechar o editor, o foco do teclado volta à miniatura que abriu a foto, quando ela continua disponível.
6. A pessoa atribuída envia a correção; o vistoriador valida.

### Como conferir se deu certo

Confira a situação da pendência após validar.

### O que merece atenção

Enviar foto de correção não encerra a pendência. A validação cabe ao vistoriador ou administrador.

<a id="guia-med"></a>

## Avanço físico

Acompanhar a quantidade de serviço executada na obra.

### Antes de começar

Confira a obra, o período e os serviços do orçamento.

### Como fazer

1. Abra os serviços a medir.
2. Informe ou confira as quantidades executadas e as evidências.
3. Revise os totais e salve a medição na competência correta.
4. Use Buscar serviço da medição para localizar um serviço sem alterar os demais. Evolução por valor pondera o valor dos serviços; sem valores vinculados, mostra Sem base de valor. No Planejamento, a média pondera a duração. O avanço oficial depende dos boletins técnicos aprovados; informar percentuais não substitui essa aprovação.
5. Na lista, confira o intervalo de resultados. Anterior e Próxima mostram até 12 registros por página; a busca considera toda a lista disponível, não só a página atual. Alterar o recorte volta à primeira página. Totais e relatórios continuam usando o conjunto completo.

### Como conferir se deu certo

A evolução registrada corresponde ao serviço conferido.

### O que merece atenção

Medição de execução e recebimento financeiro são etapas diferentes.

<a id="guia-est"></a>

## Estoque

Acompanhar materiais que entraram, saíram ou foram transferidos.

### Antes de começar

Confira a obra, o material e a unidade de medida.

### Como fazer

1. Consulte o saldo e o histórico do material.
2. Registre a movimentação disponível com quantidade e motivo.
3. Confira o saldo e a movimentação após a confirmação.

### Como conferir se deu certo

O histórico explica a mudança do saldo do material.

### O que merece atenção

Compra e pagamento não comprovam entrada física. Evite duplicar uma entrada já feita pelo recebimento do pedido.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-cmp"></a>

## Compras

Acompanhar a compra desde a necessidade até a entrega.

### Antes de começar

Confirme a obra e o material necessário.

### Como fazer

1. Na Fila de trabalho, escolha Tabela ou Kanban em Visualização. Busca, obra, etapa e prazo são os mesmos; exportar considera todo o recorte. A visão fica salva por usuário neste navegador; filtros e agrupamento são preservados ao navegar na sessão. No Mapa gerencial, Abrir Kanban da fila abre esse mesmo quadro.
2. Clique no código para consultar a ficha rápida; use a próxima ação para continuar. Confira a necessidade da obra, o estoque e os pedidos em aberto. Registre ou localize a solicitação.
3. Compare as propostas e condições, registre a decisão e acompanhe o pedido. Aprovações pendentes ficam sinalizadas, sem impedir o andamento.
4. Registre a entrega física para dar entrada no estoque. Vincule a nota e registre os pagamentos reais quando ocorrerem; essas etapas podem acontecer em outra ordem.
5. Na Fila de trabalho, abra o registro e use a Próxima ação. Analisar solicitação fecha a ficha de consulta e posiciona a solicitação exata em Solicitar; confira o número destacado antes de agir.

### Como conferir se deu certo

Você sabe em que etapa a compra está e qual é a próxima ação.

### O que merece atenção

No Kanban, arrastar só prepara etapas válidas; confira o formulário e confirme. A ação do cartão também funciona sem arrastar. Concluídos ficam no histórico. Os avisos orientam sem travar etapas. Cada registro conserva sua situação: receber não paga, pagar não aprova a conferência fiscal e consultar a ficha não altera dados.

### Exemplo ilustrativo

A obra precisa de 10 sacos de cimento. Registre a necessidade em Solicitar, compare as propostas em Cotar e acompanhe o pedido até a entrega em Receber.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-cmp_solicitacoes"></a>

## Compras · Solicitar

Informar uma necessidade de material.

### Antes de começar

Tenha obra, descrição, unidade, quantidade e data necessária.

### Como fazer

1. Ao chegar de Minhas aprovações, a solicitação de origem fica destacada na obra correspondente. Consulte o registro e use Voltar a Minhas aprovações para retornar. Abrir a solicitação não aprova nem altera seu fluxo.
2. Abra Solicitar e use Nova solicitação.
3. Para aproveitar uma conversa, use Colar pedido do WhatsApp, cole o texto ou print e clique em Analisar pedido. Confira a leitura e use Usar itens no rascunho.
4. Revise obra, data necessária, materiais, quantidades, unidades e etapa do orçamento; preencha os dados ausentes.
5. Use Formalizar e enviar para Compras e aguarde a confirmação do servidor. Consulte Pedido original da conversa na solicitação.
6. Confira Unidade de compra e o conteúdo de cada embalagem na unidade de referência. Use a embalagem ou o certificado do fornecedor: descrição, bitola e comprimento não definem o fator automaticamente. Ao trocar unidade ou comprimento, confira e informe o fator novamente.

### Como conferir se deu certo

A necessidade aparece na fila com o original da conversa, quando informado.

### O que merece atenção

A análise não aprova nem compra materiais. O print exige Drive conectado; se o envio falhar, o formulário permanece aberto. Uma solicitação ainda não é um pedido ao fornecedor.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-cmp_mensagem"></a>

## Compras · Pedido por texto ou print

Preparar uma solicitação a partir de uma conversa.

### Antes de começar

Tenha a IA configurada. Para guardar o print, conecte o Drive da obra.

### Como fazer

1. Em Nova solicitação, abra Colar pedido do WhatsApp.
2. Cole em Texto do pedido ou print colado. Para imagem, use Ctrl+V ou Selecionar print: PNG, JPG ou WEBP até 2 MB. Texto: até 6.000 caracteres.
3. Clique em Analisar pedido. Confira materiais, quantidades, unidades e avisos. Se falhar, tente novamente ou preencha manualmente.
4. Use Usar itens no rascunho. Os itens são acrescentados, mantendo obra e data. Corrija dados ausentes e confira o orçamento. O original fica protegido; para outra conversa, inicie outra solicitação.
5. Use Formalizar e enviar para Compras. O print vai ao Drive antes da gravação. Em caso de falha, o formulário permanece aberto para tentar novamente. Consulte Pedido original da conversa no registro.

### Como conferir se deu certo

A solicitação conserva o pedido original e a confirmação do fluxo existente.

### O que merece atenção

A IA pode errar: confira quantidades, embalagens e unidades. Recorte informações pessoais desnecessárias; o conteúdo vai à IA configurada no ERP. Não há envio de mensagens, aprovação, pedido ao fornecedor ou pagamento automático.

<a id="guia-cmp_cotacoes"></a>

## Compras · Cotar

Comparar propostas de fornecedores para a mesma necessidade.

### Antes de começar

Confira os itens e as quantidades da solicitação.

### Como fazer

1. Abra ou prepare a cotação dos itens.
2. Registre as propostas e compare preço, frete, descontos e prazo.
3. Escolha a proposta por item, justifique quando solicitado e confirme a decisão.

### Como conferir se deu certo

A decisão identifica os fornecedores e os itens atendidos.

### O que merece atenção

Uma decisão parcial não resolve os itens restantes. Confira o custo final e as condições.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-cmp_aprovacoes"></a>

## Compras · Aprovações

Analisar as decisões de compra que aguardam autorização.

### Antes de começar

Confira o limite e a responsabilidade do seu perfil.

### Como fazer

1. Abra a decisão pendente.
2. Leia as propostas, o custo final, a obra e a justificativa.
3. Aprove ou recuse pela ação disponível e confira a situação após confirmar.

### Como conferir se deu certo

A decisão fica registrada e a compra pode seguir a etapa autorizada.

### O que merece atenção

Aprovação comercial não é confirmação de recebimento físico.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-cmp_pedidos"></a>

## Compras · Pedidos

Conferir e acompanhar os compromissos com fornecedores.

### Antes de começar

Tenha o fornecedor, a obra e as condições negociadas.

### Como fazer

1. Localize o pedido e abra sua ficha.
2. Confira itens, quantidades, entrega, frete e condições de pagamento.
3. Use a ação disponível para o estado do pedido e acompanhe a resposta.
4. Compare preços somente na mesma unidade e com conversão conferida. Se a comparação estiver indisponível, confira a unidade de referência, o preço e o fator antes de decidir.

### Como conferir se deu certo

A ficha do pedido e sua situação correspondem ao combinado.

### O que merece atenção

Pedido cancelado mantém histórico. Não recrie o pedido antes de conferir o que já foi confirmado.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-cmp_recebimentos"></a>

## Compras · Receber

Registrar o que chegou fisicamente à obra.

### Antes de começar

Confira a entrega, o pedido e a pessoa que recebeu.

### Como fazer

1. Localize o pedido aguardando recebimento.
2. Informe somente as quantidades que chegaram e registre a conferência solicitada.
3. Use Dar entrada no estoque e confira o recebido, o saldo pendente e o estoque. Sem confirmação, repita o botão ou, após recarregar, use Retomar trabalho salvo.
4. Se a entrada for recusada por conversão ou unidade incompatível, confira o pedido e o cadastro do material vinculado antes de tentar novamente. O sistema calcula quantidade e custo do estoque pelo pedido e não corrige entradas antigas automaticamente.

### Como conferir se deu certo

O pedido mostra a entrega total ou parcial correta.

### O que merece atenção

Registre o que realmente chegou, mesmo com nota ou pagamento pendentes. Quantidade acima do pedido gera aviso e deve ser conferida com o fornecedor. A entrada de estoque é criada junto com o recebimento; não a repita manualmente.

### Exemplo ilustrativo

Foram pedidos 10 sacos e chegaram 6: registre 6 e acompanhe os outros 4. Se chegaram 12 de fato, registre 12 e confira o aviso da diferença; não reduza a quantidade apenas para fazê-la coincidir com o pedido.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-fornecedores"></a>

## Fornecedores

Consultar fornecedores e seu histórico de atendimento.

### Antes de começar

Tenha nome ou documento do fornecedor para evitar duplicidade.

### Como fazer

1. Pesquise o fornecedor antes de cadastrar.
2. Confira contatos, identificação e informações disponíveis.
3. Consulte as avaliações e o histórico para apoiar a escolha na compra.
4. Na lista, confira o intervalo de resultados. Anterior e Próxima mostram até 12 registros por página; a busca considera toda a lista disponível, não só a página atual. Alterar o recorte volta à primeira página. Totais e relatórios continuam usando o conjunto completo.
5. No celular, use Buscar fornecedor e abra Obra e período para alterar o recorte. O ranking mostra a nota geral. Toque no nome para conferir preço, frete, prazo, qualidade e a quantidade de evidências. Abra Indicadores de fornecedores para consultar os totais ou Como a nota é calculada para consultar os critérios.

### Como conferir se deu certo

Você encontrou o fornecedor correto e seus dados de contato.

### O que merece atenção

O histórico apoia a decisão; confira também preço, prazo e condições da proposta atual.

<a id="guia-suprimentos"></a>

## Curva e preços

Comparar consumo previsto, compras e histórico de preços.

### Antes de começar

Selecione a obra e os materiais que quer analisar.

### Como fazer

1. Escolha a consulta de curva, preços ou alertas.
2. Localize o material e confira unidade, período e fornecedor.
3. Compare registros equivalentes e consulte a origem quando houver diferença.

### Como conferir se deu certo

Você identificou materiais prioritários ou preços a conferir.

### O que merece atenção

Preços com unidades, frete e condições diferentes não são diretamente comparáveis.

<a id="guia-ponto"></a>

## Ponto por obra

Conferir a presença e os registros da equipe em uma obra.

### Antes de começar

Escolha Pessoal de obra, Administrativo ou Todos; depois confira a obra e o período.

### Como fazer

1. Confira a data. O nome abre a ficha conforme seu acesso.
2. Marque Presente, Meio dia ou Falta. Mais opções reúne outras situações, jornada e observações. Férias, atestado e folga são registros válidos e aparecem no cartão.
3. Transferir e Desligar ficam no cartão quando permitidos. Confira e confirme; Cancelar não grava.
4. Na lista, confira o intervalo de resultados. Anterior e Próxima mostram até 12 registros por página; a busca considera toda a lista disponível, não só a página atual. Alterar o recorte volta à primeira página. Totais e relatórios continuam usando o conjunto completo.
5. No celular, abra Obras com ponto pendente para escolher uma obra que precisa de conferência. Pesquisar no ponto consulta todo o recorte em páginas de até seis pessoas. Abra Ações em lote para ler o alcance e usar Todos presentes ou Todos com falta.

### Como conferir se deu certo

A consulta mostra a pessoa, a data e a obra corretas.

### O que merece atenção

Ausência de batida não confirma falta; registros offline dependem de sincronização. Ao salvar ou sincronizar três dias trabalhados consecutivos na mesma obra nova, a lotação do funcionário ativo é atualizada. Presença e meio período contam; folgas não contam e outra obra interrompe a sequência. Histórico, pontos antigos, pagamentos, desligamentos e decisões posteriores do RH são preservados. Pesquisar no ponto e a paginação organizam somente a leitura. Todos presentes e Todos com falta continuam abrangendo todos os funcionários da obra, data e grupo selecionados, conforme o aviso Ações em lote. Confira esse recorte antes de confirmar o lote.

<a id="guia-ponto_geral"></a>

## Gestão do ponto

Conferir o ponto da equipe no período.

### Antes de começar

Escolha Pessoal de obra, Administrativo ou Todos; depois selecione o período e os filtros de funcionários e obras.

### Como fazer

1. Localize as situações que precisam de conferência.
2. Abra os registros e compare horários, origem e informações disponíveis.
3. Trate as pendências pelas ações autorizadas e confira o resultado.

### Como conferir se deu certo

As pendências foram conferidas com base nos registros disponíveis.

### O que merece atenção

Batidas do ponto eletrônico são imutáveis; não suponha que uma consulta altere a marcação original.

<a id="guia-ponto_app"></a>

## Ponto eletrônico (app)

Conferir aparelhos, batidas e fotos.

### Antes de começar

Confira a obra, o aparelho e a conexão Microsoft.

### Como fazer

1. Leia Escopo do ponto. A consulta usa a Obra selecionada nesta tela, independentemente de Obra em foco. Trocar a consulta não transfere funcionários nem altera batidas.
2. Consulte os aparelhos e a sincronização.
3. Confira batidas e fotos.
4. Trate as pendências permitidas ao seu perfil.

### Como conferir se deu certo

Registros e pendências identificados.

### O que merece atenção

Fotos novas de batidas e cadastro facial vão ao OneDrive, pasta Ponto de Obra; não mova, compartilhe nem apague essa pasta. As antigas ficam no Supabase. Se o envio falhar, mantenha os dados do aparelho e avise o administrador. O Supabase continua necessário.

<a id="guia-equipe"></a>

## Equipes

Gerir vínculos e desligamentos.

### Antes de começar

Localize a pessoa. Acesso de RH ou administrador.

### Como fazer

1. Use Desligar na linha do funcionário, sem abrir Detalhes.
2. Informe Último dia trabalhado e Tipo de desligamento. Use Confirmar desligamento; Cancelar não grava.
3. Rever saída altera agendamentos; Ver saída consulta uma saída registrada.
4. O nome abre a ficha. Confira Vínculo e desligamento no início. Ficha em PDF abre o documento; salve outras edições pelo cadastro.
5. Na lista, confira o intervalo de resultados. Anterior e Próxima mostram até 12 registros por página; a busca considera toda a lista disponível, não só a página atual. Alterar o recorte volta à primeira página. Totais e relatórios continuam usando o conjunto completo.
6. Pesquisar na equipe fica antes da lista. Abra Filtros para escolher Pendências da equipe, com Documentação vencida ou Sem lotação, e Filtrar por lotação. Situação da equipe controla ativos e demais vínculos. Recolher Filtros preserva as escolhas.

### Como conferir se deu certo

O cadastro mostra a saída confirmada.

### O que merece atenção

O último dia é inclusivo. Ponto e pagamentos são preservados; outras edições não são salvas.

<a id="guia-equipe_obras"></a>

## Equipe nas Obras

Conferir a distribuição da equipe.

### Antes de começar

Confira obra, data e sincronização.

### Como fazer

1. Consulte a distribuição por obra.
2. Confira lotação e batidas.
3. Encaminhe as divergências ao responsável.
4. A visão inicial oculta obras sem funcionários no recorte consultado. Abra Obras vazias neste filtro e use Mostrar obras vazias para incluí-las. Os funcionários sem registro continuam na consulta de ausências; ausência de batida não confirma falta.

### Como conferir se deu certo

Conferência concluída.

### O que merece atenção

Fotos novas vêm do OneDrive; antigas, do Supabase. Se a foto falhar, confira a conexão com o administrador; a consulta continua. Esta visão não cria nem encerra batidas. Ausência de registro não confirma falta.

### Exemplo ilustrativo

Uma pessoa está lotada na Obra A, mas registrou o ponto na Obra B. Confira a origem da captura antes de tratar isso como erro.

<a id="guia-terc"></a>

## Terceirizados

Acompanhar contratos e serviços de equipes terceirizadas.

### Antes de começar

Confira a obra, o prestador e o contrato.

### Como fazer

1. Localize ou cadastre o contrato conforme sua permissão.
2. Confira escopo, valores, itens e documentos.
3. Acompanhe medições e saldos no contrato correto. Vincular e conferir exige nota fiscal e medição da mesma obra, inclusive nos rateios.
4. No celular, a consulta começa pela lista de contratos. Use os filtros de contratos também no Kanban. Abra Aprovações pendentes para revisar a fila. Saldo das etapas usa os valores das etapas cadastradas; se houver divergência com o contrato, confira a origem antes de corrigir o cadastro.
5. Os percentuais mostram até duas casas decimais, com vírgula, para facilitar a leitura. Ao entrar no campo, a precisão completa é apresentada. Sair sem editar não arredonda o valor usado no cálculo. Digite com ponto ou vírgula, ou ajuste a barra deslizante. O valor anterior e a diferença continuam baseados na medição original.

### Como conferir se deu certo

O contrato apresenta os serviços e o saldo esperado.

### O que merece atenção

Uma medição com nota fiscal reconhecida não pode ser cancelada isoladamente: regularize o documento de origem com o financeiro antes de cancelar. Pagamentos exigem o estorno previsto no fluxo. Vínculos antigos inconsistentes aparecem como pendência financeira; não crie outra despesa para compensar. Medição e nota do mesmo fato reconhecem custo uma vez; pagamento e liberação de garantia não criam outro custo.

<a id="guia-folha_pendencias"></a>

## Folha · Pendências do RH

Resolver pendências por funcionário e mês.

### Antes de começar

Acesso para RH e administradores.

### Como fazer

1. Use Organizar pendências do RH ou escolha Pendências do RH em Áreas da folha.
2. Selecione Funcionário das pendências e Competência das pendências.
3. Siga Abrir cadastro, Abrir gestão do ponto, Abrir holerite ou Abrir folha e Abrir provisões. Para CLT, Abrir fechamento por obra leva ao dia e à obra da conferência.
4. Revise o destino. Voltar a Folha retoma as pendências.

### Como conferir se deu certo

Atalhos não gravam dados. Provisões mantêm a base salva ou mostram uma estimativa.

### O que merece atenção

CLT é o vínculo pela Consolidação das Leis do Trabalho. Registro ausente não comprova falta. Confira o ciclo: a quinzena de 21 a 05 atravessa dois meses. Trocar de área com edição pendente pede confirmação de descarte.

<a id="guia-folha"></a>

## Folha

Conferir o cálculo e os documentos da folha de pagamento.

### Antes de começar

Escolha Pessoal de obra, Administrativo ou Todos e selecione a competência, isto é, o mês de referência.

### Como fazer

1. Para RH e administradores, Organizar pendências do RH reúne cadastro, ponto, holerite e provisões.
2. Confira funcionários, ponto e informações que alimentam a folha.
3. No celular, abra Competência e escopo para trocar o período ou a obra. Use Buscar funcionário na folha e Próxima para localizar pessoas sem alterar os totais.
4. Abra Composição do pagamento para revisar parcelas e descontos. Abra Fechamento da quinzena para consultar a situação ou fechar após a revisão.
5. No celular, Buscar funcionário na folha consulta todo o recorte em páginas de até seis pessoas. Abra Indicadores da área para consultar os totais e Pendências para conferir para ver a lista de alertas da quinzena, quando houver.

### Como conferir se deu certo

A folha e os documentos refletem a competência conferida.

### O que merece atenção

Fechar ou emitir a folha não comprova pagamento; confira a situação financeira separadamente.

### Exemplo ilustrativo

Para conferir a folha de outubro, selecione a competência de outubro e revise os funcionários e descontos antes de fechar.

<a id="guia-resc"></a>

## Rescisão

Conferir parcelas e descontos da rescisão.

### Antes de começar

Tenha a pessoa, a data e o motivo do desligamento.

### Como fazer

1. Confira funcionário, parcelas e descontos.
2. Limpar cálculo pede confirmação. Continuar editando mantém o rascunho; o histórico é preservado.
3. Revise com o RH antes de Salvar no histórico.

### Como conferir se deu certo

Confira o registro salvo no histórico.

### O que merece atenção

Confirme os valores com o RH.

<a id="guia-rh_indic"></a>

## Indicadores de RH

Consultar os indicadores da equipe e do período.

### Antes de começar

Confirme período, obra e demais filtros.

### Como fazer

1. Escolha o indicador que deseja acompanhar.
2. Confira os totais e a lista que explica o resultado, quando disponível.
3. Abra o cadastro ou registro de origem para esclarecer divergências.
4. Este painel mostra quadro, movimentação, adiantamentos e documentação. Para valores de folha, use Consultar Folha quando disponível e escolha obra e período. Custos reconhecidos por competência são consultados no DRE conforme seu perfil; pagamento não deve duplicar custo.

### Como conferir se deu certo

Você consegue relacionar o indicador aos dados de origem.

### O que merece atenção

Compare períodos e grupos equivalentes; dados ainda não sincronizados podem afetar a leitura.

<a id="guia-dre_emp"></a>

## DRE empresa

Entender o resultado da empresa por mês de referência.

### Antes de começar

Escolha o período e confira a abrangência da análise. Se o DRE mensal estiver indisponível, use Tentar novamente ou escolha outro mês. Os resultados, parecer e exportação ficam disponíveis após uma consulta válida.

### Como fazer

1. Leia receitas, custos, despesas e resultado.
2. Abra o detalhamento ou memorial do valor que deseja conferir.
3. Compare com os registros de origem e use a visão anual quando necessário.
4. Na manutenção de equipamentos, confira o registro e a situação: manutenções canceladas não compõem o custo nem o memorial da competência. O registro cancelado permanece na origem para consulta.

### Como conferir se deu certo

Você sabe quais registros compõem o resultado do período.

### O que merece atenção

DRE é a Demonstração do Resultado. Resultado por competência é diferente do saldo bancário. Um fechamento antigo sem memorial conserva o total histórico; a consulta não reconstrói documentos ausentes nem reabre a competência. Confira o aviso de recorte e os filtros do próprio demonstrativo. Obra em foco é preservada para as telas operacionais e não substitui os filtros do DRE. O atalho financeiro do Dashboard leva o mês selecionado e o recorte consolidado; isso não altera lançamentos.

<a id="guia-dre"></a>

## DRE obras

Analisar receitas, custos e resultado de uma obra.

### Antes de começar

Selecione a obra e a competência desejada.

### Como fazer

1. No celular, escolha Visão do DRE e abra Período de análise para mudar ano, mês ou apuração.
2. No Resumo por obra, pesquise ou toque no nome da obra para abrir o recorte. Ao trocar a obra ou competência, aguarde o carregamento antes de conferir valores e exportar. Abra Demonstrativo da obra para ler as linhas detalhadas, ou toque em um indicador para conferir os movimentos de origem.
3. Compare com as medições e demais registros da mesma obra e período.
4. Na lista, confira o intervalo de resultados. Anterior e Próxima mostram até 12 registros por página; a busca considera toda a lista disponível, não só a página atual. Alterar o recorte volta à primeira página. Totais e relatórios continuam usando o conjunto completo.
5. Em Resumo por obra, use Pesquisar obra no resumo do DRE. A busca e a página não mudam os indicadores consolidados nem o relatório exportado. Gráficos do consolidado reúne as visualizações adicionais; a consulta por obra continua nos filtros do próprio DRE.
6. Se aparecer Cálculo local da obra, os valores foram calculados com os dados disponíveis no app. Use Tentar novamente. DRE PDF fica indisponível até o razão financeiro retornar o demonstrativo da obra e do período selecionados.
7. No celular, abra Demonstrativo consolidado completo para consultar todas as linhas do resultado. Os indicadores permanecem disponíveis; recolher o demonstrativo apenas organiza a leitura.

### Como conferir se deu certo

O resultado pode ser explicado pelos registros apresentados.

### O que merece atenção

Receita de uma competência pode ser recebida em outra data. Confira o regime da consulta. Confira o aviso de recorte e os filtros do próprio demonstrativo. Obra em foco é preservada para as telas operacionais e não substitui os filtros do DRE. O atalho financeiro do Dashboard leva o mês selecionado e o recorte consolidado; isso não altera lançamentos.

<a id="guia-fin"></a>

## Gestão financeira

Organizar a rotina de documentos, pagamentos, caixa e resultado.

### Antes de começar

Confira a obra e o período antes de trabalhar.

### Como fazer

1. Use Hoje, Caixa por conta, Documentos ou Pagamentos para a rotina. No computador, abra Mais áreas para análises, notas fiscais e fechamento; no celular, escolha pelo seletor Áreas do financeiro.
2. Abra uma pendência e confira o documento ou lançamento de origem.
3. Realize a ação autorizada e confira a confirmação e a situação atual.

### Como conferir se deu certo

A pendência financeira tem origem, situação e próxima ação identificadas.

### O que merece atenção

Nota, obrigação, pagamento e conciliação são etapas distintas. Consulte a origem para evitar duplicidade.

<a id="guia-fin_hoje"></a>

## Financeiro · Hoje

Conferir os compromissos e seus saldos por vencimento.

### Antes de começar

Confira data e obra. Saldo em aberto não é saldo de caixa.

### Como fazer

1. Em Movimentação, escolha A pagar ou A receber.
2. Escolha o prazo: Vencidos, Hoje, Próximos 7 dias, Depois ou Sem vencimento. Todos os prazos reúne o recorte. No celular, use Fila de vencimentos.
3. Em Visualização, alterne Tabela e Kanban; os registros e valores do recorte são preservados. A direção e a visão ficam salvas por usuário neste navegador; filtros de prazo são da sessão. No quadro, as colunas apenas representam as datas.
4. Use a ação do registro para revisar a origem ou registrar a operação permitida. Clique no nome para abrir a ficha rápida; Consultar detalhamento mostra a origem e os documentos. Feche a consulta para retomar a fila.
5. Use Colunas na tabela para mostrar ou ocultar campos opcionais. Em custos, use Colunas dos custos por etapa. Restaurar colunas padrão recupera a apresentação inicial; fichas, valores e exportações não mudam.

### Como conferir se deu certo

Você localiza o compromisso, o saldo e a ação permitida no mesmo recorte.

### O que merece atenção

Trocar visão ou coluna não paga, recebe nem altera vencimentos. Pagamentos, recebimentos físicos e conferência fiscal são independentes. Confira adiantamentos e liquidações parciais antes de repetir uma operação.

<a id="guia-fin_documentos"></a>

## Financeiro · Documentos

Localizar os documentos que sustentam os registros financeiros.

### Antes de começar

Tenha nome, fornecedor, número ou obra do documento.

### Como fazer

1. Confira obra e mês; pesquise por documento ou fornecedor e escolha a situação. A busca considera todo o conjunto, mesmo quando a lista tem várias páginas.
2. Em Consultas salvas neste navegador, salve ou aplique o recorte. As consultas pertencem ao usuário e à empresa; uma referência indisponível mostra o ajuste necessário.
3. Em Conferir documentos em sequência, selecione as notas disponíveis e revise a prévia. Abra cada ficha, confirme individualmente e retorne à fila. Use Reabrir ficha fiscal ou Deixar para depois quando precisar continuar nos demais registros.
4. Confira a situação de cada item após atualizar a base. Registro atualizado desde a abertura pede conferir o resultado; ficha aberta não significa salva. Itens bloqueados ou indisponíveis conservam a explicação e não são executáveis.

### Como conferir se deu certo

Você encontrou a evidência e o registro relacionado.

### O que merece atenção

Selecionar notas disponíveis abrange todas as páginas do filtro atual. Mudar o recorte inicia outra seleção; reordenar ou atualizar a base mantém a sequência. Não há aprovação em massa. São salvos apenas filtros; documentos, senhas e rascunhos não são preferências.

<a id="guia-fin_fiscal"></a>

## Financeiro · Conferência fiscal

Conferir os dados de uma nota e seu vínculo com a compra.

### Antes de começar

Tenha a nota e o pedido correspondente, quando houver.

### Como fazer

1. Localize ou abra a nota a conferir.
2. Compare fornecedor, número, série, tipo, datas, valores, obra e vínculo de origem.
3. Corrija os dados permitidos, confirme e confira o resultado. Datas inexistentes são recusadas.

### Como conferir se deu certo

A ficha fiscal apresenta os dados conferidos e seus vínculos.

### O que merece atenção

Chave fiscal repetida ou documento com o mesmo emissor identificado, tipo, série, número e ano bloqueia um segundo lançamento. Confira a nota existente; não mude o número ou o fornecedor para contornar o aviso. Sem documento ou identificação do fornecedor, a revisão humana continua necessária: nome e valor não provam que é a mesma nota. Uma nota repartida entre obras deve usar o rateio do mesmo documento, sem duplicar seu valor.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-fin_pagamentos"></a>

## Financeiro · Pagamentos

Registrar pagamentos.

### Antes de começar

Confira Fornecedor, obra, documento, saldo e pagamentos anteriores. Se aparecer Não informado, confira a origem do documento.

### Como fazer

1. Preencha Origem real do pagamento, Valor pago e Data. Selecione o comprovante; Remover comprovante retira o arquivo.
2. Em Alocar pagamento já realizado, selecione Pagamento do pedido, informe Valor a alocar e use Alocar adiantamento. Respeite os dois saldos.
3. Para corrigir, use Desfazer alocação, preencha Motivo para desfazer a alocação e confirme. O saldo volta ao adiantamento, sem devolução bancária.
4. Use Registrar pagamento para uma nova saída real e aguarde. Pagar não conclui entrega nem conferência fiscal. Informe o motivo do adiantamento, se possível.
5. Após recarregar, use Retomar trabalho salvo. Reabra o rascunho ou retome a confirmação original.

### Como conferir se deu certo

O saldo e o histórico mostram a confirmação; registrar no ERP não transfere dinheiro.

### O que merece atenção

Alocar preserva data e total pagos; a classificação muda nessa data e o histórico registra o vínculo. Período fechado ou rateio entre obras impede alocação. Desfaça vínculos antes de estornar ou reclassificar a origem. Confirmação pendente bloqueia outra operação no registro. O rascunho inclui o comprovante neste navegador.

### Exemplo ilustrativo

Uma nota de R$ 1.000,00 já tem pagamento confirmado de R$ 400,00. Confira o saldo e os vínculos antes de registrar outra quitação.

### Quem cuida de cada parte

- **Compras:** Confere necessidade, orçamento, fornecedores, condições, pedido e envio.
- **Responsável pelo recebimento na obra:** Confere o que realmente chegou, registra quantidades e acompanha diferenças.
- **Financeiro / conferência fiscal:** Confere nota, vínculos, pagamentos anteriores, adiantamentos e conciliação.
- **Responsável pelo estoque:** Confere a entrada vinculada e o histórico antes de registrar outra movimentação.
- **Responsável pela aprovação:** Analisa a decisão pendente; o avanço operacional não significa aprovação automática.

### Quando o fluxo acontece de outro jeito

- **Entrega parcial:** Registre somente o recebido e acompanhe o restante com o fornecedor. A nota e o pagamento podem ser registrados em outro momento.
- **Entrega acima do pedido:** Registre a quantidade real e leia o aviso. Confira a diferença com o fornecedor e regularize a documentação da compra.
- **Aprovação pendente ou recusada:** O pedido pode seguir com aviso. Consulte Aprovações e encaminhe a regularização ao responsável; a decisão anterior permanece no histórico.
- **Documento fiscal ainda não recebido:** Recebimento e pagamento podem seguir. O Financeiro deve receber e vincular o documento depois.
- **Pagamento antes da conferência:** O pagamento do pedido fica identificado como adiantamento quando excede a referência conferida. Informe o motivo, se possível; a falta dele gera aviso.
- **Nota ainda em conferência:** O Financeiro pode registrar o pagamento. A conferência fiscal continua pendente e deve ser decidida na ficha fiscal.
- **Caixa sem saldo registrado:** A saída real pode ser registrada com aviso. Confira a origem e os aportes efetivamente realizados; não crie aporte fictício para ajustar o saldo.
- **Adiantamento já registrado no pedido:** Confira o histórico antes de pagar pela nota. Não repita o pagamento nem associe registros apenas pela coincidência de valor.
- **Aviso após salvar:** Abra Ficha completa · notas e anexos e consulte Andamento da compra. Confira a pendência, o responsável e a orientação.

<a id="guia-fin_caixa"></a>

## Financeiro · Caixa

Consultar entradas, saídas e posição de caixa.

### Antes de começar

Confirme conta, obra e intervalo de datas.

### Como fazer

1. Confira conta, obra e intervalo. Abra Previsão por vencimentos e, depois, Planejamento, compras e vencimentos.
2. Escolha a obra e compare a referência da etapa, a necessidade revisada e a compra comprovada por item. Confira unidades, quantidades e vínculos pendentes antes de solicitar outra compra.
3. Simule o deslocamento das etapas para identificar entregas a revisar. Use Conferir solicitação ou Conferir pedido para tratar a origem e retorne ao recorte; consulte os títulos vinculados separadamente.

### Como conferir se deu certo

Você sabe quais movimentos explicam a posição consultada.

### O que merece atenção

A simulação conserva as datas cadastradas. Estoque compartilhado não é reservado nem descontado automaticamente. Pedido, orçamento e título não são somados como novas saídas de caixa; a compra comprovada não comprova recebimento ou pagamento.

<a id="guia-fin_fechamento"></a>

## Financeiro · Fechamento

Conferir uma competência antes de concluir o fechamento.

### Antes de começar

Escolha o mês de referência e confira as pendências.

### Como fazer

1. Em Bloqueios financeiros, leia o motivo, a diferença e a orientação. Use Consultar origem do bloqueio quando houver um registro identificado. O memorial mostra o valor do documento; a diferença fica no aviso. Se não houver origem individual, confira os documentos e peça ajuda ao administrador usando Diagnóstico para suporte.
2. Compare o resultado com as entradas e saídas. O resultado segue a competência da receita ou do custo; o caixa segue a data do recebimento ou pagamento, mesmo quando o documento é de outro mês.
3. Resolva os bloqueios e revise os valores da competência. Quando os recebimentos excederem o valor do documento, confira os comprovantes e a medição em Medições a faturar antes de corrigir valores ou vínculos. Para pagamentos excedentes, confira a obrigação e os comprovantes em Pagamentos.
4. Solicite o fechamento e confira a confirmação devolvida pelo sistema.

### Como conferir se deu certo

O sistema apresenta o fechamento confirmado ou os bloqueios restantes.

### O que merece atenção

Alguns avisos resumem diferenças já detalhadas: não some seus valores. A origem pode pertencer a outro mês; confira a competência do registro. Consultar a prévia, o diagnóstico ou o memorial não fecha a competência nem corrige registros. Não reduza um recebimento nem crie uma despesa apenas para eliminar uma diferença.

<a id="guia-fin_visao"></a>

## Financeiro · Visão financeira

Comparar resultado, entradas, saídas e saldos por obra.

### Antes de começar

Selecione a obra, o ano e o mês.

### Como fazer

1. Leia o resumo e identifique o valor que deseja conferir.
2. Abra o detalhamento e confira as movimentações que compõem o valor.
3. Compare o resultado e o caixa usando o mesmo período.

### Como conferir se deu certo

Você consegue explicar o total a partir dos registros apresentados.

### O que merece atenção

Valores faturados, recebidos e a receber têm significados diferentes.

<a id="guia-fin_etapas"></a>

## Financeiro · Custos por etapa

Entender em quais etapas da obra os custos estão concentrados.

### Antes de começar

Confira a obra e a data de referência.

### Como fazer

1. Confira obra, data de corte, orçamento e custos por etapa; abra os valores para consultar a origem.
2. Em Compromissos por origem, clique no valor de Compras ainda não faturadas para consultar os pedidos. Abra Conferir contratos de terceiros e use o nome do contrato para consultar sua memória. Pesquisar contrato filtra a lista.
3. Confira Contratado, Medições aprovadas, Em revisão, A pagar das medições e Saldo a medir. Saldo a medir desconta somente medições aprovadas; pagamento reduz a obrigação a pagar, sem reduzir esse saldo novamente. Valores ausentes e vínculos divergentes pedem conferência em Terceiros.
4. Use Vincular à previsão para relacionar o contrato à etapa e confirmar pedidos do mesmo escopo. Confira a integração antes de revisar o restante.
5. Compare o incorrido com os compromissos sem sobreposição. Abra Conferir apropriação e previsão para revisar o restante e a reserva de risco.
6. Registre e acompanhe Mudanças e aditivos; escolha explicitamente como cada impacto entra na previsão.
7. Leia os avisos e consulte Ajuda da previsão para o passo a passo completo.
8. Em Garantias técnicas das medições, confira bruto, garantia e saldo; abra a medição para definir a condição, pagar o principal, liberar ou pagar a garantia. Use Ajuda da garantia técnica para os cuidados. O retido já pertence ao custo reconhecido e não é outra estimativa restante.
9. Use Colunas na tabela para mostrar ou ocultar campos opcionais. Em custos, use Colunas dos custos por etapa. Restaurar colunas padrão recupera a apresentação inicial; fichas, valores e exportações não mudam.

### Como conferir se deu certo

Você identificou os registros que explicam o custo de cada etapa e os compromissos atuais por origem.

### O que merece atenção

Compromissos por origem consulta os cadastros atuais, independentemente da data de corte dos custos. Subtotal calculável não inclui contratos sem valor disponível. Somente vínculos válidos entram automaticamente na etapa. Contrato e pedidos do mesmo escopo entram uma vez, descontando custos reconhecidos. Revisão manual substitui a referência, sem outra soma. Em Cobertura do estoque, abra Conferir cobertura dos materiais e confira aplicado, saldo físico, reserva, pedidos a receber e Falta comprar. Reposição usa o preço médio orçado; compare reposição mais compras independentes ainda não faturadas com os demais pisos, sem somá-los. Entrada e consumo não geram outro custo no DRE. Pendências de origem, unidade ou etapa exigem conciliação ou revisão explícita da etapa. Contratos comerciais com clientes não são custos de contratação. Consultar não cria pagamentos, aprovações ou previsões. A previsão revisada permanece com aviso quando a base muda. Custo final = incorrido + restante + reserva + mudanças adicionais; pagar não gera outro custo. Pendências de processo permitem continuar.

<a id="guia-fin_vinculos"></a>

## Financeiro · Vínculo de contratos à previsão

Relacionar um contrato de terceiros à etapa do orçamento sem duplicar pedidos do mesmo serviço.

### Antes de começar

Tenha orçamento de controle, contrato por medição ativo e as origens conferidas. Administrador e Financeiro com acesso à obra podem salvar.

### Como fazer

1. Em Custos por etapa, abra Conferir contratos de terceiros e use Vincular à previsão no contrato.
2. Escolha Etapa de custo do contrato. O contrato inteiro fica em uma etapa de primeiro nível.
3. Em Pedidos do mesmo escopo, selecione somente os pedidos que representam o serviço já incluído no contrato. Use Pesquisar pedido sobreposto para localizar. Materiais ou serviços adicionais devem ficar separados.
4. Marque Conferi que os pedidos selecionados representam o mesmo escopo do contrato e preencha Justificativa do vínculo.
5. Use Salvar vínculo da previsão e aguarde a confirmação. Confira etapa, saldo a incorrer e Estimativa para concluir.
6. Para retirar ou corrigir um vínculo, reabra o formulário. Registre o motivo e use Remover vínculo da previsão, ou ajuste e salve novamente.

### Como conferir se deu certo

A referência automática considera o maior entre o saldo do orçamento e os compromissos remanescentes sem sobreposição. Contrato e pedidos selecionados entram uma vez pelo maior valor, descontando a união dos custos reconhecidos até a competência de corte.

### O que merece atenção

O vínculo usa as condições atuais, sem reconstruir o contrato histórico. Notas e medições espelhadas seguem o razão; rascunhos e pagamentos não reduzem novamente o compromisso. Fontes alteradas, orçamento substituído, etapas divergentes ou pedido usado em outro contrato exigem conferência. Não se faz correspondência por nome ou valor parecido. Revisões manuais ficam preservadas com aviso; use Conferir apropriação e previsão para reconferir sua base. O vínculo não aprova, paga, modifica cláusulas nem altera o valor contratado. Estoque permanece fora desta integração.

<a id="guia-fin_relatorios"></a>

## Financeiro · Relatórios financeiros

Emitir uma consulta financeira com critérios definidos.

### Antes de começar

Defina se precisa analisar resultado, movimentos ou posição em uma data.

### Como fazer

1. Escolha o tipo de relatório e o agrupamento.
2. Ajuste período, obra, conta e demais filtros disponíveis.
3. Confira os totais e os detalhes antes de imprimir ou exportar.

### Como conferir se deu certo

A saída corresponde ao tipo de análise e aos filtros selecionados.

### O que merece atenção

Resultado por competência e movimento por data de pagamento podem apresentar totais diferentes.

<a id="guia-fin_administrativo"></a>

## Financeiro · Administrativo

Consultar receitas, despesas e documentos da rotina administrativa.

### Antes de começar

Selecione o período e confira se a consulta abrange a empresa ou uma obra.

### Como fazer

1. Escolha a área de receitas, despesas, resultados ou documentos disponível na tela.
2. Pesquise o registro e confira valor, situação e origem.
3. Abra ou vincule a evidência pela ação disponível e confira o retorno.

### Como conferir se deu certo

O registro tem origem e documentos identificáveis para conferência.

### O que merece atenção

Anexar um comprovante não confirma automaticamente pagamento ou recebimento.

<a id="guia-fin_homologacao"></a>

## Financeiro · Homologação

Comparar os dados de origem, o razão financeiro e as projeções do DRE.

### Antes de começar

Use um perfil de administrador. Consultar não corrige registros nem fecha uma competência.

### Como fazer

1. Use Atualizar relatório e aguarde a consulta.
2. No celular, os filtros aparecem no início do relatório. Use Buscar diferença ou origem, Tipo de ocorrência e Grupo da conferência.
3. Leia o estado do motor e abra Verificações da homologação para conferir pendências. Em Diferenças e avisos, leia o resultado dos filtros. Confira obra, competência, campo, origem esperada e razão consultado. Anterior e Próxima percorrem os resultados filtrados.
4. Abra Diagnóstico do registro para consultar os detalhes e, no celular, a referência de origem. Números de campos, quantidades e valores monetários têm significados diferentes.
5. Em Sincronização técnica dos registros, Executar carga idempotente exige confirmação e grava a sincronização existente. Essa ação não ativa nem desativa o motor; consulte o responsável técnico antes de usá-la.
6. Para reunir campos divergentes da mesma obra, competência e período do DRE, use Ver diferenças desta projeção. A ação limpa a busca e mostra apenas a referência escolhida. Use Limpar filtro de projeção para voltar às diferenças do grupo Projeções do DRE.

### Como conferir se deu certo

Você consegue localizar as diferenças e identificar as verificações pendentes, mesmo quando os totais financeiros coincidem.

### O que merece atenção

Cada linha é uma diferença ou aviso, não um novo custo. Não some as diferenças nem crie pagamentos para compensá-las. Nenhuma diferença detalhada não significa homologação concluída. Falha na consulta não comprova necessidade de preparar o banco.

<a id="guia-fin_ia"></a>

## Financeiro · Modo IA

Obter uma sugestão de lançamento a partir de um documento.

### Antes de começar

Tenha um PDF ou imagem legível e confira a disponibilidade da integração.

### Como fazer

1. Selecione o documento e solicite a análise.
2. Confira a obra sugerida, os dados extraídos, a confiança e os alertas.
3. Revise o destino e o vínculo do lançamento antes de confirmar a operação disponível.

### Como conferir se deu certo

Os dados confirmados correspondem ao documento e ao destino revisados.

### O que merece atenção

A leitura pode conter erros. Não confirme obra, valor ou vínculo apenas pela sugestão.

<a id="guia-conc"></a>

## Conciliação

Relacionar movimentos do extrato bancário aos registros do sistema.

### Antes de começar

Confira banco, conta e período do extrato.

### Como fazer

1. Importe ou abra o extrato e confira as linhas.
2. Use Buscar na conciliação, Tipo de movimento e Filtrar categoria para localizar as linhas; Selecionar todas marca as linhas elegíveis e não confirma vínculos.
3. Analise cada sugestão comparando valor, data, contraparte e documento. Uma pessoa identificada não comprova qual título foi pago.
4. Quando o mesmo prestador tiver contratos em várias obras, confira a obra, o contrato e a obrigação de cada pagamento. O vínculo existente do prestador identifica a pessoa quando seus dados concordam; não escolhe o contrato nem junta pagamentos. Dados de identidade divergentes exigem conferência.
5. Confira também pendências de extratos arquivados antes de reabrir ou reimportar: arquivar não significa conciliar nem autoriza repetir um pagamento.
6. Confirme o vínculo apenas após a conferência e acompanhe o saldo e as pendências.

### Como conferir se deu certo

As linhas conferidas mostram os vínculos corretos.

### O que merece atenção

Semelhança de valor ou descrição não basta para confirmar um vínculo. Uma referência genérica do arquivo OFX não comprova o identificador de uma transferência Pix. Chave PIX vem apenas dos campos próprios de PIX; o identificador da linha do extrato (FITID ou impressão digital) continua servindo à deduplicação. Quando a chave não estiver informada, a comparação mostra Não informado, sem inventar uma incompatibilidade de PIX. Uma chave PIX explícita divergente continua exigindo conferência. Nas novas importações, a referência original é preservada e não é tratada automaticamente como esse identificador. Os dados antigos exigem conferência do original antes de qualquer correção. Revise a automação antes de retomá-la.

### Exemplo ilustrativo

O extrato mostra uma saída de R$ 150,00. Antes de vincular, confira se o pagamento de R$ 150,00 é da mesma conta, contraparte e operação.

<a id="guia-medicoes"></a>

## Medições a faturar

Acompanhar valores medidos e recebimentos dos contratos.

### Antes de começar

Confira obra, contrato e competência.

### Como fazer

1. Localize ou registre a medição com os dados do contrato.
2. Confira valor, vencimento e documentos.
3. Acompanhe os recebimentos e consulte a origem financeira antes de confirmar uma baixa.
4. Confira Obra das medições no início. Cobranças próximas e vencidas · Todas as obras disponíveis é uma fila geral, independente dessa seleção; cada linha identifica sua obra e o saldo restante, descontados os recebimentos registrados. Cobranças quitadas ou canceladas não entram nessa fila. Registrar recebimento abre a conferência com o saldo a receber nesta consulta; só conclua após verificar obra, saldo, origem financeira e data. O servidor reconfere o saldo ao confirmar. Essa tela trata cobranças do cliente; avanço físico e medições de terceirizados são fluxos separados.

### Como conferir se deu certo

A medição mostra o valor devido e a situação de recebimento.

### O que merece atenção

Registrar uma medição não significa que o dinheiro já foi recebido.

<a id="guia-caixa"></a>

## Caixa da obra

Registrar e conferir movimentações do caixa de uma obra.

### Antes de começar

Confirme Obra do caixa e o comprovante. O resumo geral apresenta todas as obras disponíveis com caixa ativado.

### Como fazer

1. A obra selecionada em Obra em foco é seguida pelo extrato. Escolher Obra do caixa ou um saldo consolidado também atualiza a obra em foco.
2. Se a obra escolhida não possui caixa ativado, leia o aviso. Escolha outro caixa ou confira a ativação no cadastro; o app não escolhe outra obra no lugar dela.
3. Consulte o saldo e os registros anteriores. Abra Registrar aporte ou Registrar gasto e confira Obra do lançamento no formulário.
4. Informe data, valor, descrição e comprovante quando solicitado. Confirme somente após conferir a obra e acompanhe o saldo após salvar.

### Como conferir se deu certo

O extrato e a confirmação pertencem ao caixa escolhido, enquanto o resumo geral continua disponível.

### O que merece atenção

Evite lançar novamente um pagamento de outro fluxo. Enquanto o formulário está aberto, a obra do lançamento é mantida. Trocar a consulta não registra movimento nem cria custo no demonstrativo de resultado (DRE).

<a id="guia-relat"></a>

## Relatórios

Consultar e emitir relatórios para acompanhamento.

### Antes de começar

Defina a pergunta, a obra e o período que deseja analisar.

### Como fazer

1. Escolha o relatório disponível.
2. Ajuste os filtros e confira os dados apresentados.
3. Use a impressão ou exportação disponível e confira a prévia.

### Como conferir se deu certo

O relatório apresenta o período, a obra e os dados esperados.

### O que merece atenção

Um relatório com filtro diferente pode apresentar outro total. Confira o cabeçalho antes de compartilhar.

<a id="guia-equip"></a>

## Equipamentos

Controlar equipamentos nas obras.

### Antes de começar

Confira o equipamento e a obra.

### Como fazer

1. Em Frota, use Pesquisar na frota para localizar um item em qualquer página. No celular, a lista mostra até seis equipamentos por página. Use Anterior e Próxima para percorrer a lista e Detalhes do equipamento para consultar tarifas, propriedade, foto quando disponível e valores do período. Abra Período de referência para mudar a competência. O nome abre o cadastro.
2. Use Salvar equipamento para confirmar alterações ou Excluir equipamento, com confirmação.
3. Locar, Transferir e Manutenção ficam no cartão. Confira os dados antes de confirmar.

### Como conferir se deu certo

Confira situação e localização após confirmar.

### O que merece atenção

Transferência de equipamento e pagamento de locação são registros distintos.

<a id="guia-equip_fin"></a>

## Locação de equipamentos

Acompanhar contratos e valores das locações.

### Antes de começar

Tenha o equipamento, fornecedor, obra e período da locação.

### Como fazer

1. Em Frota, o nome abre o cadastro e Locar, Transferir e Manutenção ficam no cartão. No celular, abra Detalhes do equipamento para consultar a foto e os valores, quando disponíveis.
2. Em Locações, confira contrato, período, devolução e documentos.
3. Confira os pagamentos na origem financeira.

### Como conferir se deu certo

A locação apresenta o período e os valores conferidos.

### O que merece atenção

Devolver um equipamento não comprova quitação dos valores da locação.

<a id="guia-patrimonio"></a>

## Patrimônio da empresa

Localizar bens e responsáveis.

### Antes de começar

Tenha identificação do bem e responsável atual.

### Como fazer

1. Pesquise o bem e use Anterior ou Próxima para percorrer os resultados no celular. O nome do bem abre o cadastro. Relatório e importação reúne Relatório e Importar NF no celular.
2. Use Mover na linha para alterar local ou responsável e Registrar movimentação para confirmar. Cancelar não grava.
3. Mais ações reúne Histórico e Alterar status…. Confira documentos e identificação antes de salvar.

### Como conferir se deu certo

Confira local e responsável após salvar.

### O que merece atenção

Patrimônio identifica o bem; estoque acompanha materiais e quantidades.

<a id="guia-cad"></a>

## Cadastros

Manter as informações usadas pelos outros módulos.

### Antes de começar

Escolha o tipo de cadastro e pesquise se o registro já existe.

### Como fazer

1. Abra a categoria de cadastro desejada.
2. Inclua ou edite os dados permitidos, conferindo documentos, nomes e unidades.
3. Salve e confira o registro na lista.

### Como conferir se deu certo

O cadastro pode ser encontrado e usado no fluxo correspondente.

### O que merece atenção

Alterações em cadastros compartilhados podem afetar consultas de vários módulos.

<a id="guia-ia"></a>

## IA

Pedir apoio para consultar e interpretar informações do sistema.

### Antes de começar

Defina sua pergunta e a obra ou período de interesse.

### Como fazer

1. Escreva uma pergunta com contexto e objetivo claros.
2. Leia a resposta e confira os registros ou fontes indicados.
3. Verifique os dados na tela de origem antes de tomar uma decisão.

### Como conferir se deu certo

A resposta ajuda a localizar ou compreender a informação.

### O que merece atenção

A IA pode errar. Uma sugestão não substitui a confirmação de uma operação no sistema.

<a id="guia-ia_config"></a>

## Configurar Gemini

Configurar a integração de inteligência artificial.

### Antes de começar

Use um perfil autorizado e tenha os dados da integração.

### Como fazer

1. Abra as opções de configuração disponíveis.
2. Informe os dados solicitados sem compartilhar credenciais em mensagens.
3. Salve e confira o estado da conexão ou teste disponível.

### Como conferir se deu certo

O sistema informa se a integração está disponível.

### O que merece atenção

Se a conexão falhar, confira a configuração com o administrador; não publique credenciais.

<a id="guia-config_membros"></a>

## Ajustes · Minha equipe

Consultar os membros e administrar os acessos da empresa.

### Antes de começar

Confira o perfil e as obras que cada pessoa deve acessar. Alterações de acesso exigem administrador.

### Como fazer

1. Em Ajustes, use Minha equipe. Busque por nome ou e-mail e refine Situação do membro e Perfil do membro.
2. Como administrador, use Adicionar membro ou clique no nome para editar. Confira Dados do membro e Permissões de acesso.
3. Revise as telas marcadas, o perfil e a restrição de obra. Use Salvar e aguarde a confirmação.
4. No menu Ações do membro, localize Ativar login ou Redefinir senha, Definir PIN, Liberar todas as obras e Ativar membro ou Inativar membro, conforme o registro.

### Como conferir se deu certo

O cadastro mostra o perfil e a situação esperados após a confirmação.

### O que merece atenção

PIN é o código de identificação do operador. Inativar o acesso do membro não registra desligamento do funcionário. Última atividade depende das sessões disponíveis; use Atualizar on-line para consultar novamente.

<a id="guia-fin_relatorios_obra"></a>

## Financeiro · Relatório completo por obra

Conferir custos, receitas e composição de uma obra sem registrar operações.

### Antes de começar

Escolha a obra e o intervalo de competências. Competência é o mês em que o valor é reconhecido no resultado.

### Como fazer

1. Em Relatórios financeiros, escolha Financeiro completo por obra em Visão dos relatórios.
2. Selecione Obra do relatório, Competência inicial da obra e Competência final da obra. Use Aplicar período da obra.
3. Clique nos totais ou em Custos por etapa para abrir o memorial e conferir a origem. Feche a consulta para voltar ao relatório.
4. Use Exportar CSV da obra, Exportar Excel da obra ou Imprimir / salvar PDF da obra para compartilhar o período aplicado.

### Como conferir se deu certo

Os totais, memoriais e arquivos representam a mesma obra e o último período aplicado.

### O que merece atenção

Custos reconhecidos e pagamentos são análises diferentes. Componentes ausentes não são estimados e o rateio da administração central não está incluído. Confira a base gerencial e as pendências antes de usar o resultado. Exportar ou abrir um memorial não confirma pagamento.

<a id="guia-config"></a>

## Ajustes

Manter parâmetros e configurações da empresa.

### Antes de começar

Identifique qual configuração precisa mudar e quem é responsável.

### Como fazer

1. No celular, toque no grupo de configurações para expandi-lo, como Empresa ou DRE e tributação. Recolher a seção conserva o preenchimento enquanto a tela está aberta.
2. Confira os valores atuais antes de editar.
3. Salve e verifique a confirmação e o comportamento afetado.

### Como conferir se deu certo

O parâmetro apresenta o valor esperado após a confirmação.

### O que merece atenção

Confira o alcance de uma alteração que afeta toda a empresa.

<a id="guia-obsoletos"></a>

## Telas antigas

Consultar funções antigas preservadas no sistema.

### Antes de começar

Confira se existe uma tela atual para a mesma tarefa.

### Como fazer

1. Localize a função antiga necessária.
2. Leia as orientações e confira os registros existentes.
3. Use o módulo atual indicado para continuar o trabalho, quando houver.

### Como conferir se deu certo

Você identificou a informação antiga e o caminho atual para a tarefa.

### O que merece atenção

Evite manter o mesmo lançamento em duas telas; confira a origem antes de registrar.

<a id="guia-obra_qualidade"></a>

## FVS / FVM

Conferir serviços e materiais da obra com um checklist.

### Antes de começar

Confira a obra, a etapa e o item a inspecionar.

### Como fazer

1. Escolha a ficha de verificação de serviço (FVS) ou de material (FVM).
2. Preencha os itens de inspeção e registre as evidências solicitadas.
3. Revise os resultados e acompanhe as não conformidades.

### Como conferir se deu certo

A ficha registra o que foi inspecionado e os pontos a corrigir.

### O que merece atenção

A evidência deve corresponder ao serviço ou material que foi realmente conferido.

<a id="guia-obra_seguranca"></a>

## Segurança da obra

Consultar e registrar o acompanhamento de segurança disponível na obra.

### Antes de começar

Confira a obra e a data da inspeção ou ocorrência.

### Como fazer

1. Abra a área de Segurança da obra.
2. Consulte os registros e preencha os dados que a tela disponibiliza.
3. Revise as evidências e encaminhe as pendências ao responsável.

### Como conferir se deu certo

O acompanhamento está associado à obra correta.

### O que merece atenção

Registre somente fatos conferidos e mantenha o responsável informado sobre pendências.

<a id="guia-obra_portal"></a>

## Portal do cliente

Configurar o acompanhamento que será disponibilizado ao cliente.

### Antes de começar

Entre como administrador, confira a obra e aguarde a confirmação de salvamento das alterações.

### Como fazer

1. Abra Portal do cliente na obra e ative o portal.
2. Escolha Diários e fotos, Cronograma, Medições, Caixa da obra, Gastos por categoria, Administração e equipe, Previsto e realizado por etapa, Notas fiscais, Compras e demais conteúdos desejados. Administração e equipe libera nomes, composição dos custos, reservas e ponto somente para perfis autorizados. Marque os documentos liberados individualmente.
3. Aguarde o salvamento das opções. Use Atualizar dados publicados, confira as quantidades e use Confirmar publicação. Essa liberação permite consultar os dados financeiros atuais nas áreas habilitadas.
4. Cadastre login e senha em Central do Administrador → Acessos de clientes. Copiar link de login e Abrir login do cliente usam o acesso individual.
5. Para suspender o conteúdo, use Desativar acesso. Os vínculos são mantidos; a retomada exige ativar e publicar novamente.

### Como conferir se deu certo

O cliente consulta somente a obra e as áreas liberadas, após entrar com o próprio login.

### O que merece atenção

Resumo e documentos avulsos dependem da publicação da equipe. Diários, caixa, gastos, orçamento por etapa, contrato, compras e notas consultam os registros atuais após a liberação. As fotos vêm de diários concluídos; anexos fiscais vêm das notas vinculadas por ID ao pedido. Publicar não cria custo, previsão, estoque, pagamento ou lançamento no DRE. Visualizar legado e Revogar link anterior se referem ao link compartilhado antigo, que tem controles próprios. O domínio público depende da configuração posterior de DNS e hospedagem.

<a id="guia-com_dash"></a>

## Dashboard comercial

Use esta tela para acompanhar os resultados comerciais.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Confira os indicadores e o período.
2. Abra o grupo ou registro que explica o resultado.
3. Acompanhe a próxima ação na área responsável.
4. Abra Como são contados os indicadores comerciais. Vendas no mês usa registros de venda e data de fechamento; Conversão geral divide todas as vendas por todos os leads carregados. Valor provável de venda pondera o orçamento estimado pela probabilidade. Esses valores não são recebimento nem receita reconhecida no DRE. Sem assinatura consulta apenas os contratos anteriores; consulte os contratos atuais na central.

### Como conferir se deu certo

Você conhece a situação comercial e os registros a acompanhar.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_workspace"></a>

## Comercial da empresa

Use esta tela para organizar a rotina comercial.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Consulte a visão de trabalho e as pendências.
2. Abra o cliente, oportunidade ou atividade desejada.
3. Atualize a próxima ação e confira o registro.
4. Abra Como são contados os indicadores comerciais. Vendas no mês usa registros de venda e data de fechamento; Conversão geral divide todas as vendas por todos os leads carregados. Valor provável de venda pondera o orçamento estimado pela probabilidade. Esses valores não são recebimento nem receita reconhecida no DRE. Sem assinatura consulta apenas os contratos anteriores; consulte os contratos atuais na central.

### Como conferir se deu certo

A rotina tem responsáveis e próximos passos identificados.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_real_estate"></a>

## Venda de imóveis

Use esta tela para acompanhar a comercialização de imóveis.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Localize o imóvel ou unidade.
2. Confira disponibilidade, cliente e negociação.
3. Use a ação disponível e acompanhe o negócio até a etapa contratual.

### Como conferir se deu certo

O imóvel e o negócio estão na situação conferida.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_pipeline"></a>

## Pipeline

Use esta tela para acompanhar oportunidades por etapa.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. No celular, a Lista abre com a busca e os primeiros cartões. Pesquisar no Pipeline considera nome, serviço e contato. Abra Visualização e prioridade para consultar atividades vencidas ou sem data, ou trocar para Quadro por etapa. No computador, use Visualização do Pipeline diretamente.
2. Abra o nome para consultar a ficha. No celular, abra Mover etapa no cartão. Selecione a nova etapa e use Mover lead. Aguarde a confirmação; Perdido continua exigindo os dados da perda. Quadro por etapa mantém a consulta anterior e o arraste.
3. Escolha a oportunidade no quadro.
4. Confira a etapa, o responsável e a próxima ação.
5. Atualize a oportunidade conforme o avanço real da negociação.

### Como conferir se deu certo

O quadro representa o estágio atual da oportunidade.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar. A lista mantém o histórico e as regras existentes. Se a gravação falhar, confira o aviso de salvamento antes de repetir a ação.

<a id="guia-com_relationships"></a>

## Relacionamentos

Use esta tela para organizar contatos de clientes e parceiros.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Pesquise a pessoa ou empresa.
2. Confira os dados de contato e os vínculos.
3. Registre a atualização ou abra a oportunidade relacionada.
4. Na ficha de um lead salvo, abra Contratos. Os contratos atuais usam o vínculo com a proposta deste lead; contratos anteriores usam o vínculo direto. Abrir contratos deste lead leva à central nesse recorte. Voltar à ficha do lead recupera a ficha e suas edições ainda não salvas nesta sessão. A navegação não salva o lead.

### Como conferir se deu certo

Você encontrou o contato e seu relacionamento com os negócios.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar. Nomes, clientes ou obras iguais não vinculam contratos. Um lead novo precisa ser salvo antes da consulta por vínculo.

<a id="guia-com_deals"></a>

## Propostas e contratos

Use esta tela para acompanhar documentos comerciais e seus negócios.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Localize o negócio.
2. Confira a proposta, as condições e o contrato relacionado.
3. Registre o avanço pela ação disponível e confira os documentos.

### Como conferir se deu certo

O negócio apresenta os documentos e a etapa corretos.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_management"></a>

## Gestão comercial

Use esta tela para conferir o desempenho e a organização comercial.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Escolha a consulta e o período.
2. Compare resultados, metas e pendências.
3. Abra os registros de origem para orientar as próximas ações.

### Como conferir se deu certo

A análise pode ser relacionada aos negócios de origem.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_indicacoes"></a>

## Indicações

Use esta tela para registrar pessoas e negócios indicados.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Pesquise se a indicação já existe.
2. Informe o contato, a origem e o responsável.
3. Acompanhe o encaminhamento para a oportunidade.

### Como conferir se deu certo

A indicação está identificada e pode ser acompanhada.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_leads"></a>

## Leads

Use esta tela para registrar possíveis clientes.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Pesquise o contato para evitar duplicidade.
2. Cadastre ou revise nome, contato, origem e responsável.
3. Registre a próxima ação e acompanhe a qualificação.
4. Na ficha de um lead salvo, abra Contratos. Os contratos atuais usam o vínculo com a proposta deste lead; contratos anteriores usam o vínculo direto. Abrir contratos deste lead leva à central nesse recorte. Voltar à ficha do lead recupera a ficha e suas edições ainda não salvas nesta sessão. A navegação não salva o lead.
5. Na ficha, escolha Áreas do lead no celular para acessar Visão geral, Contratos e as demais áreas. No computador, use os mesmos nomes na navegação. Trocar de área conserva o preenchimento da ficha; confirme somente após conferir os dados.

### Como conferir se deu certo

O possível cliente possui contato e acompanhamento definidos.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar. Nomes, clientes ou obras iguais não vinculam contratos. Um lead novo precisa ser salvo antes da consulta por vínculo.

### Exemplo ilustrativo

Uma pessoa pediu informações sobre uma obra. Pesquise o contato, registre a origem e defina quem fará o próximo atendimento.

<a id="guia-com_funil"></a>

## Funil

Use esta tela para acompanhar a etapa de cada oportunidade.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. No celular, a Lista abre com a busca e os primeiros cartões. Pesquisar no Pipeline considera nome, serviço e contato. Abra Visualização e prioridade para consultar atividades vencidas ou sem data, ou trocar para Quadro por etapa. No computador, use Visualização do Pipeline diretamente.
2. Abra o nome para consultar a ficha. No celular, abra Mover etapa no cartão. Selecione a nova etapa e use Mover lead. Aguarde a confirmação; Perdido continua exigindo os dados da perda. Quadro por etapa mantém a consulta anterior e o arraste.
3. Localize a oportunidade no quadro.
4. Abra os detalhes e confira responsável e próxima ação.
5. Atualize a etapa conforme o que foi confirmado com o cliente.

### Como conferir se deu certo

A oportunidade está na etapa que corresponde ao andamento real.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar. A lista mantém o histórico e as regras existentes. Se a gravação falhar, confira o aviso de salvamento antes de repetir a ação.

<a id="guia-com_jornada"></a>

## Jornada

Use esta tela para consultar a sequência de interações comerciais.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Localize o cliente ou oportunidade.
2. Leia o histórico e identifique o próximo passo.
3. Registre a interação realizada e a atividade seguinte.

### Como conferir se deu certo

O histórico explica o andamento do relacionamento.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_agenda"></a>

## Agenda

Use esta tela para organizar compromissos comerciais.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Escolha a data e confira os compromissos.
2. Abra ou cadastre a atividade com horário e responsável.
3. Confira os participantes e acompanhe a realização.

### Como conferir se deu certo

O compromisso aparece na data e horário corretos.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_reunioes"></a>

## Reuniões

Use esta tela para acompanhar reuniões com clientes e parceiros.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Localize ou registre a reunião.
2. Confira horário, participantes e assunto.
3. Registre o resultado e os próximos encaminhamentos.

### Como conferir se deu certo

A reunião tem resultado e próximos passos identificados.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_tarefas"></a>

## Tarefas comerciais

Use esta tela para acompanhar ações da equipe comercial.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Abra a lista e confira os prazos.
2. Crie ou abra a tarefa com responsável e vínculo correto.
3. Atualize a situação conforme a execução.

### Como conferir se deu certo

A tarefa mostra responsável, prazo e situação atuais.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_propostas"></a>

## Propostas

Use esta tela para preparar e acompanhar uma oferta ao cliente.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Localize o cliente ou oportunidade.
2. Preencha escopo, valores, prazo e condições da proposta.
3. Revise a versão antes de emitir ou encaminhar pela ação disponível.

### Como conferir se deu certo

A proposta apresenta as condições revisadas para o cliente correto.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_negociacoes"></a>

## Negociações

Use esta tela para acompanhar as condições discutidas com o cliente.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Abra a oportunidade em negociação.
2. Confira valores, condições, objeções e histórico.
3. Registre o avanço e defina o próximo contato.

### Como conferir se deu certo

A negociação tem condições e próxima ação documentadas.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_contratos"></a>

## Comercial · Contratos

Cadastrar, conferir e acompanhar contratos por cliente e obra.

### Antes de começar

O administrador deve conferir o cadastro da contratada em Modelos de contrato. Tenha cliente, condições e documentos da negociação.

### Como fazer

1. Se chegou da ficha de um lead, confira Contratos do lead. Consultar toda a central remove apenas esse recorte; Voltar à ficha do lead retorna às edições preservadas na sessão. Escopo dos contratos explica que os filtros da central controlam a consulta, não o contexto Comercial da empresa no cabeçalho.
2. Em Comercial, abra Propostas e contratos e escolha Contratos.
3. Use Novo contrato. Preencha as etapas A a G. É possível começar antes de existir obra cadastrada.
4. Selecione o cliente, a proposta compatível e a obra. Confira os dados das partes; nenhuma declaração pessoal é presumida.
5. Em Imóvel e obra, compare os dados. Salve o rascunho, selecione os campos e use Aproveitar dados selecionados da obra. Confirme os valores novamente.
6. As alterações são salvas após uma breve pausa; aguarde a confirmação. Salvar rascunho permite tentar novamente. Falhas preservam o formulário. Em conflito, copie a edição antes de fechar e reabra o registro atual.
7. Em Anexos e revisão, vincule revisões dos Arquivos da mesma obra. Confirme cada arquivo após conferir seu conteúdo.
8. Use Enviar para revisão. O administrador pode devolver com motivo ou aprovar a revisão externa quando todas as pendências forem atendidas.
9. Consulte o histórico. Depois da aprovação, use Abrir nova revisão com motivo para alterar dados; a versão anterior fica preservada.
10. No recorte de um lead, Filtros reúne também pesquisa, situação e obra. Emissão de documentos indisponível explica a limitação de PDF/DOCX. Para administrar Modelos de contrato, use Consultar toda a central; essa área continua exclusiva do administrador.

### Como conferir se deu certo

O cadastro conserva modelo, cópia da contratada, dados, anexos e histórico. Os filtros da lista permanecem ao fechar a ficha.

### O que merece atenção

Gerar PDF e Exportar DOCX estão desativados: não há emissão de documentos nesta entrega. Para aprovação, o administrador precisa conferir externamente o documento e seus anexos. Pessoa jurídica, múltiplos contratantes e obra sem loteamento exigem variante aprovada ainda indisponível. CGR (Custo Gerencial de Referência), taxa e teto são independentes; valor cadastrado na obra não define esses campos automaticamente. Dados da obra não atualizam cópias aprovadas ou assinadas.

<a id="guia-com_clientes"></a>

## Clientes

Use esta tela para consultar o cadastro de quem contrata a empresa.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Pesquise por nome ou documento.
2. Confira identificação, contato e vínculos comerciais.
3. Salve as alterações autorizadas e confira o cadastro.

### Como conferir se deu certo

O cliente correto pode ser usado na proposta ou contrato.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_parceiros"></a>

## Parceiros

Use esta tela para organizar os parceiros comerciais.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Pesquise o parceiro antes de cadastrar.
2. Confira identificação, contatos e relação comercial.
3. Acompanhe as indicações ou negócios vinculados.

### Como conferir se deu certo

O parceiro possui identificação e vínculos conferidos.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_metas"></a>

## Metas e comissões

Use esta tela para acompanhar objetivos e valores comerciais.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Selecione o período e o responsável.
2. Confira a meta, o realizado e os negócios relacionados.
3. Revise os critérios e os valores antes de qualquer encaminhamento financeiro.

### Como conferir se deu certo

A consulta explica o avanço da meta e a origem dos valores.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_perdas"></a>

## Perdas

Use esta tela para entender por que oportunidades não avançaram.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Localize a oportunidade perdida.
2. Confira ou registre o motivo pelo recurso disponível.
3. Analise os motivos recorrentes para orientar a equipe.

### Como conferir se deu certo

O motivo da perda está associado à oportunidade correta.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_relatorios"></a>

## Relatórios comerciais

Use esta tela para analisar os negócios e resultados comerciais.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Escolha o relatório e o período.
2. Ajuste os filtros de responsável, etapa ou origem disponíveis.
3. Confira os detalhes e use a saída de relatório quando disponível.

### Como conferir se deu certo

O relatório apresenta o recorte comercial desejado.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-fin_previsao"></a>

## Financeiro · Previsão de custo final

Estimar quanto a obra custará ao terminar e explicar cada revisão.

### Antes de começar

Abra Financeiro → Custos por etapa e confira obra e data de corte. Incorrido é o custo já reconhecido; não é o total pago.

### Como fazer

1. Confira o orçamento, o incorrido e os compromissos vinculados por etapa. Em Compromissos por origem, use Vincular à previsão para conferir contrato, etapa e pedidos sobrepostos. Abra um valor para consultar sua memória. O faturamento parcial de pedidos com várias etapas é distribuído proporcionalmente ao valor dos itens.
2. Abra Conferir cobertura dos materiais e confira unidades, aplicação, saldo físico, reservas e pedidos a receber. O saldo físico reduz a necessidade de novas compras; não o desconte outra vez do incorrido. Use Ajuda da cobertura do estoque para conferir os limites e corrija as pendências na origem.
3. Abra Conferir apropriação e previsão e escolha a etapa, inclusive Sem apropriação quando faltar orçamento ou vínculo.
4. Informe todo o custo restante para concluir, incluindo compras e contratos ainda a incorrer. A revisão manual substitui a referência automática; esses compromissos não são somados outra vez. Acrescente uma reserva de risco separada e descreva as premissas.
5. Confira as mudanças adicionais. Se o custo de uma mudança já estiver no restante, marque Já incluído no acompanhamento dela.
6. Em Conferência dos aditivos no custo restante, escolha para cada aditivo: Ainda não conferido, Já está no restante informado ou Fora do restante — considerar separadamente. A escolha registra sua análise, sem mudar os valores.
7. Confirme a previsão e confira o total e o histórico. Quando a base mudar, o valor revisado permanece com aviso: use Atualizar base mantendo valores, confira e salve outra revisão.
8. Para cada aditivo conferido, preencha Justificativa da conferência do aditivo e confirme a previsão. É opcional: sem justificativa, o app salva com aviso. Para manter a pendência, escolha Ainda não conferido.
9. Consulte Histórico de conferência das duplicidades junto de Mudanças e aditivos. Confira responsável, data da conferência, decisão, justificativa, impacto e restante registrados. Use Aditivo do histórico para filtrar e as páginas para consultar registros anteriores.

### Como conferir se deu certo

Custo final = incorrido + restante para concluir + reserva de risco + mudanças explicitamente adicionais. O desvio compara esse total com o orçamento.

### O que merece atenção

Sem orçamento, premissas ou base atualizada, é possível continuar com avisos. Valores inválidos, acesso sem permissão e conflito de edição exigem correção. A estimativa não cria custo, pagamento ou receita. O aviso de possível duplicidade informa um indício, não uma confirmação. O app cruza a declaração de inclusão, as premissas e a variação entre revisões. O preço comercial do aditivo e a reserva de risco não são usados como prova de sobreposição. O histórico mostra somente conferências salvas. Alterações de nome ou etapa preservam a identificação gravada nas novas conferências. A data é a da gravação, exibida no fuso do dispositivo; não é a data de corte da previsão.

### Exemplo ilustrativo

A etapa tem R$ 80 mil incorridos, R$ 50 mil em compras ainda não faturadas e R$ 70 mil estimados para concluir. Informe R$ 70 mil, pois já incluem as compras. Com reserva de R$ 5 mil e mudança adicional de R$ 8 mil, o custo final será R$ 163 mil. Se você elevar o restante de R$ 70 mil para R$ 78 mil e mantiver o piso de R$ 8 mil como adicional, a previsão chegará a R$ 171 mil. O app avisa sobre a coincidência. Após conferir e marcar o piso como Já incluído, o custo final volta a R$ 163 mil. Se o aumento tiver outra causa, registre Fora do restante e mantenha o total justificado.

### Quem cuida de cada parte

- **Engenharia / responsável pelo orçamento:** Estimar serviços restantes, riscos e impactos das mudanças; entregar as premissas ao financeiro.
- **Financeiro ou administrador:** Conferir a origem dos valores, registrar a revisão e acompanhar desvios.

### Quando o fluxo acontece de outro jeito

- **Valor abaixo dos compromissos pendentes:** Confira cancelamentos, economias e os vínculos dos contratos. O aviso permite salvar; explique a diferença nas premissas.
- **Orçamento ou data mudou:** A revisão permanece em uso com aviso. Confira a nova base e atualize mantendo seus valores. Revisões de etapas removidas permanecem no histórico, fora do total atual, até transferência explícita.
- **Não há orçamento aprovado:** Registre a estimativa em Sem apropriação. A comparação orçamentária fica indisponível; aprove um orçamento e confira os vínculos depois.
- **Mudança já contemplada no restante:** Escolha Já incluído no restante da etapa para evitar somar o mesmo custo duas vezes.
- **Possível duplicidade de custo:** Leia o aditivo, a etapa e o motivo do aviso. Confira o restante. Se o impacto já estiver nele, abra Editar ou Atualizar acompanhamento do aditivo e escolha Já incluído no restante da etapa. Se for custo separado, registre Fora do restante — considerar separadamente na conferência da previsão e salve. É possível continuar mesmo sem resolver o aviso.
- **O aviso reapareceu depois de uma alteração:** A conferência vale para o valor do impacto, o restante e o orçamento conferidos. Se algum deles mudar, revise a análise. Aumentos iguais podem ter causas distintas; explique nas premissas e registre a opção correta.
- **Economia possivelmente abatida duas vezes:** Uma redução no restante pode coincidir com uma mudança de custo negativo ainda adicional. Confira se a economia já foi incorporada antes de manter ambos os abatimentos.
- **Conferência sem justificativa:** Confirme com aviso e complemente quando possível. A nova confirmação cria outra revisão; a decisão anterior permanece no histórico.
- **Registro antigo incompleto:** O histórico mostra apenas os dados disponíveis, marcando o registro como antigo. Se a justificativa individual não foi registrada, as premissas originais aparecem separadamente; responsável ou data ausentes não são inventados.
- **Decisão de uma base anterior:** Confira o aviso de base anterior no registro. Os valores do impacto e do restante da época ajudam a entender a decisão; uma referência antiga não significa que a base atual foi conferida.

<a id="guia-obra_aditivos"></a>

## Obra · Mudanças e aditivos

Acompanhar mudanças de escopo, execução, custo e decisão do cliente, sem interromper o trabalho por pendências.

### Antes de começar

Abra a visão geral da obra ou Financeiro → Custos por etapa. Confira o contrato vigente e a obra.

### Como fazer

1. Use Nova mudança ou aditivo e descreva o que muda. Informe impacto no contrato e prazo, inclusive zero para uma mudança apenas operacional.
2. Defina o responsável, a etapa e a execução: Planejada, Em andamento ou Concluída. A execução pode ser acompanhada enquanto a decisão está pendente.
3. Estime apenas o impacto no custo que ainda falta incorrer. Use valor negativo para economia. Escolha Não incluir, Somar como adicional ou Já incluído no restante da etapa.
4. Salve e leia os avisos. O administrador registra a decisão real do cliente em Registrar decisão, com a evidência disponível. Aprovação atualiza contrato e prazo; proposta não é receita aprovada.
5. Use Atualizar acompanhamento para rever execução, custo, responsável e evidência de uma mudança decidida. Os termos decididos ficam preservados. Para novos termos comerciais, registre outra mudança.
6. Confira o efeito na previsão e no contrato vigente. Ao cancelar, registre o motivo disponível e revise se ainda haverá custos remanescentes.
7. Quando aparecer Confira possíveis duplicidades de custo, leia o motivo e confira a previsão da etapa no Financeiro. Se o custo já estiver no restante, escolha Já incluído no acompanhamento; se for separado, registre essa análise na conferência da previsão. Salvar, decidir e acompanhar continuam disponíveis.
8. Acompanhe Histórico de conferência das duplicidades abaixo dos aditivos. O histórico está disponível na visão geral da obra e em Custos por etapa. A decisão e a justificativa da conferência são registradas ao confirmar a previsão no Financeiro.

### Como conferir se deu certo

Cada mudança tem acompanhamento e impacto explícitos, separados da aprovação comercial.

### O que merece atenção

Falta de responsável, etapa, estimativa ou evidência gera aviso e permite continuar. Cancelar ou recusar não apaga custo já incorrido nem retira automaticamente um impacto ainda marcado como adicional. Consultar ou filtrar o histórico não altera contrato, custos ou decisões. Novas conferências permanecem registradas mesmo depois de ultrapassar as 100 revisões resumidas da previsão; registros antigos dependem do histórico ainda disponível na base.

### Exemplo ilustrativo

O cliente pede outro piso: proposta de R$ 12 mil e cinco dias. A execução começa enquanto a decisão está pendente. Restam R$ 8 mil de custo: marque Adicional se esse valor ainda não estiver na previsão da etapa. Depois de incorporá-lo à estimativa da etapa, mude para Já incluído.

### Quem cuida de cada parte

- **Engenharia, financeiro ou administrador:** Registrar a mudança e manter o acompanhamento.
- **Administrador:** Registrar a aprovação ou recusa real do cliente.
- **Administrador ou financeiro:** Cancelar e conferir os efeitos contratuais e custos remanescentes.

### Quando o fluxo acontece de outro jeito

- **Decisão sem evidência:** Registre com aviso e complemente a evidência em Atualizar acompanhamento.
- **Execução iniciada sem aprovação:** Mantenha Em andamento e trate a pendência com o responsável; execução não significa aprovação.
- **Mudança sem impacto financeiro ou prazo:** Registre com zero para acompanhar apenas escopo ou execução.
- **Mudança recusada ou cancelada com custo restante:** Confira o custo ainda necessário e escolha explicitamente se ele continua adicional, já está incluído ou fica fora da previsão.
- **Aditivo e previsão parecem repetir o custo:** O aviso pode vir de inclusão declarada, premissas ou variação do restante igual ao impacto de um ou vários aditivos da mesma etapa. O app não altera os valores automaticamente. Confira os registros e ajuste a opção de impacto ou registre que o custo permanece separado.

<a id="guia-arquivos"></a>

## Arquivos e permissões

Reunir documentos por obra, com pastas, links, uploads e controle de acesso.

### Antes de começar

Confirme a obra em Obra dos arquivos e escolha Arquivos e pastas em Área da documentação.

### Como fazer

1. Abra ou crie a pasta e a subpasta de destino.
2. Use Adicionar documento para enviar um arquivo de até 3 MB ou cadastrar um link; confira título e revisão antes de salvar.
3. Selecione o documento e abra Visualizar para consultar o original no MARCELL ou adicionar uma nova revisão.
4. Como administrador, entre na pasta e use Permissões desta pasta: herde o acesso ou escolha Sem acesso, Leitura ou Leitura e edição para cada pessoa.
5. Na obra e pasta corretas, arraste um arquivo do computador para a área Documentos da obra. O formulário abre com arquivo, título e pasta preenchidos; confira Identificação da revisão e use Salvar documento. Arrastar não envia nem salva automaticamente. No celular, use Adicionar documento, escolha Enviar arquivo em Tipo de documento e toque em Selecionar arquivo.
6. Use Criar pastas padrão para completar a estrutura sem apagar pastas ou documentos existentes. Projetos contém Projetos de Arquitetura e Projetos de Engenharia. A ação reaproveita a pasta Projetos existente e não duplica subpastas; nomes diferentes não são associados automaticamente.
7. Para vários documentos, abra a pasta e arraste até 20 arquivos juntos. No celular ou pelo teclado, use Adicionar arquivos e Selecionar arquivos. Confira Destino e Arquivos do lote e use Enviar arquivos uma vez. Os nomes dos arquivos viram os títulos, todos com revisão R01. Não é necessário cadastrar cada um.
8. Para excluir, abra o documento da central e use Excluir documento. Confira o nome, a obra, a pasta e a quantidade de revisões. Cancelar fecha a confirmação sem iniciar a exclusão; Excluir documento confirma todas as revisões. Os arquivos vão para a lixeira do OneDrive, os links externos saem apenas da central e o histórico permanece.
9. A central acompanha a obra escolhida nas telas vinculadas, dentro das suas permissões. Pastas do OneDrive mostra a organização física; Abrir central de documentos retorna aos documentos com revisões e permissões. Marque as caixas para selecionar vários documentos; tocar no nome abre os detalhes.

### Como conferir se deu certo

O documento aparece na pasta correta, com revisões e histórico; pessoas sem acesso não recebem os registros da pasta.

### O que merece atenção

Subpastas acumulam restrições das pastas superiores; administradores mantêm acesso. Anexos dos módulos seguem o acesso de origem. As permissões da central não alteram o compartilhamento de links externos no provedor. Para envio em lote, arraste até 20 arquivos de uma vez, com até 3 MB por arquivo. Para arquivos maiores, use um link da nuvem. Pastas arrastadas não são aceitas. Soltar em uma pasta sem permissão ou nos vínculos dos módulos não cria documento. Se houver uma edição aberta, conclua ou cancele antes de adicionar outro documento; no formulário de documento, arrastar troca o arquivo selecionado. Cancelar não envia o arquivo. Uploads continuam no OneDrive e precisam de conexão disponível. Anexar arquivos ou criar pastas não cria compromisso, estoque, custo no DRE nem pagamento. Cada arquivo continua limitado a 3 MB e aos formatos permitidos. Se algum for inválido, corrija a seleção antes de enviar. A lista mostra o andamento. O lote só aparece na pasta depois de concluir todos os envios e salvar a organização; falha mantém a lista para tentar novamente, reaproveitando envios confirmados. Documentos existentes não são substituídos: nomes iguais criam documentos separados. Cancelar não apaga arquivos já enviados ao OneDrive. Não feche nem recarregue durante uma tentativa: o lote e seu andamento ficam apenas nesta tela. Pastas somente leitura e vínculos dos módulos não aceitam envio. A exclusão exige a mesma permissão de edição da pasta. Vínculos dos módulos e documentos preservados em contratos comerciais não podem ser excluídos por aqui. Uma revisão compartilhada com outro documento ou módulo bloqueia o envio à lixeira. Arquivo antigo sem identificação segura precisa de conferência. Se houver falha, o documento fica com Exclusão pendente; algumas revisões podem já estar na lixeira. Use Concluir exclusão, inclusive após recarregar. Cancelar a confirmação de uma pendência apenas fecha a janela; não desfaz arquivos já enviados. O documento sai da lista somente após confirmar todas as revisões. A conexão com o OneDrive pode precisar ser renovada pelo administrador. Recuperar um arquivo na lixeira não restaura seu cadastro na central. A ação não altera contratos, despesas, estoque, custo no DRE ou pagamentos.

### Exemplo ilustrativo

Para atualizar uma planta, confira a pasta da obra e a revisão existente. Consulte o histórico para distinguir a planta atual da anterior.

<a id="guia-arquivos_revisoes"></a>

## Arquivos · Revisões, busca e comparação

Consultar a revisão correta, pesquisar o texto do PDF e comparar duas emissões.

### Antes de começar

Abra um documento e confira a identificação da revisão atual.

### Como fazer

1. Em Revisão do documento, selecione a emissão desejada. O aviso de revisão antiga identifica a atual; use Abrir revisão atual para voltar a ela.
2. Para um PDF com texto, digite uma palavra ou expressão em Buscar no texto do PDF. A busca percorre todas as páginas; use Ir para página no resultado.
3. Use Comparar revisões e escolha outra emissão em Comparar com a revisão. Cada painel permite consultar, buscar, navegar e baixar seu próprio arquivo.
4. Use Encerrar comparação para manter a consulta individual ou Fechar visualização para voltar ao cadastro; consulte Histórico de revisões para ver os registros anteriores.

### Como conferir se deu certo

As duas emissões estão identificadas e o conteúdo corresponde à revisão selecionada.

### O que merece atenção

A comparação é visual, lado a lado no computador e empilhada no celular; não marca diferenças automaticamente. A busca não faz OCR: PDFs apenas digitalizados podem não ter texto pesquisável. Se o acesso for negado, confira sua sessão e a permissão antes de tentar novamente.

<a id="guia-arquivos_dossie"></a>

## Arquivos · Dossiê de licenciamento

Organizar as exigências da Prefeitura, do cartório e do condomínio e preparar um pacote documental conferível.

### Antes de começar

Confirme a obra e escolha Dossiê de licenciamento em Área da documentação. O dossiê usa o mesmo cadastro do módulo Licenciamento.

### Como fazer

1. Selecione a exigência na lista ou no seletor do celular. Confira a situação e preencha responsável, validade e observações; salve a exigência.
2. Para exigências condicionais, defina se o item se aplica. Se marcar Não ou Não se aplica, informe uma justificativa. Confira o aviso de documentação faltante.
3. Use Anexar documento à exigência para um arquivo novo de até 20 MB. Use Enviar nova revisão de… para atualizar o mesmo anexo. O nome padronizado identifica obra, área, item e revisão; o nome original permanece no histórico.
4. Abra Visualizar anexo e revisões para conferir o conteúdo. O ZIP inclui a revisão atual de cada anexo, incluindo itens adicionais e documentos gerais cadastrados.
5. Use Baixar dossiê final somente quando não houver pendências. Se estiver incompleto, use Baixar ZIP parcial · INCOMPLETO: confira os arquivos, INDICE.csv, MANIFESTO.json e PENDENCIAS.txt antes de compartilhar.
6. Consulte Histórico de exportações para conferir quando o pacote foi preparado e as pendências registradas.

### Como conferir se deu certo

O ZIP contém os arquivos nativos com nomes padronizados e índice. O pacote parcial leva INCOMPLETO no nome; o final é bloqueado quando há pendências ou falha ao ler um arquivo.

### O que merece atenção

Anexo ausente, vencimento, situação pendente ou aplicabilidade indefinida impedem o final. O pacote é montado no navegador com limite de 100 MB; arquivos não lidos no parcial constam nas pendências. A exportação baixa o ZIP e não o envia automaticamente à Prefeitura ou ao cartório. A conferência interna não equivale à aprovação do órgão. Edição e exportação exigem administrador ou engenheiro autorizado.

<a id="guia-licenca"></a>

## Licenciamento

Acompanhar as exigências e etapas de aprovação da obra com evidências documentais.

### Antes de começar

Selecione a obra e confira o tipo de licença, os órgãos e o condomínio envolvidos.

### Como fazer

1. No celular, selecione a Obra e confira o progresso. Abra Condomínio e procedimento para ver os dados do processo e Condições de entrada para conferir os pré-requisitos.
2. Abra o grupo de documentos desejado. O resumo do grupo mostra quantos itens aplicáveis foram concluídos. Use Editar exigência para abrir o item e atualizar a situação conforme a evidência.
3. Use Anexar documento na exigência correta. Abra Protocolo e emissão para consultar ou preencher seus campos. Quando o modelo exigir, abra Verificação e liberação. No computador, as seções aparecem abertas.
4. Em Arquivos, escolha Dossiê de licenciamento para cadastrar responsável, validade e aplicabilidade, revisar anexos e consultar a documentação faltante.
5. Prepare o ZIP final quando estiver completo ou um ZIP parcial INCOMPLETO com a relação de pendências; confira o pacote antes de encaminhar ao órgão.

### Como conferir se deu certo

Cada etapa mostra a situação e os anexos correspondentes, compartilhados com o dossiê em Arquivos.

### O que merece atenção

Anexar um documento ou concluir a conferência interna não comprova aprovação do órgão. O ZIP é baixado para conferência e envio manual; o sistema não protocola a documentação automaticamente.

<a id="guia-cmp_contratos"></a>

## Compras · Contratos e medições

Consultar contratos de fornecimento e acompanhar serviços medidos.

### Antes de começar

Confira a obra, o fornecedor e seu acesso aos serviços de terceiros.

### Como fazer

1. Em Contratos e medições, escolha Fornecimento ou Serviços e medições.
2. Em Fornecimento, use Novo contrato quando autorizado; confira fornecedor, vigência, itens, preços e quantidades.
3. Use Adicionar insumo e Remover insumo para ajustar os itens do formulário; confira o total e use Salvar contrato.
4. Em Serviços e medições, revise os filtros e abra Ficha do contrato para consultar valores contratados, aprovados, baixados e a pagar.

### Como conferir se deu certo

O contrato e seu histórico ficam identificados no recorte escolhido.

### O que merece atenção

Alterar o formulário não salva automaticamente. O acesso aos serviços e às medições depende do perfil; contrato de fornecimento não confirma entrega nem pagamento.

<a id="guia-cmp_ficha"></a>

## Compras · Ficha rápida

Consultar e continuar uma compra sem reconstruir a pesquisa.

### Antes de começar

Confira a obra e os filtros da fila.

### Como fazer

1. Clique no código na Tabela ou no Kanban. A ficha abre à direita; no celular, ocupa a tela.
2. Confira etapa, prazo e responsável. Em pedidos, compare Valor do pedido, Pago e Saldo a pagar; adiantamentos aparecem em aviso.
3. Use a próxima ação. Cancelar um formulário curto retoma a ficha; na área completa, use Voltar para para retomar a origem.
4. Voltar à fila, Fechar ou Escape encerram a consulta, mantendo busca, filtros e página.

### Como conferir se deu certo

Consultar não grava; a operação exige confirmação no formulário.

### O que merece atenção

Receber não paga. Sem confirmação, repita o mesmo botão na ficha aberta. Após recarregar, use Retomar trabalho salvo para a confirmação pendente.

<a id="guia-fin_ficha"></a>

## Financeiro · Ficha rápida

Conferir o compromisso e a ação permitida.

### Antes de começar

Confira obra, movimentação e prazo em Hoje.

### Como fazer

1. Clique no nome na Tabela ou no Kanban.
2. Compare Valor original, Liquidado e Saldo em aberto. Vencimento inválido fica em Sem vencimento.
3. Se houver pagamento do pedido sem vínculo, use Alocar adiantamento e revise antes de pagar.
4. Use a próxima ação. Na conferência fiscal, feche a ficha fiscal e use Voltar à fila financeira para retomar a origem.
5. Consultar detalhamento abre origem e documentos; Fechar memorial retoma a ficha. Voltar à fila, Fechar ou Escape encerram a consulta.

### Como conferir se deu certo

O recorte da sessão é conservado; consultar não registra pagamento.

### O que merece atenção

A ação depende do perfil e da obra. Registrar pagamento não executa transferência bancária. Se o título sair do recorte, volte à fila para conferir os saldos.

<a id="guia-cmp_pagamento"></a>

## Compras · Registrar pagamento

Registrar pagamentos.

### Antes de começar

Confira Fornecedor, obra, documento, saldo e pagamentos anteriores. Se aparecer Não informado, confira a origem do documento.

### Como fazer

1. Preencha Origem real do pagamento, Valor pago e Data. Selecione o comprovante; Remover comprovante retira o arquivo.
2. Em Alocar pagamento já realizado, selecione Pagamento do pedido, informe Valor a alocar e use Alocar adiantamento. Respeite os dois saldos.
3. Para corrigir, use Desfazer alocação, preencha Motivo para desfazer a alocação e confirme. O saldo volta ao adiantamento, sem devolução bancária.
4. Use Registrar pagamento para uma nova saída real e aguarde. Pagar não conclui entrega nem conferência fiscal. Informe o motivo do adiantamento, se possível.
5. Após recarregar, use Retomar trabalho salvo. Reabra o rascunho ou retome a confirmação original.

### Como conferir se deu certo

O saldo e o histórico mostram a confirmação; registrar no ERP não transfere dinheiro.

### O que merece atenção

Alocar preserva data e total pagos; a classificação muda nessa data e o histórico registra o vínculo. Período fechado ou rateio entre obras impede alocação. Desfaça vínculos antes de estornar ou reclassificar a origem. Confirmação pendente bloqueia outra operação no registro. O rascunho inclui o comprovante neste navegador.

<a id="guia-fin_recuperacao"></a>

## Retomar trabalho salvo

Recuperar trabalho salvo.

### Antes de começar

Entre com o mesmo usuário, navegador e endereço do app.

### Como fazer

1. Use Retomar trabalho salvo e confira obra e registro.
2. Rascunho não enviado: use Reabrir rascunho e revise antes de confirmar.
3. Confirmação enviada, sem resposta: confira o histórico e use Retomar confirmação para reenviar a operação original.

### Como conferir se deu certo

A confirmação atualiza o registro; abrir o rascunho não grava.

### O que merece atenção

A recarga não envia automaticamente. Não é backup: depende dos dados locais. Abas compartilham o rascunho. Sem armazenamento, o envio é bloqueado. Obra e acesso seguem o registro atual. Registro indisponível mantém o trabalho salvo; confira a origem e as permissões. Se o armazenamento falhar na retomada, mantenha a ficha aberta e confira o histórico antes de outra operação. Em abas antigas, copie edições não salvas antes de recarregar após a atualização do ERP.

<a id="guia-cmp_recuperacao"></a>

## Retomar trabalho salvo

Recuperar trabalho salvo.

### Antes de começar

Entre com o mesmo usuário, navegador e endereço do app.

### Como fazer

1. Use Retomar trabalho salvo e confira obra e registro.
2. Rascunho não enviado: use Reabrir rascunho e revise antes de confirmar.
3. Confirmação enviada, sem resposta: confira o histórico e use Retomar confirmação para reenviar a operação original.

### Como conferir se deu certo

A confirmação atualiza o registro; abrir o rascunho não grava.

### O que merece atenção

A recarga não envia automaticamente. Não é backup: depende dos dados locais. Abas compartilham o rascunho. Sem armazenamento, o envio é bloqueado. Obra e acesso seguem o registro atual. Registro indisponível mantém o trabalho salvo; confira a origem e as permissões. Se o armazenamento falhar na retomada, mantenha a ficha aberta e confira o histórico antes de outra operação. Em abas antigas, copie edições não salvas antes de recarregar após a atualização do ERP.

<a id="guia-home_recuperacao"></a>

## Recuperar salvamento

Retomar uma edição protegida sem perder campos nem repetir ações.

### Antes de começar

Use a mesma conta, navegador e endereço. A recuperação procura primeiro a edição desta aba e depois a mais recente da mesma conta. Confira a conexão.

### Como fazer

1. Edição protegida pendente é um aviso global deste navegador e desta conta. Área da edição identifica o cadastro a conferir; ela pode ser diferente da tela aberta. O aviso não significa, por si só, que houve falha na Conciliação.
2. Antes de recuperar, salve ou cancele campos novos de outros formulários. Tentativas de salvar enquanto há outra pendência ficam protegidas separadamente.
3. Use Resolver salvamento no aviso ou no formulário aberto.
4. Se a sessão expirou, informe a senha da mesma conta em Renovar sessão; isso não grava automaticamente.
5. Use Consultar versão atual. Confira sua edição e o servidor; escolha cada campo em conflito. Nos demais campos, Manter servidor permite retirar uma mudança da revisão.
6. Use Salvar alterações revisadas e aguarde. Depois da recuperação, feche e reabra formulários antigos antes de editar novamente. Confira se outra edição aparece em Resolver salvamento e conclua as revisões até o aviso desaparecer.
7. Se a comparação disser que a edição já consta na versão consultada, use Concluir conferência. O app consulta novamente e encerra apenas essa pendência local, sem entrar na fila de envio. Se o servidor, o acesso ou a revisão local mudaram, a edição é preservada e será necessário consultar e revisar novamente.

### Como conferir se deu certo

A edição é enviada apenas após revisão explícita; a recarga não confirma operações.

### O que merece atenção

A proteção depende do armazenamento local e não é backup. Sem armazenamento, o envio fica bloqueado: mantenha a aba aberta. Verificar armazenamento retoma a conferência inicial; Proteger preenchimentos tenta gravar as tentativas que ficaram na memória; Proteger e reenviar edição tenta proteger novamente o que está na memória. Descartar edição da memória exige confirmação e perde essa tentativa; cópias já protegidas são preservadas. Sair e trocar de conta aguardam envios em andamento. Resolva o armazenamento antes de sair com uma edição apenas na memória. Concluir conferência encerra uma pendência que já consta no servidor, sem repetir a gravação. Mudança de acesso ou obra pode bloquear a retomada. Descartar edição protegida consulta o servidor e remove apenas a edição revisada; confirme com cuidado. Pagamentos e recebimentos continuam usando suas confirmações próprias. Não descarte a edição para esconder o aviso. A recuperação e o salvamento de novas alterações continuam dependendo de conferência explícita; nenhum reenvio é iniciado só por abrir a tela.

<a id="guia-plan_baseline"></a>

## Planejamento · Linha de base aprovada e SPI

Aprovar uma versão conferível de datas, calendário e orçamento para comparar o planejado com o executado.

### Antes de começar

Confira a obra, um único plano, o orçamento de controle aprovado e bloqueado, as datas e o calendário. Para cada item com valor deve existir uma única atividade executiva na etapa ou ancestral mais próximo; não há rateio automático.

### Como fazer

1. No Planejamento, abra Linha de base aprovada e SPI. Confira a proposta atual e a premissa: os valores são distribuídos linearmente pelos dias trabalhados do calendário congelado.
2. Preencha Justificativa da proposta ou revisão com pelo menos 10 caracteres e use Preparar proposta de linha de base. Engenharia e planejamento podem propor; propor ainda não libera o SPI.
3. Em Versão da linha de base, escolha a proposta. Abra Conferir itens e calendário congelados e confira quantidade, unidade, atividade, datas, peso orçamentário, dias da semana e feriados. Leia a justificativa e o Histórico das linhas de base.
4. Como administrador ou diretoria, use Aprovar linha de base V seguida do número. Se datas, calendário ou orçamento mudaram desde a proposta, prepare uma nova proposta: a aprovação desatualizada é bloqueada. A aprovação registra autor e data pelo servidor, sem campo para retroagir.
5. Para revisar, ajuste a origem, registre a justificativa e prepare outra proposta. A nova aprovação passa a valer para consultas a partir do dia de aprovação; versões anteriores continuam íntegras e consultáveis. Uma proposta ligada a versão ultrapassada não pode ser aprovada.
6. Selecione uma versão aprovada e ajuste Referência do SPI para conferir SPI da versão consultada. No Financeiro, abra Previsões gerenciais → Indicadores da obra ou Relatório para diretoria → Execução; confira SPI da obra e Conferir memória do SPI. A consulta automática usa a última aprovação até a referência.

### Como conferir se deu certo

O histórico preserva as versões e a justificativa de cada revisão. SPI compara valor agregado e valor planejado da mesma base; tela, CSV e apresentação mostram versão, origens e motivos de indisponibilidade.

### O que merece atenção

SPI é o índice de desempenho de prazo: valor agregado (EV) dividido pelo valor planejado (PV). Abaixo de 1 indica valor agregado inferior ao planejado; acima de 1, superior. Não mede atraso em dias, caminho crítico ou previsão estatística de término. SV é EV menos PV em reais orçamentários. PV usa dias trabalhados, com distribuição linear e arredondamento acumulado por item; ao fim conserva o orçamento inteiro. EV usa pesos congelados e avanço acumulado dos mesmos itens em diário concluído e revisado. Item, atividade, orçamento, unidade e quantidade de referência precisam coincidir. Falta de medição ou duplicidade não viram zero; SPI exige cobertura integral dos itens com valor e PV positivo. Atividades sem valor não influenciam o índice. A aprovação usa o dia civil de Brasília e não reconstrói o que a equipe sabia no passado; diários são os registros atualmente carregados. Fotografias legadas de datas não são convertidas automaticamente em versões aprovadas e não calculam SPI. Não é possível editar ou apagar uma versão aprovada pelo fluxo de proposta e aprovação.

<a id="guia-fin_previsoes_accounting"></a>

## Previsões · Indicadores contábeis

Conferir rentabilidade, capacidade de pagamento e participação do capital de terceiros na empresa inteira.

### Antes de começar

Use administrador ou financeiro ativo com acesso geral, sem restrição a uma obra. Prepare o balancete completo da mesma entidade, antes dos lançamentos de encerramento do resultado, com todas as contas analíticas e meses inteiros já encerrados.

### Como fazer

1. Em Previsões gerenciais, selecione Indicadores contábeis e Todas as obras e empresa em Obra da previsão. Confira Data de referência da previsão; somente bases com término até essa data ficam disponíveis.
2. Escolha a Base contábil. Confira entidade, período, documento, revisão, situação e responsável. Se faltar uma base, abra Bases e conferência e siga a ajuda específica dessa seção.
3. Em Resumo contábil, leia Margem líquida, Liquidez corrente e Capital de terceiros / ativo. As tabelas de Rentabilidade, Liquidez e Endividamento mostram resultado, numerador, denominador, fórmula e motivo de indisponibilidade.
4. Em Memória contábil, confira Balanço de conferência, DRE contábil do período e Memória das contas contábeis, com código, grupo, movimentação e linha do CSV.
5. Use Exportar indicadores contábeis CSV ou Preparar apresentação contábil / PDF. Confira o recorte antes de compartilhar. As oito seções do CSV incluem origem, indicadores, contas, grupos, pendências, balanço, DRE e conciliação. Os números exportados usam ponto decimal; proporções usam escala de zero a um. O balancete de entrada usa o formato brasileiro indicado no modelo.

### Como conferir se deu certo

Bases conferidas liberam onze indicadores calculados sobre a mesma entidade e período. Rascunho, divergência de consistência ou denominador sem valor positivo deixam o resultado indisponível, com motivo.

### O que merece atenção

ROA é retorno sobre o ativo e ROE é retorno sobre o patrimônio líquido (PL). Nesta tela, ambos dividem o lucro líquido do período pelo saldo final, sem médias e sem anualização. Margens bruta e líquida usam receita líquida. Liquidez seca restrita usa somente caixa, equivalentes livres e recebíveis financeiros de curto prazo; a corrente usa todo o ativo circulante. Liquidez geral inclui realizável a longo prazo. Endividamento usa passivo circulante e não circulante, sem incluir o PL no numerador. PL inclui contas de patrimônio e resultado acumulado ainda não encerrado. Prejuízo pode produzir rentabilidade negativa; denominador zero ou negativo não vira zero nem infinito. Não há meta universal ou classificação automática de empresa saudável. Os índices exigem cobertura contábil completa; títulos do ERP e caixa de 13 semanas não substituem o balanço. Conferência interna não é auditoria, parecer ou demonstração contábil publicada. Consultar, abrir ajuda e exportar não grava lançamentos. A referência usa os registros atuais e não reconstrói o conhecimento do passado.

<a id="guia-fin_previsoes_accounting_base"></a>

## Previsões · Bases contábeis e conferência

Importar, conferir e preservar as revisões do balancete que sustenta os indicadores da empresa.

### Antes de começar

Peça à contabilidade o balancete antes dos lançamentos de encerramento do resultado, com saldos iniciais, débitos, créditos e saldos finais. Use somente contas analíticas, sem totais nem contas sintéticas duplicando valores. Período máximo: doze meses inteiros já encerrados.

### Como fazer

1. Em Indicadores contábeis, abra Bases e conferência e depois Importar balancete. Use Baixar modelo do balancete CSV e o Guia dos grupos contábeis do CSV para preparar a classificação.
2. Substitua todos os zeros ilustrativos do modelo pelas contas reais. Salve CSV UTF-8, separador ponto e vírgula, até 512 KB e 2.000 contas. Preserve o cabeçalho codigo;conta;grupo;saldo_inicial;debitos;creditos;saldo_final. Informe reais no padrão 1.234,56, saldos devedores positivos e credores negativos. Débitos e créditos são não negativos; zero deve estar explícito.
3. Use Selecionar balancete CSV. Confira Entidade do balancete, Documento de origem contábil, Início do período contábil e Fim do período contábil. Informe Justificativa da importação ou revisão com pelo menos dez caracteres. Importar base contábil grava um rascunho, sem liberar indicadores.
4. Leia Conferência dos saldos contábeis e Pendências da base contábil. Cada conta precisa fechar saldo inicial mais débitos menos créditos igual a saldo final; débitos e créditos totais precisam coincidir e saldos totais fechar em zero. Confira a natureza dos grupos e o balanço, incluindo resultado ainda não encerrado no PL.
5. Leia Comparação contabilidade e ERP. Se houver diferença, ausência de base comparável ou pendências do ERP, preencha Justificativa da conciliação com o ERP com pelo menos dez caracteres. Isso não cria ajustes nem lançamentos.
6. Confirme a caixa sobre entidade, contas analíticas, classificação, resultado antes do encerramento e saldos conferidos. Use Conferir base e liberar indicadores. Se os fatos do ERP mudarem durante a conferência, atualize e confira a comparação novamente.
7. Abra Histórico das bases contábeis para consultar Revisões contábeis preservadas. Para corrigir, ajuste o arquivo na contabilidade e importe nova revisão. Use Base contábil para comparar consultas das versões anteriores.

### Como conferir se deu certo

O sistema registra origem, período, contas, revisão, autor, data e comparação com o ERP. A revisão conferida permanece preservada; importar outra não apaga a anterior.

### O que merece atenção

Balancete já encerrado não sustenta a DRE deste fluxo: use o arquivo anterior ao encerramento. A DRE usa movimentação do período; o balanço usa saldos finais. O PL dos índices soma as contas de patrimônio ao resultado acumulado em aberto, que pode incluir períodos anteriores. Saldo inicial e final são conferidos em centavos. Conferir a aritmética não comprova por si só a cobertura integral: o responsável precisa confirmar entidade, grupos, prazos e todas as contas. Não misture empresas ou períodos. Base inconsistente pode ser guardada como rascunho, mas não pode ser conferida. Bases conferidas não podem ser editadas ou apagadas pelo fluxo. Se o ERP mudar depois, aparece aviso e a comparação registrada é preservada; importe uma revisão se necessário. Administrador ou financeiro com restrição por obra não pode acessar as bases da empresa. O arquivo é lido e normalizado em contas na base do app; não é enviado a serviços externos para interpretação. Nada é publicado automaticamente.

<a id="guia-report_identity"></a>

## Relatórios · Identidade do documento

Conferir a logomarca MARCELL antes de gerar o relatório.

### Antes de começar

Confira obra, período e filtros.

### Como fazer

1. Use a ação de impressão ou PDF.
2. Em Identidade do relatório, confira a prévia da logomarca MARCELL.
3. Aguarde a logomarca e as fontes carregarem para habilitar Gerar relatório.
4. Use Gerar relatório para abrir o documento e Imprimir / salvar PDF para salvar uma cópia. Alguns relatórios imprimem automaticamente.
5. Cancelar ou Escape mantém os filtros.
6. Se necessário, confira a conexão e use Tentar carregar novamente ou permita abrir janelas para este site. Sem conexão, o preparo depende de as fontes já estarem guardadas neste navegador.

### Como conferir se deu certo

A logomarca MARCELL aparece no cabeçalho e na marca-d’água.

### O que merece atenção

Gerar o relatório não grava operações. CSV, planilhas, anexos e ZIP não usam esta janela.

<a id="guia-com_contratos_editor"></a>

## Comercial · Preenchimento e revisão de contratos

Cadastrar, conferir e acompanhar contratos por cliente e obra.

### Antes de começar

O administrador deve conferir o cadastro da contratada em Modelos de contrato. Tenha cliente, condições e documentos da negociação.

### Como fazer

1. Se chegou da ficha de um lead, confira Contratos do lead. Consultar toda a central remove apenas esse recorte; Voltar à ficha do lead retorna às edições preservadas na sessão. Escopo dos contratos explica que os filtros da central controlam a consulta, não o contexto Comercial da empresa no cabeçalho.
2. Em Comercial, abra Propostas e contratos e escolha Contratos.
3. Use Novo contrato. Preencha as etapas A a G. É possível começar antes de existir obra cadastrada.
4. Selecione o cliente, a proposta compatível e a obra. Confira os dados das partes; nenhuma declaração pessoal é presumida.
5. Em Imóvel e obra, compare os dados. Salve o rascunho, selecione os campos e use Aproveitar dados selecionados da obra. Confirme os valores novamente.
6. As alterações são salvas após uma breve pausa; aguarde a confirmação. Salvar rascunho permite tentar novamente. Falhas preservam o formulário. Em conflito, copie a edição antes de fechar e reabra o registro atual.
7. Em Anexos e revisão, vincule revisões dos Arquivos da mesma obra. Confirme cada arquivo após conferir seu conteúdo.
8. Use Enviar para revisão. O administrador pode devolver com motivo ou aprovar a revisão externa quando todas as pendências forem atendidas.
9. Consulte o histórico. Depois da aprovação, use Abrir nova revisão com motivo para alterar dados; a versão anterior fica preservada.
10. No recorte de um lead, Filtros reúne também pesquisa, situação e obra. Emissão de documentos indisponível explica a limitação de PDF/DOCX. Para administrar Modelos de contrato, use Consultar toda a central; essa área continua exclusiva do administrador.

### Como conferir se deu certo

O cadastro conserva modelo, cópia da contratada, dados, anexos e histórico. Os filtros da lista permanecem ao fechar a ficha.

### O que merece atenção

Gerar PDF e Exportar DOCX estão desativados: não há emissão de documentos nesta entrega. Para aprovação, o administrador precisa conferir externamente o documento e seus anexos. Pessoa jurídica, múltiplos contratantes e obra sem loteamento exigem variante aprovada ainda indisponível. CGR (Custo Gerencial de Referência), taxa e teto são independentes; valor cadastrado na obra não define esses campos automaticamente. Dados da obra não atualizam cópias aprovadas ou assinadas.

<a id="guia-com_contratos_modelos"></a>

## Comercial · Modelos e contratada

Consultar o texto protegido e manter a identificação da contratada.

### Antes de começar

Somente o administrador administra o cadastro central.

### Como fazer

1. Em Contratos, abra Modelos de contrato.
2. Use Consultar cláusulas e variáveis do modelo para ler o texto importado, sem editar cláusulas.
3. Use Editar cadastro da contratada. Confira razão social, CNPJ, endereço, contatos, representante e registro profissional.
4. Use Salvar cadastro da contratada. Novos contratos copiam a versão central; contratos existentes conservam sua cópia.

### Como conferir se deu certo

A contratada tem um cadastro central versionado. O modelo permanece protegido para revisão.

### O que merece atenção

Não há edição de cláusulas, publicação de variantes nem emissão PDF/DOCX nesta entrega. A aprovação de um cadastro não publica uma nova versão de modelo.

<a id="guia-fin_estoque"></a>

## Financeiro · Cobertura do estoque

Conferir quais materiais ainda precisam ser comprados e o efeito na estimativa para concluir.

### Antes de começar

Confira o orçamento de controle com materiais e unidades vinculados, os recebimentos em Compras, as aplicações por tarefa no Estoque e as reservas em Suprimentos.

### Como fazer

1. Em Custos por etapa, abra Conferir cobertura dos materiais.
2. Use Pesquisar material ou etapa para localizar o material. Confira Demanda orçada, Aplicado líquido, Saldo físico, Reservado na etapa, Livre na etapa, Pedidos a receber e Falta comprar.
3. Abra Conferir origens para ver os itens do orçamento, pedidos, movimentos e reservas que formam a quantidade. Corrija divergências na área de origem; não precisa cadastrar outra cópia no Financeiro.
4. Compare Reposição estimada com a referência automática. Ela usa o preço médio dos materiais no orçamento, não uma nova avaliação contábil do estoque.
5. Leia as pendências. Após conferir as fontes, use Conferir apropriação e previsão para revisar explicitamente o restante da etapa quando necessário. Abrir a ajuda mantém a busca e os dados.

### Como conferir se deu certo

O estoque e os pedidos a receber cobrem quantidades uma vez. A referência automática compara orçamento menos incorrido, compromissos sem sobreposição e reposição mais compras independentes ainda não faturadas. Os pisos não são somados.

### O que merece atenção

Posição física e compras são atuais; a data financeira não reconstrói o estoque passado. Reserva da mesma etapa já faz parte do saldo físico. Aplicado líquido é consumo menos devolução; perda reduz o saldo e pode exigir reposição. Estoque de outra obra ou etapa não é reaproveitado automaticamente. Entrada sem pedido e item compatíveis, recebimento divergente, etapa ambígua, unidade ou saldo inválidos exigem conciliação ou revisão explícita da etapa; enquanto isso o custo final gerencial fica indisponível. Materiais e contratos na mesma etapa podem sobrepor escopos: confira a estimativa. Uma revisão manual substitui a referência e permanece preservada; mudança no estoque, reserva, tarefa, catálogo usado ou composição pede reconferência. Entrada, reserva, aplicação e consulta não criam custos, pagamentos ou lançamentos no DRE. A nota ou outra fonte financeira continua sendo a origem do custo reconhecido. Sem materiais vinculados ao orçamento, a consulta não comprova cobertura integral.

<a id="guia-terc_garantia"></a>

## Terceiros · Garantia técnica das medições

Reter uma parte da medição como garantia, acompanhar a liberação e registrar sua baixa.

### Antes de começar

Confira medição, contrato, obra, condição contratual e evidência do aceite. Administrador ou financeiro opera; os demais perfis autorizados consultam.

### Como fazer

1. Em Financeiro → Custos por etapa → Compromissos por origem, abra Garantias técnicas das medições e selecione a medição. Em Terceiros → Medições, use Conferir garantia técnica.
2. Confira Valores da origem. Bruto, tributos, beneficiário e obra são reaproveitados da medição e do contrato.
3. Em Operação da medição, escolha Definir ou remover garantia. Informe Garantia técnica da medição (R$), Condição de liberação e Justificativa da operação; use Salvar garantia técnica. Zero remove antes de baixa ou liberação.
4. Para pagar o principal, escolha Registrar pagamento do principal, confira o líquido, a data e Quem realizou o pagamento. Justifique e confirme; o valor não é redigitado.
5. Para liberar, escolha Liberar garantia técnica. Informe data, vencimento e Evidência da condição cumprida, confirme a condição, justifique e use Confirmar liberação da garantia.
6. Para pagar o retido, escolha Registrar pagamento da garantia, confira data e pagador, justifique e confirme. Em Histórico da garantia e pagamentos, confira autor, operações e baixas.

### Como conferir se deu certo

O bruto permanece como custo reconhecido uma vez após aprovação. Principal disponível e garantia ficam separados na obrigação.

### O que merece atenção

Garantia não é ISS/INSS. Tributos são calculados sobre o bruto no principal; não se repetem ao pagar a garantia. Definir e liberar não movimenta caixa nem cria custo no DRE. Retido fica Sem vencimento até liberação expressa. A liberação é integral e não pode ser repetida; não há liberação automática por data. Baixas anteriores exigem conciliação e estorno antes de definir ou mudar a garantia. Concilie o pagamento existente pelo líquido; não registre outra baixa pela nota ou extrato. Para estornar, informe a justificativa acima e use Estornar baixa no histórico; desfaça a conciliação antes. Período fechado, saldo divergente, acesso ou versão alterada exigem correção. Falha mantém o formulário para tentar novamente. O sistema não presume cláusulas, percentuais ou aceite. Contratos comerciais e emissão de documentos permanecem independentes.

<a id="guia-fin_colunas"></a>

## Financeiro · Colunas das tabelas

Escolher quais campos opcionais aparecem, mantendo identificação e avisos essenciais.

### Antes de começar

Confira o usuário, a empresa e a lista. As escolhas são guardadas somente neste navegador.

### Como fazer

1. Nas tabelas de Hoje, use Colunas. No Kanban, os cartões permanecem completos.
2. Em Custos por etapa, use Colunas dos custos por etapa. As consultas de contratos de terceiros, materiais e garantias têm seu próprio botão Colunas.
3. Marque os campos que quer mostrar e desmarque os opcionais. Campos obrigatórios permanecem marcados. A escolha vale para a mesma lista nas obras disponíveis.
4. Use Concluir para voltar. Busca, filtros, página e seleção permanecem. Para voltar à apresentação inicial, use Restaurar colunas padrão.

### Como conferir se deu certo

A lista mostra os campos escolhidos no computador e no celular. Preferências ficam separadas por empresa, usuário e lista.

### O que merece atenção

Ocultar uma coluna não modifica registros, valores, permissões, DRE ou pagamentos. Fichas, memórias e exportações continuam completas, com os dados autorizados; não exportam somente as colunas visíveis. Sem empresa identificada ou com armazenamento bloqueado, aparece aviso e a escolha vale apenas na sessão. Colunas removidas são ignoradas e colunas novas aparecem por padrão. Escolhas não substituem a autorização de acesso. Documentos e Pagamentos mantêm suas fichas operacionais; este controle é para as tabelas indicadas.

<a id="guia-cliente_login"></a>

## Cliente · Entrar no portal

Entrar com o acesso individual fornecido pela MARCELL.

### Antes de começar

Tenha seu e-mail e sua senha. O endereço previsto é portaldocliente.marcelleng.com.br; durante a preparação, use o endereço local informado pela equipe. O fundo arquitetônico do tema MARCELL Vidro é ilustrativo e não representa a sua obra.

### Como fazer

1. Abra o endereço do portal.
2. Preencha E-mail e Senha e use Entrar no portal. Se precisar de orientação, o botão Ajuda mantém o nome visível também no celular.
3. Confira o nome da obra. Se houver mais de uma, escolha Obra em acompanhamento.

### Como conferir se deu certo

A obra vinculada aparece com as abas permitidas ao seu perfil.

### O que merece atenção

Se esqueceu a senha, peça a redefinição à equipe. Não há envio automático de e-mail nem cadastro aberto. Links compartilhados antigos não substituem o login individual.

<a id="guia-cliente_inicio"></a>

## Cliente · Acompanhamento da obra

Consultar o resumo e escolher a área desejada.

### Antes de começar

Confira a obra selecionada e a data do resumo.

### Como fazer

1. Confira primeiro Avanço físico, fase, previsão de término e a data de atualização. Sem informação, o avanço não aparece como zero. Estimativa pelo cronograma é identificada e pode ser diferente de uma medição confirmada. A fase vem do vínculo com o cadastro de fases da obra. Se ela não estiver informada, solicite a conferência à equipe. Use Ver diário e fotos para abrir os registros diários.
2. Depois leia Contrato e quinzena, o Percentual acumulado do contrato, seu valor correspondente e a parcela emitida ainda a pagar. Use Ver contrato e recebimentos junto à cobrança para consultar suas medições e recebimentos. Confira também Mão de obra até a data indicada.
3. As abas estão agrupadas em Evolução da obra e Custos e compras. Escolha a área desejada. No celular, use Abas do portal do cliente.
4. Use Atualizar consulta para buscar os dados atuais. Use Ajuda para consultar as orientações sem sair da tela.

### Como conferir se deu certo

O conteúdo corresponde à obra e às permissões do seu acesso. O tema MARCELL Vidro usa painéis translúcidos; a residência ao fundo é ilustrativa e não altera as fotos dos diários.

### O que merece atenção

Resumo e documentos avulsos são publicados pela equipe. Diário da obra, caixa, gastos, orçamento por etapa, contrato e compras consultam os registros atuais quando liberados. O percentual acumulado não é uma nova cobrança: Quinzena a pagar é o saldo da parcela emitida, após recebimentos. Sem medição emitida, aparece Aguardando medição. Contrato por valor indica que as medições não informam percentual acumulado. Uma parcela sem vencimento continua em aberto, com data A confirmar; peça a conferência à equipe. Um recebimento excedente não reduz automaticamente o saldo de outra parcela. Mão de obra própria e benefícios usam os dias registrados até a data da consulta, sem antecipar presenças futuras. Sair do portal encerra a sessão.

<a id="guia-cliente_fotos"></a>

## Cliente · Diário da obra

Consultar todos os diários concluídos e liberados, com relato, serviços, clima e fotos por dia.

### Antes de começar

Confira a obra e tenha em mente o dia que deseja consultar.

### Como fazer

1. Abra Diário da obra.
2. Em Dia do diário, escolha uma data ou use Mostrar todos os dias.
3. Use Abrir diário para conferir relato, clima, serviços executados e Fotos deste diário. Mesmo sem fotos, o diário permanece disponível.
4. Clique na foto para ampliar. As imagens aparecem inteiras, sem cortes. Use Abrir imagem original para consultar o arquivo em outra aba e Fechar ou Escape para voltar ao diário. O mesmo dia permanece selecionado ao fechar a imagem. Use Mostrar mais dias para continuar.

### Como conferir se deu certo

Os diários aparecem do dia mais recente ao mais antigo; vários registros no mesmo dia ficam separados. Cada foto permanece vinculada ao diário de origem.

### O que merece atenção

A liberação Diários e fotos na obra permite consultar os diários concluídos atuais. Rascunhos, cancelados, comentários internos, presenças e dados pessoais não são exibidos. O registro aparece mesmo sem imagens. A data é do diário; a ausência de foto não confirma ausência de trabalho.

<a id="guia-cliente_progresso"></a>

## Cliente · Avanço físico

Consultar o avanço e as etapas compartilhadas pela equipe.

### Antes de começar

Confira a obra e a data de publicação do resumo.

### Como fazer

1. Abra Avanço físico.
2. Leia os percentuais, as datas planejadas e a situação das etapas.
3. Confira as atualizações da equipe. Para os registros e fotos por dia, abra Diário da obra.

### Como conferir se deu certo

A execução compartilhada aparece por etapa e no resumo da obra.

### O que merece atenção

O avanço usa a mesma regra oficial do ERP: percentual acumulado confirmado das medições técnicas aprovadas; sem elas, medição percentual de cobrança. Sem ambas, usa o cronograma, ponderado pelo custo previsto quando há referência. Previsão de término não é garantia contratual nem comprovação de pagamento.

<a id="guia-cliente_gastos"></a>

## Cliente · Gastos por categoria

Conferir materiais, mão de obra e demais categorias sem confundir custo com pagamento.

### Antes de começar

Confira a obra e a data da consulta.

### Como fazer

1. Abra Gastos por categoria.
2. Confira Mão de obra até a data indicada e os benefícios, depois compare Custo reconhecido e Pagamentos registrados.
3. Leia cada categoria. Se aparecer Custos em conferência, peça à equipe a revisão da base e atualize a consulta depois.

### Como conferir se deu certo

Os totais usam a mesma origem financeira do ERP, sem nomes ou salários individuais.

### O que merece atenção

Materiais e outras fontes seguem a competência registrada até o mês da consulta. Mão de obra própria e benefícios ficam limitados aos dias até a data de consulta, conforme o motor do ERP, incluindo encargos e feriados devidos. Pagamento segue sua data real, inclusive quando feito diretamente pelo cliente ao fornecedor. Pedido é compromisso e entrega é estoque; não some esses fatos ao custo reconhecido.

<a id="guia-cliente_caixa"></a>

## Cliente · Extrato do caixa da obra

Conferir entradas, saídas, saldo e notas fiscais do caixa da obra.

### Antes de começar

Confira a obra. Este extrato é do caixa da obra, separado das contas bancárias da empresa.

### Como fazer

1. Abra Caixa da obra.
2. No resumo compacto, leia Saldo atual e os totais de Entradas e Saídas lado a lado. No Extrato da obra, cada linha mostra data, lançamento, tipo e valor, saldo após o movimento e nota fiscal quando vinculada.
3. Escolha Tipo de movimentação para mostrar Entradas e saídas, Somente entradas ou Somente saídas. Abra Filtros para preencher Data inicial do extrato, Data final do extrato ou Buscar no extrato. A busca encontra a descrição, a categoria e o número da nota.
4. Use Abrir nota fiscal no lançamento para consultar o original liberado. Quando há mais de uma nota no pedido sem vínculo individual, peça à equipe a conferência do pagamento.
5. Use Limpar filtros do extrato para voltar ao conjunto completo. Use Atualizar consulta no cabeçalho para buscar dados atuais. Ajuda mantém o recorte aberto.

### Como conferir se deu certo

O extrato mostra entradas em verde com sinal positivo e saídas em vermelho com sinal negativo, sempre com o tipo escrito. O resumo informa o caixa completo; os totais de Movimentos exibidos correspondem aos filtros.

### O que merece atenção

O saldo de cada linha é a posição original após aquele movimento; os filtros não recalculam os saldos das linhas nem o Saldo atual. O saldo considera aportes menos despesas ativas com data até o dia da consulta no calendário da Bahia. Movimentos futuros e sem data não compõem o saldo atual. Sem nota vinculada neste lançamento não comprova ausência de compra ou de nota. Os anexos exigem liberação fiscal e permissão de documentos. Vínculos usam IDs comprovados, nunca fornecedor, valor ou descrição parecida. Abrir um anexo não confirma pagamento nem reconhece novo custo no demonstrativo de resultado (DRE). O portal não movimenta dinheiro nem concilia extratos. Dados bancários e PIX não são mostrados.

<a id="guia-cliente_orcamento"></a>

## Cliente · Previsto e realizado por etapa

Comparar a previsão aprovada com o custo reconhecido e o valor pago.

### Antes de começar

Confira a obra e o orçamento de controle aprovado.

### Como fazer

1. Abra Previsto e realizado.
2. Leia Previsto, Realizado (custo), Pago e Previsto menos realizado para cada etapa.
3. Confira Etapa ainda não informada. Se o previsto estiver indisponível, solicite a conferência da versão aprovada do orçamento.

### Como conferir se deu certo

A comparação apresenta cada etapa sem somar previsão, custo e pagamento.

### O que merece atenção

Etapa ainda não informada contém valores sem vínculo comprovado com uma etapa; eles continuam no total da obra. Não há distribuição automática por descrição ou semelhança. Orçamento e pagamentos não criam custos adicionais no resultado. Ausência de base não equivale a zero.

<a id="guia-cliente_compras"></a>

## Cliente · Compras e notas fiscais

Consultar todas as compras liberadas e os documentos fiscais vinculados.

### Antes de começar

Confira a obra e seu perfil de acesso. Para anexos, é necessária a permissão de documentos.

### Como fazer

1. Abra Compras e notas fiscais.
2. Use Pesquisar compra ou fornecedor e Ver itens e notas no pedido desejado. Use Recolher compra para fechar os detalhes.
3. Confira itens, unidades, quantidades recebidas e Notas fiscais da compra. Abra o anexo liberado; use Mostrar mais compras para continuar.

### Como conferir se deu certo

Os pedidos e as notas ativos aparecem pelo vínculo cadastrado, com os anexos disponíveis. Registros excluídos, cancelados ou desativados não aparecem.

### O que merece atenção

Nota sem pedido permanece separada; o sistema não liga por fornecedor, valor ou descrição. Ausência de anexo exige solicitação à equipe. Notas em rascunho não aparecem, inclusive nos anexos do caixa. Abrir um original não aprova documento nem registra pagamento. O acesso ao OneDrive depende da conexão central da MARCELL.

<a id="guia-folha_repasse"></a>

## Folha · Reservas no repasse ao cliente

Configurar a estimativa de encargos e reservas que será apresentada ao cliente.

### Antes de começar

Entre como administrador e confira os parâmetros com a equipe responsável. Esta estimativa não altera os encargos já reconhecidos no DRE.

### Como fazer

1. Em Folha, abra Regras e descontos e escolha Encargos.
2. Localize Reservas no repasse ao cliente. Marque Usar o modelo de encargos e reservas no repasse previsto.
3. Confira Encargos patronais: CPP, RAT e terceiros, FGTS, Multa do FGTS, Permanência média, Desligamentos sem justa causa, Avisos indenizados e Dias de aviso prévio. Os percentuais zero são preservados. A base é a remuneração apropriada à obra, sem converter diária em salário mensal.
4. Confira a estimativa para cada R$ 100 e use Salvar parâmetros do repasse. Aguarde a confirmação.
5. Na obra, libere Administração e equipe e atualize a publicação. No portal, use Atualizar consulta para consultar os valores.

### Como conferir se deu certo

O repasse previsto soma ao custo da equipe somente os encargos e provisões complementares que ainda não estão nele. Quando a mão de obra faz parte da base administrativa, o complemento integra a estimativa da taxa do contrato.

### O que merece atenção

Inclui 13º, férias e um terço, encargos dessas verbas, aviso prévio indenizado, FGTS e reflexos do aviso, além da multa do FGTS conforme as premissas. EPI, uniformes, exames admissionais/demissionais e serviços de SST são compras ou despesas reais, não provisões automáticas. O cálculo é gerencial para conferência antes da emissão. Não altera vínculo, ponto, folha fechada, pagamento ou DRE realizado.

<a id="guia-cliente_administracao_equipe"></a>

## Cliente · Administração e equipe

Conferir a taxa do contrato e todos os custos dos funcionários repassados ao cliente, incluindo as reservas trabalhistas.

### Antes de começar

Confira a obra, a liberação da área e o mês. Nomes e valores individuais exigem perfil autorizado e liberação explícita da equipe.

### Como fazer

1. Abra Administração e equipe em Custos e compras. Escolha Mês da consulta; mês em andamento considera os registros até a data indicada.
2. Confira Administração a emitir, Taxa do contrato e Já emitido como administração. Abra Como chegamos ao valor para conferir a base registrada e a reserva adicional. O valor a emitir é uma estimativa para conferência; a consulta não cria cobrança.
3. Leia Custos da equipe para repasse. O custo reconhecido já contém os encargos e provisões do ERP. Encargos complementares e reserva adicional para repasse consideram somente a diferença positiva entre a reserva mensal rateada e a reserva já incluída; o repasse previsto inclui esses complementos sem somar a mesma reserva duas vezes.
4. Em Detalhes da equipe, escolha Folha detalhada, Provisionamentos ou Folha de ponto. Use Buscar funcionário ou função e Ver detalhes no nome desejado. No celular, use o seletor Detalhes da equipe.
5. Na Folha detalhada, confira remuneração, benefícios, encargos, custo, reserva adicional e repasse previsto. Líquido de folha fechada só aparece quando houver fechamento e rateio para a obra; não confirma pagamento.
6. Em Provisionamentos, confira 13º, férias e adicional de um terço, FGTS, multa e outras reservas. O modelo de repasse usa a remuneração apropriada no período. Reservas individuais cadastradas por mês seguem o rateio entre obras; no mês em andamento os valores podem mudar. Funcionário não incluído na reserva ou sem base precisa de conferência no ERP.
7. Na Folha de ponto, confira os dias, a situação, os horários e as horas extras vinculados à obra. Horário vazio não é jornada cumprida.
8. Na seção Prestação de contas em PDF, use Baixar prestação de contas para receber o PDF do mês consultado. Em Financeiro, o relatório usa o mês atual. O documento separa gastos registrados, pagamentos, reservas, administração, cobranças emitidas, extrato e notas fiscais liberadas.
9. Compartilhar PDF abre o compartilhamento do aparelho, quando disponível. Escolha o WhatsApp e confira a conversa. No computador sem compartilhamento de arquivos, o PDF é baixado para anexar manualmente. Preparar e-mail com PDF baixa um rascunho com anexo e remetente previsto financeiro@marcelleng.com.br; abra na conta correta, confira o destinatário e conclua o envio no aplicativo de e-mail.

### Como conferir se deu certo

A taxa usa as categorias do contrato. Quando a mão de obra integra a base, a reserva adicional também compõe a base prevista. Todos os custos reconhecidos da equipe, inclusive rescisões e históricos sem detalhe, permanecem no repasse.

### O que merece atenção

Base incompleta aparece Em apuração, sem presumir zero. Encargos complementares e reserva adicional são previsões de cobrança, sem criar custo reconhecido ou pagamento no DRE. EPI e exames de admissão/demissão seguem as compras ou despesas reais da obra; não são incluídos novamente na reserva. Valor emitido não equivale a recebido, líquido fechado não equivale a pago e repasse da equipe não deve ser confundido com a taxa de administração. A consulta não altera folha, ponto, provisões ou contrato. Motivos médicos, CPF, PIX e dados de outras obras não são publicados. Confira a data de consulta indicada no PDF. No mês atual, o saldo do caixa considera os movimentos até o dia da consulta no calendário da Bahia. Um aporte futuro entra no saldo quando chega sua data; por isso, relatórios gerados em dias diferentes podem ter saldos diferentes. O anexo de Preparar e-mail com PDF segue a mesma regra. Gerar o documento não altera os lançamentos nem o DRE. Nenhuma cobrança ou mensagem é enviada automaticamente nesta revisão local. O WhatsApp do financeiro é (81) 98975-1300. Reservas são previsões, não pagamentos. O extrato usa os saldos originais e a data efetiva dos movimentos. Notas originais continuam em Compras e notas fiscais no portal autenticado; o PDF não incorpora os originais. O rascunho de e-mail é endereçado ao próprio usuário conectado. Se o custo não estiver liberado ou estiver em conferência, o download é bloqueado.

<a id="guia-cliente_financeiro"></a>

## Cliente · Contrato e recebimentos

Consultar o resumo contratual compartilhado.

### Antes de começar

Confira a obra e as condições do contrato.

### Como fazer

1. No Início, use Ver contrato e recebimentos junto à cobrança, ou escolha Financeiro em Documentos, contrato e conta.
2. Na tela Contrato e recebimentos, confira Percentual acumulado do contrato e Valor correspondente. Em Quinzena a pagar, confira valor emitido, recebido e vencimento. Compare depois o resumo contratual e as medições.
3. Leia as medições e os recebimentos publicados. Data do recebimento indica quando o valor foi recebido, não o vencimento da parcela. Contrato por valor e Medição por valor, sem percentual informado explicam a ausência do percentual. Parcela sem vencimento permanece no saldo, com data A confirmar; um recebimento excedente de outra parcela não quita esse saldo automaticamente. O período aparece por mês e ano em português e os percentuais têm até duas casas decimais; os valores de origem permanecem os mesmos. Percentual contratual informado é o percentual da medição de cobrança, distinto do avanço físico.
4. Na seção Prestação de contas em PDF, use Baixar prestação de contas para receber o PDF do mês consultado. Em Financeiro, o relatório usa o mês atual. O documento separa gastos registrados, pagamentos, reservas, administração, cobranças emitidas, extrato e notas fiscais liberadas.
5. Compartilhar PDF abre o compartilhamento do aparelho, quando disponível. Escolha o WhatsApp e confira a conversa. No computador sem compartilhamento de arquivos, o PDF é baixado para anexar manualmente. Preparar e-mail com PDF baixa um rascunho com anexo e remetente previsto financeiro@marcelleng.com.br; abra na conta correta, confira o destinatário e conclua o envio no aplicativo de e-mail.

### Como conferir se deu certo

O resumo corresponde ao que a equipe publicou para o contrato.

### O que merece atenção

Esta consulta é diferente de Gastos por categoria. Valor correspondente = contrato vigente × percentual acumulado da última medição percentual emitida; não equivale ao saldo a pagar. A cobrança e o resumo usam os recebimentos ativos até o dia da consulta no calendário da Bahia. Recebimentos futuros ou cancelados não reduzem o saldo atual. Sem vínculo com data de vencimento, a equipe deve conferir a medição. Não some parcelas contratuais com despesas. Nenhuma aprovação formal ou pagamento é executado pelo portal. Confira a data de consulta indicada no PDF. No mês atual, o saldo do caixa considera os movimentos até o dia da consulta no calendário da Bahia. Um aporte futuro entra no saldo quando chega sua data; por isso, relatórios gerados em dias diferentes podem ter saldos diferentes. O anexo de Preparar e-mail com PDF segue a mesma regra. Gerar o documento não altera os lançamentos nem o DRE. Nenhuma cobrança ou mensagem é enviada automaticamente nesta revisão local. O WhatsApp do financeiro é (81) 98975-1300. Reservas são previsões, não pagamentos. O extrato usa os saldos originais e a data efetiva dos movimentos. Notas originais continuam em Compras e notas fiscais no portal autenticado; o PDF não incorpora os originais. O rascunho de e-mail é endereçado ao próprio usuário conectado. Se o custo não estiver liberado ou estiver em conferência, o download é bloqueado.

<a id="guia-cliente_documentos"></a>

## Cliente · Documentos da obra

Consultar documentos liberados individualmente.

### Antes de começar

Confira a obra e seu acesso a documentos.

### Como fazer

1. Em Documentos, contrato e conta, escolha Documentos.
2. Confira o nome, a versão e a data de publicação.
3. Use Abrir documento publicado para consultar o original.

### Como conferir se deu certo

O original abre em outra aba quando o endereço está disponível.

### O que merece atenção

Um arquivo pode exigir acesso ao provedor ou ter endereço expirado. Peça à equipe a liberação; não compartilhe links ou credenciais de outra pessoa.

<a id="guia-cliente_decisoes"></a>

## Cliente · Decisões e alterações

Acompanhar decisões e alterações contratuais publicadas.

### Antes de começar

Confira a obra e os documentos do contrato.

### Como fazer

1. Em Documentos, contrato e conta, escolha Decisões.
2. Leia a situação, os prazos e os impactos informados.
3. Combine a aprovação formal com a equipe pelo canal previsto no contrato.

### Como conferir se deu certo

O conteúdo disponível foi compartilhado para seu acompanhamento.

### O que merece atenção

O portal não confirma decisões nem grava aditivos. Consultar não equivale a aprovar, medir ou pagar.

<a id="guia-cliente_transparencia"></a>

## Cliente · Consulta de transparência

Consultar a rota anterior de caixa e suprimentos.

### Antes de começar

Confira a obra e as áreas liberadas.

### Como fazer

1. Abra a consulta de transparência quando receber um endereço dessa área.
2. Escolha Caixa da obra, Compras, Cotações ou Notas fiscais.
3. Confira os registros e use as novas abas do portal para o acompanhamento diário.

### Como conferir se deu certo

Somente os dados permitidos ao seu perfil aparecem.

### O que merece atenção

Acesso à consulta não concede autorização para operar. Compras, custos e pagamentos são fatos distintos.

<a id="guia-cliente_conta"></a>

## Cliente · Alterar senha e sair

Trocar sua senha individual e encerrar o acesso.

### Antes de começar

Tenha a senha atual e prepare uma nova senha com pelo menos 12 caracteres, letras e números.

### Como fazer

1. Em Documentos, contrato e conta, escolha Minha conta.
2. Preencha Senha atual, Nova senha e Confirmar nova senha.
3. Use Alterar senha. Após a confirmação, use Entrar novamente e informe a nova senha. Para encerrar sem trocar, use Sair do portal no cabeçalho.

### Como conferir se deu certo

A troca encerra todas as sessões da conta.

### O que merece atenção

A senha não fica salva como preferência do app. Se esqueceu a senha atual, solicite a redefinição ao administrador. Revogação do acesso também exige um novo vínculo autorizado.

<a id="guia-cliente_acessos"></a>

## Administrador · Login e senha dos clientes

Cadastrar, redefinir e revogar o acesso individual ao portal.

### Antes de começar

Entre como administrador e confira a obra e a pessoa que receberá o acesso.

### Como fazer

1. Abra Central do Administrador e escolha Acessos de clientes.
2. Selecione Obra do cliente. Preencha E-mail de login, Telefone do cliente, Perfil de acesso do cliente e Senha inicial ou nova senha.
3. Use Salvar acesso do cliente e, após a confirmação, Copiar convite do cliente. Compartilhe o convite somente com o destinatário correto.
4. Para alterar, use Editar acesso e senha, informe a nova senha e salve. Revogar acesso abre a confirmação para encerrar o vínculo da obra e as sessões.

### Como conferir se deu certo

O cliente entra pelo endereço do portal e consulta somente as obras vinculadas e as áreas liberadas.

### O que merece atenção

Não há envio automático de convite nem criação de usuário interno do ERP. O mesmo e-mail usa uma conta entre obras; redefinir a senha vale para todas elas e encerra as sessões. A senha do convite é transitória e é apagada da tela após copiar ou mudar a obra. Criar acesso não publica dados. Para liberar conteúdo, use Portal do cliente dentro da obra.

<a id="guia-conc_reverter"></a>

## Conciliação · Reversão de importações bancárias

Retirar pendências importadas sem apagar o original ou desfazer operações já utilizadas.

### Antes de começar

Confirme a conta e o arquivo. Novos extratos guardam o original, até 2 MB. Legados sem original e manifesto exigem revisão; demais origens de importação não são revertidas nesta etapa.

### Como fazer

1. Em Conciliação, abra Mais opções · extratos, regras e histórico e escolha Extratos.
2. No arquivo, use Revisar reversão. Confira cada resultado: Reversível ou motivo de proteção. Use Baixar original para conferir o arquivo preservado.
3. Administrador sem restrição de obra informa Justificativa da reversão e marca Conferi os movimentos reversíveis e os protegidos. Financeiro pode consultar, mas não confirmar.
4. Use Reverter, que informa a quantidade de movimentos, para confirmar somente os elegíveis. O servidor confere novamente versões, referências e períodos. Se a base mudou, use Atualizar prévia e confira a seleção. Falha preserva a justificativa; repetir a mesma confirmação conserva a chave da tentativa.

### Como conferir se deu certo

Os elegíveis recebem cancelamento auditável; usados permanecem intactos. O lote mostra Revertida ou Reversão parcial. Originais e Histórico permanecem disponíveis.

### O que merece atenção

Movimentos pagos, conciliados, vinculados, com histórico de uso, alterados ou em período fechado não são revertidos. A conciliação automática pode já ter utilizado movimentos após importar. A reversão não estorna custo, receita ou pagamento no DRE; apenas retira pendências sem uso. Não libera reimportação duplicada: as chaves originais são mantidas. Fechar com justificativa não salva pede decisão sobre descartar; consultar e baixar não gravam operações.

<a id="guia-orc_estrutura"></a>

## Orçamento · Hierarquia de seis níveis

Conferir seis níveis de etapas.

### Antes de começar

Confira obra e versão; aprovados exigem revisão. Na planilha, pais vêm antes dos filhos.

### Como fazer

1. Em Mais ações da etapa → Criar subnível, confira o destino. O sexto é o último e seus serviços podem ter sete partes na numeração.
2. Para mover, use Editar nome e posição, Etapa superior e Posição na lista. Itens e descendentes vão juntos. O ERP recusa ciclos e excesso de níveis.
3. Em Análises e ferramentas → Ferramentas do orçamento → Importar planilha, confira as colunas sugeridas da primeira aba. Mapeie o custo sem BDI, o percentual, o preço com BDI e o total quando existirem. Em Formato do BDI numérico, confira se 22,12 ou 0,2212 representa 22,12%.
4. Abra Hierarquia da planilha e confira as etapas. Use Filtrar conferência para ver divergências, dados faltantes ou pendências. Procure pela linha, código ou descrição. Use Rever colunas para ajustar o mapeamento.
5. Compare Valores originais, Recálculo do Excel e Referência e importação. O total da seleção usa o BDI do orçamento. Quando houver fonte na planilha, a referência deve corresponder à fonte e ao código. Preço indisponível ou unidade incompatível deixa o custo a importar pendente.
6. Confira se quer incluir as linhas com pendência e se vai somar ou substituir o conteúdo. Use Importar para confirmar ou Cancelar para sair da prévia. Uma falha mantém a prévia aberta.

### Como conferir se deu certo

Hierarquia preservada; itens totalizados uma vez.

### O que merece atenção

A prévia não grava orçamento. A importação cria uma previsão na versão editável e não gera lançamento no DRE. Não some pais e filhos. Antes de substituir, confira vínculos de cronograma e compras. A numeração da linha é independente do código SINAPI ou ORSE. Quando o Excel não tem BDI suficiente para o recálculo, o valor fica indisponível.

<a id="guia-orc_revisoes"></a>

## Orçamento · Comparar revisões

Explicar a variação do orçamento e identificar quais serviços mudaram.

### Antes de começar

Abra um orçamento que tenha outra revisão disponível no mesmo histórico.

### Como fazer

1. Abra Dados e versões e selecione Comparar revisões.
2. Selecione Versão de referência e Versão comparada. Confira o nome, o número e a situação de cada uma.
3. Leia os totais e os impactos por quantidade, preço, BDI e escopo. Use Filtrar mudanças ou procure pelo código, serviço ou etapa. Identidade a conferir indica que a linha precisa de revisão antes de atribuir o impacto a um serviço.

### Como conferir se deu certo

A variação é o total da versão comparada menos o total da referência. Em cada linha, a tela mostra os dados das duas versões e os valores atribuídos a cada mudança.

### O que merece atenção

Quando as linhas correspondem, o cálculo aplica quantidade, depois preço e depois BDI. Trocas de unidade ou referência, inclusões, retiradas e exclusões de escopo usam o impacto líquido da mudança. Itens sem identificação única exigem revisão. Confira o aviso Total parcial antes de interpretar os valores. Consultar a comparação não altera a versão aprovada nem movimenta o DRE.

<a id="guia-cliente_conexao_financeiro"></a>

## Conexão local do financeiro

Preparar e verificar o e-mail e o WhatsApp usados na prestação de contas.

### Antes de começar

Tenha acesso à caixa financeiro@marcelleng.com.br no aplicativo Lark. Não informe senhas no chat.

### Como fazer

1. Na tela local Conexão do financeiro, confira o remetente, o servidor e a porta.
2. No aplicativo Lark, gere uma senha dedicada para cliente de e-mail e informe-a no campo Senha dedicada do Lark. Se a caixa for compartilhada ou um alias, confira com o administrador como obter sua credencial própria.
3. Use Verificar e guardar conexão. A autenticação usa conexão criptografada e não envia mensagens. A senha é guardada cifrada pelo Windows, fora do projeto, somente após autenticar.
4. Confira a situação do WhatsApp e use Simular os dois canais. A simulação usa destinatário fictício e inclui o PDF; repetir não gera um novo envio.

### Como conferir se deu certo

A tela confirma a configuração guardada ou explica a falha. A simulação apresenta zero mensagens enviadas.

### O que merece atenção

Configuração guardada registra a última autenticação bem-sucedida e não garante disponibilidade futura ou entrega. Esta tela não ativa agendamento ou disparos reais, não emite cobrança, não modifica os dados da obra ou o DRE e não altera a automação de ponto dos funcionários. Abertura da ajuda preserva o formulário. Verificar conexão não comprova que o provedor autoriza todos os destinatários.

<a id="guia-arquivos_exclusao"></a>

## Arquivos · Exclusão e lixeira

Excluir um ou vários documentos da central e enviar todas as revisões à lixeira do OneDrive, mantendo o histórico e as permissões.

### Antes de começar

Confira a obra, a pasta, o documento e todas as revisões. É necessário ter permissão de edição. Documentos dos módulos e documentos preservados em contratos comerciais exigem tratar o vínculo na origem.

### Como fazer

1. Para excluir vários, marque a caixa ao lado de cada nome. Selecionar disponíveis marca somente os documentos exibidos com permissão de edição. O nome continua abrindo os detalhes; não marca a caixa. Ao trocar pasta, busca ou origem, a seleção é limpa para evitar excluir documentos ocultos.
2. Use Excluir selecionados e confira os nomes, as pastas, a obra e o total de revisões. Cancelar não inicia a operação. Excluir documentos confirma o lote.
3. Aguarde o Resultado da exclusão. A lista informa o resultado de cada documento. Se houver falha, use Tentar os não concluídos; os concluídos não são repetidos. Se os dados mudaram ou a conexão caiu, feche, use Atualizar e confira novamente.
4. Para excluir apenas um, abra o documento da central e use Excluir documento.
5. Na confirmação, confira o nome, a obra, a pasta e a quantidade de revisões. Cancelar fecha sem iniciar; Excluir documento confirma todas as revisões.
6. Aguarde a confirmação. Se aparecer Exclusão pendente, use Concluir exclusão; essa ação também está disponível após recarregar.
7. Consulte Histórico de organização da obra para verificar quem solicitou e concluiu a exclusão.

### Como conferir se deu certo

Cada documento sai da lista somente após confirmar todas as suas revisões. O histórico, as permissões e os demais documentos permanecem. Um lote pode ter documentos concluídos e outros ainda pendentes.

### O que merece atenção

Falha pode deixar parte dos arquivos na lixeira. Cancelar uma confirmação pendente apenas fecha a janela. Links externos são removidos apenas da central. Revisão compartilhada ou sem identificação segura bloqueia a exclusão; confira a origem. Recuperar um arquivo na lixeira do OneDrive não restaura seu cadastro na central. A operação não altera contratos, despesas, estoque, custo reconhecido ou pagamentos.

<a id="guia-terc_rascunho"></a>

## Terceirizados · Recuperar medição

Continuar uma medição neste aparelho sem confundir rascunho e confirmação do servidor.

### Antes de começar

Use a mesma conta, obra, contrato e navegador. Fotos precisam ser enviadas com conexão; o rascunho conserva as referências das que já chegaram.

### Como fazer

1. Escolha o Contrato em Medições e use Nova medição, ou abra a correção da medição rejeitada.
2. Preencha os percentuais acumulados e a Observação. Aguarde Rascunho salvo neste aparelho. Cancelar fecha e conserva o rascunho; ao reabrir o mesmo contrato ele é recuperado.
3. Se faltar armazenamento, mantenha a tela aberta e use Tentar salvar rascunho. Fechar fica bloqueado enquanto não for possível proteger o preenchimento.
4. Se a base da medição mudou, confira o conteúdo preservado e o contrato. Para começar pela base atual, use Descartar rascunho, confirme o descarte e reabra Nova medição.
5. Ao enviar, aguarde a confirmação. Se a resposta se perder, os campos ficam protegidos e Repetir confirmação reenvia a mesma tentativa; se ela já foi aceita, retorna a confirmação sem duplicar a medição. Recarregar ou reconectar não envia esta confirmação automaticamente.
6. Se aparecer erro de sessão ou acesso, entre novamente com a conta original e confira as permissões antes de retomar. Uma medição já confirmada não é recriada a partir do rascunho.

### Como conferir se deu certo

Percentuais, observação, data e referências das fotos enviadas reaparecem neste navegador. Apenas a confirmação do servidor cria ou corrige a medição.

### O que merece atenção

O rascunho não aparece em outro aparelho e não reconhece custo no DRE. Apagar os dados do navegador remove rascunhos. Descartar rascunho não exclui fotos já enviadas ao OneDrive. Uma falha parcial do lote preserva as fotos que chegaram; confira antes de reenviar arquivos. Rascunho local não substitui backup nem permite enviar fotos sem conexão. A nova medição precisa avançar: reduzir o acumulado não cria estorno e bloqueia a confirmação. Para corrigir um registro anterior, confira as opções de correção ou cancelamento nele, conforme seu perfil e as regras do período.

<a id="guia-conc_apagar_local"></a>

## Apagar conciliação na simulação local

Retirar extratos, movimentos e valores criados pela conciliação de uma conta, somente na cópia local.

### Antes de começar

Entre como administrador sem restrição de obra. Confira Simulação local e Empresa. A conta deve pertencer à empresa; Movimentos sem conta é o grupo dos registros ainda sem conta definida.

### Como fazer

1. Abra Conciliação e expanda o apoio com Extratos.
2. Na conta, use Apagar conciliação e valores. Para o grupo sem cadastro de conta, use Apagar conciliação dos movimentos sem conta.
3. Confira os extratos, movimentos, valores gerados e impacto no DRE apresentados na prévia. Valores já existentes permanecem e recebem somente a retirada do vínculo.
4. Preencha Justificativa da limpeza, digite exatamente o nome solicitado e marque Conferi os valores e autorizo apagar somente na cópia local.
5. Use Apagar na cópia local e aguarde a confirmação. Cancelar preserva os dados; campos preenchidos recebem proteção contra saída sem salvar.

### Como conferir se deu certo

A cópia deixa de apresentar os movimentos e extratos selecionados, seus vínculos e os valores comprovadamente criados pela conciliação. O cadastro da conta permanece. Uma cópia anterior à limpeza fica preservada fora da área operacional.

### O que merece atenção

Apagar custos gerados reduz o custo no DRE; apagar recebimentos de caixa não reduz automaticamente receita reconhecida. A operação não apaga pagamentos ou documentos preexistentes que foram apenas vinculados. Período fechado, vínculo parcial, transferência com outra conta, origem ambígua ou dependência nativa impedem a limpeza automática. Atualização concorrente exige nova prévia. A opção está restrita à simulação local; não altera a nuvem nem apaga os arquivos originais. A conciliação automática permanece pausada e não pode ser retomada nesse ambiente.

## Aparência, botões e navegação

### Arquivos privados por empresa

Antes de abrir fotos ou anexos, confira Empresa no cabeçalho. Capas e anexos das áreas do ERP abrem o arquivo com o acesso do seu perfil, sem gravar um link público. Documentos do OneDrive são lidos pela sessão do ERP; não compartilhe links internos antigos. O dossiê e o relatório técnico conferem os arquivos antes de preparar a impressão. A troca de empresa ou usuário retira a imagem anterior enquanto o novo acesso é conferido. Se aparecer imagem indisponível, confira a empresa e a obra e tente abrir novamente; peça ao administrador a conferência do vínculo se o problema continuar. O PDF do diário só é preparado depois de conferir o acesso às fotos. Links temporários podem expirar: abra o arquivo novamente pelo ERP. Abrir uma imagem não cria custo, pagamento ou lançamento no DRE.

### Responsável técnico por empresa

Antes de conferir o responsável de uma obra, confira Empresa no cabeçalho. O responsável precisa ter um perfil de engenheiro ativo e autorizado nessa empresa, com o mesmo cadastro já vinculado à obra. Se ele não aparecer, peça ao administrador a conferência do vínculo; não crie outra pessoa nem escolha alguém apenas pelo nome parecido. O mesmo profissional pode estar autorizado nas duas empresas, com obras e dados consultados separadamente. Esse vínculo não cria custos, pagamentos ou valores no DRE.

### Simular a aplicação da separação

Quando aparecer Simulação local, os dados pertencem a uma cópia privada por empresa. Confira Empresa antes de consultar. I-8 e BASE DE DADOS usam diretórios locais independentes, e as fotos preparadas abrem somente pelo acesso privado da revisão. As pastas mostram sua estrutura; documentos do OneDrive sem bytes locais continuam indisponíveis. Nesta simulação, somente Apagar conciliação e valores pode gravar mudanças na cópia; os demais envios e as conexões com a nuvem permanecem bloqueados. Nenhum banco, pasta, foto ou valor do ERP publicado é alterado.

### Arquivos e integrações por empresa

Confira Empresa antes de abrir documentos, conectar o OneDrive ou operar backups. Cada empresa precisa de uma pasta raiz própria, com os acessos conferidos pelo administrador. Estar no mesmo drive não significa que o arquivo pertence à empresa selecionada. Se a conexão ou a pasta estiver indisponível, peça a conferência do vínculo; trocar a empresa não transfere arquivos nem concede acesso à pasta da outra construtora. Um backup de outra empresa é recusado mesmo que o arquivo esteja íntegro. Na revisão somente para consulta, apenas os arquivos copiados e conferidos podem abrir; links externos, conexões e gravações permanecem bloqueados. A simulação de aplicação é identificada separadamente e permite somente a limpeza de conciliação da cópia local. As fotos antigas públicas exigem preparação de armazenamento privado antes da ativação definitiva.

### Escolher a empresa de trabalho

Após a separação ser ativada e conferida neste ambiente, o cabeçalho mostra Empresa. Como administrador, escolha ARCD ou MRC. Aguarde a troca e confira a empresa no cabeçalho antes de cadastrar, consultar ou lançar. K1-10 e I-8 pertencem à MRC; as demais obras existentes pertencem à ARCD. I-8 é o nome cadastrado da obra também referida como I1-08. Os registros anteriores sem vínculo com obra permanecem na ARCD; novos registros pertencem à empresa selecionada. Conclua ou descarte formulários e resolva os envios pendentes antes de trocar. Se o acesso ou a migração estiver indisponível, a empresa atual é preservada. Se uma edição antiga contiver obra de outra empresa, atualize os dados no contexto correto antes de continuar. A troca abre uma nova área de trabalho; as consultas e a recuperação de edições ficam separadas por empresa. O DRE considera somente a empresa selecionada; trocar a empresa não cria custos, títulos ou pagamentos.

### Conferir a logomarca dos relatórios

Em Identidade do relatório, confira a prévia da logomarca MARCELL e use Gerar relatório. Cancelar mantém os filtros.

### Ajustar o menu lateral

No computador, arraste a borda direita do menu. Pelo teclado, use Tab para chegar à borda, setas para ajustar e Home/End para os limites. Enter ou duplo clique restaura a largura inicial. Minimizar menu lateral conserva o ajuste ao expandir. A preferência fica neste navegador e vale em todos os módulos, sem alterar dados. No celular, use a navegação inferior e Mais.

### Leitura de PDF

Ao fechar a visualização de um PDF em carregamento, a transferência é cancelada. Para tentar novamente, reabra o documento. Se o leitor apresentar erro, confira o acesso ao arquivo e use o link do documento original quando disponível. Consultar o arquivo não aprova a nota nem confirma pagamento.

### Carregamento de telas

Na entrada e nas áreas internas, o indicador pode não aparecer em aberturas rápidas. Aguarde sem repetir a ação; carregar não confirma gravação. Em caso de erro, siga a orientação da tela. Fechar permite cancelar a preparação de um diálogo.

### Cadastro pelo ponto

Em Equipes, Ponto por obra e Gestão do ponto, o nome abre o cadastro para RH e administradores; outros perfis abrem o PDF. Na lista de Equipes, o valor abaixo do nome é uma informação separada do botão; outros perfis continuam sem acesso aos valores trabalhistas. Confira Vínculo e desligamento no início do cadastro. Corrija o ponto pela célula do dia, sem limpar a linha inteira.

### Arquivos de obra e orçamento

Use Importar planilha para escolher o arquivo Excel e Selecionar PDF na leitura estrutural do Orçamento. No Diário de obra, use Selecionar áudio, Selecionar anexo ou Usar câmera. Na Conferência, use Usar câmera ou Selecionar fotos. O navegador pode oferecer câmera ou arquivos conforme o dispositivo. Confira a obra, o tipo de arquivo e o resultado apresentado antes de continuar.

### Documentos do funcionário

No prontuário, escolha a categoria e as datas, use Selecionar documento do prontuário e confira o arquivo. Use Salvar documento para concluir o envio. Essa escolha não altera o vínculo, o ponto ou a folha do funcionário.

### Editar a planilha do orçamento

Nas células de texto, Enter confirma a edição e Escape descarta o texto que ainda está sendo editado. Descrições longas podem ocupar mais de uma linha. Confira a versão, a etapa e a unidade antes de alterar quantidades ou preços. Use os controles da barra para escolher a consulta; não confunda a seleção de uma linha com salvar uma alteração.

### Exportar a fila de Compras

Na Fila de trabalho, use Exportar para Excel na barra de comandos, também no celular. A planilha acompanha a busca, os filtros e a obra da consulta. Confira o recorte antes de baixar; exportar não altera os registros.

### Selecionar anexos pelo teclado

Use Selecionar arquivo, Selecionar imagens e documentos ou Selecionar comprovante, conforme a tela. Os botões também funcionam com Tab e Enter. Confira o nome, os formatos e o limite indicados antes de salvar; escolher um arquivo não confirma pagamento nem aceita uma sugestão da IA.

### Usar a barra de comandos

Em Compras, escolha Obra, preencha Buscar na fila e ajuste Visualização ou Filtros na mesma barra que reúne Exportar para Excel, Nova solicitação e Mais ações de Compras. Os indicadores abaixo filtram prioridades e mostram quantidades e valores; Atenção ao prazo significa hoje e próximos três dias. Em Financeiro, Hoje reúne Obra, Movimentação e Visualização; no celular, Fila de vencimentos fica nessa barra. Em Pagamentos, a barra reúne Obra, Situação, Pesquisar pagamentos, Ver notas fiscais e Receber documento fiscal. Em Caixa por conta, escolha Obra e Conta bancária do caixa na barra; Abrir fila de revisão assistida permanece disponível. Em Documentos, use Obra, Competência ou mês de emissão, Pesquisar documento ou fornecedor e Conferência junto a Receber documento fiscal. Os nomes dos registros abrem a ficha; use a próxima ação para operar. As áreas continuam disponíveis junto ao título no computador e no seletor no celular. A barra se reorganiza em linhas nas telas menores; filtros, valores e permissões são preservados.

### Reconhecer o padrão das telas

O cabeçalho mostra a finalidade da tela e as ações principais. Confira a obra, o período e os filtros antes de usar a lista. As abas ou o seletor de visão trocam a consulta; abrir uma ajuda ou mudar o tema preserva os valores informados. No celular, os filtros ficam um abaixo do outro e tabelas largas têm sua própria rolagem.

### Comparar propostas na prévia local

Na página separada Estudo de Compras, use Precisão, Obra, Foco ou Mesa de trabalho para comparar a organização visual. Como comparar explica as diferenças. A troca preserva os filtros e a tela aberta; não escolhe um tema definitivo. Os dados da prévia são fictícios. Em Mesa de trabalho, o seletor Menu compara a lateral clara com a azul-marinho. O estudo altera apenas a prévia local e mantém as ações existentes. Os atalhos 1 a 4 funcionam quando o foco está fora do ERP. O botão Ajuda continua disponível dentro da tela.

### Escolher a aparência

Use o botão Alterar aparência, identificado pelo ícone de paleta no cabeçalho, para escolher MARCELL Operacional, MARCELL Claro, MARCELL Preciso, MARCELL Vidro, MARCELL Noite ou MARCELL Cristal e ajustar a densidade. MARCELL Noite tem fundo azul-escuro e ações em dourado; MARCELL Cristal é claro. Os dois usam um leve gradiente da marca ao fundo e caixas translúcidas; com "reduzir transparência" ligado no sistema, as caixas ficam sólidas. Impressão e PDF saem sempre claros. MARCELL Vidro usa superfícies translúcidas; no portal do cliente, inclui uma residência ilustrativa ao fundo. O portal usa esse tema sem substituir a preferência de aparência do ERP. O padrão é MARCELL Preciso com densidade Compacta: menu azul-marinho, conteúdo claro e ações em azul. A fonte é Inter. Compacta reduz espaços e preserva o toque no celular. Em todo o ERP, campos de uma linha e botões comuns seguem a densidade escolhida, com rótulos alinhados. Áreas de observação e células de planilha conservam o espaço necessário. A preferência fica neste navegador; a troca mantém seus filtros e dados.

### Identificar a área selecionada

A área atual recebe destaque visual. Na navegação de Compras e Financeiro, o botão selecionado tem fundo e borda destacados. Clique em outra área para abri-la. Você também pode usar Tab para chegar ao botão e Enter para acioná-lo. O contorno de foco indica qual controle receberá a ação do teclado.

### Encontrar consultas e opções adicionais

No computador, Consultas e cadastros em Compras e Mais áreas no Financeiro abrem opções complementares. Clique novamente ou use Escape para recolher o menu. No celular, use o seletor de áreas do módulo.

### Acessar outros módulos no celular

Use Mais, na barra inferior, para abrir Mais módulos. Escolha o módulo desejado. O seletor abaixo dos botões do cabeçalho mostra a tela atual. Ele é anunciado como Telas de, seguido do nome do módulo atual, e permite trocar de área dentro desse módulo. Nas telas mais estreitas, Finanças abre o Financeiro. No celular, Mais também mostra a conta e Sair do sistema. Fechar menu ou Escape retorna à tela atual sem trocar a área de trabalho. A recuperação protege formulários e os atalhos de navegação continuam disponíveis.

### Usar os filtros

Mantenha a obra e o período corretos. O botão Filtros abre as opções adicionais, preservando os valores ao recolher. Limpar filtros remove o recorte informado na lista.

### Conferir o salvamento

Após falha, use Resolver salvamento no aviso da página ou no formulário aberto. Aguarde a confirmação; não é preciso fazer outra edição. Sem conexão, mantenha a aba aberta até reconectar: use Resolver salvamento para revisar edições protegidas após recarga. Sessão, acesso e conflito exigem seguir o motivo; copie edições antes de sair. Para pagamentos e recebimentos, use Retomar trabalho salvo.

### Gráficos operacionais

Os gráficos mostram os dados completos assim que ficam disponíveis, sem aguardar animação de entrada. Valores, séries e rótulos continuam disponíveis.

### Consultar cuidados da ajuda

Na ajuda da tela, abra Cuidados, permissões e recuperação para conferir restrições e como retomar uma tentativa. Abrir ou fechar essa orientação preserva a tela e não grava registros.

### Falha de carregamento ou conexão

Se aparecer Sem conexão para abrir esta tela, restabeleça a rede. Recarregar fica habilitado ao reconectar; nenhuma confirmação é enviada por esse botão. Depois de recarregar, confira o resultado da ação e reabra os rascunhos já salvos antes de repetir. Em uma falha de versão, pode haver uma recarga automática por versão carregada; se persistir, use Copiar diagnóstico e peça ajuda.

## Celular, interrupções e recuperação

### Área reduzida no celular

Role dentro do formulário para alcançar os próximos campos e a confirmação. O diálogo acompanha a área visível quando o teclado reduz a tela. Fechar a ajuda ou uma confirmação não deve encerrar a edição principal.

### Sair com alterações pendentes

Na ficha fiscal, no pagamento, na correção do fechamento e nos formulários protegidos de Compras, escolha Continuar editando para manter o preenchimento. Descartar alterações encerra a edição. Recarregar ou fechar a aba pode pedir confirmação do navegador; o rascunho não é salvo como preferência.

### Conexão perdida ou consulta indisponível

Conserve a tela aberta. Leia a mensagem e use Consultar versão atual quando disponível. Se a consulta também falhar, tente novamente após recuperar a conexão. O retorno da internet não confirma uma operação financeira por conta própria.

### Sessão expirada

Use a renovação da mesma conta dentro da edição quando oferecida. Depois, consulte a versão atual e revise os dados antes da confirmação. A senha é transitória e não fica salva no rascunho.

### Não sei se o servidor confirmou

Consulte a versão atual antes de repetir. Se houver confirmação recebida pelo recibo, aplique-a; não crie outro registro. Documento ausente exige conferir a origem e o acesso, sem inventar uma evidência.

## Dúvidas comuns

### Não encontrei um botão ou registro

As ações dependem do seu perfil e da situação do registro. Confira a obra, o período, a busca e os filtros. Se necessário, peça ao administrador para conferir seu acesso.

### Não sei se foi salvo

Confira o indicador de salvamento e a mensagem da ação. Leia erros ou conflitos antes de repetir. Abra o registro novamente para conferir o resultado e evitar duplicidade.

## Glossário

- **Competência:** Mês de referência de uma receita ou custo, que pode ser diferente do mês em que o dinheiro entrou ou saiu.
- **DRE:** Demonstração do Resultado: compara receitas, custos e despesas de um período.
- **Conciliação:** Conferência que relaciona uma linha do extrato bancário a um registro do sistema.
- **RDO:** Relatório Diário de Obra: registro das atividades e ocorrências de um dia.
- **Lead:** Pessoa ou empresa que pode se tornar cliente.
- **Pipeline ou funil:** Sequência de etapas pelas quais uma oportunidade comercial passa.
- **FVS / FVM:** Fichas de Verificação de Serviço e de Material, usadas na conferência de qualidade.
- **Linha de base:** Versão de referência do planejamento para comparar o previsto com o realizado.
- **Curva A:** Grupo de itens de maior peso financeiro, que merece atenção prioritária.
- **Lotação:** Obra à qual o funcionário está vinculado administrativamente; pode ser diferente da obra de captura do ponto.
