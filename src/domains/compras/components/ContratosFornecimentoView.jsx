import {Button as StandardButton} from '../../../components/ui/button.jsx';
// Contratos de fornecimento (C2.4): preço acordado por insumo, fornecedor e
// vigência, com saldo de quantidade. Tudo é gravado por comando do servidor;
// o saldo vem de resumoContrato (contratado menos o pedido pelos pedidos vivos).
import { useMemo, useState } from "react";
import { Badge, Btn, Ic, Inp, Modal, Sel } from "../../../legacy/ui.jsx";
import { fmt, fmtDate, today, uid } from "../../../legacy/format.js";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { resumoContrato } from "../supply-contracts";
import { purchaseUnitOf } from "../unit-conversion";

const itemVazio=()=>({id:uid(),materialId:"",unidadeRef:"UN",unidadeCompra:"UN",fatorConversao:1,precoUnit:"",qtdContratada:""});

function ModalContrato({form,setForm,onSave,fornecedores,materiais,obras,C}){
  const [salvando,setSalvando]=useState(false);
  const setItem=(i,patch)=>setForm(f=>({...f,itens:f.itens.map((x,k)=>k===i?{...x,...patch}:x)}));
  const total=(form.itens||[]).reduce((s,i)=>s+Number(i.precoUnit||0)*Number(i.qtdContratada||0),0);
  return <Modal title={form.numero?`Contrato ${form.numero}`:"Novo contrato de fornecimento"} onClose={()=>setForm(null)} wide>
    <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
      <Sel label="Fornecedor *" value={form.fornecedorId} onChange={v=>setForm(f=>({...f,fornecedorId:v}))}
        options={[{v:"",l:"Selecione..."},...fornecedores.map(f=>({v:f.id,l:f.nome}))]}/>
      <Sel label="Obra" value={form.obraId||""} onChange={v=>setForm(f=>({...f,obraId:v}))}
        options={[{v:"",l:"Todas as obras"},...obras.map(o=>({v:o.id,l:o.name}))]}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"var(--arcd-space-2)"}}>
        <Inp label="Início da vigência *" type="date" value={form.vigenciaInicio} onChange={v=>setForm(f=>({...f,vigenciaInicio:v}))}/>
        <Inp label="Fim da vigência *" type="date" value={form.vigenciaFim} onChange={v=>setForm(f=>({...f,vigenciaFim:v}))}/>
      </div>
      <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>Insumos e preços acordados</p>
      {(form.itens||[]).map((it,i)=><div key={it.id} style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-2)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"var(--arcd-space-2)",alignItems:"end"}}>
        <div style={{gridColumn:"1/-1"}}><Sel label={`Insumo ${i+1} *`} value={it.materialId} onChange={v=>{const m=materiais.find(x=>x.id===v);setItem(i,{materialId:v,unidadeRef:m?.unidade||"UN",unidadeCompra:m?.unidade||"UN",fatorConversao:1});}}
          options={[{v:"",l:"Selecione..."},...materiais.map(m=>({v:m.id,l:`${m.descricao} (${m.unidade})`}))]}/></div>
        <Inp label={`Preço acordado (R$/${purchaseUnitOf(it)}) *`} type="number" value={it.precoUnit} onChange={v=>setItem(i,{precoUnit:v})}/>
        <Inp label={`Quantidade contratada (${purchaseUnitOf(it)}) *`} type="number" value={it.qtdContratada} onChange={v=>setItem(i,{qtdContratada:v})}/>
        {(form.itens||[]).length>1&&<StandardButton variant="secondary" type="button" onClick={()=>setForm(f=>({...f,itens:f.itens.filter((_,k)=>k!==i)}))} style={{justifySelf:"start"}}>Remover insumo</StandardButton>}
      </div>)}
      <Btn v="ghost" onClick={()=>setForm(f=>({...f,itens:[...(f.itens||[]),itemVazio()]}))}><Ic n="plus"/> Adicionar insumo</Btn>
      <Inp label="Observação" value={form.observacao||""} onChange={v=>setForm(f=>({...f,observacao:v}))} multiline/>
      <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>Valor contratado: {fmt(total)}</p>
      <div style={{display:"flex",gap:"var(--arcd-space-2)"}}>
        <Btn v="ghost" full disabled={salvando} onClick={()=>setForm(null)}>Cancelar</Btn>
        <Btn full disabled={salvando} loading={salvando&&"Salvando..."} onClick={async()=>{setSalvando(true);try{await onSave(form);}finally{setSalvando(false);}}}><Ic n="check"/> Salvar contrato</Btn>
      </div>
    </div>
  </Modal>;
}

export default function ContratosFornecimentoView({data,dispatchCommand,currentUser,showToast,C,podeEditar}){
  const [form,setForm]=useState(null);
  const [mostrarEncerrados,setMostrarEncerrados]=useState(false);
  const fornecedores=useMemo(()=>(data.fornecedores||[]).filter(f=>f.ativo!==false),[data.fornecedores]);
  const materiais=data.materiais||[];
  const obras=data.obras||[];
  const nomeForn=id=>(data.fornecedores||[]).find(f=>f.id===id)?.nome||"Fornecedor";
  const nomeMat=id=>materiais.find(m=>m.id===id)?.descricao||"Insumo";
  const contratos=(data.contratosFornecimento||[]).filter(c=>mostrarEncerrados||c.status==="ativo")
    .sort((a,b)=>String(b.vigenciaFim||"").localeCompare(String(a.vigenciaFim||"")));
  const hoje=today();

  const enviar=async(montar,sucesso)=>{
    if(!dispatchCommand){showToast("Alterar contratos exige conexão com o servidor.","error");return false;}
    const result=await dispatchCommand(montar);
    if(!result?.ok){showToast(result?.reason||"O servidor não confirmou o contrato.","error");return false;}
    showToast(sucesso);return true;
  };
  const salvar=async f=>{
    const contract={id:f.id||uid(),numero:f.numero||"",fornecedorId:f.fornecedorId,obraId:f.obraId||"",
      vigenciaInicio:f.vigenciaInicio,vigenciaFim:f.vigenciaFim,observacao:f.observacao||"",
      itens:(f.itens||[]).filter(i=>i.materialId).map(i=>({...i,precoUnit:Number(i.precoUnit),qtdContratada:Number(i.qtdContratada)}))};
    const ok=await enviar(atual=>({
      type:OPERATIONAL_COMMAND.SUPPLY_CONTRACT_SAVED,
      idempotencyKey:`supply-contract-save-${contract.id}-${uid()}`,
      expectedVersion:Number((atual.contratosFornecimento||[]).find(c=>c.id===contract.id)?.version||0),
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{contract},
    }),"Contrato de fornecimento salvo.");
    if(ok)setForm(null);
  };
  const encerrar=async c=>{
    const motivo=window.prompt(`Motivo do encerramento do contrato ${c.numero}:`);
    if(!motivo||!motivo.trim())return;
    await enviar(atual=>({
      type:OPERATIONAL_COMMAND.SUPPLY_CONTRACT_CLOSED,
      idempotencyKey:`supply-contract-close-${c.id}-${uid()}`,
      expectedVersion:Number((atual.contratosFornecimento||[]).find(x=>x.id===c.id)?.version||0),
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{contractId:c.id,reason:motivo.trim()},
    }),`Contrato ${c.numero} encerrado.`);
  };

  return <>
    <div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"center",flexWrap:"wrap"}}>
      <div><b style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-primary)"}}>Contratos de fornecimento</b>
        <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Preço acordado por insumo e período. O pedido pelo contrato dispensa cotação e consome o saldo.</p></div>
      <div style={{display:"flex",gap:"var(--arcd-space-1)",flexWrap:"wrap"}}>
        <Btn size="sm" v="ghost" onClick={()=>setMostrarEncerrados(v=>!v)}>{mostrarEncerrados?"Só ativos":"Mostrar encerrados"}</Btn>
        {podeEditar&&<Btn size="sm" onClick={()=>setForm({id:"",fornecedorId:"",obraId:"",vigenciaInicio:hoje,vigenciaFim:"",observacao:"",itens:[itemVazio()]})}><Ic n="plus"/> Novo contrato</Btn>}
      </div>
    </div>
    {!contratos.length&&<div style={{padding:"var(--arcd-space-6)",textAlign:"center",border:"1px dashed var(--arcd-border-default)",borderRadius:9,background:"var(--arcd-surface-card)",marginTop:"var(--arcd-space-2)"}}>
      <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>Nenhum contrato de fornecimento</p>
      <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Cadastre os acordos de preço com fornecedores (ex.: concreto 30 MPa a R$ 520/m³ até março).</p></div>}
    {contratos.map(c=>{const r=resumoContrato(data,c),vencido=c.vigenciaFim<hoje;return <div key={c.id} style={{marginTop:"var(--arcd-space-2)",background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:9,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",flexWrap:"wrap"}}>
        <div style={{minWidth:0}}><b style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-primary)"}}>{c.numero} · {nomeForn(c.fornecedorId)}</b>
          <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{fmtDate(c.vigenciaInicio)} a {fmtDate(c.vigenciaFim)} · {c.obraId?obras.find(o=>o.id===c.obraId)?.name||"Obra":"Todas as obras"} · {fmt(r.valorConsumido)} de {fmt(r.valorContratado)}</p></div>
        <div style={{display:"flex",gap:"var(--arcd-space-1)",alignItems:"flex-start",flexWrap:"wrap"}}>
          <Badge color={c.status!=="ativo"?C.muted:vencido?C.orange:C.green}>{c.status!=="ativo"?"ENCERRADO":vencido?"VENCIDO":"VIGENTE"}</Badge>
          {podeEditar&&c.status==="ativo"&&<Btn size="sm" v="ghost" onClick={()=>setForm({...c,itens:c.itens.map(i=>({...i,precoUnit:String(i.precoUnit),qtdContratada:String(i.qtdContratada)}))})}><Ic n="edit"/> Editar</Btn>}
          {podeEditar&&c.status==="ativo"&&<Btn size="sm" v="danger" onClick={()=>encerrar(c)}>Encerrar</Btn>}
        </div>
      </div>
      {r.itens.map(i=><div key={i.id} style={{marginTop:"var(--arcd-space-2)",paddingTop:"var(--arcd-space-1)",borderTop:"1px solid var(--arcd-border-default)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",fontSize:"var(--arcd-type-label)",flexWrap:"wrap"}}>
          <span className="brk" style={{color:"var(--arcd-text-primary)",fontWeight:"var(--arcd-font-weight-semibold)",minWidth:0}}>{nomeMat(i.materialId)} · {fmt(i.precoUnit)}/{purchaseUnitOf(i)}</span>
          <span style={{color:i.saldo>0?"var(--arcd-text-primary)":"var(--arcd-danger-text)",fontWeight:"var(--arcd-font-weight-semibold)",whiteSpace:"nowrap"}}>saldo {i.saldo.toLocaleString("pt-BR")} de {Number(i.qtdContratada).toLocaleString("pt-BR")} {purchaseUnitOf(i)}</span>
        </div>
        <div style={{height:5,background:"var(--arcd-surface-muted)",borderRadius:3,marginTop:"var(--arcd-space-1)",overflow:"hidden"}}><div style={{width:`${i.percentual}%`,height:"100%",background:i.percentual>=90?"var(--arcd-warning-text)":"var(--arcd-action-primary)"}}/></div>
      </div>)}
      {c.status!=="ativo"&&c.motivoEncerramento&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>Encerrado por {c.encerradoPor}: {c.motivoEncerramento}</p>}
    </div>;})}
    {form&&<ModalContrato form={form} setForm={setForm} onSave={salvar} fornecedores={fornecedores} materiais={materiais} obras={obras} C={C}/>}
  </>;
}
