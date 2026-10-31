---
name: MARCELL
description: Gestão de obras com identidade institucional e leitura operacional clara.
colors:
  navy: "#0D1B2E"
  gold: "#B9985B"
  sand: "#F3F0E9"
  slate: "#78818B"
  white: "#FFFFFF"
  secondary-text: "#536171"
  muted-surface: "#E8E5DF"
  border: "#D9DDE2"
  control-border: "#7A8591"
  focus: "#7B6030"
  selected-surface: "#EEE5D5"
  action-hover: "#18304C"
  sidebar-hover: "#1B2C42"
  sidebar-active: "#243348"
  sidebar-text: "#C4CFDA"
  success: "#2E6652"
  warning: "#855A24"
  danger: "#A63B3B"
  info: "#355874"
  dashboard-news-header: "#EDF3F7"
  dashboard-actions-header: "#F8F3E9"
  operational-canvas: "#F5F6F8"
  operational-muted: "#EDF0F4"
  operational-control-border: "#8A96A5"
typography:
  print-document:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '11px'
    lineHeight: 1.4
  pilot-metric:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.375rem'
    lineHeight: 1.35
  pilot-metric-compact:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.25rem'
    lineHeight: 1.35
  pilot-touch-control:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '1rem'
    lineHeight: 1.5
  display:
    fontFamily: 'P052, Georgia, serif'
    fontSize: 'clamp(26px, 2.5vw, 38px)'
    fontWeight: 400
    lineHeight: 1.2
  navigation:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
  dashboard-title:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
  headline:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.35
  card-title:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: '0.01rem'
  label:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    letterSpacing: '0.01rem'
  caption:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.8125rem'
  kpi:
    fontFamily: 'Source Sans 3, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
rounded:
  sm: '0.375rem'
  md: '0.375rem'
  lg: '0.5rem'
  control: '0.5rem'
  pill: '9999px'
spacing:
  '1': '0.25rem'
  '2': '0.5rem'
  '3': '0.75rem'
  '4': '1rem'
  '5': '1.25rem'
  '6': '1.5rem'
  '8': '2rem'
  '10': '2.5rem'
  '12': '3rem'
components:
  button-primary:
    backgroundColor: '{colors.navy}'
    textColor: '{colors.white}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: '2.75rem'
  button-primary-hover:
    backgroundColor: '{colors.action-hover}'
    textColor: '{colors.white}'
  button-secondary:
    backgroundColor: '{colors.white}'
    textColor: '{colors.navy}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: '2.75rem'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.navy}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
  input:
    backgroundColor: '{colors.white}'
    textColor: '{colors.navy}'
    rounded: '{rounded.control}'
    padding: '0.5rem 0.75rem'
  navigation-active:
    backgroundColor: '{colors.sidebar-active}'
    textColor: '{colors.gold}'
  badge-neutral:
    backgroundColor: '{colors.muted-surface}'
    textColor: '{colors.secondary-text}'
    rounded: '{rounded.pill}'
    padding: '0 0.5rem'
  record-card:
    backgroundColor: '{colors.white}'
    textColor: '{colors.navy}'
    rounded: '{rounded.md}'
    padding: '1rem'
---

# Design System: MARCELL

## Piloto operacional aprovado — 30/10/2026

Dashboard, Compras e Financeiro adotam a direção **gestão com precisão** em
`src/design-system/themes/marcell-pilot.css`. Na primeira versão, a marca, o monograma, Nimbus Sans
e o azul-marinho permanecem oficiais. O fundo das áreas de trabalho passa a
`operational-canvas`, com superfícies brancas e ouro restrito à seleção.
Os demais módulos preservam o tema anterior durante a migração.

Cabeçalhos sem painel decorativo, controles padrão de 40 px no desktop e
44 px no toque, raios de 6 px nos controles e 8 px nos painéis. Preferências
de densidade continuam válidas no desktop. Números financeiros são completos
e usam algarismos tabulares. Títulos de página usam 24 px; seções, 18 px;
indicadores compactos, 20/22 px; corpo, 14 px; labels, 13 px; auxiliar, 12 px;
campos de toque, 16 px. Valores em rem e alturas mínimas permitem ampliação.

No desktop, Dashboard reúne indicadores, situação das obras e ações em uma
composição comum. Resumos adicionais e notícias ficam em regiões expansíveis.
Em Compras, a fila antecede o comparativo por obra. No mobile, seletores
nativos substituem várias linhas de abas; filtros avançados conservam seus
valores quando recolhidos. A troca de telas do módulo fica no cabeçalho e
há apenas uma barra inferior nos três pilotos. Filtros e contexto permanecem
controlados pelos módulos existentes.

O piloto não muda cálculo, autorização, comando de gravação ou impressão.
Evidências e instruções de revisão estão em `docs/PILOTO-VISUAL-MARCELL.md`.

## Overview

**Creative North Star: "Ambiente operacional MARCELL"**

A identidade oficial situa a equipe na MARCELL: navegação azul-marinho, marca em ouro e áreas de trabalho claras em areia e branco. A operação mantém leitura direta, densidade controlada e padrões familiares para consultar obras, comparar valores e concluir ações.

A assinatura completa apresenta a empresa no acesso; o monograma atende espaços compactos. Os vetores oficiais preservam desenho, proporção e cores. A mensagem institucional do acesso recebe a serifada editorial; telas de trabalho mantêm a família operacional.

**Key Characteristics:**
- Identidade institucional azul e ouro.
- Conteúdo claro, tipografia operacional e valores completos.
- Superfícies planas e profundidade reservada a sobreposições.
- Estados explícitos, foco visível e adaptação ao toque.

## Colors

O azul-marinho ancora marca, texto e ações; ouro assina a identidade sobre azul, e os neutros mantêm a leitura do trabalho.

### Primary
- **Azul-marinho:** navegação lateral, painel institucional do acesso, texto principal e ação primária.
- **Ouro:** assinatura oficial e item ativo sobre navegação azul; o foco operacional usa a derivação escura `focus`.

### Neutral
- **Areia:** fundo principal do aplicativo e do formulário de acesso.
- **Branco:** cartões, campos e texto sobre a ação primária.
- **Ardósia:** elementos gráficos secundários; textos auxiliares usam `secondary-text`, mais escuro.
- **Superfície neutra e divisores:** agrupamento, cabeçalhos de tabela e limites entre informações.

Sucesso, atenção, erro e informação usam seus próprios tokens semânticos. Texto e ícone acompanham estados quando apropriado; ausência de dado não significa zero.

**The Functional Color Rule.** Ouro identifica a marca e a seleção; sucesso, atenção e erro mantêm sua semântica própria.

## Typography

**Display Font:** P052, com Georgia e serif de reserva.
**Body Font:** Source Sans 3, com Helvetica Neue, Arial e sans-serif de reserva.
**Label/Mono Font:** IBM Plex Mono e fontes monoespaçadas de sistema para identificadores técnicos.

Source Sans 3 sustenta títulos, corpo, controles e números financeiros na operação web. P052 aparece na mensagem institucional do acesso desktop. As fontes MARCELL são servidas localmente por WOFF2; a procedência e as licenças da Source Sans 3 acompanham `public/fonts/source-sans-3`; a distribuição URW Base 35 / Artifex continua em `public/fonts/marcell` para a identidade institucional e os impressos.

### Hierarchy
- **Display:** mensagem institucional do acesso, com tamanho fluido definido no frontmatter.
- **Headline:** título de página (24 px); o acesso reduz o título para 24 px no celular.
- **Title:** seção e título de modal (18 px).
- **Card title:** título de cartão (14 px).
- **Body:** corpo, tabela e controle operacional (14 px).
- **Label:** rótulo (13 px); **caption:** apoio (12 px).
- **KPI:** valor principal (24 px), com algarismos tabulares.

**The Operational Type Rule.** Valores financeiros usam Source Sans 3 e algarismos tabulares; monoespaçada identifica códigos, PIX, CPF, patrimônio e NSR.

Campos usam 16 px em telas até 767 px. O modo TV admite títulos maiores para leitura à distância. Não reduzir texto para fazê-lo caber nem cortar valores monetários.

## Layout

O ritmo usa múltiplos de 4 px. A densidade confortável define controles de 44 px, linhas de tabela de 42 px, preenchimento de painel de 16 px e intervalo de 14 px. Compacta e espaçosa são variantes existentes; contexto de campo amplia controles para 52 px. No celular, alvos de toque preservam pelo menos 44 px.

O acesso desktop usa duas colunas: painel de marca e formulário com largura máxima de 430 px. Até 900 px, passa a uma coluna, com assinatura oficial no topo e sem a frase editorial. No sistema autenticado, a navegação lateral azul atende desktop e a navegação inferior compacta atende celular. Tabelas extensas mantêm rolagem interna; cartões de registro adaptam dados à largura disponível.

O sistema declara marcos de 480, 768, 1024 e 1280 px; o acesso tem sua transição específica de 900 px. Modais ocupam a tela no celular, com corpo rolável e respeito às áreas seguras. O aplicativo de ponto em campo conserva sua documentação específica.

## Elevation & Depth

Superfícies operacionais são planas, diferenciadas por fundo, bordas e proximidade. Sombras médias pertencem a sobreposições e sombras maiores a modais e gavetas. O acesso MARCELL usa painel sólido e formulário sem sombra, filtro de fundo ou animação de entrada.

### Shadow Vocabulary
- **Overlay:** `0 8px 20px rgb(22 22 22 / 12%)`.
- **Modal:** `0 16px 32px rgb(22 22 22 / 18%)`.

**The Overlay Depth Rule.** Reservar sombra estrutural a sobreposições; cartões operacionais permanecem planos.

## Shapes

Bordas finas (1 px), cantos discretos de 6 px em botões e cartões compactos e 8 px em campos, tabelas e diálogos. Badges e interruptores usam forma de cápsula. No celular, diálogos de tela inteira perdem borda e arredondamento.

## Components

### Buttons

Ações diretas, com altura ligada à densidade e rótulo regular; seleção e ações destrutivas usam peso 500. O primário usa azul-marinho e branco; secundário usa branco e borda de controle; ghost usa fundo transparente. O hover escurece a ação primária ou aplica superfície neutra. A família legada de botões do tema usa um hover azul próprio (`#1E3552`); os primitivos usam `action-hover`. Desabilitados reduzem opacidade e retiram o cursor de ação. Foco visível usa contorno de 3 px e afastamento de 2 px. Transições de estado usam 120 ms; movimento reduzido usa 1 ms.

### Chips

Badges usam cápsula, texto de 12 px e borda semântica. Neutros agrupam metadados; badges funcionais identificam estado com texto. Não distribuir cores funcionais entre indicadores neutros.

### Cards / Containers

Fundo branco, borda de divisor e cantos discretos. Cartões de registro no celular usam 16 px de preenchimento e valores com quebra de linha quando necessário. Tabelas usam contêiner de 8 px, cabeçalho neutro e alinhamento que permita comparar números.

### Inputs / Fields

Campos claros, borda de controle e cantos de 8 px; descrição e erro permanecem junto ao campo. Hover reforça a borda; foco visível mantém contorno. Erro combina borda e superfície semânticas. Somente leitura e desabilitado usam superfícies neutras e texto secundário. Alertas de modal ocupam espaço no fluxo para não cobrir campos editáveis.

### Navigation

A lateral usa azul-marinho, texto claro e separadores discretos. Hover altera a superfície e o texto; ativo recebe superfície azul e texto/borda em ouro. A marca usa o monograma oficial. A navegação inferior usa areia no celular. Uma navegação por nível e alvos claros preservam reconhecimento e acesso por teclado.

### Dashboard executivo

Refinamento local aprovado: menu desktop com 12 px e peso 400 (ativo 500), escrita normal e sem contagem de telas por grupo. Monograma e nome permanecem no topo, sem assinatura secundária na lateral. Dashboard: título 24/500, seções 14/500, chamadas e notícias 13/400 no desktop; textos das listas 14/400 no celular e metadados nunca abaixo de 12 px. Alvos de toque preservados.

Cabeçalhos em azul suave (#EDF3F7) para notícias e areia dourada (#F8F3E9) para ações. Ícones simples, números tabulares e sinais semânticos preservados; sem caixas decorativas repetidas. O contraste, os filtros e os valores financeiros continuam operacionais.

### Telas internas

O mesmo refinamento se estende aos módulos por `marcell-clean.css`, carregado depois da base. Títulos de página 24/500, seções 18/500, cartões 14/500 e diálogos 18/500; botões e rótulos regulares. Tabelas usam corpo de 13 px no computador e 14 px no celular, cabeçalhos de 12/500 e linhas em azul suave. Totais e alertas mantêm destaque e cor semântica. Os valores existentes nunca são abreviados por esta camada.

Formulários preservam os estados de erro, foco, desabilitado e somente leitura. Campos no celular têm 16 px e altura mínima de 44 px; descrições e metadados não ficam abaixo de 12 px. Cabeçalhos dos modais usam #EDF3F7, título com quebra e botão de fechar sem compressão. Escala em rem, botões com quebra de rótulo e adaptação existente das tabelas preservam o uso com texto ampliado. TV e impressão mantêm suas escalas próprias. Esta camada altera apresentação, sem alterar dados, cálculos, vínculos ou permissões.

## Relatórios e PDFs

Os PDFs usam o monograma MRC oficial como marca d’água fixa, centralizada, com opacidade de 4,5%, repetida em todas as páginas. As assinaturas visuais legadas “ArcD Construtech”, “ArcD Obras” e “ArcD Construtora” passam a MARCELL apenas na apresentação dos cabeçalhos e assinaturas; tabelas, observações livres, CNPJ e configurações persistidas permanecem intactos.

As saídas de impressão usam `src/reports/marcell-report.js`: logo oficial e fontes Nimbus Sans incorporadas no HTML, sem conexão externa para carregar a identidade. Corpo compacto de 11 px, títulos de 18/13/11,5 px, dados de tabela de 10 px e cabeçalhos de 9 px; azul-marinho, linhas discretas e fundo azul suave no cabeçalho. Totais mantêm peso 600 e as cores funcionais dos dados permanecem intactas. A impressão aguarda o carregamento das fontes e da logo.

Identificação legal cadastrada, conteúdos, valores, assinaturas e colunas não são recalculados pela camada visual. Cabeçalhos de tabelas repetem nas páginas; totais aparecem ao final. Os formatos A4 existentes são mantidos nas tabelas comuns. Anexos com mais de 12 colunas usam A3 paisagem para evitar cortes e redução excessiva; cronogramas A2 usam dimensões explícitas de 594 × 420 mm, pois o nome A2 não é reconhecido pelo Chromium. A marca se repete em cada folha do cronograma. A validação inclui PDF renderizado, fontes incorporadas, dimensões da página e comparação de células e valores.

## Do's and Don'ts

### Do:
- **Do** usar a assinatura e o monograma oficiais em suas versões adequadas ao fundo.
- **Do** preservar contraste, foco visível, estados textuais e alvos de toque.
- **Do** manter valores completos, algarismos tabulares e informações de relatório legíveis.
- **Do** usar Source Sans 3 na operação e P052 na mensagem institucional do acesso.

### Don't:
- **Don't** redesenhar, distorcer ou aplicar filtros aos vetores oficiais.
- **Don't** usar ouro ou ardósia claros como texto pequeno sobre fundo claro.
- **Don't** substituir estados funcionais pela cor da marca.
- **Don't** transformar identificadores internos `arcd` ou nomes legais cadastrados em rótulos de identidade novos por substituição indiscriminada.

### Prévia ajustável da folha

A folha usa larguras proporcionais ao conteúdo; funcionário, cargo e obra recebem o espaço remanescente, e contagens e valores recebem a largura necessária aos seus dados. Fonte padrão de 10 px, entrelinha 1,2 e espaçamento vertical de 2 px mantêm a densidade sem truncar valores. A prévia oferece controles por tabela e coluna, fonte, linhas e separação de anexos. O padrão pode ser salvo no navegador; controles são excluídos da impressão. A marca MRC permanece em todas as páginas.


## Expansão operacional — 31/10/2026

A direção aprovada passou a todos os módulos da operação web. `marcell-workspaces.css`, carregado após o piloto, define a composição e a nova tipografia. TV e documentos impressos mantêm sua escala específica.

- **Fonte:** Source Sans 3 variável, servida localmente, pesos reais 400/500/600. Origem Adobe; OFL e procedência em `public/fonts/source-sans-3`. Sem requisição ao Google Fonts. Títulos 24 px/600; seções 18 px/600; corpo 15 px; rótulos e controles 14 px; legendas 13 px. Controles de edição no celular usam pelo menos 16 px.
- **Layout:** conteúdo ocupa a largura disponível depois da navegação lateral. Padding de 24 px no desktop e 14 px no celular; agrupamentos com 8–12 px. O espaçamento separa tarefas e preserva proximidade entre campos relacionados.
- **Controles:** 40 px no desktop, 36 px no modo compacto, 48 px no espaçoso, 44 px de toque no celular. Planilhas mantêm densidade própria no desktop e rolagem interna.
- **Fluxo:** identidade e ação principal → contexto e filtros → lista/planilha/cronograma → análises complementares. Não colocar sequências de indicadores ou configurações antes da área de trabalho.
- **Navegação móvel:** seletor de telas no cabeçalho, incluindo atalhos para obras; seletores nativos para áreas internas e filtros por situação. A barra inferior mantém os módulos.
- **Obras:** diretório horizontal em telas largas, cartões em telas menores, nome completo sem corte; arquivos e pastas ficam em expansão própria. Valores de contrato completos.
- **Tela interna da obra:** cabeçalho compacto, resumo financeiro e ações em expansão, sem banner fixo. No celular, um seletor agrupado reúne todas as telas da obra.
- **Orçamento:** título da versão, dados e versões sob demanda, totais compactos, áreas de trabalho responsivas, organização da planilha e análises em expansões. Ocorrências da auditoria são sinalizadas no resumo de ferramentas.
- **Planejamento:** o cronograma precede compromissos, restrições e análise de desempenho; ferramentas e legenda recolhidas continuam acessíveis. Aviso de orçamento preliminar permanece visível.
- **Pessoas:** filtros por situação em faixa compacta no desktop e seletor no celular; pesquisa e lotação precedem o diretório. Folha identifica a tela antes do contexto de competência.

A família institucional P052 no acesso e a marca oficial permanecem. Impressos continuam com Nimbus Sans incorporada. Nenhum cálculo, permissão ou política de persistência foi alterado pelo rebranding.

### Refinamento das áreas de apoio — 31/10/2026

Estoque usa ações no cabeçalho, indicadores em faixa e explicação do DRE sob demanda. Equipamentos usa um único período de referência; fotos e nomes completos não se sobrepõem no celular. Fornecedores mantém busca visível e filtros de obra/período lado a lado no celular, com notas alinhadas no ranking. Patrimônio adapta suas linhas antes que a largura mínima da tabela corte ações. Em Cotações, datas usam o mesmo filtro expansível da fila; valores ativos permanecem ao recolher. Evidências e comparação com Vobi em [Refinamento visual e fluxos](docs/REFINAMENTO-VISUAL-E-FLUXOS-VOBI.md).

### Continuidade entre módulos — 31/10/2026

Preservar filtros, áreas internas e rolagem durante a sessão. Atalhos levam a obra e a competência de origem; “Voltar a…” retorna ao contexto anterior. A decisão da cotação fica junto de sua identificação e abre a revisão existente. No Planejamento, materiais da etapa levam a uma solicitação revisável: quantidades de referência não equivalem automaticamente a quantidades de compra. Estoque e pedidos compartilhados exigem conferência. Implementação e evidências em [Contexto, planejamento e compras](docs/CONTEXTO-PLANEJAMENTO-COMPRAS.md).
### Grupos e projeção da equipe

Folha e Ponto compartilham as navegações Consolidado, Obras e Administração Central. A central inclui provisoriamente engenheiros e mestres, com explicação junto à navegação e sem alteração automática da lotação.

A projeção usa o modo Operate, os controles existentes e uma tabela acessível acompanhando as barras de apurado e estimativas. Custo, líquido aos funcionários e saldo são leituras distintas. A reserva integral é cenário, sem tratamento visual de economia. Dados desconhecidos aparecem como Indisponível, com subtotal parcial e memória; nunca como zero confirmado. A navegação de competência histórica não controla a quinzena ativa do relatório. No celular, controles empilham e tabelas têm rolagem própria, preservando valores completos. Exportações conservam filtros, corte e referência da consulta autorizada.

No PDF, o rodapé da folha participa do cálculo de largura, usando sua fonte em negrito. Totais monetários recebem largura mínima e permanecem em uma linha, inclusive ao reutilizar ajustes salvos.
