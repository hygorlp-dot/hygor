// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy - ver LazyDreEmpresaHistoricoChart no
// ponto de uso em LegacyApp.jsx.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArcdChartTooltip, C, ChartPanel, compactNumber, fmt } from "../../LegacyApp.jsx";

export default function DreEmpresaHistoricoChart({ historico }) {
  return (
    <ChartPanel eyebrow="Resultado empresarial" title="Evolução dos últimos seis meses" subtitle="Faturamento, lucro bruto e lucro líquido no mesmo comparativo." height={220} legend={[{label:"Faturamento",color:C.yellow},{label:"Lucro bruto",color:C.cinza},{label:"Lucro líquido",color:C.text}]}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={historico} barSize={16}>
          <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}}/>
          <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} tickFormatter={compactNumber}/>
          <Tooltip cursor={{fill:`${C.yellow}0A`}} content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/>
          <Bar dataKey="faturamentoTotal" name="Faturamento" fill={C.yellow} radius={[5,5,1,1]} isAnimationActive={false}/>
          <Bar dataKey="lucroBruto" name="Lucro bruto" fill={C.cinza} radius={[5,5,1,1]} isAnimationActive={false}/>
          <Bar dataKey="lucroLiquido" name="Lucro líquido" fill={C.text} radius={[5,5,1,1]} isAnimationActive={false}/>
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
