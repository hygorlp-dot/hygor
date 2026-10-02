// ARCD Precision / Cupertino Industrial - tokens do Ponto de Obra.
// Fonte única de cor, tipografia, espaço, raio e movimento do app. Puro (sem
// React Native) para o teste conferir que nenhuma tela inventa valor próprio.
// Documentação: apps/ponto-obra/DESIGN.md.

export const COR = Object.freeze({
  fundo: "#0B0B0C",
  superficie: "#1C1C1E",
  superficieElevada: "#242426",
  divisor: "#38383A",
  borda: "rgba(255,255,255,0.08)",
  texto: "#F5F5F7",
  textoSecundario: "#A1A1A6",
  // 3,9:1 sobre o fundo: só para texto grande ou dispensável (nunca legenda).
  textoTerciario: "#6E6E73",
  ouro: "#D4AF37",
  sobreOuro: "#0B0B0C",
  sucesso: "#30D158",
  atencao: "#FFD60A",
  erro: "#FF453A",
  camera: "#000000",
  // Véu sobre a câmera (instrução legível sem esconder o rosto).
  veu: "rgba(11,11,12,0.72)",
  // Guia facial em repouso: presente sem competir com o rosto.
  guiaNeutra: "rgba(245,245,247,0.45)",
});

// Grade de 4 px. Nenhum valor fora desta lista em gap/padding/margin.
export const ESPACO = Object.freeze({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40, x5: 48 });
export const GRADE_ESPACO = Object.freeze([0, ...Object.values(ESPACO)]);

export const RAIO = Object.freeze({ pequeno: 10, controle: 14, botao: 18, painel: 20, camera: 24, pilula: 999 });

// Alvo de toque: 44 é o mínimo; ações de obra usam mais (luva, pressa).
export const TOQUE = Object.freeze({ minimo: 44, linha: 56, secundario: 56, primario: 66 });

// Uma família por peso: no Android, fonte carregada + fontWeight sintetiza
// negrito falso. Sem a fonte (falha ao carregar) o Android usa a do sistema.
export const FAMILIA = Object.freeze({
  leve: "IBMPlexSans_300Light",
  regular: "IBMPlexSans_400Regular",
  media: "IBMPlexSans_500Medium",
  semi: "IBMPlexSans_600SemiBold",
  mono: "IBMPlexMono_400Regular",
  monoMedia: "IBMPlexMono_500Medium",
});

// Escala tipográfica. `escalaMax` limita o aumento de fonte do sistema onde o
// texto grande estouraria a largura (relógio, botões); o resto escala livre.
export const TIPO = Object.freeze({
  relogio: { fontFamily: FAMILIA.leve, fontSize: 80, lineHeight: 88, letterSpacing: -1, escalaMax: 1.15 },
  // Hora do comprovante (com segundos: é a precisão do registro).
  horaComprovante: { fontFamily: FAMILIA.leve, fontSize: 56, lineHeight: 64, escalaMax: 1.15 },
  hero: { fontFamily: FAMILIA.regular, fontSize: 34, lineHeight: 40, escalaMax: 1.3 },
  tituloPagina: { fontFamily: FAMILIA.media, fontSize: 28, lineHeight: 34, escalaMax: 1.3 },
  tituloSecao: { fontFamily: FAMILIA.media, fontSize: 22, lineHeight: 28, escalaMax: 1.4 },
  corpo: { fontFamily: FAMILIA.regular, fontSize: 17, lineHeight: 24, escalaMax: 1.6 },
  botao: { fontFamily: FAMILIA.semi, fontSize: 20, lineHeight: 24, escalaMax: 1.3 },
  botaoSecundario: { fontFamily: FAMILIA.media, fontSize: 18, lineHeight: 24, escalaMax: 1.3 },
  rotulo: { fontFamily: FAMILIA.media, fontSize: 15, lineHeight: 20, escalaMax: 1.5 },
  legenda: { fontFamily: FAMILIA.regular, fontSize: 13, lineHeight: 18, escalaMax: 1.5 },
  // Cabeçalho de seção (caixa alta curta, como os grupos de Ajustes).
  secao: { fontFamily: FAMILIA.media, fontSize: 13, lineHeight: 18, letterSpacing: 0.6, escalaMax: 1.4 },
  mono: { fontFamily: FAMILIA.mono, fontSize: 17, lineHeight: 24, escalaMax: 1.5 },
  codigo: { fontFamily: FAMILIA.monoMedia, fontSize: 30, lineHeight: 36, escalaMax: 1.2 },
});

// Movimento: só opacidade, escala e translação (driver nativo).
export const MOVIMENTO = Object.freeze({
  toque: 120,
  rapido: 150,
  padrao: 200,
  lento: 250,
  sucesso: 350,
  escalaToque: 0.98,
});

// Tempo que o comprovante fica na tela antes de voltar sozinho.
export const COMPROVANTE_MS = Object.freeze({ normal: 6000, comAviso: 10000 });

// Tom semântico → cor. "neutro" e "info" nunca usam verde/amarelo/vermelho.
export const COR_DO_TOM = Object.freeze({
  sucesso: COR.sucesso,
  atencao: COR.atencao,
  erro: COR.erro,
  neutro: COR.textoSecundario,
  info: COR.textoSecundario,
  marca: COR.ouro,
});
