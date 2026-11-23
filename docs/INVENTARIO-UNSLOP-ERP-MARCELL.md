# Inventário e diagnóstico inicial do ERP MARCELL

Revisão de 23/11/2026. [Roteiro da revisão](ROTEIRO-UNSLOP-ERP-MARCELL.md).

## Cobertura

O inventário cruza o catálogo de navegação, as permissões padrão e a ajuda do aplicativo. A coluna de perfis usa o acesso padrão calculado pelo ERP. Permissões personalizadas e restrições por obra entram nos testes da etapa correspondente.

A avaliação visual desta rodada cobre Dashboard e Obras → Orçamento no MARCELL Plataforma, densidade Compacta, em 1440 e 390 px. As outras telas estão catalogadas para revisão. O catálogo distingue entradas principais de atalhos comerciais que a navegação mantém para perfis antigos.

## Achados do primeiro lote

| Prioridade | Onde | Evidência | Ajuste proposto |
| --- | --- | --- | --- |
| Alta | Dashboard, celular | A primeira pendência fica visível, mas o Placar começa em 924 px e a busca começa em 1.177 px num viewport de 844 px. | Aproximar o acesso ao Placar da área de decisão. Compactar os controles da competência mensal na composição compartilhada, considerando o que é necessário para a tarefa diária. |
| Alta | Obras → Orçamento, celular | A versão única abre direto. A busca começa em 747 px e a primeira célula editável em 1.006 px. A tela passa pelo seletor geral, seletor da obra, dados da versão e indicadores antes da grade. | Manter contexto e edição acessíveis. Reduzir a altura da composição que antecede a grade e testar um acesso rápido à planilha em telas estreitas. |
| Média | Obras → Orçamento, desktop | A primeira célula começa em 681 px. Os quatro totais usam 15 px na amostra. A área de trabalho mostra navegação da obra, abas de orçamento e ferramentas da planilha em faixas distintas. | Conferir o espaçamento entre os níveis de navegação e a relação entre a ação principal e os controles da planilha antes de compactar os campos. |
| Média | Dashboard e Orçamento | Os controles de escopo, a ação principal e os dados úteis disputam altura no celular. A amostra usa Inter na Dashboard e não apresentou rolagem horizontal da página. | Começar pelos componentes compartilhados de cabeçalho, filtro e navegação. Conferir a mesma mudança nos dois pilotos para evitar que a planilha herde cortes ou desalinhamentos. |

As duas telas pedem ajustes pontuais de hierarquia e densidade. Na validação, uma busca sem resultado na Dashboard mostrou o aviso esperado. Na planilha, `1.1` filtrou a lista e preservou o total da versão em R$ 61.950,00, nos dois tamanhos. A medida de altura começa no topo do viewport e serve para comparar a mesma composição antes e depois. Os cenários utilizaram dados fictícios.

Capturas iniciais da [Dashboard no desktop](../artifacts/unslop-erp-inventario/dashboard-1440.png), da [Dashboard no celular](../artifacts/unslop-erp-inventario/dashboard-390.png), do [Orçamento no desktop](../artifacts/unslop-erp-inventario/orcamento-1440.png) e do [Orçamento no celular](../artifacts/unslop-erp-inventario/orcamento-390.png).

## Direção do piloto

- **Produto.** Estação de trabalho para decidir o que tratar e localizar os registros de cada obra.
- **Caráter.** Sóbrio, compacto e legível.
- **Identidade.** MARCELL Plataforma com Inter e componentes compartilhados. Status recebe cor quando ela ajuda a reconhecer a situação.
- **Foco.** Na Dashboard, a próxima ação. No Orçamento, a grade com contexto suficiente para editar a versão correta.
- **Prova de uso.** A pessoa chega à busca ou à primeira linha com menos rolagem. A obra, a versão, o valor e as permissões conferem com a amostra inicial.

## Estados para a etapa seguinte

Conferir abertura com perfil restrito, carregamento e erro recuperável, busca vazia e sessão móvel com texto ampliado. Em Orçamento, cobrir obra sem versão, versão única, várias versões, versão aprovada somente para leitura, rolagem interna e impressão. Na Dashboard, cobrir perfil sem pendências, lista extensa, ausência de dados e atalhos com permissão limitada. A rodada com operadores da Dashboard está registrada no [relatório do piloto](VALIDACAO-DASHBOARD-ROADMAP.md).

O manual passou em `npm run manual:check`. A inspeção visual foi feita na prévia local e no tema Plataforma. A comparação com os demais temas, os fluxos de erro e as saídas impressas ficam para a validação das alterações de interface. Nesta etapa houve consultas e documentação. A origem dos valores e os cálculos do DRE são os mesmos usados antes da inspeção.

## Catálogo por módulo

Acesso padrão registrado como Admin (Administrador), Eng. (Engenharia), Aud. (Auditoria de engenharia), Compras, RH, Fin. (Financeiro), Com. (Comercial) e Vis. (Visualizador).

Entradas catalogadas: **65**, incluindo **16 atalhos comerciais**. O manual possui **147 guias**.

### Visão gerencial

| Aba | ID | Tarefa principal | Perfis padrão |
| --- | --- | --- | --- |
| [Dashboard](MANUAL_DO_APP.md#guia-home) | `home` | Identificar o que precisa de atenção e acompanhar as obras. | Admin, Eng., Aud., Compras, RH, Fin., Com., Vis. |
| [DRE empresa](MANUAL_DO_APP.md#guia-dre_emp) | `dre_emp` | Entender o resultado da empresa por mês de referência. Se a receita líquida não for positiva, as margens aparecem como Não aplicável. | Admin, Fin. |
| [DRE obras](MANUAL_DO_APP.md#guia-dre) | `dre` | Analisar receitas, custos e resultado de uma obra. | Admin, Fin. |
| [Relatórios](MANUAL_DO_APP.md#guia-relat) | `relat` | Consultar e emitir relatórios para acompanhamento. | Admin, Fin. |
| [Modo TV](MANUAL_DO_APP.md#guia-tv) | `tv` | Acompanhar os indicadores em uma tela de apresentação. | Admin, Eng., Aud., Compras, RH, Fin., Com., Vis. |
| [Comunicação](MANUAL_DO_APP.md#guia-chat) | `chat` | Encontrar prioridades da equipe e consultar tarefas na origem. | Admin, Eng., Aud., Compras, RH, Fin., Com., Vis. |
| [Minhas aprovações](MANUAL_DO_APP.md#guia-aprov_pend) | `aprov_pend` | Conferir as decisões formais que aguardam sua análise. | Admin, Eng., Aud., Compras, RH, Fin., Com., Vis. |

### Financeiro

| Aba | ID | Tarefa principal | Perfis padrão |
| --- | --- | --- | --- |
| [Gestão financeira](MANUAL_DO_APP.md#guia-fin) | `fin` | Organizar a rotina de documentos, pagamentos, caixa e resultado. | Admin, Fin. |
| [Medições a faturar](MANUAL_DO_APP.md#guia-medicoes) | `medicoes` | Acompanhar o faturamento e o saldo a receber de cada parcela. | Admin, Fin. |
| [Caixa da obra](MANUAL_DO_APP.md#guia-caixa) | `caixa` | Registrar e conferir o dinheiro disponível e as despesas pagas pelo caixa de uma obra. | Admin, Eng., Aud., Fin. |
| [Conciliação](MANUAL_DO_APP.md#guia-conc) | `conc` | Relacionar movimentos do extrato bancário aos registros do sistema. | Admin, RH, Fin. |

### Obras e projetos

| Aba | ID | Tarefa principal | Perfis padrão |
| --- | --- | --- | --- |
| [Obras](MANUAL_DO_APP.md#guia-obras) | `obras` | Localizar, cadastrar e abrir uma obra. | Admin, Eng., Aud. |
| [Projetos](MANUAL_DO_APP.md#guia-projetos) | `projetos` | Organizar o acompanhamento dos projetos de engenharia. | Admin, Eng., Aud. |
| [Arquivos](MANUAL_DO_APP.md#guia-arquivos) | `arquivos` | Reunir documentos por obra, com pastas, links, uploads e controle de acesso. | Admin, Eng., Aud., Compras, RH, Fin., Com. |
| [Orçamento](MANUAL_DO_APP.md#guia-orc) | `orc` | Organizar os serviços, quantidades e preços previstos para a obra. | Admin, Eng., Aud. |
| [Planejamento](MANUAL_DO_APP.md#guia-plan) | `plan` | Distribuir os serviços no tempo e acompanhar o andamento. | Admin, Eng., Aud., Fin. |
| [Marcos e Curva A](MANUAL_DO_APP.md#guia-plan_suprimentos) | `plan_suprimentos` | Relacionar os insumos de maior impacto do orçamento aos prazos da obra. | Admin, Eng., Aud., Compras |
| [Diário de obra](MANUAL_DO_APP.md#guia-rdo) | `rdo` | Levantar diariamente as atividades e a produção da obra, sem repetir dados já cadastrados. | Admin, Eng., Aud. |
| [Avanço físico](MANUAL_DO_APP.md#guia-med) | `med` | Acompanhar a quantidade de serviço executada na obra. | Admin, Eng., Aud. |
| [Conferência](MANUAL_DO_APP.md#guia-conferencia) | `conferencia` | Registrar vistorias e validar correções. | Admin, Eng., Aud. |
| [Licenciamento](MANUAL_DO_APP.md#guia-licenca) | `licenca` | Acompanhar as exigências e etapas de aprovação da obra com evidências documentais. | Admin, Eng., Aud. |

### Compras e suprimentos

| Aba | ID | Tarefa principal | Perfis padrão |
| --- | --- | --- | --- |
| [Compras](MANUAL_DO_APP.md#guia-cmp) | `cmp` | Acompanhar a compra desde a necessidade até a entrega. | Admin, Eng., Aud., Compras, Fin. |
| [Curva e preços](MANUAL_DO_APP.md#guia-suprimentos) | `suprimentos` | Comparar consumo previsto, compras e histórico de preços. | Admin, Eng., Aud., Compras |
| [Estoque](MANUAL_DO_APP.md#guia-est) | `est` | Acompanhar materiais que entraram, saíram ou foram transferidos. | Admin, Eng., Aud., Compras |
| [Fornecedores](MANUAL_DO_APP.md#guia-fornecedores) | `fornecedores` | Consultar fornecedores e seu histórico de atendimento. | Admin, Eng., Aud., Compras, Fin. |

### Equipamentos e locações

| Aba | ID | Tarefa principal | Perfis padrão |
| --- | --- | --- | --- |
| [Locação de equipamentos](MANUAL_DO_APP.md#guia-equip_fin) | `equip_fin` | Acompanhar contratos e valores das locações. | Admin, Fin. |
| [Equipamentos](MANUAL_DO_APP.md#guia-equip) | `equip` | Controlar equipamentos nas obras. | Admin, Eng., Aud. |

### Pessoas e terceiros

| Aba | ID | Tarefa principal | Perfis padrão |
| --- | --- | --- | --- |
| [Equipes](MANUAL_DO_APP.md#guia-equipe) | `equipe` | Gerir vínculos e desligamentos. | Admin, Eng., Aud., RH |
| [Equipe nas Obras](MANUAL_DO_APP.md#guia-equipe_obras) | `equipe_obras` | Conferir a distribuição da equipe. | Admin, Eng., Aud., RH |
| [Ponto por obra](MANUAL_DO_APP.md#guia-ponto) | `ponto` | Conferir a presença e os registros da equipe em uma obra. | Admin, Eng., RH |
| [Gestão do ponto](MANUAL_DO_APP.md#guia-ponto_geral) | `ponto_geral` | Conferir o ponto da equipe no período. | Admin, RH |
| [Ponto eletrônico (app)](MANUAL_DO_APP.md#guia-ponto_app) | `ponto_app` | Conferir aparelhos, batidas e fotos. | Admin, Eng., RH |
| [Folha](MANUAL_DO_APP.md#guia-folha) | `folha` | Conferir o cálculo e os documentos da folha de pagamento. | Admin, RH |
| [Rescisão](MANUAL_DO_APP.md#guia-resc) | `resc` | Conferir parcelas e descontos da rescisão. | Admin, RH |
| [Terceirizados](MANUAL_DO_APP.md#guia-terc) | `terc` | Acompanhar contratos e serviços de equipes terceirizadas. | Admin, Eng., Aud., RH |
| [Indicadores](MANUAL_DO_APP.md#guia-rh_indic) | `rh_indic` | Consultar os indicadores da equipe e do período. | Admin, RH |

### Comercial

| Aba | ID | Tarefa principal | Perfis padrão |
| --- | --- | --- | --- |
| [Comercial da empresa](MANUAL_DO_APP.md#guia-com_workspace) | `com_workspace` | Use esta tela para organizar a rotina comercial. | Admin, Com. |
| [Venda de imóveis](MANUAL_DO_APP.md#guia-com_real_estate) | `com_real_estate` | Use esta tela para acompanhar a comercialização de imóveis. | Admin, Com. |
| [Pipeline](MANUAL_DO_APP.md#guia-com_pipeline) | `com_pipeline` | Use esta tela para acompanhar oportunidades por etapa. | Admin, Com. |
| [Relacionamentos](MANUAL_DO_APP.md#guia-com_relationships) | `com_relationships` | Use esta tela para organizar contatos de clientes e parceiros. | Admin, Com. |
| [Propostas e contratos](MANUAL_DO_APP.md#guia-com_deals) | `com_deals` | Use esta tela para acompanhar documentos comerciais e seus negócios. | Admin, Com. |
| [Gestão comercial](MANUAL_DO_APP.md#guia-com_management) | `com_management` | Use esta tela para conferir o desempenho e a organização comercial. | Admin, Com. |
| [Dashboard (atalho)](MANUAL_DO_APP.md#guia-com_dash) | `com_dash` | Use esta tela para acompanhar os resultados comerciais. | Admin |
| [Indicações (atalho)](MANUAL_DO_APP.md#guia-com_indicacoes) | `com_indicacoes` | Use esta tela para registrar pessoas e negócios indicados. | Admin |
| [Leads (atalho)](MANUAL_DO_APP.md#guia-com_leads) | `com_leads` | Use esta tela para registrar possíveis clientes. | Admin, Com. |
| [Funil (atalho)](MANUAL_DO_APP.md#guia-com_funil) | `com_funil` | Use esta tela para acompanhar a etapa de cada oportunidade. | Admin, Com. |
| [Jornada (atalho)](MANUAL_DO_APP.md#guia-com_jornada) | `com_jornada` | Use esta tela para consultar a sequência de interações comerciais. | Admin |
| [Agenda (atalho)](MANUAL_DO_APP.md#guia-com_agenda) | `com_agenda` | Use esta tela para organizar compromissos comerciais. | Admin, Com. |
| [Reuniões (atalho)](MANUAL_DO_APP.md#guia-com_reunioes) | `com_reunioes` | Use esta tela para acompanhar reuniões com clientes e parceiros. | Admin |
| [Tarefas (atalho)](MANUAL_DO_APP.md#guia-com_tarefas) | `com_tarefas` | Use esta tela para acompanhar ações da equipe comercial. | Admin |
| [Propostas (atalho)](MANUAL_DO_APP.md#guia-com_propostas) | `com_propostas` | Use esta tela para preparar e acompanhar uma oferta ao cliente. | Admin, Com. |
| [Negociações (atalho)](MANUAL_DO_APP.md#guia-com_negociacoes) | `com_negociacoes` | Use esta tela para acompanhar as condições discutidas com o cliente. | Admin, Com. |
| [Contratos (atalho)](MANUAL_DO_APP.md#guia-com_contratos) | `com_contratos` | Cadastrar, conferir e acompanhar contratos por cliente e obra. | Admin, Com. |
| [Clientes (atalho)](MANUAL_DO_APP.md#guia-com_clientes) | `com_clientes` | Use esta tela para consultar o cadastro de quem contrata a empresa. | Admin |
| [Parceiros (atalho)](MANUAL_DO_APP.md#guia-com_parceiros) | `com_parceiros` | Use esta tela para organizar os parceiros comerciais. | Admin, Com. |
| [Metas e comissões (atalho)](MANUAL_DO_APP.md#guia-com_metas) | `com_metas` | Use esta tela para acompanhar objetivos e valores comerciais. | Admin, Com. |
| [Perdas (atalho)](MANUAL_DO_APP.md#guia-com_perdas) | `com_perdas` | Use esta tela para entender por que oportunidades não avançaram. | Admin |
| [Relatórios (atalho)](MANUAL_DO_APP.md#guia-com_relatorios) | `com_relatorios` | Use esta tela para analisar os negócios e resultados comerciais. | Admin, Com. |

### Administração

| Aba | ID | Tarefa principal | Perfis padrão |
| --- | --- | --- | --- |
| [Central do administrador](MANUAL_DO_APP.md#guia-admin_central) | `admin_central` | Conferir acessos, pendências e funcionamento do sistema. | Admin |
| [Patrimônio da empresa](MANUAL_DO_APP.md#guia-patrimonio) | `patrimonio` | Localizar bens e responsáveis. | Admin, Compras, Fin. |
| [Cadastros](MANUAL_DO_APP.md#guia-cad) | `cad` | Manter as informações usadas pelos outros módulos. | Admin, Eng., Aud., Compras, RH |
| [Ajustes](MANUAL_DO_APP.md#guia-config) | `config` | Manter parâmetros e configurações da empresa. | Admin |
| [IA](MANUAL_DO_APP.md#guia-ia) | `ia` | Pedir apoio para consultar e interpretar informações do sistema. | Admin, Eng., Aud., Compras, RH, Fin., Com. |
| [Configurar Gemini](MANUAL_DO_APP.md#guia-ia_config) | `ia_config` | Configurar a integração de inteligência artificial. | Admin |
| [Telas antigas](MANUAL_DO_APP.md#guia-obsoletos) | `obsoletos` | Consultar funções antigas preservadas no sistema. | Admin, Eng., Aud. |

### Navegação dentro da obra

- **Geral** · Visão geral
- **Obra** · Orçamento, Planejamento, Diário de obra, Medição física, Segurança
- **Gestão da qualidade** · FVS / FVM, Conferência
- **Suprimentos** · Compras, Estoque
- **Financeiro** · DRE da obra
- **RH** · Ponto, Equipe, Terceiros
- **Recursos** · Equipamentos, Licenciamento, Pastas do OneDrive, Portal do cliente

O Portal do cliente aparece no grupo Recursos para administradores. A visão geral da obra possui seções próprias. As rotas de consulta acessadas por clientes, materiais de treinamento e fluxos internos aparecem nos guias complementares.

### Guias complementares

A lista abaixo inclui guias de subtelas, tarefas transversais e recursos externos ao menu principal. Um guia pode descrever várias telas.

- [Financeiro · Previsões gerenciais](MANUAL_DO_APP.md#guia-fin_previsoes)
- [Previsões · Relatório para diretoria](MANUAL_DO_APP.md#guia-fin_previsoes_executive)
- [Previsões · Indicadores da obra](MANUAL_DO_APP.md#guia-fin_previsoes_kpis)
- [Previsões · Caixa de 13 semanas](MANUAL_DO_APP.md#guia-fin_previsoes_cash)
- [Previsões · Custo final por obra](MANUAL_DO_APP.md#guia-fin_previsoes_cost)
- [Previsões · Mão de obra](MANUAL_DO_APP.md#guia-fin_previsoes_labor)
- [Ponto diário · Pessoal de obra](MANUAL_DO_APP.md#guia-ponto_obras)
- [Ponto diário · Administrativo](MANUAL_DO_APP.md#guia-ponto_central)
- [Gestão do ponto · Pessoal de obra](MANUAL_DO_APP.md#guia-ponto_geral_obras)
- [Gestão do ponto · Administrativo](MANUAL_DO_APP.md#guia-ponto_geral_central)
- [Folha · Pessoal de obra](MANUAL_DO_APP.md#guia-folha_obras)
- [Folha · Administrativo](MANUAL_DO_APP.md#guia-folha_central)
- [Visão geral da obra](MANUAL_DO_APP.md#guia-obra_geral)
- [Compras · Solicitar](MANUAL_DO_APP.md#guia-cmp_solicitacoes)
- [Compras · Pedido por texto ou print](MANUAL_DO_APP.md#guia-cmp_mensagem)
- [Compras · Cotar](MANUAL_DO_APP.md#guia-cmp_cotacoes)
- [Compras · Aprovações](MANUAL_DO_APP.md#guia-cmp_aprovacoes)
- [Compras · Pedidos](MANUAL_DO_APP.md#guia-cmp_pedidos)
- [Compras · Receber](MANUAL_DO_APP.md#guia-cmp_recebimentos)
- [Folha · Pendências do RH](MANUAL_DO_APP.md#guia-folha_pendencias)
- [Financeiro · Hoje](MANUAL_DO_APP.md#guia-fin_hoje)
- [Financeiro · Documentos](MANUAL_DO_APP.md#guia-fin_documentos)
- [Financeiro · Conferência fiscal](MANUAL_DO_APP.md#guia-fin_fiscal)
- [Financeiro · Pagamentos](MANUAL_DO_APP.md#guia-fin_pagamentos)
- [Financeiro · Caixa](MANUAL_DO_APP.md#guia-fin_caixa)
- [Financeiro · Fechamento](MANUAL_DO_APP.md#guia-fin_fechamento)
- [Financeiro · Visão financeira](MANUAL_DO_APP.md#guia-fin_visao)
- [Financeiro · Custos por etapa](MANUAL_DO_APP.md#guia-fin_etapas)
- [Financeiro · Vínculo de contratos à previsão](MANUAL_DO_APP.md#guia-fin_vinculos)
- [Financeiro · Relatórios financeiros](MANUAL_DO_APP.md#guia-fin_relatorios)
- [Financeiro · Administrativo](MANUAL_DO_APP.md#guia-fin_administrativo)
- [Financeiro · Homologação](MANUAL_DO_APP.md#guia-fin_homologacao)
- [Financeiro · Modo IA](MANUAL_DO_APP.md#guia-fin_ia)
- [Ajustes · Minha equipe](MANUAL_DO_APP.md#guia-config_membros)
- [Financeiro · Relatório completo por obra](MANUAL_DO_APP.md#guia-fin_relatorios_obra)
- [FVS / FVM](MANUAL_DO_APP.md#guia-obra_qualidade)
- [Segurança da obra](MANUAL_DO_APP.md#guia-obra_seguranca)
- [Portal do cliente](MANUAL_DO_APP.md#guia-obra_portal)
- [Financeiro · Previsão de custo final](MANUAL_DO_APP.md#guia-fin_previsao)
- [Obra · Mudanças e aditivos](MANUAL_DO_APP.md#guia-obra_aditivos)
- [Arquivos · Revisões, busca e comparação](MANUAL_DO_APP.md#guia-arquivos_revisoes)
- [Arquivos · Dossiê de licenciamento](MANUAL_DO_APP.md#guia-arquivos_dossie)
- [Compras · Contratos e medições](MANUAL_DO_APP.md#guia-cmp_contratos)
- [Compras · Ficha rápida](MANUAL_DO_APP.md#guia-cmp_ficha)
- [Financeiro · Ficha rápida](MANUAL_DO_APP.md#guia-fin_ficha)
- [Compras · Registrar pagamento](MANUAL_DO_APP.md#guia-cmp_pagamento)
- [Retomar trabalho salvo](MANUAL_DO_APP.md#guia-fin_recuperacao)
- [Retomar trabalho salvo](MANUAL_DO_APP.md#guia-cmp_recuperacao)
- [Recuperar salvamento](MANUAL_DO_APP.md#guia-home_recuperacao)
- [Planejamento · Linha de base aprovada e SPI](MANUAL_DO_APP.md#guia-plan_baseline)
- [Previsões · Indicadores contábeis](MANUAL_DO_APP.md#guia-fin_previsoes_accounting)
- [Previsões · Bases contábeis e conferência](MANUAL_DO_APP.md#guia-fin_previsoes_accounting_base)
- [Relatórios · Identidade do documento](MANUAL_DO_APP.md#guia-report_identity)
- [Comercial · Preenchimento e revisão de contratos](MANUAL_DO_APP.md#guia-com_contratos_editor)
- [Comercial · Modelos e contratada](MANUAL_DO_APP.md#guia-com_contratos_modelos)
- [Financeiro · Cobertura do estoque](MANUAL_DO_APP.md#guia-fin_estoque)
- [Terceiros · Garantia técnica das medições](MANUAL_DO_APP.md#guia-terc_garantia)
- [Financeiro · Colunas das tabelas](MANUAL_DO_APP.md#guia-fin_colunas)
- [Cliente · Entrar no portal](MANUAL_DO_APP.md#guia-cliente_login)
- [Cliente · Acompanhamento da obra](MANUAL_DO_APP.md#guia-cliente_inicio)
- [Cliente · Diário da obra](MANUAL_DO_APP.md#guia-cliente_fotos)
- [Cliente · Avanço físico](MANUAL_DO_APP.md#guia-cliente_progresso)
- [Cliente · Gastos por categoria](MANUAL_DO_APP.md#guia-cliente_gastos)
- [Cliente · Extrato do caixa da obra](MANUAL_DO_APP.md#guia-cliente_caixa)
- [Cliente · Previsto e realizado por etapa](MANUAL_DO_APP.md#guia-cliente_orcamento)
- [Cliente · Compras e notas fiscais](MANUAL_DO_APP.md#guia-cliente_compras)
- [Folha · Reservas no repasse ao cliente](MANUAL_DO_APP.md#guia-folha_repasse)
- [Cliente · Administração e equipe](MANUAL_DO_APP.md#guia-cliente_administracao_equipe)
- [Cliente · Contrato e recebimentos](MANUAL_DO_APP.md#guia-cliente_financeiro)
- [Cliente · Documentos da obra](MANUAL_DO_APP.md#guia-cliente_documentos)
- [Cliente · Decisões e alterações](MANUAL_DO_APP.md#guia-cliente_decisoes)
- [Cliente · Consulta de transparência](MANUAL_DO_APP.md#guia-cliente_transparencia)
- [Cliente · Alterar senha e sair](MANUAL_DO_APP.md#guia-cliente_conta)
- [Administrador · Login e senha dos clientes](MANUAL_DO_APP.md#guia-cliente_acessos)
- [Conciliação · Vincular extrato à conta](MANUAL_DO_APP.md#guia-conc_vincular_ofx)
- [Conciliação · Reversão de importações bancárias](MANUAL_DO_APP.md#guia-conc_reverter)
- [Orçamento · Hierarquia de seis níveis](MANUAL_DO_APP.md#guia-orc_estrutura)
- [Orçamento · Comparar revisões](MANUAL_DO_APP.md#guia-orc_revisoes)
- [Conexão local do financeiro](MANUAL_DO_APP.md#guia-cliente_conexao_financeiro)
- [Arquivos · Exclusão e lixeira](MANUAL_DO_APP.md#guia-arquivos_exclusao)
- [Terceirizados · Recuperar medição](MANUAL_DO_APP.md#guia-terc_rascunho)
- [Apagar conciliação na simulação local](MANUAL_DO_APP.md#guia-conc_apagar_local)
