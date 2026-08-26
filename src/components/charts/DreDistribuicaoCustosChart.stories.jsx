import DreDistribuicaoCustosChart from "./DreDistribuicaoCustosChart.jsx";

const dre = {
  laborCost: 340000,
  benefitCost: 95000,
  tercCost: 210000,
  rescTotal: 18000,
  outrasTotal: 42000,
};

export default { title: "Gráficos/DreDistribuicaoCustosChart", component: DreDistribuicaoCustosChart, tags: ["autodocs"], args: { dre } };
export const Default = {};
