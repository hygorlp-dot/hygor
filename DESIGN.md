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
typography:
  display:
    fontFamily: 'P052, Georgia, serif'
    fontSize: 'clamp(26px, 2.5vw, 38px)'
    fontWeight: 400
    lineHeight: 1.2
  navigation:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
  dashboard-title:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 500
  headline:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.75rem'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: 1.15
  card-title:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: '0.01rem'
  label:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.8125rem'
    fontWeight: 600
    letterSpacing: '0.01rem'
  caption:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
    fontSize: '0.75rem'
  kpi:
    fontFamily: 'Nimbus Sans, Helvetica Neue, Arial, sans-serif'
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
**Body Font:** Nimbus Sans, com Helvetica Neue, Arial e sans-serif de reserva.
**Label/Mono Font:** IBM Plex Mono e fontes monoespaçadas de sistema para identificadores técnicos.

Nimbus Sans sustenta títulos, corpo, controles e números financeiros. P052 aparece na mensagem institucional do acesso desktop. As fontes MARCELL são servidas localmente por WOFF2; os arquivos OTF, licenças e origem da distribuição URW Base 35 / Artifex acompanham o pacote em `public/fonts/marcell`.

### Hierarchy
- **Display:** mensagem institucional do acesso, com tamanho fluido definido no frontmatter.
- **Headline:** título de página (28 px); o acesso reduz o título para 24 px no celular.
- **Title:** seção e título de modal (20 px).
- **Card title:** título de cartão (16 px).
- **Body:** corpo, tabela e controle operacional (14 px).
- **Label:** rótulo (13 px); **caption:** apoio (12 px).
- **KPI:** valor principal (24 px), com algarismos tabulares.

**The Operational Type Rule.** Valores financeiros usam Nimbus Sans e algarismos tabulares; monoespaçada identifica códigos, PIX, CPF, patrimônio e NSR.

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

Ações diretas, com altura ligada à densidade e rótulo semibold. O primário usa azul-marinho e branco; secundário usa branco e borda de controle; ghost usa fundo transparente. O hover escurece a ação primária ou aplica superfície neutra. A família legada de botões do tema usa um hover azul próprio (`#1E3552`); os primitivos usam `action-hover`. Desabilitados reduzem opacidade e retiram o cursor de ação. Foco visível usa contorno de 3 px e afastamento de 2 px. Transições de estado usam 120 ms; movimento reduzido usa 1 ms.

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

Cabeçalhos em azul suave (#EDF3F7) para notícias e areia dourada (#F8F3E9) para ações. Ícones simples, números tabulares e sinais semânticos preservados; sem caixas decorativas repetidas. O contraste, os filtros e os valores financeiros continuam operacionais. Demais módulos mantêm sua escala normativa.

## Do's and Don'ts

### Do:
- **Do** usar a assinatura e o monograma oficiais em suas versões adequadas ao fundo.
- **Do** preservar contraste, foco visível, estados textuais e alvos de toque.
- **Do** manter valores completos, algarismos tabulares e informações de relatório legíveis.
- **Do** usar Nimbus Sans na operação e P052 na mensagem institucional do acesso.

### Don't:
- **Don't** redesenhar, distorcer ou aplicar filtros aos vetores oficiais.
- **Don't** usar ouro ou ardósia claros como texto pequeno sobre fundo claro.
- **Don't** substituir estados funcionais pela cor da marca.
- **Don't** transformar identificadores internos `arcd` ou nomes legais cadastrados em rótulos de identidade novos por substituição indiscriminada.
