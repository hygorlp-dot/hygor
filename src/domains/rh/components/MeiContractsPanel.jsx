import { useState } from "react";
import { Btn, C, Inp, Sel, uid } from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { createMeiContract, validateMeiContract } from "../mei-contracts.js";

const initial = () => ({
  providerName:"", cnpj:"", service:"", scope:"administrativo", obraId:"",
  frequency:"mensal", fixedAmount:"", startDate:new Date().toISOString().slice(0,10), endDate:"", note:""
});
const card={border:`1px solid ${C.border}`,borderRadius:8,padding:16,display:"grid",gap:12};
const money = n => Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default function MeiContractsPanel({data,dispatchCommand,showToast,currentUser}) {
  const contracts=Array.isArray(data?.config?.meiContracts)?data.config.meiContracts:[];
  const [draft,setDraft]=useState(initial);
  const [editing,setEditing]=useState(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const canManage=["admin","rh"].includes(currentUser?.role);
  const field=(key)=>value=>setDraft(v=>({...v,[key]:value}));
  const edit=contract=>{setEditing(contract.id);setDraft({...contract,fixedAmount:String(contract.fixedAmount)});setError("");};
  const cancel=()=>{setEditing(null);setDraft(initial());setError("");};
  const save=async()=>{
    if(!canManage||saving)return;
    const parsed=createMeiContract(draft,data?.obras||[]);
    if(!parsed.ok){setError(Object.values(parsed.errors).join(" "));return;}
    setSaving(true);setError("");
    try {
      const now=new Date().toISOString();
      const result=await dispatchCommand(atual=>{
        const existing=Array.isArray(atual.config?.meiContracts)?atual.config.meiContracts:[];
        const before=existing.find(c=>c.id===editing);
        const value={...parsed.contract,id:editing||uid(),status:before?.status||"ativo",
          createdAt:before?.createdAt||now,updatedAt:now,
          revisions:[...(before?.revisions||[]),...(before?[{at:now,previous:before.fixedAmount,amount:parsed.contract.fixedAmount}]:[])]};
        return {type:OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED,
          idempotencyKey:`mei-contrato-${value.id}-${uid()}`,
          expectedVersion:Number(atual.config?.version||0),
          payload:{config:{...atual.config,meiContracts:editing?existing.map(c=>c.id===editing?value:c):[...existing,value]}}};
      });
      if(!result?.ok)throw Error(result?.reason||"Contrato não confirmado pelo servidor.");
      cancel();showToast?.("Contrato MEI salvo na empresa.");
    }catch(err){setError(err.message||"Falha ao salvar contrato.");}
    finally{setSaving(false);}
  };
  const setStatus=async(contract,status)=>{
    if(!canManage||saving)return;
    setSaving(true);
    try{
      const now=new Date().toISOString();
      const result=await dispatchCommand(atual=>({
        type:OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED,
        idempotencyKey:`mei-status-${contract.id}-${uid()}`,
        expectedVersion:Number(atual.config?.version||0),
        payload:{config:{...atual.config,meiContracts:(atual.config.meiContracts||[]).map(c=>
          c.id===contract.id?{...c,status,updatedAt:now,statusHistory:[...(c.statusHistory||[]),{status,at:now}]}:c)}}}));
      if(!result?.ok)throw Error(result?.reason||"Alteração não confirmada.");
      showToast?.("Situação do contrato atualizada.");
    }catch(err){showToast?.(err.message,"error");}
    finally{setSaving(false);}
  };
  return <section style={{display:"grid",gap:14}} aria-label="Contratos MEI">
    <div style={card}>
      <h3 style={{fontWeight:700}}>Contratos MEI — prestadores de serviços</h3>
      <p style={{color:C.muted}}>Cadastro empresarial de prestadores PJ. Os valores são contratuais e não geram automaticamente holerites, encargos CLT ou pagamentos. Confira a elegibilidade MEI e o contrato antes de aprovar despesas.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>
        <Inp label="Nome empresarial *" value={draft.providerName} onChange={field("providerName")}/>
        <Inp label="CNPJ *" value={draft.cnpj} onChange={field("cnpj")}/>
        <Inp label="Serviço contratado *" value={draft.service} onChange={field("service")}/>
        <Sel label="Área de contratação" value={draft.scope} onChange={v=>setDraft(d=>({...d,scope:v,obraId:v==="administrativo"?"":d.obraId}))} options={[{v:"administrativo",l:"Administrativo da empresa"},{v:"terceirizado",l:"Terceirizado de obra"}]}/>
        {draft.scope==="terceirizado"&&<Sel label="Obra *" value={draft.obraId} onChange={field("obraId")} options={[{v:"",l:"Selecione"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>}
        <Sel label="Tipo de valor fixo" value={draft.frequency} onChange={field("frequency")} options={[{v:"mensal",l:"Mensal"},{v:"contrato",l:"Global do contrato"}]}/>
        <Inp label="Valor fixo (R$) *" type="number" value={String(draft.fixedAmount)} onChange={field("fixedAmount")}/>
        <Inp label="Início da vigência *" type="date" value={draft.startDate} onChange={field("startDate")}/>
        <Inp label="Fim da vigência" type="date" value={draft.endDate} onChange={field("endDate")}/>
      </div>
      <Inp label="Observações contratuais" value={draft.note||""} onChange={field("note")}/>
      {error&&<p role="alert" style={{color:C.red}}>{error}</p>}
      {canManage&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={save} disabled={saving}>{saving?"Salvando...":editing?"Salvar alterações":"Cadastrar contrato MEI"}</Btn>
        {editing&&<Btn v="ghost" onClick={cancel}>Cancelar edição</Btn>}
      </div>}
    </div>
    <div style={card}>
      <h3>Contratos cadastrados ({contracts.length})</h3>
      {!contracts.length&&<p style={{color:C.muted}}>Nenhum contrato MEI registrado.</p>}
      {contracts.map(contract=><div key={contract.id} style={{borderBottom:`1px solid ${C.border}`,padding:"10px 0",display:"grid",gap:6}}>
        <strong>{contract.providerName} · {money(contract.fixedAmount)} {contract.frequency==="mensal"?"/ mês":"/ contrato"}</strong>
        <span>{contract.service} · {contract.scope==="administrativo"?"Administrativo":data.obras?.find(o=>o.id===contract.obraId)?.name||"Obra não identificada"} · {contract.status||"ativo"}</span>
        <span style={{color:C.muted}}>CNPJ: {contract.cnpj} · Vigência: {contract.startDate}{contract.endDate?` a ${contract.endDate}`:""}</span>
        {canManage&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn v="ghost" onClick={()=>edit(contract)}>Editar</Btn>
          <Btn v="ghost" disabled={saving} onClick={()=>setStatus(contract,contract.status==="suspenso"?"ativo":"suspenso")}>{contract.status==="suspenso"?"Reativar":"Suspender"}</Btn>
        </div>}
      </div>)}
    </div>
  </section>;
}
