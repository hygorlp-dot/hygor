# Manual de uso do app MARCELL

Revisão do conteúdo: 12/11/2026.

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
- [Contratos](#guia-com_contratos)
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
- [Relatórios de batidas e banco de horas por obra](#guia-ponto_relatorios_obras)

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

Cenários ficam na sessão aberta deste usuário; recarregar a página ou sair do sistema os descarta. Exporte a memória antes de fechar. Não criam títulos, pagamentos ou contratações. Dados atuais são recalculados; a data de referência não reconstrói o que era conhecido no passado. Sem base suficiente, o resultado fica indisponível ou identificado como parcial.

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

1. Leia orçamento, custo incorrido, compras pendentes, restante, risco, mudanças adicionais e custo final por obra.
2. Escolha a Obra da memória de custo final e leia os alertas e a composição por etapa.
3. Use Conferir em Custos por etapa para revisar a estimativa na área de origem. Use Voltar às previsões gerenciais para retomar a consulta.
4. Use Exportar custo final por obra para guardar o relatório e seus avisos.

### Como conferir se deu certo

O custo final é incorrido + restante + reserva de risco + impactos de mudanças adicionais. O restante já inclui as compras pendentes; pedidos e pagamentos não entram novamente.

### O que merece atenção

Incorrido segue a competência até o mês da referência. A referência automática usa o maior entre zero, orçamento menos incorrido e compras ainda não faturadas; não é previsão estatística. Revisão com base alterada ou etapa removida exige reconferência e deixa o custo final indisponível nas previsões gerenciais. Sem orçamento de controle com itens válidos, início válido para o acumulado ou com quantidade, preço, valor ou total fora do limite seguro, o custo final também permanece indisponível. Gastos ou compras sem etapa exigem apropriação ou revisão válida explícita de Sem apropriação, pois a referência automática pode repetir o orçamento. Restante abaixo das compras pendentes pede revisão. Os registros de origem são preservados; subtotais não comprovam cobertura integral.

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
2. Confira a competência, o ciclo e a obra. Na Folha da quinzena, totais, pendências e relatórios respeitam o grupo.
3. Em Holerites CLT, escolha uma pessoa do grupo. Confirme o descarte se houver edição não salva antes de trocar de grupo.
4. Para fechar ou reabrir a quinzena da empresa inteira, escolha Todos e Todas as obras e revise as pendências.

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
2. Confira a competência, o ciclo e a obra. Na Folha da quinzena, totais, pendências e relatórios respeitam o grupo.
3. Em Holerites CLT, escolha uma pessoa do grupo. Confirme o descarte se houver edição não salva antes de trocar de grupo.
4. Para fechar ou reabrir a quinzena da empresa inteira, escolha Todos e Todas as obras e revise as pendências.

### Como conferir se deu certo

A lista e os totais mostram o grupo selecionado.

### O que merece atenção

O fechamento inclui os dois grupos. As áreas gerais, como encargos e projeção, mantêm seu escopo próprio; nelas o seletor de grupo não aparece. O grupo não muda a lotação nem o cálculo individual.

<a id="guia-home"></a>

## Dashboard

Entender a situação da empresa e decidir o que conferir primeiro.

### Antes de começar

Confirme os filtros de obra e período disponíveis.

### Como fazer

1. Leia os indicadores e as pendências.
2. Abra uma obra ou uma ação da lista para consultar sua origem.
3. Confira os registros na tela de destino antes de tomar uma decisão.

### Como conferir se deu certo

Você identificou uma pendência e sabe em qual tela tratá-la.

### O que merece atenção

Os indicadores dependem do período, dos filtros e do seu acesso.

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

Trocar mensagens com pessoas da equipe.

### Antes de começar

Confira o destinatário ou a conversa antes de escrever.

### Como fazer

1. Abra a conversa desejada.
2. Escreva a mensagem e confira os anexos, se houver.
3. Envie e acompanhe as respostas na conversa.

### Como conferir se deu certo

A mensagem aparece na conversa correta.

### O que merece atenção

Uma mensagem não substitui a aprovação ou o lançamento no módulo responsável.

<a id="guia-aprov_pend"></a>

## Minhas aprovações

Encontrar decisões que aguardam sua análise.

### Antes de começar

Tenha em mãos a justificativa e os documentos do registro.

### Como fazer

1. Abra uma pendência da sua lista.
2. Confira obra, valores, solicitante e documentos.
3. Use a decisão disponível e informe a justificativa solicitada.

### Como conferir se deu certo

A situação da pendência foi atualizada após a confirmação.

### O que merece atenção

Só decida sobre registros que você conferiu; a lista respeita seu perfil.

<a id="guia-admin_central"></a>

## Central do administrador

Conferir acessos, pendências e funcionamento do sistema.

### Antes de começar

Entre com um perfil autorizado para administração.

### Como fazer

1. Escolha o painel de acompanhamento necessário.
2. Abra a pendência e confira o usuário, a obra ou o registro de origem.
3. Trate o problema na função correspondente e confira o retorno.

### Como conferir se deu certo

Você conhece a origem da pendência e a situação após o tratamento.

### O que merece atenção

Acesso a esta tela não dispensa conferir o alcance de cada ação.

<a id="guia-obras"></a>

## Obras

Localizar, cadastrar e abrir uma obra.

### Antes de começar

Tenha o nome, o cliente e os dados contratuais da obra.

### Como fazer

1. Pesquise a obra na lista ou use Nova obra quando tiver permissão.
2. No cadastro, preencha os dados solicitados, revise e salve.
3. Abra a obra para acessar orçamento, planejamento, equipe e demais áreas.

### Como conferir se deu certo

A obra aparece na lista e seu painel abre com o nome correto.

### O que merece atenção

Confira o cliente e a obra antes de registrar qualquer informação.

<a id="guia-obra_geral"></a>

## Visão geral da obra

Consultar o resumo e acessar as áreas de uma obra.

### Antes de começar

Confira o nome da obra no cabeçalho.

### Como fazer

1. Leia o resumo e as ações disponíveis.
2. Escolha a área da obra pelo menu ou seletor de telas.
3. Consulte os detalhes na área escolhida e retorne à visão geral quando necessário.

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

1. Use Novo orçamento para cadastrar ou abra um orçamento existente. Guia do orçamento explica os recursos desta tela.
2. Cadastre ou confira as etapas e os serviços.
3. Revise unidade, quantidade, composição e preço de cada item.
4. Confira os totais, salve as alterações e use a saída de relatório disponível.

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

1. Selecione as atividades e revise os vínculos com o orçamento.
2. Defina datas e duração no cronograma.
3. Acompanhe o realizado e compare com a linha de base, quando houver.
4. Para aprovação e versões preservadas, abra Linha de base aprovada e SPI. Prepare uma proposta, confira os itens e calendário e solicite aprovação ao administrador ou à diretoria. A Ajuda passa a mostrar o guia específico enquanto essa área estiver aberta. Fotografias legadas de datas não calculam SPI.

### Como conferir se deu certo

O cronograma mostra as atividades nas datas esperadas.

### O que merece atenção

Linha de base é a referência aprovada para comparação; confira antes de substituí-la.

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

1. Abra Novo relatório ou o diário em preparação.
2. Leia as atividades previstas no planejamento e use Levantar para abrir a atividade, ou + Serviço para outra atividade.
3. Selecione o serviço. Quando houver um único item na etapa, o vínculo orçamentário e a unidade vêm preenchidos. Caso contrário, escolha Item do orçamento da atividade uma vez.
4. Use Vincular equipe presente do ponto e confira quem realmente executou. Registre Quantidade executada hoje, inclusive zero se não houve produção aceita. O acumulado anterior revisado sugere o novo percentual; confira o Progresso acumulado.
5. Horas do ponto vêm dos horários completos, com intervalo descontado. Se a pessoa participou de várias atividades, distribua Horas nesta atividade sem superar sua jornada. Horários pendentes devem ser resolvidos no ponto.
6. Salve o serviço e confira a confirmação do servidor. Complete o relato e o clima de manhã e tarde; o clima noturno é opcional. Faça a revisão técnica e use Concluir relatório. Apenas o engenheiro pode revisar e concluir.
7. Após concluir, use Consultar no histórico para conferir Produção do dia, Unidade registrada, Item do orçamento, Progresso acumulado e horas de cada pessoa. PDF abre a impressão com os mesmos dados. Horas de atividade única identificam o ponto consultado e a data; divisões explícitas aparecem como apropriação registrada. Registros antigos mostram Não informado quando não possuem o dado.
8. Em Previsões gerenciais, os dados confirmados alimentam automaticamente saldo a executar, produtividade e dimensionamento.

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

1. Abra a foto. Em Ferramentas e zoom, escolha ferramenta, cor e espessura.
2. Desfazer recupera Limpar anotações. Salvar preserva o original; no formulário, confirme também Salvar achado.
3. Fechar ou Escape pede confirmação das alterações. Continuar editando mantém o rascunho. Ao fechar o editor, o foco do teclado volta à miniatura que abriu a foto, quando ela continua disponível.
4. A pessoa atribuída envia a correção; o vistoriador valida.

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

1. Abra Solicitar e use Nova solicitação.
2. Para aproveitar uma conversa, use Colar pedido do WhatsApp, cole o texto ou print e clique em Analisar pedido. Confira a leitura e use Usar itens no rascunho.
3. Revise obra, data necessária, materiais, quantidades, unidades e etapa do orçamento; preencha os dados ausentes.
4. Use Formalizar e enviar para Compras e aguarde a confirmação do servidor. Consulte Pedido original da conversa na solicitação.

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

### Como conferir se deu certo

A consulta mostra a pessoa, a data e a obra corretas.

### O que merece atenção

Ausência de batida não confirma falta; registros offline dependem de sincronização. Ao salvar ou sincronizar três dias trabalhados consecutivos na mesma obra nova, a lotação do funcionário ativo é atualizada. Presença e meio período contam; folgas não contam e outra obra interrompe a sequência. Histórico, pontos antigos, pagamentos, desligamentos e decisões posteriores do RH são preservados.

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

Acompanhar a operação dos aparelhos que capturam o ponto.

### Antes de começar

Identifique o aparelho e a obra em que ele opera.

### Como fazer

1. Consulte os aparelhos e a situação de sincronização.
2. Confira registros e pendências. Em falhas, aguarde até 5 min ou use Atualizar.
3. Siga a ação de configuração ou conferência disponível ao seu perfil.

### Como conferir se deu certo

O aparelho e seus registros estão identificados para acompanhamento.

### O que merece atenção

Bata entrada e saída. Almoço 12h–13h descontado sem batidas; saída prevista seg–qui 17h, sex 16h, conforme escala vigente. Dias completos integram ao receber as batidas. Recupere pendências em Gestão do ponto > Sincronizar batidas do app. Duplicidades exigem justificativa do RH; originais e fechamentos são preservados. Em Documentos fiscais, consulte a prontidão, a auditoria de integridade e as exportações AFD/AEJ. Os comprovantes assinados dependem do serviço privado configurado e das evidências fiscais reais; pendências de INPI bloqueiam a emissão oficial. Em Entrega dos comprovantes, selecione o funcionário, confira o telefone sugerido e use Confirmar WhatsApp; preencher não ativa envios. Criar acesso individual entrega uma consulta privada, revogável, de 90 dias.

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

### Como conferir se deu certo

O cadastro mostra a saída confirmada.

### O que merece atenção

O último dia é inclusivo. Ponto e pagamentos são preservados; outras edições não são salvas.

<a id="guia-equipe_obras"></a>

## Equipe nas Obras

Entender como a equipe está distribuída e o que precisa de conferência.

### Antes de começar

Confira data, obra e sincronização. Em falhas, aguarde até 5 min ou use Atualizar.

### Como fazer

1. Consulte a distribuição por obra.
2. Abra a pessoa ou situação para conferir lotação e captura do ponto.
3. Verifique as divergências antes de encaminhar o tratamento ao responsável.

### Como conferir se deu certo

Você identificou a equipe e as situações que precisam de revisão.

### O que merece atenção

Esta visão não cria nem encerra batidas. Ausência de registro não significa falta confirmada.

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
3. Acompanhe medições e saldos no contrato correto.

### Como conferir se deu certo

O contrato apresenta os serviços e o saldo esperado.

### O que merece atenção

Medição, aprovação e pagamento têm situações próprias; confira cada etapa.

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
3. Revise proventos, descontos e o valor líquido de cada pessoa.
4. Use a ação de fechamento ou emissão disponível após a revisão.

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

### Como conferir se deu certo

Você consegue relacionar o indicador aos dados de origem.

### O que merece atenção

Compare períodos e grupos equivalentes; dados ainda não sincronizados podem afetar a leitura.

<a id="guia-dre_emp"></a>

## DRE empresa

Entender o resultado da empresa por mês de referência.

### Antes de começar

Escolha o período e confira a abrangência da análise.

### Como fazer

1. Leia receitas, custos, despesas e resultado.
2. Abra o detalhamento ou memorial do valor que deseja conferir.
3. Compare com os registros de origem e use a visão anual quando necessário.

### Como conferir se deu certo

Você sabe quais registros compõem o resultado do período.

### O que merece atenção

DRE é a Demonstração do Resultado. Resultado por competência é diferente do saldo bancário.

<a id="guia-dre"></a>

## DRE obras

Analisar receitas, custos e resultado de uma obra.

### Antes de começar

Selecione a obra e a competência desejada.

### Como fazer

1. Leia o resultado e os grupos de valores.
2. Abra o detalhamento para conferir os lançamentos de origem.
3. Compare com as medições e demais registros da mesma obra e período.

### Como conferir se deu certo

O resultado pode ser explicado pelos registros apresentados.

### O que merece atenção

Receita de uma competência pode ser recebida em outra data. Confira o regime da consulta.

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
2. Compare fornecedor, número, valores, obra e vínculo de origem.
3. Corrija os dados permitidos, confirme e confira o resultado.

### Como conferir se deu certo

A ficha fiscal apresenta os dados conferidos e seus vínculos.

### O que merece atenção

Uma nota importada ainda precisa de revisão. Confira se já existe antes de cadastrar outra.

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

1. Abra os avisos e consulte os registros de origem.
2. Resolva os bloqueios e revise os valores da competência.
3. Solicite o fechamento e confira a confirmação devolvida pelo sistema.

### Como conferir se deu certo

O sistema apresenta o fechamento confirmado ou os bloqueios restantes.

### O que merece atenção

Se houver rejeição, leia o motivo e corrija a origem antes de tentar novamente.

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
2. Compare o incorrido com as compras ainda não faturadas. Abra Conferir apropriação e previsão para revisar o restante e a reserva de risco.
3. Registre e acompanhe Mudanças e aditivos; escolha explicitamente como cada impacto entra na previsão.
4. Leia os avisos e consulte Ajuda da previsão para o passo a passo completo.

### Como conferir se deu certo

Você identificou os registros que explicam o custo de cada etapa.

### O que merece atenção

A previsão revisada permanece com aviso quando a base muda. Custo final = incorrido + restante + reserva + mudanças adicionais; pagar não gera outro custo. Pendências de processo permitem continuar.

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

Conferir as verificações do funcionamento financeiro.

### Antes de começar

Use um perfil de administrador e leia o escopo de cada verificação.

### Como fazer

1. Consulte os testes ou verificações disponíveis na tela.
2. Leia o resultado e identifique divergências ou pendências.
3. Confira os registros de origem com o responsável antes de qualquer correção.

### Como conferir se deu certo

Você identificou o que foi verificado e o que ainda exige tratamento.

### O que merece atenção

Uma verificação técnica não substitui a conferência documental de cada operação.

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
3. Analise cada sugestão comparando valor, data, contraparte e documento.
4. Confirme o vínculo apenas após a conferência e acompanhe o saldo e as pendências.

### Como conferir se deu certo

As linhas conferidas mostram os vínculos corretos.

### O que merece atenção

Semelhança de valor ou descrição não basta para confirmar um vínculo. Revise a automação antes de retomá-la.

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

### Como conferir se deu certo

A medição mostra o valor devido e a situação de recebimento.

### O que merece atenção

Registrar uma medição não significa que o dinheiro já foi recebido.

<a id="guia-caixa"></a>

## Caixa da obra

Registrar e conferir movimentações do caixa de uma obra.

### Antes de começar

Confirme a obra e o comprovante da movimentação.

### Como fazer

1. Consulte o saldo e os registros anteriores.
2. Use a ação disponível para informar entrada ou saída, com data, valor e descrição.
3. Anexe o comprovante quando solicitado e confira o saldo após salvar.

### Como conferir se deu certo

O histórico e o saldo explicam a movimentação confirmada.

### O que merece atenção

Evite lançar novamente um pagamento que já existe em outro fluxo.

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

1. Em Frota, pesquise o equipamento; seu nome abre o cadastro.
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

1. Em Frota, o nome abre o cadastro; Locar, Transferir e Manutenção ficam no cartão.
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

1. Pesquise o bem; seu nome abre o cadastro.
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

1. Localize o grupo de configurações necessário.
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

Confira a obra e a pessoa que terá acesso.

### Como fazer

1. Abra Portal do cliente na obra.
2. Revise a ativação, os acessos e o conteúdo disponível.
3. Confira a visualização do cliente antes de copiar ou compartilhar o acesso.

### Como conferir se deu certo

O acesso corresponde à obra e às informações autorizadas.

### O que merece atenção

Confira o destinatário antes de compartilhar; acesso individual e link legado têm controles diferentes.

<a id="guia-com_dash"></a>

## Dashboard comercial

Use esta tela para acompanhar os resultados comerciais.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Confira os indicadores e o período.
2. Abra o grupo ou registro que explica o resultado.
3. Acompanhe a próxima ação na área responsável.

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

1. Escolha a oportunidade no quadro.
2. Confira a etapa, o responsável e a próxima ação.
3. Atualize a oportunidade conforme o avanço real da negociação.

### Como conferir se deu certo

O quadro representa o estágio atual da oportunidade.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

<a id="guia-com_relationships"></a>

## Relacionamentos

Use esta tela para organizar contatos de clientes e parceiros.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Pesquise a pessoa ou empresa.
2. Confira os dados de contato e os vínculos.
3. Registre a atualização ou abra a oportunidade relacionada.

### Como conferir se deu certo

Você encontrou o contato e seu relacionamento com os negócios.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

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

### Como conferir se deu certo

O possível cliente possui contato e acompanhamento definidos.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

### Exemplo ilustrativo

Uma pessoa pediu informações sobre uma obra. Pesquise o contato, registre a origem e defina quem fará o próximo atendimento.

<a id="guia-com_funil"></a>

## Funil

Use esta tela para acompanhar a etapa de cada oportunidade.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Localize a oportunidade no quadro.
2. Abra os detalhes e confira responsável e próxima ação.
3. Atualize a etapa conforme o que foi confirmado com o cliente.

### Como conferir se deu certo

A oportunidade está na etapa que corresponde ao andamento real.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

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

## Contratos

Use esta tela para acompanhar a formalização do negócio.

### Antes de começar

Confira o cliente, o responsável e o período, quando disponíveis.

### Como fazer

1. Localize a proposta e o cliente corretos.
2. Confira contratante, objeto, valores, datas e documentos.
3. Acompanhe assinatura e demais requisitos antes de abrir a execução.

### Como conferir se deu certo

O contrato mostra o estágio e as pendências de formalização.

### O que merece atenção

Proposta, contrato, assinatura e recebimento são etapas diferentes. Confira a situação antes de avançar.

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

1. Confira o orçamento, o incorrido e Compras ainda não faturadas. Abra um valor para consultar sua memória. O faturamento parcial de pedidos com várias etapas é distribuído proporcionalmente ao valor dos itens.
2. Abra Conferir apropriação e previsão e escolha a etapa, inclusive Sem apropriação quando faltar orçamento ou vínculo.
3. Informe todo o custo restante para concluir, incluindo as compras ainda não faturadas. Acrescente uma reserva de risco separada e descreva as premissas.
4. Confira as mudanças adicionais. Se o custo de uma mudança já estiver no restante, marque Já incluído no acompanhamento dela.
5. Em Conferência dos aditivos no custo restante, escolha para cada aditivo: Ainda não conferido, Já está no restante informado ou Fora do restante — considerar separadamente. A escolha registra sua análise, sem mudar os valores.
6. Confirme a previsão e confira o total e o histórico. Quando a base mudar, o valor revisado permanece com aviso: use Atualizar base mantendo valores, confira e salve outra revisão.
7. Para cada aditivo conferido, preencha Justificativa da conferência do aditivo e confirme a previsão. É opcional: sem justificativa, o app salva com aviso. Para manter a pendência, escolha Ainda não conferido.
8. Consulte Histórico de conferência das duplicidades junto de Mudanças e aditivos. Confira responsável, data da conferência, decisão, justificativa, impacto e restante registrados. Use Aditivo do histórico para filtrar e as páginas para consultar registros anteriores.

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

- **Valor abaixo das compras pendentes:** Confira cancelamentos e economias. O aviso permite salvar; explique a diferença nas premissas.
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

### Como conferir se deu certo

O documento aparece na pasta correta, com revisões e histórico; pessoas sem acesso não recebem os registros da pasta.

### O que merece atenção

Subpastas acumulam restrições das pastas superiores; administradores mantêm acesso. Anexos dos módulos seguem o acesso de origem. As permissões da central não alteram o compartilhamento de links externos no provedor.

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

1. Use o lápis Editar exigência para abrir o item correto do checklist.
2. Anexe os documentos nos itens corretos e atualize a situação conforme a evidência.
3. Em Arquivos, escolha Dossiê de licenciamento para cadastrar responsável, validade e aplicabilidade, revisar anexos e consultar a documentação faltante.
4. Prepare o ZIP final quando estiver completo ou um ZIP parcial INCOMPLETO com a relação de pendências; confira o pacote antes de encaminhar ao órgão.

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

1. Antes de recuperar, salve ou cancele campos novos de outros formulários. Tentativas de salvar enquanto há outra pendência ficam protegidas separadamente.
2. Use Resolver salvamento no aviso ou no formulário aberto.
3. Se a sessão expirou, informe a senha da mesma conta em Renovar sessão; isso não grava automaticamente.
4. Use Consultar versão atual. Confira sua edição e o servidor; escolha cada campo em conflito. Nos demais campos, Manter servidor permite retirar uma mudança da revisão.
5. Use Salvar alterações revisadas e aguarde. Depois da recuperação, feche e reabra formulários antigos antes de editar novamente. Confira se outra edição aparece em Resolver salvamento e conclua as revisões até o aviso desaparecer.

### Como conferir se deu certo

A edição é enviada apenas após revisão explícita; a recarga não confirma operações.

### O que merece atenção

A proteção depende do armazenamento local e não é backup. Sem armazenamento, o envio fica bloqueado: mantenha a aba aberta. Verificar armazenamento retoma a conferência inicial; Proteger preenchimentos tenta gravar as tentativas que ficaram na memória; Proteger e reenviar edição tenta proteger novamente o que está na memória. Descartar edição da memória exige confirmação e perde essa tentativa; cópias já protegidas são preservadas. Sair e trocar de conta aguardam envios em andamento. Resolva o armazenamento antes de sair com uma edição apenas na memória. Concluir conferência encerra uma pendência que já consta no servidor, sem repetir a gravação. Mudança de acesso ou obra pode bloquear a retomada. Descartar edição protegida consulta o servidor e remove apenas a edição revisada; confirme com cuidado. Pagamentos e recebimentos continuam usando suas confirmações próprias.

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

<a id="guia-ponto_relatorios_obras"></a>

## Relatórios de batidas e banco de horas por obra

Consultar e exportar registros recebidos, sem alterar o ponto ou a folha.

### Antes de começar

Confira o período, as jornadas e as obras que seu perfil pode consultar.

### Como fazer

1. Em Ponto eletrônico, abra Relatórios por obra.
2. Escolha obra, período (até 62 dias) e funcionário; use Gerar relatório.
3. Confira Resumo do período, detalhamento diário por funcionário e Pendências e observações.
4. Abra Auditoria das marcações e dos ajustes para conferir segundos e identificadores. Para incluí-la nos arquivos, marque Incluir anexo de auditoria na exportação.
5. Use Exportar Excel ou Exportar PDF; na prévia, use Imprimir / salvar PDF.

### Como conferir se deu certo

O resumo é seguido das jornadas por funcionário. A exportação inclui todos os funcionários do filtro, mesmo os que estão em outra página da tela.

### O que merece atenção

Sem tipo não é transformado em entrada ou saída pela ordem: aparece Pendente de classificação, com horários originais, sem gerar horas ou débito. Períodos tratados pelo RH aparecem como Ajustado. O intervalo padrão de uma hora é identificado como presumido, sem batidas fictícias. Jornada e tolerância seguem a configuração existente. Jornadas noturnas pertencem à data de entrada e mostram as duas datas; a consulta inclui um dia de contexto de cada lado. Nos dias com várias obras, jornada e saldo não são rateados sem regra disponível. Ausência de saldo anterior e compensações aparece como Não disponível, sem saldo final consolidado. Resumo parcial soma somente jornadas válidas. O cálculo estrito deste relatório pode diferir da estimativa antiga por pares cronológicos; não altera a gestão do ponto ou a folha. Consulta incompleta, falha de atualização e datas ainda não consultadas bloqueiam exportar. Não altera pagamentos ou marcações.

## Aparência, botões e navegação

### Entender o modo de captura do ponto

O novo código do coletor verifica uma conexão autenticada com o registrador, com espera limitada, e protege o indicador online/offline no hash da nova marcação. Falha de conexão mantém a batida local para sincronização posterior, sem deslocar seu instante pela espera da rede. Esse recurso depende de uma nova versão instalada e validada; não altera o APK18 ou registros antigos. O RH continua responsável pela conferência da jornada. O indicador de conexão não substitui a validação fiscal nem confirma pagamento.

### Comprovantes individuais do ponto

Em Ponto eletrônico, abra a área fiscal e Entrega dos comprovantes. Selecione o funcionário e use Criar acesso individual; entregue o endereço privado apenas a ele. O acesso expira em 90 dias e um novo acesso revoga o anterior. Revogar acesso cancela a consulta. Ao selecionar o funcionário, o campo WhatsApp sugere o Telefone do cadastro, acrescentando 55 aos números com DDD. Confira ou corrija com o funcionário e use Confirmar WhatsApp. O preenchimento não confirma o contato nem habilita o envio; não aproveite números antigos sem confirmação. Editar esse campo não altera o Telefone do cadastro. Consultar processamento mostra emissão e envios registrados. Envio aceito pelo provedor não confirma leitura. Resultado incerto exige conferir o histórico do WhatsApp antes de qualquer reenvio. O trabalhador abre /meu-ponto, usa Consultar meus comprovantes e Baixar PDF; Sair deste acesso remove o código da tela. A assinatura oficial depende do INPI, da integridade e das evidências fiscais reais. A configuração do serviço privado e do processador é feita pelo administrador; estas ações não alteram batidas, folha ou pagamentos.

### Ajustar o menu lateral

No computador, arraste a borda direita do menu. Pelo teclado, use Tab para chegar à borda, setas para ajustar e Home/End para os limites. Enter ou duplo clique restaura a largura inicial. Minimizar menu lateral conserva o ajuste ao expandir. A preferência fica neste navegador e vale em todos os módulos, sem alterar dados. No celular, use a navegação inferior e Mais.

### Leitura de PDF

Ao fechar a visualização de um PDF em carregamento, a transferência é cancelada. Para tentar novamente, reabra o documento. Se o leitor apresentar erro, confira o acesso ao arquivo e use o link do documento original quando disponível. Consultar o arquivo não aprova a nota nem confirma pagamento.

### Carregamento de telas

Na entrada e nas áreas internas, o indicador pode não aparecer em aberturas rápidas. Aguarde sem repetir a ação; carregar não confirma gravação. Em caso de erro, siga a orientação da tela. Fechar permite cancelar a preparação de um diálogo.

### Cadastro pelo ponto

Em Equipes, Ponto por obra e Gestão do ponto, o nome abre o cadastro para RH e administradores; outros perfis abrem o PDF. Confira Vínculo e desligamento no início do cadastro. Corrija o ponto pela célula do dia, sem limpar a linha inteira.

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

Use o botão Alterar aparência, identificado pelo ícone de paleta no cabeçalho, para escolher MARCELL Operacional, MARCELL Claro ou MARCELL Preciso e ajustar a densidade. O padrão é MARCELL Preciso com densidade Compacta: menu azul-marinho, conteúdo claro e ações em azul. A fonte é IBM Plex Sans. Compacta reduz espaços e preserva o toque no celular. Em todo o ERP, campos de uma linha e botões comuns seguem a densidade escolhida, com rótulos alinhados. Áreas de observação e células de planilha conservam o espaço necessário. A preferência fica neste navegador; a troca mantém seus filtros e dados.

### Identificar a área selecionada

A área atual recebe destaque visual. Na navegação de Compras e Financeiro, o botão selecionado tem fundo e borda destacados. Clique em outra área para abri-la. Você também pode usar Tab para chegar ao botão e Enter para acioná-lo. O contorno de foco indica qual controle receberá a ação do teclado.

### Encontrar consultas e opções adicionais

No computador, Consultas e cadastros em Compras e Mais áreas no Financeiro abrem opções complementares. Clique novamente ou use Escape para recolher o menu. No celular, use o seletor de áreas do módulo.

### Acessar outros módulos no celular

Use Mais, na barra inferior, para abrir Mais módulos. Escolha o módulo desejado. No celular, Mais também mostra a conta e Sair do sistema. Fechar menu ou Escape retorna à tela atual sem trocar a área de trabalho.

### Usar os filtros

Mantenha a obra e o período corretos. O botão Filtros abre as opções adicionais, preservando os valores ao recolher. Limpar filtros remove o recorte informado na lista.

### Conferir o salvamento

Após falha, use Resolver salvamento no aviso da página ou no formulário aberto. Aguarde a confirmação; não é preciso fazer outra edição. Sem conexão, mantenha a aba aberta até reconectar: use Resolver salvamento para revisar edições protegidas após recarga. Sessão, acesso e conflito exigem seguir o motivo; copie edições antes de sair. Para pagamentos e recebimentos, use Retomar trabalho salvo.

### Gráficos operacionais

Os gráficos mostram os dados completos assim que ficam disponíveis, sem aguardar animação de entrada. Valores, séries e rótulos continuam disponíveis.

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
