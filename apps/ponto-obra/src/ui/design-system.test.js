// @vitest-environment node
//
// Guardrails do ARCD Precision / Cupertino Industrial (equivalente, para
// React Native, ao detector do Impeccable usado no ERP). Lê o código das
// telas e dos componentes e barra os antipadrões já apontados nas críticas
// de .impeccable/critique: cor solta, gradiente, sombra decorativa, raio
// arbitrário, espaço fora da grade, peso tipográfico pesado, controle sem
// nome acessível e animação de layout.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COR, COR_DO_TOM, ESPACO, GRADE_ESPACO, RAIO, TIPO, TOQUE } from "./tokens.js";

const RAIZ = path.resolve(__dirname, "../..");
const ler = rel => readFileSync(path.join(RAIZ, rel), "utf8");
const TELAS = ["App.js", ...readdirSync(path.join(RAIZ, "src/telas")).filter(f => f.endsWith(".js")).map(f => `src/telas/${f}`)];
const INTERFACE = [...TELAS, "src/ui/index.js"];
const semComentarios = fonte => fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const ocorrencias = (arquivos, regex) => arquivos.flatMap(f => [...semComentarios(ler(f)).matchAll(regex)].map(m => `${f}: ${m[0]}`));

// Contraste WCAG.
const luminancia = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

describe("tokens", () => {
  it("paleta oficial do Ponto de Obra", () => {
    expect(COR).toMatchObject({
      fundo: "#0B0B0C", superficie: "#1C1C1E", superficieElevada: "#242426", divisor: "#38383A",
      texto: "#F5F5F7", textoSecundario: "#A1A1A6", textoTerciario: "#6E6E73",
      ouro: "#D4AF37", sucesso: "#30D158", atencao: "#FFD60A", erro: "#FF453A",
    });
  });

  it("espaço na grade de 4 e raios só os documentados", () => {
    expect(Object.values(ESPACO).every(v => v % 4 === 0)).toBe(true);
    expect(RAIO).toEqual({ pequeno: 10, controle: 14, botao: 18, painel: 20, camera: 24, pilula: 999 });
  });

  it("alvos de toque: mínimo 44; ação primária ~66", () => {
    expect(TOQUE.minimo).toBeGreaterThanOrEqual(44);
    expect(Object.values(TOQUE).every(v => v >= 44)).toBe(true);
    expect(TOQUE.primario).toBe(66);
  });

  it("tipografia: nenhum peso pesado (800/900) e nada abaixo de 13 px", () => {
    expect(Object.values(TIPO).every(t => t.fontSize >= 13)).toBe(true);
    expect(Object.values(TIPO).map(t => t.fontFamily).join(" ")).not.toMatch(/(?<!Semi)Bold|Black|Heavy/);
    expect(TIPO.relogio).toMatchObject({ fontSize: 80, fontFamily: "IBMPlexSans_300Light" });
    expect(TIPO.botao).toMatchObject({ fontSize: 20, fontFamily: "IBMPlexSans_600SemiBold" });
  });

  it("contraste: texto principal e secundário legíveis no fundo e na superfície; CTA legível", () => {
    for (const fundo of [COR.fundo, COR.superficie, COR.superficieElevada]) {
      expect(contraste(COR.texto, fundo)).toBeGreaterThanOrEqual(7);
      expect(contraste(COR.textoSecundario, fundo)).toBeGreaterThanOrEqual(4.5);
      for (const tom of [COR.sucesso, COR.atencao, COR.erro, COR.ouro]) expect(contraste(tom, fundo)).toBeGreaterThanOrEqual(3);
    }
    expect(contraste(COR.sobreOuro, COR.ouro)).toBeGreaterThanOrEqual(7);
  });

  it("tom neutro e info nunca usam cor de estado", () => {
    expect([COR_DO_TOM.neutro, COR_DO_TOM.info]).not.toContain(COR.sucesso);
    expect([COR_DO_TOM.neutro, COR_DO_TOM.info]).not.toContain(COR.atencao);
    expect([COR_DO_TOM.neutro, COR_DO_TOM.info]).not.toContain(COR.erro);
  });
});

describe("telas e componentes (detector)", () => {
  it("nenhuma cor solta: toda cor vem dos tokens", () => {
    expect(ocorrencias(INTERFACE, /#[0-9a-fA-F]{3,8}\b|rgba?\(/g)).toEqual([]);
  });

  it("sem gradiente, sem sombra decorativa, sem elevação", () => {
    expect(ocorrencias(INTERFACE, /gradient|shadow(Color|Opacity|Radius|Offset)|elevation\s*:|boxShadow/gi)).toEqual([]);
  });

  it("raio só por token (RAIO.*), nunca número solto", () => {
    expect(ocorrencias(INTERFACE, /border(Top|Bottom)?(Left|Right)?Radius\s*:\s*\d/g)).toEqual([]);
  });

  it("espaço só na grade (gap, padding, margin)", () => {
    const literais = ocorrencias(INTERFACE, /\b(gap|rowGap|columnGap|padding|paddingHorizontal|paddingVertical|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginHorizontal|marginVertical|marginTop|marginBottom|marginLeft|marginRight)\s*:\s*(\d+)/g);
    const fora = literais.filter(o => !GRADE_ESPACO.includes(Number(o.match(/(\d+)$/)[1])));
    expect(fora).toEqual([]);
  });

  it("tipografia só pelos tokens: telas não definem fontSize, fontWeight nem fontFamily", () => {
    expect(ocorrencias(TELAS, /font(Size|Weight|Family)\s*:/g)).toEqual([]);
    expect(ocorrencias(INTERFACE, /fontWeight\s*:\s*["']?(800|900|bold)/g)).toEqual([]);
  });

  it("todo Pressable tem papel e nome acessível (ou é só invólucro de um campo)", () => {
    // Abertura da tag termina em `}>` ou `">` seguido de quebra/filho (o `>`
    // de uma arrow function no meio dos atributos não conta).
    const aberturas = fonte => [...fonte.matchAll(/<Pressable\b/g)].map(m => {
      const resto = fonte.slice(m.index);
      return resto.slice(0, resto.search(/[}"]>\s*[\n<{]/) + 2);
    });
    const semNome = INTERFACE.flatMap(f => aberturas(semComentarios(ler(f)))
      .filter(a => !/accessible=\{false\}/.test(a) && !(/accessibilityRole=/.test(a) && /accessibilityLabel=/.test(a)))
      .map(a => `${f}: ${a.slice(0, 80)}`));
    expect(semNome).toEqual([]);
  });

  it("telas usam os componentes: nada de Text/TouchableOpacity cru nem Pressable fora de listas", () => {
    expect(ocorrencias(TELAS, /<Text\b|<TouchableOpacity|<TouchableHighlight|<Button\b/g)).toEqual([]);
  });

  it("movimento só com driver nativo (opacidade/escala/translação), sem animação de layout", () => {
    expect(ocorrencias(INTERFACE, /useNativeDriver\s*:\s*false|LayoutAnimation/g)).toEqual([]);
  });

  it("nada de emoji como ícone", () => {
    expect(ocorrencias(INTERFACE, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu)).toEqual([]);
  });
});
