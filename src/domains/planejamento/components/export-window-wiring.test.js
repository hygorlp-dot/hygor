import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, it } from "vitest";

// Bug real (29/09/2026): "Exportar A2" do planejamento abria uma aba em branco
// (about:blank). window.open com "noopener" devolve null ao app, então o
// document.write do cronograma nunca acontecia. Toda exportação que escreve o
// HTML na janela aberta precisa abrir sem noopener e cortar o vínculo depois
// (w.opener = null) - varre o src inteiro para o erro não voltar em outra tela.
const raiz = resolve(process.cwd(), "src");
const arquivos = dir => readdirSync(dir).flatMap(nome => {
  const caminho = join(dir, nome);
  if (statSync(caminho).isDirectory()) return nome === "node_modules" ? [] : arquivos(caminho);
  return /\.(jsx?|tsx?)$/.test(nome) && !/\.test\./.test(nome) ? [caminho] : [];
});

it("nenhuma janela aberta com noopener recebe document.write", () => {
  const ofensores = arquivos(raiz).filter(caminho =>
    /window\.open\([^)]*noopener[^)]*\)[\s\S]{0,400}?\.document\.write/.test(readFileSync(caminho, "utf8")));
  expect(ofensores.map(c => relative(raiz, c))).toEqual([]);
});

it("a exportação A2 numera as atividades pela EAP do orçamento", () => {
  const source = readFileSync(join(raiz, "domains/planejamento/components/PlanejamentoView.jsx"), "utf8");
  const inicio = source.indexOf("const exportarCronogramaA2");
  const trecho = source.slice(inicio, source.indexOf("setExportA2Modal(false);", inicio));
  expect(trecho).toContain("numeracaoEap(tarefas, orc?.etapas)");
  expect(trecho).toContain("w.opener=null");
});
