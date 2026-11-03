import {FilePicker} from '../../../design-system/patterns/FilePicker.jsx';
import {Button as StandardButton} from '../../../components/ui/button.jsx';
import {ChoiceControl} from '../../../design-system/primitives/ChoiceControl.jsx';
import {SelectControl} from '../../../design-system/primitives/Select.jsx';
import { marcellReportHtml } from "../../../reports/marcell-report.js";
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
import { enviarArquivoOneDriveEmPartes } from "../../../api";
import {Badge, Btn, Ic, Inp, Modal, PageHero, Sel} from "../../../legacy/ui.jsx";
import {C} from "../../../legacy/palette.js";
import {LICENCAS, LIC_STATUS, LIC_TERRAS_ALPHA_VERIFICACAO, licStatusInfo, licencaPorId, preRequisitosOk, progressoChecklist} from "../legacy-checklists.js";
import {escapeHtml, fmtDate, today, uid} from "../../../legacy/format.js";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { LICENSING_UPLOAD_MAX_BYTES, LICENSING_UPLOAD_MAX_MB } from "../../../onedrive-upload-policy.js";

// ============================================================================
//  EQUIPAMENTOS LOCADOS
//  Frota própria + de terceiros, locação por obra com desconto ao cliente,
//  manutenção, transferência entre obras e relatório mensal de lucro.
// ============================================================================
export default function Licenciamento({ data, showToast, obraIdFixo="", currentUser=null, dispatchCommand=null }) {
  const { formGrid, isMobile } = useBreakpoint();
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

  // `obra` leva campos da obra que o servidor aplica junto com o checklist
  // (workspace do OneDrive, obraCondominioId) - a tela não regrava `obras`.
  const salvar=async(mudanca,obra={})=>{
    if(!dispatchCommand){showToast?.("O checklist de licenciamento exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.licencas||[]).find(l=>l.obraId===obraId);
      return {
        type:OPERATIONAL_COMMAND.LICENSE_CHECKLIST_SAVED,
        idempotencyKey:`licenca-${obraId}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{license:{...vigente,...check,...mudanca,id:vigente?.id||check.id||uid(),obraId},...obra},
      };
    });
    if(!result?.ok){showToast?.(result?.reason||"Não foi possível salvar o checklist de licenciamento.","error");return false;}
    return true;
  };
  const setItem=(docId,campos,obra={})=>salvar({itens:{...check.itens,[docId]:{...(check.itens?.[docId]||{}),...campos}}},obra);
  const ciclarStatus=docId=>{const ordem=["pendente","em_andamento","entregue","aprovado"];const atual=check.itens?.[docId]?.status||"pendente";const prox=atual==="na"?"pendente":ordem[(ordem.indexOf(atual)+1)%ordem.length];setItem(docId,{status:prox,data:["entregue","aprovado"].includes(prox)?today():""});};

  const vincularCondominio=async id=>{
    const condo=condominios.find(x=>x.id===id);
    const tipo=condo?.checklistTipo==="terras_alpha_caruaru"?"terras_alpha_caruaru":"simplificada";
    if(!await salvar({tipo},{obraCondominioId:id||""}))return;
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
    if(file.size>LICENSING_UPLOAD_MAX_BYTES){showToast?.(`O arquivo deve ter no máximo ${LICENSING_UPLOAD_MAX_MB} MB.`,"error");return;}
    setAnexandoId(doc.id);
    try{
      const resp=await enviarArquivoOneDriveEmPartes({file,obraName:obra.name,driveId:obra.oneDriveDriveId,folderId:obra.oneDriveFolderId,folders:obra.oneDriveFolders,category:"licenciamento",subfolder:`${lic.orgao}/${grupo}`});
      if(!resp.ok&&!resp.url)throw new Error(resp.error||"Falha no envio ao OneDrive.");
      const anexo={id:resp.item?.id||uid(),nome:resp.item?.name||file.name,url:resp.url||resp.item?.webUrl||"",path:resp.path||"",tipo:file.type,tamanho:file.size,enviadoEm:new Date().toISOString()};
      const documentos=[...(check.itens?.[doc.id]?.documentos||[]),anexo];
      const salvo=await setItem(doc.id,{documentos,status:check.itens?.[doc.id]?.status==="pendente"?"em_andamento":(check.itens?.[doc.id]?.status||"em_andamento")},resp.workspace?{workspace:resp.workspace}:{});
      if(salvo)showToast?.("Documento anexado à etapa e salvo no OneDrive.");
    }catch(e){showToast?.(e.message||"Não foi possível anexar o documento.","error");}finally{setAnexandoId("");}
  };

  const removerAnexo=(docId,anexoId)=>{if(!window.confirm("Remover este link do dossiê? O arquivo continuará preservado no OneDrive."))return;const documentos=(check.itens?.[docId]?.documentos||[]).filter(a=>a.id!==anexoId);setItem(docId,{documentos});setItemModal(m=>m&&m.docId===docId?{...m,documentos}:m);};

  const gerarDossie=()=>{
    const link=a=>{try{return new URL(a.url,window.location.origin).href;}catch{return a.url||"";}};
    const blocos=grupos.map(g=>`<section><h2>${escapeHtml(g)}</h2>${lic.docs.filter(d=>(d.grupo||"Outros")===g).map(d=>{const est=check.itens?.[d.id]||{},si=licStatusInfo(est.status||"pendente"),docs=est.documentos||[];return `<article><div><b>${escapeHtml(d.nome)}</b><small>${escapeHtml(si.l)}${est.data?` · ${escapeHtml(fmtDate(est.data))}`:""}${est.obs?` · ${escapeHtml(est.obs)}`:""}</small></div><div class="links">${docs.length?docs.map((a,i)=>`<a href="${escapeHtml(link(a))}" target="_blank">${i+1}. ${escapeHtml(a.nome||"Documento")}</a>`).join(""):"<span>Sem anexo</span>"}</div></article>`;}).join("")}</section>`).join("");
    const verificacaoHtml=verificacoes.length?`<section><h2>Verificação e liberação</h2>${verificacoes.map(v=>`<article><div><b>${check.verificacao?.[v.id]?.ok?"✓":"○"} ${escapeHtml(v.nome)}</b><small>${check.verificacao?.[v.id]?.data?escapeHtml(fmtDate(check.verificacao[v.id].data)):""}</small></div></article>`).join("")}</section>`:"";
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Dossiê de licenciamento · ${escapeHtml(obra.name)}</title><style>:root{--ouro:#d4af37;--grafite:#121212;--areia:#f5f3ee;--cinza:#bfbfbf}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:var(--grafite);margin:0;background:#fff}header{padding:30px 36px;background:var(--grafite);color:#fff;border-bottom:6px solid var(--ouro)}header p{margin:5px 0;color:#ddd}main{padding:26px 36px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:22px}.summary div{border:1px solid #ddd;padding:10px}.summary small,article small{display:block;color:#666;margin-top:4px}h1{margin:0;font-size:24px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.8px;border-bottom:2px solid var(--ouro);padding-bottom:6px;margin-top:22px}article{display:grid;grid-template-columns:minmax(0,1fr) 38%;gap:18px;padding:10px 6px;border-bottom:1px solid #e6e2d9;font-size:11px}.links{display:flex;flex-direction:column;gap:3px}.links a{color:#0d47a1;text-decoration:none}.links span{color:#999}.print{position:fixed;right:16px;top:16px;border:0;background:var(--ouro);color:#111;padding:10px 14px;font-weight:bold;cursor:pointer}@media print{.print{display:none}article{break-inside:avoid}}@media(max-width:700px){.summary{grid-template-columns:1fr 1fr}article{grid-template-columns:1fr}}</style></head><body><button class="print" onclick="print()">Imprimir / salvar PDF</button><header><h1>Dossiê de licenciamento</h1><p>${escapeHtml(data.config?.companyName||"MARCELL")} · ${escapeHtml(obra.name)}</p><p>${escapeHtml(condominio?.nome||"Sem condomínio informado")}${obra.quadra||obra.lote?` · Quadra ${escapeHtml(obra.quadra||"-")} · Lote ${escapeHtml(obra.lote||"-")}`:""}</p></header><main><div class="summary"><div><b>${prog.pct.toFixed(0)}%</b><small>documentação</small></div><div><b>${prog.concluidos}/${prog.aplicaveis}</b><small>itens concluídos</small></div><div><b>${verificadas}/${verificacoes.length||"-"}</b><small>verificações</small></div><div><b>${escapeHtml(check.protocolo||"-")}</b><small>protocolo</small></div></div><p style="font-size:11px;color:#666">Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}. Os links abaixo dão acesso às evidências arquivadas no OneDrive conforme as permissões do usuário.</p>${blocos}${verificacaoHtml}</main></body></html>`;
    const w=window.open("","_blank");if(!w){showToast?.("Permita pop-ups para gerar o dossiê.","error");return;}w.opener=null;w.document.write(marcellReportHtml(html));w.document.close();
  };

  if(!obra)return <div style={{padding:"var(--arcd-space-6)",textAlign:"center",color:"var(--arcd-text-secondary)",fontSize:"var(--arcd-type-body)"}}>Cadastre uma obra para montar o checklist de licenciamento.</div>;

  return <div className="anim" style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
    <PageHero
      eyebrow="Governança documental"
      title="Licenciamento da obra"
      description="Condomínio → documentação → aprovação → Prefeitura → liberação"
      actions={<><Btn v="ghost" onClick={()=>setGestaoCondo(true)}><Ic n="building"/> Condomínios</Btn><Btn onClick={gerarDossie}><Ic n="fileText"/> Gerar dossiê</Btn></>}
    />

    <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-2)"}}>{obraIdFixo?<Inp label="Obra" value={obra.name} onChange={()=>{}} disabled/>:<Sel label="Obra" value={obraId} onChange={setObraSel} options={(data.obras||[]).map(o=>({v:o.id,l:o.name}))}/>}<Sel label="Condomínio da obra" value={obra.condominioId||""} onChange={vincularCondominio} options={[{v:"",l:"Fora de condomínio / ainda não informado"},...condominios.map(c=>({v:c.id,l:`${c.nome}${c.cidade?` · ${c.cidade}/${c.uf}`:""}`}))]}/></div>

    {!condominio&&<div style={{padding:"var(--arcd-space-2) var(--arcd-space-3)",border:"1px solid color-mix(in srgb, var(--arcd-warning-text) 40%, transparent)",borderRadius:9,background:"color-mix(in srgb, var(--arcd-warning-text) 4%, transparent)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)"}}><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-warning-text)"}}><b>Condomínio não definido.</b> Selecione acima ou cadastre um novo para carregar as exigências corretas.</p><Btn size="sm" v="ghost" onClick={()=>setGestaoCondo(true)}>Cadastrar</Btn></div>}

    {condominio&&<div style={{padding:"var(--arcd-space-3)",border:"1px solid color-mix(in srgb, var(--arcd-action-primary) 27%, transparent)",borderRadius:10,background:"color-mix(in srgb, var(--arcd-action-primary) 3%, transparent)",display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-2)"}}><div><b style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-action-primary)"}}>{condominio.nome}</b><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{condominio.endereco||`${condominio.cidade}/${condominio.uf}`}</p></div><div><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-muted)",lineHeight:"var(--arcd-line-height-normal)"}}>{condominio.atendimento||"Atendimento não informado."}</p>{condominio.email&&<a href={`mailto:${condominio.email}`} style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-action-primary)"}}>{condominio.email}</a>}</div></div>}

    <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-2)"}}><Sel label="Procedimento aplicável" value={check.tipo} onChange={v=>salvar({tipo:v})} options={LICENCAS.map(l=>({v:l.id,l:l.nome}))}/><div><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",marginBottom:"var(--arcd-space-1)",textTransform:"uppercase"}}>Situação inicial</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:"1px solid var(--arcd-border-default)",borderRadius:7,overflow:"hidden"}}>{[["nova","Novo processo"],["ja_aprovada","Obra já aprovada"]].map(([v,l])=><StandardButton variant="secondary" key={v} type="button" className="arcd-choice-button" aria-pressed={check.modoAprovacao===v} onClick={()=>salvar({modoAprovacao:v})}>{l}</StandardButton>)}</div></div></div>

    <div style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:10,padding:"var(--arcd-space-3)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)"}}>{lic.orgao}</p><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-half)"}}>{lic.nome}</p><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)",lineHeight:"var(--arcd-line-height-normal)"}}>{lic.finalidade}</p><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-muted)",marginTop:"var(--arcd-space-1)"}}>Prazo: <b>{lic.prazo}</b></p></div>

    <div style={{background:"var(--arcd-surface-card)",border:`1.5px solid ${prog.pronto?"var(--arcd-success-text)":"var(--arcd-border-default)"}`,borderRadius:10,padding:"var(--arcd-space-3)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"var(--arcd-space-1)"}}><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{prog.concluidos} de {prog.aplicaveis} documentos</p><b style={{fontSize:"var(--arcd-type-card-title)",color:prog.pronto?"var(--arcd-success-text)":"var(--arcd-action-primary)"}}>{prog.pct.toFixed(0)}%</b></div><div style={{height:8,background:"var(--arcd-border-default)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${prog.pct}%`,background:prog.pronto?"var(--arcd-success-text)":"var(--arcd-action-primary)"}}/></div><div style={{display:"flex",gap:"var(--arcd-space-3)",marginTop:"var(--arcd-space-2)",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}><span>Pendentes <b>{prog.pendentes}</b></span><span>Aprovados <b style={{color:"var(--arcd-success-text)"}}>{prog.aprovados}</b></span><span>Anexos <b style={{color:"var(--arcd-action-primary)"}}>{Object.values(check.itens||{}).reduce((s,x)=>s+(x.documentos?.length||0),0)}</b></span></div></div>

    <div style={{background:pre.ok?"color-mix(in srgb, var(--arcd-success-text) 4%, transparent)":"color-mix(in srgb, var(--arcd-warning-text) 4%, transparent)",border:`1px solid ${pre.ok?"var(--arcd-success-text)"+"55":"var(--arcd-warning-text)"+"66"}`,borderRadius:10,padding:"var(--arcd-space-3)"}}><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:pre.ok?"var(--arcd-success-text)":"var(--arcd-warning-text)",marginBottom:"var(--arcd-space-2)"}}>Condições de entrada {pre.marcados}/{pre.total}</p><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-1)"}}>{lic.pre.map(p=>{const marcado=!!check.pre?.[p.id];return <label key={p.id} style={{display:"flex",alignItems:"flex-start",gap:"var(--arcd-space-2)",cursor:"pointer"}}><ChoiceControl type="checkbox" checked={marcado} onChange={()=>salvar({pre:{...check.pre,[p.id]:!marcado}})} style={{width:16,height:16,accentColor:"var(--arcd-success-text)",marginTop:"var(--arcd-space-0)"}}/><span style={{fontSize:"var(--arcd-type-label)",color:marcado?"var(--arcd-text-primary)":"var(--arcd-text-secondary)",lineHeight:"var(--arcd-line-height-normal)"}}>{p.texto}</span></label>;})}</div></div>

    {grupos.map(g=><div key={g}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)",marginBottom:"var(--arcd-space-1)",padding:"var(--arcd-space-0) var(--arcd-space-half)"}}>{g}</p><div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:9,overflow:"hidden"}}>{lic.docs.filter(d=>(d.grupo||"Outros")===g).map((d,i)=>{const est=check.itens?.[d.id]||{},si=licStatusInfo(est.status||"pendente"),na=est.status==="na",docs=est.documentos||[];return <div key={d.id} style={{padding:"var(--arcd-space-2) var(--arcd-space-3)",borderTop:i?"1px solid var(--arcd-border-default)":"none",opacity:na?.55:1}}><div style={{display:"grid",gridTemplateColumns:isMobile?"minmax(0,1fr)":"auto minmax(0,1fr) auto",gap:"var(--arcd-space-2)",alignItems:"start"}}><StandardButton variant="secondary" onClick={()=>ciclarStatus(d.id)} title="Avançar situação" style={{whiteSpace:"nowrap"}}>{si.l}</StandardButton><div style={{minWidth:0}}><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",lineHeight:"var(--arcd-line-height-normal)",textDecoration:na?"line-through":"none"}}>{d.nome}</p>{d.cond&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-warning-text)",marginTop:"var(--arcd-space-half)"}}>{d.cond}</p>}{d.obs&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)",lineHeight:"var(--arcd-line-height-normal)"}}>{d.obs}</p>}<div style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-1)",flexWrap:"wrap"}}>{!na&&<SelectControl value={est.responsavelId||""} onChange={e=>setItem(d.id,{responsavelId:e.target.value})} style={{border:0,background:"transparent",fontSize:"var(--arcd-type-control)",color:est.responsavelId?"var(--arcd-action-primary)":"var(--arcd-warning-text)",fontWeight:"var(--arcd-font-weight-semibold)",outline:"none"}}><option value="">Sem responsável</option>{(data.usuarios||[]).filter(u=>u.active!==false&&u.ativo!==false).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</SelectControl>}{docs.slice(0,2).map(a=><a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-action-primary)",textDecoration:"none"}}><Ic n="file" s={10}/> {a.nome}</a>)}{docs.length>2&&<StandardButton variant="secondary" onClick={()=>setItemModal({docId:d.id,nome:d.nome,...est})}>+{docs.length-2} arquivo(s)</StandardButton>}</div></div><div style={{display:"flex",gap:"var(--arcd-space-1)",alignItems:"center"}}><FilePicker buttonLabel="Anexar documento" disabled={anexandoId===d.id} onChange={e=>{anexarDocumento(d,e.target.files?.[0],g);e.target.value="";}} title="Anexar documento desta etapa" style={{display:"inline-flex",alignItems:"center",gap:"var(--arcd-space-1)",border:`1px solid ${docs.length?"var(--arcd-action-primary)":"var(--arcd-border-default)"}`,borderRadius:6,padding:"var(--arcd-space-1) var(--arcd-space-2)",fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:docs.length?"var(--arcd-action-primary)":"var(--arcd-text-muted)",cursor:anexandoId===d.id?"wait":"pointer",whiteSpace:"nowrap"}}></FilePicker><StandardButton variant="secondary" size="sm" title={`Editar exigência: ${d.nome}`} aria-label={`Editar exigência: ${d.nome}`} onClick={()=>setItemModal({docId:d.id,nome:d.nome,...est})}><Ic n="edit"/> Editar</StandardButton></div></div></div>;})}</div></div>)}

    {verificacoes.length>0&&<div style={{background:"var(--arcd-surface-card)",border:`1px solid ${verificadas===verificacoes.length?"var(--arcd-success-text)":"var(--arcd-border-default)"}`,borderRadius:10,padding:"var(--arcd-space-3)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)",marginBottom:"var(--arcd-space-2)"}}><div><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)"}}>Aprovação e liberação para início da obra</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>A aprovação do projeto não substitui a autorização final da Associação.</p></div><Badge color={verificadas===verificacoes.length?C.green:C.orange}>{verificadas}/{verificacoes.length}</Badge></div><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-1)"}}>{verificacoes.map(v=>{const est=check.verificacao?.[v.id]||{};return <label key={v.id} style={{display:"flex",alignItems:"flex-start",gap:"var(--arcd-space-2)",cursor:"pointer"}}><ChoiceControl type="checkbox" checked={!!est.ok} onChange={e=>salvar({verificacao:{...check.verificacao,[v.id]:{...est,ok:e.target.checked,data:e.target.checked?today():""}}})} style={{width:16,height:16,accentColor:"var(--arcd-success-text)"}}/><span style={{fontSize:"var(--arcd-type-label)",color:est.ok?"var(--arcd-text-primary)":"var(--arcd-text-secondary)",flex:1}}>{v.nome}</span>{est.data&&<span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-success-text)"}}>{fmtDate(est.data)}</span>}</label>;})}</div>{check.modoAprovacao==="ja_aprovada"&&<div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-2)",marginTop:"var(--arcd-space-2)"}}><Inp label="Nº da aprovação / licença" value={check.numeroAprovacao||""} onChange={v=>salvar({numeroAprovacao:v})}/><Inp label="Data da aprovação" type="date" value={check.dataAprovacao||""} onChange={v=>salvar({dataAprovacao:v})}/></div>}</div>}

    {check.tipo==="terras_alpha_caruaru"&&<div style={{padding:"var(--arcd-space-3)",border:"1px solid color-mix(in srgb, var(--arcd-action-primary) 33%, transparent)",borderRadius:9,background:"color-mix(in srgb, var(--arcd-action-primary) 4%, transparent)"}}><b style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-action-primary)"}}>Orientação operacional Terras Alpha</b><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-muted)",lineHeight:"var(--arcd-line-height-normal)",marginTop:"var(--arcd-space-1)"}}>A entrega é presencial no endereço cadastrado, de segunda a sexta, das 08h às 12h. Após a aprovação do condomínio, protocole o processo na Prefeitura. Quando a licença municipal sair, devolva a licença e as vias aprovadas à Associação para carimbo, arquivamento e emissão da liberação da obra.</p></div>}

    <div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:10,padding:"var(--arcd-space-3)"}}><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginBottom:"var(--arcd-space-2)"}}>Protocolo e emissão</p><div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-2)"}}><Inp label="Nº do protocolo" value={check.protocolo} onChange={v=>salvar({protocolo:v})}/><Inp label="Data do protocolo" type="date" value={check.dataProtocolo} onChange={v=>salvar({dataProtocolo:v})}/><Inp label="Data de emissão" type="date" value={check.dataEmissao} onChange={v=>salvar({dataEmissao:v})}/><Inp label="Validade" type="date" value={check.validade} onChange={v=>salvar({validade:v})}/><div style={{gridColumn:"1/-1"}}><Inp label="Observações e exigências" value={check.observacoes} onChange={v=>salvar({observacoes:v})} multiline placeholder="Pendências, contatos, exigências e próximos passos..."/></div></div></div>

    {itemModal&&<Modal title={itemModal.nome} onClose={()=>setItemModal(null)}><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}><Sel label="Situação" value={itemModal.status||"pendente"} onChange={v=>setItemModal(f=>({...f,status:v}))} options={LIC_STATUS.map(s=>({v:s.v,l:s.l}))}/><Inp label="Data" type="date" value={itemModal.data||""} onChange={v=>setItemModal(f=>({...f,data:v}))}/><Sel label="Responsável" value={itemModal.responsavelId||""} onChange={v=>setItemModal(f=>({...f,responsavelId:v}))} options={[{v:"",l:"Sem responsável definido"},...(data.usuarios||[]).filter(u=>u.active!==false&&u.ativo!==false).map(u=>({v:u.id,l:u.nome}))]}/><Inp label="Observações" value={itemModal.obs||""} onChange={v=>setItemModal(f=>({...f,obs:v}))} multiline placeholder="Onde está, o que falta, número do documento..."/><div><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",marginBottom:"var(--arcd-space-1)"}}>Documentos desta etapa</p>{(itemModal.documentos||[]).map(a=><div key={a.id} style={{display:"flex",alignItems:"center",gap:"var(--arcd-space-2)",padding:"var(--arcd-space-2)",border:"1px solid var(--arcd-border-default)",borderRadius:7,marginBottom:"var(--arcd-space-1)"}}><Ic n="file"/><a href={a.url} target="_blank" rel="noreferrer" style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-action-primary)",flex:1}}>{a.nome}</a><StandardButton variant="secondary" onClick={()=>removerAnexo(itemModal.docId,a.id)} title="Remover do dossiê"><Ic n="trash" s={13}/></StandardButton></div>)}{!(itemModal.documentos||[]).length&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Nenhum arquivo anexado.</p>}</div><div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn v="ghost" onClick={()=>setItemModal(null)} full>Cancelar</Btn><Btn onClick={()=>{const {docId,nome,...est}=itemModal;setItem(docId,est);setItemModal(null);showToast?.("Etapa atualizada.");}} full><Ic n="check"/> Salvar</Btn></div></div></Modal>}

    {gestaoCondo&&<Modal title="Cadastro de condomínios" onClose={()=>{setGestaoCondo(false);setCondForm(condoVazio);}} wide><div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-3)"}}><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-1)"}}><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>Cadastrados</p>{(data.condominios||[]).map(c=><StandardButton variant="secondary" key={c.id} onClick={()=>setCondForm({...condoVazio,...c})} style={{textAlign:"left"}}><b style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)"}}>{c.nome}</b><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{c.cidade}/{c.uf} · {c.checklistTipo==="terras_alpha_caruaru"?"Checklist Terras Alpha":"Checklist municipal"}</p></StandardButton>)}</div><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}><Inp label="Nome *" value={condForm.nome} onChange={v=>setCondForm(f=>({...f,nome:v}))}/><div style={{display:"grid",gridTemplateColumns:"1fr 80px",gap:"var(--arcd-space-2)"}}><Inp label="Cidade" value={condForm.cidade} onChange={v=>setCondForm(f=>({...f,cidade:v}))}/><Inp label="UF" value={condForm.uf} onChange={v=>setCondForm(f=>({...f,uf:v}))}/></div><Inp label="CEP" value={condForm.cep} onChange={v=>setCondForm(f=>({...f,cep:v}))}/><Inp label="Endereço de entrega" value={condForm.endereco} onChange={v=>setCondForm(f=>({...f,endereco:v}))}/><Inp label="Setor / contato" value={condForm.contato} onChange={v=>setCondForm(f=>({...f,contato:v}))}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--arcd-space-2)"}}><Inp label="Telefone" value={condForm.telefone} onChange={v=>setCondForm(f=>({...f,telefone:v}))}/><Inp label="E-mail" value={condForm.email} onChange={v=>setCondForm(f=>({...f,email:v}))}/></div><Sel label="Modelo de exigências" value={condForm.checklistTipo} onChange={v=>setCondForm(f=>({...f,checklistTipo:v}))} options={[{v:"generico",l:"Licenciamento municipal padrão"},{v:"terras_alpha_caruaru",l:"Terras Alpha Caruaru"}]}/><Inp label="Horários e protocolo" value={condForm.atendimento} onChange={v=>setCondForm(f=>({...f,atendimento:v}))} multiline/><Inp label="Observações" value={condForm.observacoes} onChange={v=>setCondForm(f=>({...f,observacoes:v}))} multiline/><div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn v="ghost" onClick={()=>setCondForm(condoVazio)} full>Novo / limpar</Btn><Btn onClick={salvarCondominio} full>Salvar condomínio</Btn></div></div></div></Modal>}
  </div>;
}
