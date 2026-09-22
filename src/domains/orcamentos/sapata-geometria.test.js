// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extrairProjetoEstrutural } from "./structural-import";
import { calcularSapataTipo } from "./memoria-calculo-estrutural";
import { recuperarGeometriaSapatas } from "./sapata-geometria-recovery";

const texto = readFileSync(new URL("./fixtures/foundation-extraction.txt", import.meta.url), "utf8");
const tipos = () => extrairProjetoEstrutural(texto).sapatas;
const legado = () => tipos().map((s, i) => ({ ...s, id: `s${i}`, geometriaProjeto: undefined, geometriaPendente: true, alturaBase: 0, alturaTronco: 0 }));

it("extrai os dois cortes dos 14 grupos sem deixar geometria pendente", () => {
  const sapatas = tipos();
  expect(sapatas).toHaveLength(14);
  expect(sapatas.every(s => s.geometriaProjeto && !s.geometriaPendente)).toBe(true);
  expect(sapatas.find(s => s.tipo === "P19").geometriaProjeto).toMatchObject({ topoLargura: .4, topoComprimento: .2, afastamentosY: [1.2, 0] });
});

it("calcula volumes pela integração independente de seções e fôrmas das sapatas de borda", () => {
  for (const s of tipos()) {
    const g = s.geometriaProjeto;
    const area = t => (s.largura + (g.topoLargura - s.largura) * t) * (s.comprimento + (g.topoComprimento - s.comprimento) * t);
    const integralSimpson = s.alturaTronco * (area(0) + 4 * area(.5) + area(1)) / 6;
    const calc = calcularSapataTipo({...s,folgaEscavacao:.2,profundidadeEscavacao:1.5});
    expect(calc.volumeTroncoUnit).toBeCloseTo(integralSimpson, 12);
    expect(calc.volumeSapataUnit).toBeCloseTo(s.largura * s.comprimento * s.alturaBase + integralSimpson, 12);
    expect(calc.reaterroTotal + calc.volumeSapataTotal).toBeCloseTo(calc.volumeEscavacaoTotal, 10);
  }
  expect(calcularSapataTipo(tipos().find(s=>s.tipo==='P18')).formaAreaUnit).toBeCloseTo(.8, 10);
  expect(calcularSapataTipo(tipos().find(s=>s.tipo==='P19')).formaAreaUnit).toBeCloseTo(2.28, 10);
});

it("recupera dados legados idênticos ao documento sem alterar identidades ou intervenções manuais", () => {
  const original = legado();
  const recuperados = recuperarGeometriaSapatas(original);
  expect(recuperados.every(s => !s.geometriaPendente)).toBe(true);
  expect(recuperados.map(s=>s.id)).toEqual(original.map(s=>s.id));
  expect(original[0].alturaBase).toBe(0);
  original[0].volumeConferidoM3 = .3;
  expect(recuperarGeometriaSapatas(original)[0]).toBe(original[0]);
});

it("não aplica a referência a outro conjunto, duplicatas ou dimensões alteradas", () => {
  const alterado = legado(); alterado[0].largura = 2;
  expect(recuperarGeometriaSapatas(alterado)).toBe(alterado);
  const duplicado = legado(); duplicado[1] = { ...duplicado[0] };
  expect(recuperarGeometriaSapatas(duplicado)).toBe(duplicado);
  const incompleto = legado().slice(1);
  expect(recuperarGeometriaSapatas(incompleto)).toBe(incompleto);
});

it("não inventa topo quando só existe o quadro sem os cortes", () => {
  const soQuadro = texto.slice(0, texto.indexOf("P1 e P5", texto.indexOf("P19")));
  expect(extrairProjetoEstrutural(soQuadro).sapatas.every(s=>s.geometriaPendente && !s.geometriaProjeto)).toBe(true);
});
