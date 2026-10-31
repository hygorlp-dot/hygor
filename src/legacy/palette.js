// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.



export const C = {
  // MARCELL: areia, azul-marinho e ouro. Valores literais de compatibilidade para gráficos.
  bg:       "#F3F0E9",
  surface:  "#FFFFFF",
  card:     "#FFFFFF",
  card2:    "#E8E5DF",
  border:   "#D9DDE2",
  // Ouro acessível - seleção e identidade
  yellow:   "#7B6030",     // Ouro acessível
  yellowD:  "#7B6030",     // Ouro escuro
  yellowDim:"#EEE5D5",     // Ouro claro
  // Azul-marinho MARCELL
  text:     "#0D1B2E",     // Grafite - texto principal
  muted:    "#536171",
  subtle:   "#34445A",
  ink:      "#0D1B2E",     // Texto sobre fundo ouro
  // Cinza Técnico
  cinza:    "#78818B",
  sand:     "#F3F0E9",
  ivory:    "#E8E5DF",
  // Sistema
  green:    "#2E6652",     // Verde técnico
  red:      "#A63B3B",     // Vermelho técnico
  blue:     "#355874",     // Azul técnico
  orange:   "#855A24",     // Laranja técnico
  purple:   "#536171",     // Roxo técnico
  line:     "#D9DDE2",
  shadow:   "rgba(22,22,22,.045)",
  // Tokens de forma - controlam a "temperatura" visual do app inteiro. Valores
  // baixos = aspecto técnico/instrumento; altos = aspecto consumidor. Toda a
  // interface lê daqui, então ajustar aqui muda tudo de forma coerente.
  rSm:      6,             // raio pequeno (chips, inputs internos)
  rMd:      8,
  rLg:      8,
  shHair:   "none",
  shCard:   "none",
};


// Ponte curta durante a migração: pontos que ainda recebem a paleta legada
// publicam somente uma intenção visual para as classes semânticas. Nenhum
// componente novo deve receber hexadecimais ou escolher cores livremente.
export const semanticToneFromLegacyColor = color => {
  if (color === C.green) return "success";
  if (color === C.red) return "danger";
  if (color === C.orange) return "warning";
  if (color === C.blue) return "info";
  if (color === C.purple) return "auxiliary";
  if (color === C.yellow || color === C.yellowD) return "primary";
  return "neutral";
};


// Escala tipografica unica do app. Toda tela nova (ou revisada) deve montar
// seus titulos/textos a partir daqui em vez de inventar fontSize/fontWeight
// soltos - e o que unifica visualmente heroes, cards e paineis diferentes.
export const FONT_DISPLAY = "var(--arcd-font-sans)";

export const TYPO = {
  h1:      { fontFamily:FONT_DISPLAY, fontWeight:600, fontSize:"var(--arcd-type-page-title)", letterSpacing:"var(--arcd-letter-spacing-tight)", lineHeight:1.15, color:C.text },
  h2:      { fontFamily:FONT_DISPLAY, fontWeight:600, fontSize:"var(--arcd-type-section-title)", letterSpacing:"var(--arcd-letter-spacing-tight)", lineHeight:1.18, color:C.text },
  h3:      { fontFamily:FONT_DISPLAY, fontWeight:600, fontSize:"var(--arcd-type-card-title)", letterSpacing:-.1, lineHeight:1.25, color:C.text },
  h4:      { fontFamily:FONT_DISPLAY, fontWeight:600, fontSize:"var(--arcd-type-body)", letterSpacing:0, lineHeight:1.3, color:C.text },
  eyebrow: { fontSize:"var(--arcd-type-label)", fontWeight:400, letterSpacing:0, color:C.muted },
  body:    { fontSize:"var(--arcd-type-body)", fontWeight:400, lineHeight:1.5, color:C.text },
  bodyMuted:{ fontSize:"var(--arcd-type-body)", fontWeight:400, lineHeight:1.5, color:C.muted },
  small:   { fontSize:"var(--arcd-type-caption)", fontWeight:500, color:C.muted },
  label:   { fontFamily:FONT_DISPLAY, fontSize:"var(--arcd-type-label)", fontWeight:600, letterSpacing:"var(--arcd-letter-spacing-body)", color:C.text },
  // Tamanho/peso reais vêm do override global (.tab-row button) em index.css,
  // que também cobre sidebar, nav mobile e os demais menus de abas do app -
  // isto aqui é só o fallback caso a classe não esteja disponível.
  tab:       { fontFamily:"var(--arcd-font-sans)", fontSize:"var(--arcd-type-label)", fontWeight:600, letterSpacing:.08 },
  tabDetail: { fontSize:"var(--arcd-type-caption)", fontWeight:500 },
};


// KANBAN - tokens estilo Trello. Colunas estreitas e altas, fundo levemente
// cinza, cards brancos compactos com sombra fininha. O objetivo é densidade: o
// quadro rola horizontal e cabe muita coisa na tela sem parecer "gordo".
// Reutilizados por todos os Kanbans (Terceiros, Obras, Funil, Jornada) para
// que fiquem visualmente idênticos.
export const KB = {
  larguraCol: 272,          // largura da coluna (Trello usa ~272px)
  gapCols:    8,            // espaço entre colunas
  gapCards:   6,            // espaço entre cards
  raioCol:    8,
  raioCard:   6,
  padCol:     "6px 6px 8px",
  padCard:    "7px 9px",
  scroll: {                 // container do quadro
    display:"flex", gap:8, overflowX:"auto", overflowY:"hidden",
    paddingBottom:10, alignItems:"flex-start",
    WebkitOverflowScrolling:"touch", scrollSnapType:"x proximity",
  },
  coluna: (cor, ativa) => ({
    width:272, minWidth:272, maxWidth:272, scrollSnapAlign:"start",
    background: ativa ? `${cor}0e` : "#F0EDE7",
    border:`1px solid ${ativa ? cor : "#E2DCD2"}`,
    borderRadius:8, display:"flex", flexDirection:"column",
    maxHeight:"calc(100vh - 220px)",
    transition:"background .15s, border-color .15s",
  }),
  colHead: (cor) => ({
    display:"flex", justifyContent:"space-between", alignItems:"center", gap:6,
    padding:"8px 10px", borderTop:`3px solid ${cor}`,
    borderTopLeftRadius:8, borderTopRightRadius:8,
    position:"sticky", top:0, zIndex:1, background:"inherit",
  }),
  colBody: {
    padding:"0 6px 6px", display:"flex", flexDirection:"column", gap:6,
    overflowY:"auto", flex:1,
  },
  card: (destaque) => ({
    background:"#fff",
    border:`1px solid ${destaque || "#E2DCD2"}`,
    borderRadius:6, padding:"7px 9px", cursor:"pointer",
    boxShadow:"0 1px 2px rgba(18,18,18,.08)",
    display:"flex", flexDirection:"column", gap:4,
  }),
  contador: {
    fontSize:"var(--arcd-type-label)", fontWeight:600, color:C.muted,
    background:"#fff", borderRadius:99, padding:"1px 8px", minWidth:22, textAlign:"center",
  },
};

export const C_ARCD_SETOR={...C,purple:C.yellowD};
