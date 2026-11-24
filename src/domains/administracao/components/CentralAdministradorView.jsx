import {TaskDisclosure} from "../../../design-system/patterns/TaskDisclosure.jsx";
import {RecordListPagination} from "../../../design-system/data/RecordListPagination.jsx";
import {useRecordPage} from "../../../design-system/data/useRecordPage.js";
import { contar } from "../../../design-system/copy.js";
import { FlowTabs } from "../../../features/workflow/WorkflowNavigation.jsx";
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
import { Btn, Ic, Inp, PageHero, Sel } from "../../../legacy/ui.jsx";
import { C } from "../../../legacy/palette.js";
import { GestaoAprovacoes, GestaoUsuarios, ROLES } from "../LegacySettings.jsx";
import { fmtDateFull, today } from "../../../legacy/format.js";
import { chamarIA } from "../../../api";
import BasesPrecoAdmin from "./BasesPrecoAdmin";
import NucleoRelacionalAdmin from "./NucleoRelacionalAdmin";
import FinanceiroCanonicoAdmin from "./FinanceiroCanonicoAdmin";
import ClientPortalAccess from "./ClientPortalAccess.jsx";

export default function CentralAdministrador({data,update,showToast,currentUser}){
  const {cols,isDesktop}=useBreakpoint();
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
  const auditPage=useRecordPage('admin_central',filtrados,JSON.stringify([usuario,obra,tipo,inicio,fim,busca]),'audit');
  const activeFilters=[usuario!=="todos",obra!=="todas",tipo!=="todos",inicio,fim].filter(Boolean).length;
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
  if(currentUser?.role!=="admin")return <div style={{padding:"var(--arcd-space-8)",textAlign:"center",color:C.red}}>Acesso exclusivo da administração.</div>;
  const indicadores=(<div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:"var(--arcd-space-2)"}}>{[["Alterações hoje",metricas.hoje,C.blue],["Últimos 7 dias",metricas.semana,C.purple],["Operadores com alterações",metricas.usuarios,C.green],["Exclusões/cancelamentos",metricas.exclusoes,metricas.exclusoes?C.red:C.muted]].map(([l,v,c])=><div key={l} style={{background:"var(--arcd-surface-card)",border:`var(--arcd-border-width) solid var(--arcd-border-default)`,borderTop:`3px solid ${c}`,borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-3)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>{l}</p><p style={{fontSize:"var(--arcd-type-section-title)",fontWeight:600,color:c,marginTop:"var(--arcd-space-1)"}}>{v}</p></div>)}</div>);
  const filtros=(
        <div style={{display:"grid",gridTemplateColumns:cols(1,3,3),gap:"var(--arcd-space-2)"}}>
          <Sel label="Usuário" value={usuario} onChange={setUsuario} options={[{v:"todos",l:"Todos os usuários"},...(data.usuarios||[]).map(u=>({v:u.id,l:u.nome}))]}/>
          <Sel label="Obra" value={obra} onChange={setObra} options={[{v:"todas",l:"Todas as obras"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
          <Sel label="Tipo de evento" value={tipo} onChange={setTipo} options={[{v:"todos",l:"Todos os tipos"},...tipos.map(t=>({v:t,l:t}))]}/>
          <Inp label="Desde" type="date" value={inicio} onChange={setInicio}/>
          <Inp label="Até" type="date" value={fim} onChange={setFim}/>
        </div>
  );
  return <div className="anim" style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
    <PageHero
      title="Central do Administrador"
      description="Consulte membros, acessos de clientes, aprovações e auditoria."
    />
    <FlowTabs label="Áreas da administração" active={secao} onChange={setSecao} steps={[
      {id:"usuarios",label:"Usuários e permissões",description:"Confira o perfil e o escopo do operador antes de conceder acesso."},
      {id:"clientes",label:"Acessos de clientes",description:"Cadastre login, senha e vínculo à obra para o portal do cliente."},
      {id:"aprovacoes",label:"Aprovações",description:"Acompanhe as decisões que aguardam autorização."},
      {id:"auditoria",label:"Auditoria e resumo por IA",description:"Consulte quem alterou cada registro e sua origem."},
    ]} tools={[{id:"bases",label:"Bases de preço"},{id:"nucleo",label:"Núcleo relacional"},{id:"financeiro",label:"Motor financeiro"}]} toolsLabel="Referências e ferramentas técnicas"/>
    {secao==="usuarios"?<GestaoUsuarios data={data} update={update} showToast={showToast} currentUser={currentUser} pageId="admin_central"/>
    :secao==="clientes"?<ClientPortalAccess data={data} currentUser={currentUser}/>
    :secao==="aprovacoes"?<GestaoAprovacoes data={data} update={update} showToast={showToast} currentUser={currentUser}/>
    :secao==="bases"?<BasesPrecoAdmin currentUser={currentUser} data={data} update={update}/>
    :secao==="nucleo"?<NucleoRelacionalAdmin currentUser={currentUser}/>
    :secao==="financeiro"?<FinanceiroCanonicoAdmin currentUser={currentUser}/>
    :<>
      <Inp label="Pesquisar" value={busca} onChange={setBusca} placeholder="Ação, usuário ou obra"/>
      {isDesktop?filtros:<TaskDisclosure summary={activeFilters?`Filtros (${activeFilters})`:"Filtros"}>{filtros}</TaskDisclosure>}
      <TaskDisclosure summary="Indicadores e ferramentas da auditoria" defaultOpen={isDesktop}>
        {indicadores}
        <div className="flex flex-wrap gap-2">
          <Btn onClick={gerarResumo} disabled={analisando}><Ic n="ia"/> {analisando?"Analisando...":"Gerar resumo por IA"}</Btn>
          <Btn v="ghost" onClick={exportar}><Ic n="download"/> Exportar auditoria</Btn>
        </div>
      </TaskDisclosure>
      <RecordListPagination pagination={auditPage} label="alterações"/>
      {resumoIA&&<div style={{background:`${C.purple}08`,border:`var(--arcd-border-width) solid ${C.purple}44`,borderLeft:`var(--arcd-border-width) solid ${C.purple}`,borderRadius:"var(--arcd-box-radius)",padding:"var(--arcd-space-3)"}}><div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)"}}><b style={{fontSize:"var(--arcd-type-label)",color:C.purple}}>RESUMO EXECUTIVO POR IA</b><Btn size="sm" v="ghost" onClick={()=>navigator.clipboard.writeText(resumoIA)}>Copiar</Btn></div><div style={{whiteSpace:"pre-wrap",fontSize:"var(--arcd-type-label)",lineHeight:1.65,color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-2)"}}>{resumoIA}</div><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-2)"}}>Resumo de apoio gerencial. Confirme decisões sensíveis nos registros detalhados abaixo.</p></div>}
      <div style={{background:"var(--arcd-surface-card)",border:`var(--arcd-border-width) solid var(--arcd-border-default)`,borderRadius:"var(--arcd-box-radius)",overflow:"hidden"}}>{auditPage.rows.map((e,i)=>{const u=usuariosPorId.get(e._operadorId);const destrutivo=/remove|exclu|cancel|delete/i.test(`${e.type} ${e.message}`);return <div key={e._id} style={{display:"grid",gridTemplateColumns:isDesktop?"38px minmax(0,1fr) auto":"minmax(0,1fr)",gap:"var(--arcd-space-2)",padding:"var(--arcd-space-3) var(--arcd-space-3)",borderTop:i?`var(--arcd-border-width) solid var(--arcd-border-subtle)`:"none",alignItems:"start"}}>{isDesktop&&<span style={{width:32,height:32,borderRadius:"var(--arcd-radius-pill)",display:"grid",placeItems:"center",background:`${destrutivo?C.red:C.blue}12`,color:destrutivo?C.red:C.blue,fontSize:"var(--arcd-type-caption)",fontWeight:600}}>{e._operador.split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span>}<div style={{minWidth:0}}><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)",lineHeight:1.45}}>{e.message||"Alteração sem descrição"}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}><b style={{color:"var(--arcd-text-primary)"}}>{e._operador}</b>{u?.role?` · ${ROLES.find(r=>r.v===u.role)?.l||u.role}`:""}{e._obra?` · ${e._obra}`:""} · {e.type||"alteração"}</p></div><div style={{textAlign:isDesktop?"right":"left",whiteSpace:"nowrap"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600}}>{e._dia?fmtDateFull(e._dia):"-"}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{e._at?new Date(e._at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}</p></div></div>})}{!filtrados.length&&<p style={{padding:"var(--arcd-space-8)",textAlign:"center",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Nenhuma alteração encontrada com estes filtros.</p>}</div>
    </>}
  </div>;
}
