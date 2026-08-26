// ===================================================================
// ConferenciaView — tela de Conferência Técnica (vistoria estruturada),
// extraída de src/LegacyApp.jsx em 2026-08-26 (Onda 7 do raio-X). Mesmo
// padrão já usado para Diário de Obra/Estoque/Licenciamento: mesmo
// corpo, mesma lógica, verbatim. A lógica de escrita já tinha CAS
// completo desde a Onda 5 (conference-commands.js) - esta rodada só
// move a UI para fora do monólito. RankingQualidade e EditorFotoTecnica
// vieram junto (único consumidor de cada um era esta tela);
// criteriosQualidade/SegurancaObra/Qualidade ficaram em LegacyApp.jsx -
// apesar do nome parecido, pertencem à tela de Qualidade (FVS/FVM), não
// a esta.
// ===================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { enviarArquivoOneDrive } from "../../../api";
import {
  Badge, Bloco, Btn, C, Ic, Inp, Modal, PageHero, Sel,
  comprimirImagem, escapeHtml, fmtDate, obraContextoSalvo, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";

// ==============================================================
//  CONFERENCIA TECNICA
//  Vistoria estruturada: cada achado nasce ligado ao orcamento, recebe
//  responsavel, correcao, prazo, impacto, evidencias e ciclo de resolucao.
// ==============================================================
const CONFERENCIA_CATEGORIAS = [
  {v:"patologia",l:"Patologia"},{v:"inconformidade",l:"Inconformidade"},{v:"pendencia",l:"Pendência"},
];
const CONFERENCIA_IMPACTOS = [
  {v:"baixo",l:"Baixo",c:C.green},{v:"medio",l:"Médio",c:C.orange},
  {v:"alto",l:"Alto",c:C.red},{v:"critico",l:"Crítico",c:"#8B1E1E"},
];
const CONFERENCIA_STATUS = [
  {v:"aberta",l:"Aberta"},{v:"em_ajuste",l:"Correção solicitada"},
  {v:"aguardando_validacao",l:"Aguardando validação"},{v:"resolvida",l:"Conforme"},
];

// Ranking de qualidade calculado em tempo real. Nao persiste uma nota no blob:
// ela sempre nasce novamente das vistorias, prazos e validacoes existentes, o
// que evita indicadores desatualizados depois que uma correcao e aprovada.
const QUALIDADE_PESO_IMPACTO={baixo:1,medio:3,alto:6,critico:10};
const qualidadeDataValida=v=>{const d=v?new Date(v):null;return d&&!Number.isNaN(d.getTime())?d:null;};
const qualidadeDias=(inicio,fim=new Date())=>{const a=qualidadeDataValida(inicio),b=qualidadeDataValida(fim);return a&&b?Math.max(0,Math.floor((b-a)/86400000)):0;};
const qualidadeAssinatura=p=>{
  const ignorar=new Set(["para","com","sem","uma","de","da","do","das","dos","que","foi","esta","este","obra","local"]);
  const termos=String(p.descricao||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(x=>x.length>2&&!ignorar.has(x)).slice(0,5);
  return `${p.etapaId||"sem-etapa"}|${p.categoria||"pendencia"}|${termos.join("-")||"sem-descricao"}`;
};

function calcularRankingQualidade(data,conferencias,periodoDias=90){
  const agora=new Date(),hoje=new Date(agora);hoje.setHours(23,59,59,999);
  const limite=periodoDias?new Date(hoje.getTime()-periodoDias*86400000):null;
  const confs=(conferencias||[]).filter(c=>{const d=qualidadeDataValida(c.data||c.criadoEm);return !limite||!d||d>=limite;});
  const ocorrencias=[];
  confs.forEach(c=>(c.pendencias||[]).forEach(p=>{
    const inicio=p.criadoEm||c.data||c.criadoEm;
    const fim=p.resolvidoEm||agora;
    const aberta=p.status!=="resolvida";
    const prazo=qualidadeDataValida(p.prazo);
    const prazoLimite=prazo?new Date(prazo):null;if(prazoLimite)prazoLimite.setHours(23,59,59,999);
    const encerramento=qualidadeDataValida(p.resolvidoEm);
    const validacoes=p.validacoes||[];
    ocorrencias.push({
      ...p,conferenciaId:c.id,obraId:c.obraId,vistoriaData:c.data||c.criadoEm,
      engenheiroId:p.responsavelAjusteId||"nao-definido",
      engenheiroNome:p.responsavelAjusteNome||"Responsável não definido",
      aberta,atrasada:!!prazoLimite&&(aberta?prazoLimite<agora:!!encerramento&&encerramento>prazoLimite),
      critica:p.impacto==="critico",diasAberta:qualidadeDias(inicio,fim),
      peso:(QUALIDADE_PESO_IMPACTO[p.impacto]||3)*(p.categoria==="patologia"?1.2:p.categoria==="inconformidade"?1.1:1),
      rejeitada:validacoes.some(v=>v.resultado==="nao_conforme"),
      aprovadaPrimeira:validacoes.some(v=>v.resultado==="conforme")&&!validacoes.some(v=>v.resultado==="nao_conforme"),
      assinatura:qualidadeAssinatura(p),
    });
  }));
  const repeticoes=new Map();
  ocorrencias.forEach(o=>{const k=`${o.obraId}|${o.assinatura}`;repeticoes.set(k,(repeticoes.get(k)||0)+1);});
  ocorrencias.forEach(o=>{o.reincidente=(repeticoes.get(`${o.obraId}|${o.assinatura}`)||0)>1;});

  const consolidar=(id,nome,itens,extra={})=>{
    const total=itens.length,abertas=itens.filter(x=>x.aberta),resolvidas=itens.filter(x=>!x.aberta);
    const atrasadas=itens.filter(x=>x.atrasada),criticas=abertas.filter(x=>x.critica),reincidentes=itens.filter(x=>x.reincidente);
    const comPrazoResolvidas=resolvidas.filter(x=>x.prazo);
    const pontuais=comPrazoResolvidas.filter(x=>!x.atrasada).length;
    const validadas=itens.filter(x=>(x.validacoes||[]).length);
    const primeira=validadas.filter(x=>x.aprovadaPrimeira).length;
    const mediaIdade=abertas.length?abertas.reduce((s,x)=>s+x.diasAberta,0)/abertas.length:0;
    const mediaResolucao=resolvidas.length?resolvidas.reduce((s,x)=>s+x.diasAberta,0)/resolvidas.length:0;
    const proporcao=n=>total?n/total:0;
    // Maior indice = maior necessidade de intervencao. Volume tem apenas 10%
    // para manter a comparacao justa entre obras e equipes de portes distintos.
    const atencao=Math.round(100*(
      .25*proporcao(criticas.length)+.20*proporcao(atrasadas.length)+.15*proporcao(abertas.length)+
      .15*proporcao(reincidentes.length)+.15*Math.min(mediaIdade/45,1)+.10*Math.min(total/10,1)
    ));
    const resolucao=total?resolvidas.length/total:1;
    const pontualidade=comPrazoResolvidas.length?pontuais/comPrazoResolvidas.length:(resolvidas.length?1:total?0:1);
    const primeiraTentativa=validadas.length?primeira/validadas.length:(resolvidas.length?1:total?0:1);
    const velocidade=resolvidas.length?Math.max(0,1-mediaResolucao/45):(total?0:1);
    const eficiencia=Math.round(100*(.35*resolucao+.25*pontualidade+.25*primeiraTentativa+.15*velocidade));
    return {id,nome,...extra,total,abertas:abertas.length,resolvidas:resolvidas.length,atrasadas:atrasadas.length,
      criticas:criticas.length,reincidentes:reincidentes.length,mediaIdade:Math.round(mediaIdade),mediaResolucao:Math.round(mediaResolucao),
      pontosSeveridade:Math.round(itens.reduce((s,x)=>s+x.peso,0)*10)/10,atencao,qualidade:100-atencao,eficiencia};
  };

  const obrasIds=new Set(confs.map(c=>c.obraId));
  const obras=(data.obras||[]).filter(o=>obrasIds.has(o.id)).map(o=>consolidar(o.id,o.name||"Obra",ocorrencias.filter(x=>x.obraId===o.id),{codigo:o.code||o.codigo||""}));
  const engenheirosAtivos=(data.usuarios||[]).filter(u=>u.active!==false&&u.role==="engenheiro");
  const engenheirosIds=new Set([...engenheirosAtivos.map(u=>u.id),...ocorrencias.map(x=>x.engenheiroId)]);
  const engenheiros=[...engenheirosIds].map(id=>{const u=engenheirosAtivos.find(x=>x.id===id),itens=ocorrencias.filter(x=>x.engenheiroId===id);return consolidar(id,u?.nome||itens[0]?.engenheiroNome||"Responsável não definido",itens);});
  const ordenar=(a,b)=>b.atencao-a.atencao||b.atrasadas-a.atrasadas||b.pontosSeveridade-a.pontosSeveridade||a.nome.localeCompare(b.nome);
  return {obras:obras.sort(ordenar),engenheiros:engenheiros.sort(ordenar),resumo:{vistorias:confs.length,achados:ocorrencias.length,abertos:ocorrencias.filter(x=>x.aberta).length,criticos:ocorrencias.filter(x=>x.aberta&&x.critica).length,atrasados:ocorrencias.filter(x=>x.atrasada).length,reincidentes:ocorrencias.filter(x=>x.reincidente).length}};
}

function RankingQualidade({data,conferencias,obraIdFixo="",onSelecionarObra}){
  const [visao,setVisao]=useState("obras");
  const [periodo,setPeriodo]=useState("90");
  const ranking=useMemo(()=>calcularRankingQualidade(data,(conferencias||[]).filter(c=>!obraIdFixo||c.obraId===obraIdFixo),Number(periodo)||0),[data.obras,data.usuarios,conferencias,obraIdFixo,periodo]);
  const linhas=ranking[visao];
  const corRisco=v=>v>=60?C.red:v>=35?C.orange:C.green;
  return <section style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",boxShadow:C.shHair}}>
    <div style={{padding:"10px 12px",display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap",borderBottom:`1px solid ${C.line}`,background:C.surface}}>
      <div><p style={{fontSize:11.5,fontWeight:850,color:C.text}}>Ranking automático da qualidade</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Prioriza quem exige atenção primeiro, sem misturar risco atual com eficiência de correção.</p></div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        <div style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>{[["obras","Por obra"],["engenheiros","Por engenheiro"]].map(([v,l])=><button key={v} onClick={()=>setVisao(v)} style={{border:0,borderRight:v==="obras"?`1px solid ${C.border}`:0,background:visao===v?C.blue:"transparent",color:visao===v?"white":C.muted,padding:"5px 8px",fontSize:9,fontWeight:800,cursor:"pointer"}}>{l}</button>)}</div>
        <select value={periodo} onChange={e=>setPeriodo(e.target.value)} aria-label="Período do ranking" style={{border:`1px solid ${C.border}`,background:C.bg,borderRadius:7,padding:"4px 7px",fontSize:9.5,color:C.text}}><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">12 meses</option><option value="0">Todo o histórico</option></select>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:1,background:C.line,borderBottom:`1px solid ${C.line}`}}>{[["Vistorias",ranking.resumo.vistorias,C.blue],["Achados",ranking.resumo.achados,C.text],["Em aberto",ranking.resumo.abertos,C.orange],["Críticos",ranking.resumo.criticos,C.red],["Atrasados",ranking.resumo.atrasados,C.red],["Reincidentes",ranking.resumo.reincidentes,C.purple]].map(([l,v,c])=><div key={l} style={{padding:"7px 9px",background:C.bg}}><p style={{fontSize:7.5,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.45}}>{l}</p><p style={{fontSize:15,fontWeight:850,color:c,marginTop:2}}>{v}</p></div>)}</div>
    <div className="scroll-x"><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr>{["#",visao==="obras"?"Obra":"Engenheiro de campo","Qualidade","Atenção","Achados","Abertos","Atrasados","Críticos","Reincid.","Eficiência"].map(h=><th key={h} style={{padding:"7px 8px",textAlign:h==="#"||h=== (visao==="obras"?"Obra":"Engenheiro de campo")?"left":"right",borderBottom:`1px solid ${C.line}`}}>{h}</th>)}</tr></thead><tbody>{linhas.map((r,i)=><tr key={r.id} onClick={()=>visao==="obras"&&onSelecionarObra?.(r.id)} style={{cursor:visao==="obras"?"pointer":"default",background:i===0&&r.atencao?`${corRisco(r.atencao)}06`:C.bg}}><td style={{padding:"7px 8px",fontWeight:850,color:C.muted,borderBottom:`1px solid ${C.line}`}}>{i+1}</td><td style={{padding:"7px 8px",borderBottom:`1px solid ${C.line}`}}><p style={{fontSize:10.5,fontWeight:800,color:C.text}}>{r.nome}</p>{r.codigo&&<p style={{fontSize:8.5,color:C.muted,marginTop:1}}>{r.codigo}</p>}</td><td style={{padding:"7px 8px",textAlign:"right",fontWeight:850,color:corRisco(r.atencao),borderBottom:`1px solid ${C.line}`}}>{r.qualidade}/100</td><td style={{padding:"7px 8px",textAlign:"right",borderBottom:`1px solid ${C.line}`}}><Badge color={corRisco(r.atencao)}>{r.atencao}</Badge></td>{[r.total,r.abertas,r.atrasadas,r.criticas,r.reincidentes].map((v,j)=><td key={j} style={{padding:"7px 8px",textAlign:"right",fontWeight:v?750:500,color:v&&(j===2||j===3)?C.red:C.text,borderBottom:`1px solid ${C.line}`}}>{v}</td>)}<td style={{padding:"7px 8px",textAlign:"right",fontWeight:800,color:r.eficiencia>=80?C.green:r.eficiencia>=60?C.orange:C.red,borderBottom:`1px solid ${C.line}`}}>{r.eficiencia}%</td></tr>)}</tbody></table></div>
    {!linhas.length&&<div style={{padding:18,textAlign:"center",fontSize:10.5,color:C.muted}}>Ainda não há vistorias no período selecionado.</div>}
    <details style={{padding:"8px 11px",fontSize:9.5,color:C.muted}}><summary style={{cursor:"pointer",fontWeight:800,color:C.blue}}>Como o ranking é calculado</summary><div style={{marginTop:7,lineHeight:1.55}}>O <strong>índice de atenção</strong> (maior é pior) pondera críticos 25%, atrasos 20%, abertos 15%, reincidência 15%, idade 15% e volume 10%. A nota de qualidade é 100 menos esse índice. A <strong>eficiência</strong> considera resolução 35%, prazo 25%, aprovação na primeira tentativa 25% e velocidade 15%. Reincidência significa o mesmo tipo de achado, na mesma etapa e com descrição equivalente, repetido em mais de uma vistoria.</div></details>
  </section>;
}

const imagemTecnicaComoDataUrl=async url=>{
  if(String(url||"").startsWith("data:image/"))return url;
  const resposta=await fetch(url,{credentials:"include"});
  if(!resposta.ok)throw new Error("Não foi possível carregar a imagem para anotação.");
  const blob=await resposta.blob();
  return await new Promise((resolve,reject)=>{const leitor=new FileReader();leitor.onload=()=>resolve(leitor.result);leitor.onerror=reject;leitor.readAsDataURL(blob);});
};

// Editor vetorial leve sobre canvas. As marcacoes so sao incorporadas ao JPEG
// ao salvar; a foto de origem continua registrada como evidencia separada.
function EditorFotoTecnica({src,legendaInicial="",podeAnotar=true,titulo="Evidência técnica",acaoSalvar="Salvar cópia anotada",onClose,onSave}){
  const canvasRef=useRef(null),imagemRef=useRef(null),rascunhoRef=useRef(null);
  const [dimensao,setDimensao]=useState({w:1280,h:1280});
  const [ferramenta,setFerramenta]=useState("seta");
  const [cor,setCor]=useState("#E53935");
  const [espessura,setEspessura]=useState(6);
  const [acoes,setAcoes]=useState([]);
  const [rascunho,setRascunho]=useState(null);
  const [zoom,setZoom]=useState(1);
  const [legenda,setLegenda]=useState(legendaInicial||"");
  const [erro,setErro]=useState("");
  const [salvando,setSalvando]=useState(false);
  const definirRascunho=v=>{rascunhoRef.current=v;setRascunho(v);};

  useEffect(()=>{setErro("");const img=new Image();img.onload=()=>{const escala=Math.min(1,1600/Math.max(img.naturalWidth||1,img.naturalHeight||1));imagemRef.current=img;setDimensao({w:Math.max(1,Math.round(img.naturalWidth*escala)),h:Math.max(1,Math.round(img.naturalHeight*escala))});};img.onerror=()=>setErro("A imagem não pôde ser aberta.");img.src=src;},[src]);

  const desenharAcao=useCallback((ctx,a)=>{
    if(!a)return;ctx.save();ctx.strokeStyle=a.cor;ctx.fillStyle=a.cor;ctx.lineWidth=a.espessura;ctx.lineCap="round";ctx.lineJoin="round";
    if(a.tipo==="lapis"&&a.pontos?.length){ctx.beginPath();ctx.moveTo(a.pontos[0].x,a.pontos[0].y);a.pontos.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();}
    if(a.tipo==="seta"&&a.inicio&&a.fim){const ang=Math.atan2(a.fim.y-a.inicio.y,a.fim.x-a.inicio.x),cabeca=Math.max(14,a.espessura*3);ctx.beginPath();ctx.moveTo(a.inicio.x,a.inicio.y);ctx.lineTo(a.fim.x,a.fim.y);ctx.stroke();ctx.beginPath();ctx.moveTo(a.fim.x,a.fim.y);ctx.lineTo(a.fim.x-cabeca*Math.cos(ang-Math.PI/6),a.fim.y-cabeca*Math.sin(ang-Math.PI/6));ctx.lineTo(a.fim.x-cabeca*Math.cos(ang+Math.PI/6),a.fim.y-cabeca*Math.sin(ang+Math.PI/6));ctx.closePath();ctx.fill();}
    if(a.tipo==="circulo"&&a.inicio&&a.fim){ctx.beginPath();ctx.ellipse((a.inicio.x+a.fim.x)/2,(a.inicio.y+a.fim.y)/2,Math.max(1,Math.abs(a.fim.x-a.inicio.x)/2),Math.max(1,Math.abs(a.fim.y-a.inicio.y)/2),0,0,Math.PI*2);ctx.stroke();}
    if(a.tipo==="texto"&&a.texto){const tamanho=Math.max(24,a.espessura*5);ctx.font=`800 ${tamanho}px Inter, sans-serif`;ctx.lineWidth=Math.max(3,a.espessura/2);ctx.strokeStyle=a.cor==="#FFFFFF"?"#121212":"#FFFFFF";ctx.strokeText(a.texto,a.inicio.x,a.inicio.y);ctx.fillStyle=a.cor;ctx.fillText(a.texto,a.inicio.x,a.inicio.y);}
    ctx.restore();
  },[]);

  const redesenhar=useCallback(()=>{const canvas=canvasRef.current,img=imagemRef.current;if(!canvas||!img)return;canvas.width=dimensao.w;canvas.height=dimensao.h;const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);acoes.forEach(a=>desenharAcao(ctx,a));desenharAcao(ctx,rascunho);},[acoes,rascunho,dimensao,desenharAcao]);
  useEffect(redesenhar,[redesenhar]);
  const ponto=e=>{const r=canvasRef.current.getBoundingClientRect();return{x:(e.clientX-r.left)*dimensao.w/r.width,y:(e.clientY-r.top)*dimensao.h/r.height};};
  const iniciar=e=>{if(!podeAnotar||erro)return;const p=ponto(e);if(ferramenta==="texto"){const texto=window.prompt("Texto da anotação:");if(texto?.trim())setAcoes(a=>[...a,{tipo:"texto",inicio:p,texto:texto.trim().slice(0,80),cor,espessura}]);return;}e.currentTarget.setPointerCapture?.(e.pointerId);definirRascunho(ferramenta==="lapis"?{tipo:"lapis",pontos:[p],cor,espessura}:{tipo:ferramenta,inicio:p,fim:p,cor,espessura});};
  const mover=e=>{const atual=rascunhoRef.current;if(!atual)return;const p=ponto(e);definirRascunho(atual.tipo==="lapis"?{...atual,pontos:[...atual.pontos,p]}:{...atual,fim:p});};
  const finalizar=()=>{const atual=rascunhoRef.current;if(!atual)return;setAcoes(a=>[...a,atual]);definirRascunho(null);};
  const salvar=async()=>{if(!canvasRef.current||erro)return;setSalvando(true);try{const dataUrl=canvasRef.current.toDataURL("image/jpeg",.86);await onSave?.({dataUrl,legenda:legenda.trim()||legendaInicial||"Evidência técnica anotada",temAnotacoes:acoes.length>0});}catch(e){setErro(e.message||"Não foi possível salvar a anotação.");}finally{setSalvando(false);}};
  const larguraBase=Math.min(dimensao.w,900);

  return <div style={{position:"fixed",inset:0,zIndex:10020,background:"rgba(10,12,14,.84)",backdropFilter:"blur(7px)",display:"grid",placeItems:"center",padding:12}} onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.();}}>
    <div style={{width:"min(1180px,98vw)",height:"min(900px,96vh)",background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:"0 30px 90px rgba(0,0,0,.34)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <header style={{padding:"9px 11px",borderBottom:`1px solid ${C.line}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,background:C.surface}}><div><p style={{fontSize:11.5,fontWeight:850,color:C.text}}>{titulo}</p><p style={{fontSize:8.5,color:C.muted,marginTop:1}}>{podeAnotar?"Amplie, marque o ponto exato e salve uma cópia auditável.":"Visualização ampliada da evidência."}</p></div><button onClick={onClose} title="Fechar" style={{width:28,height:28,border:`1px solid ${C.border}`,borderRadius:7,background:C.bg,cursor:"pointer"}}><Ic n="x" s={13}/></button></header>
      <div style={{padding:"7px 10px",borderBottom:`1px solid ${C.line}`,display:"flex",justifyContent:"space-between",gap:7,flexWrap:"wrap",background:C.bg}}>
        {podeAnotar?<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{[["lapis","Desenho"],["seta","Seta"],["circulo","Círculo"],["texto","Texto"]].map(([v,l])=><button key={v} onClick={()=>setFerramenta(v)} style={{padding:"5px 8px",border:`1px solid ${ferramenta===v?C.blue:C.border}`,borderRadius:6,background:ferramenta===v?`${C.blue}10`:C.surface,color:ferramenta===v?C.blue:C.muted,fontSize:9,fontWeight:800,cursor:"pointer"}}>{l}</button>)}<span style={{width:1,background:C.line,margin:"1px 3px"}}/>{["#E53935",C.yellow,"#1261A0","#FFFFFF","#121212"].map(c=><button key={c} onClick={()=>setCor(c)} aria-label={`Cor ${c}`} style={{width:25,height:25,borderRadius:99,border:`2px solid ${cor===c?C.blue:C.border}`,background:c,cursor:"pointer"}}/>)}<select value={espessura} onChange={e=>setEspessura(Number(e.target.value))} aria-label="Espessura" style={{border:`1px solid ${C.border}`,borderRadius:6,background:C.surface,fontSize:9,padding:"3px 5px"}}><option value="3">Fino</option><option value="6">Médio</option><option value="10">Grosso</option></select><button onClick={()=>setAcoes(a=>a.slice(0,-1))} disabled={!acoes.length} style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:6,background:C.surface,color:C.text,fontSize:9,fontWeight:800,cursor:acoes.length?"pointer":"default",opacity:acoes.length?1:.45}}>Desfazer</button><button onClick={()=>setAcoes([])} disabled={!acoes.length} style={{padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:6,background:C.surface,color:C.red,fontSize:9,fontWeight:800,cursor:acoes.length?"pointer":"default",opacity:acoes.length?1:.45}}>Limpar</button></div>:<span/>}
        <div style={{display:"flex",gap:4,alignItems:"center"}}><span style={{fontSize:8.5,color:C.muted}}>Zoom</span>{[[.75,"−"],[1,"Ajustar"],[1.5,"+"],[2,"2×"]].map(([v,l])=><button key={v} onClick={()=>setZoom(v)} style={{padding:"4px 7px",border:`1px solid ${zoom===v?C.blue:C.border}`,borderRadius:6,background:zoom===v?`${C.blue}10`:C.surface,color:zoom===v?C.blue:C.muted,fontSize:9,fontWeight:800,cursor:"pointer"}}>{l}</button>)}</div>
      </div>
      <div style={{flex:1,overflow:"auto",background:"#22272B",display:"flex",alignItems:"flex-start",justifyContent:zoom<=1?"center":"flex-start",padding:10}}>{erro?<div style={{margin:"auto",color:"white",fontSize:11}}>{erro}</div>:<canvas ref={canvasRef} onPointerDown={iniciar} onPointerMove={mover} onPointerUp={finalizar} onPointerCancel={finalizar} style={{display:"block",width:zoom===1?"min(100%, 900px)":`${Math.round(larguraBase*zoom)}px`,maxWidth:zoom===1?"100%":"none",height:"auto",touchAction:podeAnotar?"none":"pan-x pan-y",cursor:podeAnotar?(ferramenta==="texto"?"text":"crosshair"):"zoom-in",boxShadow:"0 8px 30px rgba(0,0,0,.28)"}}/>}</div>
      <footer style={{padding:"8px 10px",borderTop:`1px solid ${C.line}`,display:"flex",gap:8,alignItems:"flex-end",background:C.surface,flexWrap:"wrap"}}><div style={{flex:1,minWidth:220}}><Inp label="Legenda da evidência" value={legenda} onChange={setLegenda} disabled={!podeAnotar} placeholder="Ex.: fissura destacada junto ao vão da janela"/></div><Btn v="ghost" onClick={onClose}>Fechar</Btn>{podeAnotar&&<Btn onClick={salvar} disabled={salvando||!!erro}><Ic n="edit"/>{salvando?"Salvando...":acaoSalvar}</Btn>}</footer>
    </div>
  </div>;
}

export default function Conferencia({ data, showToast, currentUser, obraIdFixo="", dispatchCommand=null }) {
  const { cols, isDesktop } = useBreakpoint();
  const obras=useMemo(()=>(data.obras||[]).filter(o=>o.status!=="done"),[data.obras]);
  const [obraFiltro,setObraFiltro]=useState(()=>obraIdFixo||(obras.some(o=>o.id===obraContextoSalvo())?obraContextoSalvo():(obras[0]?.id||"")));
  const [statusFiltro,setStatusFiltro]=useState("abertas");
  const [selecionadaId,setSelecionadaId]=useState("");
  const [pendenciaForm,setPendenciaForm]=useState(null);
  const [validacaoForm,setValidacaoForm]=useState(null);
  const [novaForm,setNovaForm]=useState(null);
  const [subindoAjusteId,setSubindoAjusteId]=useState("");
  const [fotoTecnica,setFotoTecnica]=useState(null);
  const [findingFilters,setFindingFilters]=useState({query:"",status:"todas",impact:"todos",ownerId:"todos",onlyOverdue:false});
  const [completionModal,setCompletionModal]=useState(false);
  const [completionForm,setCompletionForm]=useState({scopeReviewed:false,notes:""});
  const [cancelModal,setCancelModal]=useState(null);
  const [cancelReason,setCancelReason]=useState("");
  const [metadataEditing,setMetadataEditing]=useState(false);
  const [metadataDraft,setMetadataDraft]=useState(null);
  const [lastSaved,setLastSaved]=useState("");
  const conferencia=useMemo(()=>(data.conferencias||[]).find(c=>c.id===selecionadaId),[data.conferencias,selecionadaId]);
  const obraIdAtual=conferencia?.obraId||obraFiltro;
  const obraAtual=useMemo(()=>(data.obras||[]).find(o=>o.id===obraIdAtual),[data.obras,obraIdAtual]);
  const orc=useMemo(()=>orcamentoDaObra(data,obraIdAtual),[data.orcamentos,data.budgetBaselines,obraIdAtual]);
  const etapas=orc?.etapas||[];
  const etapasNivel1=useMemo(()=>etapas.filter(e=>!e.parentId),[etapas]);
  // Map etapaId -> nome, montado uma vez por conjunto de etapas. Antes
  // nomeEtapa(id) fazia etapas.find() a cada chamada, 2x por linha de
  // pendencia renderizada.
  const nomePorEtapa=useMemo(()=>new Map(etapas.map(e=>[e.id,e.nome])),[etapas]);
  const nomeEtapa=id=>nomePorEtapa.get(id)||"Sem etapa";
  const etapaNivel1Id=id=>{let atual=etapas.find(e=>e.id===id);const visitados=new Set();while(atual?.parentId&&!visitados.has(atual.id)){visitados.add(atual.id);atual=etapas.find(e=>e.id===atual.parentId);}return atual?.id||"";};
  const impactoMeta=v=>CONFERENCIA_IMPACTOS.find(x=>x.v===v)||CONFERENCIA_IMPACTOS[1];

  const engenheiros=useMemo(()=>(data.usuarios||[]).filter(u=>u.active!==false&&u.role==="engenheiro"),[data.usuarios]);
  const auditores=useMemo(()=>(data.usuarios||[]).filter(u=>u.active!==false&&u.role==="engenheiro_auditor"),[data.usuarios]);
  const vistoriadores=useMemo(()=>(data.usuarios||[]).filter(u=>u.active!==false&&["admin","engenheiro_auditor"].includes(u.role)),[data.usuarios]);
  const responsaveis=useMemo(()=>engenheiros.map(u=>({id:u.id,nome:u.nome,tipo:"Engenheiro de campo"})),[engenheiros]);
  const ehAdmin=currentUser?.role==="admin";
  const ehEngenheiro=currentUser?.role==="engenheiro"&&currentUser?.active!==false;
  const ehAuditor=currentUser?.role==="engenheiro_auditor"&&currentUser?.active!==false;
  const obrasNoEscopo=obras.filter(o=>!currentUser?.obraId||currentUser.obraId===o.id);
  const obrasCriaveis=ehAdmin?obras:ehAuditor?obrasNoEscopo:[];
  const podeCriarConferencia=(ehAdmin||ehAuditor)&&obrasCriaveis.length>0;
  const nomeNormalizado=valor=>String(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  // Conferências antigas podem guardar um responsávelId anterior à recriação
  // do usuário. Bloquear toda a prancheta por igualdade estrita deixava o
  // auditor autenticado em modo somente leitura no celular. Auditores ativos
  // podem operar as vistorias do próprio escopo; a autoria continua registrada.
  // Se a conferência chegou à lista visível do auditor, ela é operável. O
  // filtro da listagem já protege o escopo; repetir a trava aqui criava telas
  // visíveis porém inutilizáveis quando a lotação do usuário era atualizada.
  const auditorNoEscopo=ehAuditor;
  const ehVistoriador=auditorNoEscopo&&(
    !conferencia?.responsavelId||
    currentUser?.id===conferencia.responsavelId||
    nomeNormalizado(currentUser?.nome)===nomeNormalizado(conferencia?.responsavel)
  );
  const podeGerirVistoria=ehAdmin||auditorNoEscopo;
  const ehResponsavelAjuste=p=>ehEngenheiro&&!!currentUser?.id&&currentUser.id===p?.responsavelAjusteId;
  const obraDaConferencia=obraAtual;
  const responsavelAutomatico=useMemo(()=>vistoriadores.find(u=>u.id===conferencia?.responsavelId)||(ehAuditor?currentUser:null),[vistoriadores,conferencia?.responsavelId,ehAuditor,currentUser]);

  const dispatch=async(factory,fallbackMsg)=>{
    if(!dispatchCommand){showToast?.("Esta operação exige conexão com o servidor.","error");return null;}
    const result=await dispatchCommand(factory);
    if(!result?.ok){showToast?.(result?.reason||fallbackMsg,"error");return null;}
    setLastSaved(new Date().toISOString());
    return result;
  };
  const vigenteConferencia=atual=>(atual.conferencias||[]).find(c=>c.id===conferencia?.id);

  const abrirNovaConferencia=()=>{
    if(!podeCriarConferencia){showToast?.(ehAdmin||ehAuditor?"Nenhuma obra ativa está disponível no seu escopo.":"Somente o administrador ou o engenheiro auditor pode criar uma vistoria.","error");return;}
    const candidatas=obrasCriaveis;
    const obraPreferida=candidatas.find(o=>o.id===(obraIdFixo||obraFiltro))||candidatas[0];
    const obraId=obraPreferida?.id||"";
    setNovaForm({obraId,data:today(),responsavelId:ehAdmin?(auditores[0]?.id||currentUser?.id||""):(currentUser?.id||"")});
  };
  const novaConferencia=async()=>{
    const obraId=novaForm?.obraId;
    if(!obraId){showToast?.("Cadastre uma obra antes de criar a conferência.","error");return;}
    if(!ehAdmin&&!ehAuditor){showToast?.("Somente o administrador ou o engenheiro auditor pode criar uma vistoria.","error");return;}
    if(ehAuditor&&!obrasCriaveis.some(o=>o.id===obraId)){showToast?.("Esta obra não está disponível no seu escopo.","error");return;}
    const responsavelId=ehAdmin?novaForm?.responsavelId:currentUser?.id;
    if(!vistoriadores.some(u=>u.id===responsavelId)){showToast?.("Selecione o engenheiro auditor responsável ou o administrador.","error");return;}
    const id=uid();
    const result=await dispatch(()=>({
      type:OPERATIONAL_COMMAND.CONFERENCE_CREATED,idempotencyKey:`conferencia-${id}-${uid()}`,expectedVersion:0,
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{conference:{id,obraId,data:novaForm?.data||today(),responsavelId}},
    }),"Não foi possível criar a conferência.");
    if(!result)return;
    setNovaForm(null);
    setSelecionadaId(id);
  };

  const excluirConferencia=()=>{
    if(!conferencia)return;
    setCancelModal({type:"conference",record:conferencia});setCancelReason("");
  };
  const confirmarCancelamento=async()=>{
    if(!cancelModal||!cancelReason.trim()){showToast?.("Informe o motivo do cancelamento.","error");return;}
    const reason=cancelReason.trim();
    if(cancelModal.type==="finding"){
      const result=await dispatch(atual=>({
        type:OPERATIONAL_COMMAND.CONFERENCE_FINDING_CANCELLED,idempotencyKey:`achado-cancelamento-${cancelModal.record.id}-${uid()}`,
        expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{conferenceId:conferencia.id,findingId:cancelModal.record.id,reason},
      }),"Não foi possível cancelar a pendência.");
      if(!result)return;
      setCancelModal(null);setCancelReason("");showToast?.("Pendência cancelada e mantida para auditoria.");return;
    }
    const result=await dispatch(atual=>({
      type:OPERATIONAL_COMMAND.CONFERENCE_CANCELLED,idempotencyKey:`conferencia-cancelamento-${conferencia.id}-${uid()}`,
      expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{conferenceId:conferencia.id,reason},
    }),"Não foi possível cancelar a conferência.");
    if(!result)return;
    setCancelModal(null);setCancelReason("");
    setSelecionadaId(""); showToast?.("Conferência cancelada e preservada no histórico.");
  };

  const abrirPendencia=p=>{
    if(!podeGerirVistoria){showToast?.("Somente o responsável pela vistoria pode cadastrar ou editar pendências.","error");return;}
    setPendenciaForm(p?{...p,etapaId:etapaNivel1Id(p.etapaId),fotos:[...(p.fotos||[])]}:{
    id:"",itemOrcamentoId:"",etapaId:"",descricao:"",categoria:"inconformidade",impacto:"medio",
    responsavelAjusteId:"",responsavelAjusteNome:"",ajusteNecessario:"",prazo:"",status:"aberta",fotos:[],criadoEm:"",resolvidoEm:"",
    });
  };
  const salvarPendencia=async form=>{
    if(!podeGerirVistoria){showToast?.("Somente o responsável pela vistoria pode criar ou editar pendências.","error");return;}
    if(!form.descricao.trim()||!form.ajusteNecessario.trim()){showToast?.("Descreva o problema e o ajuste necessário.","error");return;}
    if(!form.responsavelAjusteId){showToast?.("Defina quem será responsável pelo ajuste.","error");return;}
    const resp=responsaveis.find(r=>r.id===form.responsavelAjusteId);
    const findingId=form.id||uid();
    const finding={...form,id:findingId,itemOrcamentoId:"",responsavelAjusteNome:resp?.nome||form.responsavelAjusteNome||""};
    const result=await dispatch(atual=>({
      type:OPERATIONAL_COMMAND.CONFERENCE_FINDING_SAVED,idempotencyKey:`achado-${findingId}-${uid()}`,
      expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{conferenceId:conferencia.id,finding},
    }),"Não foi possível salvar a pendência.");
    if(!result)return;
    setPendenciaForm(null); showToast?.(form.id?"Pendência atualizada.":"Pendência registrada.");
  };
  const removerPendencia=id=>{
    if(!podeGerirVistoria)return;
    const record=(conferencia.pendencias||[]).find(p=>p.id===id);if(record){setCancelModal({type:"finding",record});setCancelReason("");}
  };
  const abrirValidacao=(p,resultado)=>{
    if(!podeGerirVistoria)return;
    if(p.status!=="aguardando_validacao"||!(p.fotos||[]).some(f=>f.tipo==="ajuste")){showToast?.("A validação exige uma foto de correção enviada pelo responsável do ajuste.","error");return;}
    setValidacaoForm({pendenciaId:p.id,resultado,observacao:""});
  };
  const salvarValidacao=async()=>{
    if(!podeGerirVistoria||!validacaoForm)return;
    const resultado=validacaoForm.resultado;
    const observacao=String(validacaoForm.observacao||"").trim();
    if(!observacao){showToast?.(resultado==="conforme"?"Registre o critério verificado para aprovar a correção.":"Informe o motivo da não conformidade e a orientação para a nova correção.","error");return;}
    const result=await dispatch(atual=>({
      type:OPERATIONAL_COMMAND.CONFERENCE_FINDING_VALIDATED,idempotencyKey:`validacao-${validacaoForm.pendenciaId}-${uid()}`,
      expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{conferenceId:conferencia.id,findingId:validacaoForm.pendenciaId,resultado,observacao},
    }),"Não foi possível registrar a validação.");
    if(!result)return;
    setValidacaoForm(null);
    showToast?.(resultado==="conforme"?"Correção aprovada e pendência encerrada.":"Correção não conforme. A pendência voltou ao responsável pelo ajuste.",resultado==="conforme"?undefined:"error");
  };

  const iniciarEdicaoMetadados=()=>{setMetadataDraft({data:conferencia.data,responsavelId:conferencia.responsavelId||"",observacoesGerais:conferencia.observacoesGerais||""});setMetadataEditing(true);};
  const salvarMetadados=async()=>{
    if(!metadataDraft?.data){showToast?.("Informe a data da vistoria.","error");return;}
    if(ehAdmin&&!vistoriadores.some(u=>u.id===metadataDraft.responsavelId)){showToast?.("Selecione o responsável pela vistoria.","error");return;}
    const result=await dispatch(atual=>({
      type:OPERATIONAL_COMMAND.CONFERENCE_METADATA_UPDATED,idempotencyKey:`conferencia-metadados-${conferencia.id}-${uid()}`,
      expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{conferenceId:conferencia.id,patch:{data:metadataDraft.data,observacoesGerais:metadataDraft.observacoesGerais,...(ehAdmin?{responsavelId:metadataDraft.responsavelId}:{})}},
    }),"Não foi possível salvar as alterações.");
    if(!result)return;
    setMetadataEditing(false);showToast?.("Alterações da vistoria salvas e registradas no histórico.");
  };

  const prepararFotoAjuste=async(p,file)=>{
    if(!file||!ehResponsavelAjuste(p)||p.status==="resolvida")return;
    setSubindoAjusteId(p.id);
    try{const dataUrl=await comprimirImagem(file);setFotoTecnica({pendencia:p,src:dataUrl,originalDataUrl:dataUrl,novaCorrecao:true,podeAnotar:true,legenda:"Foto da correção executada"});}
    catch{showToast?.("Não foi possível preparar a foto.","error");}
    finally{setSubindoAjusteId("");}
  };
  const enviarFotoAjuste=async(p,{dataUrl,originalDataUrl,temAnotacoes,legenda})=>{
    if(!dataUrl||!ehResponsavelAjuste(p)||p.status==="resolvida")return;
    setSubindoAjusteId(p.id);
    try{
      const agora=Date.now(),criadoEm=new Date().toISOString(),novas=[];
      let originalId="";
      if(temAnotacoes){const original=await enviarArquivoOneDrive({dataUrl:originalDataUrl||dataUrl,obraId:obraAtual?.id,obraName:obraAtual?.name||"Obra",driveId:obraAtual?.oneDriveDriveId,folderId:obraAtual?.oneDriveFolderId,folders:obraAtual?.oneDriveFolders,category:"conferencia",date:conferencia.data,fileName:`ajuste-original-${agora}.jpg`});if(!original.url)throw new Error(original.error||"Falha no envio da foto original.");originalId=original.item?.id||uid();novas.push({id:originalId,url:original.url,legenda:"Foto original da correção",path:original.path||"",tipo:"ajuste",enviadoPorId:currentUser.id,enviadoPor:currentUser.nome||"",criadoEm,anotada:false});}
      const resp=await enviarArquivoOneDrive({dataUrl,obraId:obraAtual?.id,obraName:obraAtual?.name||"Obra",driveId:obraAtual?.oneDriveDriveId,folderId:obraAtual?.oneDriveFolderId,folders:obraAtual?.oneDriveFolders,category:"conferencia",date:conferencia.data,fileName:`ajuste-${temAnotacoes?"anotado-":""}${agora}.jpg`});
      if(!resp.url)throw new Error(resp.error||"Falha no envio.");
      novas.push({id:resp.item?.id||uid(),url:resp.url,legenda:legenda||"Foto da correção executada",path:resp.path||"",tipo:"ajuste",enviadoPorId:currentUser.id,enviadoPor:currentUser.nome||"",criadoEm,anotada:!!temAnotacoes,originalFotoId:originalId,anotadoPorId:temAnotacoes?currentUser.id:"",anotadoPor:temAnotacoes?(currentUser.nome||""):"",anotadoEm:temAnotacoes?criadoEm:""});
      const result=await dispatch(atual=>({
        type:OPERATIONAL_COMMAND.CONFERENCE_FINDING_EVIDENCE_ADDED,idempotencyKey:`evidencia-${p.id}-${uid()}`,
        expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{conferenceId:conferencia.id,findingId:p.id,resetValidation:true,fotos:novas},
      }),"Não foi possível registrar a evidência.");
      if(!result)return;
      setFotoTecnica(null);
      showToast?.("Foto enviada. A correção aguarda validação do responsável pela vistoria.");
    }catch(err){showToast?.(err.message||"Falha ao enviar a foto do ajuste.","error");}
    finally{setSubindoAjusteId("");}
  };

  const abrirFotoTecnica=async(p,foto)=>{
    const podeAnotar=podeGerirVistoria||(ehResponsavelAjuste(p)&&foto.tipo==="ajuste"&&p.status!=="resolvida");
    setFotoTecnica({carregando:true,pendencia:p,foto,podeAnotar});
    try{const src=await imagemTecnicaComoDataUrl(foto.url);setFotoTecnica({pendencia:p,foto,src,podeAnotar,legenda:foto.legenda||"Evidência técnica"});}
    catch(err){setFotoTecnica({pendencia:p,foto,src:foto.url,podeAnotar:false,legenda:foto.legenda||"Evidência técnica"});showToast?.(`${err.message||"Falha ao carregar a foto"} A visualização continua disponível, mas a anotação foi bloqueada.`,"error");}
  };
  const salvarCopiaAnotada=async({dataUrl,legenda,temAnotacoes})=>{
    const origem=fotoTecnica?.foto,p=fotoTecnica?.pendencia;if(!origem||!p||!temAnotacoes){if(!temAnotacoes)showToast?.("Faça ao menos uma marcação antes de salvar a cópia.","error");return;}
    setSubindoAjusteId(p.id);
    try{const criadoEm=new Date().toISOString();const resp=await enviarArquivoOneDrive({dataUrl,obraId:obraAtual?.id,obraName:obraAtual?.name||"Obra",driveId:obraAtual?.oneDriveDriveId,folderId:obraAtual?.oneDriveFolderId,folders:obraAtual?.oneDriveFolders,category:"conferencia",date:conferencia.data,fileName:`${origem.tipo==="ajuste"?"ajuste":"vistoria"}-anotado-${Date.now()}.jpg`});if(!resp.url)throw new Error(resp.error||"Falha no envio da anotação.");const nova={id:resp.item?.id||uid(),url:resp.url,legenda:legenda||`${origem.legenda||"Evidência"} · anotada`,path:resp.path||"",tipo:origem.tipo,enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||"",criadoEm,anotada:true,originalFotoId:origem.id||"",anotadoPorId:currentUser?.id||"",anotadoPor:currentUser?.nome||"",anotadoEm:criadoEm};const result=await dispatch(atual=>({type:OPERATIONAL_COMMAND.CONFERENCE_FINDING_EVIDENCE_ADDED,idempotencyKey:`evidencia-anotada-${p.id}-${uid()}`,expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{conferenceId:conferencia.id,findingId:p.id,resetValidation:false,fotos:[nova]}}),"Não foi possível salvar a anotação.");if(!result)return;setFotoTecnica(null);showToast?.("Cópia anotada salva junto à pendência.");}
    catch(err){showToast?.(err.message||"Não foi possível salvar a anotação.","error");}
    finally{setSubindoAjusteId("");}
  };

  const exportarRelatorioPendencias=()=>{
    if(!conferencia)return;
    // O relatório respeita o mesmo escopo operacional: administração e
    // auditoria recebem a vistoria completa; o engenheiro de campo recebe
    // somente os ajustes atribuídos a ele.
    const pendencias=(ehAdmin||ehAuditor)?(conferencia.pendencias||[]):(conferencia.pendencias||[]).filter(ehResponsavelAjuste);
    const statusLabel=status=>CONFERENCIA_STATUS.find(item=>item.v===status)?.l||status||"Aberta";
    const categoriaLabel=categoria=>CONFERENCIA_CATEGORIAS.find(item=>item.v===categoria)?.l||categoria||"Pendência";
    const dataHora=value=>{if(!value)return "-";const parsed=new Date(value);return Number.isNaN(parsed.getTime())?String(value):parsed.toLocaleString("pt-BR");};
    const abertasRel=pendencias.filter(p=>!["resolvida","cancelada"].includes(p.status)).length;
    const vencidas=pendencias.filter(p=>!["resolvida","cancelada"].includes(p.status)&&p.prazo&&p.prazo<today()).length;
    const criticas=pendencias.filter(p=>!["resolvida","cancelada"].includes(p.status)&&p.impacto==="critico").length;
    const resolvidas=pendencias.filter(p=>p.status==="resolvida").length;
    const codigo=`CONF-${String(conferencia.codigo||0).padStart(3,"0")}`;
    const cards=pendencias.map((p,index)=>{
      const impacto=impactoMeta(p.impacto);
      const fotos=(p.fotos||[]).map(f=>`<figure><img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.legenda||"Evidência técnica")}"><figcaption><b>${f.tipo==="ajuste"?"Correção":"Vistoria"}${f.anotada?" · anotada":""}</b><br>${escapeHtml(f.legenda||"Evidência técnica")}${f.enviadoPor?`<br>Enviada por ${escapeHtml(f.enviadoPor)}`:""}${f.criadoEm?` · ${escapeHtml(dataHora(f.criadoEm))}`:""}</figcaption></figure>`).join("");
      const validacoes=(p.validacoes||[]).map(v=>`<li><b>${v.resultado==="conforme"?"Conforme":"Não conforme"}</b> · ${escapeHtml(v.vistoriador||"Vistoriador")} · ${escapeHtml(dataHora(v.criadoEm))}${v.observacao?`<br>${escapeHtml(v.observacao)}`:""}</li>`).join("");
      const vencida=p.status!=="resolvida"&&p.prazo&&p.prazo<today();
      return `<article class="pending ${p.status==="resolvida"?"resolved":""}">
        <div class="pending-head"><div><span class="number">${String(index+1).padStart(2,"0")}</span><span class="tag" style="--tag:${escapeHtml(impacto.c)}">${escapeHtml(impacto.l)}</span><span class="tag category">${escapeHtml(categoriaLabel(p.categoria))}</span></div><span class="status">${escapeHtml(statusLabel(p.status))}</span></div>
        <h2>${escapeHtml(p.descricao||"Pendência sem descrição")}</h2>
        ${p.etapaId?`<p class="stage">Etapa do orçamento · <b>${escapeHtml(nomeEtapa(p.etapaId))}</b></p>`:""}
        <div class="details"><div><small>AJUSTE NECESSÁRIO</small><p>${escapeHtml(p.ajusteNecessario||"-")}</p></div><div><small>RESPONSÁVEL PELO AJUSTE</small><p>${escapeHtml(p.responsavelAjusteNome||"Não definido")}</p></div><div><small>PRAZO</small><p class="${vencida?"overdue":""}">${p.prazo?escapeHtml(fmtDate(p.prazo)):"Não definido"}${vencida?" · VENCIDA":""}</p></div><div><small>REGISTRADA EM</small><p>${escapeHtml(dataHora(p.criadoEm))}</p></div></div>
        ${p.validadoEm?`<div class="validation ${p.validacaoStatus==="conforme"?"ok":"nok"}"><b>${p.validacaoStatus==="conforme"?"CORREÇÃO CONFORME":"CORREÇÃO NÃO CONFORME"}</b> · ${escapeHtml(p.validadoPor||conferencia.responsavel||"-")} · ${escapeHtml(dataHora(p.validadoEm))}${p.validacaoObservacao?`<p>${escapeHtml(p.validacaoObservacao)}</p>`:""}</div>`:""}
        ${validacoes?`<div class="history"><small>HISTÓRICO DE VALIDAÇÕES</small><ul>${validacoes}</ul></div>`:""}
        ${fotos?`<div class="photos">${fotos}</div>`:`<p class="no-photo">Sem evidência fotográfica anexada.</p>`}
      </article>`;
    }).join("");
    const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(codigo)} · Pendências</title><style>
      :root{--graphite:#161616;--gold:#d4af37;--sand:#f4f4f4;--gray:#525252;--line:#d6d6d6;--red:#da1e28;--green:#24a148;--blue:#525252}*{box-sizing:border-box}body{margin:0;background:#f4f4f4;color:var(--graphite);font-family:"IBM Plex Sans","Helvetica Neue",Arial,sans-serif}.toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:8px;padding:10px 22px;background:#161616}.toolbar button{border:1px solid var(--gold);border-radius:4px;padding:10px 16px;background:var(--gold);color:#161616;font-weight:600;cursor:pointer}.report{width:min(100%,1040px);margin:18px auto;background:white;padding:34px 38px}.brand{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid var(--gold);padding-bottom:16px}.brand h1{margin:0;font-size:22px;font-weight:600;letter-spacing:.02em}.brand p{margin:4px 0 0;color:var(--gray);font-size:11px}.code{text-align:right;font-family:"IBM Plex Mono",monospace}.code b{display:block;font-size:20px}.code span{font-size:10px;color:var(--gray)}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.meta div,.kpi{border:1px solid var(--line);border-radius:4px;padding:9px}.meta small,.kpi small,.details small,.history small{display:block;color:var(--gray);font-size:10px;font-weight:600;letter-spacing:.04em}.meta p,.details p{margin:4px 0 0;font-size:12px;font-weight:500}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:14px 0 18px}.kpi b{display:block;margin-top:3px;font:600 17px "IBM Plex Mono",monospace}.general{margin:0 0 17px;padding:11px 12px;background:var(--sand);border:1px solid var(--gold);font-size:11px;white-space:pre-wrap}.pending{break-inside:avoid-page;border:1px solid var(--line);border-radius:4px;padding:14px;margin:0 0 13px}.pending:not(.resolved){border-color:var(--red)}.pending-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.number{font:600 10px "IBM Plex Mono",monospace;margin-right:7px}.tag,.status{display:inline-block;border:1px solid var(--tag,var(--line));color:var(--tag,var(--graphite));border-radius:99px;padding:3px 7px;font-size:9px;font-weight:600;text-transform:uppercase;margin-right:4px}.category{--tag:var(--gray)}.status{background:var(--sand);margin:0}.pending h2{font-size:14px;font-weight:600;margin:9px 0 3px}.stage{font-size:10px;color:var(--gray);margin:0 0 10px}.details{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:7px}.details>div{background:var(--sand);border-radius:4px;padding:8px}.overdue{color:var(--red)!important}.validation{margin-top:9px;padding:8px 9px;border-radius:4px;font-size:10px}.validation p{margin:4px 0 0}.validation.ok{background:#edf7ef;color:var(--green)}.validation.nok{background:#fff3e8;color:#8a3b00}.history{margin-top:9px}.history ul{margin:5px 0 0;padding-inline-start:18px;font-size:10px;line-height:1.45}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.photos figure{margin:0;border:1px solid var(--line);border-radius:4px;overflow:hidden}.photos img{display:block;width:100%;height:180px;object-fit:cover}.photos figcaption{padding:6px;font-size:10px;line-height:1.35;color:var(--gray)}.no-photo{font-size:10px;color:var(--red);margin:9px 0 0}.empty{padding:30px;text-align:center;border:1px dashed var(--line);color:var(--gray)}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:50px}.signature{border-top:1px solid #525252;padding-top:6px;text-align:center;font-size:10px}.footer{margin-top:24px;padding-top:9px;border-top:1px solid var(--line);font-size:9px;color:var(--gray);display:flex;justify-content:space-between}@media(max-width:700px){.report{margin:0;padding:20px}.meta,.summary{grid-template-columns:repeat(2,1fr)}.details{grid-template-columns:1fr}.photos{grid-template-columns:repeat(2,1fr)}}@media print{body{background:#fff}.toolbar{display:none}.report{width:100%;margin:0;padding:14mm}.pending{break-inside:avoid}.photos img{height:45mm}@page{size:A4;margin:8mm}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir / salvar PDF</button></div><main class="report"><header class="brand"><div><h1>${escapeHtml(data.config?.companyName||"ARCD Construtech")}</h1><p>RELATÓRIO TÉCNICO DE PENDÊNCIAS</p>${data.config?.cnpj?`<p>CNPJ ${escapeHtml(data.config.cnpj)}</p>`:""}</div><div class="code"><b>${escapeHtml(codigo)}</b><span>${escapeHtml(conferencia.status==="concluida"?"VISTORIA CONCLUÍDA":"VISTORIA EM ANDAMENTO")}</span></div></header><section class="meta"><div><small>OBRA</small><p>${escapeHtml(obraAtual?.name||"-")}</p></div><div><small>DATA DA VISTORIA</small><p>${escapeHtml(fmtDate(conferencia.data))}</p></div><div><small>RESPONSÁVEL PELA VISTORIA</small><p>${escapeHtml(conferencia.responsavel||"-")}</p></div><div><small>NOTA TÉCNICA CALCULADA</small><p>${conferenceQualityScore(conferencia)==null?"Aguardando inspeção":`${escapeHtml(String(conferenceQualityScore(conferencia)))}/10`}</p></div></section><section class="summary"><div class="kpi"><small>TOTAL</small><b>${pendencias.length}</b></div><div class="kpi"><small>EM ABERTO</small><b style="color:var(--red)">${abertasRel}</b></div><div class="kpi"><small>VENCIDAS</small><b style="color:var(--red)">${vencidas}</b></div><div class="kpi"><small>CRÍTICAS</small><b style="color:var(--red)">${criticas}</b></div><div class="kpi"><small>RESOLVIDAS</small><b style="color:var(--green)">${resolvidas}</b></div></section>${conferencia.inspectionDeclaration?.confirmedAt?`<section class="general"><b>DECLARAÇÃO DE INSPEÇÃO</b><br>${escapeHtml(conferencia.inspectionDeclaration.notes||"Escopo previsto inspecionado.")}<br><small>Confirmada por ${escapeHtml(conferencia.inspectionDeclaration.confirmedBy||conferencia.responsavel||"-")} em ${escapeHtml(dataHora(conferencia.inspectionDeclaration.confirmedAt))}</small></section>`:conferencia.observacoesGerais?`<section class="general"><b>OBSERVAÇÕES GERAIS</b><br>${escapeHtml(conferencia.observacoesGerais)}</section>`:""}<section>${cards||`<div class="empty">Nenhuma inconformidade registrada. Consulte a declaração de inspeção acima.</div>`}</section><section class="signatures"><div class="signature">${escapeHtml(conferencia.responsavel||"Responsável pela vistoria")}<br>Responsável pela vistoria</div><div class="signature">Ciência da equipe responsável pelos ajustes</div></section><footer class="footer"><span>Gerado por ${escapeHtml(currentUser?.nome||"ArcD")} em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</span><span>${escapeHtml(obraAtual?.address||obraAtual?.endereco||"")}</span></footer></main></body></html>`;
    const janela=window.open("","_blank");
    if(!janela){showToast?.("O navegador bloqueou a janela do relatório. Permita pop-ups para este site.","error");return;}
    janela.opener=null;janela.document.write(html);janela.document.close();
  };

  const podeVerConferencia=c=>ehAdmin||(ehAuditor&&(!currentUser?.obraId||c.obraId===currentUser.obraId))||(ehEngenheiro&&(c.pendencias||[]).some(p=>p.responsavelAjusteId===currentUser?.id));
  const obrasVisiveis=ehAdmin?obras:ehAuditor?obrasNoEscopo:obras.filter(o=>(data.conferencias||[]).some(c=>c.obraId===o.id&&podeVerConferencia(c)));
  const filtroValido=obrasVisiveis.some(o=>o.id===obraFiltro)?obraFiltro:(obrasVisiveis[0]?.id||"");
  const conferenciasVisiveis=(data.conferencias||[]).filter(podeVerConferencia);
  const lista=conferenciasVisiveis.filter(c=>!filtroValido||c.obraId===filtroValido).filter(c=>statusFiltro==="todas"||(
    c.status!=="concluida"&&c.status!=="cancelada"||(c.pendencias||[]).some(p=>!['resolvida','cancelada'].includes(p.status))
  )).sort((a,b)=>(b.data||"").localeCompare(a.data||"")||Number(b.codigo)-Number(a.codigo));

  if(!conferencia) return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <PageHero
      eyebrow="Engenharia de campo"
      title="Conferência técnica"
      description="Vistorias, inconformidades e ajustes rastreados até a resolução."
      actions={(ehAdmin||ehAuditor)&&<Btn onClick={abrirNovaConferencia} disabled={!podeCriarConferencia} title={!podeCriarConferencia?"Nenhuma obra ativa está disponível no seu escopo.":"Criar nova vistoria"}><Ic n="plus"/> Nova vistoria</Btn>}
    />
    <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
      <div style={{minWidth:240,flex:1}}><Sel label="Obra" value={filtroValido} onChange={setObraFiltro} options={obrasVisiveis.map(o=>({v:o.id,l:o.name}))}/></div>
      <div style={{minWidth:190}}><Sel label="Situação" value={statusFiltro} onChange={setStatusFiltro} options={[{v:"abertas",l:"Em andamento / com pendências"},{v:"todas",l:"Todas as conferências"}]}/></div>
    </div>
    {ehEngenheiro&&<div style={{padding:"9px 11px",border:`1px solid ${C.blue}44`,borderRadius:8,background:`${C.blue}08`,fontSize:10.5,color:C.blue}}>Como engenheiro de campo, você visualiza somente as pendências atribuídas a você e envia a foto da correção. A criação e a validação da vistoria pertencem ao administrador e ao engenheiro auditor.</div>}
    {(ehAdmin||ehAuditor)&&<RankingQualidade data={data} conferencias={conferenciasVisiveis} obraIdFixo={obraIdFixo} onSelecionarObra={id=>setObraFiltro(id)}/>}
    {!lista.length?<div style={{padding:"34px 18px",textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:10,background:C.surface}}><Ic n="clipboard" s={26} color={C.muted}/><p style={{fontSize:13,fontWeight:800,color:C.text,marginTop:9}}>Nenhuma conferência nesta obra</p><p style={{fontSize:11,color:C.muted,marginTop:4}}>Crie a primeira vistoria técnica para começar a rastrear ajustes.</p></div>:
    <div style={{display:"grid",gridTemplateColumns:cols(1,2,3),gap:10}}>{lista.map(c=>{
      const abertas=(c.pendencias||[]).filter(p=>!["resolvida","cancelada"].includes(p.status)).length;
      const criticas=(c.pendencias||[]).filter(p=>!["resolvida","cancelada"].includes(p.status)&&p.impacto==="critico").length;
      return <button className="conference-list-item" key={c.id} onClick={()=>setSelecionadaId(c.id)}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong>CONF-{String(c.codigo).padStart(3,"0")}</strong><Badge color={c.status==="cancelada"?C.muted:c.status==="concluida"?C.green:c.status==="nao_iniciada"?C.muted:C.orange}>{c.status==="cancelada"?"Cancelada":c.status==="concluida"?"Concluída":c.status==="nao_iniciada"?"Não iniciada":"Em andamento"}</Badge></div>
        <p style={{fontSize:12,color:C.muted,marginTop:7}}>{fmtDate(c.data)} · {c.responsavel||"Sem responsável"}</p>
        <div style={{display:"flex",gap:12,marginTop:12,fontSize:11,color:C.text}}><span><strong>{conferenceQualityScore(c)??"—"}</strong>{conferenceQualityScore(c)!=null?"/10":""}</span><span><strong>{(c.pendencias||[]).length}</strong> achados</span><span style={{color:abertas?C.red:C.green}}><strong>{abertas}</strong> abertos</span></div>
      </button>;
    })}</div>}
    {novaForm&&<Modal title="Nova conferência técnica" onClose={()=>setNovaForm(null)}><div style={{display:"flex",flexDirection:"column",gap:11}}><Sel label="Obra *" value={novaForm.obraId} onChange={v=>setNovaForm(f=>({...f,obraId:v,responsavelId:ehAdmin?(f.responsavelId||auditores[0]?.id||currentUser?.id||""):(currentUser?.id||"")}))} options={obrasCriaveis.map(o=>({v:o.id,l:o.name}))}/>{ehAdmin?<Sel label="Responsável pela vistoria *" value={novaForm.responsavelId} onChange={v=>setNovaForm(f=>({...f,responsavelId:v}))} options={[{v:"",l:"Selecione..."},...vistoriadores.map(u=>({v:u.id,l:`${u.nome} · ${u.role==="admin"?"Administrador":"Engenheiro auditor"}`}))]}/>:<Inp label="Responsável pela vistoria" value={currentUser?.nome||""} onChange={()=>{}} disabled/>}<Inp label="Data da vistoria" type="date" value={novaForm.data} onChange={v=>setNovaForm(f=>({...f,data:v}))}/><div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={()=>setNovaForm(null)} full>Cancelar</Btn><Btn onClick={novaConferencia} full><Ic n="check"/> Criar conferência</Btn></div></div></Modal>}
  </div>;

  const abertas=(conferencia.pendencias||[]).filter(p=>!["resolvida","cancelada"].includes(p.status)).length;
  const alternarConclusao=async()=>{
    if(!podeGerirVistoria)return;
    if(conferencia.status==="concluida"){
      const result=await dispatch(atual=>({
        type:OPERATIONAL_COMMAND.CONFERENCE_REOPENED,idempotencyKey:`conferencia-reabertura-${conferencia.id}-${uid()}`,
        expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{conferenceId:conferencia.id},
      }),"Não foi possível reabrir a vistoria.");
      if(!result)return;
      showToast?.("Vistoria reaberta com histórico preservado.");return;
    }
    if(abertas){showToast?.("Valide todas as correções antes de concluir a vistoria.","error");return;}
    setCompletionForm({scopeReviewed:false,notes:conferencia.inspectionDeclaration?.notes||""});setCompletionModal(true);
  };
  const confirmarConclusao=async()=>{
    const check=conferenceCompletionCheck(conferencia,completionForm);
    if(!check.ok){showToast?.(check.reason,"error");return;}
    const result=await dispatch(atual=>({
      type:OPERATIONAL_COMMAND.CONFERENCE_COMPLETED,idempotencyKey:`conferencia-conclusao-${conferencia.id}-${uid()}`,
      expectedVersion:Number(vigenteConferencia(atual)?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{conferenceId:conferencia.id,declaration:completionForm},
    }),"Não foi possível concluir a vistoria.");
    if(!result)return;
    setCompletionModal(false);showToast?.("Vistoria concluída com declaração técnica e trilha de auditoria.");
  };
  const totalPendencias=(conferencia.pendencias||[]).length;
  const resolvidas=(conferencia.pendencias||[]).filter(p=>p.status==="resolvida").length;
  const progresso=conferenceProgress(conferencia);
  const notaCalculada=conferenceQualityScore(conferencia);
  const vencidas=(conferencia.pendencias||[]).filter(p=>!["resolvida","cancelada"].includes(p.status)&&p.prazo&&p.prazo<today()).length;
  const criticas=(conferencia.pendencias||[]).filter(p=>!["resolvida","cancelada"].includes(p.status)&&p.impacto==="critico").length;
  const findingsVisible=filterConferenceFindings(conferencia,findingFilters,today());
  return <div className="conference-field-view" style={{display:"flex",flexDirection:"column",gap:12,paddingBottom:!isDesktop&&podeGerirVistoria?78:0}}>
    <div className="conference-field-header" style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div><button className="conference-back" onClick={()=>setSelecionadaId("")}>← Todas as conferências</button><h2>CONF-{String(conferencia.codigo).padStart(3,"0")} · {obraAtual?.name}</h2><p className="conference-save-state">{lastSaved?`Salvo e auditado às ${new Date(lastSaved).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:conferencia.atualizadoPor?`Última alteração por ${conferencia.atualizadoPor} · ${new Date(conferencia.atualizadoEm).toLocaleString("pt-BR")}`:"Histórico técnico preservado"}</p></div>
      <div className="conference-desktop-actions"><Btn size="sm" v="ghost" onClick={exportarRelatorioPendencias}><Ic n="fileText"/> Gerar relatório</Btn>{conferencia.status==="cancelada"?<Badge color={C.muted}>Cancelada</Badge>:podeGerirVistoria&&<>{!metadataEditing&&<Btn size="sm" v="ghost" onClick={iniciarEdicaoMetadados}><Ic n="edit"/> Editar vistoria</Btn>}{ehAdmin&&<Btn size="sm" v="ghost" onClick={excluirConferencia}><Ic n="trash"/> Cancelar vistoria</Btn>}<Btn size="sm" onClick={alternarConclusao}>{conferencia.status==="concluida"?"Reabrir vistoria":"Concluir vistoria"}</Btn></>}</div>
    </div>
    <section className="conference-mobile-progress" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline"}}><div><p className="conference-label">Andamento da vistoria</p><b>{conferencia.status==="nao_iniciada"?"Inspeção ainda não iniciada":abertas?`${abertas} ajuste(s) em aberto`:progresso===100?"Escopo verificado":"Aguardando declaração técnica"}</b></div><strong>{progresso}%</strong></div>
      <div style={{height:6,borderRadius:99,background:C.surface,overflow:"hidden",marginTop:8}}><div style={{height:"100%",width:`${progresso}%`,background:progresso===100?C.green:C.yellow,borderRadius:99}}/></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginTop:9}}>{[["Achados",totalPendencias,C.text],["Abertos",abertas,C.orange],["Críticos",criticas,C.red],["Vencidos",vencidas,C.red]].map(([l,v,c])=><div key={l}><b style={{display:"block",fontSize:13,color:c}}>{v}</b><span style={{fontSize:8,color:C.muted}}>{l}</span></div>)}</div>
    </section>
    <div className="conference-meta-grid" style={{display:"grid",gridTemplateColumns:cols(1,2,4),gap:9}}>
      <Inp label="Data da vistoria" type="date" value={metadataEditing?metadataDraft?.data:conferencia.data} onChange={v=>setMetadataDraft(f=>({...f,data:v}))} disabled={!metadataEditing}/>
      {ehAdmin?<Sel label="Responsável pela vistoria" value={metadataEditing?metadataDraft?.responsavelId:(conferencia.responsavelId||"")} onChange={v=>setMetadataDraft(f=>({...f,responsavelId:v}))} disabled={!metadataEditing} options={[{v:"",l:"Selecione..."},...vistoriadores.map(u=>({v:u.id,l:`${u.nome} · ${u.role==="admin"?"Administrador":"Engenheiro auditor"}`}))]}/>:<Inp label="Responsável pela vistoria" value={conferencia.responsavel||responsavelAutomatico?.nome||""} onChange={()=>{}} disabled/>}
      <Inp label="Nota técnica calculada" value={notaCalculada==null?"Aguardando inspeção":`${notaCalculada}/10`} onChange={()=>{}} disabled/>
      <div><p style={{fontSize:9.5,fontWeight:800,color:C.muted,marginBottom:5}}>SITUAÇÃO DOS AJUSTES</p><div style={{height:38,border:`1px solid ${abertas?C.orange:C.green}`,borderRadius:6,display:"flex",alignItems:"center",padding:"0 10px",fontSize:12,fontWeight:800,color:abertas?C.orange:C.green}}>{abertas?`${abertas} pendência(s) aberta(s)`:"Tudo resolvido"}</div></div>
    </div>
    <div className="conference-notes"><Inp label="Observações gerais" multiline value={metadataEditing?metadataDraft?.observacoesGerais:conferencia.observacoesGerais} onChange={v=>setMetadataDraft(f=>({...f,observacoesGerais:v}))} disabled={!metadataEditing} placeholder="Avaliação geral da qualidade, critérios verificados e orientações..."/>{metadataEditing&&<div className="conference-metadata-actions"><Btn v="ghost" onClick={()=>{setMetadataEditing(false);setMetadataDraft(null);}}>Descartar alterações</Btn><Btn onClick={salvarMetadados}><Ic n="check"/> Salvar e registrar histórico</Btn></div>}</div>
    <details className="conference-audit"><summary>Histórico da vistoria · {(conferencia.auditTrail||[]).length} evento(s)</summary><ol>{[...(conferencia.auditTrail||[])].reverse().slice(0,12).map(event=><li key={event.id}><span>{event.action}</span><small>{event.actor||"Usuário autenticado"} · {new Date(event.at).toLocaleString("pt-BR")}</small>{event.details&&<p>{event.details}</p>}</li>)}</ol>{!(conferencia.auditTrail||[]).length&&<p>Esta vistoria foi criada antes da trilha detalhada. Novas alterações serão registradas aqui.</p>}</details>
    <div className="conference-findings"><Bloco titulo={`Pendências técnicas (${(conferencia.pendencias||[]).length})`} acao={podeGerirVistoria?<span><Btn size="sm" onClick={()=>abrirPendencia(null)}><Ic n="plus"/> Pendência</Btn></span>:null}>
      <div className="conference-filters" aria-label="Filtros das pendências técnicas">
        <Inp label="Pesquisar achados" value={findingFilters.query} onChange={query=>setFindingFilters(f=>({...f,query}))} placeholder="Problema, ajuste ou responsável"/>
        <Sel label="Situação" value={findingFilters.status} onChange={status=>setFindingFilters(f=>({...f,status}))} options={[{v:"todas",l:"Todas"},...CONFERENCIA_STATUS]}/>
        <Sel label="Impacto" value={findingFilters.impact} onChange={impact=>setFindingFilters(f=>({...f,impact}))} options={[{v:"todos",l:"Todos"},...CONFERENCIA_IMPACTOS]}/>
        <Sel label="Responsável" value={findingFilters.ownerId} onChange={ownerId=>setFindingFilters(f=>({...f,ownerId}))} options={[{v:"todos",l:"Todos"},...responsaveis.map(r=>({v:r.id,l:r.nome}))]}/>
        <button type="button" className={`conference-overdue-filter${findingFilters.onlyOverdue?" is-active":""}`} aria-pressed={findingFilters.onlyOverdue} onClick={()=>setFindingFilters(f=>({...f,onlyOverdue:!f.onlyOverdue}))}><Ic n="clock"/> Somente vencidas ({vencidas})</button>
      </div>
      {!orc&&<div style={{padding:12,borderRadius:7,background:C.surface,color:C.muted,fontSize:12}}>Orçamento não vinculado. Você pode registrar o achado normalmente e relacionar uma etapa depois, se necessário.</div>}
      {orc&&!etapasNivel1.length&&<div style={{padding:12,borderRadius:7,background:C.surface,color:C.muted,fontSize:12}}>Este orçamento não possui etapas principais. O vínculo da pendência continuará opcional.</div>}
      {!(conferencia.pendencias||[]).length&&<div className="conference-empty"><strong>Inspeção ainda sem achados</strong><p>Registre uma inconformidade ou conclua com uma declaração técnica do escopo inspecionado.</p></div>}
      {(conferencia.pendencias||[]).length>0&&!findingsVisible.length&&<div className="conference-empty"><strong>Nenhuma pendência neste filtro</strong><p>Ajuste os filtros para consultar os demais registros.</p><Btn v="ghost" size="sm" onClick={()=>setFindingFilters({query:"",status:"todas",impact:"todos",ownerId:"todos",onlyOverdue:false})}>Limpar filtros</Btn></div>}
      <div className="conference-finding-list">{findingsVisible.map(p=>{
        const imp=impactoMeta(p.impacto);
        return <article className={`conference-finding-card conference-finding-card--${p.impacto}`} key={p.id}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><div style={{minWidth:0,flex:1}}><div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><Badge color={imp.c}>{imp.l}</Badge><Badge color={C.muted}>{CONFERENCIA_CATEGORIAS.find(x=>x.v===p.categoria)?.l}</Badge>{p.etapaId&&<span style={{fontSize:10,color:C.muted}}>{nomeEtapa(p.etapaId)}</span>}</div><p className="conference-finding-title">{p.descricao}</p>{p.etapaId&&<p className="conference-finding-stage">Etapa principal do orçamento: <strong>{nomeEtapa(p.etapaId)}</strong></p>}</div>{podeGerirVistoria&&p.status!=="cancelada"&&<div className="conference-finding-actions"><button onClick={()=>abrirPendencia(p)} aria-label={`Editar pendência: ${p.descricao}`}><Ic n="edit"/> <span>Editar</span></button><button className="is-danger" onClick={()=>removerPendencia(p.id)} aria-label={`Cancelar pendência: ${p.descricao}`}><Ic n="trash"/> <span>Cancelar</span></button></div>}</div>
          <p style={{fontSize:11.5,color:C.text,marginTop:8}}><strong>Ajuste:</strong> {p.ajusteNecessario}</p><p style={{fontSize:10.5,color:C.muted,marginTop:5}}>Responsável: <strong>{p.responsavelAjusteNome||"—"}</strong>{p.prazo?` · Prazo: ${fmtDate(p.prazo)}`:""}</p>
          {(p.fotos||[]).length>0&&<div className="conference-evidence-strip">{p.fotos.map((f,idx)=><button key={f.id||`${f.url}-${idx}`} onClick={()=>abrirFotoTecnica(p,f)} aria-label={`Ampliar ${f.legenda||"evidência"}${f.enviadoPor?` enviada por ${f.enviadoPor}`:""}`}><img loading="lazy" src={f.url} alt={f.legenda||`Evidência da pendência ${p.descricao}`}/>{f.tipo==="ajuste"&&<span className="is-correction">Correção</span>}{f.anotada&&<span className="is-annotated">Anotada</span>}</button>)}</div>}
          {ehResponsavelAjuste(p)&&p.status!=="resolvida"&&<label className="conference-correction-camera" data-loading={subindoAjusteId===p.id?"true":"false"}><Ic n="camera"/>{subindoAjusteId===p.id?"Preparando...":p.status==="aguardando_validacao"?"Enviar nova foto":"Fotografar e anotar correção"}<input type="file" accept="image/*" capture="environment" disabled={subindoAjusteId===p.id} onChange={e=>{const file=e.target.files?.[0];prepararFotoAjuste(p,file);e.target.value="";}}/></label>}
          <div className="conference-finding-status"><Badge color={p.status==="cancelada"?C.muted:p.status==="resolvida"?C.green:p.status==="aguardando_validacao"?C.yellow:p.status==="em_ajuste"?C.orange:C.red}>{p.status==="cancelada"?"Cancelada":CONFERENCIA_STATUS.find(s=>s.v===p.status)?.l||"Aberta"}</Badge>{p.status==="cancelada"&&<span>Motivo: {p.motivoCancelamento||"não informado"}</span>}{podeGerirVistoria&&p.status==="aguardando_validacao"&&<><Btn size="sm" v="success" onClick={()=>abrirValidacao(p,"conforme")}><Ic n="check"/> Conforme</Btn><Btn size="sm" v="ghost" onClick={()=>abrirValidacao(p,"nao_conforme")}><Ic n="alert"/> Não conforme</Btn></>}{ehResponsavelAjuste(p)&&["aberta","em_ajuste"].includes(p.status)&&<span>Envie a foto da correção para o vistoriador analisar.</span>}{ehResponsavelAjuste(p)&&p.status==="aguardando_validacao"&&<span>Evidência recebida · aguardando {conferencia.responsavel}.</span>}</div>
          {p.validadoEm&&<div style={{marginTop:8,padding:"7px 9px",borderRadius:6,background:p.validacaoStatus==="conforme"?`${C.green}0D`:`${C.orange}0D`,border:`1px solid ${p.validacaoStatus==="conforme"?C.green:C.orange}44`}}><p style={{fontSize:9.5,fontWeight:850,color:p.validacaoStatus==="conforme"?C.green:C.orange}}>{p.validacaoStatus==="conforme"?"CORREÇÃO CONFORME":"CORREÇÃO NÃO CONFORME"} · {p.validadoPor||conferencia.responsavel} · {new Date(p.validadoEm).toLocaleString("pt-BR")}</p>{p.validacaoObservacao&&<p style={{fontSize:10.5,color:C.text,marginTop:4}}>{p.validacaoObservacao}</p>}</div>}
        </article>;
      })}</div>
    </Bloco></div>
    {!isDesktop&&podeGerirVistoria&&<div className="conference-mobile-actions"><button onClick={exportarRelatorioPendencias} aria-label="Gerar relatório"><Ic n="fileText" s={17}/></button><button className="conference-mobile-primary" onClick={()=>abrirPendencia(null)}><Ic n="camera" s={17}/> Registrar achado</button><button onClick={alternarConclusao} aria-label={conferencia.status==="concluida"?"Reabrir vistoria":"Concluir vistoria"}><Ic n={conferencia.status==="concluida"?"refresh":"check"} s={17}/></button></div>}
    {completionModal&&<Modal title="Concluir vistoria técnica" onClose={()=>setCompletionModal(false)}><div className="conference-confirm-flow"><div className="conference-completion-summary"><strong>{totalPendencias?`${resolvidas} de ${totalPendencias} achados encerrados`:"Nenhuma inconformidade registrada"}</strong><p>A conclusão confirma que o escopo previsto foi efetivamente inspecionado. A nota {notaCalculada??10}/10 será calculada pela criticidade, resolução e reincidências.</p></div><button type="button" className={`conference-scope-check${completionForm.scopeReviewed?" is-checked":""}`} aria-pressed={completionForm.scopeReviewed} onClick={()=>setCompletionForm(f=>({...f,scopeReviewed:!f.scopeReviewed}))}><span aria-hidden="true">{completionForm.scopeReviewed?"✓":""}</span><span><strong>Confirmei todo o escopo previsto</strong><small>Projetos, serviços executados, interfaces e critérios aplicáveis foram verificados.</small></span></button><Inp label={totalPendencias?"Parecer conclusivo":"Escopo verificado e declaração sem inconformidades *"} multiline value={completionForm.notes} onChange={notes=>setCompletionForm(f=>({...f,notes}))} placeholder={totalPendencias?"Registre a síntese técnica da vistoria.":"Ex.: estrutura, instalações e acabamentos inspecionados nos ambientes liberados."}/><div className="conference-confirm-actions"><Btn v="ghost" full onClick={()=>setCompletionModal(false)}>Voltar à vistoria</Btn><Btn full onClick={confirmarConclusao}><Ic n="check"/> Confirmar conclusão auditável</Btn></div></div></Modal>}
    {cancelModal&&<Modal title={cancelModal.type==="conference"?"Cancelar vistoria":"Cancelar pendência"} onClose={()=>setCancelModal(null)}><div className="conference-confirm-flow"><p>O registro não será apagado. Situação, motivo, responsável e horário permanecerão no histórico técnico.</p><Inp label="Motivo do cancelamento *" multiline value={cancelReason} onChange={setCancelReason} placeholder="Explique por que este registro deve ser cancelado"/><div className="conference-confirm-actions"><Btn v="ghost" full onClick={()=>setCancelModal(null)}>Manter registro</Btn><Btn v="danger" full onClick={confirmarCancelamento}>Confirmar cancelamento</Btn></div></div></Modal>}
    {pendenciaForm&&(
      <ModalPendenciaConferencia form={pendenciaForm} setForm={setPendenciaForm} etapasNivel1={etapasNivel1} responsaveis={responsaveis} obra={obraAtual} conferencia={conferencia} currentUser={currentUser} onSalvar={salvarPendencia} onClose={()=>setPendenciaForm(null)} showToast={showToast}/>
    )}
    {fotoTecnica?.carregando&&<div style={{position:"fixed",inset:0,zIndex:10020,background:"rgba(10,12,14,.82)",display:"grid",placeItems:"center",color:"white"}}><div style={{textAlign:"center"}}><div style={{width:28,height:28,border:"3px solid rgba(255,255,255,.25)",borderTopColor:C.yellow,borderRadius:99,animation:"spin 1s linear infinite",margin:"0 auto 9px"}}/><p style={{fontSize:11,fontWeight:800}}>Abrindo evidência técnica...</p></div></div>}
    {fotoTecnica?.src&&<EditorFotoTecnica
      src={fotoTecnica.src} legendaInicial={fotoTecnica.legenda} podeAnotar={fotoTecnica.podeAnotar}
      titulo={fotoTecnica.novaCorrecao?"Foto da correção · revisar e anotar":"Evidência da pendência técnica"}
      acaoSalvar={fotoTecnica.novaCorrecao?"Enviar evidência":"Salvar cópia anotada"}
      onClose={()=>setFotoTecnica(null)}
      onSave={payload=>fotoTecnica.novaCorrecao?enviarFotoAjuste(fotoTecnica.pendencia,{...payload,originalDataUrl:fotoTecnica.originalDataUrl}):salvarCopiaAnotada(payload)}
    />}
    {validacaoForm&&<Modal title={validacaoForm.resultado==="conforme"?"Aprovar correção":"Reprovar correção"} onClose={()=>setValidacaoForm(null)}><div className="conference-confirm-flow"><div className={validacaoForm.resultado==="conforme"?"conference-validation-note is-success":"conference-validation-note is-warning"}>{validacaoForm.resultado==="conforme"?"A pendência será encerrada somente após registrar o critério técnico verificado.":"A pendência voltará ao responsável para uma nova correção e nova evidência."}</div><Inp label={validacaoForm.resultado==="conforme"?"Critério verificado e parecer técnico *":"Motivo e orientação para nova correção *"} multiline value={validacaoForm.observacao} onChange={v=>setValidacaoForm(f=>({...f,observacao:v}))}/><div className="conference-confirm-actions"><Btn v="ghost" full onClick={()=>setValidacaoForm(null)}>Cancelar</Btn><Btn v={validacaoForm.resultado==="conforme"?"success":"warning"} full onClick={salvarValidacao}>{validacaoForm.resultado==="conforme"?"Confirmar conformidade":"Registrar não conformidade"}</Btn></div></div></Modal>}
  </div>;
}

function ModalPendenciaConferencia({form,setForm,etapasNivel1,responsaveis,obra,conferencia,currentUser,onSalvar,onClose,showToast}){
  const [subindo,setSubindo]=useState(false);
  const [fotoEditor,setFotoEditor]=useState(null);
  const [archivePhoto,setArchivePhoto]=useState(null);
  const [archiveReason,setArchiveReason]=useState("");
  const subirFoto=async e=>{
    const input=e.currentTarget,files=Array.from(input.files||[]);
    if(!files.length)return;
    setSubindo(true);
    try{
      const novas=[];
      for(const [index,file] of files.entries()){
        if(!String(file.type||"").startsWith("image/"))throw new Error(`${file.name||"Arquivo"} não é uma imagem válida.`);
        const dataUrl=await comprimirImagem(file);
        const fileName=`conferencia-${Date.now()}-${index+1}.jpg`;
        const resp=await uploadWithRetry(()=>enviarArquivoOneDrive({dataUrl,obraId:obra?.id,obraName:obra?.name||"Obra",driveId:obra?.oneDriveDriveId,folderId:obra?.oneDriveFolderId,folders:obra?.oneDriveFolders,category:"conferencia",date:conferencia.data,fileName}));
        const url=resp.url||resp.item?.webUrl||"";
        if(!url)throw new Error(resp.error||`Falha ao enviar ${file.name||"a foto"}.`);
        novas.push({id:resp.item?.id||uid(),url,legenda:String(file.name||"Registro da vistoria").replace(/\.[^.]+$/,""),path:resp.path||"",tipo:"registro",enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||"",criadoEm:new Date().toISOString()});
      }
      setForm(f=>({...f,fotos:[...(f.fotos||[]),...novas]}));
      showToast?.(`${novas.length} evidência(s) adicionada(s).`);
    }catch(err){showToast?.(err.message||"Falha ao enviar foto.","error");}
    finally{setSubindo(false);input.value="";}
  };
  const abrirEditor=async foto=>{setFotoEditor({carregando:true,foto});try{const src=await imagemTecnicaComoDataUrl(foto.url);setFotoEditor({foto,src});}catch(err){setFotoEditor(null);showToast?.(err.message||"Não foi possível abrir a imagem.","error");}};
  const salvarAnotada=async({dataUrl,legenda,temAnotacoes})=>{if(!fotoEditor?.foto||!temAnotacoes){showToast?.("Faça ao menos uma marcação antes de salvar.","error");return;}setSubindo(true);try{const origem=fotoEditor.foto,criadoEm=new Date().toISOString();const resp=await enviarArquivoOneDrive({dataUrl,obraId:obra?.id,obraName:obra?.name||"Obra",driveId:obra?.oneDriveDriveId,folderId:obra?.oneDriveFolderId,folders:obra?.oneDriveFolders,category:"conferencia",date:conferencia.data,fileName:`vistoria-anotada-${Date.now()}.jpg`});if(!resp.url)throw new Error(resp.error||"Falha no envio.");const nova={id:resp.item?.id||uid(),url:resp.url,legenda:legenda||`${origem.legenda||"Evidência"} · anotada`,path:resp.path||"",tipo:"registro",enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||"",criadoEm,anotada:true,originalFotoId:origem.id||"",anotadoPorId:currentUser?.id||"",anotadoPor:currentUser?.nome||"",anotadoEm:criadoEm};setForm(f=>({...f,fotos:[...(f.fotos||[]),nova]}));setFotoEditor(null);showToast?.("Cópia anotada adicionada à pendência.");}catch(err){showToast?.(err.message||"Falha ao salvar a anotação.","error");}finally{setSubindo(false);}};
  const confirmarArquivoFoto=()=>{if(!archivePhoto||!archiveReason.trim()){showToast?.("Informe o motivo do arquivamento.","error");return;}setForm(f=>({...f,fotos:f.fotos.map(item=>item.id===archivePhoto.id?{...item,status:"arquivada",motivoArquivamento:archiveReason.trim(),arquivadaEm:new Date().toISOString(),arquivadaPorId:currentUser?.id||"",arquivadaPor:currentUser?.nome||""}:item)}));setArchivePhoto(null);setArchiveReason("");};
  return <Modal title={form.id?"Editar pendência":"Novo achado da vistoria"} onClose={onClose} wide panelClass="conference-finding-modal"><div className="conference-finding-form" style={{display:"flex",flexDirection:"column",gap:10}}>
    <Sel label="Etapa do orçamento (opcional)" value={form.etapaId} onChange={v=>setForm(f=>({...f,itemOrcamentoId:"",etapaId:v}))} options={[{v:"",l:"Sem vínculo com uma etapa"},...etapasNivel1.map((etapa,index)=>({v:etapa.id,l:`${index+1}. ${etapa.nome}`}))]}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}><Sel label="Categoria" value={form.categoria} onChange={v=>setForm(f=>({...f,categoria:v}))} options={CONFERENCIA_CATEGORIAS}/><Sel label="Impacto" value={form.impacto} onChange={v=>setForm(f=>({...f,impacto:v}))} options={CONFERENCIA_IMPACTOS}/></div>
    <Inp label="Patologia / inconformidade encontrada *" multiline value={form.descricao} onChange={v=>setForm(f=>({...f,descricao:v}))} placeholder="Descreva objetivamente o que foi verificado, localização e dimensão..."/>
    <Inp label="Ajuste necessário *" multiline value={form.ajusteNecessario} onChange={v=>setForm(f=>({...f,ajusteNecessario:v}))} placeholder="Defina a correção, critério de aceite e resultado esperado..."/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8}}><Sel label="Engenheiro responsável pelo ajuste *" value={form.responsavelAjusteId} onChange={v=>setForm(f=>({...f,responsavelAjusteId:v,responsavelAjusteNome:responsaveis.find(r=>r.id===v)?.nome||""}))} options={[{v:"",l:"Selecione..."},...responsaveis.map(r=>({v:r.id,l:`${r.nome} · ${r.tipo}`}))]}/><Inp label="Prazo combinado" type="date" value={form.prazo} onChange={v=>setForm(f=>({...f,prazo:v}))}/></div>
    <div className="conference-photo-field"><p className="conference-label">Evidências fotográficas</p><div className="conference-photo-list">{(form.fotos||[]).map(foto=><div key={foto.id||foto.url} className={foto.status==="arquivada"?"conference-photo is-archived":"conference-photo"}><button onClick={()=>abrirEditor(foto)} aria-label={`Ampliar e anotar ${foto.legenda||"evidência fotográfica"}`}><img loading="lazy" src={foto.url} alt={foto.legenda||"Evidência da vistoria"}/>{foto.status==="arquivada"&&<span>Arquivada</span>}</button>{foto.status!=="arquivada"&&<button className="conference-photo__archive" onClick={()=>{setArchivePhoto(foto);setArchiveReason("");}} aria-label={`Arquivar ${foto.legenda||"evidência"}`} title="Arquivar evidência"><Ic n="trash" s={13}/></button>}{foto.status==="arquivada"&&foto.motivoArquivamento&&<small>Motivo: {foto.motivoArquivamento}</small>}</div>)}<div className="conference-photo-actions"><label className="conference-camera-button">{subindo?"Enviando...":<><Ic n="camera" s={20}/><span>Abrir câmera</span></>}<input className="conference-file-input" type="file" accept="image/*" capture="environment" onClick={e=>{e.currentTarget.value="";}} onChange={subirFoto} disabled={subindo}/></label><label className="conference-camera-button conference-gallery-button"><Ic n="file" s={20}/><span>Escolher fotos</span><input className="conference-file-input" type="file" accept="image/*" multiple onClick={e=>{e.currentTarget.value="";}} onChange={subirFoto} disabled={subindo}/></label></div></div><p className="conference-photo-help">Arquivar mantém a evidência e registra o motivo. Toque na miniatura para ampliar e marcar.</p></div>
    <div className="conference-form-actions" style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={()=>onSalvar(form)}><Ic n="check"/> Salvar achado</Btn></div>
    {fotoEditor?.carregando&&<div style={{position:"fixed",inset:0,zIndex:10020,background:"rgba(10,12,14,.82)",display:"grid",placeItems:"center",color:"white",fontSize:11,fontWeight:800}}>Abrindo evidência...</div>}
    {fotoEditor?.src&&<EditorFotoTecnica
      src={fotoEditor.src} legendaInicial={fotoEditor.foto?.legenda||"Registro da vistoria"}
      titulo="Anotar evidência da vistoria" onClose={()=>setFotoEditor(null)} onSave={salvarAnotada}
    />}
    {archivePhoto&&<Modal title="Arquivar evidência" onClose={()=>setArchivePhoto(null)}><div className="conference-confirm-flow"><p>A foto continuará vinculada à pendência e disponível no histórico.</p><Inp label="Motivo do arquivamento *" multiline value={archiveReason} onChange={setArchiveReason}/><div className="conference-confirm-actions"><Btn v="ghost" full onClick={()=>setArchivePhoto(null)}>Manter evidência</Btn><Btn v="danger" full onClick={confirmarArquivoFoto}>Arquivar evidência</Btn></div></div></Modal>}
  </div></Modal>;
}
