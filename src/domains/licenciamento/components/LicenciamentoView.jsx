// ===================================================================
// LicenciamentoView — tela de Licenciamento e liberação de obra,
// extraída de src/LegacyApp.jsx em 2026-08-26 (Onda 7 do raio-X). Mesmo
// padrão já usado para Diário de Obra/Estoque/Compras/Orçamento/
// Terceirizados/Equipamentos/RH: mesmo corpo, mesma lógica, verbatim.
// O catálogo de licenças (LICENCAS, LIC_STATUS etc.) veio junto - seu
// único consumidor era esta tela. LIC_SIMPLIFICADA_PRE/DOCS e
// CONDOMINIOS_PADRAO ficaram em LegacyApp.jsx porque também alimentam a
// criação padrão de uma obra nova, fora do escopo desta tela.
// ===================================================================

import { useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { enviarArquivoOneDrive } from "../../../api";
import {
  Badge, Btn, C, Ic, Inp, LICENCAS, LIC_STATUS, LIC_TERRAS_ALPHA_VERIFICACAO,
  Modal, PageHero, Sel, escapeHtml, fmtDate, licStatusInfo, licencaPorId,
  preRequisitosOk, progressoChecklist, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";

// ============================================================================
//  EQUIPAMENTOS LOCADOS
//  Frota própria + de terceiros, locação por obra com desconto ao cliente,
//  manutenção, transferência entre obras e relatório mensal de lucro.
// ============================================================================
export default function Licenciamento({ data, update, showToast, obraIdFixo="", currentUser=null, dispatchCommand=null }) {
  const { formGrid } = useBreakpoint();
  const [obraSel,setObraSel]=useState(obraIdFixo);
  const [itemModal,setItemModal]=useState(null);
  const [anexandoId,setAnexandoId]=useState("");
  const [gestaoCondo,setGestaoCondo]=useState(false);
  const condoVazio={id:"",nome:"",cidade:"",uf:"PE",cep:"",endereco:"",contato:"",telefone:"",email:"",checklistTipo:"generico",atendimento:"",observacoes:"",ativo:true};
  const [condForm,setCondForm]=useState(condoVazio);
  const condominios=(data.condominios||[]).filter(x=>x.ativo!==false);
  const obrasAtivas=(data.obras||[]).filter(o=>o.status!=="done");
  const obraId=obraIdFixo||obraSel||obrasAtivas[0]?.id||(data.obras||[])[0]?.id||"";
  const obra=(data.obras||[]).find(o=>o.id===obraId);
  const condominio=condominios.find(x=>x.id===obra?.condominioId);
  const tipoSugerido=condominio?.checklistTipo==="terras_alpha_caruaru"?"terras_alpha_caruaru":"simplificada";
  const check=(data.licencas||[]).find(l=>l.obraId===obraId)||{id:"",obraId,tipo:tipoSugerido,pre:{},itens:{},verificacao:{},modoAprovacao:"nova",protocolo:"",dataProtocolo:"",dataEmissao:"",validade:"",numeroAprovacao:"",dataAprovacao:"",observacoes:""};
  const lic=licencaPorId(check.tipo);
  const prog=progressoChecklist(check,lic.docs);
  const pre=preRequisitosOk(check,lic.pre);
  const grupos=[...new Set(lic.docs.map(d=>d.grupo||"Outros"))];
  const verificacoes=check.tipo==="terras_alpha_caruaru"?LIC_TERRAS_ALPHA_VERIFICACAO:[];
  const verificadas=verificacoes.filter(v=>check.verificacao?.[v.id]?.ok).length;

  const salvar=async(mudanca,extras={})=>{
    if(!dispatchCommand){showToast?.("O checklist de licenciamento exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.licencas||[]).find(l=>l.obraId===obraId);
      return {
        type:OPERATIONAL_COMMAND.LICENSE_CHECKLIST_SAVED,
        idempotencyKey:`licenca-${obraId}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{license:{...vigente,...check,...mudanca,id:vigente?.id||check.id||uid(),obraId}},
      };
    });
    if(!result?.ok){showToast?.(result?.reason||"Não foi possível salvar o checklist de licenciamento.","error");return;}
    if(Object.keys(extras).length)update({...data,...extras});
  };
  const setItem=(docId,campos,extras={})=>salvar({itens:{...check.itens,[docId]:{...(check.itens?.[docId]||{}),...campos}}},extras);
  const ciclarStatus=docId=>{const ordem=["pendente","em_andamento","entregue","aprovado"];const atual=check.itens?.[docId]?.status||"pendente";const prox=atual==="na"?"pendente":ordem[(ordem.indexOf(atual)+1)%ordem.length];setItem(docId,{status:prox,data:["entregue","aprovado"].includes(prox)?today():""});};

  const vincularCondominio=id=>{
    const condo=condominios.find(x=>x.id===id);
    const tipo=condo?.checklistTipo==="terras_alpha_caruaru"?"terras_alpha_caruaru":"simplificada";
    const obras=(data.obras||[]).map(o=>o.id===obraId?{...o,condominioId:id,condominioNome:condo?.nome||""}:o);
    salvar({tipo},{obras});
    showToast?.(condo?`${condo.nome} vinculado à obra.`:"Obra marcada como fora de condomínio.");
  };

  const salvarCondominio=async()=>{
    if(!condForm.nome.trim()){showToast?.("Informe o nome do condomínio.","error");return;}
    if(!dispatchCommand){showToast?.("O cadastro de condomínio exige conexão com o servidor.","error");return;}
    const id=condForm.id||uid();
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.condominios||[]).find(x=>x.id===id);
      return {
        type:OPERATIONAL_COMMAND.CONDOMINIUM_SAVED,
        idempotencyKey:`condominio-${id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{condominium:{...vigente,...condForm,id,nome:condForm.nome.trim()}},
      };
    });
    if(!result?.ok){showToast?.(result?.reason||"Não foi possível salvar o condomínio.","error");return;}
    setCondForm(condoVazio);showToast?.("Condomínio salvo.");
  };

  const anexarDocumento=async(doc,file,grupo)=>{
    if(!file||!obra)return;
    if(file.size>6*1024*1024){showToast?.("O arquivo deve ter no máximo 6 MB.","error");return;}
    setAnexandoId(doc.id);
    try{
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      const resp=await enviarArquivoOneDrive({dataUrl,obraName:obra.name,driveId:obra.oneDriveDriveId,folderId:obra.oneDriveFolderId,folders:obra.oneDriveFolders,category:"licenciamento",subfolder:`${lic.orgao}/${grupo}`,fileName:file.name});
      if(!resp.ok&&!resp.url)throw new Error(resp.error||"Falha no envio ao OneDrive.");
      const anexo={id:resp.item?.id||uid(),nome:resp.item?.name||file.name,url:resp.url||resp.item?.webUrl||"",path:resp.path||"",tipo:file.type,tamanho:file.size,enviadoEm:new Date().toISOString()};
      const documentos=[...(check.itens?.[doc.id]?.documentos||[]),anexo];
      const obras=(data.obras||[]).map(o=>o.id===obraId?{...o,oneDriveDriveId:resp.workspace?.driveId||o.oneDriveDriveId,oneDriveFolderId:resp.workspace?.folderId||o.oneDriveFolderId,oneDriveFolders:resp.workspace?.folders||o.oneDriveFolders,oneDriveUrl:resp.workspace?.webUrl||o.oneDriveUrl}:o);
      setItem(doc.id,{documentos,status:check.itens?.[doc.id]?.status==="pendente"?"em_andamento":(check.itens?.[doc.id]?.status||"em_andamento")},{obras});
      showToast?.("Documento anexado à etapa e salvo no OneDrive.");
    }catch(e){showToast?.(e.message||"Não foi possível anexar o documento.","error");}finally{setAnexandoId("");}
  };

  const removerAnexo=(docId,anexoId)=>{if(!window.confirm("Remover este link do dossiê? O arquivo continuará preservado no OneDrive."))return;const documentos=(check.itens?.[docId]?.documentos||[]).filter(a=>a.id!==anexoId);setItem(docId,{documentos});setItemModal(m=>m&&m.docId===docId?{...m,documentos}:m);};

  const gerarDossie=()=>{
    const link=a=>{try{return new URL(a.url,window.location.origin).href;}catch{return a.url||"";}};
    const blocos=grupos.map(g=>`<section><h2>${escapeHtml(g)}</h2>${lic.docs.filter(d=>(d.grupo||"Outros")===g).map(d=>{const est=check.itens?.[d.id]||{},si=licStatusInfo(est.status||"pendente"),docs=est.documentos||[];return `<article><div><b>${escapeHtml(d.nome)}</b><small>${escapeHtml(si.l)}${est.data?` · ${escapeHtml(fmtDate(est.data))}`:""}${est.obs?` · ${escapeHtml(est.obs)}`:""}</small></div><div class="links">${docs.length?docs.map((a,i)=>`<a href="${escapeHtml(link(a))}" target="_blank">${i+1}. ${escapeHtml(a.nome||"Documento")}</a>`).join(""):"<span>Sem anexo</span>"}</div></article>`;}).join("")}</section>`).join("");
    const verificacaoHtml=verificacoes.length?`<section><h2>Verificação e liberação</h2>${verificacoes.map(v=>`<article><div><b>${check.verificacao?.[v.id]?.ok?"✓":"○"} ${escapeHtml(v.nome)}</b><small>${check.verificacao?.[v.id]?.data?escapeHtml(fmtDate(check.verificacao[v.id].data)):""}</small></div></article>`).join("")}</section>`:"";
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Dossiê de licenciamento · ${escapeHtml(obra.name)}</title><style>:root{--ouro:#d4af37;--grafite:#121212;--areia:#f5f3ee;--cinza:#bfbfbf}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:var(--grafite);margin:0;background:#fff}header{padding:30px 36px;background:var(--grafite);color:#fff;border-bottom:6px solid var(--ouro)}header p{margin:5px 0;color:#ddd}main{padding:26px 36px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:22px}.summary div{border:1px solid #ddd;padding:10px}.summary small,article small{display:block;color:#666;margin-top:4px}h1{margin:0;font-size:24px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.8px;border-bottom:2px solid var(--ouro);padding-bottom:6px;margin-top:22px}article{display:grid;grid-template-columns:minmax(0,1fr) 38%;gap:18px;padding:10px 6px;border-bottom:1px solid #e6e2d9;font-size:11px}.links{display:flex;flex-direction:column;gap:3px}.links a{color:#0d47a1;text-decoration:none}.links span{color:#999}.print{position:fixed;right:16px;top:16px;border:0;background:var(--ouro);color:#111;padding:10px 14px;font-weight:bold;cursor:pointer}@media print{.print{display:none}article{break-inside:avoid}}@media(max-width:700px){.summary{grid-template-columns:1fr 1fr}article{grid-template-columns:1fr}}</style></head><body><button class="print" onclick="print()">Imprimir / salvar PDF</button><header><h1>Dossiê de licenciamento</h1><p>${escapeHtml(data.config?.companyName||"ARCD")} · ${escapeHtml(obra.name)}</p><p>${escapeHtml(condominio?.nome||"Sem condomínio informado")}${obra.quadra||obra.lote?` · Quadra ${escapeHtml(obra.quadra||"-")} · Lote ${escapeHtml(obra.lote||"-")}`:""}</p></header><main><div class="summary"><div><b>${prog.pct.toFixed(0)}%</b><small>documentação</small></div><div><b>${prog.concluidos}/${prog.aplicaveis}</b><small>itens concluídos</small></div><div><b>${verificadas}/${verificacoes.length||"-"}</b><small>verificações</small></div><div><b>${escapeHtml(check.protocolo||"-")}</b><small>protocolo</small></div></div><p style="font-size:11px;color:#666">Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}. Os links abaixo dão acesso às evidências arquivadas no OneDrive conforme as permissões do usuário.</p>${blocos}${verificacaoHtml}</main></body></html>`;
    const w=window.open("","_blank");if(!w){showToast?.("Permita pop-ups para gerar o dossiê.","error");return;}w.opener=null;w.document.write(html);w.document.close();
  };

  if(!obra)return <div style={{padding:24,textAlign:"center",color:C.muted,fontSize:12.5}}>Cadastre uma obra para montar o checklist de licenciamento.</div>;

  return <div className="anim" style={{display:"flex",flexDirection:"column",gap:12}}>
    <PageHero
      eyebrow="Governança documental"
      title="Licenciamento da obra"
      description="Condomínio → documentação → aprovação → Prefeitura → liberação"
      actions={<><Btn v="ghost" onClick={()=>setGestaoCondo(true)}><Ic n="building"/> Condomínios</Btn><Btn onClick={gerarDossie}><Ic n="fileText"/> Gerar dossiê</Btn></>}
    />

    <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>{obraIdFixo?<Inp label="Obra" value={obra.name} onChange={()=>{}} disabled/>:<Sel label="Obra" value={obraId} onChange={setObraSel} options={(data.obras||[]).map(o=>({v:o.id,l:o.name}))}/>}<Sel label="Condomínio da obra" value={obra.condominioId||""} onChange={vincularCondominio} options={[{v:"",l:"Fora de condomínio / ainda não informado"},...condominios.map(c=>({v:c.id,l:`${c.nome}${c.cidade?` · ${c.cidade}/${c.uf}`:""}`}))]}/></div>

    {!condominio&&<div style={{padding:"10px 12px",border:`1px solid ${C.orange}66`,borderRadius:9,background:`${C.orange}0B`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><p style={{fontSize:10.5,color:C.orange}}><b>Condomínio não definido.</b> Selecione acima ou cadastre um novo para carregar as exigências corretas.</p><Btn size="sm" v="ghost" onClick={()=>setGestaoCondo(true)}>Cadastrar</Btn></div>}

    {condominio&&<div style={{padding:"11px 13px",border:`1px solid ${C.blue}44`,borderRadius:10,background:`${C.blue}08`,display:"grid",gridTemplateColumns:formGrid(2),gap:8}}><div><b style={{fontSize:12,color:C.blue}}>{condominio.nome}</b><p style={{fontSize:9.5,color:C.muted,marginTop:3}}>{condominio.endereco||`${condominio.cidade}/${condominio.uf}`}</p></div><div><p style={{fontSize:9.5,color:C.subtle,lineHeight:1.5}}>{condominio.atendimento||"Atendimento não informado."}</p>{condominio.email&&<a href={`mailto:${condominio.email}`} style={{fontSize:9.5,color:C.blue}}>{condominio.email}</a>}</div></div>}

    <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}><Sel label="Procedimento aplicável" value={check.tipo} onChange={v=>salvar({tipo:v})} options={LICENCAS.map(l=>({v:l.id,l:l.nome}))}/><div><p style={{fontSize:9.5,fontWeight:800,color:C.muted,marginBottom:5,textTransform:"uppercase"}}>Situação inicial</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:`1px solid ${C.border}`,borderRadius:7,overflow:"hidden"}}>{[["nova","Novo processo"],["ja_aprovada","Obra já aprovada"]].map(([v,l])=><button key={v} onClick={()=>salvar({modoAprovacao:v})} style={{border:0,padding:"9px 7px",cursor:"pointer",fontSize:10,fontWeight:800,background:check.modoAprovacao===v?C.yellow:C.card,color:check.modoAprovacao===v?"#111":C.muted}}>{l}</button>)}</div></div></div>

    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}><p style={{fontSize:9.5,fontWeight:900,color:C.blue,textTransform:"uppercase",letterSpacing:.8}}>{lic.orgao}</p><p style={{fontSize:14,fontWeight:850,color:C.text,marginTop:2}}>{lic.nome}</p><p style={{fontSize:10.5,color:C.muted,marginTop:4,lineHeight:1.5}}>{lic.finalidade}</p><p style={{fontSize:10,color:C.subtle,marginTop:4}}>Prazo: <b>{lic.prazo}</b></p></div>

    <div style={{background:C.card,border:`1.5px solid ${prog.pronto?C.green:C.border}`,borderRadius:10,padding:"12px 14px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}><p style={{fontSize:12,fontWeight:800,color:C.text}}>{prog.concluidos} de {prog.aplicaveis} documentos</p><b style={{fontSize:16,color:prog.pronto?C.green:C.yellowD}}>{prog.pct.toFixed(0)}%</b></div><div style={{height:8,background:C.line,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${prog.pct}%`,background:prog.pronto?C.green:C.yellowD}}/></div><div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:C.muted}}><span>Pendentes <b>{prog.pendentes}</b></span><span>Aprovados <b style={{color:C.green}}>{prog.aprovados}</b></span><span>Anexos <b style={{color:C.blue}}>{Object.values(check.itens||{}).reduce((s,x)=>s+(x.documentos?.length||0),0)}</b></span></div></div>

    <div style={{background:pre.ok?`${C.green}09`:`${C.orange}0B`,border:`1px solid ${pre.ok?C.green+"55":C.orange+"66"}`,borderRadius:10,padding:"12px 14px"}}><p style={{fontSize:11.5,fontWeight:800,color:pre.ok?C.green:C.orange,marginBottom:7}}>Condições de entrada {pre.marcados}/{pre.total}</p><div style={{display:"flex",flexDirection:"column",gap:6}}>{lic.pre.map(p=>{const marcado=!!check.pre?.[p.id];return <label key={p.id} style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer"}}><input type="checkbox" checked={marcado} onChange={()=>salvar({pre:{...check.pre,[p.id]:!marcado}})} style={{width:16,height:16,accentColor:C.green,marginTop:1}}/><span style={{fontSize:10.5,color:marcado?C.text:C.muted,lineHeight:1.45}}>{p.texto}</span></label>;})}</div></div>

    {grupos.map(g=><div key={g}><p style={{fontSize:9.5,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:6,padding:"0 2px"}}>{g}</p><div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,overflow:"hidden"}}>{lic.docs.filter(d=>(d.grupo||"Outros")===g).map((d,i)=>{const est=check.itens?.[d.id]||{},si=licStatusInfo(est.status||"pendente"),na=est.status==="na",docs=est.documentos||[];return <div key={d.id} style={{padding:"10px 12px",borderTop:i?`1px solid ${C.line}`:"none",opacity:na?.55:1}}><div style={{display:"grid",gridTemplateColumns:"auto minmax(0,1fr) auto",gap:10,alignItems:"start"}}><button onClick={()=>ciclarStatus(d.id)} title="Avançar situação" style={{border:`1.5px solid ${si.cor}`,background:`${si.cor}18`,color:si.cor,borderRadius:99,padding:"3px 8px",fontSize:8.5,fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"}}>{si.l}</button><div style={{minWidth:0}}><p style={{fontSize:11.5,fontWeight:750,color:C.text,lineHeight:1.35,textDecoration:na?"line-through":"none"}}>{d.nome}</p>{d.cond&&<p style={{fontSize:9,color:C.orange,marginTop:2}}>{d.cond}</p>}{d.obs&&<p style={{fontSize:9,color:C.muted,marginTop:2,lineHeight:1.4}}>{d.obs}</p>}<div style={{display:"flex",alignItems:"center",gap:5,marginTop:5,flexWrap:"wrap"}}>{!na&&<select value={est.responsavelId||""} onChange={e=>setItem(d.id,{responsavelId:e.target.value})} style={{border:0,background:"transparent",fontSize:9,color:est.responsavelId?C.blue:C.orange,fontWeight:750,outline:"none"}}><option value="">Sem responsável</option>{(data.usuarios||[]).filter(u=>u.active!==false&&u.ativo!==false).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select>}{docs.slice(0,2).map(a=><a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{fontSize:9,color:C.blue,textDecoration:"none"}}><Ic n="file" s={10}/> {a.nome}</a>)}{docs.length>2&&<button onClick={()=>setItemModal({docId:d.id,nome:d.nome,...est})} style={{border:0,background:"transparent",color:C.blue,fontSize:9,cursor:"pointer"}}>+{docs.length-2} arquivo(s)</button>}</div></div><div style={{display:"flex",gap:4,alignItems:"center"}}><label title="Anexar documento desta etapa" style={{display:"inline-flex",alignItems:"center",gap:4,border:`1px solid ${docs.length?C.blue:C.border}`,borderRadius:6,padding:"5px 7px",fontSize:8.5,fontWeight:800,color:docs.length?C.blue:C.subtle,cursor:anexandoId===d.id?"wait":"pointer",whiteSpace:"nowrap"}}><Ic n="link" s={11}/>{anexandoId===d.id?"Enviando":docs.length?`${docs.length} anexo(s)`:"Anexar"}<input type="file" disabled={anexandoId===d.id} onChange={e=>{anexarDocumento(d,e.target.files?.[0],g);e.target.value="";}} style={{display:"none"}}/></label><button onClick={()=>setItemModal({docId:d.id,nome:d.nome,...est})} style={{border:0,background:"transparent",color:C.muted,cursor:"pointer",padding:4}}><Ic n="edit" s={14}/></button></div></div></div>;})}</div></div>)}

    {verificacoes.length>0&&<div style={{background:C.card,border:`1px solid ${verificadas===verificacoes.length?C.green:C.border}`,borderRadius:10,padding:"12px 14px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8}}><div><p style={{fontSize:11.5,fontWeight:850}}>Aprovação e liberação para início da obra</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>A aprovação do projeto não substitui a autorização final da Associação.</p></div><Badge color={verificadas===verificacoes.length?C.green:C.orange}>{verificadas}/{verificacoes.length}</Badge></div><div style={{display:"flex",flexDirection:"column",gap:6}}>{verificacoes.map(v=>{const est=check.verificacao?.[v.id]||{};return <label key={v.id} style={{display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer"}}><input type="checkbox" checked={!!est.ok} onChange={e=>salvar({verificacao:{...check.verificacao,[v.id]:{...est,ok:e.target.checked,data:e.target.checked?today():""}}})} style={{width:16,height:16,accentColor:C.green}}/><span style={{fontSize:10.5,color:est.ok?C.text:C.muted,flex:1}}>{v.nome}</span>{est.data&&<span style={{fontSize:9,color:C.green}}>{fmtDate(est.data)}</span>}</label>;})}</div>{check.modoAprovacao==="ja_aprovada"&&<div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8,marginTop:10}}><Inp label="Nº da aprovação / licença" value={check.numeroAprovacao||""} onChange={v=>salvar({numeroAprovacao:v})}/><Inp label="Data da aprovação" type="date" value={check.dataAprovacao||""} onChange={v=>salvar({dataAprovacao:v})}/></div>}</div>}

    {check.tipo==="terras_alpha_caruaru"&&<div style={{padding:"11px 13px",border:`1px solid ${C.yellow}55`,borderRadius:9,background:`${C.yellow}0A`}}><b style={{fontSize:10.5,color:C.yellowD}}>Orientação operacional Terras Alpha</b><p style={{fontSize:9.5,color:C.subtle,lineHeight:1.55,marginTop:4}}>A entrega é presencial no endereço cadastrado, de segunda a sexta, das 08h às 12h. Após a aprovação do condomínio, protocole o processo na Prefeitura. Quando a licença municipal sair, devolva a licença e as vias aprovadas à Associação para carimbo, arquivamento e emissão da liberação da obra.</p></div>}

    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}><p style={{fontSize:11.5,fontWeight:800,color:C.text,marginBottom:9}}>Protocolo e emissão</p><div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}><Inp label="Nº do protocolo" value={check.protocolo} onChange={v=>salvar({protocolo:v})}/><Inp label="Data do protocolo" type="date" value={check.dataProtocolo} onChange={v=>salvar({dataProtocolo:v})}/><Inp label="Data de emissão" type="date" value={check.dataEmissao} onChange={v=>salvar({dataEmissao:v})}/><Inp label="Validade" type="date" value={check.validade} onChange={v=>salvar({validade:v})}/><div style={{gridColumn:"1/-1"}}><Inp label="Observações e exigências" value={check.observacoes} onChange={v=>salvar({observacoes:v})} multiline placeholder="Pendências, contatos, exigências e próximos passos..."/></div></div></div>

    {itemModal&&<Modal title={itemModal.nome} onClose={()=>setItemModal(null)}><div style={{display:"flex",flexDirection:"column",gap:11}}><Sel label="Situação" value={itemModal.status||"pendente"} onChange={v=>setItemModal(f=>({...f,status:v}))} options={LIC_STATUS.map(s=>({v:s.v,l:s.l}))}/><Inp label="Data" type="date" value={itemModal.data||""} onChange={v=>setItemModal(f=>({...f,data:v}))}/><Sel label="Responsável" value={itemModal.responsavelId||""} onChange={v=>setItemModal(f=>({...f,responsavelId:v}))} options={[{v:"",l:"Sem responsável definido"},...(data.usuarios||[]).filter(u=>u.active!==false&&u.ativo!==false).map(u=>({v:u.id,l:u.nome}))]}/><Inp label="Observações" value={itemModal.obs||""} onChange={v=>setItemModal(f=>({...f,obs:v}))} multiline placeholder="Onde está, o que falta, número do documento..."/><div><p style={{fontSize:9.5,fontWeight:850,color:C.muted,textTransform:"uppercase",marginBottom:6}}>Documentos desta etapa</p>{(itemModal.documentos||[]).map(a=><div key={a.id} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 8px",border:`1px solid ${C.border}`,borderRadius:7,marginBottom:5}}><Ic n="file"/><a href={a.url} target="_blank" rel="noreferrer" style={{fontSize:10,color:C.blue,flex:1}}>{a.nome}</a><button onClick={()=>removerAnexo(itemModal.docId,a.id)} title="Remover do dossiê" style={{border:0,background:"transparent",color:C.red,cursor:"pointer"}}><Ic n="trash" s={13}/></button></div>)}{!(itemModal.documentos||[]).length&&<p style={{fontSize:10,color:C.muted}}>Nenhum arquivo anexado.</p>}</div><div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={()=>setItemModal(null)} full>Cancelar</Btn><Btn onClick={()=>{const {docId,nome,...est}=itemModal;setItem(docId,est);setItemModal(null);showToast?.("Etapa atualizada.");}} full><Ic n="check"/> Salvar</Btn></div></div></Modal>}

    {gestaoCondo&&<Modal title="Cadastro de condomínios" onClose={()=>{setGestaoCondo(false);setCondForm(condoVazio);}} wide><div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:12}}><div style={{display:"flex",flexDirection:"column",gap:6}}><p style={{fontSize:10,fontWeight:850,color:C.muted,textTransform:"uppercase"}}>Cadastrados</p>{(data.condominios||[]).map(c=><button key={c.id} onClick={()=>setCondForm({...condoVazio,...c})} style={{textAlign:"left",padding:"9px 10px",border:`1px solid ${condForm.id===c.id?C.blue:C.border}`,borderRadius:8,background:condForm.id===c.id?`${C.blue}08`:C.card,cursor:"pointer"}}><b style={{fontSize:11,color:C.text}}>{c.nome}</b><p style={{fontSize:9,color:C.muted,marginTop:2}}>{c.cidade}/{c.uf} · {c.checklistTipo==="terras_alpha_caruaru"?"Checklist Terras Alpha":"Checklist municipal"}</p></button>)}</div><div style={{display:"flex",flexDirection:"column",gap:8}}><Inp label="Nome *" value={condForm.nome} onChange={v=>setCondForm(f=>({...f,nome:v}))}/><div style={{display:"grid",gridTemplateColumns:"1fr 80px",gap:7}}><Inp label="Cidade" value={condForm.cidade} onChange={v=>setCondForm(f=>({...f,cidade:v}))}/><Inp label="UF" value={condForm.uf} onChange={v=>setCondForm(f=>({...f,uf:v}))}/></div><Inp label="CEP" value={condForm.cep} onChange={v=>setCondForm(f=>({...f,cep:v}))}/><Inp label="Endereço de entrega" value={condForm.endereco} onChange={v=>setCondForm(f=>({...f,endereco:v}))}/><Inp label="Setor / contato" value={condForm.contato} onChange={v=>setCondForm(f=>({...f,contato:v}))}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}><Inp label="Telefone" value={condForm.telefone} onChange={v=>setCondForm(f=>({...f,telefone:v}))}/><Inp label="E-mail" value={condForm.email} onChange={v=>setCondForm(f=>({...f,email:v}))}/></div><Sel label="Modelo de exigências" value={condForm.checklistTipo} onChange={v=>setCondForm(f=>({...f,checklistTipo:v}))} options={[{v:"generico",l:"Licenciamento municipal padrão"},{v:"terras_alpha_caruaru",l:"Terras Alpha Caruaru"}]}/><Inp label="Horários e protocolo" value={condForm.atendimento} onChange={v=>setCondForm(f=>({...f,atendimento:v}))} multiline/><Inp label="Observações" value={condForm.observacoes} onChange={v=>setCondForm(f=>({...f,observacoes:v}))} multiline/><div style={{display:"flex",gap:7}}><Btn v="ghost" onClick={()=>setCondForm(condoVazio)} full>Novo / limpar</Btn><Btn onClick={salvarCondominio} full>Salvar condomínio</Btn></div></div></div></Modal>}
  </div>;
}
