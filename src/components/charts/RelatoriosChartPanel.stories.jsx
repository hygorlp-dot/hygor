import { useState } from "react";
import RelatoriosChartPanel from "./RelatoriosChartPanel.jsx";

const byObra = [
  { id: "o1", name: "Residencial Vale Verde", custo: 180000, custoTotal: 240000, presentes: 420, faltas: 12 },
  { id: "o2", name: "Comercial Boa Vista", custo: 145000, custoTotal: 190000, presentes: 300, faltas: 25 },
  { id: "o3", name: "Condomínio Terras Alpha", custo: 260000, custoTotal: 330000, presentes: 510, faltas: 8 },
];

function RelatoriosChartPanelDemo({ chartMode: initialMode, ...rest }) {
  const [chartMode, setChartMode] = useState(initialMode);
  const [highlightObra, setHighlightObra] = useState("");
  return <RelatoriosChartPanel {...rest} chartMode={chartMode} setChartMode={setChartMode} highlightObra={highlightObra} setHighlightObra={setHighlightObra} />;
}

export default { title: "Gráficos/RelatoriosChartPanel", component: RelatoriosChartPanelDemo, tags: ["autodocs"], args: { byObra, chartMode: "custos" } };
export const Custos = {};
export const Ponto = { args: { chartMode: "ponto" } };
