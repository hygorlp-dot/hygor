// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy - ver LazyDreFaturamentoResultadoChart
// no ponto de uso em LegacyApp.jsx.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArcdChartTooltip, C, ChartPanel, compactNumber, fmt } from "../../LegacyApp.jsx";

export default function DreFaturamentoResultadoChart({ hist }) {
  return (
    <ChartPanel eyebrow="Desempenho financeiro" title="Evolução de faturamento e resultado" subtitle="Comparativo móvel dos últimos seis meses." height={220} legend={[{label:"Faturamento",color:C.yellow},{label:"Recebido",color:C.cinza},{label:"Lucro bruto",color:C.text}]}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={hist} barSize={15} barGap={3}>
          <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}}/>
          <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} tickFormatter={compactNumber}/>
          <Tooltip cursor={{fill:`${C.yellow}0A`}} content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/>
          <Bar dataKey="faturamento" name="Faturamento" fill={C.yellow} radius={[5,5,1,1]} isAnimationActive={false}/>
          <Bar dataKey="recebido" name="Recebido" fill={C.cinza} radius={[5,5,1,1]} isAnimationActive={false}/>
          <Bar dataKey="lucroBruto" name="Lucro bruto" fill={C.text} radius={[5,5,1,1]} isAnimationActive={false}/>
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
