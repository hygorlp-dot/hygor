// Onda 8 do raio-X (26/08/2026): regressão visual leve para os 7 componentes
// de gráfico extraídos na Onda 4 (item 12). Sem dependência nova (nada de
// Playwright/Chromatic) e sem screenshot de verdade - renderiza cada
// componente de verdade (react-dom/client, mesmo padrão de
// supplier-editor-ui.test.jsx) e tira um snapshot da ESTRUTURA do SVG
// resultante (quantos <path>/<rect>/<line>/<circle>/<text> aparecem).
//
// Por que isso pega regressão de verdade: o achado de 25/08/2026 (ver
// LazyRecharts.jsx) mostrou que envolver um filho do Recharts em
// React.lazy() faz o gráfico renderizar em branco SEM lançar nenhum erro -
// só o <svg>/<Surface> externo aparece, vazio. Se esse bug voltar (ou
// qualquer outra mudança que esvazie o gráfico), a contagem de elementos
// cai para ~0 e o snapshot estrutural muda, mesmo sem nenhum teste de pixel.
// Reutiliza os dados de exemplo dos arquivos .stories.jsx (mesma fonte,
// sem duplicar fixture).
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CubChart from "./CubChart.jsx";
import DreDistribuicaoCustosChart from "./DreDistribuicaoCustosChart.jsx";
import DreEmpresaHistoricoChart from "./DreEmpresaHistoricoChart.jsx";
import DreFaturamentoResultadoChart from "./DreFaturamentoResultadoChart.jsx";
import DreMargemChart from "./DreMargemChart.jsx";
import FinanceiroCharts from "./FinanceiroCharts.jsx";
import RelatoriosChartPanel from "./RelatoriosChartPanel.jsx";
import cubMeta from "./CubChart.stories.jsx";
import dreDistribuicaoMeta from "./DreDistribuicaoCustosChart.stories.jsx";
import dreEmpresaMeta from "./DreEmpresaHistoricoChart.stories.jsx";
import dreFaturamentoMeta from "./DreFaturamentoResultadoChart.stories.jsx";
import dreMargemMeta from "./DreMargemChart.stories.jsx";
import financeiroMeta from "./FinanceiroCharts.stories.jsx";
import relatoriosMeta from "./RelatoriosChartPanel.stories.jsx";

const mounted = [];
function render(ui) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  mounted.push({ container, root });
  return container;
}
afterEach(() => {
  while (mounted.length) {
    const { root, container } = mounted.pop();
    act(() => root.unmount());
    container.remove();
  }
});

// Bar/Line sem isAnimationActive={false} entram animados (padrão do
// Recharts): no primeiro paint o <g class="recharts-bar-rectangle"> existe
// mas está vazio - o <path> real só aparece quando a animação de entrada
// termina. Sem esperar isso, o snapshot registraria "vazio" como estado
// normal, mascarando justamente a classe de regressão que este teste existe
// para pegar (gráfico que renderiza em branco).
const AWAIT_ENTRANCE_ANIMATION_MS = 1600;
async function renderSettled(ui) {
  const container = render(ui);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, AWAIT_ENTRANCE_ANIMATION_MS)); });
  return container;
}

// ResponsiveContainer mede o container via getBoundingClientRect() (síncrono,
// no mount) - jsdom devolve tudo zerado por padrão, o que faz o Recharts
// desistir de desenhar. Um tamanho fixo e realista destrava o desenho real.
// window.matchMedia (usado por useBreakpoint, ex.: no CubChart) também não
// existe em jsdom - mesmo stub já usado em data-table.test.jsx.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300, x: 0, y: 0, toJSON() {},
  });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

// Soma em TODAS as <svg> do container - FinanceiroCharts renderiza dois
// ChartPanel/ResponsiveContainer lado a lado (dois gráficos, dois <svg>
// independentes); somar todos evita subcontar quando há mais de um.
function summarizeChart(container) {
  const svgs = container.querySelectorAll("svg");
  if (!svgs.length) return { hasSvg: false, svgCount: 0 };
  const count = selector => [...svgs].reduce((sum, svg) => sum + svg.querySelectorAll(selector).length, 0);
  return {
    hasSvg: true,
    svgCount: svgs.length,
    paths: count("path"),
    rects: count("rect"),
    lines: count("line"),
    circles: count("circle"),
    texts: count("text"),
  };
}

describe("regressão visual leve (estrutura DOM) das telas de gráfico", () => {
  it("CubChart", async () => {
    const container = await renderSettled(<CubChart {...cubMeta.args} />);
    expect(summarizeChart(container)).toMatchSnapshot();
  });

  it("DreEmpresaHistoricoChart", async () => {
    const container = await renderSettled(<DreEmpresaHistoricoChart {...dreEmpresaMeta.args} />);
    expect(summarizeChart(container)).toMatchSnapshot();
  });

  it("DreDistribuicaoCustosChart", async () => {
    const container = await renderSettled(<DreDistribuicaoCustosChart {...dreDistribuicaoMeta.args} />);
    expect(summarizeChart(container)).toMatchSnapshot();
  });

  it("DreFaturamentoResultadoChart", async () => {
    const container = await renderSettled(<DreFaturamentoResultadoChart {...dreFaturamentoMeta.args} />);
    expect(summarizeChart(container)).toMatchSnapshot();
  });

  it("DreMargemChart", async () => {
    const container = await renderSettled(<DreMargemChart {...dreMargemMeta.args} />);
    expect(summarizeChart(container)).toMatchSnapshot();
  });

  it("FinanceiroCharts", async () => {
    const container = await renderSettled(<FinanceiroCharts {...financeiroMeta.args} />);
    expect(summarizeChart(container)).toMatchSnapshot();
  });

  it("RelatoriosChartPanel (custos)", async () => {
    const container = await renderSettled(<RelatoriosChartPanel {...relatoriosMeta.args} setChartMode={() => {}} highlightObra="" setHighlightObra={() => {}} />);
    expect(summarizeChart(container)).toMatchSnapshot();
  });

  it("RelatoriosChartPanel (ponto)", async () => {
    const container = await renderSettled(<RelatoriosChartPanel {...relatoriosMeta.args} chartMode="ponto" setChartMode={() => {}} highlightObra="" setHighlightObra={() => {}} />);
    expect(summarizeChart(container)).toMatchSnapshot();
  });
});
