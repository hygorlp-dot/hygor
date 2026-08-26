import DreEmpresaHistoricoChart from "./DreEmpresaHistoricoChart.jsx";

const historico = [
  { mes: "Mar", faturamentoTotal: 820000, lucroBruto: 210000, lucroLiquido: 98000 },
  { mes: "Abr", faturamentoTotal: 865000, lucroBruto: 225000, lucroLiquido: 104000 },
  { mes: "Mai", faturamentoTotal: 790000, lucroBruto: 198000, lucroLiquido: 87000 },
  { mes: "Jun", faturamentoTotal: 910000, lucroBruto: 244000, lucroLiquido: 118000 },
  { mes: "Jul", faturamentoTotal: 940000, lucroBruto: 258000, lucroLiquido: 126000 },
  { mes: "Ago", faturamentoTotal: 972000, lucroBruto: 271000, lucroLiquido: 133000 },
];

export default { title: "Gráficos/DreEmpresaHistoricoChart", component: DreEmpresaHistoricoChart, tags: ["autodocs"], args: { historico } };
export const Default = {};
