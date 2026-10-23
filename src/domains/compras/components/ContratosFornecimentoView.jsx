// Contratos de fornecimento (C2.4): preço acordado por insumo, fornecedor e
// vigência, com saldo de quantidade. Tudo é gravado por comando do servidor;
// o saldo vem de resumoContrato (contratado menos o pedido pelos pedidos vivos).
import { useMemo, useState } from "react";
import { Badge, Btn, Ic, Inp, Modal, Sel, fmt, fmtDate, today, uid } from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { resumoContrato } from "../supply-contracts";
import { purchaseUnitOf } from "../unit-conversion";

const itemVazio=()=>({id:uid(),materialId:"",unidadeRef:"UN",unidadeCompra:"UN",fatorConversao:1,precoUnit:"",qtdContratada:""});

function ModalContrato({form,setForm,onSave,fornecedores,materiais,obras,C}){
  const [salvando,setSalvando]=useState(false);
  const setItem=(i,patch)=>setForm(f=>({...f,itens:f.itens.map((x,k)=>k===i?{...x,...patch}:x)}));
  const total=(form.itens||[]).reduce((s,i)=>s+Number(i.precoUnit||0)*Number(i.qtdContratada||0),0);
  return <Modal title={form.numero?`Contrato ${form.numero}`:"Novo contrato de fornecimento"} onClose={()=>setForm(null)} wide>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Sel label="Fornecedor *" value={form.fornecedorId} onChange={v=>setForm(f=>({...f,fornecedorId:v}))}
        options={[{v:"",l:"Selecione..."},...fornecedores.map(f=>({v:f.id,l:f.nome}))]}/>
      <Sel label="Obra" value={form.obraId||""} onChange={v=>setForm(f=>({...f,obraId:v}))}
        options={[{v:"",l:"Todas as obras"},...obras.map(o=>({v:o.id,l:o.name}))]}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9}}>
        <Inp label="Início da vigência *" type="date" value={form.vigenciaInicio} onChange={v=>setForm(f=>({...f,vigenciaInicio:v}))}/>
        <Inp label="Fim da vigência *" type="date" value={form.vigenciaFim} onChange={v=>setForm(f=>({...f,vigenciaFim:v}))}/>
      </div>
      <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text}}>Insumos e preços acordados</p>
      {(form.itens||[]).map((it,i)=><div key={it.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,alignItems:"end"}}>
        <div style={{gridColumn:"1/-1"}}><Sel label={`Insumo ${i+1} *`} value={it.materialId} onChange={v=>{const m=materiais.find(x=>x.id===v);setItem(i,{materialId:v,unidadeRef:m?.unidade||"UN",unidadeCompra:m?.unidade||"UN",fatorConversao:1});}}
          options={[{v:"",l:"Selecione..."},...materiais.map(m=>({v:m.id,l:`${m.descricao} (${m.unidade})`}))]}/></div>
        <Inp label={`Preço acordado (R$/${purchaseUnitOf(it)}) *`} type="number" value={it.precoUnit} onChange={v=>setItem(i,{precoUnit:v})}/>
        <Inp label={`Quantidade contratada (${purchaseUnitOf(it)}) *`} type="number" value={it.qtdContratada} onChange={v=>setItem(i,{qtdContratada:v})}/>
        {(form.itens||[]).length>1&&<button type="button" onClick={()=>setForm(f=>({...f,itens:f.itens.filter((_,k)=>k!==i)}))} style={{background:"transparent",border:0,color:C.muted,fontSize:"var(--arcd-type-control)",cursor:"pointer",textDecoration:"underline",paddingBottom:9,justifySelf:"start"}}>remover</button>}
      </div>)}
      <Btn v="ghost" onClick={()=>setForm(f=>({...f,itens:[...(f.itens||[]),itemVazio()]}))}><Ic n="plus"/> Insumo</Btn>
      <Inp label="Observação" value={form.observacao||""} onChange={v=>setForm(f=>({...f,observacao:v}))} multiline/>
      <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text}}>Valor contratado: {fmt(total)}</p>
      <div style={{display:"flex",gap:8}}>
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
    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap"}}>
      <div><b style={{fontSize:"var(--arcd-type-body)",color:C.text}}>Contratos de fornecimento</b>
        <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>Preço acordado por insumo e período. O pedido pelo contrato dispensa cotação e consome o saldo.</p></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <Btn size="sm" v="ghost" onClick={()=>setMostrarEncerrados(v=>!v)}>{mostrarEncerrados?"Só ativos":"Mostrar encerrados"}</Btn>
        {podeEditar&&<Btn size="sm" onClick={()=>setForm({id:"",fornecedorId:"",obraId:"",vigenciaInicio:hoje,vigenciaFim:"",observacao:"",itens:[itemVazio()]})}><Ic n="plus"/> Novo contrato</Btn>}
      </div>
    </div>
    {!contratos.length&&<div style={{padding:26,textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:9,background:C.card,marginTop:10}}>
      <p style={{fontSize:"var(--arcd-type-body)",fontWeight:600,color:C.text}}>Nenhum contrato de fornecimento</p>
      <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:3}}>Cadastre os acordos de preço com fornecedores (ex.: concreto 30 MPa a R$ 520/m³ até março).</p></div>}
    {contratos.map(c=>{const r=resumoContrato(data,c),vencido=c.vigenciaFim<hoje;return <div key={c.id} style={{marginTop:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
        <div style={{minWidth:0}}><b style={{fontSize:"var(--arcd-type-body)",color:C.text}}>{c.numero} · {nomeForn(c.fornecedorId)}</b>
          <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>{fmtDate(c.vigenciaInicio)} a {fmtDate(c.vigenciaFim)} · {c.obraId?obras.find(o=>o.id===c.obraId)?.name||"Obra":"Todas as obras"} · {fmt(r.valorConsumido)} de {fmt(r.valorContratado)}</p></div>
        <div style={{display:"flex",gap:5,alignItems:"flex-start",flexWrap:"wrap"}}>
          <Badge color={c.status!=="ativo"?C.muted:vencido?C.orange:C.green}>{c.status!=="ativo"?"ENCERRADO":vencido?"VENCIDO":"VIGENTE"}</Badge>
          {podeEditar&&c.status==="ativo"&&<Btn size="sm" v="ghost" onClick={()=>setForm({...c,itens:c.itens.map(i=>({...i,precoUnit:String(i.precoUnit),qtdContratada:String(i.qtdContratada)}))})}><Ic n="edit"/> Editar</Btn>}
          {podeEditar&&c.status==="ativo"&&<Btn size="sm" v="danger" onClick={()=>encerrar(c)}>Encerrar</Btn>}
        </div>
      </div>
      {r.itens.map(i=><div key={i.id} style={{marginTop:7,paddingTop:6,borderTop:`1px solid ${C.line}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:"var(--arcd-type-label)",flexWrap:"wrap"}}>
          <span className="brk" style={{color:C.text,fontWeight:600,minWidth:0}}>{nomeMat(i.materialId)} · {fmt(i.precoUnit)}/{purchaseUnitOf(i)}</span>
          <span style={{color:i.saldo>0?C.text:C.red,fontWeight:600,whiteSpace:"nowrap"}}>saldo {i.saldo.toLocaleString("pt-BR")} de {Number(i.qtdContratada).toLocaleString("pt-BR")} {purchaseUnitOf(i)}</span>
        </div>
        <div style={{height:5,background:C.surface,borderRadius:3,marginTop:4,overflow:"hidden"}}><div style={{width:`${i.percentual}%`,height:"100%",background:i.percentual>=90?C.orange:C.blue}}/></div>
      </div>)}
      {c.status!=="ativo"&&c.motivoEncerramento&&<p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:6}}>Encerrado por {c.encerradoPor}: {c.motivoEncerramento}</p>}
    </div>;})}
    {form&&<ModalContrato form={form} setForm={setForm} onSave={salvar} fornecedores={fornecedores} materiais={materiais} obras={obras} C={C}/>}
  </>;
}
