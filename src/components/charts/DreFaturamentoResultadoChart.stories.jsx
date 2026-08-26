import DreFaturamentoResultadoChart from "./DreFaturamentoResultadoChart.jsx";

const hist = [
  { mes: "Mar", faturamento: 820000, recebido: 760000, lucroBruto: 210000 },
  { mes: "Abr", faturamento: 865000, recebido: 810000, lucroBruto: 225000 },
  { mes: "Mai", faturamento: 790000, recebido: 705000, lucroBruto: 198000 },
  { mes: "Jun", faturamento: 910000, recebido: 880000, lucroBruto: 244000 },
  { mes: "Jul", faturamento: 940000, recebido: 902000, lucroBruto: 258000 },
  { mes: "Ago", faturamento: 972000, recebido: 915000, lucroBruto: 271000 },
];

export default { title: "Gráficos/DreFaturamentoResultadoChart", component: DreFaturamentoResultadoChart, tags: ["autodocs"], args: { hist } };
export const Default = {};
