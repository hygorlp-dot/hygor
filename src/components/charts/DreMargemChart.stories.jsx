import DreMargemChart from "./DreMargemChart.jsx";

const hist = [
  { mes: "Mar", margemBruta: 24.1, margemCaixa: 19.8 },
  { mes: "Abr", margemBruta: 25.4, margemCaixa: 21.2 },
  { mes: "Mai", margemBruta: 23.9, margemCaixa: 18.6 },
  { mes: "Jun", margemBruta: 26.7, margemCaixa: 22.5 },
  { mes: "Jul", margemBruta: 27.2, margemCaixa: 23.1 },
  { mes: "Ago", margemBruta: 28.0, margemCaixa: 24.4 },
];

export default { title: "Gráficos/DreMargemChart", component: DreMargemChart, tags: ["autodocs"], args: { hist } };
export const Default = {};
