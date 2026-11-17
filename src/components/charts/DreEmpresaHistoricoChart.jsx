// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy - ver LazyDreEmpresaHistoricoChart no
// ponto de uso em LegacyApp.jsx.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArcdChartTooltip, ChartPanel } from "../../legacy/ui.jsx";
import { C } from "../../legacy/palette.js";
import { compactNumber, fmt } from "../../legacy/format.js";

export default function DreEmpresaHistoricoChart({ historico }) {
  return (
    <ChartPanel eyebrow="Resultado empresarial" title="Evolução dos últimos seis meses" subtitle="Faturamento, lucro bruto e lucro líquido no mesmo comparativo." height={220} legend={[{label:"Faturamento",color:"var(--arcd-chart-1)"},{label:"Lucro bruto",color:"var(--arcd-chart-2)"},{label:"Lucro líquido",color:"var(--arcd-chart-3)"}]}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={historico} barSize={16}>
          <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:"var(--arcd-type-caption)"}}/>
          <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:"var(--arcd-type-caption)"}} tickFormatter={compactNumber}/>
          <Tooltip cursor={{fill:`${C.yellow}0A`}} content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/>
          <Bar dataKey="faturamentoTotal" name="Faturamento" className="arcd-serie-1" fill="var(--arcd-chart-1)" radius={[5,5,1,1]} isAnimationActive={false}/>
          <Bar dataKey="lucroBruto" name="Lucro bruto" className="arcd-serie-2" fill="var(--arcd-chart-2)" radius={[5,5,1,1]} isAnimationActive={false}/>
          <Bar dataKey="lucroLiquido" name="Lucro líquido" className="arcd-serie-3" fill="var(--arcd-chart-3)" radius={[5,5,1,1]} isAnimationActive={false}/>
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
