// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy - ver LazyDreMargemChart no ponto de
// uso em LegacyApp.jsx.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArcdChartTooltip, C, ChartPanel } from "../../LegacyApp.jsx";

export default function DreMargemChart({ hist }) {
  return (
    <ChartPanel eyebrow="Rentabilidade" title="Evolução da margem" subtitle="Margem bruta contratual comparada à margem efetiva de caixa." height={210} legend={[{label:"Margem bruta",color:C.yellow},{label:"Margem de caixa",color:C.text}]}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={hist}>
          <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}}/>
          <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>v.toFixed(0)+"%"}/>
          <Tooltip content={<ArcdChartTooltip formatter={v=>v.toFixed(1)+"%"}/>}/>
          <Line type="monotone" dataKey="margemBruta" name="Margem bruta" stroke={C.yellow} strokeWidth={2.5} dot={{r:3,fill:C.yellow,stroke:C.card,strokeWidth:2}} activeDot={{r:5}} isAnimationActive={false}/>
          <Line type="monotone" dataKey="margemCaixa" name="Margem de caixa" stroke={C.text} strokeWidth={2} dot={{r:3,fill:C.text,stroke:C.card,strokeWidth:2}} strokeDasharray="5 4" isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
