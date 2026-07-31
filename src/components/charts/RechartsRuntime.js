// Esta fronteira é carregada somente pelo adaptador lazy. Manter os imports
// nomeados permite ao bundler eliminar componentes Recharts que o ARCD não usa.
export {
  Bar,BarChart,CartesianGrid,Cell,ComposedChart,Line,LineChart,Pie,PieChart,
  ResponsiveContainer,Tooltip,XAxis,YAxis,
} from "recharts";
