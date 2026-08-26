// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy - ver LazyRelatoriosChartPanel no
// ponto de uso em LegacyApp.jsx.
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArcdChartTooltip, C, ChartPanel, compactNumber, fmt } from "../../LegacyApp.jsx";

export default function RelatoriosChartPanel({ byObra, chartMode, setChartMode, highlightObra, setHighlightObra }) {
  return (
    <ChartPanel eyebrow="Comparativo por obra" title={chartMode==="custos"?"Estrutura de custos":"Presença e disciplina operacional"} subtitle="Selecione uma barra para destacar a obra no detalhamento." height={270} legend={chartMode==="custos"?[{label:"Mão de obra",color:C.yellow},{label:"Total com benefícios",color:C.text}]:[{label:"Presenças",color:C.yellow},{label:"Faltas",color:C.red}]} action={<div style={{display:"flex",gap:3,padding:3,background:C.surface,borderRadius:8}}>{[["custos","Custos"],["ponto","Ponto"]].map(([v,l])=><button key={v} onClick={()=>setChartMode(v)} style={{padding:"6px 9px",border:0,borderRadius:6,background:chartMode===v?C.text:"transparent",color:chartMode===v?"#fff":C.muted,fontSize:9.5,fontWeight:750,cursor:"pointer"}}>{l}</button>)}</div>}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={byObra} barGap={4} barCategoryGap="28%" onClick={s=>s?.activePayload?.[0]?.payload?.id&&setHighlightObra(s.activePayload[0].payload.id)}>
          <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
          <XAxis dataKey="name" stroke={C.cinza} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
          <YAxis stroke={C.cinza} tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} allowDecimals={chartMode==="custos"} tickFormatter={compactNumber}/>
          <Tooltip cursor={{fill:`${C.yellow}0A`}} content={<ArcdChartTooltip formatter={chartMode==="custos"?v=>fmt(v):v=>v}/>} />
          {chartMode==="custos"?<><Bar dataKey="custo" name="Mão de obra" radius={[5,5,1,1]}>{byObra.map(r=><Cell key={r.id} fill={C.yellow} fillOpacity={!highlightObra||highlightObra===r.id?1:.22}/>)}</Bar><Bar dataKey="custoTotal" name="Total com benefícios" radius={[5,5,1,1]}>{byObra.map(r=><Cell key={r.id} fill={C.text} fillOpacity={!highlightObra||highlightObra===r.id?1:.22}/>)}</Bar></>:<><Bar dataKey="presentes" name="Presenças" radius={[5,5,1,1]}>{byObra.map(r=><Cell key={r.id} fill={C.yellow} fillOpacity={!highlightObra||highlightObra===r.id?1:.22}/>)}</Bar><Bar dataKey="faltas" name="Faltas" radius={[5,5,1,1]}>{byObra.map(r=><Cell key={r.id} fill={C.red} fillOpacity={!highlightObra||highlightObra===r.id?1:.22}/>)}</Bar></>}
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
