// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy - ver LazyRelatoriosChartPanel no
// ponto de uso em LegacyApp.jsx.
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArcdChartTooltip, ChartPanel } from "../../legacy/ui.jsx";
import { C } from "../../legacy/palette.js";
import { compactNumber, fmt } from "../../legacy/format.js";

const primarySeries = "var(--arcd-chart-1)";
const secondarySeries = "var(--arcd-chart-3)";
const absenceSeries = "var(--arcd-danger-text)";

export default function RelatoriosChartPanel({ byObra, chartMode, setChartMode, highlightObra, setHighlightObra }) {
  return (
    <ChartPanel eyebrow="Comparativo por obra" title={chartMode==="custos"?"Estrutura de custos":"Presença e disciplina operacional"} subtitle="Selecione uma barra para destacar a obra no detalhamento." height={270} legend={chartMode==="custos"?[{label:"Mão de obra",color:primarySeries},{label:"Total com benefícios",color:secondarySeries}]:[{label:"Presenças",color:primarySeries},{label:"Faltas",color:absenceSeries}]} action={<div style={{display:"flex",gap:"var(--arcd-space-half)",padding:"var(--arcd-space-half)",background:"var(--arcd-surface-card)",borderRadius:"var(--arcd-box-radius)"}}>{[["custos","Custos"],["ponto","Ponto"]].map(([v,l])=><button key={v} onClick={()=>setChartMode(v)} style={{padding:"var(--arcd-space-1) var(--arcd-space-2)",border:0,borderRadius:"var(--arcd-radius-control)",background:chartMode===v?"var(--arcd-text-primary)":"transparent",color:chartMode===v?"var(--arcd-text-inverse)":"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-control)",fontWeight:600,cursor:"pointer"}}>{l}</button>)}</div>}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={byObra} barGap={4} barCategoryGap="28%" onClick={s=>s?.activePayload?.[0]?.payload?.id&&setHighlightObra(s.activePayload[0].payload.id)}>
          <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
          <XAxis dataKey="name" stroke={C.cinza} tick={{fill:C.muted,fontSize:"var(--arcd-type-caption)"}} axisLine={false} tickLine={false}/>
          <YAxis stroke={C.cinza} tick={{fill:C.muted,fontSize:"var(--arcd-type-caption)"}} axisLine={false} tickLine={false} allowDecimals={chartMode==="custos"} tickFormatter={compactNumber}/>
          <Tooltip cursor={{fill:`${C.yellow}0A`}} content={<ArcdChartTooltip formatter={chartMode==="custos"?v=>fmt(v):v=>v}/>} />
          {chartMode==="custos"?<><Bar dataKey="custo" name="Mão de obra" fill={primarySeries} radius={[5,5,1,1]}>{byObra.map(r=><Cell key={r.id} fillOpacity={!highlightObra||highlightObra===r.id?1:.22}/>)}</Bar><Bar dataKey="custoTotal" name="Total com benefícios" fill={secondarySeries} radius={[5,5,1,1]}>{byObra.map(r=><Cell key={r.id} fillOpacity={!highlightObra||highlightObra===r.id?1:.22}/>)}</Bar></>:<><Bar dataKey="presentes" name="Presenças" fill={primarySeries} radius={[5,5,1,1]}>{byObra.map(r=><Cell key={r.id} fillOpacity={!highlightObra||highlightObra===r.id?1:.22}/>)}</Bar><Bar dataKey="faltas" name="Faltas" fill={absenceSeries} radius={[5,5,1,1]}>{byObra.map(r=><Cell key={r.id} fillOpacity={!highlightObra||highlightObra===r.id?1:.22}/>)}</Bar></>}
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
