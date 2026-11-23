# Roteiro de revisão do ERP MARCELL com Unslop

Revisão de 23/11/2026. Roteiro consolidado e balanço do primeiro ciclo local.

A etapa 0 está registrada no [inventário e diagnóstico inicial](INVENTARIO-UNSLOP-ERP-MARCELL.md), com a matriz de acesso e as capturas da Dashboard e de Obras → Orçamento. O primeiro lote foca em reduzir a distância até a busca e a planilha no celular.

## Fechamento do primeiro ciclo

| Frente | Situação ao fechar o roteiro |
| --- | --- |
| Inventário | Concluído para 65 entradas, oito perfis padrão e 147 guias. A matriz registra o que está disponível por acesso padrão. |
| Dashboard e Obras → Orçamento | Piloto entregue localmente. Busca acessível pelo cabeçalho, competência junto aos indicadores e planilha móvel com total visível e detalhes expansíveis. |
| Densidade compartilhada | Aplicada ao ERP web no computador e no celular, nos sete temas. A conferência móvel anterior cobriu a abertura das 65 entradas no Preciso e amostras dos oito módulos nos outros temas. |
| Revisão individual por módulo | Escopo e critérios definidos nas etapas 2 a 7. Cada entrega funcional e suas exceções precisam de validação própria. |
| Uso com operadores | Roteiro e cenário de ensaio disponíveis. A medição com Gestão, Engenharia e RH continua pendente. [Piloto da Dashboard](VALIDACAO-DASHBOARD-ROADMAP.md). |

As alterações entregues concentram-se em navegação, apresentação e densidade. A busca do Orçamento foi conferida com o mesmo valor total antes e depois. Nenhuma regra de negócio ou cálculo do DRE foi alterado. A prévia local com API fictícia é `http://127.0.0.1:4274`. Use `piloto@local.test` e `piloto-local`.

### Verificações de encerramento

Passaram o placar com texto a 200% no desktop e no celular, os dois testes de PDF (relatório A4 e exportação da folha), 21 testes automatizados do Portal do cliente e `npm run manual:check`. Os quatro cenários de Medições a faturar passaram considerando o reteste isolado do Preciso a 390 px, que excedeu o tempo na primeira rodada.

Na rodada de navegação, quatro verificações esperavam títulos de 24 px em Compras e Financeiro. A comparação com a prévia anterior confirmou 22 px no desktop e no celular daquela versão. Na prévia atual são 22 px no desktop e 18 px no celular compacto. A rodada também registrou duas falhas de navegação móvel, no acesso a Visão gerencial pelo diálogo e na localização da região Competência e escopo da folha. As falhas seguem na fila de verificação dos fluxos correspondentes.

## Entrega local do piloto

O cabeçalho da Dashboard passou a oferecer **Buscar obra no placar**. O botão leva o foco até o campo já existente. Os controles de competência ficam junto aos indicadores mensais. No Orçamento da obra, o celular mostra o total da versão e recolhe seu detalhamento em **Ver composição**. A origem e a data dos preços ficam em **Dados e versões**. **Opções da planilha** reúne colunas, expansão das etapas e pavimentos.

| Medida no MARCELL Plataforma a 390 px | Antes | Depois |
| --- | ---: | ---: |
| Início da área de busca no Placar | 1.177 px | 1.075 px, com atalho no cabeçalho |
| Início do campo de busca do Orçamento | 747 px | 620 px |
| Início da primeira célula editável | 1.006 px | 783 px |

As medidas foram coletadas com dados fictícios e posição inicial de rolagem. Em 390 × 844 px, a primeira célula do Orçamento chega à região da barra inferior. Para editá-la por completo, é preciso rolar mais um pouco. [Dashboard no celular](../artifacts/unslop-erp-piloto/dashboard-plataforma-390.png) · [Orçamento no celular](../artifacts/unslop-erp-piloto/orcamento-plataforma-390.png).

Foram conferidos foco de busca, troca de competência, totais, abertura da versão única e lista com duas versões. O ensaio no navegador abrangeu 1440 e 390 px, nos temas Plataforma, Preciso, Noite e Cristal. Os 389 testes selecionados de Dashboard, Orçamento e Ajuda e os quatro testes Playwright do Orçamento passaram. O detector do Impeccable levantou avisos em estilos preexistentes do Orçamento. Os controles introduzidos usam os componentes compartilhados.

`npm run validate:local` passou pelo lint, arquitetura e tipos. O build nesse comando encontrou um bloqueio de arquivo no `dist` padrão. A compilação passou na saída isolada com `npm run build:local -- --outDir artifacts/unslop-erp-piloto/dist`, servida na porta 4268. A ajuda e o manual foram atualizados e sincronizados. Os totais da amostra antes e depois coincidiram e a mudança é de apresentação, sem efeito no DRE. A rodada com operadores e a validação de impressão ficam pendentes.

### Ajuste de densidade no celular

A densidade Compacta do MARCELL Plataforma passa a usar títulos de página de 18 px, títulos de seção de 14 px, corpo e botões de 12 px e seletores de 13 px no ERP móvel. Os campos de digitação mantêm 16 px. A barra superior, os blocos e as linhas do placar usam recuos menores. A densidade Confortável oferece a escala anterior no celular.

No viewport de 390 × 844 px, a área de busca no Placar subiu de 1.075 para 1.015 px e a primeira célula do Orçamento subiu de 783 para 752 px após o ajuste de densidade. O foco do atalho da Dashboard e o total de R$ 61.950,00 na amostra foram conferidos. A alteração usa a escala e a composição do tema e não tem efeito no DRE. [Dashboard compacta](../artifacts/unslop-erp-compacto/dashboard-plataforma-390.png) · [Orçamento compacto](../artifacts/unslop-erp-compacto/orcamento-plataforma-390.png).

Lint, arquitetura, tipos e compilação isolada passaram. Foram executados 115 testes selecionados e seis testes Playwright. A revisão em Chromium incluiu Plataforma, Preciso, Noite e Cristal em 1440 e 390 px, texto ampliado no Orçamento móvel e alternância entre Compacta e Confortável. Prévia do ajuste na porta 4269.

### Aplicação da densidade em todo o ERP web

A escala móvel Compacta foi transferida do CSS do Plataforma para o contrato compartilhado. Os sete temas agora usam a mesma escala e os mesmos recuos do conteúdo no modo Compacta. A aplicação inclui os módulos antigos do ERP, além dos espaços de trabalho que já consumiam a base. A escolha de aparência continua disponível normalmente.

A matriz de verificação em Chromium passou em 118 cenários com dados fictícios. Foram abertas as 65 entradas no Preciso a 390 px e uma tela de cada um dos oito módulos nos seis temas restantes. Quatro temas foram conferidos no desktop, além de uma abertura com densidade Confortável no celular. As verificações cobriram abertura, escala calculada, ausência de rolagem horizontal da página e 44 px nos seletores de cabeçalho observados. As tarefas completas de cada módulo não fazem parte dessa matriz. Os 115 testes selecionados e os seis testes de navegador de aparência e Orçamento também passaram, assim como lint, arquitetura, tipos e build isolado. A ajuda e o manual foram atualizados. Trata-se de apresentação, sem efeito nos dados ou no DRE. Prévia na porta 4270. [Compras](../artifacts/unslop-erp-compacto-geral/marcell-cmp-390.png) · [Financeiro](../artifacts/unslop-erp-compacto-geral/noite-fin-390.png) · [Gestão do Ponto](../artifacts/unslop-erp-compacto-geral/cristal-ponto_geral-390.png).

### Extensão da densidade ao desktop

Com a densidade Compacta, os títulos de página ficam em 20 px no desktop e 18 px no celular. Texto, rótulos, botões e tabelas usam 12 px. Os painéis e os intervalos entre caixas passam a 8 px pela base compartilhada. No computador, o conteúdo usa 16 px de margem lateral e 12 px de recuo vertical. A ajuda e o manual indicam onde alternar para Confortável. A mudança é de CSS e apresentação, sem integração de dados ou efeito no DRE.

Em Chromium a 1440 px, as 64 entradas operacionais abriram no Preciso com a escala esperada, sem rolagem horizontal da página ou erro de JavaScript. O Modo TV tem escala própria. A validação dos sete temas em Compras conferiu os tamanhos a 1440 e 390 px e a volta à densidade Confortável. Passaram 14 cenários Playwright, incluindo Obras, Orçamento e Dashboard com texto ampliado, 96 testes do sistema de design e ajuda, lint, arquitetura, tipos e build local isolado. A revisão visual comparou a hierarquia, as margens e a leitura da fila em Compras e inspecionou Obras no desktop. [Matriz de abertura](../artifacts/unslop-erp-desktop/matriz-final/resultados.json) · [Central de Obras](../artifacts/unslop-erp-desktop/matriz-final/obras.png).

### Correção do acesso e da densidade aplicada

A prévia estática anterior não atendia a chamada de login. O servidor local de demonstração passou a servir também a compilação e sua API fictícia na mesma porta. O login foi confirmado diretamente no navegador com a conta de demonstração. Para reproduzir em PowerShell, compile para uma saída isolada com `npm run build:local -- --outDir artifacts/unslop-erp-revisao/dist`, configure `MARCELL_PREVIEW_BUILD` com esse caminho e `MARCELL_PREVIEW_PORT` com a porta local escolhida e execute `node scripts/rebranding-pilot-preview.mjs`.

Os diálogos abertos fora da área de trabalho passaram a receber a escala Compacta, incluindo os formulários antigos. O menu lateral e os controles de uma linha no desktop usam 32 px no contrato compartilhado. Os cabeçalhos e indicadores que usavam valores fixos passaram a acompanhar a escala. No celular, a medição do formulário de Compras confirmou 44 px no seletor. A mudança é de apresentação e não altera o DRE.

Na compilação corrigida, a abertura das 64 entradas operacionais em 1440 px voltou a passar na matriz. Passaram os 14 cenários de navegador em 1440 e 390 px, incluindo os sete temas em Compras, a janela Nova solicitação, a planilha e o placar com texto ampliado. Também passaram os 96 testes do sistema de design e da ajuda, o lint, a arquitetura, os tipos e o build isolado. [Antes em Compras](../artifacts/unslop-erp-revisao/antes-compras-1440.png) · [Depois em Compras](../artifacts/unslop-erp-revisao/final-compras-1440.png).

### Aplicação das nove passagens à base do ERP

**Produto.** Gestão acompanha obras, Engenharia executa o plano e as equipes de apoio conferem os registros da operação.

**Caráter.** Preciso, sóbrio e legível.

**Referência.** Prancha de obra, azul-ardósia e Inter no Plataforma.

**Destaque.** Placar das obras, planilha, registros e indicadores de cada operação.

**Assinatura.** A malha discreta remete à grade de projeto e o emblema identifica o ambiente MARCELL.

| Passagem | Achado e ajuste |
| --- | --- |
| Espaçamento | Estados vazios, cabeçalhos e grupos de ações usavam distâncias fixas. A base passou a usar os recuos da densidade e os espaços dos cabeçalhos. |
| Cor | O vidro de Plataforma somava gradiente, brilho e sombra. O plano de fundo preserva a malha e o emblema. Painéis usam a superfície do tema e formulários sobrepostos têm fundo sólido nos temas. |
| Ícones | A barra inferior misturava caracteres de texto e ícones de dimensões diferentes. Mais usa ícone de linha e os ícones da navegação usam a mesma dimensão. |
| Texto | O estado de espera repetia a instrução de aguardar. Ele mantém o anúncio e o contexto da atividade. A ajuda descreve o menu Mais e os filtros em telas estreitas. |
| Tipografia | Cabeçalhos de tabelas herdavam caixa alta e espaçamento de letras. O contrato usa o texto do rótulo e preserva o peso do tema. |
| Composição | A grade de filtros forçava uma coluna até 767 px. O arranjo comum agora depende do espaço disponível. Em Gestão do ponto, Mês e Ano compartilham a linha em telas estreitas. No Comercial, as seis etapas do funil se reorganizam conforme a largura. |
| Acabamento | O foco permanece visível. Estados de erro usam a borda semântica e os toques usam o mínimo compartilhado. |
| Visuais | A malha e o emblema preservam a identidade. Os dados do placar, a planilha e as visualizações dos módulos ocupam o primeiro plano. |
| Movimento | Entradas em cascata e ciclos contínuos de clima foram removidos. A espera conserva seu indicador, e entradas e transições restantes usam os padrões do projeto. |

As alterações são de apresentação e navegação visual. Nenhuma origem de dados, regra de cálculo ou valor reconhecido no DRE foi alterado. Os controles e os percursos de trabalho continuam descritos na ajuda e no manual.

Em Comercial da empresa, o resumo afirma se houve vendas no mês, mostra a conversão com vírgula e retira barras e alertas decorativos quando o valor é zero. A distribuição desenha a proporção dos registros da própria carteira. Em Folha, a verificação móvel abre Competência e escopo antes de conferir o período. Em Mais, a verificação navega pelos oito módulos.

A matriz visual antes e depois cobriu as 64 entradas operacionais em 1440 e 390 px com Plataforma e dados de teste. A matriz final passou em 128 aberturas sem rolagem horizontal da página ou erro de JavaScript. As capturas incluem Dashboard, Obras, Orçamento, Compras, Financeiro, Gestão do ponto, Equipamentos, Comercial e Administração. Passaram 29 casos de navegador e 229 testes de design, navegação móvel, ajuda, Comercial e Portal do cliente. Lint, arquitetura, tipos, build local e a análise dos componentes compartilhados com Impeccable passaram. A sessão de demonstração também foi testada sem interceptar a API. O Modo TV, as saídas de impressão e as tarefas completas de cada perfil ficam fora da matriz de abertura. [Capturas e matriz final](../artifacts/unslop-ciclo-integral/validado/).

### Obras, Orçamento, Planejamento e Diário de obra

Na planilha, **Controle ativo** identifica a versão em uso. Ao consultar outra versão, a barra informa o número e o nome da que continua ativa. No Planejamento, a origem do orçamento aparece logo após a obra e antes das ferramentas do cronograma. Em **Novo serviço**, o Diário mostra a versão de controle antes da escolha do item ou avisa que a base está ausente.

O Planejamento e o levantamento diário continuam usando os vínculos existentes por obra, versão e item. A interface exibe a referência que esses fluxos já consultavam. A mudança de apresentação não grava registros nem altera valores no DRE.

O percurso com a obra fictícia Residencial Horizonte preservou a V3 aprovada do Orçamento até Novo serviço no Diário. A seleção do item carregou a unidade da planilha. A conferência incluiu 1440 e 390 px, nos temas Preciso, Noite e Plataforma. Passaram oito cenários Playwright, 90 testes de domínio e ajuda, lint, arquitetura, tipos e build local. A análise do Impeccable registrou avisos de estilos legados nas telas extensas. [Capturas dos testes](../artifacts/unslop-obras-execucao/validado/).

### Licenciamento, qualidade e medição técnica

**Licenciamento.** A situação dos documentos aparece logo após a obra. Os detalhes continuam em **Condomínio e procedimento**, seção expansível no celular. A borda das condições de entrada usa a cor semântica e o seletor de responsável preserva seu indicador de foco.

**Qualidade.** A faixa de indicadores usa o padrão MARCELL e destaca a contagem de não conformidades quando há casos. A tela identifica a versão de controle usada para gerar fichas. Quando a base está ausente, a orientação aparece antes da lista e o botão de geração fica desabilitado. As fichas existentes podem ser consultadas.

**Medição física.** O cabeçalho identifica a base de controle e distingue a consulta de evolução do boletim aprovado. O título e a busca por serviço permanecem juntos. A validação de qualidade da medição continua no comando existente. Nenhum registro, integração ou valor da DRE foi alterado nesta revisão de interface.

O Residencial Horizonte permaneceu selecionado no percurso, e Qualidade e Medição física exibiram a V3 de controle da amostra. Passaram 14 cenários de navegador em desktop e celular, incluindo Plataforma, Preciso e Noite, 112 testes automatizados, lint, arquitetura, tipos, build e verificação do manual. O detector Impeccable ainda reportou estilos legados nos arquivos extensos. [Capturas da validação](../artifacts/unslop-obras-controle/tests/).

### Compras, estoque e equipamentos

**Compras.** O formulário usado por **Receber** e **Chegou** identifica a obra que recebe o material antes da quantidade. A entrada parcial continua mostrando o saldo do pedido. O valor dos materiais da entrada e o pagamento aparecem com rótulos distintos.

**Estoque.** Em **Movimentos**, a entrada que tem um pedido vinculado abre a ficha exata em Compras, com o recorte de obra. O botão exige acesso a Compras, o identificador existente do pedido e a mesma obra do movimento. A consulta usa os vínculos gravados pelo recebimento. A aba e a pesquisa ficam preservadas na sessão. O aviso de reposição explicita o conjunto de obras abrangido na tela geral.

**Equipamentos.** Em Obras, o cabeçalho identifica a obra de referência e explicita que novas locações já usam esse preenchimento. O período continua visível junto às áreas de trabalho.

O recebimento físico usa o comando já existente, que registra entrada, obra, item e pedido. A consulta da origem é navegação e não grava dados. Compromisso, estoque físico, custo reconhecido e pagamento continuam registrados em seus fluxos de origem. A revisão não mudou regras de apropriação nem valores no DRE.

O teste de contexto usou dois pedidos com o mesmo número em obras distintas. O vínculo abriu o pedido do Residencial Horizonte e o retorno conservou a busca e a aba Movimentos. A ficha passou a mostrar a obra de cada pedido. Também foram conferidos recebimento parcial, diferença acima do saldo, continuidade de solicitação a pedido e operação da central de locações. Passaram 15 cenários de navegador, incluindo Plataforma, Preciso e Noite em desktop e celular, 702 testes automatizados, lint, arquitetura, tipos, build e verificação do manual. [Capturas do vínculo de origem](../artifacts/unslop-suprimentos/validado/).

### Financeiro, DRE e relatórios

Os filtros de mês e ano aparecem no Painel analítico, no Relatório executivo e em Recebimento por administração. Caixa de obra identifica o saldo acumulado. Relatório de compras usa De e Até pela data do pedido. No Painel analítico, a obra e o período dos indicadores também identificam o recorte de Exportar base. No celular, o filtro de obra e a exportação cabem na mesma linha a 390 px.

A ficha de pagamento mostra a obra da obrigação, o fornecedor, o valor e o saldo a pagar. Data do pagamento identifica o dia da saída. Em DRE obras, o recorte lê a mesma obra usada pela consulta. A ajuda e o manual descrevem esses controles.

O relatório por obra consultou R$ 230,00 de custo reconhecido na Obra Alfa e R$ 890,00 na Obra Beta. CSV, Excel e PDF respeitaram o recorte usado na consulta. Abrir a obrigação a partir do documento e seguir até o movimento bancário não enviou gravações. A baixa parcial de R$ 40,00 sobre R$ 100,00, com comprovante e vínculo bancário, deixou R$ 60,00 a pagar. A revisão alterou a apresentação. Previsão, compromisso, estoque, reconhecimento de custo e pagamento continuam usando suas origens e regras de apropriação existentes no DRE.

Passaram 22 cenários de navegador com dados de teste, incluindo Relatórios e Contas a pagar em Plataforma, Preciso e Noite a 1440 e 390 px, DRE obras e DRE anual, rastreabilidade e exportações. O teste de exportação desktop foi repetido após corrigir a navegação da automação em uma sessão já aberta no Financeiro. Passaram também 533 testes de ajuda e financeiro, lint, arquitetura, tipos, compilação local e sincronização do manual. A análise do Impeccable apontou ocorrências legadas fora das regiões alteradas. [Evidências locais](../artifacts/unslop-financeiro-contexto/).

### Pessoas, Ponto e Terceiros

**Folha e Ponto.** Revisar ponto abre Gestão do ponto com a mesma obra, mês de referência, ano, ciclo e grupo. Voltar a Folha recupera a consulta. A tela de ponto exibe as datas completas e a obra antes dos filtros. A navegação só está disponível para quem tem acesso à Gestão do ponto.

**Equipes.** Os totais por situação acompanham pesquisa, lotação e pendências, no seletor do celular e nos botões do desktop. **Terceirizados.** Resumo e filas identifica o alcance dos totais. Na central, Obra do cadastro filtra Quadro e Cadastro. Dentro de Obras, o resumo usa a obra aberta. A falta de resultados no Quadro orienta a conferir os filtros.

**DRE.** O atalho transmite somente filtros e os testes verificam que a ida e a volta não enviam gravações. A quinzena de 21/10 a 05/11 mostrou presença, falta e dias sem registro como situações distintas. A origem para a folha e o DRE continua sendo o apontamento da data, com histórico de lotação quando o registro não informa obra. Os testes de folha e DRE cobriram custo antes e depois de transferência e feriado pago pela obra do último dia trabalhado. Na ficha de terceiros, o filtro de cadastro permanece uma consulta, sem efeito em compromisso, medição ou pagamento.

Passaram 18 cenários de interface nos temas Plataforma, Preciso e Noite a 1440 e 390 px, mais quatro cenários de regressão de grupos e fechamento da folha. Os testes de regressão foram atualizados para abrir os filtros recolhidos e acionar o botão da ficha. Passaram 587 testes selecionados e `npm run validate:local`. A ajuda contextual e o manual foram sincronizados. A validação usou dados de teste. [Capturas e validação](../artifacts/unslop-pessoas-ponto/).

### Comercial, Administração e Acessos

**Contratos.** A lista apresenta a proposta registrada no contrato. Pesquisar contrato aceita número ou objeto da proposta. O filtro Obra fica ao lado de Situação no celular. O aviso de emissão ficou recolhível em telas estreitas. Foram conferidos o retorno à ficha do lead, o aproveitamento de dados da obra, a revisão externa e a consulta da via assinada. Duas propostas de mesmo objeto e números distintos confirmaram que a busca usa a proposta vinculada por identificador.

**Administração.** Minha equipe ganhou Restrição por obra em Ajustes e na Central do Administrador. É possível consultar uma obra específica ou os membros sem restrição no cadastro. O filtro não envia gravações. Usuários e permissões abre a ajuda de Minha equipe na Central. Um perfil Comercial limitado à outra obra recebeu apenas os dados liberados pela projeção do servidor.

**DRE.** A pesquisa usa o vínculo comercial já salvo. Os testes conferiram que um contrato de cliente por si só não entra nos compromissos da obra. A revisão não alterou regras de previsão, custo, faturamento ou recebimento.

Passaram 23 cenários de contratos, acessos e navegação, mais 12 de continuidade entre lead, contratos, aprovações e Comunicação. As telas alteradas foram conferidas em Plataforma, Preciso e Noite a 1440 e 390 px. Passaram 192 testes selecionados, a validação local, a compilação e as checagens de interface e manual. A validação usou dados de teste. [Evidências locais](../artifacts/unslop-comercial-acessos/).

### Portal do cliente, Modo TV, impressão e exportações

**Portal do cliente.** Período do arquivo informa o mês da prestação de contas. O download usa o nome com o mês efetivamente processado pelo servidor. Foram conferidos o PDF real, as abas da obra de teste e a proteção de sessão, vínculo e permissão de custos nas rotas de download.

**Modo TV.** O Panorama executivo oferece pausa e navegação manual no início da tela. A pausa mantém página e fotos, com sincronização de dados em segundo plano. A preferência por menos movimento inicia o painel pausado. A contagem usa as pendências abertas, sem incluir resoluções e cancelamentos. Equipe nas Obras foi conferida com paginação, atualização, perda de conexão, tela cheia a 1280 × 720 e perfil sem acesso.

**Impressão e exportação.** Foram conferidas as quatro páginas do relatório contábil, a identidade MARCELL, a prévia, o cancelamento e os valores. CSV, Excel e PDF do relatório por obra respeitaram o recorte consultado. A revisão usa as mesmas origens financeiras, sem alterar previsão, compromisso, estoque, custo reconhecido, pagamento ou DRE.

Passaram 22 cenários de navegador e 103 testes selecionados. O Panorama foi testado em Plataforma, Preciso, Noite e Cristal a 1440 e 390 px. A equipe no Modo TV consultou o fluxo de registros do app com dados simulados. A atualização foi aplicada à prévia local. A ajuda e o manual foram sincronizados. [Capturas e evidências](../artifacts/unslop-fechamento-erp/).

## Direção

O ERP deve ajudar Gestão, Engenharia, Compras, Financeiro e RH a identificar o que exige atenção, encontrar o registro certo e passar de uma etapa à outra com obra, período e filtros consistentes. A Dashboard MARCELL Plataforma é a referência de identidade, com fonte Inter, contraste e densidade compacta. A estação de trabalho precisa oferecer leitura rápida em tabelas extensas e ações claras no celular.

O Unslop orienta a revisão de espaçamento, cor, ícones, textos, tipografia, layout, detalhes, recursos visuais e movimento. Impeccable orienta a crítica da experiência. Shadcn e o sistema de design MARCELL fornecem os componentes. Use as regras de [`DESIGN.md`](../DESIGN.md), do [padrão de interface](PADRAO-INTERFACE.md) e de [UX/UI](REGRAS-UX-UI.md) como critérios de decisão. Consulte o [roadmap anterior](CRITIQUE-ROADMAP-REDESIGN-ERP-20261102.md) como referência histórica e reconfirme seus achados na versão atual.

## Etapas

| Etapa | Fluxos a revisar | Entrega verificável |
| --- | --- | --- |
| 0. Inventário | Menu, ajuda e manual, telas acessíveis por perfil, abas internas e rotas secundárias. Incluir telas vazias, erros, permissões e saídas para impressão. | Lista única por módulo, com tarefa principal, perfil, problema observado, prioridade e captura inicial. Agrupar ocorrências do mesmo componente para corrigir na origem. |
| 1. Base compartilhada e piloto | Menu e cabeçalho, Obra em foco, filtros, botões, tabelas, formulários, estados e navegação no celular. Usar Dashboard e Obras → Orçamento como amostra. | Padrões validados para leitura gerencial e planilha densa. Conferir busca, seleção de versão e ações com dados de teste. Usar o [piloto da Dashboard](VALIDACAO-DASHBOARD-ROADMAP.md) como ponto de partida para a avaliação com operadores. |
| 2. Obras e execução | Obras, projetos, orçamento, planejamento, licenciamento, Diário de obra, qualidade e medições técnicas. | Testar o percurso do orçamento aprovado ao planejamento e à execução. Conferir o vínculo entre item, etapa, obra e medição em cada passagem. |
| 3. Compras, estoque e equipamentos | Necessidade de compra, solicitação, cotação, aprovação, pedido, recebimento e estoque. Incluir fornecedores, frota, locações, patrimônio e cobrança de equipamentos. | Navegar de uma pendência ao registro de origem. Conferir entrega parcial, divergência e movimentação entre obras com dados de teste. |
| 4. Financeiro, DRE e relatórios | Contas a pagar e receber, notas e documentos, medições de cobrança, caixa, conciliação, fechamentos, DRE e relatórios. | Comparar valores, competência e recorte antes e depois. Testar a rastreabilidade da obrigação até o documento, pagamento e resultado, incluindo cenários parciais. |
| 5. Pessoas, ponto e terceiros | Equipe, ponto por obra, ponto geral, consulta às batidas, folha, rescisões, indicadores de RH e terceirizados. | Verificar o caminho do apontamento à folha e ao DRE. Testar falta, dia sem registro, feriado e transferência de obra sob os perfis correspondentes. |
| 6. Comercial, administração e acessos | Relacionamentos, oportunidades, propostas, contratos e resultados. Incluir cadastros, permissões, auditoria, aprovações, comunicação, arquivos, ajuda, IA e configurações. | Testar a passagem da contratação à obra. Conferir sessões com permissões restritas, estados sem acesso e ajuda contextual por aba. |
| 7. Fechamento e superfícies vinculadas | Portal do cliente, Modo TV, impressão, PDFs e exportações. Conferir a passagem entre o ERP e o app de Ponto quando um fluxo depender dele. | Validar conteúdo autorizado no portal, leitura no Modo TV e fidelidade dos documentos. Reconciliar a cobertura com o inventário e registrar as evidências e pendências de uso real por perfil. |

O roteiro abrange o ERP web e suas saídas. Um eventual redesign do aplicativo Android de captura de ponto exige levantamento próprio.

## Como executar cada etapa

1. Abrir as telas com dados de teste representativos e registrar o caminho normal, a primeira ação disponível e os pontos de atrito. Ordenar os achados por impacto na decisão, risco de erro e frequência de uso.
2. Aplicar a revisão na base compartilhada quando o problema se repetir. Usar as composições do módulo para preservar a tarefa, com uma ação principal, margens coerentes, números tabulares alinhados e ajuda próxima do ponto de decisão. Oculte detalhes atrás de controles expansíveis quando fizer sentido para o fluxo.
3. Conferir em 1440 e 390 px no MARCELL Plataforma, Preciso, Noite e Cristal. Testar teclado e foco, texto ampliado, nomes longos, filtros vazios, carregamento, erros e permissões representativas. Verificar impressão e PDF claros quando forem saídas da tela.
4. Rastrear a origem dos dados usados nos fluxos cruzados. Em Financeiro, Compras, Obras e RH, documentar o efeito no DRE e verificar separadamente previsão, compromisso, estoque físico, custo reconhecido e pagamento. Se a alteração for visual, registrar a evidência de que os valores conferidos coincidem.
5. Revisar a ajuda e o manual. Quando houver mudança de orientação, atualizar `src/features/help/help-content.js`, gerar o manual e executar `npm run validate:local` com os testes selecionados por risco. Registrar comandos, capturas, limites e resultado da crítica antes de considerar a etapa entregue localmente.

## Encerramento da revisão local

A revisão técnica percorreu a base compartilhada, Obras, Suprimentos, Financeiro, Pessoas, Comercial e Administração, além do Portal do cliente, Modo TV e saídas de documentos. Os registros acima indicam as telas, fluxos e recortes amostrados. Permanecem pendentes o ensaio com operadores por perfil e a validação do fluxo de ponto com aparelhos de campo.

### Ensaio por perfil e validação do ponto em 23/11/2026

Na prévia local 4274, Gestão, Engenharia e RH passaram nos seis cenários de navegação com dados fictícios, a 1440 e 390 px. As janelas de uso assistido foram abertas. Tempo, primeira escolha e facilidade percebida aguardam os operadores. [Roteiro e resultados por perfil](VALIDACAO-DASHBOARD-ROADMAP.md).

No ERP, seis cenários confirmaram a ida da Folha ao Ponto e o retorno com obra, grupo e quinzena preservados. Dois cenários confirmaram que batidas próximas seguem consultáveis e exigem tratamento explícito do RH para integração. A conferência de duplicidade usou a página de teste servida pelo Vite em uma porta local separada.

No app e no servidor de ponto, `npx vitest run --maxWorkers=1 apps/ponto-obra src/domains/ponto-eletronico server/ponto-eletronico` passou em 501 testes após uma primeira execução paralela interrompida por falta de memória. Os cinco cenários de concorrência pulados nessa execução passaram separadamente com PostgreSQL 17 descartável. A suíte cobriu pareamento, SQLite, fila offline, reinício simulado, reenvio e sincronização sem duplicar batidas. Os dados de teste são fictícios. A conferência não mudou o app, os registros fiscais ou as regras do DRE.

O ADB não detectou dispositivo e o aparelho de campo estava indisponível. Não houve execução em aparelho físico ou emulador. A [matriz de dispositivos](../apps/ponto-obra/docs/device-matrix.md) continua pendente de teste físico. [Evidências locais](../artifacts/ensaio-perfis-ponto/).

### Refinamento desktop de cabeçalhos, filtros e Modo TV em 23/11/2026

A partir de 1100 px, Dashboard, Obras, Orçamento, Compras e Financeiro compartilham a origem dos títulos e o recuo dos cabeçalhos. A busca acompanha o seletor de situação em Obras, os controles de período ficam junto da busca no placar e a planilha usa o mesmo recuo da barra de comandos. O Panorama executivo no Modo TV usa uma faixa de totais e quadros com avanço, diário, atrasos, qualidade, compras, próxima pendência e prazo. O Plataforma continua em Inter. A ajuda contextual e o manual foram atualizados.

Em 1440 px no Plataforma, os cinco títulos mediram 20 px e começaram em x=240 e y=86. A conferência em Chromium incluiu os temas Plataforma, Preciso e Noite a 1440 e 390 px, buscas por código e descrição e o Panorama em tela cheia a 1280 × 720. A 390 px, os temas mantiveram fonte, tamanho e posição dos títulos medidos antes e depois. Passaram `npm run validate:local`, 26 testes de tema, 14 cenários de Modo TV e 14 de contexto da obra. A crítica visual para o recorte desktop ficou em 9/10, com dados fictícios no navegador. A leitura à distância em um televisor físico permanece sem ensaio. [Capturas e medições](../artifacts/unslop-desktop-9/).

O refinamento altera apresentação e posição dos controles. As origens, fórmulas e permissões continuam no fluxo existente. Os cenários de contexto passaram na separação entre avanço, boletim e custo reconhecido e na identificação da obra consultada na DRE. A mudança não gera lançamentos nem altera previsão, compromisso, estoque, custo reconhecido ou pagamento.

Método Unslop por Damir Sokolovsky, CC BY 4.0. [Repositório oficial](https://github.com/heydamir/unslop).
