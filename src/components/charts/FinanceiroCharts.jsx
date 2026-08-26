// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy - ver LazyFinanceiroCharts no ponto
// de uso em LegacyApp.jsx. `C` chega por prop (não importado do módulo)
// porque a tela de origem (Financeiro) aceita um tema próprio
// (C_ARCD_SETOR), não necessariamente o C global.
import { BarChart, Bar, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArcdChartTooltip, ChartPanel, compactNumber, fmt } from "../../LegacyApp.jsx";

export default function FinanceiroCharts({ chartData, quinzenalChart, C }) {
  return (
    <>
      {chartData.length>0 && (
        <ChartPanel eyebrow="Comparativo por obra" title="Receita, custo e margem" subtitle="Leitura simultânea da eficiência financeira de cada contrato." height={245} legend={[{label:"Receita",color:C.yellow},{label:"Custo de mão de obra",color:C.cinza},{label:"Margem",color:C.text}]}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={14}>
                <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}}/>
                <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} tickFormatter={compactNumber}/>
                <Tooltip cursor={{fill:`${C.yellow}0A`}} content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/>
                <Bar dataKey="Receita" fill={C.yellow} radius={[5,5,1,1]}/>
                <Bar dataKey="CustoMO" name="Custo de mão de obra" fill={C.cinza} radius={[5,5,1,1]}/>
                <Bar dataKey="Margem" fill={C.text} radius={[5,5,1,1]}/>
              </BarChart>
            </ResponsiveContainer>
        </ChartPanel>
      )}

      <ChartPanel eyebrow="Cadência financeira" title="Recebimentos e custos por quinzena" subtitle="Série temporal para antecipar pressão sobre o caixa." height={225} legend={[{label:"Recebido",color:C.yellow},{label:"Mão de obra",color:C.text},{label:"Terceiros",color:C.cinza}]}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={quinzenalChart}>
              <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
              <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}}/>
              <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} tickFormatter={compactNumber}/>
              <Tooltip content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/>
              <Line type="monotone" dataKey="Recebido" stroke={C.yellow} strokeWidth={2.5} dot={{r:3,fill:C.yellow,stroke:C.card,strokeWidth:2}} activeDot={{r:5}}/>
              <Line type="monotone" dataKey="CustoMO" name="Mão de obra" stroke={C.text} strokeWidth={2} dot={{r:3,fill:C.text,stroke:C.card,strokeWidth:2}}/>
              <Line type="monotone" dataKey="Terceiros" stroke={C.cinza} strokeWidth={2} dot={{r:3,fill:C.cinza,stroke:C.card,strokeWidth:2}} strokeDasharray="5 4"/>
            </LineChart>
          </ResponsiveContainer>
      </ChartPanel>
    </>
  );
}
