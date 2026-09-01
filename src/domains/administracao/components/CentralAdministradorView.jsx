// ===================================================================
// CentralAdministradorView — orquestrador da Central do Administrador,
// extraído de LegacyApp.jsx
//
// Extraído verbatim de src/LegacyApp.jsx em 2026-08-16, mesmo padrão dos
// módulos anteriores. GestaoUsuarios e GestaoAprovacoes continuam em
// LegacyApp.jsx (exportados) porque GestaoUsuarios também é usado pela
// tela Config, fora deste cluster - não são exclusivos daqui. Mesma
// camada de dados, sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #6.
// ===================================================================

import { useMemo, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  Badge, Btn, C, GestaoAprovacoes, GestaoUsuarios, Ic, Inp, PageHero, ROLES, Sel,
  fmtDateFull, today,
} from "../../../LegacyApp";
import { chamarIA } from "../../../api";
import BasesPrecoAdmin from "./BasesPrecoAdmin";
import NucleoRelacionalAdmin from "./NucleoRelacionalAdmin";

export default function CentralAdministrador({data,update,showToast,currentUser}){
  const {cols}=useBreakpoint();
  const [secao,setSecao]=useState("auditoria");
  const [usuario,setUsuario]=useState("todos");
  const [obra,setObra]=useState("todas");
  const [tipo,setTipo]=useState("todos");
  const [inicio,setInicio]=useState("");
  const [fim,setFim]=useState("");
  const [busca,setBusca]=useState("");
  const [resumoIA,setResumoIA]=useState("");
  const [analisando,setAnalisando]=useState(false);
  const usuariosPorId=useMemo(()=>new Map((data.usuarios||[]).map(u=>[u.id,u])),[data.usuarios]);
  const obrasPorId=useMemo(()=>new Map((data.obras||[]).map(o=>[o.id,o])),[data.obras]);
  const eventos=useMemo(()=>[...(data.changeLog||[])].map((e,i)=>{
    const at=e.at||`${e.date||""}T00:00:00`;
    const operadorId=e.operadorId||e.userId||"";
    return {...e,_id:e.id||`log-${i}`,_at:at,_dia:String(at).slice(0,10),_operadorId:operadorId,_operador:e.operador||usuariosPorId.get(operadorId)?.nome||"Sistema/registro legado",_obra:e.obraId?obrasPorId.get(e.obraId)?.name||"Obra removida":""};
  }).sort((a,b)=>String(b._at).localeCompare(String(a._at))),[data.changeLog,usuariosPorId,obrasPorId]);
  const filtrados=useMemo(()=>eventos.filter(e=>{
    if(usuario!=="todos"&&e._operadorId!==usuario)return false;
    if(obra!=="todas"&&e.obraId!==obra)return false;
    if(tipo!=="todos"&&e.type!==tipo)return false;
    if(inicio&&e._dia<inicio)return false;if(fim&&e._dia>fim)return false;
    const q=busca.trim().toLocaleLowerCase("pt-BR");return !q||`${e.message||""} ${e._operador} ${e._obra} ${e.type||""}`.toLocaleLowerCase("pt-BR").includes(q);
  }),[eventos,usuario,obra,tipo,inicio,fim,busca]);
  const tipos=useMemo(()=>[...new Set(eventos.map(e=>e.type).filter(Boolean))].sort(),[eventos]);
  const hojeIso=today();
  const ultimos7=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const metricas=useMemo(()=>({hoje:eventos.filter(e=>e._dia===hojeIso).length,semana:eventos.filter(e=>e._dia>=ultimos7).length,usuarios:new Set(eventos.filter(e=>e._dia>=ultimos7).map(e=>e._operadorId).filter(Boolean)).size,exclusoes:eventos.filter(e=>e._dia>=ultimos7&&/remove|exclu|cancel|delete/i.test(`${e.type} ${e.message}`)).length}),[eventos,hojeIso,ultimos7]);
  const gerarResumo=async()=>{
    setAnalisando(true);
    const amostra=filtrados.slice(0,120).map(e=>({quando:e._at,usuario:e._operador,obra:e._obra||"Geral",tipo:e.type||"alteracao",acao:e.message||"Alteração sem descrição"}));
    const contagem={};amostra.forEach(e=>{contagem[e.usuario]=(contagem[e.usuario]||0)+1;});
    const fallback=[`Resumo executivo de ${filtrados.length} alteração(ões) no período filtrado.`,`Usuários mais ativos: ${Object.entries(contagem).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,q])=>`${n} (${q})`).join(", ")||"sem autoria identificada"}.`,`Foram identificadas ${filtrados.filter(e=>/remove|exclu|cancel|delete/i.test(`${e.type} ${e.message}`)).length} ação(ões) destrutiva(s) ou de cancelamento.`,`Recomendação: revisar alterações sensíveis, registros sem autoria e eventos de obras críticas antes do fechamento operacional.`].join("\n");
    try{const json=await chamarIA({modulo:"administracao",question:"Produza um resumo executivo curto da auditoria: principais mudanças, usuários mais ativos, riscos, exclusões/cancelamentos, anomalias e ações que o administrador deve revisar. Não invente fatos.",context:{total:filtrados.length,eventos:amostra}});setResumoIA(json.ok&&json?.answer?json.answer:fallback);}catch{setResumoIA(fallback);}finally{setAnalisando(false);}
  };
  const exportar=()=>{const linhas=[["Data/hora","Usuário","Perfil","Obra","Tipo","Alteração"],...filtrados.map(e=>[e._at,e._operador,usuariosPorId.get(e._operadorId)?.role||"",e._obra,e.type||"",e.message||""])];const csv=linhas.map(l=>l.map(v=>`"${String(v||"").replaceAll('"','""')}"`).join(";")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download=`auditoria-arcd-${today()}.csv`;a.click();URL.revokeObjectURL(a.href);};
  if(currentUser?.role!=="admin")return <div style={{padding:30,textAlign:"center",color:C.red}}>Acesso exclusivo da administração.</div>;
  return <div className="anim" style={{display:"flex",flexDirection:"column",gap:12}}>
    <PageHero
      eyebrow="Governança · segurança · operação"
      title="Central do Administrador"
      description="Auditoria de alterações, inteligência gerencial e controle integral dos operadores."
      actions={<Badge color={C.green}>ACESSO TOTAL</Badge>}
    />
    <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:8}}>{[["Alterações hoje",metricas.hoje,C.blue],["Últimos 7 dias",metricas.semana,C.purple],["Usuários ativos",metricas.usuarios,C.green],["Exclusões/cancelamentos",metricas.exclusoes,metricas.exclusoes?C.red:C.muted]].map(([l,v,c])=><div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${c}`,borderRadius:9,padding:11}}><p style={{fontSize:8.5,fontWeight:850,color:C.muted,textTransform:"uppercase"}}>{l}</p><p style={{fontSize:21,fontWeight:900,color:c,marginTop:4}}>{v}</p></div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:7}}><Btn v={secao==="auditoria"?"primary":"ghost"} onClick={()=>setSecao("auditoria")}><Ic n="clipboard"/> Auditoria e resumo por IA</Btn><Btn v={secao==="usuarios"?"primary":"ghost"} onClick={()=>setSecao("usuarios")}><Ic n="users"/> Usuários e permissões</Btn><Btn v={secao==="aprovacoes"?"primary":"ghost"} onClick={()=>setSecao("aprovacoes")}><Ic n="check"/> Aprovações</Btn><Btn v={secao==="bases"?"primary":"ghost"} onClick={()=>setSecao("bases")}><Ic n="fileText"/> Bases de preço</Btn><Btn v={secao==="nucleo"?"primary":"ghost"} onClick={()=>setSecao("nucleo")}><Ic n="refresh"/> Núcleo relacional</Btn></div>
    {secao==="usuarios"?<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}><div style={{background:`${C.yellow}0B`,border:`1px solid ${C.yellow}44`,borderRadius:7,padding:"9px 11px",marginBottom:12,fontSize:10.5,color:C.muted}}>Nesta tela o administrador pode criar operadores, editar perfil e e-mail, restringir por obra, escolher telas individualmente, definir limite comercial, ativar/inativar, trocar PIN, ativar login por e-mail e redefinir senha.</div><GestaoUsuarios data={data} update={update} showToast={showToast} currentUser={currentUser}/></div>
    :secao==="aprovacoes"?<GestaoAprovacoes data={data} update={update} showToast={showToast} currentUser={currentUser}/>
    :secao==="bases"?<BasesPrecoAdmin currentUser={currentUser} data={data} update={update}/>
    :secao==="nucleo"?<NucleoRelacionalAdmin currentUser={currentUser}/>
    :<>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12}}><div style={{display:"grid",gridTemplateColumns:cols(1,3,3),gap:7}}><Sel label="Usuário" value={usuario} onChange={setUsuario} options={[{v:"todos",l:"Todos os usuários"},...(data.usuarios||[]).map(u=>({v:u.id,l:u.nome}))]}/><Sel label="Obra" value={obra} onChange={setObra} options={[{v:"todas",l:"Todas as obras"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/><Sel label="Tipo de evento" value={tipo} onChange={setTipo} options={[{v:"todos",l:"Todos os tipos"},...tipos.map(t=>({v:t,l:t}))]}/><Inp label="Desde" type="date" value={inicio} onChange={setInicio}/><Inp label="Até" type="date" value={fim} onChange={setFim}/><Inp label="Pesquisar" value={busca} onChange={setBusca} placeholder="Ação, usuário ou obra"/></div><div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}><Btn onClick={gerarResumo} disabled={analisando}><Ic n="ia"/> {analisando?"Analisando...":"Gerar resumo por IA"}</Btn><Btn v="ghost" onClick={exportar}><Ic n="download"/> Exportar auditoria</Btn><span style={{fontSize:10,color:C.muted,alignSelf:"center"}}>{filtrados.length} registro(s) encontrados</span></div></div>
      {resumoIA&&<div style={{background:`${C.purple}08`,border:`1px solid ${C.purple}44`,borderLeft:`4px solid ${C.purple}`,borderRadius:10,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:11,color:C.purple}}>RESUMO EXECUTIVO POR IA</b><Btn size="sm" v="ghost" onClick={()=>navigator.clipboard.writeText(resumoIA)}>Copiar</Btn></div><div style={{whiteSpace:"pre-wrap",fontSize:11.5,lineHeight:1.65,color:C.text,marginTop:8}}>{resumoIA}</div><p style={{fontSize:8.5,color:C.muted,marginTop:8}}>Resumo de apoio gerencial. Confirme decisões sensíveis nos registros detalhados abaixo.</p></div>}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>{filtrados.slice(0,500).map((e,i)=>{const u=usuariosPorId.get(e._operadorId);const destrutivo=/remove|exclu|cancel|delete/i.test(`${e.type} ${e.message}`);return <div key={e._id} style={{display:"grid",gridTemplateColumns:"38px minmax(0,1fr) auto",gap:9,padding:"11px 12px",borderTop:i?`1px solid ${C.line}`:"none",alignItems:"start"}}><span style={{width:32,height:32,borderRadius:99,display:"grid",placeItems:"center",background:`${destrutivo?C.red:C.blue}12`,color:destrutivo?C.red:C.blue,fontSize:9,fontWeight:900}}>{e._operador.split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><div style={{minWidth:0}}><p style={{fontSize:11.5,color:C.text,lineHeight:1.45}}>{e.message||"Alteração sem descrição"}</p><p style={{fontSize:9.5,color:C.muted,marginTop:3}}><b style={{color:C.text}}>{e._operador}</b>{u?.role?` · ${ROLES.find(r=>r.v===u.role)?.l||u.role}`:""}{e._obra?` · ${e._obra}`:""} · {e.type||"alteração"}</p></div><div style={{textAlign:"right",whiteSpace:"nowrap"}}><p style={{fontSize:9.5,fontWeight:750}}>{e._dia?fmtDateFull(e._dia):"-"}</p><p style={{fontSize:9,color:C.muted,marginTop:2}}>{e._at?new Date(e._at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}</p></div></div>})}{!filtrados.length&&<p style={{padding:30,textAlign:"center",fontSize:11,color:C.muted}}>Nenhuma alteração encontrada com estes filtros.</p>}{filtrados.length>500&&<p style={{padding:10,textAlign:"center",fontSize:9.5,color:C.muted}}>Exibindo 500 registros. Use os filtros ou exporte para consultar todos.</p>}</div>
    </>}
  </div>;
}
