import { BRAND } from "../brand/identity.js";
import { useEffect, useState } from "react";

// Página pública do aceite do pedido pelo fornecedor (C2.5). O código vem no
// fragmento da URL (#...), que o navegador nunca envia ao servidor nem em
// Referer; só esta página o lê e manda no corpo da requisição.
const tokenDaUrl=()=>decodeURIComponent(String(window.location.hash||"").replace(/^#/,""));
const brl=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dataBr=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value).split("-").reverse().join("/"):"";

const chamar=async body=>{
  const resposta=await fetch("/api/data",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const json=await resposta.json().catch(()=>({}));
  if(!resposta.ok)throw new Error(json.error||"Não foi possível concluir. Tente novamente.");
  return json;
};

const cores={fundo:"#F3F0E9",cartao:"#ffffff",texto:"#0D1B2E",suave:"#536171",borda:"#D9DDE2",ouro:"#7B6030",verde:"#1f7a4d",vermelho:"#b3261e"};
const campo={width:"100%",boxSizing:"border-box",padding:"10px 12px",border:`1px solid ${cores.borda}`,borderRadius:8,fontSize:"var(--arcd-type-card-title)",fontFamily:"inherit",background:"#fff",color:cores.texto};
const rotulo={display:"block",fontSize:"var(--arcd-type-body)",fontWeight:600,color:cores.suave,margin:"12px 0 4px"};

export default function SupplierAcceptancePage(){
  const [token]=useState(tokenDaUrl);
  const [estado,setEstado]=useState({carregando:true,erro:"",dados:null});
  const [form,setForm]=useState({nome:"",previsao:"",observacao:""});
  const [enviando,setEnviando]=useState(false);
  const [confirmado,setConfirmado]=useState(false);

  useEffect(()=>{
    document.title="Aceite do pedido de compra";
    if(!token){setEstado({carregando:false,erro:"Link de aceite inválido.",dados:null});return;}
    let ativo=true;
    chamar({action:"pedido-aceite-ver",token})
      .then(dados=>{if(!ativo)return;setEstado({carregando:false,erro:"",dados});setForm(f=>({...f,previsao:dados.pedido?.previsao||""}));})
      .catch(error=>{if(ativo)setEstado({carregando:false,erro:error.message,dados:null});});
    return()=>{ativo=false;};
  },[token]);

  const confirmar=async event=>{
    event.preventDefault();
    if(form.nome.trim().length<3){setEstado(s=>({...s,erro:"Informe o nome de quem confirma o pedido."}));return;}
    setEnviando(true);
    try{
      await chamar({action:"pedido-aceite-confirmar",token,...form});
      setConfirmado(true);setEstado(s=>({...s,erro:""}));
    }catch(error){setEstado(s=>({...s,erro:error.message}));}
    finally{setEnviando(false);}
  };

  const {carregando,erro,dados}=estado;
  const pedido=dados?.pedido;
  return <main style={{minHeight:"100vh",background:cores.fundo,color:cores.texto,fontFamily:"var(--arcd-font-sans)",padding:"24px 16px"}}>
    <div style={{maxWidth:720,margin:"0 auto"}}>
      <p style={{fontSize:"var(--arcd-type-body)",fontWeight:600,letterSpacing:2,color:cores.ouro,margin:0}}>{pedido?.empresa||BRAND.name}</p>
      <h1 style={{fontSize:"var(--arcd-type-kpi)",margin:"6px 0 16px"}}>Aceite do pedido de compra{pedido?.numero?` ${pedido.numero}`:""}</h1>
      {carregando&&<p>Carregando o pedido…</p>}
      {!carregando&&!pedido&&<div role="alert" style={{background:cores.cartao,border:`1px solid ${cores.borda}`,borderRadius:12,padding:16}}><p style={{margin:0,color:cores.vermelho,fontWeight:600}}>{erro||"Pedido indisponível."}</p></div>}
      {pedido&&<>
        <section style={{background:cores.cartao,border:`1px solid ${cores.borda}`,borderRadius:12,padding:16}}>
          <p style={{margin:"0 0 4px"}}><b>Fornecedor:</b> {pedido.fornecedor}</p>
          {pedido.obra&&<p style={{margin:"0 0 4px"}}><b>Obra:</b> {pedido.obra}</p>}
          {pedido.enderecoEntrega&&<p style={{margin:"0 0 4px"}}><b>Entrega em:</b> {pedido.enderecoEntrega}</p>}
          {pedido.previsao&&<p style={{margin:0}}><b>Entrega prevista:</b> {dataBr(pedido.previsao)}</p>}
          <ul style={{listStyle:"none",padding:0,margin:"12px 0 0"}}>
            {pedido.itens.map((item,index)=><li key={index} style={{borderTop:`1px solid ${cores.borda}`,padding:"10px 0",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <span style={{flex:"1 1 200px",minWidth:0}}><b style={{display:"block",fontSize:"var(--arcd-type-body)"}}>{item.descricao}</b>
                <span style={{fontSize:"var(--arcd-type-body)",color:cores.suave}}>{item.qtd.toLocaleString("pt-BR")} {item.unidade} × {brl(item.precoUnit)}</span></span>
              <b style={{fontSize:"var(--arcd-type-body)",whiteSpace:"nowrap"}}>{brl(item.total)}</b>
            </li>)}
          </ul>
          <p style={{display:"flex",justifyContent:"space-between",gap:12,borderTop:`2px solid ${cores.texto}`,paddingTop:10,margin:0,fontWeight:600}}><span>Total do pedido</span><span style={{whiteSpace:"nowrap"}}>{brl(pedido.total)}</span></p>
        </section>
        {(confirmado||dados.situacao==="aceito")&&<section role="status" style={{marginTop:16,background:"#eaf5ee",border:`1px solid ${cores.verde}`,borderRadius:12,padding:16}}>
          <p style={{margin:0,color:cores.verde,fontWeight:600}}>Pedido aceito{pedido.aceite?.nome&&!confirmado?` por ${pedido.aceite.nome} em ${dataBr(pedido.aceite.data)}`:""}. Obrigado!</p>
        </section>}
        {dados.situacao==="alterado"&&!confirmado&&<section role="alert" style={{marginTop:16,background:"#fdeceb",border:`1px solid ${cores.vermelho}`,borderRadius:12,padding:16}}>
          <p style={{margin:0,color:cores.vermelho,fontWeight:600}}>Este pedido foi alterado depois do envio do link. Peça um novo link ao setor de Compras.</p>
        </section>}
        {dados.situacao==="pendente"&&!confirmado&&<form onSubmit={confirmar} style={{marginTop:16,background:cores.cartao,border:`1px solid ${cores.borda}`,borderRadius:12,padding:16}}>
          <h2 style={{fontSize:"var(--arcd-type-card-title)",margin:0}}>Confirmar o pedido</h2>
          <label style={rotulo} htmlFor="aceite-nome">Seu nome *</label>
          <input id="aceite-nome" style={campo} value={form.nome} maxLength={120} autoComplete="name" onChange={e=>setForm(f=>({...f,nome:e.target.value}))}/>
          <label style={rotulo} htmlFor="aceite-previsao">Data de entrega que vocês garantem</label>
          <input id="aceite-previsao" type="date" style={campo} value={form.previsao} onChange={e=>setForm(f=>({...f,previsao:e.target.value}))}/>
          <label style={rotulo} htmlFor="aceite-obs">Observação</label>
          <textarea id="aceite-obs" style={{...campo,minHeight:72}} maxLength={500} value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))}/>
          {erro&&<p role="alert" style={{color:cores.vermelho,fontWeight:600,margin:"12px 0 0"}}>{erro}</p>}
          <button type="submit" disabled={enviando} style={{marginTop:16,width:"100%",padding:"12px 16px",border:0,borderRadius:8,background:cores.texto,color:"#fff",fontSize:"var(--arcd-type-control)",fontWeight:600,cursor:enviando?"wait":"pointer"}}>{enviando?"Enviando…":"Aceitar pedido"}</button>
          <p style={{fontSize:"var(--arcd-type-body)",color:cores.suave,margin:"10px 0 0"}}>Link válido até {dataBr(String(dados.expiraEm||"").slice(0,10))}.</p>
        </form>}
      </>}
    </div>
  </main>;
}
