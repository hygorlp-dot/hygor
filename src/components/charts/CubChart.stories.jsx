import CubChart from "./CubChart.jsx";

const cub = {
  regimeLabel: "com desoneração",
  serie: [
    { mes: "Mar/26", r1a: 2180, r8n: 1940 },
    { mes: "Abr/26", r1a: 2205, r8n: 1962 },
    { mes: "Mai/26", r1a: 2231, r8n: 1988 },
    { mes: "Jun/26", r1a: 2260, r8n: 2010 },
  ],
};

export default { title: "Gráficos/CubChart", component: CubChart, tags: ["autodocs"], args: { cub } };
export const Default = {};
export const Indisponivel = { args: { cub: null } };
