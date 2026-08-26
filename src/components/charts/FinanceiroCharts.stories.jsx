import FinanceiroCharts from "./FinanceiroCharts.jsx";
import { C } from "../../LegacyApp.jsx";

const chartData = [
  { name: "Residencial Vale Verde", Receita: 420000, CustoMO: 180000, Margem: 240000 },
  { name: "Comercial Boa Vista", Receita: 310000, CustoMO: 145000, Margem: 165000 },
  { name: "Condomínio Terras Alpha", Receita: 560000, CustoMO: 260000, Margem: 300000 },
];

const quinzenalChart = [
  { mes: "1ª quinzena Jul", Recebido: 210000, CustoMO: 95000, Terceiros: 60000 },
  { mes: "2ª quinzena Jul", Recebido: 245000, CustoMO: 102000, Terceiros: 71000 },
  { mes: "1ª quinzena Ago", Recebido: 198000, CustoMO: 88000, Terceiros: 54000 },
  { mes: "2ª quinzena Ago", Recebido: 262000, CustoMO: 110000, Terceiros: 78000 },
];

export default { title: "Gráficos/FinanceiroCharts", component: FinanceiroCharts, tags: ["autodocs"], args: { chartData, quinzenalChart, C } };
export const Default = {};
