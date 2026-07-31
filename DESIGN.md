# ARCD Carbon — sistema visual

## Direção

Interface corporativa para gestão de obras inspirada na precisão estrutural do
IBM Carbon, adaptada ao mundo físico da construção. A experiência deve parecer
um instrumento de operação: densa, legível, previsível e sem decoração gratuita.

## Paleta

- Ouro ARCD `#D4AF37`: única cor de marca; ação primária, foco e seleção.
- Grafite `#161616`: navegação, títulos e texto principal.
- Concreto `#F4F4F4`: canvas da aplicação e campos.
- Papel `#FFFFFF`: painéis de conteúdo.
- Aço `#525252`: texto secundário.
- Linha técnica `#D6D6D6`: divisores e limites.
- Verde `#24A148`, amarelo `#F1C21B` e vermelho `#DA1E28`: apenas estados.

## Tipografia

IBM Plex Sans em toda a interface. IBM Plex Mono somente para valores, códigos,
datas e identificadores. Corpo com `letter-spacing: .16px`; títulos com peso
300–400 e hierarquia por tamanho, não por excesso de negrito.

## Forma e profundidade

- Grade de 4px.
- Campos de texto, seletores e áreas editáveis usam raio de 8px, superfície
  branca e borda contrastante; painéis permanecem estruturais, com até 4px.
- Bordas de 1px e mudança de superfície; sem sombras decorativas.
- Cards não devem flutuar nem usar gradientes.
- Áreas de toque com mínimo de 44px no mobile.

## Assinatura ARCD

A navegação usa uma linha dourada vertical como “linha de execução”, conectando
o setor à tela ativa. Fluxos de obra usam linhas horizontais para representar a
sequência planejamento → execução → controle.

## Responsividade

- Desktop: sidebar grafite, topbar de 48px e conteúdo em grade.
- Tablet: grades reduzem colunas antes de reduzir legibilidade.
- Mobile: uma coluna, navegação horizontal rolável e controles de 44px.
- Nenhum menu pode sobrepor outro; textos longos truncam ou quebram sem aumentar
  a largura da viewport.

## Padrão operacional do dashboard

O dashboard é a referência visual para todas as telas operacionais. Novos
módulos e revisões devem consumir os tokens `--arcd-type-*` e
`--arcd-icon-size-*`, sem criar tamanhos locais equivalentes.

- Título de página: `--arcd-type-page-title`, peso 600.
- Título de seção: `--arcd-type-section-title`, peso 600.
- Título de card: `--arcd-type-card-title`, peso 600.
- Corpo operacional: `--arcd-type-body`, peso 400.
- Rótulos: `--arcd-type-label`, peso 600; caixa alta apenas em indicadores e
  cabeçalhos curtos.
- Legendas e metadados: `--arcd-type-caption`, sem reduzir abaixo desse valor.
- Valores de KPI: `--arcd-type-kpi`, com algarismos tabulares quando forem
  medições, datas, códigos ou valores financeiros.
- Ícones: 13px em controles compactos, 16px no uso padrão e 20px em destaques.
  Todos usam o mesmo traço de 2px e nunca substituem o rótulo de uma ação.
- Cards de resumo usam `SummaryCard`; cabeçalhos usam `PageHeader`; controles
  usam os primitivos do design system. Estado é comunicado por cor, texto e
  ícone, nunca apenas por cor.
