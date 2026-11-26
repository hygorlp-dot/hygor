# Regras de UX/UI do ERP MARCELL

Valem para toda tela nova e toda alteração de tela. Saíram de seis rodadas de crítica
de interface (heurísticas de Nielsen, novembro de 2026), que levaram o ERP de 24/40 para 29/40.
Cada regra diz o que fazer, por quê e como conferir. Na dúvida entre a regra e a pressa, siga a regra.

A fonte da escala, das cores e dos temas continua sendo o código: `src/design-system/foundations.js`,
`src/design-system/themes/themeRegistry.js` e os CSS de `src/design-system/themes/`. Este documento
diz como usá-los; o `DESIGN.md` guarda o histórico das decisões visuais.

## 1. Cor

1. **Só tokens de tema.** Cor em tela vem de `var(--arcd-*)`. Nada de hexadecimal, `rgb()` ou `white` em CSS
   ou estilo inline de tela. Cor fixa quebra o tema MARCELL Noite (vira bloco branco ou texto invisível).
   A paleta `C` de `src/legacy/palette.js` é legado: não use em código novo.
2. **Cor só para desvio.** Número fica neutro (`--arcd-text-primary`). Vermelho só para negativo, vencido ou crítico;
   laranja só para atenção; verde só quando o positivo é a notícia (lucro, recebido no prazo). Zero é neutro.
   A categoria (faturamento, custo, MO) não pinta o número.
3. **Estado normal não é destaque.** "Regular", "Em dia", "Sem pendências" ficam discretos (ícone ou texto secundário),
   sem faixa colorida.
4. **Ação ≠ estado.** A cor de ação (`--arcd-action-primary`: azul-marinho no Preciso, dourado no Noite) marca botão principal
   e foco. Aba ativa, chip selecionado, item de menu ativo e filete de cartão usam texto ou borda neutros.
5. **Nunca só cor.** Todo estado colorido também tem palavra ou ícone ("vencido", "4 dias de atraso", ⚠).
6. **Contraste mínimo de 4,5:1** para texto (3:1 para texto grande e ícones de controle), conferido nos dois temas.
   O teste `src/design-system/theme/theme-contract.test.js` cobre os pares dos tokens; tela nova não pode criar par fora deles.

## 2. Números e datas

1. **Formato brasileiro sempre.** Dinheiro com `fmt`, percentual com vírgula (`pct1`/`Intl.NumberFormat('pt-BR')`),
   datas `dd/mm/aaaa`. Proibido `toFixed(n)}%` e "0.0%".
2. **Colunas numéricas à direita**, com o cabeçalho no mesmo eixo (`data-align="end"` no `th` e no `td`) e
   `font-variant-numeric: tabular-nums`. Linhas de total e de detalhe param no mesmo recuo.
3. **Negativo com sinal** ("-R$ 800,00") e em vermelho.
4. **Mesma pergunta, mesmo número.** Contagens que aparecem em mais de uma tela (pendências críticas, obras em atenção,
   vencidos) vêm da mesma função. Duas telas não podem mostrar números diferentes para a mesma coisa.

## 3. Texto

1. **Plural de verdade.** Use `contar(n, "singular", "plural")` de `src/design-system/copy.js` (inteiros) ou
   `contarDecimal(n, ...)` (dias com meio período). Proibido "(s)". Passe sempre o **número**, nunca um texto já
   formatado (`fmt`, `fmtCompact`, `toFixed`): `Number("10,5")` é NaN e a tela mostraria "0 dias". Dinheiro não passa por `contar`.
2. **Caixa de frase** em títulos, rótulos e botões ("Total de custos", não "TOTAL CUSTOS" nem "Total Custos").
3. **Palavras do canteiro e do escritório da empresa**, não de sistema. Termos já adotados pela empresa (ex.: "baseline")
   ficam; jargão técnico novo precisa de explicação curta ao lado.
4. **Aviso diz o que aconteceu, o efeito e o que fazer**, com a ação no próprio aviso ("Tentar de novo", "Abrir cadastro").

## 4. Hierarquia e ações

1. **Uma ação principal por tela.** Ações de linha e de cartão são secundárias. Exportar, imprimir e atualizar nunca
   são a principal.
2. **Ação de risco tem peso de risco.** Aprovar o que fica imutável, fechar período, excluir: botão secundário,
   confirmação com o nome do que será afetado, e nunca colada na ação comum.
3. **Excluir mora no menu "⋯"** (`.record-more`) dos cartões e linhas, não ao lado de "Abrir".
4. **Bloqueado explica por quê**, ao lado do botão, e o botão desabilitado não parece clicável.
5. **Títulos sem pular nível** (h1 → h2 → h3), para leitor de tela e para o detector.

## 5. Indicadores

1. **Faixa única de indicadores** (`src/design-system/patterns/kpi-strip.css`): régua com divisórias, rótulo em `--arcd-type-label`,
   número em `--arcd-type-kpi`, uma linha de contexto. Não crie outro desenho de cartão de KPI.
2. **Até quatro indicadores à vista**, os que pedem decisão. O resto vai para "Mais indicadores".
3. **Indicador sem dado diz isso** ("Sem faturamento no período"), em vez de mostrar 0% ou um gráfico vazio.
   Gráfico com uma categoria só vira uma frase.

## 6. Layout e tipografia

1. **Fonte Inter** (`--arcd-font-sans`; Geist Mono em `--arcd-font-mono`), servida do próprio projeto. **Escala em `tokens/typography.css` e densidade em `tokens/density.css`**
   (direção Plataforma, 19/11/2026): título 22 px, indicador 18 px, corpo e tabela 13 px. No ERP web móvel com densidade Compacta, todos os temas usam título de 18 px, indicador de 15 px, corpo, tabela e botões de 12 px, seletores de 13 px e campos de digitação de 16 px. Nada abaixo de 12 px (`--arcd-type-caption`), nada de tamanho em px solto.
2. **Texto corrido com até ~72 caracteres por linha.**
3. **Abas numa linha só**, com rolagem lateral e borda esmaecida; nunca quebrando em duas linhas.
   No máximo dois níveis de navegação por tela (ex.: abas de fluxo + filtros do escopo).
4. **Filtros do escopo juntos** (competência, obra, grupo) num bloco só.
5. **Alvos de toque**: 24 px no computador, 44 px no celular.
6. **Nome longo corta com reticências** e mostra o nome inteiro no `title`.

## 7. Temas

1. **Toda mudança visual é conferida no MARCELL Preciso, no MARCELL Noite e no MARCELL Cristal**, em 1440 px e em 390 px.
2. **Vidro (Preciso, Noite e Cristal) só sobre o fundo da marca** (gradiente leve e emblema em marca d'água), nunca sobre foto
   ou forma colorida, e nunca vidro sobre vidro.
   A receita fica em `src/design-system/themes/vidro-erp.css`; caixa nova de tela entra na lista dela. Sem desfoque
   ou com "reduzir transparência", as caixas voltam a ser sólidas.
3. **Impressão e PDF sempre claros.**
4. **Correção que vale só para um tema vai no CSS do tema** (`[data-theme="noite"]`), nunca no componente.

## 8. Caixas e alinhamento

Toda tela é feita de caixas iguais, alinhadas pela mesma régua. Tokens em `foundations.js`; receita em
`src/design-system/themes/box-contract.css` (vale para todos os temas, depois de `vidro-erp.css`).

1. **Dois raios só.** Controle (botão, campo, selo, chip) usa `--arcd-radius-control`; caixa (cartão, painel, faixa de
   indicadores, bloco de filtros, tabela) usa `--arcd-box-radius`. Pílulas e elementos circulares usam `--arcd-radius-pill`.
   Aplique esses tokens na origem do estilo.
2. **Caixa padrão:** superfície `--arcd-surface-card` (ou o vidro do tema), borda de 1 px `--arcd-border-default`,
   raio `--arcd-box-radius` e recuo interno `--arcd-box-padding`, que acompanha a densidade. Use `--arcd-border-width` em divisórias e bordas comuns. Sombra vem do tema, nunca da tela.
   Caixa com campos (filtros, comandos) sempre tem recuo: rótulo e campo nunca encostam na borda.
3. **Caixa com tabela não tem recuo:** a tabela encosta na borda e só a primeira e a última coluna recuam
   `--arcd-box-padding`. Assim o texto da tabela fica na mesma vertical do texto da caixa de filtros acima.
4. **Cabeçalho de caixa numa linha:** título à esquerda, ações à direita, centralizados na altura, com
   `--arcd-box-header-gap` entre eles. No celular as ações descem para baixo do título, alinhadas à esquerda.
5. **Espaço só pela escala** `--arcd-space-*` (4, 8, 12, 16, 24 e 32 px). Entre caixas irmãs, `--arcd-box-gap`;
   dentro da caixa, entre grupos, `--arcd-space-3`; entre rótulo e campo, `--arcd-space-1`. Nada de 5, 6, 7, 10 ou 14 px.
6. **Uma régua lateral por tela.** Título da página, caixas e tabelas começam na mesma margem (`--arcd-page-padding`;
   `--arcd-page-padding-mobile` no celular) e terminam na mesma margem direita. Caixa dentro de caixa não soma margem.
7. **Rótulo acima do valor**, alinhados à esquerda, em indicadores e formulários. Número de coluna à direita (§2.2),
   com algarismos tabulares e unidade na mesma coluna.
8. **Mesma função, mesma caixa.** Lista de trabalho, filtros e indicadores têm o mesmo desenho em todos os módulos
   (`WorkspaceCommandBar`, `kpi-strip.css`, `SummaryCard`); não crie variação local para resolver um módulo.
9. **No celular**, caixas ocupam a largura toda menos a margem; colunas viram pilha, sem rolagem lateral da página.

## 9. Verificação antes do PR

1. `npm run lint` inclui `scripts/check-ux-rules.mjs`, que barra aumento de cores fixas em CSS de tela, de textos "(s)",
   de percentuais com ponto, de `contar()` recebendo texto formatado e, desde 19/11/2026, de raio em px (CSS de tela e
   `borderRadius` numérico no JSX) e de espaçamento fora da escala (5, 6, 7, 10, 14 px) no CSS de tela.
   Se a contagem cair, atualize a linha de base com `node scripts/check-ux-rules.mjs --update`.
2. Telas alteradas passam pela crítica do Impeccable (revisão de design + detector) nos dois temas.
   A nota não pode cair em relação à anterior; registre a nota no PR.
3. O PR leva capturas antes e depois, nos dois temas, das telas alteradas.
4. Teste que confere texto de tela usa o texto novo (plural certo, vírgula decimal).
