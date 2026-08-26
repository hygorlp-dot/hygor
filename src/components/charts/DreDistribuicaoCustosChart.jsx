// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy - ver LazyDreDistribuicaoCustosChart
// no ponto de uso em LegacyApp.jsx.
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArcdChartTooltip, C, ChartPanel, fmt } from "../../LegacyApp.jsx";

export default function DreDistribuicaoCustosChart({ dre }) {
  const dados = [
    {name:"MO Própria",    value:Math.round(dre.laborCost),   fill:C.orange},
    {name:"Benefícios",    value:Math.round(dre.benefitCost), fill:C.muted},
    {name:"Terceiros",     value:Math.round(dre.tercCost),    fill:C.purple},
    {name:"Rescisões",     value:Math.round(dre.rescTotal),   fill:C.red},
    {name:"Outras Desp.",  value:Math.round(dre.outrasTotal), fill:C.yellow},
  ].filter(d=>d.value>0);
  return (
    <ChartPanel eyebrow="Composição" title="Distribuição de custos" subtitle="Participação de cada grupo no custo total do período." height={205}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={dados} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2} isAnimationActive={false}>
            {[C.orange,C.muted,C.purple,C.red,C.yellow].map((c,i)=><Cell key={i} fill={c}/>)}
          </Pie>
          <Tooltip content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/>
        </PieChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
