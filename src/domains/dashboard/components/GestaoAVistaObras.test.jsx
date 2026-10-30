import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GestaoAVistaObras from "./GestaoAVistaObras.jsx";

let root, container;
const onAbrirObra = vi.fn();
const linha = over => ({ id: "o1", nome: "P1-08", motivo: "Custo 8 pontos à frente do avanço", situacao: "critico",
  orcado: 100000, custo: 58000, gastoPct: 58, avanco: 50, avancoFonte: "medicao", desvio: 8,
  etapas: [{ id: "t1", nome: "Fundação", estado: "feita", peso: 25 }, { id: "t2", nome: "Estrutura", estado: "atual", peso: 75 }],
  etapaAtual: "Estrutura", entrega: "2026-11-15", diasEntrega: 16, equipeHoje: 4, pendenciasPonto: 0, ...over });
const resumo = {
  linhas: [linha(), linha({ id: "o2", nome: "CA1-06", situacao: "ok", motivo: "Sem pendências", orcado: null, gastoPct: null,
    desvio: null, etapas: [], etapaAtual: null, entrega: null, diasEntrega: null, equipeHoje: 0 })],
  contagem: { critico: 1, atencao: 0, ok: 1 }, equipeHoje: 4, custoAte: "2026-09",
};
const nomes = () => [...container.querySelectorAll(".gav-obra__nome")].map(b => b.textContent);
const placar = rotulo => [...container.querySelectorAll(".gav-placar__item")].find(b => b.textContent.includes(rotulo));

beforeEach(async () => {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<GestaoAVistaObras resumo={resumo} hoje="2026-10-30" onAbrirObra={onAbrirObra} />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); onAbrirObra.mockClear(); });

it("mostra situação com texto, custo × avanço e entrega de cada obra", () => {
  expect(nomes()).toEqual(["P1-08", "CA1-06"]);
  expect(container.querySelector(".gav__sub").textContent).toBe("30/10/2026 · 4 pessoa(s) em campo · custo até 09/2026");
  const primeira = container.querySelectorAll(".gav-linha:not(.gav-linha--cabecalho)")[0];
  expect(primeira.querySelector(".gav-chip").textContent).toBe("Crítico");
  expect(primeira.querySelector(".gav-custo__barra").getAttribute("aria-label")).toBe("Gasto 58% do orçado, executado 50%");
  expect(primeira.querySelector(".gav-custo__gasto").className).toContain("is-alerta");
  expect(primeira.textContent).toContain("em 16 dia(s)");
  const segunda = container.querySelectorAll(".gav-linha:not(.gav-linha--cabecalho)")[1];
  expect(segunda.textContent).toContain("Sem orçamento aprovado");
  expect(segunda.textContent).toContain("Sem data de entrega");
  expect(segunda.textContent).toContain("Sem cronograma");
});

it("o placar filtra e um segundo clique volta a mostrar todas", async () => {
  await act(async () => placar("Crítico").click());
  expect(placar("Crítico").getAttribute("aria-pressed")).toBe("true");
  expect(nomes()).toEqual(["P1-08"]);
  await act(async () => placar("Atenção").click());
  expect(nomes()).toEqual([]);
  expect(container.textContent).toContain("Nenhuma obra em “Atenção”.");
  await act(async () => placar("Atenção").click());
  expect(nomes()).toEqual(["P1-08", "CA1-06"]);
});

it("abre a obra pelo nome", async () => {
  await act(async () => container.querySelector(".gav-obra__nome").click());
  expect(onAbrirObra).toHaveBeenCalledWith("o1");
});

it("sem acesso à DRE não desenha barra de custo e avisa que a situação ignora o custo", async () => {
  await act(async () => root.render(<GestaoAVistaObras resumo={resumo} hoje="2026-10-30" custoStatus="sem-acesso" />));
  expect(container.querySelector(".gav-custo__barra")).toBeNull();
  expect(container.textContent).toContain("Custo visível só para quem acessa a DRE");
  expect(container.querySelector(".gav__sub").textContent).not.toContain("custo até");
  expect(container.querySelector(".gav__legenda").textContent).toContain("Sem o custo, a situação considera só prazo e ponto.");
});

it("obra sem custo calculado nunca aparece como gasto 0%", async () => {
  const semCusto = { ...resumo, linhas: [linha({ custo: null, gastoPct: null, desvio: null, situacao: "ok" })] };
  await act(async () => root.render(<GestaoAVistaObras resumo={semCusto} hoje="2026-10-30" />));
  expect(container.querySelector(".gav-custo__barra")).toBeNull();
  expect(container.textContent).not.toContain("0%");
  expect(container.textContent).toContain("Custo não calculado (obra sem data de início)");
});
