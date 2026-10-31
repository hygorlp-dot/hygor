# Manual de uso do app MARCELL

Revisão do conteúdo: 31/10/2026.

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
- [Arquivos](#guia-arquivos)
- [Diário de obra](#guia-rdo)
- [Conferência](#guia-conferencia)
- [Medição da evolução](#guia-med)
- [Estoque](#guia-est)
- [Compras](#guia-cmp)
- [Compras · Solicitar](#guia-cmp_solicitacoes)
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
- [Medições](#guia-medicoes)
- [Caixa da obra](#guia-caixa)
- [Relatórios](#guia-relat)
- [Equipamentos](#guia-equip)
- [Locação de equipamentos](#guia-equip_fin)
- [Patrimônio da empresa](#guia-patrimonio)
- [Licenciamento](#guia-licenca)
- [Cadastros](#guia-cad)
- [IA](#guia-ia)
- [Configurar Gemini](#guia-ia_config)
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

1. Cadastre ou confira as etapas e os serviços.
2. Revise unidade, quantidade, composição e preço de cada item.
3. Confira os totais, salve as alterações e use a saída de relatório disponível.

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

### Como conferir se deu certo

O cronograma mostra as atividades nas datas esperadas.

### O que merece atenção

Linha de base é a referência aprovada para comparação; confira antes de substituí-la.

### Quando o fluxo acontece de outro jeito

- **Necessidade e compra parcial:** Na consulta temporal do Financeiro, confira a necessidade revisada e a quantidade comprovada por item. A diferença exige decisão em Compras. Conversão sem fator ou vínculo sem identidade ficam para conferência.
- **Entrega posterior à etapa simulada:** Abra o pedido para revisar o prazo com Compras. A simulação não reagenda nem muda o vencimento financeiro.

<a id="guia-plan_suprimentos"></a>

## Marcos e Curva A

Relacionar prazos da obra com as compras mais relevantes.

### Antes de começar

Confira a obra, o orçamento e o cronograma.

### Como fazer

1. Leia os marcos e os itens de maior impacto.
2. Confira quando o material será necessário e o prazo para comprar.
3. Abra a necessidade de compra e revise os dados antes de encaminhar.

### Como conferir se deu certo

Os itens prioritários têm necessidade e prazo identificados.

### O que merece atenção

A Curva A destaca itens de maior peso; ela não confirma compra nem entrega.

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

<a id="guia-arquivos"></a>

## Arquivos

Guardar e consultar documentos organizados por obra e pasta.

### Antes de começar

Selecione a obra e a pasta de destino.

### Como fazer

1. Localize a pasta ou crie uma quando a função estiver disponível.
2. Adicione o documento ou link e confira nome, destino e revisão.
3. Abra a prévia para conferir o conteúdo; use o histórico para consultar revisões.

### Como conferir se deu certo

O documento está na pasta correta e pode ser consultado.

### O que merece atenção

Uma revisão nova preserva as anteriores. Falha de acesso pode exigir entrar no provedor de arquivos.

### Exemplo ilustrativo

Para atualizar uma planta, confira a pasta da obra e a revisão existente. Consulte o histórico para distinguir a planta atual da anterior.

<a id="guia-rdo"></a>

## Diário de obra

Registrar o que aconteceu em cada dia da obra.

### Antes de começar

Selecione a obra e confira a data do diário.

### Como fazer

1. Abra o registro do dia.
2. Informe atividades, equipe, ocorrências e fotos solicitadas.
3. Revise o relato, salve e confira o registro na data correta.

### Como conferir se deu certo

O diário descreve o dia de trabalho com suas evidências.

### O que merece atenção

RDO significa Relatório Diário de Obra. Sugestões de IA precisam de revisão antes de salvar.

<a id="guia-conferencia"></a>

## Conferência

Registrar vistorias e acompanhar a correção de pendências.

### Antes de começar

Confira a obra e quem é o responsável pela vistoria.

### Como fazer

1. O vistoriador cria a vistoria e registra as pendências com evidências.
2. A pessoa atribuída à correção envia a foto da solução.
3. O vistoriador analisa a evidência e declara o resultado.

### Como conferir se deu certo

A pendência mostra a situação correspondente à revisão realizada.

### O que merece atenção

Enviar foto de correção não encerra a pendência. A validação cabe ao vistoriador ou administrador.

<a id="guia-med"></a>

## Medição da evolução

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

1. Confira a necessidade da obra, o estoque e os pedidos em aberto. Registre ou localize a solicitação.
2. Compare as propostas e condições, registre a decisão e acompanhe o pedido. Aprovações pendentes ficam sinalizadas, sem impedir o andamento.
3. Registre a entrega física para dar entrada no estoque. Vincule a nota e registre os pagamentos reais quando ocorrerem; essas etapas podem acontecer em outra ordem.

### Como conferir se deu certo

Você sabe em que etapa a compra está e qual é a próxima ação.

### O que merece atenção

Os avisos orientam sem travar etapas. Cada registro conserva sua situação: receber não paga, pagar não aprova a conferência fiscal e consultar a ficha não altera dados.

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

1. Abra Solicitar e inicie a solicitação.
2. Preencha os itens e a justificativa; confira o vínculo com o orçamento quando aplicável.
3. Salve e acompanhe a solicitação na fila.

### Como conferir se deu certo

A necessidade aparece para acompanhamento da compra.

### O que merece atenção

Uma solicitação ainda não é um pedido ao fornecedor.

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
3. Confirme e confira o recebido, o saldo pendente e o estoque.

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

Escolha a obra e o período; confirme o funcionário.

### Como fazer

1. Localize o dia e a pessoa na grade ou lista.
2. Confira a situação e os registros disponíveis.
3. Use apenas as ações permitidas ao seu perfil e confira a confirmação do sistema.

### Como conferir se deu certo

A consulta mostra a pessoa, a data e a obra corretas.

### O que merece atenção

Ausência de batida não confirma falta. Registros offline só aparecem depois da sincronização.

<a id="guia-ponto_geral"></a>

## Gestão do ponto

Conferir o ponto da equipe no período.

### Antes de começar

Selecione o período e os filtros de funcionários e obras.

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
2. Confira os registros recebidos e as pendências apresentadas.
3. Siga a ação de configuração ou conferência disponível ao seu perfil.

### Como conferir se deu certo

O aparelho e seus registros estão identificados para acompanhamento.

### O que merece atenção

No aparelho, o fluxo é entrada, intervalo, retorno e saída. Falta de sincronização pode atrasar a exibição no ERP.

<a id="guia-equipe"></a>

## Equipes

Consultar e manter o cadastro dos funcionários.

### Antes de começar

Pesquise pelo nome ou documento antes de criar um cadastro.

### Como fazer

1. Localize o funcionário ou inicie um novo cadastro autorizado.
2. Confira identificação, função, vínculo e lotação solicitados.
3. Salve e abra novamente o cadastro para conferir os dados.

### Como conferir se deu certo

O funcionário consta com os dados e a situação corretos.

### O que merece atenção

Lotação é o vínculo administrativo; ela não comprova onde o funcionário bateu o ponto.

<a id="guia-equipe_obras"></a>

## Equipe nas Obras

Entender como a equipe está distribuída e o que precisa de conferência.

### Antes de começar

Confira a data, a obra e a última sincronização.

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

<a id="guia-folha"></a>

## Folha

Conferir o cálculo e os documentos da folha de pagamento.

### Antes de começar

Selecione a competência, isto é, o mês de referência, e a equipe.

### Como fazer

1. Confira funcionários, ponto e informações que alimentam a folha.
2. Revise proventos, descontos e o valor líquido de cada pessoa.
3. Use a ação de fechamento ou emissão disponível após a revisão.

### Como conferir se deu certo

A folha e os documentos refletem a competência conferida.

### O que merece atenção

Fechar ou emitir a folha não comprova pagamento; confira a situação financeira separadamente.

### Exemplo ilustrativo

Para conferir a folha de outubro, selecione a competência de outubro e revise os funcionários e descontos antes de fechar.

<a id="guia-resc"></a>

## Rescisão

Preparar a conferência do desligamento de um funcionário.

### Antes de começar

Tenha a pessoa, a data e o motivo do desligamento.

### Como fazer

1. Abra a rescisão do funcionário correto.
2. Preencha os dados solicitados e confira as parcelas e descontos apresentados.
3. Revise os documentos e confirme somente após a conferência responsável.

### Como conferir se deu certo

O registro contém os dados e documentos do desligamento conferido.

### O que merece atenção

Confira as informações com o responsável pelo RH antes da confirmação.

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

1. Escolha a área do financeiro no cabeçalho.
2. Abra uma pendência e confira o documento ou lançamento de origem.
3. Realize a ação autorizada e confira a confirmação e a situação atual.

### Como conferir se deu certo

A pendência financeira tem origem, situação e próxima ação identificadas.

### O que merece atenção

Nota, obrigação, pagamento e conciliação são etapas distintas. Consulte a origem para evitar duplicidade.

<a id="guia-fin_hoje"></a>

## Financeiro · Hoje

Priorizar as tarefas financeiras do dia.

### Antes de começar

Confira a data e o recorte de obra.

### Como fazer

1. Leia as filas e as pendências apresentadas.
2. Abra o item e confira vencimento, valor e origem.
3. Siga para a área indicada para tratar a pendência e confira o retorno.

### Como conferir se deu certo

Você sabe quais tarefas exigem ação e em que área concluí-las.

### O que merece atenção

Um alerta indica algo a conferir; não é autorização automática para pagar.

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

Conferir obrigações e acompanhar a quitação.

### Antes de começar

Confira fornecedor, documento, vencimento e obra.

### Como fazer

1. Localize a obrigação e confira documento, obra, saldo e pagamentos já registrados no pedido e na nota.
2. Leia os avisos, selecione a origem real do pagamento e informe data, valor e comprovante disponível. A conferência pendente não impede o registro.
3. Confirme uma única vez e confira o histórico. Encaminhe as pendências documentais ao responsável e faça a conciliação quando houver movimento bancário.

### Como conferir se deu certo

O registro mostra o pagamento confirmado ou a pendência que ainda existe.

### O que merece atenção

O pagamento pode seguir com avisos. Adiantamento não deve ser repetido na nota, e pagar não aprova a conferência fiscal. A automação mantém casos pendentes para revisão; a decisão manual continua disponível ao perfil autorizado.

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
2. Analise cada sugestão comparando valor, data, contraparte e documento.
3. Confirme o vínculo apenas após a conferência e acompanhe o saldo e as pendências.

### Como conferir se deu certo

As linhas conferidas mostram os vínculos corretos.

### O que merece atenção

Semelhança de valor ou descrição não basta para confirmar um vínculo. Revise a automação antes de retomá-la.

### Exemplo ilustrativo

O extrato mostra uma saída de R$ 150,00. Antes de vincular, confira se o pagamento de R$ 150,00 é da mesma conta, contraparte e operação.

<a id="guia-medicoes"></a>

## Medições

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

Acompanhar equipamentos usados nas obras.

### Antes de começar

Identifique o equipamento e a obra responsável.

### Como fazer

1. Pesquise o equipamento antes de cadastrar.
2. Confira situação, localização e dados do registro.
3. Registre a movimentação ou atualização permitida e confira o histórico.

### Como conferir se deu certo

O equipamento está identificado na localização e situação corretas.

### O que merece atenção

Transferência de equipamento e pagamento de locação são registros distintos.

<a id="guia-equip_fin"></a>

## Locação de equipamentos

Acompanhar contratos e valores das locações.

### Antes de começar

Tenha o equipamento, fornecedor, obra e período da locação.

### Como fazer

1. Localize o contrato ou registro de locação.
2. Confira período, valores, devolução e documentos.
3. Acompanhe as obrigações e confira a situação financeira na origem.

### Como conferir se deu certo

A locação apresenta o período e os valores conferidos.

### O que merece atenção

Devolver um equipamento não comprova quitação dos valores da locação.

<a id="guia-patrimonio"></a>

## Patrimônio da empresa

Consultar os bens da empresa e sua responsabilidade.

### Antes de começar

Tenha identificação do bem e responsável atual.

### Como fazer

1. Pesquise o bem para evitar duplicidade.
2. Confira identificação, localização, responsável e documentos.
3. Registre a atualização permitida e confira o histórico.

### Como conferir se deu certo

O bem pode ser localizado e seu responsável está identificado.

### O que merece atenção

Patrimônio identifica o bem; estoque acompanha materiais e quantidades.

<a id="guia-licenca"></a>

## Licenciamento

Acompanhar documentos e etapas de aprovação da obra.

### Antes de começar

Selecione a obra e confira os órgãos ou condomínio envolvidos.

### Como fazer

1. Abra o checklist de licenciamento.
2. Confira cada exigência e vincule os documentos na etapa correta.
3. Atualize a situação com base na evidência e acompanhe as próximas pendências.

### Como conferir se deu certo

Cada etapa mostra a situação e a evidência correspondente.

### O que merece atenção

Anexar um documento não comprova que a aprovação foi concedida pelo órgão responsável.

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
