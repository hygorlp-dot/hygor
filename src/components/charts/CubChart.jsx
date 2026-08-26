// Extraído de src/LegacyApp.jsx (26/08/2026, Onda 4 do raio-X, item 12)
// para virar seu próprio chunk lazy-carregado. Recharts+d3 só entram no
// bundle quando o Dashboard efetivamente monta este componente - ver o
// `lazy()`/`Suspense` no ponto de uso em LegacyApp.jsx. Import circular
// com LegacyApp.jsx (para C/ChartPanel/ArcdChartTooltip) é seguro pelo
// mesmo motivo de sempre: nada aqui usa essas referências no topo do
// módulo, só dentro do corpo do componente, depois que tudo já resolveu.
import { useState } from "react";
import {
  CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { ArcdChartTooltip, C, ChartPanel } from "../../LegacyApp.jsx";

const CUB_PADRAO_COR={baixo:C.cinza,normal:C.blue,alto:C.yellow,especial:C.yellow};
const CUB_PADRAO_LABEL={baixo:"Padrão baixo",normal:"Padrão normal",alto:"Padrão alto",especial:"Especial"};
const CUB_PADRAO_ORDEM=["baixo","normal","alto","especial"];

// Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): o CUB-PE
// some do Dashboard de forma intermitente - a coleta depende inteiramente
// de um site externo (Sinduscon-PE) sem cache nem retry, e falhas
// silenciosas (`cub===null`) faziam a seção inteira desaparecer sem
// explicação. Um aviso curto substitui o sumiço - só depois que o
// carregamento terminou, para não piscar durante a busca normal.
const CubIndisponivel=()=>(
  <section className="cub-chart" style={{padding:"12px 14px",border:"1px dashed #d5d9db",borderRadius:10,background:"#f8f9f9"}}>
    <p style={{fontSize:11,fontWeight:800,color:"#5e666b"}}>Índice de custo (CUB-PE) indisponível no momento</p>
    <p style={{fontSize:10,color:"#7a8287",marginTop:3}}>A fonte oficial (Sinduscon-PE) não respondeu a tempo. Recarregue a página em alguns minutos.</p>
  </section>
);
export default function CubChart({cub,carregando=false}){
  const {pick}=useBreakpoint();
  const [edificacaoId,setEdificacaoId]=useState(()=>{
    try{return localStorage.getItem("arcd_cub_edificacao")||"";}catch{return "";}
  });
  if(!cub)return carregando?null:<CubIndisponivel/>;
  const projetosBase=cub.projetos||[
    {id:"R1-A",label:"R-1",description:"Residência unifamiliar",group:"Residencial · padrão alto"},
    {id:"R8-N",label:"R-8",description:"Residencial · 8 pavimentos",group:"Residencial · padrão normal"},
  ];
  const temValor=p=>cub.serie.some(s=>Number.isFinite(s.valores?.[p.id]??(p.id==="R1-A"?s.r1a:p.id==="R8-N"?s.r8n:null)));
  // Agrupa os projetos-padrão do Sinduscon-PE por edificação (mesmo `label`),
  // reunindo seus padrões construtivos (baixo/normal/alto) num só cartão —
  // é essa comparação de padrão, não o projeto isolado, que orienta orçamento.
  const edificacoes=[];
  const porLabel=new Map();
  projetosBase.filter(temValor).forEach(p=>{
    const grupo=p.group||"";
    const padrao=grupo.includes("baixo")?"baixo":grupo.includes("normal")?"normal":grupo.includes("alto")?"alto":"especial";
    const categoria=grupo.split("·")[0].trim()||"Outros";
    let ed=porLabel.get(p.label);
    if(!ed){ed={id:p.label,label:p.label,description:p.description,categoria,padroes:{}};porLabel.set(p.label,ed);edificacoes.push(ed);}
    ed.padroes[padrao]=p.id;
  });
  if(!edificacoes.length)return <CubIndisponivel/>;
  const edificacao=edificacoes.find(e=>e.id===edificacaoId)||edificacoes.find(e=>e.id==="R-1")||edificacoes[0];
  const selecionar=id=>{
    setEdificacaoId(id);
    try{localStorage.setItem("arcd_cub_edificacao",id);}catch{}
  };
  const categorias=[...new Set(edificacoes.map(e=>e.categoria))];
  const tiers=CUB_PADRAO_ORDEM.filter(t=>edificacao.padroes[t]);
  const serie=cub.serie.map(s=>{
    const row={mes:s.mes};
    tiers.forEach(t=>{
      const id=edificacao.padroes[t];
      row[t]=s.valores?.[id]??(id==="R1-A"?s.r1a:id==="R8-N"?s.r8n:null);
    });
    return row;
  });
  const ultimo=serie[serie.length-1], penultimo=serie[serie.length-2];
  const destaqueTier=tiers[tiers.length-1];
  const destaqueUltimo=ultimo?.[destaqueTier], destaquePenultimo=penultimo?.[destaqueTier];
  const varMesPct=Number.isFinite(destaqueUltimo)&&Number.isFinite(destaquePenultimo)?((destaqueUltimo-destaquePenultimo)/destaquePenultimo*100):null;
  // Rótulo por ponto só da linha em destaque (pedido do usuário, 25/08/2026):
  // valor em R$/m² e a variação % em relação ao mês anterior - nas outras
  // linhas ficaria poluído (3 linhas × 12 meses = 36 rótulos sobrepostos).
  const CubPontoRotulo=({x,y,value,index})=>{
    if(!Number.isFinite(value))return null;
    const anterior=serie[index-1]?.[destaqueTier];
    const pct=Number.isFinite(anterior)&&anterior>0?((value-anterior)/anterior*100):null;
    return <g>
      <text x={x} y={y-19} textAnchor="middle" fontSize={9} fontWeight={800} fill={C.text}>{`R$ ${Math.round(value).toLocaleString("pt-BR")}`}</text>
      {pct!==null&&<text x={x} y={y-9} textAnchor="middle" fontSize={8} fontWeight={700} fill={pct>=0?C.orange:C.green}>{`${pct>=0?"+":""}${pct.toFixed(1)}%`}</text>}
    </g>;
  };
  const valoresUltimo=tiers.map(t=>({tier:t,valor:ultimo?.[t]})).filter(v=>Number.isFinite(v.valor));
  const maior=valoresUltimo.reduce((a,b)=>!a||b.valor>a.valor?b:a,null);
  const menor=valoresUltimo.reduce((a,b)=>!a||b.valor<a.valor?b:a,null);
  const premiumPct=maior&&menor&&maior.tier!==menor.tier&&menor.valor>0?((maior.valor-menor.valor)/menor.valor*100):null;
  return <section className="cub-chart" style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",gap:6}}>
    <ChartPanel eyebrow="Índice de custo · Pernambuco" title={`CUB-PE · ${edificacao.label} (${edificacao.description})`} height={pick(170,210,230)}
      subtitle={`Comparativo por padrão construtivo · ${cub.regimeLabel||"valor oficial do Sinduscon-PE"}. Competência: ${ultimo?.mes||cub.atual?.mes||"—"}.`}
      legend={tiers.length>1?tiers.map(t=>({label:CUB_PADRAO_LABEL[t],color:CUB_PADRAO_COR[t]})):[]}
      action={<div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"flex-end",flexWrap:"wrap"}}>
        <label style={{display:"flex",flexDirection:"column",gap:3,textAlign:"left"}}>
          <span style={{fontSize:8,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.5}}>Tipo de edificação</span>
          <select aria-label="Tipo de edificação CUB" value={edificacao.id} onChange={e=>selecionar(e.target.value)}
            style={{minWidth:205,height:34,padding:"0 28px 0 9px",border:`1px solid ${C.border}`,borderRadius:6,background:C.card,color:C.text,fontSize:10.5,fontWeight:700,cursor:"pointer"}}>
            {categorias.map(cat=><optgroup key={cat} label={cat}>{edificacoes.filter(e=>e.categoria===cat).map(e=><option key={e.id} value={e.id}>{e.label} · {e.description}</option>)}</optgroup>)}
          </select>
        </label>
        {Number.isFinite(destaqueUltimo)&&<span><b style={{fontSize:17,fontWeight:800,color:C.text}}>R$ {destaqueUltimo.toLocaleString("pt-BR",{minimumFractionDigits:2})}</b><small style={{fontSize:9,color:C.muted}}>/m² · {CUB_PADRAO_LABEL[destaqueTier].toLowerCase()}</small></span>}
        {Number.isFinite(varMesPct)&&<span style={{fontSize:10.5,fontWeight:800,color:varMesPct>=0?C.orange:C.green}}>{varMesPct>=0?"+":""}{varMesPct.toFixed(2)}% no mês</span>}
      </div>}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={serie} margin={{top:26,right:10,left:0,bottom:0}}>
          <CartesianGrid stroke={C.line} strokeDasharray="3 5" vertical={false}/>
          <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} interval={1}/>
          <YAxis axisLine={false} tickLine={false} tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`} domain={["dataMin-60","dataMax+90"]}/>
          <Tooltip content={<ArcdChartTooltip formatter={v=>`R$ ${v.toLocaleString("pt-BR",{minimumFractionDigits:2})}/m²`}/>}/>
          {tiers.map(t=><Line key={t} type="monotone" dataKey={t} name={CUB_PADRAO_LABEL[t]} stroke={CUB_PADRAO_COR[t]} strokeWidth={t===destaqueTier?2.5:2} dot={false} activeDot={{r:5}} connectNulls>
            {t===destaqueTier&&<LabelList dataKey={t} content={CubPontoRotulo}/>}
          </Line>)}
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
    {Number.isFinite(premiumPct)&&<p style={{fontSize:9.5,color:C.text,padding:"0 4px",fontWeight:600}}>{CUB_PADRAO_LABEL[maior.tier]} está <b style={{color:C.yellowD}}>{premiumPct.toFixed(1)}%</b> acima do {CUB_PADRAO_LABEL[menor.tier].toLowerCase()} nesta competência.</p>}
    <p style={{fontSize:8.5,color:C.muted,padding:"0 4px"}}>Fonte oficial: relatório mensal de composição CUB/m² do Sinduscon-PE, com mão de obra e encargos sociais sem desoneração. Referência técnica; não substitui o orçamento da obra.</p>
  </section>;
}
