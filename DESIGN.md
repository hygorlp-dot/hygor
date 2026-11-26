---
name: MARCELL
description: Gestão de obras com temas consistentes e leitura operacional clara; direção SAP disponível em MARCELL Operacional.
operational-reference: SAP
local-pilot: MARCELL Preciso — 01/11/2026
reviewed-at: 2026-11-19
default-theme: marcell
default-density: compact
colors:
  operational-primary: "#0057D2"
  operational-canvas: "#F5F6F7"
  operational-ink: "#223548"
  navy: "#0D1B2E"
  gold: "#B9985B"
  sand: "#F3F0E9"
  slate: "#78818B"
  white: "#FFFFFF"
  secondary-text: "#536171"
  muted-surface: "#EDF0F4"
  border: "#D9DDE2"
  control-border: "#8A96A5"
  focus: "#235BB0"
  selected-surface: "#EDF3FC"
  action-primary: "#0D1B2E"
  action-hover: "#19498E"
  sidebar-hover: "#1B2C42"
  sidebar-active: "#244B7D"
  sidebar-text: "#C4CFDA"
  success: "#24634B"
  warning: "#805517"
  danger: "#A2323B"
  info: "#285C91"
  dashboard-news-header: "#EDF3F7"
  dashboard-actions-header: "#F8F3E9"
  precise-canvas: "#E9EDF1"
  operational-muted: "#EDF0F4"
  operational-control-border: "#8A96A5"
typography:
  saas-body:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.8125rem'
    lineHeight: 1.5
  print-document:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '11px'
    lineHeight: 1.4
  pilot-metric:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.125rem'
    lineHeight: 1.35
  pilot-metric-compact:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1rem'
    lineHeight: 1.35
  pilot-touch-control:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1rem'
    lineHeight: 1.5
  display:
    fontFamily: 'P052, Georgia, serif'
    fontSize: 'clamp(26px, 2.5vw, 38px)'
    fontWeight: 400
    lineHeight: 1.2
  navigation:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
  dashboard-title:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.375rem'
    fontWeight: 500
  headline:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.375rem'
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 600
    lineHeight: 1.35
  card-title:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: '0.01rem'
  label:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 400
    letterSpacing: '0.01rem'
  caption:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.75rem'
  kpi:
    fontFamily: 'Inter, Geist, IBM Plex Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
  data-mono:
    fontFamily: 'Geist Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: '0.8125rem'
    fontWeight: 400
rounded:
  sm: '0.375rem'
  md: '0.375rem'
  control: '0.375rem'
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
    backgroundColor: '{colors.action-primary}'
    textColor: '{colors.white}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: 'var(--arcd-control-height)'
  button-primary-hover:
    backgroundColor: '{colors.action-hover}'
    textColor: '{colors.white}'
  button-secondary:
    backgroundColor: '{colors.white}'
    textColor: '{colors.navy}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: 'var(--arcd-control-height)'
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
    textColor: '{colors.white}'
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

## Fonte e escala unificadas — 24/11/2026

Inter é a fonte de interface em todos os temas do ERP e no Modo TV. A família e os tamanhos de referência vêm de `src/design-system/tokens/typography.css`. A densidade vem de `tokens/density.css`. Impressão e PDFs usam Nimbus Sans.

## Contrato vigente — conferido em 15/11/2026

Este documento descreve a implementação atual; as notas históricas abaixo não a substituem. Novas interfaces usam os componentes compartilhados, os tokens e `docs/PADRAO-INTERFACE.md`. Esta revisão alinha a documentação, sem migrar fontes, temas, dados, regras ou permissões.

- Tema padrão: **MARCELL Preciso** (`marcell`), com lateral azul-marinho, caixas de vidro claro sobre o emblema MARCELL e ações em azul-marinho (direção Plataforma, 19/11/2026). Densidade inicial: **Compacta**. Preferências salvas continuam sendo respeitadas.
- Temas disponíveis no registro: MARCELL Preciso, MARCELL Claro (`saas`), MARCELL Operacional (`operacional`) e MARCELL Vidro (`vidro`). Todos usam **IBM Plex Sans** como fonte operacional. As aliases legadas `--type-body` e `--type-display` consomem `--arcd-font-sans`; `--type-data` consome `--arcd-font-mono`. A conferência no navegador confirmou o corpo em IBM Plex Sans nos quatro temas. Vidro é aplicado ao portal sem substituir a preferência do ERP.
- Fonte única da escala: `src/design-system/foundations.js`; cores, família e diferenças de tema: `src/design-system/themes/themeRegistry.js`; alturas e espaçamento: `src/design-system/tokens/density.css` e `spacing.css`. `src/design-system/theme/themeValidation.js` define a densidade inicial.
- A base semântica de botões é `src/design-system/primitives/button-contract.css`; cabeçalhos compartilhados seguem `module-standard.css` e `--arcd-heading-weight`. A camada `marcell-clean.css` ainda aplica peso 500 a títulos legados e de diálogos. Essa diferença de cascata não autoriza novos estilos por módulo: novas telas devem consumir o cabeçalho compartilhado.
- O modo TV tem superfície escura e paleta central própria para leitura à distância (`DISTANCE_VIEW_COLORS`), sem alterar cores do tema operacional. Relatórios e PDFs usam Nimbus Sans incorporada. A mensagem institucional no acesso desktop mantém P052.
- Os relatórios reaproveitam os arquivos públicos WOFF2 de Nimbus Sans, sem outra cópia base64 no JavaScript inicial. `report-fonts.js` prepara e guarda as fontes no navegador quando o armazenamento permite; a confirmação aguarda a logomarca e as fontes. Os construtores podem montar um modelo antes desse preparo, mas a abertura em `report-preview.js` exige as duas fontes incorporadas ao HTML final. O documento salvo continua independente de URLs de fonte. Falha no preparo deve conservar a escolha e oferecer nova tentativa, sem abrir uma janela incompleta.
- Texto, tema, ajuda e carregamento não criam fatos financeiros. Divisão de código e mudanças de apresentação devem preservar contexto, filtros, competência, origem e valores do DRE.

## Histórico — direção SAP, 01/11/2026

O usuário escolheu a referência SAP do awesome-design-md. A versão inicial de MARCELL Operacional usava fonte 72; a implementação atual usa IBM Plex Sans, preservando azul funcional, faixas claras e hierarquia de trabalho. O registro de temas é a fonte dos papéis e da geometria. Referências e decisões daquela etapa: `docs/DESIGN-SAP-MARCELL-20261101.md`. Os nomes e valores históricos não devem ser copiados para novas interfaces.

## Histórico — temas SaaS, 31/10/2026

Revisão de consistência de 01/11/2026: áreas de trabalho usam botões delimitados, contagem separada e seleção com fundo/borda, além de hover e foco. Ações e campos de cabeçalho se alinham pela base dos controles; o status de salvamento é informativo e acompanha a altura das ações. Mais módulos no celular usa o Dialog compartilhado, fora da navegação inferior, com bloqueio de fundo e foco por teclado. Evidências e limites estão em `docs/REVISAO-GERAL-ERP-20261101.md`.

O usuário rejeitou a direção visual anterior e pediu simplicidade de fluxo e temas consistentes. Naquela etapa foram usados Inter no tema Claro e Source Sans 3 no Institucional. Esses valores foram substituídos pelo contrato atual: IBM Plex Sans em todos os temas operacionais e MARCELL Preciso como padrão. As preferências são normalizadas pelo registro e pela validação de temas; receitas históricas não prevalecem sobre essa base.

As receitas compartilhadas usam tokens semânticos, com ponte comum para shadcn, controles legados e primitivos. Densidade é independente do tema; o toque preserva 44 px. Não fixar cores de tema em páginas. No Financeiro, quatro entradas de rotina antecedem Mais áreas; em Compras, busca visível, filtros adicionais sob demanda e registros móveis compactos. Marca, documentos impressos e modo TV preservam seus requisitos. Pesquisa, limites e critérios: `docs/DESIGN-SAAS-TEMAS-20261031.md`.

## Histórico — piloto operacional aprovado, 30/10/2026

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

A identidade oficial situa a equipe na MARCELL: no padrão Preciso, navegação azul-marinho, marca em ouro e áreas de trabalho em cinza claro e branco. A operação mantém leitura direta, densidade controlada e padrões familiares para consultar obras, comparar valores e concluir ações.

A assinatura completa apresenta a empresa no acesso; o monograma atende espaços compactos. Os vetores oficiais preservam desenho, proporção e cores. A mensagem institucional do acesso recebe a serifada editorial; telas de trabalho mantêm a família operacional.

**Key Characteristics:**
- Identidade institucional azul e ouro.
- Conteúdo claro, tipografia operacional e valores completos.
- Superfícies planas e profundidade reservada a sobreposições.
- Estados explícitos, foco visível e adaptação ao toque.

## Colors

O azul-marinho ancora marca, texto e ações; ouro assina a identidade sobre azul, e os neutros mantêm a leitura do trabalho.

### Primary
- **Azul-marinho:** navegação lateral, painel institucional do acesso e texto principal no padrão Preciso. A ação primária usa o azul funcional do tema.
- **Ouro:** assinatura oficial e identidade. Seleção e foco operacional usam os papéis semânticos do tema; no Preciso, a seleção da lateral é azul com texto branco, e o foco usa azul.

### Neutral
- **Cinza claro:** fundo principal no padrão Preciso. Areia permanece na identidade e em composições históricas; não substitui `--arcd-surface-page`.
- **Branco:** cartões, campos e texto sobre a ação primária.
- **Ardósia:** elementos gráficos secundários; textos auxiliares usam `secondary-text`, mais escuro.
- **Superfície neutra e divisores:** agrupamento, cabeçalhos de tabela e limites entre informações.

Sucesso, atenção, erro e informação usam seus próprios tokens semânticos. Texto e ícone acompanham estados quando apropriado; ausência de dado não significa zero.

**The Functional Color Rule.** Ouro identifica a marca; seleção, sucesso, atenção e erro seguem seus papéis semânticos. Cada tema define os valores, sem versões locais por módulo.

## Typography

**Display Font:** P052, com Georgia e serif de reserva.
**Body Font:** Geist (variável, `public/fonts/geist`, OFL) desde 19/11/2026, com Inter, IBM Plex Sans, Helvetica Neue e Arial de reserva.
**Label/Mono Font:** Geist Mono, com IBM Plex Mono e fontes monoespaçadas de sistema de reserva, para identificadores técnicos.

O parágrafo abaixo registra o contrato anterior com IBM Plex Sans; a seção "Direção Plataforma — 19/11/2026" prevalece sobre ele.

IBM Plex Sans é a fonte operacional de títulos, corpo, controles e números financeiros no registro dos temas. Os pesos 400, 500 e 600 são servidos localmente em `public/fonts/ibm-plex`, com `font-display:swap`; suas declarações ficam em `tokens/typography.css`, junto da base de compatibilidade. Em 15/11/2026, as aliases do CSS legado passaram a consumir os tokens compartilhados. A revisão conferiu estilos computados e carregamento da fonte em Dashboard, Financeiro e Planejamento, nos quatro temas e em desktop/celular. Novas interfaces consomem os componentes e tokens compartilhados. P052 permanece na mensagem institucional do acesso desktop. Os arquivos históricos Source Sans 3 não definem o contrato operacional. Nimbus Sans permanece incorporada aos relatórios; as fontes URW/Artifex continuam nos diretórios de identidade e impressão. Os pesos e a escala existentes não foram alterados nesta consolidação.

### Hierarchy
- **Display:** mensagem institucional do acesso, com tamanho fluido definido no frontmatter.
- **Headline:** título de página (24 px); o acesso reduz o título para 24 px no celular.
- **Title:** seção e título de modal (18 px).
- **Card title:** token de título de cartão (15 px); composições históricas do dashboard têm escala própria de 14 px.
- **Body:** corpo, tabela e controle operacional (14 px).
- **Label:** rótulo (14 px); **caption:** apoio (13 px). Não repetir escalas históricas menores em novas interfaces.
- **KPI:** valor principal (24 px), com algarismos tabulares.

**The Operational Type Rule.** Valores financeiros usam a família operacional IBM Plex Sans e algarismos tabulares; monoespaçada pode identificar códigos, PIX, CPF, patrimônio e NSR. `FONT_DISPLAY` do legado também aponta para `--arcd-font-sans` nas telas operacionais.

Campos usam 16 px em telas até 767 px. O modo TV admite títulos maiores para leitura à distância. Não reduzir texto para fazê-lo caber nem cortar valores monetários.

## Layout

O ritmo usa os tokens de espaçamento. A densidade padrão Compacta define controles de 36 px, linhas de 34 px, painel de 12 px e intervalo de 10 px. Confortável usa 44/42/16/14 px; Espaçosa usa 48/48/20/18 px, nessa mesma ordem. O contexto de campo usa controles de 52 px e linhas de 50 px. No celular, os contratos de toque preservam pelo menos 44 px, independentemente da densidade salva.

O acesso desktop usa duas colunas: painel de marca e formulário com largura máxima de 430 px. Até 900 px, passa a uma coluna, com assinatura oficial no topo e sem a frase editorial. No sistema autenticado, a navegação lateral azul atende desktop e a navegação inferior compacta atende celular. Tabelas extensas mantêm rolagem interna; cartões de registro adaptam dados à largura disponível.

O sistema declara marcos de 480, 768, 1024 e 1280 px; o acesso tem sua transição específica de 900 px. Modais ocupam a tela no celular, com corpo rolável e respeito às áreas seguras. O aplicativo de ponto em campo conserva sua documentação específica.

## Elevation & Depth

Superfícies operacionais são planas, diferenciadas por fundo, bordas e proximidade. Sombras médias pertencem a sobreposições e sombras maiores a modais e gavetas. O acesso MARCELL usa painel sólido e formulário sem sombra, filtro de fundo ou animação de entrada.

### Shadow Vocabulary
- **Overlay:** `0 8px 20px rgb(22 22 22 / 12%)`.
- **Modal:** `0 16px 32px rgb(22 22 22 / 18%)`.

**The Overlay Depth Rule.** Reservar sombra estrutural a sobreposições; cartões operacionais permanecem planos.

## Shapes

Bordas finas (1 px). No padrão Preciso, `--arcd-radius-control` define 6 px para controles e `--arcd-radius-lg` define 8 px para painéis maiores; outros temas têm valores próprios no registro. Não fixar raios locais para contornar a base. Badges e interruptores usam seus componentes compartilhados. No celular, diálogos de tela inteira perdem borda e arredondamento conforme o contrato do diálogo.

## Components

### Buttons

Ações diretas, com altura ligada à densidade. O contrato compartilhado usa peso 500, enquanto a camada legada `marcell-clean.css` mantém rótulos regulares em algumas superfícies. O primário usa `--arcd-action-primary` e texto branco; no Preciso, azul-marinho `#0D1B2E` desde 19/11/2026 (antes azul `#235BB0`, que continua no foco). Secundário e ghost seguem seus papéis, sem cores próprias do módulo. Hover usa `--arcd-action-primary-hover`; desabilitados conservam a indicação de indisponibilidade. Foco visível usa contorno de 3 px e afastamento de 3 px no contrato compartilhado. O título explicativo não substitui o texto de uma ação visível; botões só com ícone precisam de nome acessível.

### Chips

Badges usam cápsula, texto de 12 px e borda semântica. Neutros agrupam metadados; badges funcionais identificam estado com texto. Não distribuir cores funcionais entre indicadores neutros.

### Cards / Containers

Fundo branco, borda de divisor e cantos discretos. Cartões de registro no celular usam 16 px de preenchimento e valores com quebra de linha quando necessário. Tabelas usam contêiner de 8 px, cabeçalho neutro e alinhamento que permita comparar números.

### Inputs / Fields

Campos usam superfície, borda, raio e altura dos tokens do tema/densidade; descrição e erro permanecem junto ao campo. Hover reforça a borda; foco visível mantém contorno. Erro combina borda e superfície semânticas. Somente leitura e desabilitado usam os estados compartilhados. Alertas de modal ocupam espaço no fluxo para não cobrir campos editáveis.

### Navigation

No padrão Preciso, a lateral usa azul-marinho e texto claro; o ativo recebe superfície azul e texto branco. Claro e Operacional têm lateral clara. O monograma oficial é preservado. A navegação inferior do celular usa os papéis do tema. Contadores fazem parte do nome acessível do destino, sem alterar seu ID. Uma navegação por nível e alvos claros preservam reconhecimento e acesso por teclado.

### Dashboard executivo

Refinamento local aprovado: menu desktop com 12 px e peso 400 (ativo 500), escrita normal e sem contagem de telas por grupo. Monograma e nome permanecem no topo, sem assinatura secundária na lateral. Dashboard: título 24/500, seções 14/500, chamadas e notícias 13/400 no desktop; textos das listas 14/400 no celular e metadados nunca abaixo de 12 px. Alvos de toque preservados.

Cabeçalhos em azul suave (#EDF3F7) para notícias e areia dourada (#F8F3E9) para ações. Ícones simples, números tabulares e sinais semânticos preservados; sem caixas decorativas repetidas. O contraste, os filtros e os valores financeiros continuam operacionais.

### Telas internas

O refinamento se estende aos módulos por `marcell-clean.css`. A camada aplica peso 500 aos títulos legados e diálogos; cabeçalhos compartilhados de maior especificidade usam `--arcd-heading-weight`, atualmente 600. Tamanhos novos seguem `foundations.js`: página 24 px, seção/diálogo 18 px, cartão 15 px, corpo/controle/rótulo 14 px e apoio 13 px. Existem composições históricas menores; sua existência não autoriza repeti-las. Totais e alertas mantêm destaque e cor semântica. Os valores existentes nunca são abreviados por esta camada.

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
- **Do** usar Geist (via `--arcd-font-sans`) na operação e P052 somente na mensagem institucional do acesso.

### Don't:
- **Don't** redesenhar, distorcer ou aplicar filtros aos vetores oficiais.
- **Don't** usar ouro ou ardósia claros como texto pequeno sobre fundo claro.
- **Don't** substituir estados funcionais pela cor da marca.
- **Don't** transformar identificadores internos `arcd` ou nomes legais cadastrados em rótulos de identidade novos por substituição indiscriminada.

### Prévia ajustável da folha

A folha usa larguras proporcionais ao conteúdo; funcionário, cargo e obra recebem o espaço remanescente, e contagens e valores recebem a largura necessária aos seus dados. Fonte padrão de 10 px, entrelinha 1,2 e espaçamento vertical de 2 px mantêm a densidade sem truncar valores. A prévia oferece controles por tabela e coluna, fonte, linhas e separação de anexos. O padrão pode ser salvo no navegador; controles são excluídos da impressão. A marca MRC permanece em todas as páginas.


## Histórico — expansão operacional, 31/10/2026

A direção aprovada passou a todos os módulos da operação web. `marcell-workspaces.css`, carregado após o piloto, define a composição e a nova tipografia. TV e documentos impressos mantêm sua escala específica.

- **Fonte naquela etapa:** Source Sans 3 variável, servida localmente. A família foi substituída por IBM Plex Sans; novos tamanhos e controles seguem a escala vigente de `foundations.js` e os papéis do registro. A documentação e as licenças antigas não determinam a aparência atual.
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

### Rotina, contexto e ações — primeira onda do roadmap

- Cabeçalhos operacionais agrupam identidade, obra e ação da área. Em Cotações, “Adicionar cotação” é a ação principal; retorno à fila e outras ações permanecem no mesmo cabeçalho. No celular, obra e título compartilham a primeira linha quando couberem, com ações abaixo.
- Rótulos usam a linguagem do trabalho, em caixa de frase: “Comparar propostas”, “Analisar documento”, “Nova solicitação”. Evitar títulos consecutivos para a mesma área.
- Cada cotação possui um botão nativo para abrir/recolher sua análise. Ações destrutivas ficam no menu do registro, usando o mesmo componente dos pedidos. Não aninhar botões dentro de outro elemento com papel de botão.
- DRE é uma consulta complementar após o conteúdo de Compras; continua com competência explícita e sem restringir silenciosamente os filtros operacionais.
- Navegação financeira agrupa Rotina, Análises e Ferramentas. Desktop e celular usam os mesmos destinos autorizados; o seletor móvel informa o grupo ativo. Não criar navegações diferentes com listas de permissões independentes.
- Reutilizar os componentes existentes, seus estados e tokens. Espaçamentos desta composição seguem intervalos de 4/8/12/16 px; alvos das ações de cabeçalho e menus têm 44 px no celular.

### Conferência conectada e ação financeira — onda 2

- Identificar pedido, obra e documento antes de comparar. Quantidade física, valor recebido de referência, faturamento, pagamento e conciliação mantêm seus significados próprios.
- Comparar o original e os dados lado a lado em desktop; em telas menores, alternar Documento/Dados da nota sem descartar a escolha do pedido e da nota. Dados ausentes e unidades sem equivalência ficam explícitos.
- A próxima ação da fila financeira vem de uma origem existente e autorizada. Usar “Conferir documento”, “Conferir compra” e “Conferir cobrança” conforme o destino; manter “Ver memorial” como consulta.
- Preservar retorno, fila e obra ao abrir uma revisão. Datas usam `dd/mm/aaaa`; valores usam moeda local e algarismos tabulares. Consultar não executa aprovação, pagamento ou conciliação.

### Revisão bancária e evidências — onda 3

- Na revisão bancária, mostrar saldo a vincular, valor selecionado e restante após seleção juntos. O valor original do banco mantém seu próprio rótulo; comparações usam o saldo restante. Informação ausente não equivale a zero.
- Confirmação acompanha o resumo da seleção no fluxo da página, sem rodapé sobreposto ou rolagem concorrente no painel de revisão. No celular, valores permanecem inteiros e os resumos se reorganizam verticalmente.
- Trocar a conta encerra a revisão anterior. Abrir e fechar evidências preserva a seleção; período fechado apresenta a restrição existente junto da ação.
- Documentos, memorial, compras e conciliação reutilizam o leitor do original. Informar origem, formato e vínculo; referência cadastrada não certifica acesso nem conferência do conteúdo.
- Distinguir ausência de anexo, endereço indisponível, sessão necessária, acesso negado, arquivo não encontrado, endereço expirado e falha de prévia. Oferecer nova tentativa e abertura do original quando houver referência válida.
- Resolver evidências pela identidade do registro e da obra. Anexos de outro pagamento ou outra obra não entram por semelhança de descrição ou valor. Consultar evidências não grava operações.

### Consultas e comparação temporal — onda 4

- Consultas nomeadas guardam somente busca, situação, obra e mês no navegador, com identidade de usuário e empresa. Nunca persistir anexos, links assinados, seleção operacional ou rascunhos como preferência. Aplicação da consulta é explícita; referência de obra indisponível conserva o recorte atual e explica a correção.
- Consultas salvas e conferência em sequência ficam recolhidas junto dos filtros. Em desktop, os controles de nome e aplicação compartilham a linha; no celular se reorganizam, preservando rótulos, foco e alvos de 44 px.
- Seleção documental precede uma prévia. Mostrar elegibilidade e motivo de bloqueio por registro, revalidar antes de abrir e manter a sequência ao retornar. Ficha aberta não equivale a salva ou conferida. A confirmação permanece na ficha fiscal existente.
- Na consulta temporal, separar referência da etapa, necessidade registrada, compromisso de compra e obrigação financeira. Usar identidade explícita de obra, plano, etapa, solicitação e pedido; títulos usam os valores do motor canônico.
- Pedido vinculado não reaparece como necessidade adicional; sua cobertura de quantidades ainda exige conferência. Não alocar estoque compartilhado nem somar orçamento, pedidos e títulos. Datas inválidas e vínculos ausentes são pendências visíveis.
- Deslocar datas em simulação altera apenas a comparação de referências. Preservar datas cadastradas de entregas, solicitações e títulos. Saldo desconhecido continua desconhecido; não atribuir saldo da empresa à obra.

### Revisão geral após o roadmap — 31/10/2026

- Pagamentos usa cabeçalho de seção, resumo compacto e filtros junto da fila. No celular, a seleção de situação substitui os atalhos de etapas; valores e acesso aos memoriais permanecem disponíveis. Evitar indicadores com faixas laterais decorativas ou estado de alerta em valores zerados.
- A ação de conferência de um pagamento abre seu documento fiscal específico. O retorno identifica a fila de pagamentos e preserva obra, situação, busca e posição de consulta na sessão.
- Em Pedidos, a ação principal do cabeçalho é “Novo pedido”, reutilizando o formulário existente. “Nova solicitação” continua no menu. Busca permanece visível; filtros complementares usam o mesmo padrão expansível de Cotações no celular, com contagem e valores preservados ao recolher.
- Avisos de entrega usam caixa de frase e ação próxima. Em desktop, busca e filtros compartilham a linha; em celular, ações de um registro não competem com anexos pelo espaço horizontal.
- Controles expansíveis de Financeiro e Compras têm pelo menos 44 px no celular. A comunicação da equipe fica no cabeçalho móvel, com nome acessível e estado de expansão; não sobrepor seu atalho às ações dos registros. O painel e a indicação de não lidas permanecem disponíveis.

### Contrato compartilhado — WF02

- As APIs UI, design system e `Btn` legado delegam ao mesmo renderizador de botão e aos papéis principal, secundário, discreto e destrutivo. Preservar o mapeamento legado de `ghost` para secundário. Não criar nova receita visual em cada adaptador.
- Entrada, seleção e área de texto nativas usam `data-mrc-control`, rótulo associado e contrato comum de foco, erro e edição móvel. Estilos explícitos antigos e controles específicos ainda exigem migração por superfície.
- Um H1 por tela; cabeçalhos de área recebem `headingLevel={2}`. Diálogos contêm o foco e retornam ao acionador. Ação carregando bloqueia reenvio e comunica sua situação.
- Referência executável: Storybook → Fluxo/Padrões compartilhados. Regras e limites em `docs/PADROES-OPERACIONAIS-MARCELL.md`.

### Continuidade de Compras — WF03/WF04

- Relações de solicitação, cotação e pedido dependem de identidade e obra. Mostrar a providência e os destinos vinculados no registro; não inferir cobertura integral das quantidades pelo vínculo.
- Ao abrir um vínculo, guardar o recorte da origem na sessão. Voltar restaura busca, situação, datas e comparação aberta. Se o estado atualizado sair do filtro, explicar e oferecer a visualização explícita da origem.
- Após decidir uma cotação, mostrar apenas os pedidos confirmados por aquela decisão, com retorno ao comparativo. Decisão parcial permanece explícita e separada do recebimento físico e do pagamento.
- Pedidos conta o total no escopo da obra; etapas de ação contam pendências. Filtros desktop ficam em linha; no celular, os complementares se expandem pelo acionador. A situação de Cotações usa seleção nativa legível.
- No pedido, ação principal e ficha documental compartilham a linha desktop. No celular, consulta fica abaixo e o alvo principal continua com pelo menos 44 px. Cancelados conservam acesso à ficha e explicação do estado.

### Continuidade financeira — WF05/WF06

- Conferência documental abre a obrigação por identificador da nota. O resumo conserva o escopo da obra; a lista explica o recorte por documento e oferece removê-lo explicitamente. Retorno restaura mês, obra, busca e seleção da origem.
- Revisão bancária segue fatos de caixa e associações ativas, nunca similaridade de descrição ou valor. Conta desconhecida continua desconhecida; pagamento direto do cliente ou caixa físico não vira saída bancária por um atalho.
- Entrada bancária por origem financeira pausa a automação. Exibir origem e estado da automação em resumo expansível abaixo do título; a retomada permanece explícita.
- Fechamento guarda a competência durante a conferência da origem. Alertas documentais continuam separados dos bloqueios retornados pelo motor. Categoria fiscal usa o catálogo existente e conserva valores legados.
- Rejeição não fecha o formulário. Falha no fechamento libera os controles e conserva a chave de tentativa na sessão; sucesso adota o registro auditável retornado pelo servidor, sem gravar uma cópia local como outro cadastro.

### Aceite de recuperação — conclusão da WF06

- Pedido, medição e despesas oferecem correção documental restrita no contexto do fechamento. Categoria usa o catálogo correspondente à origem; valores, identidade, pagamentos e recebimentos não entram nesse comando. Exigir motivo, versão, autorização e trilha de antes/depois.
- Edição fiscal usa a versão aberta, sem elevar silenciosamente a versão do comando ao receber atualizações em segundo plano. Comparar base, edição e registro atual; preservar campos alterados por outra pessoa e pedir escolha quando houver conflito no mesmo campo.
- Falha, versão consultada e confirmação já recebida têm estados visuais distintos. Comparação de campos usa duas colunas no desktop e uma no celular, com nomes de campos legíveis e ações no padrão compartilhado.
- Renovação de sessão acontece dentro do fluxo e só aceita a mesma identidade. Limpar a senha do controle ao iniciar a requisição; não persistir formulário ou senha como preferência.
- Resposta perdida exige conferir o recibo antes de adotar a confirmação. Repetição explícita de conteúdo igual conserva a chave; novo documento conserva a identidade reservada. Nenhuma dessas telas cria uma fila financeira offline automática.

### Necessidades e revisão em volume — WF07/WF08

- Cobertura física exige solicitação, item, material e obra identificados, quantidades positivas e unidades verificáveis. Conversão sem evidência fica para conferência; estoque compartilhado não é abatido automaticamente. Orçamento, pedido e título permanecem fatos distintos.
- Mostrar necessidade revisada, compra comprovada e diferença antes da análise complementar. No celular, empilhar esses valores. Simulações conservam as datas cadastradas e levam à origem para tratar prazos e lacunas.
- Reordenar ou atualizar a base não apaga uma sequência. Revalidar por identidade antes de abrir; indicar item indisponível, fora do filtro ou bloqueado individualmente. Abrir não significa salvar; versão atualizada exige conferir o resultado.
- Consultas persistem somente filtros por usuário/empresa. Paginação limita a montagem, preservando busca e seleção de todo o filtro. Oferecer continuação no fim das listas e retorno ao início da nova página, com foco no intervalo.
- Padronizar o retorno fiscal como “Voltar à central de documentos”. Ajuda contextual e manual são gerados da mesma fonte e acompanham o comportamento implementado.

### Rolagem e camadas do ponto

- Cabeçalho geral acompanha a página, sem desfoque; somente o conflito de salvamento exige destaque persistente.
- Na tabela de ponto, fixar os títulos por célula dentro do contêiner de rolagem. A coluna de identificação e os títulos têm fundos opacos; a limpeza visual das tabelas comuns não pode tornar essas células transparentes.

### Interrupção e área visível — WF09

- Ficha fiscal, pagamento e correção de fechamento preservam alterações até salvar ou descartar explicitamente. Escape/fechar/cancelar usam a mesma decisão. Comandos em andamento protegem também a recarga, sem persistir rascunhos como preferências.
- Diálogos acompanham o visualViewport. Fechar um diálogo filho mantém a rolagem bloqueada e o foco no formulário principal; acionador desmontado devolve o foco a um título da área. Atalho global de busca não troca o módulo durante um diálogo.
- Navegação inferior e chat não competem com a edição. Controles móveis usam alvo de pelo menos 44 px e rótulos sem quebras arbitrárias de palavras.
- Ajuda e manual compartilham a orientação de celular/interrupções. Emulação de reflow e área de teclado não substitui observação em aparelho real; não classificar execução automatizada como piloto com operadores.

## Processo de evolução visual — 01/11/2026

Toda evolução de interface deve registrar hipótese, consultar as skills e componentes aplicáveis, implementar localmente, criticar a composição e o fluxo nas telas renderizadas, verificar desktop e celular, corrigir os achados e registrar evidências e limites. A escolha visual pertence ao usuário. O estudo comparativo de Compras permanece separado do tema vigente; ver docs/ESTUDO-VISUAL-COMPRAS-20261101.md.

### Padrão dos módulos — MARCELL Operacional

Contrato obrigatório para futuras introduções e mapa de manutenção: `docs/PADRAO-INTERFACE.md`. A escala compartilhada está em `src/design-system/foundations.js`; linguagem genérica em `src/design-system/copy.js`. `npm run design:check` impede crescimento das exceções diretas registradas no legado e integra o lint.

Primeira migração: Financeiro e Compras reutilizam controles, tipografia e espaçamentos comuns, com baseline reduzida. Registros e indicadores clicáveis usam RecordAction; comandos usam Button. Seletores de arquivos usam FilePicker, com botão acionável por teclado. O Modal compartilhado usa superfícies opacas e dimensões do tema. Ver `docs/MIGRACAO-FINANCEIRO-COMPRAS-20261101.md` para alcance e limites.

- PageHeader e PageHero compartilham a receita `mrc-screen-header`: título de 24px, descrição de 14px e ações agrupadas. As superfícies, pesos e preenchimentos vêm do tema; não criar novos cabeçalhos particulares para módulos operacionais.
- FilterBar com `layout="grid"` organiza filtros relacionados, alinhados pela base no desktop e empilhados no celular. Preservar rótulos, seleção e handlers; não transformar a troca de apresentação em alteração de dados.
- Abas e ações usam os controles compartilhados. Cor de seleção, foco, contadores e densidade vêm dos tokens. No celular, manter o seletor de áreas já existente e alvos de toque adequados.
- Indicadores, blocos de formulário, gráficos e estados vazios usam a mesma hierarquia de superfícies, bordas e tipografia. Estados semânticos continuam distinguindo atraso, erro, aviso e conclusão.
- Modo TV preserva a escala para leitura à distância. Documentos impressos também conservam suas receitas próprias. Essas exceções não justificam divergências nas telas operacionais.
- Detalhes da aplicação e evidências: docs/PADRAO-MODULOS-ERP-20261101.md.

## Obras, Orçamento, Planejamento e Pessoas — 01/11/2026

A segunda migração está documentada em `docs/MIGRACAO-OBRAS-PESSOAS-20261101.md`. Aplica os controles e papéis semânticos existentes às telas operacionais e seus apoios de arquivos, projetos, conferência e licenciamento. A baseline diminuiu em 2.797 ocorrências diretas; isto não certifica todo o CSS nem elimina o legado dos demais módulos.

Células de planilha usam os controles compartilhados sem um novo campo com rótulo ao redor. Altura, entrelinha, padding e tamanho de texto da grade vêm de `--arcd-sheet-*` em `foundations.js`. A descrição continua crescendo com o conteúdo. Comandos mantêm os alvos comuns; no celular, grades largas rolam dentro do próprio painel. Estados do ponto usam RecordAction e cores semânticas da situação, sem perder o significado de Presente, Meio dia ou Falta.

FilePicker aceita `inputProps` para recursos nativos como `capture`, rótulo acessível e reinicialização. Não substituir por outro seletor de arquivos próprio do módulo. A busca de Obras usa uma única borda no Input e acompanha a rolagem da página, sem uma camada fixa sobre o conteúdo. Impressão e modo TV mantêm receitas específicas.

### Revisão dos atalhos do RH — 01/11/2026

O painel de pendências da Folha consome os controles e a tipografia da base, sem nova família visual. As abas FlowTabs passam a quebrar em linhas no desktop em toda a ERP, preservando o seletor no celular. Alterações futuras de linguagem visual pertencem aos tokens/componentes compartilhados e devem alcançar o sistema inteiro. Validação e limites em `docs/ATALHOS-RH-20261101.md`.

### Entrada e cadastro no ponto — 01/11/2026

Nome de registro usa RecordAction; comandos não devem ser repetidos quando o nome já oferece a mesma navegação. No ponto, a coluna compacta leva ao cadastro e o vínculo/desligamento fica antes dos campos de edição. A espera inicial usa marca, Spinner e tokens comuns. Ver `docs/PONTO-CADASTRO-DESLIGAMENTO-20261101.md` para escopo e validações.

## Piloto P1 — MARCELL Preciso

Direção aprovada na entrevista: lateral azul-marinho ajustável, conteúdo claro, ações em azul e dourado reservado à marca. O tema `marcell` passa a se chamar MARCELL Preciso e é o padrão para novos navegadores, com densidade Compacta; preferências existentes de tema e densidade continuam válidas. Toda a ERP usa IBM Plex Sans nos papéis operacionais, pesos 400/500/600, com números tabulares. Documentos e Modo TV conservam seus papéis próprios. Não aplicar fonte ou cor diretamente nos módulos para contornar a base. Piloto local, sem deploy.


## Composição de listas operacionais — 02/11/2026

Compras e Financeiro adotam WorkspaceHeading e WorkspaceCommandBar: título e navegação juntos, uma barra com escopo/consulta/ações e resumo compacto antes da lista. A composição vem da base compartilhada, preserva IBM Plex Sans e tokens semânticos, mantém lateral azul-marinho MARCELL e se reorganiza para toque no celular. Valores, alertas, permissões e ações do registro permanecem explícitos. Nenhuma transição financeira muda por efeito de layout.


## MARCELL Vidro — portal do cliente, 14/11/2026

Tema aprovado pelo usuário para o portal: vidro fosco claro e residência contemporânea fictícia ao fundo. Tokens de cor/material em themeRegistry.js; receita compartilhada em themes/material.css. Painel principal com opacidade de 68%, cartões e campos com 76%, desfoque de 18 px e texto azul-marinho de alto contraste. A escala, os controles e as abas permanecem MARCELL. Fotografias dos diários continuam inteiras, independentes do fundo ilustrativo. O portal aplica o tema sem gravar outra preferência de aparência do ERP. Superfície sólida quando não há desfoque ou quando o usuário reduz transparência. Procedência do asset e prompt em docs/TEMA-PORTAL-VIDRO-LOCAL.md.

## Direção Plataforma — 19/11/2026

Aprovada pelo usuário a partir do canvas "ERP MARCELL — Direções visuais" (direção D, após pedir algo mais tecnológico e maduro, com fontes menores). Prevalece sobre as descrições anteriores de fonte, escala e ação do Preciso.

- **Fonte:** Geist e Geist Mono variáveis, servidas localmente em `public/fonts/geist` (pacote oficial `geist` 1.9.2, OFL). `--arcd-font-sans` começa por Geist em `tokens/typography.css`, `themeRegistry.js` e `marcell-workspaces.css`; Inter e IBM Plex ficam de reserva. Relatórios, impressão e Modo TV mantêm Nimbus Sans.
- **Escala compacta** (`foundations.js`, espelhada em `tokens/typography.css`): título de página 22 px, indicador 18 px, título de seção 15 px, título de cartão 14 px, corpo, rótulo, controle e tabela 13 px, legenda 12 px, título de diálogo 16 px. Controles de toque continuam em 16 px e alvos em 44 px.

Em 23/11/2026, a densidade Compacta passou a aplicar a escala reduzida no ERP web em todos os temas e larguras. No desktop, a escala usa título de página de 20 px e indicador de 16 px. No celular, usa 18 px e 15 px. Corpo, rótulos, botões e tabelas usam 12 px, títulos de seção usam 14 px e o recuo de painéis e a distância entre caixas usam 8 px. A escala de referência acima atende às outras densidades. O contrato fica em `themes/operating-contract.css` e é aplicado à área de trabalho. Modo TV e impressão têm regras próprias.
- **Vidro:** no Preciso, cartões, faixas de indicadores, filtros e painéis usam as caixas translúcidas de `vidro-erp.css` (o mesmo mecanismo do Noite e do Cristal), com o cabeçalho em vidro claro. A lateral continua azul-marinho sólida, para leitura; o item ativo recebe filete dourado. Sem desfoque disponível, com "reduzir transparência" ou na impressão, as caixas voltam a ser sólidas.
- **Marca d'água:** o emblema oficial aparece bem claro ao fundo do Preciso (6 %) e do Noite (4,5 %), a partir de `public/brand/marcell/emblem-marca-dagua-clara.svg` e `emblem-marca-dagua-noite.svg`: cópias do emblema oficial com a transparência embutida, sem alteração de desenho. A impressão não leva a marca d'água.
- **Cor:** ação primária do Preciso em azul-marinho `#0D1B2E` (hover `#1B2C42`); foco permanece azul `#235BB0`. Fundo `#E9EDF1` com luzes suaves de ouro e azul da marca, cartões em branco 86 %. Cor de estado só para desvio.
- **Limite conhecido:** planilhas densas (Orçamento) ficam sobre superfície quase opaca; o vidro não deve atravessar números.
- **Caixas e alinhamento (19/11/2026):** contrato em `src/design-system/themes/box-contract.css`, regras em `docs/REGRAS-UX-UI.md` §8 e tokens `--arcd-box-*` em `foundations.js`. Dois raios (controle e caixa), recuo interno pela densidade em caixas com campos, tabela encostada com primeira e última coluna recuadas na mesma vertical dos filtros, 16 px entre caixas irmãs e números à direita com algarismos tabulares. As telas usam diretamente os tokens de raio e a borda comum usa `--arcd-border-width`; o lint (`check-ux-rules.mjs`) barra raio em px e espaçamento fora da escala novos.


### Opção MARCELL Plataforma — 19/11/2026

A revisão Unslop de 23/11/2026 manteve a Inter e atenuou a malha de projeto e o acabamento dos painéis para dar prioridade à leitura das tabelas. Os diálogos dos temas usam superfície elevada sólida. A interface de operação usa recuos por densidade, rótulos de tabela em caixa de frase e uma barra móvel com ícones de dimensão comum. A Dashboard preserva a representação do clima estática e usa movimento para comunicar interação e espera.

O tema `plataforma` é uma opção adicional inspirada na referência visual aprovada: menu azul-ardósia, grade discreta de projeto, emblema oficial claro e painéis translúcidos. `marcell` (MARCELL Preciso) continua como padrão; a composição e os fluxos existentes da ERP são preservados, sem promessa de reprodução idêntica da referência.

A opção usa Inter local e herda a escala e os controles da base compartilhada. Na densidade Compacta, o recuo dos painéis e a distância entre grupos passam para 8 px. Cabeçalho e conteúdo seguem a mesma margem lateral. Em Obras, contrato, recebido e resultado ocupam uma faixa com divisórias. As diferenças efetivas de cor e raio vêm de `src/design-system/themes/themeRegistry.js`; o material, a grade e o afastamento da lateral e do cabeçalho vêm de `themes/plataforma.css`. As caixas continuam no contrato de `vidro-erp.css` e `box-contract.css`, com transparência sem duplicação entre caixas e seus filhos. A extensão `themeVariants.plataforma` em `.impeccable/design.json` registra essa receita sem substituir os tokens das outras opções.

Sem suporte a desfoque ou com preferência de transparência reduzida, o painel usa superfície sólida. Impressão permanece clara e o Modo TV conserva sua apresentação própria. A troca de tema muda a aparência, sem alterar dados, permissões ou reconhecimento de custos na DRE.

### Revisão desktop de cabeçalhos, filtros e Modo TV — 23/11/2026

A partir de 1100 px, as telas operacionais usam o mesmo recuo superior no cabeçalho. A barra de comandos, os filtros de Obras e as ações da planilha usam o recuo de caixas da densidade ativa. O Modo TV usa a fonte do tema, Inter no Plataforma, e o título de leitura à distância de 24 a 32 px. A faixa de totais e os quadros usam fundo azul-marinho sólido, com âmbar e vermelho para desvios. As fotos de obra ficam no cabeçalho do quadro, separadas dos indicadores.
