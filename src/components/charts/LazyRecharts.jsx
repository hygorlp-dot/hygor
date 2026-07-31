import {lazy,Suspense} from "react";

// Um único import() compartilhado mantém Recharts fora do caminho inicial e
// evita iniciar downloads duplicados quando uma tela possui vários gráficos.
const rechartsModule=()=>import("./RechartsRuntime");
const lazyChart=name=>lazy(()=>rechartsModule().then(module=>({default:module[name]})));

const LazyResponsiveContainer=lazyChart("ResponsiveContainer");
export const BarChart=lazyChart("BarChart");
export const LineChart=lazyChart("LineChart");
export const PieChart=lazyChart("PieChart");
export const ComposedChart=lazyChart("ComposedChart");
export const Bar=lazyChart("Bar");
export const Line=lazyChart("Line");
export const Pie=lazyChart("Pie");
export const Cell=lazyChart("Cell");
export const CartesianGrid=lazyChart("CartesianGrid");
export const XAxis=lazyChart("XAxis");
export const YAxis=lazyChart("YAxis");
export const Tooltip=lazyChart("Tooltip");

function ChartLoading({height}){
  return <div className="arcd-chart-loading" style={{width:"100%",height:height||"100%"}} aria-label="Carregando gráfico" aria-busy="true"/>;
}

export function ResponsiveContainer({children,height,...props}){
  return <Suspense fallback={<ChartLoading height={height}/>}>
    <LazyResponsiveContainer height={height} {...props}>{children}</LazyResponsiveContainer>
  </Suspense>;
}
