// ===================================================================
// ComprasView — tela de Compras extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-16, seguindo o mesmo padrão de Terceiros/Orçamento/Conciliação.
// Inclui os 4 modais exclusivos de Compras (ModalSolicitacaoCompra,
// ModalPedido, ModalCotacao, ModalRecebimento) que viviam logo antes da
// função no arquivo original. Mesma camada de dados, sem nova
// migration/RLS. Ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #4.
// ===================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "../../../components/charts/LazyRecharts";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  ArcdChartTooltip, Badge, Btn, C, C_ARCD_SETOR, ChartPanel, FornecedorEditorPilot,
  Ic, Inp, LinksDocumentosAuditaveis, Modal, ModalCotacaoWhatsApp, ModalLegendaDocumento,
  ModoIADocumento, PageHero, Sel, TabRow, TYPO,
  arquivoComoDataUrl, calcCompras, calcOrcadoComprado, compactNumber, fmt, fmtCompact,
  fmtDate, fornecedoresParaMateriais, guardaPreco, linkWhatsApp, maiusculoOrcamento,
  melhorPrecoHist, mensagemWhatsAppCobranca, mensagemWhatsAppCompra, niveisUmOrcamento,
  oportunidadesConsolidacao, pedidosEmAtraso, proximoCodigoArcd, rotuloRamo, slaSolicitacao,
  today, uid, UNIDADES_PADRAO, CATS_MATERIAL,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { SAVE_QUEUE_STATE } from "../../sync/save-queue";
import { getPlanningBudget } from "../../orcamentos/calculations";
import { consolidateReferenceBases as consolidarBasesReferencia } from "../../orcamentos/reference-bases";
import {
  STATUS_PEDIDO, statusPedido, totalPedido, recebidoPedido, pendentePedido,
  totalPagoPedido, saldoPagamentoPedido, statusPagamentoPedido,
  pedidoLiberadoParaReceber, origemPagamentoLabel, situacaoCaixaObra,
  historicoPrecoTodos, analisePreco, mapaGerencialCompras,
} from "../calculations";
import { canManagePurchases } from "../permissions";
import {
  changePurchaseRequestProject,
  purchaseRequestSummary,
  validatePurchaseRequest,
} from "../purchase-request-workflow";
import {
  conversionFactorOf, hasValidUnitConversion, purchaseUnitOf,
  referencePricePerPurchaseUnit, referenceQuantityOf, referenceTotalOf,
  suggestedSteelConversion,
} from "../unit-conversion";
import {
  enviarArquivoOneDrive, listarBasesReferencia, pesquisarInsumosReferencia,
} from "../../../api";

function ModalSolicitacaoCompra({form,setForm,onSave,basesReferencia=[],obras=[],data,update,showToast}){
  const {formGrid}=useBreakpoint();
  const [busca,setBusca]=useState("");const [resultados,setResultados]=useState([]);
  const [loading,setLoading]=useState(false);const [aviso,setAviso]=useState("");
  const [novoInsumo,setNovoInsumo]=useState(null);
  const [salvando,setSalvando]=useState(false);
  const [erros,setErros]=useState({fieldErrors:{},items:[]});
  const [confirmarSaida,setConfirmarSaida]=useState(false);
  const [removido,setRemovido]=useState(null);
  const [tentativaBusca,setTentativaBusca]=useState(0);
  const inicialRef=useRef(JSON.stringify(form));
  const base=basesReferencia.find(item=>item.id===form.referenciaId);
  // A apropriação operacional já pode começar no rascunho. A baseline
  // aprovada continua prioritária e exclusiva para os indicadores financeiros.
  const contextoOrcamento=getPlanningBudget(data,form.obraId);
  const orcObra=contextoOrcamento.budget;
  const linhasOrc=niveisUmOrcamento(orcObra).map(n=>({v:n.id,l:`${n.descricao} · ${fmt(n.orcado)}`}));
  const F=k=>v=>{setErros(e=>({...e,fieldErrors:{...(e.fieldErrors||{}),[k]:""}}));setForm(f=>({...f,[k]:v}));};
  const fechar=()=>{
    if(JSON.stringify(form)!==inicialRef.current){setConfirmarSaida(true);return;}
    setForm(null);
  };
  const trocarObra=obraId=>{
    if(obraId===form.obraId)return;
    setErros({fieldErrors:{},items:[]});
    setForm(f=>changePurchaseRequestProject(f,obraId));
  };
  const removerItem=id=>setForm(f=>{
    const index=f.itens.findIndex(item=>item.id===id);if(index<0)return f;
    setRemovido({item:f.itens[index],index});
    return {...f,itens:f.itens.filter(item=>item.id!==id)};
  });
  const desfazerRemocao=()=>{if(!removido)return;setForm(f=>{const itens=[...f.itens];itens.splice(Math.min(removido.index,itens.length),0,removido.item);return{...f,itens};});setRemovido(null);};
  const enviar=async()=>{
    const validacao=validatePurchaseRequest(form);setErros(validacao);
    if(!validacao.valid){
      const primeiro=validacao.firstInvalidItem?.id;
      window.setTimeout(()=>document.querySelector(primeiro?`[data-request-item="${primeiro}"] [aria-invalid="true"]`:`.purchase-request-modal [aria-invalid="true"]`)?.focus(),0);
      showToast?.("Revise os campos destacados antes de formalizar a solicitação.","error");return;
    }
    setSalvando(true);
    try{await onSave(form);}finally{setSalvando(false);}
  };
  const setItem=(id,campo,valor)=>setForm(f=>({...f,itens:f.itens.map(item=>item.id===id?{...item,[campo]:valor}:item)}));
  const setUnidadeCompra=(id,unidadeCompra)=>setForm(f=>({...f,itens:f.itens.map(item=>{
    if(item.id!==id)return item;
    const mesmaUnidade=String(unidadeCompra).toUpperCase()===String(item.unidadeRef||"UN").toUpperCase();
    const steel=suggestedSteelConversion(item,unidadeCompra,item.comprimentoBarra||12);
    return {...item,unidadeCompra,fatorConversao:mesmaUnidade?1:(steel?.factor||(Number(item.fatorConversao)>1?item.fatorConversao:"")),
      ...(steel?.purchaseUnit==="BR"?{comprimentoBarra:item.comprimentoBarra||12}:{})};
  })}));
  const setComprimentoBarra=(id,comprimentoBarra)=>setForm(f=>({...f,itens:f.itens.map(item=>{
    if(item.id!==id)return item;
    const steel=suggestedSteelConversion(item,item.unidadeCompra,comprimentoBarra);
    return {...item,comprimentoBarra,fatorConversao:steel?.factor||""};
  })}));
  // Duplica um item já lançado - forma rápida de apropriar o mesmo insumo
  // (ex.: cimento) em outra etapa do orçamento, só trocando quantidade/etapa.
  const duplicarItem=id=>setForm(f=>{
    const original=f.itens.find(item=>item.id===id);
    if(!original)return f;
    const copia={...original,id:uid(),quantidade:"",orcNivel1Id:""};
    const indice=f.itens.findIndex(item=>item.id===id);
    const itens=[...f.itens];itens.splice(indice+1,0,copia);
    return {...f,itens};
  });
  const abrirNovoInsumo=()=>setNovoInsumo({descricao:busca&&!resultados.length?busca:"",unidade:"un",categoria:"outros",precoMedio:""});
  const salvarNovoInsumo=()=>{
    if(!novoInsumo.descricao.trim()){showToast?.("Informe a descrição do insumo.","error");return;}
    const material={id:uid(),codigo:proximoCodigoArcd(data),descricao:maiusculoOrcamento(novoInsumo.descricao.trim()),
      unidade:novoInsumo.unidade||"un",categoria:novoInsumo.categoria||"outros",estoqueMin:0,
      precoMedio:Number(novoInsumo.precoMedio||0),ativo:true};
    setForm(f=>({...f,itens:[...f.itens,{id:uid(),materialId:material.id,referenciaId:"",fonteRef:"PRÓPRIO",
      codigoRef:material.codigo,descricaoRef:material.descricao,unidadeRef:material.unidade,
      unidadeCompra:material.unidade,fatorConversao:1,quantidade:"",precoRef:material.precoMedio,
      dataBaseRef:"",ufRef:"",orcItemId:"",orcNivel1Id:"",observacao:""}]}));
    setNovoInsumo(null);
    showToast?.("Insumo adicionado. Ele será salvo no catálogo junto com a formalização.");
  };

  useEffect(()=>{
    let ativo=true;const termo=busca.trim();
    if(!form.referenciaId||termo.length<2){setResultados([]);setAviso("");setLoading(false);return()=>{ativo=false;};}
    setLoading(true);const timer=window.setTimeout(async()=>{
      const resposta=await pesquisarInsumosReferencia([form.referenciaId],termo);if(!ativo)return;
      if(resposta.ok){setResultados((resposta.items||[]).filter(item=>item.tipoItem==="INSUMO"));setAviso(resposta.warning||"");}
      else{setResultados([]);setAviso(resposta.error||"Não foi possível pesquisar a base.");}
      setLoading(false);
    },260);return()=>{ativo=false;window.clearTimeout(timer);};
  },[busca,form.referenciaId,tentativaBusca]);

  const precoRef=item=>{const p=base?.desonerado===false?Number(item.precoNao||0):Number(item.precoDes||0);return p||Number(item.precoDes||0)||Number(item.precoNao||0);};
  const addReferencia=item=>{
    setForm(f=>({...f,itens:[...f.itens,{id:uid(),materialId:"",referenciaId:f.referenciaId,fonteRef:maiusculoOrcamento(item.fonte||base?.fonte||"SINAPI"),
      codigoRef:maiusculoOrcamento(item.codigo||""),descricaoRef:maiusculoOrcamento(item.descricao||""),unidadeRef:maiusculoOrcamento(item.unidade||"UN"),
      unidadeCompra:maiusculoOrcamento(item.unidade||"UN"),fatorConversao:1,quantidade:"",precoRef:precoRef(item),
      dataBaseRef:item.dataBase||base?.dataBase||"",ufRef:item.uf||base?.uf||"",orcItemId:"",orcNivel1Id:"",observacao:""}]}));
    setBusca("");setResultados([]);
  };
  const addProprio=()=>setForm(f=>({...f,itens:[...f.itens,{id:uid(),materialId:"",referenciaId:"",fonteRef:"PRÓPRIO",codigoRef:"",descricaoRef:"",unidadeRef:"UN",unidadeCompra:"UN",fatorConversao:1,quantidade:"",precoRef:0,dataBaseRef:"",ufRef:"",orcItemId:"",orcNivel1Id:"",observacao:""}]}));

  const resumo=purchaseRequestSummary(form);
  return <Modal title={form.id?`Editar solicitação ${form.numero||""}`:"Solicitar materiais para Compras"} onClose={fechar} wide panelClass="purchase-request-modal"><div className="purchase-request-flow">
    <section className="purchase-request-section"><header><span>1</span><div><h3>Contexto da solicitação</h3><p>Defina onde e quando os materiais precisam chegar.</p></div></header>
    <div className="purchase-request-context" style={{gridTemplateColumns:formGrid(3)}}>
      <div><Sel label="Obra *" value={form.obraId} onChange={trocarObra} options={obras.map(o=>({v:o.id,l:o.name}))}/>{erros.fieldErrors?.obraId&&<small className="purchase-request-error" role="alert">{erros.fieldErrors.obraId}</small>}</div>
      <Inp label="Data necessária na obra *" type="date" value={form.necessidade} onChange={F("necessidade")} error={erros.fieldErrors?.necessidade}/>
      <Sel label="Prioridade" value={form.prioridade} onChange={F("prioridade")} options={[{v:"normal",l:"Normal"},{v:"urgente",l:"Urgente"}]}/>
    </div></section>
    <section className="purchase-request-section"><header><span>2</span><div><h3>Materiais</h3><p>Pesquise uma base oficial ou cadastre o insumo no catálogo.</p></div></header>
    <div className="purchase-request-search">
      <h4>Pesquisar insumo SINAPI / ORSE</h4>
      <Sel label="Base de referência" value={form.referenciaId||""} onChange={v=>{F("referenciaId")(v);setBusca("");setResultados([]);}}
        options={[{v:"",l:basesReferencia.length?"Selecione a base":"Nenhuma base de referência disponível"},...basesReferencia.map(b=>({v:b.id,l:`${b.fonte} · ${b.dataBase}${b.uf?` · ${b.uf}`:""}${b.fonte==="SINAPI"?` · ${b.desonerado===false?"NÃO DESONERADA":"DESONERADA"}`:""}`}))]}/>
      <Inp label="Código ou descrição" value={busca} onChange={setBusca} placeholder="Ex.: cimento, bloco, aço..."/>
      {form.referenciaId&&busca.trim().length===1&&<p className="purchase-request-hint">Digite pelo menos 2 caracteres para pesquisar.</p>}
      {(loading||aviso||resultados.length>0||busca.trim().length>=2)&&<div style={{maxHeight:220,overflowY:"auto",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:4}}>
        {loading&&<p className="purchase-request-hint" role="status">Pesquisando na base selecionada...</p>}{aviso&&<div className="purchase-request-search-error" role="alert"><span>{aviso}</span><Btn size="sm" v="ghost" onClick={()=>setTentativaBusca(n=>n+1)}>Tentar novamente</Btn></div>}
        {resultados.map((item,index)=><button className="purchase-request-result" key={`${item.fonte}-${item.codigo}-${index}`} onClick={()=>addReferencia(item)} title={item.descricao}><b>{item.fonte} {item.codigo}</b><span>{item.descricao}</span><strong>{fmt(precoRef(item))}/{item.unidade}</strong></button>)}
        {!loading&&!resultados.length&&!aviso&&<p style={{fontSize:10,color:C.muted,textAlign:"center",padding:8}}>Nenhum insumo encontrado.</p>}
      </div>}
    </div>
    <div className="purchase-request-material-head"><h4>Materiais da solicitação</h4><div><Btn size="sm" v="ghost" onClick={addProprio}><Ic n="plus"/> Adicionar somente a esta solicitação</Btn>{data&&<Btn size="sm" v="warning" onClick={abrirNovoInsumo}><Ic n="plus"/> Cadastrar no catálogo e adicionar</Btn>}</div></div>
    {novoInsumo&&<div style={{background:`${C.orange}0A`,border:`1px solid ${C.orange}55`,borderRadius:7,padding:"10px 11px",display:"flex",flexDirection:"column",gap:8}}>
      <p style={{fontSize:10.5,fontWeight:900,color:C.orange}}>NOVO INSUMO NO CATÁLOGO</p>
      <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}>
        <Inp label="Descrição *" value={novoInsumo.descricao} onChange={v=>setNovoInsumo(f=>({...f,descricao:v}))} placeholder="Ex.: Cimento CP-II 50kg"/>
        <Sel label="Unidade *" value={novoInsumo.unidade} onChange={v=>setNovoInsumo(f=>({...f,unidade:v}))} options={UNIDADES_PADRAO.map(u=>({v:u.sigla,l:`${u.sigla} - ${u.nome}`}))}/>
        <Sel label="Categoria" value={novoInsumo.categoria} onChange={v=>setNovoInsumo(f=>({...f,categoria:v}))} options={CATS_MATERIAL}/>
      </div>
      <Inp label="Preço médio (R$)" type="number" value={novoInsumo.precoMedio} onChange={v=>setNovoInsumo(f=>({...f,precoMedio:v}))} placeholder="0,00"/>
      <div style={{display:"flex",gap:8}}><Btn size="sm" v="ghost" onClick={()=>setNovoInsumo(null)} full>Cancelar</Btn><Btn size="sm" onClick={salvarNovoInsumo} full><Ic n="check"/> Adicionar à solicitação</Btn></div>
    </div>}
    {removido&&<div className="purchase-request-undo" role="status"><span>Material removido da solicitação.</span><button type="button" onClick={desfazerRemocao}>Desfazer</button></div>}
    <div className="purchase-request-items">{form.itens.map((item,itemIndex)=>{const itemErrors=erros.items?.find(e=>e.id===item.id)?.errors||{};return <article key={item.id} data-request-item={item.id} className="purchase-request-item">
      <div className="purchase-request-item-main">
        <div><p style={{fontSize:8.5,color:C.muted,fontWeight:800,marginBottom:3}}>FONTE</p><b style={{fontSize:10,color:item.fonteRef==="ORSE"?C.purple:item.fonteRef==="PRÓPRIO"?C.orange:C.blue}}>{item.fonteRef}</b></div>
        <Inp label="Código" value={item.codigoRef} onChange={v=>setItem(item.id,"codigoRef",v)} placeholder="Opcional"/>
        <Inp label="Descrição *" value={item.descricaoRef} onChange={v=>setItem(item.id,"descricaoRef",v)} error={itemErrors.descricaoRef}/>
        <Inp label="Unidade *" value={item.unidadeRef} onChange={v=>setItem(item.id,"unidadeRef",v)} error={itemErrors.unidadeRef}/>
        <Inp label="Quantidade de compra *" type="number" min="0.0001" value={item.quantidade} onChange={v=>setItem(item.id,"quantidade",v)} error={itemErrors.quantidade}/>
        <Btn v="ghost" size="sm" iconOnly title="Duplicar para lançar em outra etapa" ariaLabel="Duplicar item" onClick={()=>duplicarItem(item.id)}><Ic n="copy" s={12}/></Btn>
        <button type="button" className="purchase-request-remove" aria-label={`Remover ${item.descricaoRef||`material ${itemIndex+1}`}`} onClick={()=>removerItem(item.id)}><Ic n="trash" s={14}/><span>Remover</span></button>
      </div>
      {(()=>{const unidadeCompra=purchaseUnitOf(item),unidadeRef=String(item.unidadeRef||"UN").toUpperCase();
        const conversaoAtiva=unidadeCompra!==unidadeRef;
        const conversaoAco=suggestedSteelConversion(item,unidadeCompra,item.comprimentoBarra||12);
        const quantidadeReferencia=referenceQuantityOf(item);
        const precoCompraRef=referencePricePerPurchaseUnit(item);
        return <div style={{display:"grid",gridTemplateColumns:formGrid(conversaoAtiva?3:2),gap:8,marginTop:7,padding:"8px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6}}>
          <Sel label="Unidade de compra" value={unidadeCompra} onChange={v=>setUnidadeCompra(item.id,v)}
            options={UNIDADES_PADRAO.map(u=>({v:u.sigla.toUpperCase(),l:`${u.sigla.toUpperCase()} · ${u.nome}`}))}/>
          {conversaoAco?.purchaseUnit==="BR"&&<Inp label="Comprimento da barra (m) *" type="number" value={item.comprimentoBarra||12} onChange={v=>setComprimentoBarra(item.id,v)} placeholder="12"/>}
          {conversaoAtiva&&<Inp label={`Conteúdo de 1 ${unidadeCompra} em ${unidadeRef} *`} type="number" min="0.0001" value={item.fatorConversao||""} onChange={v=>setItem(item.id,"fatorConversao",v)} placeholder="Ex.: 20" error={itemErrors.fatorConversao}/>}
          <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:3}}>
            <p style={{fontSize:8.5,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>Equivalência da solicitação</p>
            <p style={{fontSize:10.5,fontWeight:800,color:hasValidUnitConversion(item)?C.text:C.red,marginTop:3}}>
              {hasValidUnitConversion(item)
                ? `${Number(item.quantidade||0).toLocaleString("pt-BR")} ${unidadeCompra} = ${quantidadeReferencia.toLocaleString("pt-BR",{maximumFractionDigits:4})} ${unidadeRef}`
                : `Informe quanto contém cada ${unidadeCompra}`}
            </p>
            {conversaoAtiva&&precoCompraRef>0&&<p style={{fontSize:9,color:C.muted,marginTop:2}}>Referência convertida: {fmt(precoCompraRef)}/{unidadeCompra}</p>}
          </div>
          {conversaoAco&&<p style={{gridColumn:"1/-1",fontSize:9.5,color:C.blue,lineHeight:1.45}}>
            Conversão automática do aço{conversaoAco.diameterMm?` Ø ${conversaoAco.diameterMm.toLocaleString("pt-BR")} mm`:""}: {conversaoAco.kgPerMeter.toLocaleString("pt-BR",{maximumFractionDigits:4})} kg/m{conversaoAco.purchaseUnit==="BR"?` · barra de ${conversaoAco.barLength.toLocaleString("pt-BR")} m`:""}. O fator pode ser ajustado conforme o certificado do fabricante.
          </p>}
        </div>;})()}
      <div style={{marginTop:7}}><Sel label="Etapa principal do orçamento" value={item.orcNivel1Id||""} onChange={v=>setItem(item.id,"orcNivel1Id",v)} options={[{v:"",l:orcObra?"Selecione a etapa principal":"A obra ainda não possui orçamento"},...linhasOrc]}/></div>
      {contextoOrcamento.source==="rascunho"&&<p style={{fontSize:9,color:C.orange,marginTop:5}}>Vinculação ao orçamento em rascunho. A etapa organiza a compra, sem tornar esta versão uma baseline financeira.</p>}
      {item.precoRef>0&&<p style={{fontSize:9.5,color:C.muted,marginTop:5}}>Referência {item.dataBaseRef}{item.ufRef?` · ${item.ufRef}`:""}: <b style={{color:C.text}}>{fmt(Number(item.precoRef))}/{item.unidadeRef}</b></p>}
    </article>})}{!form.itens.length&&<div className="purchase-request-empty"><strong>Nenhum material adicionado</strong><p>Pesquise uma base oficial ou use uma das opções de cadastro acima.</p></div>}</div>
    <p className="purchase-request-hint">Para usar o mesmo insumo em etapas diferentes, duplique o material e ajuste quantidade e etapa.</p></section>
    <section className="purchase-request-section"><header><span>3</span><div><h3>Revisar e formalizar</h3><p>Confira o conteúdo que será enviado oficialmente ao setor de Compras.</p></div></header>
    <Inp label={form.prioridade==="urgente"?"Justificativa da urgência *":"Observação geral"} value={form.observacao} onChange={F("observacao")} multiline error={erros.fieldErrors?.observacao} placeholder="Local de entrega, especificação e impacto do prazo..."/>
    <div className="purchase-request-summary"><div><span>Obra</span><strong>{obras.find(o=>o.id===form.obraId)?.name||"Não selecionada"}</strong></div><div><span>Materiais</span><strong>{resumo.itemCount}</strong></div><div><span>Quantidade informada</span><strong>{resumo.totalQuantity.toLocaleString("pt-BR")}</strong></div><div><span>Prioridade</span><strong>{resumo.urgent?"Urgente":"Normal"}</strong></div></div>
    {erros.fieldErrors?.itens&&<p className="purchase-request-error" role="alert">{erros.fieldErrors.itens}</p>}
    <p className="purchase-request-formal-notice"><Ic n="lock" s={14}/> Ao confirmar, a solicitação será formalizada e registrada com autor, data e horário.</p>
    <div className="purchase-request-actions"><Btn v="ghost" onClick={fechar} disabled={salvando} full>Cancelar</Btn><Btn onClick={enviar} loading={salvando&&"Formalizando..."} full><Ic n="check"/> {form.id?"Salvar alterações":"Formalizar e enviar para Compras"}</Btn></div></section>
    {confirmarSaida&&<Modal title="Descartar alterações?" onClose={()=>setConfirmarSaida(false)}><p style={{fontSize:13,lineHeight:1.5,color:C.text}}>As alterações desta solicitação ainda não foram formalizadas.</p><div style={{display:"flex",gap:8,marginTop:16}}><Btn v="ghost" onClick={()=>setConfirmarSaida(false)} full>Continuar editando</Btn><Btn v="danger" onClick={()=>setForm(null)} full>Descartar alterações</Btn></div></Modal>}
  </div></Modal>;
}

function ModalPedido({ form, setForm, onSave, fornecedores, materiais, linhasOrc, data, basesReferencia=[] }) {
  const { formGrid } = useBreakpoint();
  const [buscaRef,setBuscaRef]=useState("");
  const [resultadosRef,setResultadosRef]=useState([]);
  const [buscandoRef,setBuscandoRef]=useState(false);
  const [avisoRef,setAvisoRef]=useState("");
  const baseSelecionada=basesReferencia.find(base=>base.id===form.referenciaId);

  // Sugestao de fornecedores: quem serve os materiais que ja estao no pedido.
  const sugFornecedores = useMemo(() => {
    const ids = (form.itens || []).map(i => i.materialId).filter(Boolean);
    if (!ids.length || !data) return [];
    return fornecedoresParaMateriais(data, ids).slice(0, 3);
  }, [form.itens, data]);
  // Historico de preco de TODOS os materiais, montado uma unica vez a partir
  // de data.pedidos. Sem isso, guardaPreco/melhorPrecoHist rescaneavam
  // data.pedidos inteiro POR LINHA do pedido A CADA TECLA digitada em
  // qualquer campo de preco (o formulario controlado re-renderiza o modal
  // inteiro a cada onChange).
  const historicoPorMaterial = useMemo(
    () => historicoPrecoTodos(data?.pedidos),
    [data?.pedidos]
  );
  const F = k => v => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i, campo, v) =>
    setForm(f => ({ ...f, itens: f.itens.map((x,k) => k===i ? {...x,[campo]:v} : x) }));
  const addItem = () => setForm(f => ({ ...f, itens:[...f.itens,
    {id:uid(),materialId:"",qtd:"",precoUnit:"",qtdRecebida:0,orcItemId:"",orcNivel1Id:"",referenciaId:"",fonteRef:"",codigoRef:"",descricaoRef:"",unidadeRef:"",unidadeCompra:"",fatorConversao:1,precoRef:0,dataBaseRef:"",ufRef:""}] }));
  const delItem = (i) => setForm(f => ({ ...f, itens: f.itens.filter((_,k)=>k!==i) }));
  // Duplica um item já lançado - forma rápida de apropriar o mesmo insumo
  // (ex.: cimento) em outra etapa do orçamento, só trocando quantidade/etapa.
  const duplicarItem = (i) => setForm(f => {
    const copia = { ...f.itens[i], id: uid(), qtd: "", qtdRecebida: 0, orcNivel1Id: "", orcItemId: "" };
    const itens = [...f.itens];
    itens.splice(i + 1, 0, copia);
    return { ...f, itens };
  });

  useEffect(()=>{
    let ativo=true;const termo=buscaRef.trim();
    if(!form.referenciaId||termo.length<2){setResultadosRef([]);setAvisoRef("");setBuscandoRef(false);return()=>{ativo=false;};}
    setBuscandoRef(true);
    const timer=window.setTimeout(async()=>{
      const resposta=await pesquisarInsumosReferencia([form.referenciaId],termo);
      if(!ativo)return;
      if(resposta.ok){
        setResultadosRef((resposta.items||[]).filter(item=>item.tipoItem==="INSUMO"));
        setAvisoRef(resposta.warning||"");
      }else{setResultadosRef([]);setAvisoRef(resposta.error||"Não foi possível pesquisar esta base.");}
      setBuscandoRef(false);
    },260);
    return()=>{ativo=false;window.clearTimeout(timer);};
  },[buscaRef,form.referenciaId]);

  const precoReferenciaResultado=item=>{
    const preferido=baseSelecionada?.desonerado===false?Number(item.precoNao||0):Number(item.precoDes||0);
    return preferido||Number(item.precoDes||0)||Number(item.precoNao||0);
  };
  const selecionarReferencia=item=>{
    const fonte=maiusculoOrcamento(item.fonte||baseSelecionada?.fonte||"");
    const codigo=maiusculoOrcamento(item.codigo||"").trim();
    const existente=materiais.find(m=>maiusculoOrcamento(m.codigo).trim()===codigo&&maiusculoOrcamento(m.fonteRef||fonte)===fonte);
    const linha={id:uid(),materialId:existente?.id||uid(),qtd:"",precoUnit:"",qtdRecebida:0,orcItemId:"",orcNivel1Id:"",
      referenciaId:form.referenciaId,fonteRef:fonte,codigoRef:codigo,
      descricaoRef:maiusculoOrcamento(item.descricao||""),unidadeRef:maiusculoOrcamento(item.unidade||"UN"),
      unidadeCompra:maiusculoOrcamento(item.unidade||"UN"),fatorConversao:1,
      precoRef:precoReferenciaResultado(item),dataBaseRef:item.dataBase||baseSelecionada?.dataBase||"",ufRef:item.uf||baseSelecionada?.uf||""};
    setForm(f=>{const pos=(f.itens||[]).findIndex(x=>!x.materialId&&!x.codigoRef);if(pos<0)return{...f,itens:[...(f.itens||[]),linha]};return{...f,itens:f.itens.map((x,i)=>i===pos?{...linha,id:x.id||linha.id}:x)};});
    setBuscaRef("");setResultadosRef([]);
  };

  const total = (form.itens||[]).reduce((s,i) => s + Number(i.qtd||0) * Number(i.precoUnit||0), 0);
  const totalReferencia = (form.itens||[]).reduce((s,i) => s + referenceTotalOf(i,i.qtd), 0);

  return (
    <Modal title={form.id ? `Pedido ${form.numero}` : "Novo pedido"} onClose={()=>setForm(null)} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:11}}>
          <Sel label="Fornecedor *" value={form.fornecedorId} onChange={F("fornecedorId")}
               options={[{v:"",l:"Selecione..."}, ...fornecedores.map(f=>({v:f.id,l:f.nome}))]}/>
          <Inp label="Data" type="date" value={form.data} onChange={F("data")}/>
          <Inp label="Previsão de entrega" type="date" value={form.previsao} onChange={F("previsao")}/>
          <Sel label="Situação" value={form.status} onChange={F("status")}
               options={[{v:"enviado",l:"Enviado ao fornecedor"},{v:"rascunho",l:"Rascunho"}]}/>
          <Sel label="Origem prevista do pagamento *" value={form.origemPagamento||"empresa"} onChange={F("origemPagamento")}
               options={[{v:"empresa",l:"Conta da empresa"},{v:"caixa_obra",l:"Caixa da obra"},{v:"cliente_direto",l:"Cliente paga diretamente"}]}/>
        </div>

        <div style={{background:form.origemPagamento==="cliente_direto"?`${C.blue}0C`:`${C.green}0C`,border:`1px solid ${form.origemPagamento==="cliente_direto"?C.blue:C.green}55`,borderRadius:7,padding:"8px 10px"}}>
          <p style={{fontSize:10.5,color:form.origemPagamento==="cliente_direto"?C.blue:C.green,fontWeight:800}}>
            {form.origemPagamento==="cliente_direto"
              ? "PAGAMENTO DIRETO DO CLIENTE — a compra será controlada e recebida normalmente, mas não será considerada saída do caixa da empresa."
              : form.origemPagamento==="caixa_obra"?"CAIXA DA OBRA — a entrega só será liberada após o financeiro registrar o pagamento e o comprovante.":"CONTA DA EMPRESA — a entrega só será liberada após o financeiro registrar o pagamento; a conciliação bancária fica rastreada."}
          </p>
        </div>

        {/* Sugestao de fornecedores para os materiais deste pedido */}
        {sugFornecedores.length > 0 && !form.fornecedorId && (
          <div style={{background:`${C.blue}0A`,border:`1px solid ${C.blue}44`,
                       borderRadius:6,padding:"9px 11px"}}>
            <p style={{fontSize:10.5,fontWeight:800,color:C.blue,marginBottom:6}}>
              Fornecedores que servem estes materiais:
            </p>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {sugFornecedores.map(s => (
                <button key={s.forn.id} onClick={()=>F("fornecedorId")(s.forn.id)} style={{
                  padding:"6px 10px",borderRadius:7,cursor:"pointer",
                  border:`1.5px solid ${C.blue}66`,background:C.card,
                  fontSize:11,fontWeight:700,color:C.text,textAlign:"left",
                }}>
                  {s.forn.nome}
                  <span style={{display:"block",fontSize:9,color:C.muted,fontWeight:500}}>
                    {s.motivos[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}40`,borderRadius:6,padding:"10px 11px",display:"flex",flexDirection:"column",gap:8}}>
          <div><p style={{fontSize:11.5,fontWeight:900,color:C.blue}}>SELECIONAR INSUMO SINAPI / ORSE</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Escolha a competência usada na comparação e pesquise por código ou descrição. Você pode trocar a base e incluir itens de fontes diferentes no mesmo pedido.</p></div>
          <Sel label="Base de referência para a pesquisa" value={form.referenciaId||""} onChange={v=>{F("referenciaId")(v);setBuscaRef("");setResultadosRef([]);}}
            options={[{v:"",l:basesReferencia.length?"Selecione a fonte, competência e UF":"Nenhuma base pronta no Supabase"},...basesReferencia.map(base=>({v:base.id,l:`${base.fonte} · ${base.dataBase}${base.uf?` · ${base.uf}`:""}${base.fonte==="SINAPI"?` · ${base.desonerado===false?"NÃO DESONERADA":"DESONERADA"}`:""}`}))]}/>
          <Inp label="Pesquisar insumo" value={buscaRef} onChange={setBuscaRef} placeholder="Ex.: cimento, areia, aço ou código..."/>
          {(buscandoRef||avisoRef||resultadosRef.length>0||buscaRef.trim().length>=2)&&<div style={{maxHeight:235,overflowY:"auto",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:4}}>
            {buscandoRef&&<p style={{fontSize:10,color:C.blue,padding:7}}>PESQUISANDO NA BASE...</p>}
            {avisoRef&&<p style={{fontSize:10,color:C.orange,padding:7}}>{avisoRef}</p>}
            {resultadosRef.map((item,index)=>{const preco=precoReferenciaResultado(item);return <button key={`${item.fonte}-${item.codigo}-${index}`} onClick={()=>selecionarReferencia(item)} style={{display:"grid",gridTemplateColumns:"105px minmax(0,1fr) 105px",gap:8,alignItems:"center",width:"100%",border:0,borderTop:index?`1px solid ${C.line}`:"none",background:"transparent",padding:"7px 8px",cursor:"pointer",textAlign:"left"}}>
              <b style={{fontSize:9.5,color:item.fonte==="ORSE"?C.purple:C.blue}}>{item.fonte} {item.codigo}</b>
              <span title={item.descricao} style={{fontSize:10.5,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descricao}</span>
              <span style={{fontSize:10,color:C.yellowD,textAlign:"right",fontWeight:800}}>{fmt(preco)}/{item.unidade}</span>
            </button>;})}
            {!buscandoRef&&!resultadosRef.length&&!avisoRef&&<p style={{fontSize:10,color:C.muted,textAlign:"center",padding:8}}>Nenhum insumo encontrado nesta base.</p>}
          </div>}
        </div>

        {(form.itens||[]).map((it, i) => (
          <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,
                               borderRadius:6,padding:"9px 11px"}}>
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
              <Sel label="Material" value={it.materialId} onChange={v=>setForm(f=>({...f,itens:f.itens.map((x,k)=>k===i?{...x,materialId:v,referenciaId:"",fonteRef:"",codigoRef:"",descricaoRef:"",unidadeRef:"",unidadeCompra:"",fatorConversao:1,precoRef:0,dataBaseRef:"",ufRef:""}:x)}))}
                   options={[{v:"",l:"Selecione..."},...(it.codigoRef&&!materiais.some(m=>m.id===it.materialId)?[{v:it.materialId,l:`${it.descricaoRef} (${it.unidadeRef})`}]:[]), ...materiais.map(m=>({v:m.id,l:`${m.descricao} (${m.unidade})`}))]}/>
              <Inp label={`Quantidade (${purchaseUnitOf(it)})`} type="number" value={it.qtd} onChange={v=>setItem(i,"qtd",v)}
                   placeholder="0"/>
              <div>
                <Inp label="Preço unitário (R$)" type="number" value={it.precoUnit}
                     onChange={v=>setItem(i,"precoUnit",v)} placeholder="0,00"/>
                {(() => {
                  // Guarda de preço: avisa NA HORA da digitação, antes de o
                  // dinheiro sair. Sem preço digitado, mostra a referência.
                  const h = it.materialId ? (historicoPorMaterial.get(it.materialId) || []) : null;
                  const g = data && it.materialId ? guardaPreco(h, it.precoUnit, fornecedores, referencePricePerPurchaseUnit(it)) : null;
                  if (g && g.nivel) {
                    const cor = g.nivel==="alto" ? C.red : g.nivel==="medio" ? C.orange : C.green;
                    return (
                      <div style={{marginTop:3,background:`${cor}0F`,border:`1px solid ${cor}`,borderRadius:5,padding:"5px 7px"}}>
                        {g.avisos.map((a,ai)=>(
                          <p key={ai} style={{fontSize:9.5,color:cor,fontWeight:800,lineHeight:1.35}}>
                            {a.nivel==="bom" ? "" : "! "}{a.texto}
                          </p>
                        ))}
                        {g.compras>1&&<p style={{fontSize:8.5,color:C.muted,marginTop:1}}>{g.compras} compra(s) deste material no histórico</p>}
                      </div>
                    );
                  }
                  const mp = it.materialId && data ? melhorPrecoHist(h, fornecedores) : null;
                  return mp ? (
                    <p style={{fontSize:9,color:C.green,marginTop:2}}>
                      melhor ja pago: {fmt(mp.preco)}{mp.fornecedor ? ` (${mp.fornecedor})` : ""}
                    </p>
                  ) : null;
                })()}
              </div>
              <div style={{display:"flex",alignItems:"flex-end"}}>
                <p style={{fontSize:12,fontWeight:800,color:C.text,paddingBottom:9}}>
                  = {fmt(Number(it.qtd||0) * Number(it.precoUnit||0))}
                </p>
              </div>

              {/* Apropriação ao orçamento */}
              <div style={{gridColumn:"1/-1"}}>
                <Sel label="Etapa de 1º nível do orçamento"
                     value={it.orcNivel1Id || ""}
                     onChange={v=>setItem(i,"orcNivel1Id",v)}
                     options={[
                       {v:"", l: linhasOrc.length ? "- sem apropriação -" : "Nenhum orçamento nesta obra"},
                       ...linhasOrc.map(l => ({
                         v: l.id,
                         l: `${l.descricao} (${fmt(l.orcado)})`,
                       })),
                     ]}/>
              </div>
            </div>
            {it.codigoRef&&<div style={{marginTop:7,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 9px"}}>
              <p style={{fontSize:10,fontWeight:800,color:it.fonteRef==="ORSE"?C.purple:C.blue}}>{it.fonteRef} {it.codigoRef} · {it.descricaoRef} · {it.unidadeRef}</p>
              <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Referência {it.dataBaseRef}{it.ufRef?` · ${it.ufRef}`:""}: <b style={{color:C.text}}>{fmt(referencePricePerPurchaseUnit(it))}/{purchaseUnitOf(it)}</b>{purchaseUnitOf(it)!==String(it.unidadeRef||"").toUpperCase()?` · 1 ${purchaseUnitOf(it)} = ${Number(it.fatorConversao||0).toLocaleString("pt-BR")} ${it.unidadeRef}`:""}</p>
              {Number(it.precoUnit)>0&&referencePricePerPurchaseUnit(it)>0&&(()=>{const ref=referencePricePerPurchaseUnit(it),dif=Number(it.precoUnit)-ref,pct=dif/ref*100,cor=dif<=0?C.green:C.red;return <p style={{fontSize:10.5,color:cor,fontWeight:900,marginTop:3}}>{dif<=0?"ABAIXO DA REFERÊNCIA":"ACIMA DA REFERÊNCIA"}: {fmt(Math.abs(dif))} ({Math.abs(pct).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%)</p>;})()}
            </div>}
            {!it.orcNivel1Id && !it.orcItemId && linhasOrc.length > 0 && Number(it.qtd) > 0 && (
              <p style={{fontSize:10,color:C.orange,marginTop:5}}>
                Sem apropriação: esta compra não entra na comparação com o orçamento.
              </p>
            )}
            {Number(it.qtdRecebida) > 0 && (
              <p style={{fontSize:10,color:C.green,marginTop:5,fontWeight:700}}>
                ok {it.qtdRecebida} já recebido - não dá para reduzir abaixo disso
              </p>
            )}
            <div style={{display:"flex",gap:12,marginTop:6}}>
              <button onClick={()=>duplicarItem(i)} style={{background:"transparent",border:0,color:C.blue,
                fontSize:10,cursor:"pointer",textDecoration:"underline"}}>duplicar (outra etapa)</button>
              {form.itens.length > 1 && Number(it.qtdRecebida) === 0 && (
                <button onClick={()=>delItem(i)} style={{background:"transparent",border:0,color:C.muted,
                  fontSize:10,cursor:"pointer",textDecoration:"underline"}}>remover item</button>
              )}
            </div>
          </div>
        ))}

        <Btn v="ghost" onClick={addItem} full><Ic n="plus"/> Adicionar item</Btn>

        <div style={{background:C.surface,border:`1.5px solid ${C.yellow}`,borderRadius:6,
                     padding:"10px 12px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9}}>
          <div><span style={{fontSize:10,color:C.muted,fontWeight:800}}>TOTAL DO PEDIDO</span><p style={{fontSize:16,fontWeight:800,color:C.yellow,fontFamily:"'Inter Display','Inter',sans-serif",marginTop:2}}>{fmt(total)}</p></div>
          <div><span style={{fontSize:10,color:C.muted,fontWeight:800}}>TOTAL NA REFERÊNCIA</span><p style={{fontSize:16,fontWeight:800,color:C.text,fontFamily:"'Inter Display','Inter',sans-serif",marginTop:2}}>{totalReferencia>0?fmt(totalReferencia):"-"}</p></div>
          {totalReferencia>0&&total>0&&(()=>{const dif=total-totalReferencia;const pct=dif/totalReferencia*100;const cor=dif<=0?C.green:C.red;return <div><span style={{fontSize:10,color:C.muted,fontWeight:800}}>COMPARAÇÃO</span><p style={{fontSize:12.5,fontWeight:900,color:cor,marginTop:3}}>{dif<=0?"ABAIXO":"ACIMA"} {fmt(Math.abs(dif))} · {Math.abs(pct).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%</p></div>;})()}
        </div>

        {form.id&&<Inp label="Motivo do ajuste *" value={form.motivoAjuste||""} onChange={F("motivoAjuste")} multiline placeholder="Explique o que foi corrigido e por quê. Esta justificativa ficará no histórico do pedido."/>}
        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setForm(null)} full>Cancelar</Btn>
          <Btn onClick={()=>onSave(form)} full><Ic n="check"/> Salvar</Btn>
        </div>
      </div>
    </Modal>
  );
}

function ModalCotacao({ form, setForm, onSave, fornecedores, materiais, linhasOrc=[] }) {
  const { formGrid } = useBreakpoint();
  const F = k => v => setForm(f => ({ ...f, [k]: v }));
  const setP = (i, campo, v) =>
    setForm(f => ({ ...f, propostas: f.propostas.map((x,k) => k===i ? {...x,[campo]:v} : x) }));
  const addP = () => setForm(f => ({ ...f, propostas:[...f.propostas,
    {id:uid(),fornecedorId:"",precoUnit:"",prazoDias:"",obs:"",documentos:[]}] }));
  const delP = (i) => setForm(f => ({ ...f, propostas: f.propostas.filter((_,k)=>k!==i) }));

  const validas = (form.propostas||[]).filter(p => Number(p.precoUnit) > 0);
  const menor = validas.length ? Math.min(...validas.map(p => Number(p.precoUnit))) : 0;
  const qtd = Number(form.qtd || 0);

  return (
    <Modal title="Nova cotação" onClose={()=>setForm(null)} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:11}}>
          <Sel label="Material *" value={form.materialId} onChange={v=>setForm(f=>{const material=materiais.find(m=>m.id===v);return{...f,materialId:v,unidadeRef:material?.unidade||"UN",unidadeCompra:material?.unidade||"UN",fatorConversao:1,precoRef:Number(material?.precoMedio||0)};})}
               options={[{v:"",l:"Selecione..."}, ...materiais.map(m=>({v:m.id,l:`${m.descricao} (${m.unidade})`}))]}/>
          <Inp label={`Quantidade (${purchaseUnitOf(form)}) *`} type="number" value={form.qtd} onChange={F("qtd")} placeholder="0"/>
          {form.unidadeCompra&&form.unidadeRef&&purchaseUnitOf(form)!==String(form.unidadeRef).toUpperCase()&&<p style={{gridColumn:"1/-1",fontSize:9.5,color:C.muted}}>Conversão herdada da solicitação: 1 {purchaseUnitOf(form)} = {Number(form.fatorConversao||0).toLocaleString("pt-BR")} {form.unidadeRef}. Referência equivalente: <b style={{color:C.text}}>{fmt(referencePricePerPurchaseUnit(form))}/{purchaseUnitOf(form)}</b>.</p>}
          <div style={{gridColumn:"1/-1"}}><Sel label="Etapa de 1º nível do orçamento" value={form.orcNivel1Id||""} onChange={F("orcNivel1Id")} options={[{v:"",l:linhasOrc.length?"Selecione a etapa principal":"Nenhuma etapa disponível"},...linhasOrc.map(l=>({v:l.id,l:`${l.descricao} · ${fmt(l.orcado)}`}))]}/></div>
        </div>

        <p style={{fontSize:11,color:C.muted}}>Propostas recebidas (mínimo 2):</p>

        {(form.propostas||[]).map((p, i) => {
          const eh = Number(p.precoUnit) > 0 && Number(p.precoUnit) === menor;
          const dif = (Number(p.precoUnit||0) - menor) * qtd;
          return (
            <div key={i} style={{
              background: eh ? `${C.yellow}0A` : C.surface,
              border:`1px solid ${eh ? C.yellow : C.border}`,
              borderRadius:6, padding:"9px 11px",
            }}>
              <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
                <Sel label="Fornecedor" value={p.fornecedorId} onChange={v=>setP(i,"fornecedorId",v)}
                     options={[{v:"",l:"Selecione..."}, ...fornecedores.map(f=>({v:f.id,l:f.nome}))]}/>
                <Inp label="Preço unitário (R$)" type="number" value={p.precoUnit}
                     onChange={v=>setP(i,"precoUnit",v)} placeholder="0,00"/>
                <Inp label="Prazo (dias)" type="number" value={p.prazoDias}
                     onChange={v=>setP(i,"prazoDias",v)} placeholder="0"/>
                <div style={{display:"flex",alignItems:"flex-end",paddingBottom:9}}>
                  {qtd > 0 && Number(p.precoUnit) > 0 && (
                    <div>
                      <p style={{fontSize:12,fontWeight:800,color:C.text}}>
                        {eh && " "}{fmt(Number(p.precoUnit) * qtd)}
                      </p>
                      {dif > 0.01 && (
                        <p style={{fontSize:10,color:C.red}}>+{fmt(dif)} vs. o menor</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {form.propostas.length > 2 && (
                <button onClick={()=>delP(i)} style={{background:"transparent",border:0,color:C.muted,
                  fontSize:10,cursor:"pointer",marginTop:6,textDecoration:"underline"}}>remover proposta</button>
              )}
            </div>
          );
        })}

        <Btn v="ghost" onClick={addP} full><Ic n="plus"/> Outra proposta</Btn>

        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setForm(null)} full>Cancelar</Btn>
          <Btn onClick={()=>onSave(form)} full><Ic n="check"/> Salvar cotação</Btn>
        </div>
      </div>
    </Modal>
  );
}

// Recebimento - o único lugar onde Compras encosta no Estoque.
// Aceita entrega PARCIAL, porque na obra o caminhão chega faltando item.
function ModalRecebimento({ pedido, onClose, onReceber, nomeMat, unidMat, nomeForn }) {
  const [qtds, setQtds] = useState(() =>
    Object.fromEntries(pedido.itens.map(i => {
      const falta = Number(i.qtd) - Number(i.qtdRecebida || 0);
      return [i.id, String(falta > 0 ? falta : 0)];   // sugere o que falta
    }))
  );

  const set = (id, v) => setQtds(q => ({ ...q, [id]: v }));

  const linhas = pedido.itens.map(i => {
    const falta = Number(i.qtd) - Number(i.qtdRecebida || 0);
    const chegou = Number(qtds[i.id] || 0);
    return { ...i, falta, chegou, excede: chegou > falta + 1e-6 };
  });

  const temExcesso = linhas.some(l => l.excede);
  const valorTotal = linhas.reduce((s,l) => s + l.chegou * Number(l.precoUnit||0), 0);

  return (
    <Modal title={`Receber - ${pedido.numero}`} onClose={onClose} wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
          <p style={{fontSize:12,fontWeight:700,color:C.text}}>{nomeForn(pedido.fornecedorId)}</p>
          <p style={{fontSize:10.5,color:C.muted,marginTop:2}}>
            Informe o que <strong>realmente chegou</strong>. Pode receber parcial - o
            pedido fica em aberto até completar.
          </p>
        </div>

        {linhas.map(l => (
          <div key={l.id} style={{
            background: l.excede ? `${C.red}08` : C.card,
            border:`1px solid ${l.excede ? C.red : C.border}`,
            borderRadius:6, padding:"10px 11px",
          }}>
            <p className="brk" style={{fontSize:12,fontWeight:700,color:C.text}}>{nomeMat(l.materialId)}</p>
            <p style={{fontSize:10,color:C.muted,marginTop:2,marginBottom:7}}>
              Pedido: {l.qtd} {purchaseUnitOf(l)}
              {Number(l.qtdRecebida) > 0 && `  já recebido: ${l.qtdRecebida}`}
              {l.falta > 0 && `  falta: ${l.falta}`}
            </p>
            <Inp label={`Chegou agora (${purchaseUnitOf(l)})`} type="number"
                 value={qtds[l.id]} onChange={v=>set(l.id, v)}/>
            {purchaseUnitOf(l)!==String(l.unidadeRef||"").toUpperCase()&&<p style={{fontSize:9,color:C.muted,marginTop:4}}>{l.chegou.toLocaleString("pt-BR")} {purchaseUnitOf(l)} equivalem a {referenceQuantityOf(l,l.chegou).toLocaleString("pt-BR",{maximumFractionDigits:4})} {l.unidadeRef} no estoque.</p>}
            {l.excede && (
              <p style={{fontSize:10,color:C.red,marginTop:5,fontWeight:700}}>
                ! Só faltam {l.falta}. Receber a mais esconde erro de nota fiscal.
              </p>
            )}
          </div>
        ))}

        <div style={{background:`${C.green}0A`,border:`1.5px solid ${C.green}`,
                     borderRadius:6,padding:"10px 12px"}}>
          <p style={{fontSize:11,color:C.muted}}>
            Vai entrar no estoque da obra:
          </p>
          <p style={{fontSize:16,fontWeight:800,color:C.green,marginTop:2,
                     fontFamily:"'Inter Display','Inter',sans-serif"}}>{fmt(valorTotal)}</p>
          <p style={{fontSize:10,color:C.muted,marginTop:4,lineHeight:1.45}}>
            Pagamento já verificado. Esta ação confirma somente a chegada física e
            atualiza o estoque; não duplica o lançamento financeiro.
          </p>
        </div>

        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
          <Btn onClick={()=>onReceber(pedido, qtds)} full disabled={temExcesso || valorTotal <= 0}>
            <Ic n="check"/> Dar entrada no estoque
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export default function Compras({ data, update, showToast, currentUser, obraIdFixo="", C=C_ARCD_SETOR, dispatchCommand=null }) {
  const { cols, pick, isDesktop } = useBreakpoint();
  const [aba,     setAba]     = useState(["engenheiro","engenheiro_auditor"].includes(currentUser?.role)?"solicitacoes":currentUser?.role==="financeiro"?"financeiro":"mapa");
  const [obraSel, setObraSel] = useState(obraIdFixo);
  const [busca,   setBusca]   = useState("");

  const [pedModal,  setPedModal]  = useState(null);
  const [recModal,  setRecModal]  = useState(null);   // recebimento
  const [cotModal,  setCotModal]  = useState(null);
  const [cotDecisao,setCotDecisao]=useState(null);
  const [fornModal, setFornModal] = useState(null);
  const [solModal,setSolModal]=useState(null);
  const [modoIA,setModoIA]=useState(false);
  const [basesReferenciaCompra,setBasesReferenciaCompra]=useState([]);
  const [escopoHistorico,setEscopoHistorico]=useState("obra");
  const [periodoHistorico,setPeriodoHistorico]=useState("12");
  const [buscaFornecedorHistorico,setBuscaFornecedorHistorico]=useState("");
  const [fornecedorHistoricoId,setFornecedorHistoricoId]=useState("");
  const [materialHistoricoId,setMaterialHistoricoId]=useState("");
  const [fornecedorPrecoId,setFornecedorPrecoId]=useState("");
  const [buscaHistoricoCompra,setBuscaHistoricoCompra]=useState("");
  const [statusHistoricoCompra,setStatusHistoricoCompra]=useState("todos");
  const [fornecedorHistoricoCompra,setFornecedorHistoricoCompra]=useState("");
  const [anexoCotacao,setAnexoCotacao]=useState(null);
  const [subindoAnexoCotacao,setSubindoAnexoCotacao]=useState(false);
  const [pagModal,setPagModal]=useState(null);
  const [excluirCompraModal,setExcluirCompraModal]=useState(null);
  const [subindoComprovantePagamento,setSubindoComprovantePagamento]=useState(false);
  const [cancelandoCompra,setCancelandoCompra]=useState(false);
  const [filtroFinanceiro,setFiltroFinanceiro]=useState("pendentes");
  const [buscaCotacao,setBuscaCotacao]=useState("");
  const [statusCotacao,setStatusCotacao]=useState("todas");
  const [inicioCotacao,setInicioCotacao]=useState("");
  const [fimCotacao,setFimCotacao]=useState("");
  const [cotacaoExpandida,setCotacaoExpandida]=useState("");
  const [menuComprasAberto,setMenuComprasAberto]=useState(false);
  const [escopoMapa,setEscopoMapa]=useState(obraIdFixo?"obra":"empresa");
  const [filtroKanban,setFiltroKanban]=useState("ativos");

  const obras       = (data.obras || []).filter(o=>!currentUser?.obraId||o.id===currentUser.obraId);
  const obraAtual   = obraIdFixo || obraSel || obras[0]?.id || "";
  // Escopo de "todas as obras" (empresa) x obra única - fonte única para o
  // KPI, as listas e o kanban, para não mostrar números de recortes diferentes
  // na mesma tela.
  const obraIdsMapa=useMemo(()=>
    escopoMapa==="empresa"&&!obraIdFixo?obras.map(o=>o.id):[obraAtual],
    [escopoMapa,obraIdFixo,obras,obraAtual]);
  const todasObras = escopoMapa==="empresa"&&!obraIdFixo;
  const materiais   = useMemo(() => (data.materiais||[]).filter(m => m.ativo !== false), [data.materiais]);
  const fornecedores= useMemo(() => (data.fornecedores||[]).filter(f => f.ativo !== false), [data.fornecedores]);
  // Historico de preco de TODOS os materiais numa unica passada por
  // data.pedidos (usado na aba "Histórico de preços" - antes rescaneava
  // data.pedidos inteiro por material, a cada render).
  const historicoPorMaterial = useMemo(() => historicoPrecoTodos(data.pedidos), [data.pedidos]);

  useEffect(()=>{
    let ativo=true;
    listarBasesReferencia().then(resultado=>{if(!ativo)return;if(resultado.ok)setBasesReferenciaCompra(consolidarBasesReferencia((resultado.bases||[]).filter(base=>base.status==="ready")));});
    return()=>{ativo=false;};
  },[]);

  const contextoOrcamentoCompra=useMemo(
    ()=>getPlanningBudget(data,obraAtual),
    [data.orcamentos,data.budgetBaselines,obraAtual]
  );
  const basesCompra=useMemo(()=>{
    const orcamento=contextoOrcamentoCompra.budget;
    const vinculadas=new Set(orcamento?.referencias||[]);
    return [...basesReferenciaCompra].sort((a,b)=>Number((b.idsEquivalentes||[b.id]).some(id=>vinculadas.has(id)))-Number((a.idsEquivalentes||[a.id]).some(id=>vinculadas.has(id)))||String(b.dataBase||"").localeCompare(String(a.dataBase||"")));
  },[basesReferenciaCompra,contextoOrcamentoCompra.budget]);
  const podeProcessar=canManagePurchases(currentUser?.role);
  const solicitacoes=useMemo(()=>(data.solicitacoesCompra||[]).filter(s=>obraIdsMapa.includes(s.obraId))
    .sort((a,b)=>{
      // SLA estourado sobe: solicitacao parada e obra parada.
      const ea=slaSolicitacao(a,today())?.status==="estourado"?1:0;
      const eb=slaSolicitacao(b,today())?.status==="estourado"?1:0;
      return (eb-ea)||(b.criadoEm||"").localeCompare(a.criadoEm||"");
    }),[data.solicitacoesCompra,obraIdsMapa]);
  // Consolidacao multi-obra: mesmo material pedido por obras diferentes.
  const consolidar=useMemo(()=>oportunidadesConsolidacao(data,today()),[data.solicitacoesCompra,data.obras]);
  // O contador precisa usar a mesma obra da lista. Antes ele somava todas as
  // obras visíveis e podia anunciar "2 para analisar" sobre uma lista vazia.
  const solicitacoesPendentes=solicitacoes.filter(s=>s.status==="enviada").length;

  const kpi = useMemo(() => calcCompras(data, obraIdsMapa), [data.pedidos, data.movEstoque, data.transacoes, obraIdsMapa]);
  const orcVs = useMemo(() => calcOrcadoComprado(data, obraAtual), [data.orcamentos, data.pedidos, obraAtual]);
  // Entregas atrasadas (todas as obras visiveis) e mapa por pedido.
  const atrasados = useMemo(() => pedidosEmAtraso(data, today())
    .filter(x => obras.some(o => o.id === x.pedido.obraId)), [data.pedidos, data.materiais, obras]);
  const atrasoDe = useMemo(() => { const m = {}; atrasados.forEach(x => { m[x.pedido.id] = x; }); return m; }, [atrasados]);
  // Cotacao em massa por WhatsApp: {itens:[{descricao,qtd,unidade}], titulo, materialIds}
  const [cotWpp, setCotWpp] = useState(null);

  // Apenas etapas de primeiro nível: a equipe compra por pacote de trabalho,
  // sem navegar por centenas de composições da planilha.
  const linhasOrc = useMemo(
    () => niveisUmOrcamento(contextoOrcamentoCompra.budget),
    [contextoOrcamentoCompra.budget]
  );

  const nomeForn = useCallback(
    (id) => fornecedores.find(f => f.id === id)?.nome || "-",
    [fornecedores]
  );
  const nomeMat = useCallback(
    (id) => materiais.find(m => m.id === id)?.descricao || "-",
    [materiais]
  );
  const unidMat = useCallback(
    (id) => materiais.find(m => m.id === id)?.unidade || "un",
    [materiais]
  );

  const pedidos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (data.pedidos||[])
      .filter(p => obraIdsMapa.includes(p.obraId))
      .filter(p => !t || (p.numero||"").toLowerCase().includes(t) ||
                          nomeForn(p.fornecedorId).toLowerCase().includes(t))
      .sort((a,b) => (b.data||"").localeCompare(a.data||""));
  }, [data.pedidos, obraIdsMapa, busca, nomeForn]);

  const resumoOperacional = useMemo(() => {
    const todos=(data.pedidos||[]).filter(p=>obraIdsMapa.includes(p.obraId)&&p.status!=="cancelado");
    const porStatus={rascunho:0,enviado:0,parcial:0,recebido:0};
    todos.forEach(p=>{const s=statusPedido(p);porStatus[s]=(porStatus[s]||0)+1;});
    const ultima=[...todos].sort((a,b)=>(b.data||"").localeCompare(a.data||""))[0];
    return {total:todos.length,porStatus,ultima,fornecedores:new Set(todos.map(p=>p.fornecedorId).filter(Boolean)).size};
  },[data.pedidos,obraIdsMapa]);
  const pedidosFinanceiros=useMemo(()=>{
    const lista=(data.pedidos||[]).filter(p=>obraIdsMapa.includes(p.obraId)&&!['cancelado','rascunho'].includes(p.status));
    return lista.filter(p=>filtroFinanceiro==="todos"||
      (filtroFinanceiro==="pendentes"&&statusPagamentoPedido(p)!=="pago")||
      (filtroFinanceiro==="liberados"&&statusPagamentoPedido(p)==="pago"&&statusPedido(p)!=="recebido")||
      (filtroFinanceiro==="nao_conciliados"&&(p.pagamentos||[]).some(pg=>!pg.conciliado)))
      .sort((a,b)=>Number(statusPagamentoPedido(a)==="pago")-Number(statusPagamentoPedido(b)==="pago")||(a.previsao||"9999").localeCompare(b.previsao||"9999"));
  },[data.pedidos,obraIdsMapa,filtroFinanceiro]);
  const resumoFinanceiro=useMemo(()=>{
    const lista=(data.pedidos||[]).filter(p=>obraIdsMapa.includes(p.obraId)&&!['cancelado','rascunho'].includes(p.status));
    const pagamentos=lista.flatMap(p=>p.pagamentos||[]);
    return{pendentes:lista.filter(p=>statusPagamentoPedido(p)!=="pago").length,aPagar:lista.reduce((s,p)=>s+saldoPagamentoPedido(p),0),
      liberados:lista.filter(p=>statusPagamentoPedido(p)==="pago"&&statusPedido(p)!=="recebido").length,
      naoConciliado:pagamentos.filter(pg=>!pg.conciliado).reduce((s,pg)=>s+Number(pg.valor||0),0),
      empresa:pagamentos.filter(pg=>pg.origem==="empresa").reduce((s,pg)=>s+Number(pg.valor||0),0),
      caixaObra:pagamentos.filter(pg=>pg.origem==="caixa_obra").reduce((s,pg)=>s+Number(pg.valor||0),0),
      cliente:pagamentos.filter(pg=>pg.origem==="cliente_direto").reduce((s,pg)=>s+Number(pg.valor||0),0)};
  },[data.pedidos,obraIdsMapa]);
  const caixaPagamento=useMemo(()=>situacaoCaixaObra(data,obraAtual),[data.caixaObra,obraAtual]);
  const obraTemCaixa=!!(data.obras||[]).find(o=>o.id===obraAtual)?.hasCaixa;
  const mapaCompras=useMemo(()=>mapaGerencialCompras(data,obraIdsMapa,today()),[
    data.pedidos,data.solicitacoesCompra,data.cotacoes,data.fornecedores,obraAtual,
    obraIdsMapa
  ]);
  const pedidosMapa=useMemo(()=>(data.pedidos||[])
    .filter(p=>obraIdsMapa.includes(p.obraId)&&p.status!=="cancelado")
    .sort((a,b)=>String(b.data||"").localeCompare(String(a.data||""))||String(b.criadoEm||"").localeCompare(String(a.criadoEm||""))),
    [data.pedidos,obraIdsMapa]);

  const pedidosPorPagador=useMemo(()=>{
    const grupos={empresa:[],caixa_obra:[],cliente_direto:[]};
    pedidosMapa.forEach(p=>{
      const origem=["empresa","caixa_obra","cliente_direto"].includes(p.origemPagamento)?p.origemPagamento:"empresa";
      grupos[origem].push(p);
    });
    return grupos;
  },[pedidosMapa]);

  const cotacoes = useMemo(
    () => (data.cotacoes||[]).filter(c => obraIdsMapa.includes(c.obraId))
            .sort((a,b) => (b.data||"").localeCompare(a.data||"")),
    [data.cotacoes, obraIdsMapa]
  );

  // Maps id->registro, montados uma vez, para as linhas de Pedidos e
  // Solicitações não fazerem .find() em data.fornecedores/obras/materiais/
  // pedidos por linha renderizada (era O(n) por linha, agora O(1)).
  const fornecedorPorId = useMemo(() => new Map((data.fornecedores||[]).map(f => [f.id, f])), [data.fornecedores]);
  const obraPorId       = useMemo(() => new Map((data.obras||[]).map(o => [o.id, o])), [data.obras]);
  const materialPorId   = useMemo(() => new Map((data.materiais||[]).map(m => [m.id, m])), [data.materiais]);
  const solicitacaoPorId= useMemo(() => new Map((data.solicitacoesCompra||[]).map(s => [s.id, s])), [data.solicitacoesCompra]);
  const cotacoesFiltradas=useMemo(()=>{
    const termo=buscaCotacao.trim().toLocaleLowerCase("pt-BR");
    return cotacoes.filter(c=>{
      if(statusCotacao!=="todas"&&c.status!==statusCotacao)return false;
      if(inicioCotacao&&String(c.data||"")<inicioCotacao)return false;
      if(fimCotacao&&String(c.data||"")>fimCotacao)return false;
      if(!termo)return true;
      const material=materialPorId.get(c.materialId);
      const fornecedoresCotacao=(c.propostas||[]).map(p=>fornecedorPorId.get(p.fornecedorId)?.nome||"").join(" ");
      const solicitacao=solicitacaoPorId.get(c.solicitacaoId);
      return [c.numero,c.id,material?.codigo,material?.descricao,fornecedoresCotacao,solicitacao?.numero]
        .some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(termo));
    });
  },[cotacoes,buscaCotacao,statusCotacao,inicioCotacao,fimCotacao,materialPorId,fornecedorPorId,solicitacaoPorId]);
  const pedidoPorId     = useMemo(() => new Map((data.pedidos||[]).map(p => [p.id, p])), [data.pedidos]);
  const kanbanCompras=useMemo(()=>{
    const hoje=new Date(`${today()}T12:00:00`).getTime();
    const risco=(dataPrazo,concluido=false)=>{
      if(concluido)return{nivel:"concluido",cor:C.green,rotulo:"Concluído"};
      if(!dataPrazo)return{nivel:"sem_prazo",cor:C.muted,rotulo:"Sem prazo"};
      const dias=Math.ceil((new Date(`${String(dataPrazo).slice(0,10)}T12:00:00`).getTime()-hoje)/86400000);
      if(dias<0)return{nivel:"atrasado",cor:C.red,rotulo:`${Math.abs(dias)}d atrasado`};
      if(dias<=3)return{nivel:"atencao",cor:C.yellowD,rotulo:dias===0?"Vence hoje":`${dias}d restantes`};
      return{nivel:"no_prazo",cor:C.green,rotulo:`${dias}d restantes`};
    };
    const cotacaoAtivaPorSolicitacao=new Set((data.cotacoes||[]).filter(c=>c.status!=="cancelada").map(c=>c.solicitacaoId).filter(Boolean));
    const pedidosAtivos=(data.pedidos||[]).filter(p=>p.obraId===obraAtual&&p.status!=="cancelado");
    const colunas=[
      {id:"demanda",titulo:"Demandas",sub:"Aguardam análise",cor:C.blue,cards:[]},
      {id:"cotacao",titulo:"Cotações",sub:"Comparação de propostas",cor:C.purple,cards:[]},
      {id:"pedido",titulo:"Pedidos a pagar",sub:"Compromisso financeiro",cor:C.orange,cards:[]},
      {id:"entrega",titulo:"Em entrega",sub:"Material a caminho",cor:C.yellowD,cards:[]},
      {id:"concluido",titulo:"Concluídos",sub:"Recebimento confirmado",cor:C.green,cards:[]},
    ];
    const porId=new Map(colunas.map(c=>[c.id,c]));
    (data.solicitacoesCompra||[]).filter(s=>s.obraId===obraAtual&&!["cancelada","pedido_gerado"].includes(s.status)&&!cotacaoAtivaPorSolicitacao.has(s.id)).forEach(s=>{
      const prazo=s.necessidade||s.dataNecessidade||s.prazo||"";
      porId.get("demanda").cards.push({id:s.id,tipo:"solicitacao",codigo:s.numero||"Solicitação",titulo:(s.itens||[])[0]?.descricaoRef||s.observacao||"Materiais da obra",detalhe:`${(s.itens||[]).length} item(ns) · ${s.prioridade||"normal"}`,prazo,risco:risco(prazo),registro:s});
    });
    (data.cotacoes||[]).filter(c=>c.obraId===obraAtual&&c.status==="aberta"&&!c.pedidoId).forEach(c=>{
      const sol=solicitacaoPorId.get(c.solicitacaoId);const prazo=sol?.necessidade||sol?.dataNecessidade||"";
      porId.get("cotacao").cards.push({id:c.id,tipo:"cotacao",codigo:c.numero||"Cotação",titulo:materialPorId.get(c.materialId)?.descricao||"Material",detalhe:`${(c.propostas||[]).length} proposta(s) · ${Number(c.qtd||0).toLocaleString("pt-BR")} ${unidMat(c.materialId)}`,prazo,risco:risco(prazo),registro:c});
    });
    pedidosAtivos.forEach(p=>{
      const status=statusPedido(p),pago=statusPagamentoPedido(p)==="pago",concluido=status==="recebido";
      const coluna=concluido?"concluido":pago?"entrega":"pedido";
      const prazo=p.previsao||p.dataEntrega||"";
      const itens=(p.itens||[]);const primeiro=itens[0];
      porId.get(coluna).cards.push({id:p.id,tipo:"pedido",codigo:p.numero||"Pedido",titulo:primeiro?(materialPorId.get(primeiro.materialId)?.descricao||primeiro.descricaoRef||"Material"):"Pedido de compra",detalhe:`${fornecedorPorId.get(p.fornecedorId)?.nome||"Fornecedor não definido"}${itens.length>1?` · +${itens.length-1} item(ns)`:""}`,valor:totalPedido(p),prazo,risco:risco(prazo,concluido),registro:p});
    });
    colunas.forEach(col=>col.cards.sort((a,b)=>{
      const ordem={atrasado:0,atencao:1,sem_prazo:2,no_prazo:3,concluido:4};
      return ordem[a.risco.nivel]-ordem[b.risco.nivel]||String(a.prazo||"9999").localeCompare(String(b.prazo||"9999"));
    }));
    return colunas;
  },[data.solicitacoesCompra,data.cotacoes,data.pedidos,obraAtual,solicitacaoPorId,materialPorId,fornecedorPorId,unidMat,C]);

  const inicioPeriodoHistorico=useMemo(()=>{
    if(periodoHistorico==="todos")return "";
    const d=new Date(`${today()}T12:00:00`);
    d.setMonth(d.getMonth()-Number(periodoHistorico||12));
    return d.toISOString().slice(0,10);
  },[periodoHistorico]);
  const obraVisivelHistorico=useCallback(obraId=>{
    if(!obras.some(o=>o.id===obraId))return false;
    return escopoHistorico==="todas"&&!obraIdFixo?true:obraId===obraAtual;
  },[obras,escopoHistorico,obraIdFixo,obraAtual]);
  const pedidosHistorico=useMemo(()=>(data.pedidos||[])
    .filter(p=>p.status!=="cancelado"&&obraVisivelHistorico(p.obraId))
    .filter(p=>!inicioPeriodoHistorico||String(p.data||"")>=inicioPeriodoHistorico)
    .sort((a,b)=>String(b.data||"").localeCompare(String(a.data||""))),
    [data.pedidos,obraVisivelHistorico,inicioPeriodoHistorico]);
  const comprasHistoricoFiltradas=useMemo(()=>{
    const termo=buscaHistoricoCompra.trim().toLowerCase();
    return pedidosHistorico.filter(p=>{
      const status=statusPedido(p);
      if(statusHistoricoCompra!=="todos"&&status!==statusHistoricoCompra)return false;
      if(fornecedorHistoricoCompra&&p.fornecedorId!==fornecedorHistoricoCompra)return false;
      if(!termo)return true;
      const texto=[p.numero,fornecedorPorId.get(p.fornecedorId)?.nome,obraPorId.get(p.obraId)?.name,
        ...(p.itens||[]).map(i=>materialPorId.get(i.materialId)?.descricao||i.descricaoRef)].filter(Boolean).join(" ").toLowerCase();
      return texto.includes(termo);
    });
  },[pedidosHistorico,buscaHistoricoCompra,statusHistoricoCompra,fornecedorHistoricoCompra,fornecedorPorId,obraPorId,materialPorId]);
  const resumoFornecedoresHistorico=useMemo(()=>{
    const mapa=new Map();
    pedidosHistorico.forEach(p=>{
      if(!p.fornecedorId)return;
      const atual=mapa.get(p.fornecedorId)||{fornecedorId:p.fornecedorId,pedidos:0,comprado:0,recebido:0,ultima:"",obras:new Set(),materiais:new Set()};
      atual.pedidos+=1;
      atual.comprado+=totalPedido(p);
      atual.recebido+=recebidoPedido(p);
      atual.ultima=String(p.data||"")>atual.ultima?String(p.data||""):atual.ultima;
      if(p.obraId)atual.obras.add(p.obraId);
      (p.itens||[]).forEach(i=>i.materialId&&atual.materiais.add(i.materialId));
      mapa.set(p.fornecedorId,atual);
    });
    const termo=buscaFornecedorHistorico.trim().toLowerCase();
    return [...mapa.values()].map(r=>({...r,fornecedor:fornecedorPorId.get(r.fornecedorId)}))
      .filter(r=>!termo||String(r.fornecedor?.nome||"").toLowerCase().includes(termo)||String(r.fornecedor?.cnpj||"").includes(termo))
      .sort((a,b)=>b.recebido-a.recebido||b.comprado-a.comprado||String(a.fornecedor?.nome||"").localeCompare(String(b.fornecedor?.nome||"")));
  },[pedidosHistorico,buscaFornecedorHistorico,fornecedorPorId]);
  const fornecedorHistoricoAtualId=fornecedorHistoricoId&&resumoFornecedoresHistorico.some(r=>r.fornecedorId===fornecedorHistoricoId)
    ?fornecedorHistoricoId:(resumoFornecedoresHistorico[0]?.fornecedorId||"");
  const resumoFornecedorAtual=resumoFornecedoresHistorico.find(r=>r.fornecedorId===fornecedorHistoricoAtualId);
  const pedidosFornecedorAtual=useMemo(()=>pedidosHistorico.filter(p=>p.fornecedorId===fornecedorHistoricoAtualId),[pedidosHistorico,fornecedorHistoricoAtualId]);
  const comprasMensaisFornecedor=useMemo(()=>{
    const mapa=new Map();
    [...pedidosFornecedorAtual].reverse().forEach(p=>{
      const chave=String(p.data||"").slice(0,7)||"Sem data";
      const atual=mapa.get(chave)||{mes:chave,comprado:0,recebido:0};
      atual.comprado+=totalPedido(p);atual.recebido+=recebidoPedido(p);mapa.set(chave,atual);
    });
    return [...mapa.values()].sort((a,b)=>a.mes.localeCompare(b.mes)).slice(-18).map(x=>({...x,rotulo:x.mes==="Sem data"?x.mes:new Date(`${x.mes}-02T12:00:00`).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"})}));
  },[pedidosFornecedorAtual]);
  const materiaisHistorico=useMemo(()=>materiais.map(m=>{
    const entradas=(historicoPorMaterial.get(m.id)||[]).filter(x=>obraVisivelHistorico(x.obraId)&&(!inicioPeriodoHistorico||String(x.data||"")>=inicioPeriodoHistorico));
    return {material:m,entradas};
  }).filter(x=>x.entradas.length).sort((a,b)=>String(a.material.descricao||"").localeCompare(String(b.material.descricao||""))),
  [materiais,historicoPorMaterial,obraVisivelHistorico,inicioPeriodoHistorico]);
  const materialHistoricoAtualId=materialHistoricoId&&materiaisHistorico.some(x=>x.material.id===materialHistoricoId)
    ?materialHistoricoId:(materiaisHistorico[0]?.material.id||"");
  const materialHistoricoAtual=materiaisHistorico.find(x=>x.material.id===materialHistoricoAtualId);
  const fornecedoresDoMaterial=useMemo(()=>[...new Set((materialHistoricoAtual?.entradas||[]).map(x=>x.fornecedorId).filter(Boolean))]
    .map(id=>fornecedorPorId.get(id)).filter(Boolean).sort((a,b)=>String(a.nome||"").localeCompare(String(b.nome||""))),[materialHistoricoAtual,fornecedorPorId]);
  const fornecedorPrecoAtualId=fornecedorPrecoId&&fornecedoresDoMaterial.some(f=>f.id===fornecedorPrecoId)?fornecedorPrecoId:"";
  const evolucaoMaterial=useMemo(()=>[...(materialHistoricoAtual?.entradas||[])]
    .filter(x=>!fornecedorPrecoAtualId||x.fornecedorId===fornecedorPrecoAtualId)
    .sort((a,b)=>String(a.data||"").localeCompare(String(b.data||""))),[materialHistoricoAtual,fornecedorPrecoAtualId]);
  const analiseMaterialAtual=useMemo(()=>analisePreco(evolucaoMaterial),[evolucaoMaterial]);
  const dadosGraficoPreco=useMemo(()=>evolucaoMaterial.map((x,idx)=>({
    id:`${x.pedidoId}-${idx}`,data:x.data,rotulo:x.data?new Date(`${x.data}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}):"-",
    preco:x.preco,media:analiseMaterialAtual?.medio||0,fornecedor:fornecedorPorId.get(x.fornecedorId)?.nome||"-",obra:obraPorId.get(x.obraId)?.name||"-",qtd:x.qtd,pedido:x.pedidoNumero||"-",
  })),[evolucaoMaterial,analiseMaterialAtual,fornecedorPorId,obraPorId]);

  //  Fornecedor 
  const salvarForn = async (f) => {
    if (!f.nome.trim()) { showToast("Informe o nome do fornecedor.", "error"); return; }
    const p = { ...f, id: f.id || uid(), nome: f.nome.trim(),
      categorias: Array.isArray(f.categorias) ? f.categorias : [], ativo: true };
    delete p.ramosSugeridos;
    if(!dispatchCommand){showToast("O cadastro seguro do fornecedor exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>{const vigente=(atual.fornecedores||[]).find(x=>x.id===p.id);return {type:OPERATIONAL_COMMAND.SUPPLIER_SAVED,idempotencyKey:`fornecedor-${p.id}-${uid()}`,expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{supplier:p}};});
    if(!result?.ok){showToast(result?.reason||"O fornecedor não foi confirmado pelo servidor.","error");return;}
    setFornModal(null);
    showToast(f.id ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
  };

  const normalizarChaveMaterial=valor=>maiusculoOrcamento(valor||"").trim().replace(/\s+/g," ");
  const localizarMaterialSolicitado=(item,lista)=>{
    const porId=item.materialId&&lista.find(m=>m.id===item.materialId);
    if(porId)return porId;
    const codigo=normalizarChaveMaterial(item.codigoRef);
    const fonte=normalizarChaveMaterial(item.fonteRef||"PRÓPRIO");
    if(codigo){
      const porCodigo=lista.find(m=>normalizarChaveMaterial(m.codigo)===codigo&&
        normalizarChaveMaterial(m.fonteRef||fonte)===fonte);
      if(porCodigo)return porCodigo;
    }
    const descricao=normalizarChaveMaterial(item.descricaoRef);
    const unidade=normalizarChaveMaterial(item.unidadeRef||"UN");
    return lista.find(m=>normalizarChaveMaterial(m.descricao)===descricao&&
      normalizarChaveMaterial(m.unidade||"UN")===unidade);
  };

  const salvarSolicitacao=async(f)=>{
    const validacao=validatePurchaseRequest(f);
    if(!validacao.valid){showToast("Revise todos os materiais antes de formalizar a solicitação.","error");return false;}
    const itensInformados=(f.itens||[])
      .map(i=>({...i,codigoRef:maiusculoOrcamento(i.codigoRef||""),descricaoRef:maiusculoOrcamento(i.descricaoRef),
        unidadeRef:maiusculoOrcamento(i.unidadeRef),unidadeCompra:purchaseUnitOf(i),
        fatorConversao:Number(i.fatorConversao||1),comprimentoBarra:Number(i.comprimentoBarra||0),
        quantidade:Number(i.quantidade),precoRef:Number(i.precoRef||0)}));
    if(!itensInformados.length){showToast("Adicione ao menos um material com descrição, unidade e quantidade.","error");return false;}
    if(itensInformados.some(item=>!hasValidUnitConversion(item))){
      showToast("Informe uma conversão válida para cada material comprado em unidade diferente da referência.","error");return false;
    }

    const solicitacaoId=f.id||uid();
    const materiaisAtualizados=[...(data.materiais||[])];
    const itens=itensInformados.map(item=>{
      let material=localizarMaterialSolicitado(item,materiaisAtualizados);
      const pertenceSolicitacao=material?.solicitacaoOrigemId===solicitacaoId;
      if(!material){
        const materialId=item.materialId||uid();
        const codigo=item.codigoRef||`SOL-${String(materialId).replace(/[^a-z0-9]/gi,"").slice(-6).toUpperCase()}`;
        material={id:materialId,codigo,descricao:item.descricaoRef,unidade:item.unidadeRef||"UN",
          categoria:"outros",estoqueMin:0,precoMedio:Number(item.precoRef||0),fonteRef:item.fonteRef||"PRÓPRIO",
          referenciaId:item.referenciaId||"",dataBaseRef:item.dataBaseRef||"",ufRef:item.ufRef||"",
          ativo:true,criadoVia:"solicitacao_compra",solicitacaoOrigemId:solicitacaoId};
        materiaisAtualizados.push(material);
      }else if(pertenceSolicitacao){
        material={...material,codigo:item.codigoRef||material.codigo,descricao:item.descricaoRef,
          unidade:item.unidadeRef||material.unidade,precoMedio:Number(item.precoRef||material.precoMedio||0),
          fonteRef:item.fonteRef||material.fonteRef,referenciaId:item.referenciaId||"",
          dataBaseRef:item.dataBaseRef||"",ufRef:item.ufRef||""};
        const pos=materiaisAtualizados.findIndex(m=>m.id===material.id);
        materiaisAtualizados[pos]=material;
      }
      return {...item,materialId:material.id,codigoRef:item.codigoRef||material.codigo,
        descricaoRef:item.descricaoRef||material.descricao,unidadeRef:item.unidadeRef||material.unidade};
    });

    const agora=new Date().toISOString();
    const proximaSequencia=Math.max(0,...(data.solicitacoesCompra||[]).map(s=>Number(String(s.numero||"").match(/\d+/)?.[0]||0)))+1;
    const numero=f.numero||`SC-${String(proximaSequencia).padStart(4,"0")}`;
    const anterior=f.id?(data.solicitacoesCompra||[]).find(s=>s.id===f.id):null;
    const registro={...(anterior||{}),id:solicitacaoId,numero,obraId:f.obraId,
      solicitanteId:anterior?.solicitanteId||currentUser?.id||"",
      solicitanteNome:anterior?.solicitanteNome||currentUser?.nome||"Engenharia",
      criadoEm:anterior?.criadoEm||agora,atualizadoEm:f.id?agora:"",
      atualizadoPor:f.id?(currentUser?.nome||""):"",
      formalizadoEm:anterior?.formalizadoEm||agora,
      formalizadoPorId:anterior?.formalizadoPorId||currentUser?.id||"",
      formalizadoPor:anterior?.formalizadoPor||currentUser?.nome||"Engenharia",
      necessidade:f.necessidade||"",prioridade:f.prioridade||"normal",status:anterior?.status||"enviada",
      observacao:f.observacao||"",analisadoEm:anterior?.analisadoEm||"",
      analisadoPor:anterior?.analisadoPor||"",pedidoId:anterior?.pedidoId||"",
      cotacaoIds:anterior?.cotacaoIds||[],aprovacaoInstanciaId:anterior?.aprovacaoInstanciaId||"",itens};
    const solicitacoesCompraBase=f.id
      ? (data.solicitacoesCompra||[]).map(s=>s.id===f.id?registro:s)
      : [...(data.solicitacoesCompra||[]),registro];

    // Nova solicitação -> dispara o motor de aprovação (§2). Sem nenhuma
    // política configurada, aprova automaticamente na hora - não trava
    // ninguém até o administrador definir as alçadas de verdade.
    let dataFinal={...data,materiais:materiaisAtualizados,solicitacoesCompra:solicitacoesCompraBase};
    if(!f.id){
      const valorTotalEstimado=itens.reduce((s,i)=>s+referenceTotalOf(i),0);
      const contexto={valorTotal:valorTotalEstimado,obraId:registro.obraId,categoria:"material",
        solicitanteId:registro.solicitanteId,urgencia:registro.prioridade};
      const {data:comAprovacao,resumo}=motorAprovacaoGenerico.iniciarInstancia(dataFinal,{
        entidadeTipo:"solicitacaoCompra",entidadeId:solicitacaoId,contexto,operador:currentUser,
        comportamentoSemPolitica:data.configAprovacao?.comportamentoSemPolitica||"auto_aprovar",
      });
      dataFinal={...comAprovacao,solicitacoesCompra:comAprovacao.solicitacoesCompra.map(s=>
        s.id===solicitacaoId?{...s,aprovacaoInstanciaId:resumo.instanciaId}:s)};
    }
    if(!dispatchCommand){
      showToast("O salvamento seguro da solicitação exige conexão com o servidor.","error");
      return false;
    }
    const solicitacaoFinal=(dataFinal.solicitacoesCompra||[]).find(s=>s.id===solicitacaoId)||registro;
    const catalogMaterials=(dataFinal.materiais||[]).filter(material=>
      String(material.solicitacaoOrigemId||"")===String(solicitacaoId));
    const approvalInstance=(dataFinal.instanciasAprovacao||[]).find(instance=>
      String(instance.id||"")===String(solicitacaoFinal.aprovacaoInstanciaId||""));
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.solicitacoesCompra||[]).find(s=>String(s.id)===String(solicitacaoId));
      return {
        type:OPERATIONAL_COMMAND.PURCHASE_REQUEST_SAVED,
        idempotencyKey:`solicitacao-compra-${solicitacaoId}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{request:solicitacaoFinal,catalogMaterials,approvalInstance},
      };
    });
    if(!result?.ok){
      const reason=result?.state===SAVE_QUEUE_STATE.OFFLINE
        ?"Sem conexão. A solicitação continua aberta para você tentar novamente quando a internet voltar."
        :result?.state===SAVE_QUEUE_STATE.CONFLICT
          ?"Outra pessoa alterou os dados ao mesmo tempo. A solicitação não foi formalizada; resolva o conflito e tente novamente."
          :"O servidor não confirmou a solicitação. Seus dados continuam no formulário para uma nova tentativa.";
      showToast(reason,"error");return false;
    }
    setSolModal(null);setAba("solicitacoes");
    showToast(f.id?`Solicitação ${numero} atualizada e confirmada pelo servidor.`:`Solicitação ${numero} formalizada com ${itens.length} insumo(s) e confirmada pelo servidor.`);
    return true;
  };

  // Instância de aprovação vinculada a uma solicitação (undefined = fluxo
  // legado sem aprovação configurada nesta base ainda).
  const instanciaAprovacaoDe=(sol)=>(data.instanciasAprovacao||[]).find(i=>i.id===sol?.aprovacaoInstanciaId);
  // Etapas (mesmo em paralelo) que estão aguardando decisão E onde o usuário
  // atual está entre os elegíveis - é isso que habilita o botão de decidir.
  const etapasPendentesParaMim=(instancia)=>{
    if(!instancia||instancia.status!=="em_andamento"||!instancia.snapshotPolitica)return[];
    return instancia.snapshotPolitica.etapas
      .map((e,i)=>({etapa:e,resultado:instancia.resultadosEtapas?.[i]}))
      .filter(({resultado})=>resultado?.status==="em_andamento"&&(resultado.aprovadoresElegiveis||[]).some(u=>u.id===currentUser?.id));
  };
  const decidirAprovacao=(instancia,etapaId,decisao,justificativa="")=>{
    const {data:next,resumo}=motorAprovacaoGenerico.registrarDecisao(data,{
      instanciaId:instancia.id,etapaId,aprovadorId:currentUser?.id||"",aprovadorNome:currentUser?.nome||currentUser?.email||"Operador",
      decisao,justificativa,contexto:{valorTotal:0},
    });
    if(!resumo.ok){showToast(resumo.motivo||"Não foi possível registrar a decisão.","error");return;}
    update(next);
    showToast(decisao==="aprovado"?"Aprovação registrada.":"Reprovação registrada.");
  };

  const atualizarStatusSolicitacao=(sol,status)=>{
    update({...data,solicitacoesCompra:(data.solicitacoesCompra||[]).map(s=>s.id===sol.id?{...s,status,
      analisadoEm:status==="em_analise"?new Date().toISOString():s.analisadoEm,
      analisadoPor:status==="em_analise"?(currentUser?.nome||""):s.analisadoPor}:s)});
  };

  // Registra que a solicitacao foi "emitida" para um fornecedor por WhatsApp
  // (clique no link wa.me em ModalCotacaoWhatsApp). Upsert por fornecedorId -
  // clicar de novo so atualiza o horario, nao duplica a linha.
  const registrarContatoSolicitacao=(solicitacaoId,fornecedorId,fornecedorNome)=>{
    if(!solicitacaoId)return;
    update({...data,solicitacoesCompra:(data.solicitacoesCompra||[]).map(s=>{
      if(s.id!==solicitacaoId)return s;
      const agora=new Date().toISOString();
      const existe=(s.contatos||[]).some(c=>c.fornecedorId===fornecedorId);
      const contatos=existe
        ? s.contatos.map(c=>c.fornecedorId===fornecedorId?{...c,enviadoEm:agora}:c)
        : [...(s.contatos||[]),{fornecedorId,fornecedorNome,enviadoEm:agora}];
      return {...s,contatos};
    })});
  };

  const gerarPedidoSolicitacao=(sol)=>{
    if(!podeProcessar){showToast("Somente o setor de Compras pode transformar a solicitação em pedido.","error");return;}
    const instanciaApr=instanciaAprovacaoDe(sol);
    if(instanciaApr&&instanciaApr.status!=="aprovada"){
      if(!window.confirm(`Esta solicitação ainda não foi aprovada (status: ${instanciaApr.status}). Deseja continuar mesmo assim?`))return;
    }
    const itens=sol.itens.map(item=>{
      const existente=materiais.find(m=>(item.codigoRef&&maiusculoOrcamento(m.codigo)===maiusculoOrcamento(item.codigoRef)&&maiusculoOrcamento(m.fonteRef||item.fonteRef)===maiusculoOrcamento(item.fonteRef))||
        (!item.codigoRef&&maiusculoOrcamento(m.descricao)===maiusculoOrcamento(item.descricaoRef)));
      return{id:uid(),materialId:item.materialId||existente?.id||uid(),qtd:String(item.quantidade),precoUnit:"",qtdRecebida:0,orcItemId:item.orcItemId||"",orcNivel1Id:item.orcNivel1Id||"",
        referenciaId:item.referenciaId||"",fonteRef:item.fonteRef||"PRÓPRIO",codigoRef:item.codigoRef||"",descricaoRef:item.descricaoRef||"",
        unidadeRef:item.unidadeRef||"UN",unidadeCompra:purchaseUnitOf(item),fatorConversao:Number(item.fatorConversao||1),
        comprimentoBarra:Number(item.comprimentoBarra||0),
        precoRef:Number(item.precoRef||0),dataBaseRef:item.dataBaseRef||"",ufRef:item.ufRef||""};
    });
    // Abrir o formulário não pode gerar um salvamento paralelo. O comando
    // PURCHASE_ORDER_SAVED confirma o pedido e muda a solicitação para
    // `pedido_gerado` na mesma transação do servidor.
    setPedModal({id:"",numero:"",obraId:sol.obraId,fornecedorId:"",data:new Date().toISOString().slice(0,10),previsao:sol.necessidade||"",
      status:"enviado",origemPagamento:"empresa",referenciaId:itens.find(i=>i.referenciaId)?.referenciaId||"",solicitacaoId:sol.id,itens,obs:`Solicitação ${sol.numero}${sol.observacao?` · ${sol.observacao}`:""}`});
  };

  const abrirCotacaoDaSolicitacao=(sol,item)=>{
    if(!podeProcessar){showToast("Somente Compras pode iniciar a cotação.","error");return;}
    const material=item.materialId&&materiais.find(m=>m.id===item.materialId);
    if(!material){showToast("O insumo ainda não está vinculado. Edite e salve a solicitação para regularizar.","error");return;}
    setCotModal({id:"",solicitacaoId:sol.id,obraId:sol.obraId,materialId:material.id,qtd:String(item.quantidade),
      orcItemId:item.orcItemId||"",orcNivel1Id:item.orcNivel1Id||"",data:today(),
      unidadeRef:item.unidadeRef||material.unidade||"UN",unidadeCompra:purchaseUnitOf(item),
      fatorConversao:Number(item.fatorConversao||1),comprimentoBarra:Number(item.comprimentoBarra||0),precoRef:Number(item.precoRef||0),
      propostas:[{id:uid(),fornecedorId:"",precoUnit:"",prazoDias:"",obs:"",documentos:[]},
        {id:uid(),fornecedorId:"",precoUnit:"",prazoDias:"",obs:"",documentos:[]}]});
  };

  //  Pedido 
  const salvarPedido = async(f) => {
    if (!f.fornecedorId) { showToast("Selecione o fornecedor.", "error"); return; }
    const novosMateriais=[];
    const itens = (f.itens||[])
      .filter(i => (i.materialId || i.codigoRef) && Number(i.qtd) > 0)
      .map(i => {
        let materialId=i.materialId||uid();
        if((i.codigoRef||i.descricaoRef)&&!(data.materiais||[]).some(m=>m.id===materialId)&&!novosMateriais.some(m=>m.id===materialId)){
          novosMateriais.push({id:materialId,codigo:maiusculoOrcamento(i.codigoRef||`INT-${String(materialId).slice(-6)}`),descricao:maiusculoOrcamento(i.descricaoRef),
            unidade:maiusculoOrcamento(i.unidadeRef||"UN"),categoria:"outros",estoqueMin:0,
            precoMedio:Number(i.precoRef||0),fonteRef:i.fonteRef||"",dataBaseRef:i.dataBaseRef||"",ufRef:i.ufRef||"",ativo:true});
        }
        return { id: i.id || uid(), materialId,
                   qtd: Number(i.qtd), precoUnit: Number(i.precoUnit||0),
                   qtdRecebida: Number(i.qtdRecebida||0),orcItemId:i.orcItemId||"",orcNivel1Id:i.orcNivel1Id||"",
                   recebimentos:Array.isArray(i.recebimentos)?i.recebimentos:[],
                   referenciaId:i.referenciaId||f.referenciaId||"",fonteRef:i.fonteRef||"",codigoRef:i.codigoRef||"",
                   descricaoRef:i.descricaoRef||"",unidadeRef:i.unidadeRef||"",
                   unidadeCompra:purchaseUnitOf(i),fatorConversao:Number(i.fatorConversao||1),comprimentoBarra:Number(i.comprimentoBarra||0),
                   precoRef:Number(i.precoRef||0),
                   dataBaseRef:i.dataBaseRef||"",ufRef:i.ufRef||"" };
      });
    if (!itens.length) { showToast("Adicione ao menos um item.", "error"); return; }
    if(f.id&&itens.some(i=>Number(i.qtd)<Number(i.qtdRecebida||0))){
      showToast("A quantidade comprada não pode ficar abaixo do que já foi recebido.","error");return;
    }
    const pedidoAnterior=f.id?(data.pedidos||[]).find(p=>p.id===f.id):null;
    const totalNovo=itens.reduce((s,i)=>s+Number(i.qtd||0)*Number(i.precoUnit||0),0);
    const totalPago=(pedidoAnterior?.pagamentos||[]).reduce((s,pg)=>s+Number(pg.valor||0),0);
    if(f.id&&totalNovo+0.01<totalPago){
      showToast(`O novo total não pode ser menor que o valor já pago (${fmt(totalPago)}).`,"error");return;
    }
    if(f.id&&!String(f.motivoAjuste||"").trim()){
      showToast("Informe o motivo do ajuste para preservar a rastreabilidade.","error");return;
    }

    const p = {
      id: f.id || uid(),
      numero: f.numero?.trim() || `PC-${String((data.pedidos||[]).length + 1).padStart(4,"0")}`,
      obraId: f.obraId || obraAtual,
      fornecedorId: f.fornecedorId,
      data: f.data || new Date().toISOString().slice(0,10),
      previsao: f.previsao || "",
      status: f.id ? (f.status||"enviado") : (f.status === "rascunho" ? "rascunho" : "enviado"),
      referenciaId:f.referenciaId || "",
      solicitacaoId:f.solicitacaoId || "",
      itens,
      cotacaoId: f.cotacaoId || "",
      transacaoId: f.transacaoId || "",
      origemPagamento: ["cliente_direto","caixa_obra","empresa"].includes(f.origemPagamento)?f.origemPagamento:"empresa",
      pagamentos:Array.isArray(f.pagamentos)?f.pagamentos:[],
      liberadoEntregaEm:f.liberadoEntregaEm||"",liberadoEntregaPor:f.liberadoEntregaPor||"",
      documentos:Array.isArray(f.documentos)?f.documentos:[],analiseIA:f.analiseIA||null,
      ajustes:f.id?[...(f.ajustes||[]),{id:uid(),motivo:String(f.motivoAjuste||"").trim(),
        usuarioId:currentUser?.id||"",usuario:currentUser?.nome||"Operador",criadoEm:new Date().toISOString(),
        totalAnterior:pedidoAnterior?totalPedido(pedidoAnterior):0,totalNovo,
        resumo:`Pedido ${f.numero||""}: dados, itens ou valores revisados.`}]:(f.ajustes||[]),
      criadoPorId:f.criadoPorId||currentUser?.id||"",criadoPor:f.criadoPor||currentUser?.nome||"",criadoEm:f.criadoEm||new Date().toISOString(),
      obs: f.obs || "",
    };
    if(!dispatchCommand){showToast("O salvamento seguro do pedido exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.pedidos||[]).find(item=>item.id===p.id);
      return {
        type:OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED,
        idempotencyKey:`purchase-order-save-${p.id}-${uid()}`,
        expectedVersion:vigente?Number(vigente.version||0):0,
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{order:p,newMaterials:novosMateriais,adjustmentReason:String(f.motivoAjuste||"").trim()},
      };
    });
    if(!result?.ok){showToast(result?.reason||"O servidor não confirmou o pedido.","error");return;}
    setPedModal(null);
    showToast(f.id ? "Pedido atualizado." : `Pedido ${p.numero} criado.`);
  };

  const abrirPagamento=p=>setPagModal({pedido:p,valor:String(saldoPagamentoPedido(p).toFixed(2)),data:today(),origem:p.origemPagamento||"empresa",transacaoId:"",referencia:"",observacao:"",conciliado:false,comprovanteFile:null,comprovanteLegenda:""});
  const registrarPagamento=async()=>{
    const f=pagModal,pedido=f?.pedido,valor=Number(String(f?.valor||"").replace(",","."));
    if(!pedido||!(valor>0)){showToast("Informe o valor pago.","error");return;}
    const saldo=saldoPagamentoPedido(pedido);
    if(valor>saldo+.01){showToast(`O pagamento supera o saldo de ${fmt(saldo)}.`,"error");return;}
    if(!canManagePurchases(currentUser?.role)){showToast("Seu perfil não possui permissão para registrar pagamentos de compras.","error");return;}
    const obra=(data.obras||[]).find(o=>o.id===pedido.obraId);
    const caixa=situacaoCaixaObra(data,pedido.obraId);
    if(f.origem==="caixa_obra"&&!obra?.hasCaixa){showToast("O caixa desta obra não está ativado. Ative-o no cadastro da obra ou selecione outra origem.","error");return;}
    if(f.origem==="caixa_obra"&&valor>caixa.saldo+.001){showToast(`Pagamento bloqueado: o caixa possui ${fmt(caixa.saldo)} e ficaria negativo em ${fmt(valor-caixa.saldo)}. Registre um aporte antes de pagar.`,"error");return;}
    setSubindoComprovantePagamento(true);
    try{
    const pagamentoId=uid();let comprovantes=[];let workspace=null;
    if(f.comprovanteFile){
      const file=f.comprovanteFile,dataUrl=await arquivoComoDataUrl(file);
      const resp=await enviarArquivoOneDrive({dataUrl,obraName:obra?.name||"Obra",driveId:obra?.oneDriveDriveId,folderId:obra?.oneDriveFolderId,folders:obra?.oneDriveFolders,category:"financeiro",subfolder:`Pagamentos de compras/${pedido.numero||"Pedido"}/${String(f.data||today()).slice(0,7)}`,date:f.data||today(),fileName:file.name});
      if(!resp.ok&&!resp.url)throw new Error(resp.error||"Falha ao salvar o comprovante no OneDrive.");
      comprovantes=[{id:resp.item?.id||uid(),nome:resp.item?.name||file.name,legenda:String(f.comprovanteLegenda||file.name).trim(),url:resp.item?.webUrl||resp.url,path:resp.path||"",tipo:file.type||"",tamanho:Number(file.size||0),enviadoEm:new Date().toISOString(),enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||""}];
      workspace=resp.workspace||null;
    }
    const transacao=(data.transacoes||[]).find(t=>t.id===f.transacaoId);
    const pagamento={id:pagamentoId,data:f.data||today(),valor,origem:f.origem,conciliado:!!f.conciliado||!!transacao,
      transacaoId:f.transacaoId||"",referencia:f.referencia||transacao?.descricao||"",observacao:f.observacao||"",
      comprovantes,
      registradoPorId:currentUser?.id||"",registradoPor:currentUser?.nome||"",registradoEm:new Date().toISOString()};
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.pedidos||[]).find(item=>item.id===pedido.id);
      return {
        type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_RECORDED,
        idempotencyKey:`purchase-payment-create-${pagamentoId}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{
          targetType:"pedido",targetId:pedido.id,payment:pagamento,
          workCashMovementId:f.origem==="caixa_obra"?uid():"",
          workspace,
        },
      };
    });
    if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o pagamento.");
    const pedidoConfirmado=(result.data?.pedidos||[]).find(item=>item.id===pedido.id);
    const quitado=saldoPagamentoPedido(pedidoConfirmado||pedido)<=.01;
    const saldoProjetado=caixa.saldo-valor;
    setPagModal(null);
    if(f.origem==="caixa_obra"&&saldoProjetado<=caixa.limiteBaixo)showToast(`Pagamento registrado, mas o caixa ficou baixo: ${fmt(saldoProjetado)}. Recomenda-se novo aporte (reserva mínima ${fmt(caixa.limiteBaixo)}).`,"warn");
    else showToast(quitado?`Pedido ${pedido.numero} quitado e liberado para recebimento.`:`Pagamento parcial registrado. Saldo: ${fmt(saldo-valor)}.`);
    }catch(err){showToast(err.message||"Não foi possível registrar o pagamento.","error");}
    finally{setSubindoComprovantePagamento(false);}
  };

  const reclassificarOrigemPagamento=async(pedido,pagamentoId,novaOrigem)=>{
    const pagamento=(pedido.pagamentos||[]).find(pg=>pg.id===pagamentoId);
    if(!pagamento||pagamento.origem===novaOrigem)return;
    const rotulos={empresa:"Conta da empresa",caixa_obra:"Caixa da obra",cliente_direto:"Cliente direto"};
    if(!window.confirm(`Mover o pagamento de ${fmt(pagamento.valor)} de "${rotulos[pagamento.origem]||pagamento.origem}" para "${rotulos[novaOrigem]}"?`))return;
    const obra=(data.obras||[]).find(o=>o.id===pedido.obraId);
    if(novaOrigem==="caixa_obra"){
      if(!obra?.hasCaixa){showToast("O caixa desta obra não está ativado. Ative-o antes de mover o pagamento.","error");return;}
      const caixa=situacaoCaixaObra(data,pedido.obraId);
      if(Number(pagamento.valor||0)>caixa.saldo+.001){
        showToast(`O caixa possui ${fmt(caixa.saldo)} e não comporta este pagamento de ${fmt(pagamento.valor)}.`,"error");return;
      }
    }
    setSubindoComprovantePagamento(true);
    let result;
    try{
      result=await dispatchCommand(atual=>{
        const vigente=(atual.pedidos||[]).find(item=>item.id===pedido.id);
        return {
          type:OPERATIONAL_COMMAND.PURCHASE_PAYMENT_RECLASSIFIED,
          idempotencyKey:`purchase-payment-reclassify-${pagamentoId}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{
            targetType:"pedido",targetId:pedido.id,paymentId:pagamentoId,newOrigin:novaOrigem,
            workCashMovementId:novaOrigem==="caixa_obra"?uid():"",
            adjustmentId:uid(),
          },
        };
      });
    }catch(error){result={ok:false,reason:error?.message};}
    finally{setSubindoComprovantePagamento(false);}
    if(!result?.ok){showToast(result?.reason||"Não foi possível reclassificar o pagamento.","error");return;}
    showToast(`Pagamento movido para ${rotulos[novaOrigem]}.`);
  };

  const excluirPagamento=async(pedido,pagamento)=>{
    if(!canManagePurchases(currentUser?.role)){
      showToast("Somente Administração, Compras ou Financeiro podem excluir pagamentos.","error");return;
    }
    const motivo=window.prompt(`Motivo do estorno do pagamento de ${fmt(pagamento.valor)}:`);
    if(!String(motivo||"").trim())return;
    setSubindoComprovantePagamento(true);
    let result;
    try{
      result=await dispatchCommand(atual=>{
        const vigente=(atual.pedidos||[]).find(item=>item.id===pedido.id);
        return {
          type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED,
          idempotencyKey:`purchase-payment-reverse-${pagamento.id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{
            targetType:"pedido",targetId:pedido.id,paymentId:pagamento.id,
            reason:String(motivo).trim(),adjustmentId:uid(),
          },
        };
      });
    }catch(error){result={ok:false,reason:error?.message};}
    finally{setSubindoComprovantePagamento(false);}
    if(!result?.ok){showToast(result?.reason||"Não foi possível estornar o pagamento.","error");return;}
    showToast("Pagamento estornado e preservado no histórico.");
  };

  //  RECEBIMENTO - o elo com o Estoque
  // O recebimento físico NÃO depende de pagamento prévio - o material pode
  // chegar antes, durante ou depois da quitação (compra a prazo é o caso
  // normal). O saldo em aberto continua visível, só não bloqueia mais.
  const receber = async (pedido, recebidos) => {
    // recebidos: { [itemId]: qtd que chegou AGORA }
    const linhas = pedido.itens.map(i => ({
      ...i,
      chegou: Number(recebidos[i.id] || 0),
      falta: Number(i.qtd) - Number(i.qtdRecebida || 0),
    }));

    if (linhas.every(l => l.chegou <= 0)) {
      showToast("Informe ao menos uma quantidade recebida.", "error");
      return;
    }
    // Receber MAIS que o pedido esconde erro de nota fiscal - trava.
    const excedeu = linhas.filter(l => l.chegou > l.falta + 1e-6);
    if (excedeu.length) {
      showToast(`"${nomeMat(excedeu[0].materialId)}": só faltam ${excedeu[0].falta}.`, "error");
      return;
    }

    const quando = new Date().toISOString().slice(0,10);

    // Cada item recebido vira ENTRADA no estoque da obra. É aqui que Compras
    // encosta no Estoque - e é a única coisa física que um pedido gera.
    const entradas = linhas.filter(l => l.chegou > 0).map(l => ({
      id: uid(), receiptId:uid(), pedidoItemId:l.id, pedidoId: pedido.id,
      obraId: pedido.obraId,
      materialId: l.materialId,
      tipo: "entrada",
      // O pedido é conferido na embalagem comprada, mas o estoque permanece
      // na unidade canônica do cadastro/SINAPI.
      qtd: referenceQuantityOf(l,l.chegou),
      valorUnit: conversionFactorOf(l)>0?Number(l.precoUnit||0)/conversionFactorOf(l):Number(l.precoUnit||0),
      qtdCompra:l.chegou,unidadeCompra:purchaseUnitOf(l),
      fatorConversao:conversionFactorOf(l),unidadeRef:l.unidadeRef||"",
      data: quando,
      descricao: `Pedido ${pedido.numero}  ${nomeForn(pedido.fornecedorId)}`,
      transacaoId: "", servicoId: "", orcItemId:l.orcItemId||"",orcNivel1Id:l.orcNivel1Id||"", etapa: "",
    }));

    if(!dispatchCommand){
      showToast("O recebimento seguro exige conexão com o servidor.","error");
      return;
    }
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.pedidos||[]).find(item=>item.id===pedido.id);
      return {type:OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED,
        idempotencyKey:`pedido-recebimento-${pedido.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{pedidoId:pedido.id,receivedQuantities:Object.fromEntries(linhas.filter(l=>l.chegou>0).map(l=>[l.id,l.chegou])),stockEntries:entradas}};
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível registrar o recebimento.","error");return;}
    const pedidoConfirmado=(result.data?.pedidos||[]).find(item=>item.id===pedido.id)||pedido;

    setRecModal(null);
    const st = statusPedido(pedidoConfirmado);
    showToast(
      st === "recebido"
        ? `Pedido ${pedido.numero} recebido por completo. Estoque atualizado.`
        : `Recebimento parcial registrado. ${entradas.length} item(ns) no estoque.`
    );
  };

  const cancelarPedido = async(p) => {
    if(cancelandoCompra)return;
    const jaRecebeu = (p.itens||[]).some(i => Number(i.qtdRecebida) > 0);
    if (jaRecebeu) {
      showToast("Pedido já tem material recebido. Estorne pelo Estoque antes.", "error");
      return;
    }
    const motivo=window.prompt(`Motivo do cancelamento do pedido ${p.numero}:`);
    if(!String(motivo||"").trim())return;
    setCancelandoCompra(true);
    let result;
    try{
      result=await dispatchCommand(atual=>{
        const vigente=(atual.pedidos||[]).find(item=>item.id===p.id);
        return {
          type:OPERATIONAL_COMMAND.PURCHASE_CANCELLED,
          idempotencyKey:`purchase-cancel-${p.id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{orderId:p.id,reason:String(motivo).trim()},
        };
      });
    }catch(error){result={ok:false,reason:error?.message};}
    finally{setCancelandoCompra(false);}
    if(!result?.ok){showToast(result?.reason||"Não foi possível cancelar o pedido.","error");return;}
    showToast("Pedido cancelado.");
  };

  const podeExcluirCompra=canManagePurchases(currentUser?.role);
  const movimentoDoPedido=(mov,pedido)=>
    mov?.pedidoId===pedido.id||
    (!mov?.pedidoId&&mov?.obraId===pedido.obraId&&mov?.tipo==="entrada"&&
      String(mov?.descricao||"").startsWith(`Pedido ${pedido.numero}`));

  const abrirExclusaoCompra=p=>{
    if(!podeExcluirCompra){
      showToast("Somente Administração, Compras ou Financeiro podem excluir uma compra.","error");return;
    }
    setExcluirCompraModal({
      pedido:p,motivo:"",confirmacao:"",
      movimentos:(data.movEstoque||[]).filter(m=>movimentoDoPedido(m,p)),
      caixas:(data.caixaObra||[]).filter(m=>m.pedidoId===p.id&&!m.notaFiscalId),
      notas:(data.notasFiscais||[]).filter(n=>n.pedidoId===p.id),
    });
  };

  const excluirCompraDefinitivamente=async()=>{
    if(cancelandoCompra)return;
    const f=excluirCompraModal,p=f?.pedido;
    if(!p||!podeExcluirCompra){
      showToast("Seu perfil não pode excluir esta compra.","error");return;
    }
    if(!String(f.motivo||"").trim()){
      showToast("Informe o motivo da exclusão.","error");return;
    }
    if(String(f.confirmacao||"").trim().toUpperCase()!==String(p.numero||"").trim().toUpperCase()){
      showToast(`Digite ${p.numero} para confirmar a exclusão.`,"error");return;
    }
    setCancelandoCompra(true);
    let result;
    try{
      result=await dispatchCommand(atual=>{
        const vigente=(atual.pedidos||[]).find(item=>item.id===p.id);
        return {
          type:OPERATIONAL_COMMAND.PURCHASE_CANCELLED,
          idempotencyKey:`purchase-cancel-${p.id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{orderId:p.id,reason:String(f.motivo).trim()},
        };
      });
    }catch(error){result={ok:false,reason:error?.message};}
    finally{setCancelandoCompra(false);}
    if(!result?.ok){showToast(result?.reason||"Não foi possível excluir a compra.","error");return;}
    setExcluirCompraModal(null);
    showToast(`Compra ${p.numero} cancelada. Os fatos e vínculos foram preservados para auditoria.`);
  };

  //  Cotação 
  const salvarCotacao = (f) => {
    if (!f.materialId)      { showToast("Selecione o material.", "error"); return; }
    if (Number(f.qtd) <= 0) { showToast("Informe a quantidade.", "error"); return; }
    const props = (f.propostas||[])
      .filter(p => p.fornecedorId && Number(p.precoUnit) > 0)
      .map(p => ({ id: p.id || uid(), fornecedorId: p.fornecedorId,
                   precoUnit: Number(p.precoUnit), prazoDias: Number(p.prazoDias||0), obs: p.obs||"",
                   documentos:Array.isArray(p.documentos)?p.documentos:[] }));
    if (props.length < 2) { showToast("Uma cotação precisa de ao menos 2 propostas.", "error"); return; }

    const c = {
      id: f.id || uid(), obraId: f.obraId || obraAtual,
      materialId: f.materialId, qtd: Number(f.qtd),
      unidadeRef:f.unidadeRef||unidMat(f.materialId)||"UN",
      unidadeCompra:purchaseUnitOf(f),
      fatorConversao:Number(f.fatorConversao||1),
      precoRef:Number(f.precoRef||0),
      orcItemId:f.orcItemId||"",orcNivel1Id:f.orcNivel1Id||"",
      data: f.data || new Date().toISOString().slice(0,10),
      status: "aberta", propostas: props, escolhida: "", pedidoId: "",
      solicitacaoId:f.solicitacaoId||"",
    };
    const solicitacoesCompra=f.solicitacaoId?(data.solicitacoesCompra||[]).map(s=>s.id===f.solicitacaoId?{
      ...s,status:s.status==="enviada"?"em_analise":s.status,
      analisadoEm:s.analisadoEm||new Date().toISOString(),analisadoPor:s.analisadoPor||currentUser?.nome||"Compras",
      cotacaoIds:[...new Set([...(s.cotacaoIds||[]),c.id])],
    }:s):(data.solicitacoesCompra||[]);
    update({ ...data, solicitacoesCompra, cotacoes: f.id
      ? (data.cotacoes||[]).map(x => x.id === f.id ? c : x)
      : [...(data.cotacoes||[]), c] });
    setCotModal(null);
    showToast("Cotação registrada.");
  };

  const excluirCotacao=async cotacao=>{
    if(!podeProcessar){
      showToast("Somente Administração ou Compras podem excluir cotações.","error");return;
    }
    const pedidoVinculado=(data.pedidos||[]).find(p=>p.id===cotacao.pedidoId||p.cotacaoId===cotacao.id);
    const aviso=pedidoVinculado?`\n\nO pedido ${pedidoVinculado.numero} será mantido, apenas sem o vínculo com esta cotação.`:"";
    const motivo=window.prompt(`Motivo do cancelamento da cotação de ${nomeMat(cotacao.materialId)}:${aviso}`);
    if(!String(motivo||"").trim())return;
    if(!dispatchCommand){showToast("O cancelamento seguro da cotação exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>{
      const pedido=(atual.pedidos||[]).find(p=>
        p.id===cotacao.pedidoId||p.cotacaoId===cotacao.id);
      return {
        type:OPERATIONAL_COMMAND.PURCHASE_QUOTE_CANCELLED,
        idempotencyKey:`purchase-quote-cancel-${cotacao.id}-${uid()}`,
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{quoteId:cotacao.id,reason:String(motivo).trim(),
          expectedOrderVersion:pedido?Number(pedido.version||0):null},
      };
    });
    if(!result?.ok){showToast(result?.reason||"O servidor não confirmou o cancelamento da cotação.","error");return;}
    showToast("Cotação cancelada e preservada no histórico.");
  };

  const selecionarDocumentoCotacao=(cotacao,proposta,e)=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>5.5*1024*1024){showToast("O documento deve ter no máximo 5,5 MB.","error");return;}setAnexoCotacao({cotacao,proposta,file,legenda:String(file.name||"").replace(/\.[^.]+$/,"")});};
  const salvarDocumentoCotacao=async()=>{if(!anexoCotacao?.file||!String(anexoCotacao.legenda||"").trim())return;setSubindoAnexoCotacao(true);try{
    const {cotacao,proposta,file}=anexoCotacao;const obra=(data.obras||[]).find(o=>o.id===cotacao.obraId);const fornecedor=fornecedores.find(f=>f.id===proposta.fornecedorId);const dataUrl=await arquivoComoDataUrl(file);
    const resp=await enviarArquivoOneDrive({dataUrl,obraName:obra?.name||"Administrativo",driveId:obra?.oneDriveDriveId,folderId:obra?.oneDriveFolderId,folders:obra?.oneDriveFolders,category:"compras",subfolder:`Cotações/${cotacao.data||today()}/${fornecedor?.nome||"Fornecedor"}`,date:cotacao.data||today(),fileName:file.name});
    if(!resp.ok&&!resp.url)throw new Error(resp.error||"Falha ao salvar a cotação no OneDrive.");
    const documento={id:resp.item?.id||uid(),nome:resp.item?.name||file.name,legenda:String(anexoCotacao.legenda).trim(),url:resp.item?.webUrl||resp.url,path:resp.path||"",tipo:file.type||"",tamanho:file.size||0,enviadoEm:new Date().toISOString(),enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||""};
    const cotacoesAtualizadas=(data.cotacoes||[]).map(c=>c.id===cotacao.id?{...c,propostas:(c.propostas||[]).map(p=>p.id===proposta.id?{...p,documentos:[...(p.documentos||[]),documento]}:p)}:c);
    const obrasAtualizadas=(data.obras||[]).map(o=>o.id===cotacao.obraId?{...o,oneDriveDriveId:resp.workspace?.driveId||o.oneDriveDriveId,oneDriveFolderId:resp.workspace?.folderId||o.oneDriveFolderId,oneDriveFolders:resp.workspace?.folders||o.oneDriveFolders,oneDriveUrl:resp.workspace?.webUrl||o.oneDriveUrl}:o);
    update({...data,obras:obrasAtualizadas,cotacoes:cotacoesAtualizadas});setAnexoCotacao(null);showToast("Documento anexado à proposta da cotação.");
  }catch(err){showToast(err.message||"Não foi possível anexar o documento da cotação.","error");}finally{setSubindoAnexoCotacao(false);}};

  // Cotação decidida vira pedido, sem redigitar nada
  const gerarPedidoDaCotacao = async(cot, propostaId, justificativa="", navegar=true) => {
    const prop = cot.propostas.find(p => p.id === propostaId);
    if (!prop) return;
    const menor=Math.min(...cot.propostas.map(p=>Number(p.precoUnit||0)).filter(v=>v>0));
    const melhor=Number(prop.precoUnit||0)<=menor+0.000001;
    if(!melhor&&!String(justificativa||"").trim()){showToast("Justifique a escolha de uma proposta que não é a mais barata.","error");return;}

    const numero = `PC-${String((data.pedidos||[]).length + 1).padStart(4,"0")}`;
    if(!dispatchCommand){showToast("A geração segura do pedido exige conexão com o servidor.","error");return;}
    const orderId=uid(),itemId=uid();
    const result=await dispatchCommand(()=>({
      type:OPERATIONAL_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE,
      idempotencyKey:`purchase-order-from-quote-${cot.id}-${orderId}-${uid()}`,
      expectedVersion:0,actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{
        quoteId:cot.id,proposalId:propostaId,orderId,itemId,number:numero,
        date:new Date().toISOString().slice(0,10),forecast:"",
        justification:String(justificativa||"").trim(),
      },
    }));
    if(!result?.ok){showToast(result?.reason||"O servidor não confirmou o pedido da cotação.","error");return;}
    setCotDecisao(null);
    showToast(`Pedido ${numero} gerado a partir da cotação.`);
    if(navegar)setAba("pedidos");
  };

  const moverCardKanban=(chave,destino)=>{
    const [tipo,id]=String(chave||"").split(":");
    const origem=kanbanCompras.find(col=>col.cards.some(card=>card.tipo===tipo&&card.id===id));
    const card=origem?.cards.find(item=>item.tipo===tipo&&item.id===id);
    if(!card||origem.id===destino)return;
    const ordem=["demanda","cotacao","pedido","entrega","concluido"];
    const atual=ordem.indexOf(origem.id),proxima=ordem.indexOf(destino);
    if(proxima!==atual+1){
      showToast(proxima<atual?"O retorno de etapa exige cancelar ou ajustar o registro original.":"Avance uma etapa por vez para preservar a rastreabilidade.","warn");return;
    }
    if(card.tipo==="solicitacao"&&destino==="cotacao"){
      const item=(card.registro.itens||[])[0];
      if(!item){showToast("A solicitação não possui item para cotar.","error");return;}
      abrirCotacaoDaSolicitacao(card.registro,item);
      showToast("Cotação preparada. Inclua as propostas para concluir a movimentação.");return;
    }
    if(card.tipo==="cotacao"&&destino==="pedido"){
      const propostas=(card.registro.propostas||[]).filter(p=>p.fornecedorId&&Number(p.precoUnit)>0);
      if(propostas.length<2){
        setCotModal({...card.registro,propostas:(card.registro.propostas||[]).map(p=>({...p}))});
        showToast("Complete ao menos duas propostas antes de gerar o pedido.","warn");return;
      }
      const melhor=[...propostas].sort((a,b)=>Number(a.precoUnit)-Number(b.precoUnit)||Number(a.prazoDias||999)-Number(b.prazoDias||999))[0];
      gerarPedidoDaCotacao(card.registro,melhor.id,"",false);return;
    }
    if(card.tipo==="pedido"&&destino==="entrega"){
      showToast("Pedido liberado para entrega.");return;
    }
    if(card.tipo==="pedido"&&destino==="concluido"){
      // Recebimento não depende de pagamento prévio (compra a prazo é o caso
      // normal) - o saldo em aberto continua visível na tela financeira, só
      // não bloqueia mais a chegada do material.
      setRecModal(card.registro);showToast("Confirme as quantidades recebidas para concluir o cartão.");return;
    }
    showToast("Esta movimentação deve ser concluída no registro de origem.","warn");
  };

  const comprasAbas=[
    ["kanban","Kanban de compras"],
    ["mapa","Mapa gerencial"],
    ["por_pagador","Por quem pagou"],
    ["financeiro",`Financeiro${resumoFinanceiro.pendentes?` · ${resumoFinanceiro.pendentes}`:""}`],
    ["solicitacoes",`Solicitações${solicitacoesPendentes?` · ${solicitacoesPendentes}`:""}`],
    ["cotacoes","Cotações"],["pedidos","Pedidos"],["historico_compras","Histórico de compras"],["orcado","Orçado x comprado"],
    ["forn","Fornecedores"],["hist_fornecedor","Histórico por fornecedor"],["precos","Evolução de insumos"]
  ];
  const irParaArea=(id)=>{
    setAba(id);setMenuComprasAberto(false);
    window.requestAnimationFrame(()=>document.getElementById("compras-area-atual")?.scrollIntoView({behavior:"smooth",block:"start"}));
  };
  const abrirModoAnalise=()=>{
    setMenuComprasAberto(false);
    setModoIA(true);
  };
  const abrirNovaSolicitacao=()=>setSolModal({obraId:currentUser?.obraId||obraAtual,necessidade:"",prioridade:"normal",referenciaId:basesCompra[0]?.id||"",observacao:"",itens:[]});
  const etapasCompras=[
    ["mapa","Painel",mapaCompras.alertas.length],
    ["solicitacoes","Solicitar",solicitacoes.filter(s=>!["cancelada","pedido_gerado"].includes(s.status)).length],
    ["cotacoes","Cotar",cotacoes.filter(c=>c.status==="aberta").length],
    ["pedidos","Comprar",(data.pedidos||[]).filter(p=>p.obraId===obraAtual&&!["cancelado","rascunho","recebido"].includes(statusPedido(p))).length],
    ["financeiro","Pagar",resumoFinanceiro.pendentes],
    ["historico_compras","Histórico",pedidosHistorico.length],
  ];
  const abasSecundarias=comprasAbas.filter(([id])=>!etapasCompras.some(([etapaId])=>etapaId===id));
  const tarefaPrioritaria=["engenheiro","engenheiro_auditor"].includes(currentUser?.role)
    ? {titulo:"Solicitar material",descricao:"Registre o que a obra precisa e a data de necessidade.",acao:abrirNovaSolicitacao,rotulo:"Nova solicitação"}
    : currentUser?.role==="financeiro"
      ? {titulo:resumoFinanceiro.pendentes?`${resumoFinanceiro.pendentes} pagamento(s) aguardando`:"Financeiro em dia",descricao:resumoFinanceiro.pendentes?`${fmt(resumoFinanceiro.aPagar)} ainda precisa de registro ou conciliação.`:"Não há pedidos pendentes de quitação nesta obra.",acao:()=>setAba("financeiro"),rotulo:"Abrir financeiro"}
      : {titulo:solicitacoesPendentes?`${solicitacoesPendentes} solicitação(ões) para analisar`:"Fila de compras em dia",descricao:solicitacoesPendentes?"A obra aguarda cotação ou geração de pedido.":"Não há novas solicitações aguardando Compras.",acao:()=>irParaArea(solicitacoesPendentes?"solicitacoes":"pedidos"),rotulo:solicitacoesPendentes?"Analisar agora":"Ver pedidos"};

  return (
    <div className="anim compras-view" style={{display:"flex",flexDirection:"column",gap:isDesktop?12:10}}>
      <PageHero
        eyebrow="Suprimentos da obra"
        title="Compras"
        description="Da requisição ao recebimento, sem perder a responsabilidade de cada etapa."
        actions={<Btn size="sm" v="ghost" onClick={abrirModoAnalise} title="Enviar PDF ou imagem para análise"><Ic n="brain"/> Analisar documento</Btn>}
      />

      <div className="compras-project-picker">{obraIdFixo
        ? <Inp label="Obra" value={obras.find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
        : <Sel label="Obra" value={todasObras?"all":obraAtual} onChange={v=>{
            if (v==="all") { setEscopoMapa("empresa"); return; }
            setEscopoMapa("obra"); setObraSel(v);
          }}
            options={[{v:"all",l:"Todas as obras"},...obras.map(o => ({ v:o.id, l:o.name }))]}/>}</div>

      <section className="compras-next-action" style={{display:"grid",gridTemplateColumns:isDesktop?"minmax(0,1fr) auto":"1fr",gap:12,alignItems:"center",padding:isDesktop?"14px 16px":"12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8}}>
        <div style={{minWidth:0}}><p style={{fontSize:8.5,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.7}}>Sua próxima ação</p><h3 style={{fontSize:15,fontWeight:750,marginTop:3}}>{tarefaPrioritaria.titulo}</h3><p style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.45}}>{tarefaPrioritaria.descricao}</p></div>
        <Btn onClick={tarefaPrioritaria.acao}>{tarefaPrioritaria.rotulo} <Ic n="chevR"/></Btn>
      </section>

      {/* Assinatura da tela: o processo real vira a própria navegação. */}
      <div className="compras-journey" style={{display:"grid",gridTemplateColumns:`repeat(${etapasCompras.length},minmax(0,1fr))`,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",background:C.card}}>
        {etapasCompras.map(([id,label,quantidade],index)=>{const ativa=aba===id;return <button type="button" data-active={ativa} data-has-items={quantidade>0} key={id} onClick={()=>irParaArea(id)} aria-current={ativa?"step":undefined} style={{position:"relative",minWidth:0,border:0,borderLeft:index?`1px solid ${C.line}`:"none",background:ativa?`${C.yellow}12`:C.card,padding:isDesktop?"10px 12px":"9px 4px",cursor:"pointer",textAlign:"center",color:ativa?C.text:C.muted}}>
          <span className="compras-step-number" style={{display:"block",fontSize:8,fontWeight:750,color:ativa?C.yellowD:C.muted,fontVariantNumeric:"tabular-nums"}}>{index+1}</span>
          <b style={{...TYPO.tab,display:"block",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</b>
          <span className="compras-step-count" style={{display:"block",fontSize:9,fontWeight:800,marginTop:2,fontVariantNumeric:"tabular-nums",color:quantidade?C.orange:C.muted}}>{quantidade||"—"}</span>
          {ativa&&<i style={{position:"absolute",left:8,right:8,bottom:0,height:2,background:C.yellow}}/>}
        </button>})}
      </div>

      <div id="compras-area-atual" className="compras-section-head" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,borderBottom:`1px solid ${C.line}`,paddingBottom:8}}>
        <div><p style={{fontSize:8.5,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>Área atual</p><b style={{fontSize:13}}>{comprasAbas.find(([id])=>id===aba)?.[1]}</b></div>
        <div className="compras-more" style={{position:"relative"}}><button type="button" onClick={()=>setMenuComprasAberto(v=>!v)} aria-expanded={menuComprasAberto} style={{...TYPO.tab,border:`1px solid ${C.border}`,background:C.card,borderRadius:6,padding:"7px 10px",color:C.muted,cursor:"pointer"}}>Mais áreas <span>⌄</span></button>{menuComprasAberto&&<div className="compras-more-menu" style={{position:"absolute",right:0,top:"calc(100% + 5px)",zIndex:20,minWidth:220,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:4,boxShadow:"0 8px 24px rgba(18,18,18,.12)"}}>{abasSecundarias.map(([id,label])=><button type="button" key={id} onClick={()=>irParaArea(id)} style={{...TYPO.tab,display:"block",width:"100%",border:0,borderRadius:5,background:aba===id?C.surface:"transparent",padding:"8px 9px",textAlign:"left",fontWeight:aba===id?700:600,color:C.text,cursor:"pointer"}}>{label}</button>)}</div>}</div>
      </div>

      {aba==="kanban"&&<div className="purchase-kanban-view">
        <section className="purchase-kanban-head">
          <div><p>Controle visual de abastecimento</p><h3>Kanban de compras</h3><span>Os cartões avançam conforme solicitação, cotação, pagamento e recebimento são registrados.</span></div>
          <div className="purchase-kanban-filters">
            {[["ativos","Fluxo ativo"],["criticos","Atrasados e atenção"],["todos","Todos"]].map(([id,label])=><button key={id} type="button" data-active={filtroKanban===id} onClick={()=>setFiltroKanban(id)}>{label}</button>)}
          </div>
        </section>
        <div className="purchase-andon-legend" aria-label="Legenda de prazos">
          <span><i style={{background:C.green}}/>No prazo</span><span><i style={{background:C.yellowD}}/>Até 3 dias</span><span><i style={{background:C.red}}/>Atrasado</span><span><i style={{background:C.muted}}/>Sem prazo</span>
        </div>
        <div className="purchase-kanban-board">
          {kanbanCompras.map(coluna=>{
            const cards=coluna.cards.filter(card=>{
              if(filtroKanban==="criticos")return["atrasado","atencao"].includes(card.risco.nivel);
              if(filtroKanban==="ativos")return coluna.id!=="concluido";
              return true;
            });
            const valor=cards.reduce((s,c)=>s+Number(c.valor||0),0);
            return <section className="purchase-kanban-column" key={coluna.id} style={{"--column-color":coluna.cor}}
              onDragOver={e=>{e.preventDefault();e.currentTarget.dataset.dragover="true";}}
              onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))delete e.currentTarget.dataset.dragover;}}
              onDrop={e=>{e.preventDefault();delete e.currentTarget.dataset.dragover;moverCardKanban(e.dataTransfer.getData("text/arcd-kanban"),coluna.id);}}>
              <header><div><span>{coluna.titulo}</span><small>{coluna.sub}</small></div><b>{cards.length}</b></header>
              {!!valor&&<div className="purchase-kanban-column-total">{fmtCompact(valor)}</div>}
              <div className="purchase-kanban-cards">
                {cards.map(card=><button type="button" draggable className="purchase-kanban-card" key={`${card.tipo}-${card.id}`} style={{"--risk-color":card.risco.cor}}
                  onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/arcd-kanban",`${card.tipo}:${card.id}`);e.currentTarget.dataset.dragging="true";}}
                  onDragEnd={e=>{delete e.currentTarget.dataset.dragging;}}
                  onClick={()=>{
                  if(card.tipo==="solicitacao")setSolModal({...card.registro,itens:(card.registro.itens||[]).map(i=>({...i}))});
                  else if(card.tipo==="cotacao")setCotModal({...card.registro,propostas:(card.registro.propostas||[]).map(p=>({...p}))});
                  else setPedModal({...card.registro,itens:(card.registro.itens||[]).map(i=>({...i}))});
                }}>
                  <div className="purchase-kanban-card-top"><span>{card.codigo}</span><b style={{color:card.risco.cor}}>{card.risco.rotulo}</b></div>
                  <h4>{card.titulo}</h4><p>{card.detalhe}</p>
                  <footer><span>{card.prazo?`Prazo ${fmtDate(card.prazo)}`:"Defina o prazo"}</span>{card.valor>0&&<strong>{fmtCompact(card.valor)}</strong>}</footer>
                </button>)}
                {!cards.length&&<div className="purchase-kanban-empty">Nenhum cartão nesta etapa</div>}
              </div>
            </section>;
          })}
        </div>
        <p className="purchase-kanban-help"><b>Regra Andon:</b> vermelho exige ação imediata; amarelo deve ser tratado antes de entrar em atraso. Clique em um cartão para atualizar o registro de origem.</p>
      </div>}

      {aba==="mapa"&&<div className="compras-management-map" style={{display:"flex",flexDirection:"column",gap:10}}>
        <section style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",padding:"14px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:10}}>
          <div><p style={{fontSize:8.5,fontWeight:850,color:C.yellowD,letterSpacing:.8,textTransform:"uppercase"}}>Comando de suprimentos</p><h3 style={{fontSize:18,fontWeight:780,marginTop:3}}>Mapa gerencial de Compras</h3><p style={{fontSize:10,color:C.muted,marginTop:3,maxWidth:680,lineHeight:1.5}}>Visão do compromisso até a entrega: demanda, concorrência, fornecedor, pagamento, estoque e risco de abastecimento.</p></div>
          {!obraIdFixo&&<div style={{display:"flex",padding:3,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8}}>{[["empresa","Empresa"],["obra","Obra selecionada"]].map(([v,l])=><button key={v} onClick={()=>setEscopoMapa(v)} style={{border:0,borderRadius:6,padding:"7px 10px",background:escopoMapa===v?C.card:"transparent",color:escopoMapa===v?C.text:C.muted,fontSize:9.5,fontWeight:800,cursor:"pointer",boxShadow:escopoMapa===v?"0 1px 4px rgba(0,0,0,.08)":"none"}}>{l}</button>)}</div>}
        </section>

        <section style={{display:"grid",gridTemplateColumns:cols(2,3,6),gap:7}}>
          {[
            ["Comprometido",fmt(mapaCompras.totalComprometido),"Pedidos emitidos",C.text],
            ["Pago",fmt(mapaCompras.totalPago),`${mapaCompras.totalComprometido?Math.round(mapaCompras.totalPago/mapaCompras.totalComprometido*100):0}% do compromisso`,C.blue],
            ["Recebido físico",fmt(mapaCompras.totalRecebido),`${mapaCompras.totalComprometido?Math.round(mapaCompras.totalRecebido/mapaCompras.totalComprometido*100):0}% entregue`,C.green],
            ["A pagar",fmt(mapaCompras.totalPendente),`${mapaCompras.fila.pagamentos} pedido(s)`,mapaCompras.totalPendente?C.red:C.green],
            ["Economia registrada",fmt(mapaCompras.economia),"Decisões de cotação",C.green],
            ["Qualidade dos dados",`${Math.round(mapaCompras.completude)}%`,"Base para decisões",mapaCompras.completude>=75?C.green:mapaCompras.completude>=50?C.orange:C.red],
          ].map(([l,v,d,c])=><div key={l} style={{padding:"12px",background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${c}`,borderRadius:9,minWidth:0}}><p style={{fontSize:8.2,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.45}}>{l}</p><b style={{display:"block",fontSize:17,color:c,marginTop:4,fontVariantNumeric:"tabular-nums",overflowWrap:"anywhere"}}>{v}</b><span style={{display:"block",fontSize:8.8,color:C.muted,marginTop:3}}>{d}</span></div>)}
        </section>

        <section className="purchase-dashboard-kanban">
          <div className="purchase-kanban-head">
            <div><p>Controle visual Andon</p><h3>Fluxo de compras e prazos</h3><span>Prioridades organizadas da necessidade ao recebimento, sem ocultar os indicadores gerenciais.</span></div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><div className="purchase-kanban-filters">
              {[["ativos","Fluxo ativo"],["criticos","Críticos"],["todos","Todos"]].map(([id,label])=><button key={id} type="button" data-active={filtroKanban===id} onClick={()=>setFiltroKanban(id)}>{label}</button>)}
            </div><Btn size="sm" v="ghost" onClick={()=>irParaArea("kanban")}>Ampliar Kanban →</Btn></div>
          </div>
          <div className="purchase-andon-legend"><span><i style={{background:C.green}}/>No prazo</span><span><i style={{background:C.yellowD}}/>Até 3 dias</span><span><i style={{background:C.red}}/>Atrasado</span><span><i style={{background:C.muted}}/>Sem prazo</span></div>
          <div className="purchase-dashboard-deadlines">
            {[
              ["Atrasados",kanbanCompras.flatMap(c=>c.cards).filter(c=>c.risco.nivel==="atrasado").length,C.red],
              ["Atenção em 3 dias",kanbanCompras.flatMap(c=>c.cards).filter(c=>c.risco.nivel==="atencao").length,C.yellowD],
              ["No prazo",kanbanCompras.flatMap(c=>c.cards).filter(c=>c.risco.nivel==="no_prazo").length,C.green],
              ["Sem data definida",kanbanCompras.flatMap(c=>c.cards).filter(c=>c.risco.nivel==="sem_prazo").length,C.muted],
            ].map(([label,valor,cor])=><div key={label}><b style={{color:cor}}>{valor}</b><span>{label}</span></div>)}
          </div>
          <div className="purchase-kanban-board purchase-kanban-board-compact">
            {kanbanCompras.map(coluna=>{
              const cards=coluna.cards.filter(card=>filtroKanban==="criticos"?["atrasado","atencao"].includes(card.risco.nivel):filtroKanban==="ativos"?coluna.id!=="concluido":true);
              return <section className="purchase-kanban-column" key={coluna.id} style={{"--column-color":coluna.cor}}
                onDragOver={e=>{e.preventDefault();e.currentTarget.dataset.dragover="true";}}
                onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))delete e.currentTarget.dataset.dragover;}}
                onDrop={e=>{e.preventDefault();delete e.currentTarget.dataset.dragover;moverCardKanban(e.dataTransfer.getData("text/arcd-kanban"),coluna.id);}}>
                <header><div><span>{coluna.titulo}</span><small>{coluna.sub}</small></div><b>{cards.length}</b></header>
                <div className="purchase-kanban-cards">{cards.slice(0,5).map(card=><button type="button" draggable className="purchase-kanban-card" key={`${card.tipo}-${card.id}`} style={{"--risk-color":card.risco.cor}}
                  onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/arcd-kanban",`${card.tipo}:${card.id}`);e.currentTarget.dataset.dragging="true";}}
                  onDragEnd={e=>{delete e.currentTarget.dataset.dragging;}}
                  onClick={()=>{
                  if(card.tipo==="solicitacao")setSolModal({...card.registro,itens:(card.registro.itens||[]).map(i=>({...i}))});
                  else if(card.tipo==="cotacao")setCotModal({...card.registro,propostas:(card.registro.propostas||[]).map(p=>({...p}))});
                  else setPedModal({...card.registro,itens:(card.registro.itens||[]).map(i=>({...i}))});
                }}><div className="purchase-kanban-card-top"><span>{card.codigo}</span><b style={{color:card.risco.cor}}>{card.risco.rotulo}</b></div><h4>{card.titulo}</h4><p>{card.detalhe}</p><footer><span>{card.prazo?fmtDate(card.prazo):"Defina o prazo"}</span>{card.valor>0&&<strong>{fmtCompact(card.valor)}</strong>}</footer></button>)}
                  {!cards.length&&<div className="purchase-kanban-empty">Nenhum cartão</div>}{cards.length>5&&<button className="purchase-kanban-more" onClick={()=>irParaArea("kanban")}>+ {cards.length-5} cartão(ões)</button>}
                </div>
              </section>;
            })}
          </div>
        </section>

        <section style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",padding:"11px 13px",borderBottom:`1px solid ${C.line}`}}>
            <div><p style={{fontSize:8.5,fontWeight:850,color:C.muted,textTransform:"uppercase"}}>Controle dos pedidos</p><h4 style={{fontSize:14,marginTop:2}}>{pedidosMapa.length} pedido(s) no escopo gerencial</h4></div>
            <span style={{fontSize:9,color:C.muted}}>A exclusão exige motivo e confirmação pelo número do pedido.</span>
          </div>
          {!pedidosMapa.length?<p style={{padding:20,textAlign:"center",fontSize:10,color:C.muted}}>Nenhum pedido de compra neste escopo.</p>:
          <div style={{maxHeight:360,overflowY:"auto"}}>
            {pedidosMapa.map((p,index)=>{
              const st=statusPedido(p),meta=STATUS_PEDIDO[st]||{l:st,c:C.muted};
              return <div key={p.id} style={{display:"grid",gridTemplateColumns:isDesktop?"110px minmax(190px,1fr) minmax(130px,.7fr) 110px auto":"1fr auto",gap:10,alignItems:"center",padding:"10px 12px",borderTop:index?`1px solid ${C.line}`:"none"}}>
                <div><b style={{display:"block",fontSize:10.5,color:C.blue}}>{p.numero||"Sem número"}</b><span style={{fontSize:8.5,color:C.muted}}>{fmtDate(p.data)}</span></div>
                <div style={{minWidth:0}}><b className="brk" style={{display:"block",fontSize:10.5,color:C.text}}>{nomeForn(p.fornecedorId)}</b><span className="brk" style={{fontSize:8.5,color:C.muted}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"} · {(p.itens||[]).length} item(ns)</span></div>
                {isDesktop&&<div><Badge color={meta.c}>{meta.l}</Badge><span style={{display:"block",fontSize:8.5,color:C.muted,marginTop:3}}>{statusPagamentoPedido(p)==="pago"?"Pagamento concluído":`${fmt(saldoPagamentoPedido(p))} a pagar`}</span></div>}
                <b style={{fontSize:11.5,textAlign:"right",whiteSpace:"nowrap"}}>{fmt(totalPedido(p))}</b>
                {podeExcluirCompra?<Btn size="sm" v="danger" onClick={()=>abrirExclusaoCompra(p)}><Ic n="trash"/> Excluir</Btn>:<span style={{fontSize:8.5,color:C.muted}}>Somente Compras, Financeiro ou Administração</span>}
              </div>;
            })}
          </div>}
        </section>

        <section style={{display:"grid",gridTemplateColumns:isDesktop?"minmax(0,1.35fr) minmax(280px,.65fr)":"1fr",gap:9}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"11px 13px",borderBottom:`1px solid ${C.line}`}}><p style={{fontSize:8.5,fontWeight:850,color:C.muted,textTransform:"uppercase"}}>Fluxo sob responsabilidade</p><h4 style={{fontSize:14,marginTop:2}}>Onde o dinheiro e o material estão</h4></div>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(5,1fr)":"1fr 1fr"}}>
              {[
                ["solicitacoes","Solicitações",mapaCompras.fila.solicitacoes,"Aguardam análise"],
                ["cotacoes","Cotações",mapaCompras.fila.cotacoes,"Em concorrência"],
                ["pedidos","Pedidos",mapaCompras.fila.pedidos,"Em fornecimento"],
                ["financeiro","Pagamentos",mapaCompras.fila.pagamentos,"Com saldo"],
                ["pedidos","Recebimentos",mapaCompras.fila.recebimentos,"Pagos, não entregues"],
              ].map(([dest,l,v,d],i)=><button key={l} onClick={()=>irParaArea(dest)} style={{border:0,borderLeft:isDesktop&&i?`1px solid ${C.line}`:"none",borderTop:!isDesktop&&i>1?`1px solid ${C.line}`:"none",background:"transparent",padding:"15px 12px",textAlign:"left",cursor:"pointer"}}><span style={{fontSize:8.5,color:C.muted,fontWeight:750}}>{l}</span><b style={{display:"block",fontSize:22,color:v?C.orange:C.green,marginTop:3}}>{v}</b><small style={{fontSize:8.5,color:C.muted}}>{d}</small></button>)}
            </div>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 13px"}}>
            <p style={{fontSize:8.5,fontWeight:850,color:C.muted,textTransform:"uppercase"}}>Maturidade do controle</p>
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:12,alignItems:"center",marginTop:10}}><div style={{width:68,height:68,borderRadius:"50%",display:"grid",placeItems:"center",background:`conic-gradient(${mapaCompras.completude>=75?C.green:C.yellow} ${mapaCompras.completude}%,${C.surface} 0)`,position:"relative"}}><span style={{width:52,height:52,borderRadius:"50%",background:C.card,display:"grid",placeItems:"center",fontSize:14,fontWeight:900}}>{Math.round(mapaCompras.completude)}%</span></div><p style={{fontSize:9.5,color:C.muted,lineHeight:1.5}}>{mapaCompras.completude>=80?"Dados suficientes para decisões gerenciais consistentes.":mapaCompras.completude>=55?"A base já orienta decisões, mas ainda existem pontos cegos.":"A base é insuficiente para prever prazo, custo e risco com segurança."}</p></div>
            <div style={{marginTop:11,display:"grid",gap:5}}>{[
              ["Cobertura por cotação",`${mapaCompras.coberturaCotacao.toFixed(0)}%`],
              ["Propostas por cotação",mapaCompras.concorrencia.toFixed(1)],
              ["Entregas no prazo",mapaCompras.pontualidade===null?"Sem base":`${mapaCompras.pontualidade.toFixed(0)}%`],
              ["Concentração top 3",`${mapaCompras.concentracaoTop3.toFixed(0)}%`],
            ].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",gap:8,paddingTop:5,borderTop:`1px solid ${C.line}`}}><span style={{fontSize:9,color:C.muted}}>{l}</span><b style={{fontSize:9.5}}>{v}</b></div>)}</div>
          </div>
        </section>

        <section style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr":"1fr",gap:9}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}><div style={{padding:"11px 13px",borderBottom:`1px solid ${C.line}`}}><p style={{fontSize:8.5,fontWeight:850,color:C.red,textTransform:"uppercase"}}>Exceções para decidir agora</p><h4 style={{fontSize:14,marginTop:2}}>{mapaCompras.alertas.length?`${mapaCompras.alertas.length} risco(s) ativo(s)`:"Operação sem exceções críticas"}</h4></div><div>{mapaCompras.alertas.length?mapaCompras.alertas.slice(0,8).map((a,i)=>{const cor=a.nivel==="critico"?C.red:a.nivel==="alto"?C.orange:C.yellowD;return <button key={`${a.titulo}-${i}`} onClick={()=>irParaArea(a.destino)} style={{display:"grid",gridTemplateColumns:"8px 1fr auto",gap:10,alignItems:"center",width:"100%",border:0,borderTop:i?`1px solid ${C.line}`:"none",background:"transparent",padding:"10px 12px",textAlign:"left",cursor:"pointer"}}><i style={{width:8,height:8,borderRadius:99,background:cor}}/><span><b style={{display:"block",fontSize:10.5,color:C.text}}>{a.titulo}</b><small style={{fontSize:8.8,color:C.muted}}>{a.detalhe}</small></span><span style={{color:C.muted}}>›</span></button>}):<p style={{padding:20,textAlign:"center",fontSize:10,color:C.green}}>Nenhuma exceção automática encontrada.</p>}</div></div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}><div style={{padding:"11px 13px",borderBottom:`1px solid ${C.line}`}}><p style={{fontSize:8.5,fontWeight:850,color:C.blue,textTransform:"uppercase"}}>Dependência e poder de negociação</p><h4 style={{fontSize:14,marginTop:2}}>Maiores fornecedores por volume</h4></div><div>{mapaCompras.fornecedores.slice(0,6).map((f,i)=><div key={f.id} style={{padding:"9px 12px",borderTop:i?`1px solid ${C.line}`:"none"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{fontSize:10,fontWeight:750,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i+1}. {f.nome}</span><b style={{fontSize:10}}>{fmt(f.valor)} · {f.participacao.toFixed(0)}%</b></div><div style={{height:4,background:C.surface,borderRadius:99,marginTop:5,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,f.participacao)}%`,background:i===0?C.yellowD:C.blue}}/></div></div>)}{!mapaCompras.fornecedores.length&&<p style={{padding:20,textAlign:"center",fontSize:10,color:C.muted}}>Ainda não há pedidos suficientes.</p>}</div><button onClick={()=>irParaArea("forn")} style={{width:"100%",border:0,borderTop:`1px solid ${C.line}`,background:C.surface,padding:"9px",fontSize:9.5,fontWeight:800,cursor:"pointer"}}>Abrir fornecedores →</button></div>
        </section>

        <section style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr":"1fr",gap:9}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 13px"}}><p style={{fontSize:8.5,fontWeight:850,color:C.muted,textTransform:"uppercase"}}>Origem real dos pagamentos</p><div style={{display:"grid",gap:7,marginTop:9}}>{[["Empresa",mapaCompras.origens.empresa,C.blue],["Caixa das obras",mapaCompras.origens.caixa_obra,C.yellowD],["Cliente direto",mapaCompras.origens.cliente_direto,C.purple]].map(([l,v,c])=><div key={l} style={{display:"grid",gridTemplateColumns:"110px 1fr auto",gap:8,alignItems:"center"}}><span style={{fontSize:9,color:C.muted}}>{l}</span><div style={{height:6,background:C.surface,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${mapaCompras.totalPago?Math.min(100,v/mapaCompras.totalPago*100):0}%`,background:c}}/></div><b style={{fontSize:9.5,color:c}}>{fmt(v)}</b></div>)}</div></div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 13px"}}><p style={{fontSize:8.5,fontWeight:850,color:C.yellowD,textTransform:"uppercase"}}>Veredicto gerencial</p><h4 style={{fontSize:14,marginTop:3}}>{mapaCompras.completude>=80&&mapaCompras.alertas.length<=2?"Controle suficiente, com boa rastreabilidade":mapaCompras.completude>=55?"Controle operacional útil, ainda não completo":"Controle insuficiente para uma carteira de obras"}</h4><p style={{fontSize:9.5,color:C.muted,lineHeight:1.55,marginTop:6}}>Para o segmento de construção, o mapa precisa ligar necessidade da frente de serviço, orçamento SINAPI/ORSE, concorrência, frete, prazo prometido, qualidade recebida, pagamento, estoque e consumo. O sistema já cobre esse ciclo; os maiores ganhos agora vêm de preencher previsão, registrar ao menos três propostas e encerrar recebimentos com evidência.</p></div>
        </section>
      </div>}

      {aba==="por_pagador"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
        {[["empresa","Empresa",C.blue],["caixa_obra","Caixa da obra",C.yellowD],["cliente_direto","Cliente direto",C.purple]].map(([id,label,cor])=>{
          const lista=pedidosPorPagador[id]||[];
          const total=lista.reduce((s,p)=>s+totalPedido(p),0);
          return <section key={id} style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${cor}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",padding:"11px 13px",borderBottom:`1px solid ${C.line}`}}>
              <div><p style={{fontSize:8.5,fontWeight:850,color:cor,textTransform:"uppercase"}}>{label}</p><h4 style={{fontSize:14,marginTop:2}}>{lista.length} pedido(s)</h4></div>
              <b style={{fontSize:15,color:cor}}>{fmt(total)}</b>
            </div>
            {!lista.length?<p style={{padding:18,textAlign:"center",fontSize:10,color:C.muted}}>Nenhum pedido pago por {label.toLowerCase()}.</p>:
            <div style={{maxHeight:300,overflowY:"auto"}}>
              {lista.map((p,index)=>{
                const st=statusPedido(p),meta=STATUS_PEDIDO[st]||{l:st,c:C.muted};
                return <div key={p.id} style={{display:"grid",gridTemplateColumns:isDesktop?"110px minmax(190px,1fr) minmax(130px,.7fr) 110px":"1fr auto",gap:10,alignItems:"center",padding:"10px 12px",borderTop:index?`1px solid ${C.line}`:"none"}}>
                  <div><b style={{display:"block",fontSize:10.5,color:C.blue}}>{p.numero||"Sem número"}</b><span style={{fontSize:8.5,color:C.muted}}>{fmtDate(p.data)}</span></div>
                  <div style={{minWidth:0}}><b className="brk" style={{display:"block",fontSize:10.5,color:C.text}}>{nomeForn(p.fornecedorId)}</b><span className="brk" style={{fontSize:8.5,color:C.muted}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"} · {(p.itens||[]).length} item(ns)</span></div>
                  {isDesktop&&<div><Badge color={meta.c}>{meta.l}</Badge><span style={{display:"block",fontSize:8.5,color:C.muted,marginTop:3}}>{statusPagamentoPedido(p)==="pago"?"Pagamento concluído":`${fmt(saldoPagamentoPedido(p))} a pagar`}</span></div>}
                  <b style={{fontSize:11.5,textAlign:"right",whiteSpace:"nowrap"}}>{fmt(totalPedido(p))}</b>
                </div>;
              })}
            </div>}
          </section>;
        })}
      </div>}

      {aba==="financeiro"&&<>
        <section className="compras-finance-summary" style={{display:"grid",gridTemplateColumns:isDesktop?"minmax(180px,.8fr) repeat(3,minmax(120px,1fr))":"1fr 1fr",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          <div style={{gridColumn:isDesktop?"auto":"1/-1",padding:"12px 14px",background:resumoFinanceiro.aPagar?`${C.red}08`:C.surface,borderRight:isDesktop?`1px solid ${C.line}`:"none",borderBottom:!isDesktop?`1px solid ${C.line}`:"none"}}><p style={{fontSize:8.5,color:C.muted,fontWeight:750,textTransform:"uppercase"}}>Total a pagar</p><p style={{fontSize:20,fontWeight:800,color:resumoFinanceiro.aPagar?C.red:C.text,marginTop:2,fontVariantNumeric:"tabular-nums"}}>{fmt(resumoFinanceiro.aPagar)}</p></div>
          {[["Pedidos aguardando",resumoFinanceiro.pendentes,C.orange],["Liberados",resumoFinanceiro.liberados,C.green],["Sem conciliação",fmt(resumoFinanceiro.naoConciliado),resumoFinanceiro.naoConciliado?C.orange:C.muted]].map(([l,v,c],index)=><div key={l} style={{padding:"12px",borderLeft:index||!isDesktop?`1px solid ${C.line}`:"none"}}><p style={{fontSize:8.5,color:C.muted,fontWeight:700}}>{l}</p><p style={{fontSize:13,fontWeight:800,color:c,marginTop:3,fontVariantNumeric:"tabular-nums"}}>{v}</p></div>)}
        </section>
        <div className="compras-funding" style={{display:"grid",gridTemplateColumns:cols(1,3,3),gap:6}}>{[["Conta da empresa",resumoFinanceiro.empresa,C.blue],["Caixa da obra",resumoFinanceiro.caixaObra,C.yellowD],["Cliente direto",resumoFinanceiro.cliente,C.purple]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"8px 10px",border:`1px solid ${C.line}`,borderRadius:8,background:C.surface}}><span style={{fontSize:9.5,color:C.muted,fontWeight:750}}>{l}</span><b style={{fontSize:10.5,color:c}}>{fmt(v)}</b></div>)}</div>
        {obraTemCaixa&&<div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap",padding:"10px 11px",border:`1px solid ${caixaPagamento.baixo?C.orange:C.green}`,borderLeft:`4px solid ${caixaPagamento.baixo?C.orange:C.green}`,borderRadius:9,background:caixaPagamento.baixo?`${C.orange}0A`:`${C.green}08`}}><div><p style={{fontSize:9,fontWeight:850,color:caixaPagamento.baixo?C.orange:C.green,textTransform:"uppercase"}}>{caixaPagamento.baixo?"Alerta · caixa da obra baixo":"Caixa da obra disponível"}</p><p style={{fontSize:9,color:C.muted,marginTop:2}}>Aportes {fmt(caixaPagamento.aportes)} · despesas {fmt(caixaPagamento.despesas)} · reserva recomendada {fmt(caixaPagamento.limiteBaixo)}</p></div><b style={{fontSize:16,color:caixaPagamento.saldo>=0?C.green:C.red}}>{fmt(caixaPagamento.saldo)}</b></div>}
        <TabRow tabs={[["pendentes","Pendentes"],["liberados","Liberados"],["nao_conciliados","Sem conciliação"],["todos","Todos"]]} active={filtroFinanceiro} onChange={setFiltroFinanceiro}/>
        {pedidosFinanceiros.length===0?<div className="compras-empty" style={{padding:28,textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:12}}><Ic n="check" s={22} color={C.green}/><p style={{fontSize:12,fontWeight:800,color:C.text,marginTop:7}}>Nenhuma pendência neste filtro</p></div>:pedidosFinanceiros.map(p=>{const st=statusPagamentoPedido(p),saldo=saldoPagamentoPedido(p),recebido=statusPedido(p)==="recebido",cor=st==="pago"?C.green:st==="parcial"?C.orange:C.red;return <div className="compras-payment-card" data-status={st} key={p.id} style={{background:C.card,border:`1px solid ${cor}55`,borderRadius:10,padding:"11px 12px"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}><div style={{minWidth:0}}><p style={{fontSize:12,fontWeight:850,color:C.text}}>{p.numero} · {nomeForn(p.fornecedorId)}</p><p style={{fontSize:9.5,color:C.muted,marginTop:3}}>{(p.itens||[]).map(i=>`${nomeMat(i.materialId)} (${Number(i.qtd||0).toLocaleString("pt-BR")} ${purchaseUnitOf(i)})`).join(" · ")}</p><p style={{fontSize:9,color:C.muted,marginTop:4}}>Pedido {fmtDate(p.data)}{p.previsao?` · entrega prevista ${fmtDate(p.previsao)}`:""}</p></div><div style={{textAlign:"right"}}><Badge color={cor}>{st==="pago"?"QUITADO / LIBERADO":st==="parcial"?"PAGAMENTO PARCIAL":"AGUARDANDO PAGAMENTO"}</Badge><p style={{fontSize:14,fontWeight:900,color:C.text,marginTop:4}}>{fmt(totalPedido(p))}</p>{saldo>0&&<p style={{fontSize:10,fontWeight:800,color:C.red}}>saldo {fmt(saldo)}</p>}</div></div>
          {(p.pagamentos||[]).length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>{p.pagamentos.map(pg=><div key={pg.id} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:8.5,fontWeight:750,color:pg.conciliado?C.green:C.orange,background:pg.conciliado?`${C.green}0C`:`${C.orange}0C`,border:`1px solid ${pg.conciliado?C.green:C.orange}44`,borderRadius:99,padding:"3px 5px 3px 7px"}}><span>{fmt(pg.valor)} · {origemPagamentoLabel(pg.origem)} · {pg.conciliado?"conciliado":"a conciliar"}</span>{(pg.comprovantes||[]).map(a=><a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{color:C.blue,textDecoration:"underline",fontWeight:850}} title={a.legenda||a.nome}>comprovante ↗</a>)}{canManagePurchases(currentUser?.role)&&<button type="button" onClick={()=>excluirPagamento(p,pg)} title="Excluir pagamento" aria-label={`Excluir pagamento de ${fmt(pg.valor)}`} style={{display:"inline-grid",placeItems:"center",width:20,height:20,border:0,borderRadius:99,background:`${C.red}12`,color:C.red,cursor:"pointer"}}><Ic n="trash" s={10}/></button>}</div>)}</div>}
          {recebido&&st!=="pago"&&<p style={{fontSize:9.5,fontWeight:800,color:C.red,marginTop:8}}>Registro legado: material recebido sem quitação vinculada. Regularize o financeiro para encerrar a inconsistência.</p>}
          <div style={{display:"flex",gap:6,marginTop:9,flexWrap:"wrap"}}>{saldo>0&&canManagePurchases(currentUser?.role)&&<Btn size="sm" onClick={()=>abrirPagamento(p)}>Registrar pagamento</Btn>}{st==="pago"&&!recebido&&<Btn size="sm" v="success" onClick={()=>setRecModal(p)}><Ic n="check"/> Receber na obra</Btn>}<Btn size="sm" v="ghost" onClick={()=>{setBusca(p.numero);setAba("pedidos");}}>Abrir pedido</Btn>{podeExcluirCompra&&<Btn size="sm" v="danger" onClick={()=>abrirExclusaoCompra(p)}><Ic n="trash"/> Excluir compra</Btn>}</div>
        </div>})}
      </>}

      {aba==="solicitacoes"&&<>
        <Btn onClick={abrirNovaSolicitacao} full><Ic n="plus"/> SOLICITAR MATERIAIS PARA A OBRA</Btn>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px"}}><p style={{fontSize:10.5,color:C.muted,lineHeight:1.5}}>A Engenharia pode selecionar insumos SINAPI/ORSE ou criar itens próprios. Solicitações enviadas acendem o alerta de Compras até serem colocadas em análise.</p></div>

        {/* Consolidação multi-obra: mesmo material, obras diferentes, mesma janela.
            Comprar junto é o único jeito de ter volume com 11 obras rodando. */}
        {consolidar.length>0&&(
          <div style={{background:`${C.blue}0C`,border:`1.5px solid ${C.blue}`,borderRadius:6,padding:"10px 12px"}}>
            <p style={{fontSize:11.5,fontWeight:900,color:C.blue}}>
              {consolidar.length} MATERIAL(IS) PEDIDO(S) POR MAIS DE UMA OBRA
            </p>
            <p style={{fontSize:10,color:C.muted,marginTop:2,lineHeight:1.45}}>
              Solicitações abertas dos últimos 10 dias. Comprar junto dá volume para negociar; a entrega continua separada por obra.
            </p>
            <div style={{marginTop:7}}>
              {consolidar.slice(0,5).map((c,ix)=>(
                <div key={ix} style={{borderTop:`1px solid ${C.line}`,paddingTop:6,marginTop:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}>
                    <p className="brk" style={{fontSize:11.5,fontWeight:800,color:C.text,minWidth:0}}>{c.descricao}</p>
                    <p style={{fontSize:11.5,fontWeight:900,color:C.blue,whiteSpace:"nowrap",flexShrink:0}}>
                      {c.total.toLocaleString("pt-BR")} {c.unidade}
                    </p>
                  </div>
                  {c.obras.map(o=>(
                    <p key={o.obraId} style={{fontSize:9.5,color:C.muted,marginTop:1}}>
                      {o.obraNome}: {o.qtd.toLocaleString("pt-BR")} {c.unidade} <span style={{color:C.subtle}}>({o.solicitacoes.join(", ")})</span>
                    </p>
                  ))}
                </div>
              ))}
              {consolidar.length>5&&<p style={{fontSize:9.5,color:C.subtle,marginTop:6}}>e mais {consolidar.length-5} material(is)...</p>}
            </div>
            <div style={{marginTop:9}}>
              <Btn size="sm" v="info" full onClick={()=>setCotWpp({
                titulo:`Cotação consolidada · ${consolidar.length} material(is)`,
                itens:consolidar.map(c=>({descricao:c.descricao,qtd:Number(c.total.toFixed(2)),unidade:c.unidade})),
                obraNome:"", prazo:"",
              })}><Ic n="cart"/> COTAR VOLUME CONSOLIDADO</Btn>
            </div>
          </div>
        )}
        {!solicitacoes.length?<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:20}}>Nenhuma solicitação para esta obra.</p>:solicitacoes.map(sol=>{
          const status={enviada:{l:"NOVA · AGUARDANDO COMPRAS",c:C.orange},em_analise:{l:"EM ANÁLISE",c:C.blue},pedido_gerado:{l:"PEDIDO GERADO",c:C.green},cancelada:{l:"CANCELADA",c:C.red}}[sol.status]||{l:sol.status,c:C.muted};
          const pedido=pedidoPorId.get(sol.pedidoId);
          const sla=slaSolicitacao(sol,today());
          const corBorda=sla&&sla.status==="estourado"?C.red:status.c;
          const instanciaApr=instanciaAprovacaoDe(sol);
          const etapasApr=etapasPendentesParaMim(instanciaApr);
          const aprCor={aprovada:C.green,reprovada:C.red,bloqueada:C.orange,em_andamento:C.blue}[instanciaApr?.status];
          const aprRotulo={aprovada:"APROVADA",reprovada:"REPROVADA",bloqueada:"AGUARDANDO CONFIGURAÇÃO",em_andamento:"AGUARDANDO APROVAÇÃO"}[instanciaApr?.status];
          return <div key={sol.id} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`4px solid ${corBorda}`,borderRadius:6,padding:"10px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}><div><p style={{fontSize:12.5,fontWeight:900,color:C.text}}>{sol.numero}{sol.prioridade==="urgente"&&<span style={{color:C.red}}> · URGENTE</span>}</p><p style={{fontSize:10,color:C.muted,marginTop:2}}>Solicitado por {sol.solicitanteNome||"Engenharia"} · {sol.criadoEm?new Date(sol.criadoEm).toLocaleString("pt-BR"):""}{sol.necessidade?` · necessário em ${fmtDate(sol.necessidade)}`:""}</p></div><div style={{textAlign:"right",flexShrink:0}}><Badge color={status.c}>{status.l}</Badge>
              {instanciaApr&&instanciaApr.status!=="aprovada"&&<div style={{marginTop:3}}><Badge color={aprCor}>{aprRotulo}</Badge></div>}
              {sla&&<div style={{marginTop:3}}><Badge color={sla.status==="estourado"?C.red:sla.status==="no_limite"?C.orange:C.muted}>
                {sla.status==="estourado"?`SLA ESTOURADO · ${sla.dias}d (limite ${sla.limite}d)`:sla.status==="no_limite"?`ÚLTIMO DIA DO SLA`:`${sla.dias}d de ${sla.limite}d`}
              </Badge></div>}
            </div></div>
            {etapasApr.length>0&&<div style={{marginTop:8,background:`${C.blue}0C`,border:`1px solid ${C.blue}44`,borderRadius:6,padding:"8px 10px"}}>
              <p style={{fontSize:10.5,fontWeight:800,color:C.blue}}>Aguardando sua aprovação · {etapasApr[0].etapa.nome}</p>
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <Btn size="sm" onClick={()=>decidirAprovacao(instanciaApr,etapasApr[0].etapa.id,"aprovado")}><Ic n="check"/> Aprovar</Btn>
                <Btn size="sm" v="danger" onClick={()=>{const motivo=window.prompt("Motivo da reprovação:");if(motivo)decidirAprovacao(instanciaApr,etapasApr[0].etapa.id,"reprovado",motivo);}}>Reprovar</Btn>
              </div>
            </div>}
            <div style={{marginTop:8,borderTop:`1px solid ${C.line}`,paddingTop:6}}>{sol.itens.map(item=><div key={item.id} style={{display:"grid",gridTemplateColumns:isDesktop?"95px minmax(0,1fr) auto auto":"78px minmax(0,1fr) auto",gap:7,fontSize:10.5,marginTop:4,alignItems:"center"}}><b style={{color:item.fonteRef==="ORSE"?C.purple:item.fonteRef==="PRÓPRIO"?C.orange:C.blue}}>{item.fonteRef} {item.codigoRef}</b><span style={{color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={item.descricaoRef}>{item.descricaoRef}</span><b style={{color:C.text,whiteSpace:"nowrap"}}>{Number(item.quantidade||0).toLocaleString("pt-BR")} {purchaseUnitOf(item)}{purchaseUnitOf(item)!==String(item.unidadeRef||"").toUpperCase()?<small style={{display:"block",color:C.muted,fontWeight:600}}>{referenceQuantityOf(item).toLocaleString("pt-BR",{maximumFractionDigits:4})} {item.unidadeRef}</small>:null}</b>{podeProcessar&&["enviada","em_analise"].includes(sol.status)&&<Btn size="sm" v="ghost" onClick={()=>abrirCotacaoDaSolicitacao(sol,item)}>COTAR</Btn>}</div>)}</div>
            {sol.observacao&&<p style={{fontSize:10,color:C.muted,marginTop:7}}>{sol.observacao}</p>}
            {sol.contatos?.length>0&&<p style={{fontSize:10,color:C.green,fontWeight:700,marginTop:7}}>
              Enviado para {sol.contatos.length} fornecedor(es): {sol.contatos.map(c=>c.fornecedorNome).filter(Boolean).join(", ")}
            </p>}
            {pedido&&<p style={{fontSize:10.5,color:C.green,fontWeight:800,marginTop:7}}>Vinculada ao pedido {pedido.numero}</p>}
            <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
              {["enviada","em_analise"].includes(sol.status)&&(podeProcessar||sol.solicitanteId===currentUser?.id)&&<Btn size="sm" v="ghost" onClick={()=>setSolModal({...sol,itens:(sol.itens||[]).map(i=>({...i,quantidade:String(i.quantidade||"")}))})}>EDITAR SOLICITAÇÃO</Btn>}
              {podeProcessar&&sol.status==="enviada"&&<Btn size="sm" v="ghost" onClick={()=>atualizarStatusSolicitacao(sol,"em_analise")}>MARCAR EM ANÁLISE</Btn>}
              {podeProcessar&&["enviada","em_analise"].includes(sol.status)&&<Btn size="sm" v="info" onClick={()=>setCotWpp({
                titulo:`Cotação · ${sol.numero}`,
                itens:sol.itens.map(i=>({descricao:i.descricaoRef,qtd:i.quantidade,unidade:purchaseUnitOf(i)})),
                obraNome:(data.obras||[]).find(o=>o.id===sol.obraId)?.name||"",
                prazo:sol.necessidade?fmtDate(sol.necessidade):"",
                solicitacaoId:sol.id,
              })}>COTAR POR WHATSAPP</Btn>}
              {podeProcessar&&["enviada","em_analise"].includes(sol.status)&&<Btn size="sm" onClick={()=>gerarPedidoSolicitacao(sol)}>GERAR PEDIDO</Btn>}
              {sol.status!=="pedido_gerado"&&sol.status!=="cancelada"&&(podeProcessar||sol.solicitanteId===currentUser?.id)&&<Btn size="sm" v="danger" onClick={()=>{if(window.confirm(`Cancelar ${sol.numero}?`))atualizarStatusSolicitacao(sol,"cancelada");}}>CANCELAR</Btn>}
            </div>
          </div>;
        })}
      </>}

      {/* HISTÓRICO DE COMPRAS — consulta e correção com trilha de auditoria */}
      {aba === "historico_compras" && (<>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.yellowD}`,borderRadius:7,padding:"10px 12px"}}>
          <p style={{fontSize:11.5,fontWeight:850,color:C.text}}>Tudo o que foi comprado, em uma única linha do tempo</p>
          <p style={{fontSize:9.5,color:C.muted,marginTop:3,lineHeight:1.5}}>Consulte itens, fornecedor, pagamento e recebimento. Ajustes exigem justificativa e ficam registrados no próprio pedido.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:pick("1fr","minmax(220px,1.4fr) 1fr","minmax(260px,1.5fr) 190px 190px 190px"),gap:8,alignItems:"end"}}>
          <Inp label="Buscar" value={buscaHistoricoCompra} onChange={setBuscaHistoricoCompra} placeholder="Pedido, material, fornecedor ou obra..."/>
          <Sel label="Situação" value={statusHistoricoCompra} onChange={setStatusHistoricoCompra} options={[
            {v:"todos",l:"Todas as situações"},{v:"enviado",l:"Aguardando entrega"},{v:"parcial",l:"Recebido parcialmente"},
            {v:"recebido",l:"Recebido"},{v:"cancelado",l:"Cancelado"},{v:"rascunho",l:"Rascunho"},
          ]}/>
          <Sel label="Fornecedor" value={fornecedorHistoricoCompra} onChange={setFornecedorHistoricoCompra} options={[{v:"",l:"Todos os fornecedores"},...fornecedores.map(f=>({v:f.id,l:f.nome}))]}/>
          <Sel label="Período" value={periodoHistorico} onChange={setPeriodoHistorico} options={[["6","Últimos 6 meses"],["12","Últimos 12 meses"],["24","Últimos 24 meses"],["todos","Todo o histórico"]].map(([v,l])=>({v,l}))}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <p style={{fontSize:10,color:C.muted}}><b style={{color:C.text}}>{comprasHistoricoFiltradas.length}</b> compra(s) · total <b style={{color:C.text}}>{fmt(comprasHistoricoFiltradas.reduce((s,p)=>s+totalPedido(p),0))}</b> · empresa <b style={{color:C.blue}}>{fmt(comprasHistoricoFiltradas.reduce((s,p)=>s+(p.pagamentos||[]).filter(pg=>pg.origem==="empresa").reduce((a,pg)=>a+Number(pg.valor||0),0),0))}</b> · caixa das obras <b style={{color:C.yellowD}}>{fmt(comprasHistoricoFiltradas.reduce((s,p)=>s+(p.pagamentos||[]).filter(pg=>pg.origem==="caixa_obra").reduce((a,pg)=>a+Number(pg.valor||0),0),0))}</b> · cliente direto <b style={{color:C.purple}}>{fmt(comprasHistoricoFiltradas.reduce((s,p)=>s+(p.pagamentos||[]).filter(pg=>pg.origem==="cliente_direto").reduce((a,pg)=>a+Number(pg.valor||0),0),0))}</b></p>
          {!obraIdFixo&&<div style={{display:"flex",padding:3,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7}}>{[["obra","Obra atual"],["todas","Todas visíveis"]].map(([v,l])=><button key={v} onClick={()=>setEscopoHistorico(v)} style={{border:0,borderRadius:5,padding:"6px 9px",background:escopoHistorico===v?C.text:"transparent",color:escopoHistorico===v?"#fff":C.muted,fontSize:9,fontWeight:800,cursor:"pointer"}}>{l}</button>)}</div>}
        </div>
        {!comprasHistoricoFiltradas.length?<div style={{padding:26,textAlign:"center",background:C.card,border:`1px dashed ${C.border}`,borderRadius:8}}><p style={{fontSize:12,fontWeight:800,color:C.text}}>Nenhuma compra encontrada</p><p style={{fontSize:9.5,color:C.muted,marginTop:3}}>Altere os filtros ou amplie o período.</p></div>:
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {comprasHistoricoFiltradas.map(p=>{
              const st=statusPedido(p),meta=STATUS_PEDIDO[st]||{l:st,c:C.muted};
              const pagoEmpresa=(p.pagamentos||[]).filter(pg=>pg.origem==="empresa").reduce((s,pg)=>s+Number(pg.valor||0),0);
              const pagoCaixa=(p.pagamentos||[]).filter(pg=>pg.origem==="caixa_obra").reduce((s,pg)=>s+Number(pg.valor||0),0);
              const pagoCliente=(p.pagamentos||[]).filter(pg=>pg.origem==="cliente_direto").reduce((s,pg)=>s+Number(pg.valor||0),0);
              const recebido=(p.itens||[]).reduce((s,i)=>s+Number(i.qtdRecebida||0)*Number(i.precoUnit||0),0);
              const ultimoAjuste=(p.ajustes||[]).slice(-1)[0];
              return <article key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${meta.c}`,borderRadius:7,padding:"11px 12px"}}>
                <div style={{display:"grid",gridTemplateColumns:pick("1fr auto","1fr auto","100px minmax(170px,1.2fr) 115px auto"),gap:9,alignItems:"center"}}>
                  <div><p style={{fontSize:11,fontWeight:850,color:C.blue}}>{p.numero}</p><p style={{fontSize:8.5,color:C.muted,marginTop:2}}>{fmtDate(p.data)}</p></div>
                  {pick(null,<div><p style={{fontSize:10,fontWeight:750,color:C.text}}>{nomeForn(p.fornecedorId)}</p><p style={{fontSize:8.5,color:C.muted}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"}</p></div>,<div><p className="brk" style={{fontSize:10.5,fontWeight:800,color:C.text}}>{nomeForn(p.fornecedorId)}</p><p className="brk" style={{fontSize:8.5,color:C.muted,marginTop:2}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"} · {(p.itens||[]).length} item(ns)</p></div>)}
                  {pick(null,null,<div><p style={{fontSize:8,color:C.muted,textTransform:"uppercase"}}>Recebido na obra</p><p style={{fontSize:10.5,fontWeight:800,color:C.text}}>{fmt(recebido)}</p></div>)}
                  <div style={{textAlign:"right"}}><p style={{fontSize:12.5,fontWeight:850,color:C.text}}>{fmt(totalPedido(p))}</p><Badge color={meta.c}>{meta.l}</Badge></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:cols(1,3,3),gap:6,marginTop:8}}>
                  {[
                    ["empresa","Pago pela empresa",pagoEmpresa,C.blue],
                    ["caixa_obra","Pago pelo caixa da obra",pagoCaixa,C.yellowD],
                    ["cliente_direto","Pago diretamente pelo cliente",pagoCliente,C.purple],
                  ].map(([origem,label,totalOrigem,cor])=><div key={origem}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=cor;}}
                    onDragLeave={e=>{e.currentTarget.style.borderColor=`${cor}45`;}}
                    onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor=`${cor}45`;const pagamentoId=e.dataTransfer.getData("text/arcd-pagamento");if(pagamentoId)reclassificarOrigemPagamento(p,pagamentoId,origem);}}
                    style={{minHeight:76,padding:"7px 8px",border:`1px dashed ${cor}45`,background:`${cor}07`,borderRadius:5,transition:"border-color .15s,background .15s"}}>
                    <span style={{fontSize:8,color:C.muted,textTransform:"uppercase"}}>{label}</span>
                    <b style={{display:"block",fontSize:12,color:cor,marginTop:2}}>{fmt(totalOrigem)}</b>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                      {(p.pagamentos||[]).filter(pg=>pg.origem===origem).map(pg=><button type="button" draggable key={pg.id}
                        onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/arcd-pagamento",pg.id);}}
                        title="Arraste para outra coluna para corrigir a origem"
                        style={{border:`1px solid ${cor}55`,background:C.card,color:cor,borderRadius:4,padding:"3px 6px",fontSize:8.5,fontWeight:800,cursor:"grab"}}>
                        ⋮⋮ {fmt(pg.valor)} · {fmtDate(pg.data)}
                      </button>)}
                      {!(p.pagamentos||[]).some(pg=>pg.origem===origem)&&<small style={{fontSize:8,color:C.muted}}>Arraste um pagamento para cá</small>}
                    </div>
                  </div>)}
                </div>
                <div style={{marginTop:8,paddingTop:7,borderTop:`1px solid ${C.line}`,display:"flex",flexDirection:"column",gap:4}}>
                  {(p.itens||[]).map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:9.5}}><span className="brk" style={{color:C.muted}}>{nomeMat(i.materialId)} · {Number(i.qtd)} {purchaseUnitOf(i)} × {fmt(Number(i.precoUnit||0))}</span><b style={{color:C.text,whiteSpace:"nowrap"}}>{fmt(Number(i.qtd||0)*Number(i.precoUnit||0))}</b></div>)}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:8}}>
                  <p style={{fontSize:8.5,color:C.muted}}>{ultimoAjuste?`Último ajuste: ${ultimoAjuste.usuario||"Operador"} · ${new Date(ultimoAjuste.criadoEm).toLocaleString("pt-BR")} · ${ultimoAjuste.motivo}`:"Sem ajustes registrados"}</p>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {st!=="cancelado"&&<Btn size="sm" v="ghost" onClick={()=>setPedModal({...p,motivoAjuste:"",itens:p.itens.map(i=>({...i,qtd:String(i.qtd),precoUnit:String(i.precoUnit)}))})}><Ic n="edit"/> Ajustar compra</Btn>}
                    {podeExcluirCompra&&<Btn size="sm" v="danger" onClick={()=>abrirExclusaoCompra(p)}><Ic n="trash"/> Excluir</Btn>}
                  </div>
                </div>
              </article>;
            })}
          </div>}
      </>)}

      {/*  PEDIDOS  */}
      {aba === "pedidos" && (<>
        {atrasados.length>0&&(
          <div style={{background:`${C.red}0C`,border:`1.5px solid ${C.red}`,borderRadius:6,padding:"9px 11px"}}>
            <p style={{fontSize:11.5,fontWeight:900,color:C.red}}>{atrasados.length} PEDIDO(S) COM ENTREGA ATRASADA</p>
            <p style={{fontSize:10,color:C.muted,marginTop:2}}>
              {atrasados.slice(0,3).map(x=>`${x.pedido.numero} · ${nomeForn(x.pedido.fornecedorId)} · +${x.diasAtraso}d`).join("   ")}
              {"  ·  Use o botão Cobrar entrega no pedido."}
            </p>
          </div>
        )}
        <Inp value={busca} onChange={setBusca} placeholder="Buscar pedido ou fornecedor..."/>
        <Btn onClick={()=>setPedModal({id:"",numero:"",obraId:obraAtual,fornecedorId:"",
          data:new Date().toISOString().slice(0,10),previsao:"",status:"enviado",
          origemPagamento:"empresa",pagamentos:[],referenciaId:basesCompra[0]?.id||"",itens:[{id:uid(),materialId:"",qtd:"",precoUnit:"",qtdRecebida:0,orcItemId:"",orcNivel1Id:"",referenciaId:"",fonteRef:"",codigoRef:"",descricaoRef:"",unidadeRef:"",unidadeCompra:"",fatorConversao:1,precoRef:0,dataBaseRef:"",ufRef:""}],obs:""})} full>
          <Ic n="plus"/> Novo pedido
        </Btn>

        {pedidos.length === 0
          ? <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:20}}>Nenhum pedido nesta obra.</p>
          : pedidos.map(p => {
            const st = statusPedido(p);
            const meta = STATUS_PEDIDO[st];
            const pend = pendentePedido(p);
            return (
              <div key={p.id} style={{
                background:C.card, border:`1px solid ${C.border}`,
                borderLeft:`3px solid ${meta.c}`, borderRadius:6, padding:"10px 12px",
              }}>
                <div className="fluid-grid" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8}}>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:12.5,fontWeight:800,color:C.text,
                               fontFamily:"'Inter Display','Inter',sans-serif"}}>{p.numero}</p>
                    <p className="brk" style={{fontSize:11,color:C.muted,marginTop:2}}>
                      {nomeForn(p.fornecedorId)}
                    </p>
                    <p style={{fontSize:10,color:C.muted,marginTop:1}}>
                      {fmtDate(p.data)}  {p.itens.length} item(ns)
                      {p.previsao && `  entrega ${fmtDate(p.previsao)}`}
                    </p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <Badge color={meta.c}>{meta.l}</Badge>
                    <div style={{marginTop:3}}><Badge color={statusPagamentoPedido(p)==="pago"?C.green:C.orange}>{statusPagamentoPedido(p)==="pago"?`PAGO · ${origemPagamentoLabel(p.origemPagamento)}`:`PREVISTO · ${origemPagamentoLabel(p.origemPagamento)}`}</Badge></div>
                    {atrasoDe[p.id]&&<div style={{marginTop:3}}><Badge color={C.red}>ATRASADO +{atrasoDe[p.id].diasAtraso}d</Badge></div>}
                    <p style={{fontSize:14,fontWeight:800,color:C.text,marginTop:4,whiteSpace:"nowrap"}}>
                      {fmt(totalPedido(p))}
                    </p>
                    {pend > 0.01 && st !== "rascunho" && st !== "cancelado" && (
                      <p style={{fontSize:9.5,color:C.orange,marginTop:1}}>
                        falta {fmt(pend)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Itens */}
                <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.line}`}}>
                  {p.itens.map(i => {
                    const completo = Number(i.qtdRecebida) >= Number(i.qtd) - 1e-6;
                    return (
                      <div key={i.id} style={{display:"flex",justifyContent:"space-between",gap:8,
                                              fontSize:10.5,marginTop:2,alignItems:"baseline"}}>
                        <span className="brk" style={{color:C.muted,minWidth:0}}>
                          {nomeMat(i.materialId)}
                          {!i.orcNivel1Id&&!i.orcItemId && linhasOrc.length > 0 && (
                            <span style={{color:C.orange,fontSize:9}}>  sem apropriação</span>
                          )}
                          {referencePricePerPurchaseUnit(i)>0&&(Number(i.precoUnit)>0?(()=>{const ref=referencePricePerPurchaseUnit(i),dif=Number(i.precoUnit)-ref,pct=dif/ref*100,cor=dif<=0?C.green:C.red;return <span style={{display:"block",fontSize:9,color:cor,fontWeight:800,marginTop:1}}>{i.fonteRef} {i.codigoRef} · compra {fmt(Number(i.precoUnit))} · ref. {fmt(ref)}/{purchaseUnitOf(i)} · {dif<=0?"abaixo":"acima"} {Math.abs(pct).toLocaleString("pt-BR",{maximumFractionDigits:2})}%</span>;})():<span style={{display:"block",fontSize:9,color:C.muted,marginTop:1}}>{i.fonteRef} {i.codigoRef} · ref. {fmt(referencePricePerPurchaseUnit(i))}/{purchaseUnitOf(i)} · preço de compra não informado</span>)}
                        </span>
                        <span style={{whiteSpace:"nowrap",flexShrink:0,
                                      color: completo ? C.green : C.text, fontWeight:600}}>
                          {i.qtdRecebida > 0 && `${i.qtdRecebida}/`}{i.qtd} {purchaseUnitOf(i)}
                          {completo && " ok"}
                        </span>
                      </div>
                    );
                  })}
	                </div>
	                {p.analiseIA&&<div style={{marginTop:7,padding:"7px 9px",background:`${C.purple}08`,border:`1px solid ${C.purple}2F`,borderRadius:7,display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:9.5,color:C.purple,fontWeight:800}}><Ic n="brain" s={11}/> Sugestão da IA revisada por {p.analiseIA.revisadoPor||"operador"} · confiança {Number(p.analiseIA.confianca||0)}%</span><span>{(p.documentos||[]).map(a=><a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{fontSize:9.5,color:C.blue,marginLeft:8}}>{a.nome} ↗</a>)}</span></div>}

	                <div style={{display:"flex",gap:6,marginTop:9,flexWrap:"wrap"}}>
                  {(st === "enviado" || st === "parcial") && <Btn size="sm" onClick={()=>setRecModal(p)} full><Ic n="check"/> Receber material</Btn>}
                  {(st === "enviado" || st === "parcial") && !pedidoLiberadoParaReceber(p) && (
                    <Btn size="sm" v="ghost" onClick={()=>{setAba("financeiro");setFiltroFinanceiro("pendentes");}} full>
                      Saldo em aberto · {fmt(saldoPagamentoPedido(p))}
                    </Btn>
                  )}
                  {st !== "cancelado" && st !== "recebido" && (
                    <Btn size="sm" v="ghost" onClick={()=>setPedModal({
                      ...p, itens: p.itens.map(i=>({...i,qtd:String(i.qtd),precoUnit:String(i.precoUnit)}))
                    })}><Ic n="edit"/> Editar pedido</Btn>
                  )}
                  {st !== "cancelado" && st !== "recebido" && (
                    <Btn size="sm" v="danger" disabled={cancelandoCompra} onClick={()=>cancelarPedido(p)}><Ic n="trash"/> Cancelar pedido</Btn>
                  )}
                  {podeExcluirCompra&&(
                    <Btn size="sm" v="danger" onClick={()=>abrirExclusaoCompra(p)}><Ic n="trash"/> Excluir definitivamente</Btn>
                  )}
                  {atrasoDe[p.id]&&(()=>{
                    const forn=fornecedorPorId.get(p.fornecedorId);
                    if(!forn?.telefone)return null;
                    const obra=obraPorId.get(p.obraId);
                    const texto=mensagemWhatsAppCobranca({
                      empresa:"ARCD Construtech",fornecedorNome:forn.nome,obraNome:obra?.name||"",
                      numero:p.numero,previsao:fmtDate(p.previsao),
                      diasAtraso:atrasoDe[p.id].diasAtraso,itens:atrasoDe[p.id].itensPendentes,
                    });
                    return <a href={linkWhatsApp(forn.telefone,texto)} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
                      <Btn size="sm" v="danger">Cobrar entrega</Btn>
                    </a>;
                  })()}
                  {st !== "cancelado" && st !== "recebido" && (() => {
                    const forn = fornecedorPorId.get(p.fornecedorId);
                    if (!forn?.telefone) return null;
                    const obra = obraPorId.get(p.obraId);
                    const itensMsg = (p.itens||[]).map(i => {
                      const mat = materialPorId.get(i.materialId);
                      return { descricao: mat?.descricao || "Material", qtd: i.qtd, unidade: mat?.unidade || "" };
                    });
                    const texto = mensagemWhatsAppCompra({
                      empresa: "ARCD Construtech", fornecedorNome: forn.nome,
                      obraNome: obra?.name || "", prazo: p.previsao ? fmtDate(p.previsao) : "",
                      itens: itensMsg,
                    });
                    return (
                      <a href={linkWhatsApp(forn.telefone, texto)} target="_blank" rel="noreferrer"
                         style={{ textDecoration: "none" }}>
                        <Btn size="sm" v="ghost">WhatsApp</Btn>
                      </a>
                    );
                  })()}
                </div>
              </div>
            );
          })}
      </>)}

      {/*  ORÇADO x COMPRADO  */}
      {aba === "orcado" && (
        todasObras ? (
          <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:20,lineHeight:1.6}}>
            Orçado × comprado compara com o orçamento de uma obra específica.<br/>
            Selecione uma obra no filtro acima para ver esta comparação.
          </p>
        ) : !orcVs.orc ? (
          <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:20,lineHeight:1.6}}>
            Esta obra ainda não tem orçamento vinculado.<br/>
            Crie um em <strong>Orçamento</strong> e amarre-o à obra.
          </p>
        ) : (<>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
            <p style={{fontSize:11,color:C.muted,lineHeight:1.55}}>
              Comparação em <strong style={{color:C.text}}>reais</strong>, não em quantidade: o
              orçamento fala em serviço (m de alvenaria), a compra fala em material (saco de
              cimento). O orçado é o <strong style={{color:C.text}}>custo</strong>, sem BDI -
              BDI é sua margem, não entra no que você paga ao fornecedor.
            </p>
          </div>

          {/* Total */}
          {(() => {
            const totOrc  = orcVs.linhas.reduce((s,l) => s + l.orcado, 0);
            const totComp = orcVs.linhas.reduce((s,l) => s + l.comprado, 0);
            const pct = totOrc ? (totComp/totOrc)*100 : 0;
            return (
              <div style={{background:C.card,border:`1.5px solid ${C.yellow}`,
                           borderRadius:6,padding:"11px 13px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[["Orçado",fmt(totOrc),C.text],["Comprado",fmt(totComp),C.blue],
                    ["Saldo",fmt(totOrc-totComp), totComp > totOrc ? C.red : C.green]].map(([l,v,c])=>(
                    <div key={l}>
                      <p style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",fontWeight:700}}>{l}</p>
                      <p style={{fontSize:"clamp(12px,3.4vw,15px)",fontWeight:800,color:c,
                                 whiteSpace:"nowrap",fontFamily:"'Inter Display','Inter',sans-serif"}}>{v}</p>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:9,height:6,background:C.line,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,pct)}%`,
                               background: pct > 100 ? C.red : C.yellow, borderRadius:99}}/>
                </div>
                <p style={{fontSize:10,color:C.muted,marginTop:4}}>
                  {pct.toFixed(1)}% do orçamento já comprado
                </p>
              </div>
            );
          })()}

          {/* Compras sem apropriação - o número que denuncia */}
          {orcVs.semApropriacao > 0.01 && (
            <div style={{background:`${C.orange}0E`,border:`1.5px solid ${C.orange}`,
                         borderRadius:6,padding:"10px 12px"}}>
              <p style={{fontSize:12,fontWeight:800,color:C.orange}}>
                {fmt(orcVs.semApropriacao)} comprado sem apropriação
              </p>
              <p style={{fontSize:10.5,color:C.muted,marginTop:3,lineHeight:1.5}}>
                Dinheiro gasto que não bate com nenhuma linha do orçamento. Ou faltou apontar
                o item no pedido, ou o orçamento não previu esse gasto - e nos dois casos vale
                descobrir qual.
              </p>
            </div>
          )}

          {/* Linhas */}
          {orcVs.linhas.map(l => {
            const cor = l.estourou ? C.red : l.pct >= 90 ? C.orange : C.green;
            return (
              <div key={l.it.id} style={{
                background:C.card, border:`1px solid ${C.border}`,
                borderLeft:`3px solid ${cor}`, borderRadius:6, padding:"10px 12px",
              }}>
                <p style={{fontSize:9.5,color:C.muted,textTransform:"uppercase",
                           fontWeight:700,letterSpacing:.5}}>{l.etapa}</p>
                <p className="brk" style={{fontSize:12,fontWeight:700,color:C.text,marginTop:2}}>
                  {l.it.descricao || l.it.codigo}
                </p>

                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:8}}>
                  {[["Orçado",l.orcado,C.muted],["Comprado",l.comprado,C.text],
                    ["Saldo",l.saldo,cor]].map(([lb,v,c])=>(
                    <div key={lb}>
                      <p style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",fontWeight:700}}>{lb}</p>
                      <p style={{fontSize:11.5,fontWeight:800,color:c,whiteSpace:"nowrap"}}>{fmt(v)}</p>
                    </div>
                  ))}
                </div>

                <div style={{marginTop:8,height:5,background:C.line,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,l.pct)}%`,
                               background:cor,borderRadius:99}}/>
                </div>

                {l.estourou && (
                  <p style={{fontSize:10.5,color:C.red,marginTop:6,fontWeight:700}}>
                     Estourou {fmt(l.comprado - l.orcado)} ({(l.pct-100).toFixed(0)}% acima)
                  </p>
                )}
                {!l.estourou && l.comprado > 0 && (
                  <p style={{fontSize:10,color:C.muted,marginTop:5}}>
                    {l.pct.toFixed(0)}% comprado
                  </p>
                )}
              </div>
            );
          })}
        </>)
      )}

      {/*  COTAÇÕES  */}
      {aba === "cotacoes" && (<>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div><h3 style={{fontSize:16,fontWeight:800,color:C.text}}>Mapa de cotações</h3><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Compare propostas, prazo e economia antes de gerar a ordem de compra.</p></div>
          <Btn onClick={()=>setCotModal({id:"",obraId:obraAtual,materialId:"",qtd:"",orcItemId:"",orcNivel1Id:"",data:today(),
            propostas:[{id:uid(),fornecedorId:"",precoUnit:"",prazoDias:"",obs:"",documentos:[]},{id:uid(),fornecedorId:"",precoUnit:"",prazoDias:"",obs:"",documentos:[]}]})}>
            <Ic n="plus"/> Adicionar cotação
          </Btn>
        </div>

        <div style={{display:"grid",gridTemplateColumns:pick("1fr","minmax(230px,1fr) 150px 150px","minmax(280px,1fr) 160px 160px auto"),gap:7,alignItems:"end"}}>
          <Inp label="Buscar" value={buscaCotacao} onChange={setBuscaCotacao} placeholder="Código, insumo, solicitação ou fornecedor..."/>
          <Inp label="Data inicial" type="date" value={inicioCotacao} onChange={setInicioCotacao}/>
          <Inp label="Data final" type="date" value={fimCotacao} onChange={setFimCotacao}/>
          {isDesktop&&<Btn size="sm" v="ghost" onClick={()=>{setBuscaCotacao("");setInicioCotacao("");setFimCotacao("");setStatusCotacao("todas");}}>Limpar filtros</Btn>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:`repeat(3,minmax(0,1fr))`,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          {[["aberta","Abertas",cotacoes.filter(c=>c.status==="aberta").length,C.orange],["decidida","Compra gerada",cotacoes.filter(c=>c.status==="decidida").length,C.green],["todas","Todas",cotacoes.length,C.blue]].map(([v,l,n,c],i)=>{
            const ativo=statusCotacao===v;return <button key={v} type="button" onClick={()=>setStatusCotacao(v)} style={{position:"relative",border:0,borderLeft:i?`1px solid ${C.line}`:"none",background:ativo?`${c}0B`:"transparent",padding:"10px 12px",textAlign:"left",cursor:"pointer"}}>
              <span style={{fontSize:9.5,fontWeight:750,color:ativo?c:C.muted}}>{l}</span><b style={{float:"right",fontSize:10,color:ativo?c:C.muted}}>{n}</b>{ativo&&<i style={{position:"absolute",left:0,right:0,bottom:0,height:2,background:c}}/>}
            </button>;
          })}
        </div>

        {!cotacoesFiltradas.length
          ? <div style={{padding:30,textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:9,background:C.card}}><p style={{fontSize:12,fontWeight:800,color:C.text}}>Nenhuma cotação encontrada</p><p style={{fontSize:9.5,color:C.muted,marginTop:3}}>Ajuste os filtros ou adicione uma nova cotação.</p></div>
          : <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,overflow:"hidden"}}>
            {isDesktop&&<div style={{display:"grid",gridTemplateColumns:"90px minmax(220px,1.5fr) 100px 115px 105px 100px 92px",gap:10,padding:"8px 11px",background:C.surface,borderBottom:`1px solid ${C.border}`,fontSize:8.5,fontWeight:800,color:C.muted,textTransform:"uppercase"}}><span>Código</span><span>Insumo</span><span>Fornecedores</span><span>Necessidade</span><span>Status</span><span>Prioridade</span><span>Ações</span></div>}
            {cotacoesFiltradas.map((c,index)=>{
              const ord=[...(c.propostas||[])].sort((a,b)=>Number(a.precoUnit||0)-Number(b.precoUnit||0));
              const melhor=ord[0],sol=solicitacaoPorId.get(c.solicitacaoId),expandida=cotacaoExpandida===c.id;
              const codigo=c.numero||`CT-${String(cotacoes.indexOf(c)+1).padStart(4,"0")}`;
              const prioridade=sol?.prioridade||"normal";
              return <div key={c.id} style={{borderTop:index?`1px solid ${C.line}`:"none"}}>
                <div role="button" tabIndex={0} onClick={()=>setCotacaoExpandida(expandida?"":c.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setCotacaoExpandida(expandida?"":c.id);}}} style={{display:"grid",gridTemplateColumns:isDesktop?"90px minmax(220px,1.5fr) 100px 115px 105px 100px 92px":"1fr auto",gap:10,width:"100%",alignItems:"center",padding:isDesktop?"11px":"12px",border:0,background:expandida?`${C.blue}05`:"transparent",textAlign:"left",cursor:"pointer"}}>
                  {isDesktop&&<b style={{fontSize:9.5,color:C.blue}}>{codigo}</b>}
                  <div style={{minWidth:0}}><b className="brk" style={{display:"block",fontSize:11,color:C.text}}>{nomeMat(c.materialId)}</b><span style={{fontSize:8.8,color:C.muted}}>{Number(c.qtd||0).toLocaleString("pt-BR")} {unidMat(c.materialId)}{sol?.numero?` · ${sol.numero}`:""}{!isDesktop?` · ${codigo}`:""}</span></div>
                  {isDesktop&&<span style={{fontSize:10,color:C.text}}>{ord.length}</span>}
                  {isDesktop&&<span style={{fontSize:9.5,color:C.muted}}>{fmtDate(sol?.necessidade||c.data)}</span>}
                  {isDesktop&&<Badge color={c.status==="decidida"?C.green:C.blue}>{c.status==="decidida"?"Compra gerada":"Cotada"}</Badge>}
                  {isDesktop&&<span style={{fontSize:9.5,fontWeight:800,color:prioridade==="urgente"?C.red:C.orange}}>{prioridade==="urgente"?"Alta":"Média"}</span>}
                  <div style={{display:"flex",gap:4,justifyContent:"flex-end",alignItems:"center"}}>{podeProcessar&&<Btn size="sm" v="danger" title="Excluir cotação" onClick={e=>{e.stopPropagation();excluirCotacao(c);}}><Ic n="trash" s={11}/>{isDesktop&&" Excluir"}</Btn>}<span aria-label={expandida?"Recolher":"Comparar propostas"} style={{display:"inline-block",color:C.muted,transform:expandida?"rotate(180deg)":"none",transition:"transform .15s"}}>⌄</span></div>
                </div>
                {!isDesktop&&<div style={{display:"flex",gap:5,padding:"0 12px 10px",flexWrap:"wrap"}}><Badge color={c.status==="decidida"?C.green:C.blue}>{c.status==="decidida"?"Compra gerada":"Cotada"}</Badge><Badge color={prioridade==="urgente"?C.red:C.orange}>{prioridade==="urgente"?"Alta":"Média"}</Badge><span style={{fontSize:9,color:C.muted,alignSelf:"center"}}>{ord.length} fornecedor(es) · {fmtDate(sol?.necessidade||c.data)}</span></div>}
                {expandida&&<div style={{padding:"0 11px 12px",background:C.surface,borderTop:`1px solid ${C.line}`}}>
                  <div style={{display:"grid",gridTemplateColumns:isDesktop?"minmax(170px,1fr) 120px 100px 120px auto":"1fr",gap:6,padding:"8px 7px 5px",fontSize:8.5,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>{isDesktop&&<><span>Fornecedor</span><span>Preço unitário</span><span>Prazo</span><span>Total</span><span>Ação</span></>}</div>
                  {ord.map(p=>{const eh=p.id===melhor?.id,venceu=c.escolhida===p.id,dif=(Number(p.precoUnit||0)-Number(melhor?.precoUnit||0))*Number(c.qtd||0);return <div key={p.id} style={{display:"grid",gridTemplateColumns:isDesktop?"minmax(170px,1fr) 120px 100px 120px auto":"1fr auto",gap:8,alignItems:"center",padding:"9px 8px",marginTop:5,background:C.card,border:`1px solid ${venceu?C.green:eh?`${C.green}66`:C.border}`,borderRadius:7}}>
                    <div><b className="brk" style={{display:"block",fontSize:10.5,color:C.text}}>{nomeForn(p.fornecedorId)} {venceu&&"✓"}</b>{eh&&<span style={{fontSize:8.5,fontWeight:800,color:C.green}}>MENOR PREÇO</span>}</div>
                    {isDesktop&&<b style={{fontSize:10.5}}>{fmt(p.precoUnit)}/{unidMat(c.materialId)}</b>}
                    {isDesktop&&<span style={{fontSize:9.5,color:C.muted}}>{p.prazoDias||0} dia(s)</span>}
                    <div style={{textAlign:isDesktop?"left":"right"}}><b style={{fontSize:11,color:C.text}}>{fmt(Number(p.precoUnit||0)*Number(c.qtd||0))}</b>{dif>.01&&<small style={{display:"block",fontSize:8,color:C.red}}>+{fmt(dif)}</small>}</div>
                    {isDesktop&&<div>{c.status==="aberta"&&<Btn size="sm" v={eh?"success":"ghost"} onClick={e=>{e.stopPropagation();setCotDecisao({cotacaoId:c.id,propostaId:p.id,justificativa:""});}}>Escolher</Btn>}</div>}
                    <div style={{gridColumn:isDesktop?"1/-1":"1/-1",paddingTop:5,borderTop:`1px solid ${C.line}`}}><LinksDocumentosAuditaveis documentos={p.documentos||[]} subindo={subindoAnexoCotacao&&anexoCotacao?.cotacao?.id===c.id&&anexoCotacao?.proposta?.id===p.id} onSelecionar={e=>selecionarDocumentoCotacao(c,p,e)} C={C}/>{!isDesktop&&c.status==="aberta"&&<Btn size="sm" v={eh?"success":"ghost"} full onClick={()=>setCotDecisao({cotacaoId:c.id,propostaId:p.id,justificativa:""})}>Escolher e gerar pedido</Btn>}</div>
                  </div>;})}
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
                    <span style={{fontSize:9,color:C.muted}}>{c.status==="decidida"?`Economia registrada: ${fmt(c.economia||0)}`:"Selecione a proposta considerando preço, prazo e documentação."}</span>
                    {podeProcessar&&<Btn size="sm" v="danger" onClick={()=>excluirCotacao(c)}><Ic n="trash"/> Excluir cotação</Btn>}
                  </div>
                </div>}
              </div>;
            })}
          </div>}
      </>)}

      {/*  FORNECEDORES  */}
      {aba === "forn" && (<>
        <Btn onClick={()=>setFornModal({id:"",nome:"",nomeFantasia:"",razaoSocial:"",cnpj:"",contato:"",telefone:"",email:"",categorias:[],atividadeCnae:"",situacaoCadastral:"",dataAbertura:"",cep:"",endereco:"",numero:"",complemento:"",bairro:"",cidade:"",uf:"",obs:""})} full>
          <Ic n="plus"/> Novo fornecedor
        </Btn>
        {fornecedores.length === 0
          ? <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:20}}>Nenhum fornecedor.</p>
          : fornecedores.map(f => (
            <div key={f.id} onClick={()=>setFornModal(f)} style={{background:C.card,
              border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",cursor:"pointer"}}>
              <p className="brk" style={{fontSize:12.5,fontWeight:700,color:C.text}}>{f.nome}</p>
              <p style={{fontSize:10.5,color:C.muted,marginTop:2}}>
                {[f.cnpj, f.contato, f.telefone].filter(Boolean).join("  ") || "sem contato"}
              </p>
              {(f.cidade || f.bairro) && (
                <p style={{fontSize:10,color:C.muted,marginTop:2}}>
                  {[f.bairro, f.cidade, f.uf].filter(Boolean).join(", ")}
                </p>
              )}
              {(f.categorias||[]).length > 0 && (
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                  {(f.categorias||[]).slice(0,5).map(c=>(
                    <span key={c} style={{fontSize:9,fontWeight:700,color:C.yellowD,
                          background:`${C.yellow}16`,padding:"2px 7px",borderRadius:99}}>
                      {rotuloRamo(c)}
                    </span>
                  ))}
                  {(f.categorias||[]).length > 5 && (
                    <span style={{fontSize:9,color:C.muted,padding:"2px 4px"}}>
                      +{(f.categorias||[]).length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
      </>)}

      {/*  HISTÓRICO POR FORNECEDOR  */}
      {aba === "hist_fornecedor" && (<>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px"}}>
          <p style={{fontSize:11,color:C.muted,lineHeight:1.55}}><strong style={{color:C.text}}>Memória comercial auditável.</strong> Consulte tudo o que foi pedido, recebido, em quais obras e quais insumos cada fornecedor entregou. Pedidos cancelados não entram nos indicadores.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:pick("1fr","1fr 180px","1fr 190px 210px"),gap:8,alignItems:"end"}}>
          <Inp label="Buscar fornecedor" value={buscaFornecedorHistorico} onChange={setBuscaFornecedorHistorico} placeholder="Nome ou CNPJ..."/>
          <Sel label="Período" value={periodoHistorico} onChange={setPeriodoHistorico} options={[["6","Últimos 6 meses"],["12","Últimos 12 meses"],["24","Últimos 24 meses"],["todos","Todo o histórico"]].map(([v,l])=>({v,l}))}/>
          {!obraIdFixo&&<div><p style={{fontSize:9,fontWeight:750,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Abrangência</p><div style={{display:"flex",padding:3,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8}}>{[["obra","Obra atual"],["todas","Todas visíveis"]].map(([v,l])=><button key={v} onClick={()=>setEscopoHistorico(v)} style={{flex:1,border:0,borderRadius:6,padding:"7px 8px",background:escopoHistorico===v?C.text:"transparent",color:escopoHistorico===v?"#fff":C.muted,fontSize:9.5,fontWeight:800,cursor:"pointer"}}>{l}</button>)}</div></div>}
        </div>
        {resumoFornecedoresHistorico.length===0?<div style={{padding:28,textAlign:"center",background:C.card,border:`1px dashed ${C.border}`,borderRadius:12}}><Ic n="box" s={22} color={C.muted}/><p style={{fontSize:12,fontWeight:800,color:C.text,marginTop:8}}>Nenhuma compra encontrada</p><p style={{fontSize:10,color:C.muted,marginTop:3}}>Ajuste o período, a obra ou o termo pesquisado.</p></div>:
        <div style={{display:"grid",gridTemplateColumns:pick("1fr","minmax(230px,.8fr) minmax(0,1.2fr)","minmax(270px,.72fr) minmax(0,1.55fr)"),gap:10,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:570,overflowY:"auto",paddingRight:2}}>
            {resumoFornecedoresHistorico.map((r,idx)=>{const ativo=r.fornecedorId===fornecedorHistoricoAtualId;return <button key={r.fornecedorId} onClick={()=>setFornecedorHistoricoId(r.fornecedorId)} style={{width:"100%",textAlign:"left",background:ativo?`${C.yellow}0D`:C.card,border:`1px solid ${ativo?C.yellow:C.border}`,borderLeft:`3px solid ${ativo?C.yellow:C.line}`,borderRadius:10,padding:"10px 11px",cursor:"pointer",boxShadow:ativo?`0 8px 22px ${C.yellow}12`:"none"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}><div style={{minWidth:0}}><p className="brk" style={{fontSize:11.5,fontWeight:850,color:C.text}}>{r.fornecedor?.nome||"Fornecedor não cadastrado"}</p><p style={{fontSize:9,color:C.muted,marginTop:3}}>{r.pedidos} pedido(s) · {r.obras.size} obra(s) · {r.materiais.size} insumo(s)</p></div><span style={{fontSize:8.5,fontWeight:850,color:idx<3?C.yellowD:C.muted}}>#{idx+1}</span></div><div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:8,paddingTop:7,borderTop:`1px solid ${C.line}`}}><span style={{fontSize:9,color:C.muted}}>Recebido</span><b style={{fontSize:10.5,color:C.text}}>{fmt(r.recebido)}</b></div></button>})}
          </div>
          {resumoFornecedorAtual&&<div style={{display:"flex",flexDirection:"column",gap:10,minWidth:0}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 14px"}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}><div><p style={{fontSize:8.5,fontWeight:850,letterSpacing:1,textTransform:"uppercase",color:C.yellowD}}>Fornecedor selecionado</p><h3 style={{fontSize:15,fontWeight:850,color:C.text,marginTop:3}}>{resumoFornecedorAtual.fornecedor?.nome||"Fornecedor não cadastrado"}</h3><p style={{fontSize:9.5,color:C.muted,marginTop:3}}>{[resumoFornecedorAtual.fornecedor?.cnpj,resumoFornecedorAtual.fornecedor?.telefone,resumoFornecedorAtual.fornecedor?.cidade].filter(Boolean).join(" · ")||"Dados cadastrais não informados"}</p></div><Badge color={C.blue}>Última compra {fmtDate(resumoFornecedorAtual.ultima)}</Badge></div><div style={{display:"grid",gridTemplateColumns:cols(2,2,4),gap:7,marginTop:12}}>{[["Total pedido",fmt(resumoFornecedorAtual.comprado),C.text],["Total recebido",fmt(resumoFornecedorAtual.recebido),C.green],["Pedidos",resumoFornecedorAtual.pedidos,C.blue],["Insumos",resumoFornecedorAtual.materiais.size,C.yellowD]].map(([l,v,c])=><div key={l} style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:8,padding:"8px 9px"}}><p style={{fontSize:8,color:C.muted,textTransform:"uppercase",fontWeight:800}}>{l}</p><p style={{fontSize:12.5,fontWeight:850,color:c,marginTop:3}}>{v}</p></div>)}</div></div>
            {comprasMensaisFornecedor.length>0&&<ChartPanel eyebrow="Evolução das compras" title="Volume mensal com o fornecedor" subtitle="Pedido emitido versus material efetivamente recebido" height={205} legend={[{label:"Pedido",color:C.yellow},{label:"Recebido",color:C.green}]}><ResponsiveContainer width="100%" height="100%"><BarChart data={comprasMensaisFornecedor} barGap={3} barSize={13}><CartesianGrid stroke={C.line} vertical={false}/><XAxis dataKey="rotulo" tick={{fill:C.muted,fontSize:8.5}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:8.5}} axisLine={false} tickLine={false} tickFormatter={compactNumber}/><Tooltip cursor={{fill:`${C.yellow}08`}} content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/><Bar dataKey="comprado" name="Pedido" fill={C.yellow} radius={[4,4,1,1]}/><Bar dataKey="recebido" name="Recebido" fill={C.green} radius={[4,4,1,1]}/></BarChart></ResponsiveContainer></ChartPanel>}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}><div style={{padding:"11px 13px",borderBottom:`1px solid ${C.line}`}}><p style={{fontSize:11.5,fontWeight:850,color:C.text}}>Pedidos do fornecedor</p><p style={{fontSize:9,color:C.muted,marginTop:2}}>Clique em Pedidos para editar ou receber uma compra.</p></div><div style={{maxHeight:310,overflowY:"auto"}}>{pedidosFornecedorAtual.map(p=><div key={p.id} style={{display:"grid",gridTemplateColumns:pick("1fr auto","1fr auto","100px minmax(120px,1fr) 120px 100px"),gap:8,alignItems:"center",padding:"9px 12px",borderTop:`1px solid ${C.line}`}}><div><p style={{fontSize:10.5,fontWeight:850,color:C.blue}}>{p.numero}</p><p style={{fontSize:8.5,color:C.muted,marginTop:2}}>{fmtDate(p.data)}</p></div>{pick(null,null,<div><p className="brk" style={{fontSize:9.5,fontWeight:750,color:C.text}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"}</p><p style={{fontSize:8.5,color:C.muted,marginTop:2}}>{(p.itens||[]).length} item(ns)</p></div>)}{pick(null,null,<div><p style={{fontSize:8,color:C.muted,textTransform:"uppercase"}}>Recebido</p><p style={{fontSize:10,fontWeight:800,color:C.green,marginTop:2}}>{fmt(recebidoPedido(p))}</p></div>)}<div style={{textAlign:"right"}}><p style={{fontSize:10.5,fontWeight:850,color:C.text}}>{fmt(totalPedido(p))}</p><Badge color={statusPedido(p)==="recebido"?C.green:statusPedido(p)==="parcial"?C.orange:C.blue}>{statusPedido(p)}</Badge></div></div>)}</div></div>
          </div>}
        </div>}
      </>)}

      {/*  EVOLUÇÃO DOS PREÇOS DOS INSUMOS  */}
      {aba === "precos" && (<>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px"}}><p style={{fontSize:11,color:C.muted,lineHeight:1.55}}>A curva considera somente material <strong style={{color:C.text}}>efetivamente recebido</strong>. Assim, uma cotação ou pedido ainda não entregue não distorce o preço histórico. A média é ponderada pela quantidade comprada.</p></div>
        <div style={{display:"grid",gridTemplateColumns:pick("1fr","1fr 1fr","minmax(280px,1.4fr) minmax(190px,.9fr) 180px 210px"),gap:8,alignItems:"end"}}>
          <Sel label="Insumo" value={materialHistoricoAtualId} onChange={v=>{setMaterialHistoricoId(v);setFornecedorPrecoId("");}} options={materiaisHistorico.map(x=>({v:x.material.id,l:`${x.material.codigo?`${x.material.codigo} · `:""}${x.material.descricao}`}))}/>
          <Sel label="Fornecedor" value={fornecedorPrecoAtualId} onChange={setFornecedorPrecoId} options={[{v:"",l:"Todos os fornecedores"},...fornecedoresDoMaterial.map(f=>({v:f.id,l:f.nome}))]}/>
          <Sel label="Período" value={periodoHistorico} onChange={setPeriodoHistorico} options={[["6","Últimos 6 meses"],["12","Últimos 12 meses"],["24","Últimos 24 meses"],["todos","Todo o histórico"]].map(([v,l])=>({v,l}))}/>
          {!obraIdFixo&&<div><p style={{fontSize:9,fontWeight:750,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Abrangência</p><div style={{display:"flex",padding:3,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8}}>{[["obra","Obra atual"],["todas","Todas visíveis"]].map(([v,l])=><button key={v} onClick={()=>setEscopoHistorico(v)} style={{flex:1,border:0,borderRadius:6,padding:"7px 8px",background:escopoHistorico===v?C.text:"transparent",color:escopoHistorico===v?"#fff":C.muted,fontSize:9.5,fontWeight:800,cursor:"pointer"}}>{l}</button>)}</div></div>}
        </div>
        {!materialHistoricoAtual||!analiseMaterialAtual?<div style={{padding:28,textAlign:"center",background:C.card,border:`1px dashed ${C.border}`,borderRadius:12}}><Ic n="chart" s={22} color={C.muted}/><p style={{fontSize:12,fontWeight:800,color:C.text,marginTop:8}}>Ainda não há preços recebidos neste recorte</p><p style={{fontSize:10,color:C.muted,marginTop:3}}>Registre o recebimento de um pedido ou amplie o período analisado.</p></div>:<>
          {(()=>{const primeiro=evolucaoMaterial[0];const ultimo=evolucaoMaterial[evolucaoMaterial.length-1];const variacao=primeiro?.preco?((Number(ultimo?.preco||0)-Number(primeiro.preco))/Number(primeiro.preco))*100:0;const corVar=variacao>0?C.red:variacao<0?C.green:C.muted;return <div style={{display:"grid",gridTemplateColumns:cols(2,3,5),gap:8}}>{[["Preço atual",fmt(ultimo?.preco||0),corVar],["Menor preço",fmt(analiseMaterialAtual.menor),C.green],["Média ponderada",fmt(analiseMaterialAtual.medio),C.blue],["Variação no período",`${variacao>0?"+":""}${variacao.toFixed(1)}%`,corVar],["Compras recebidas",analiseMaterialAtual.compras,C.text]].map(([l,v,c])=><div key={l} style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${c}`,borderRadius:10,padding:"10px 11px"}}><p style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",fontWeight:800}}>{l}</p><p style={{fontSize:13,fontWeight:850,color:c,marginTop:4}}>{v}</p></div>)}</div>})()}
          <ChartPanel eyebrow="Inteligência de suprimentos" title={materialHistoricoAtual.material.descricao} subtitle={`Preço por ${materialHistoricoAtual.material.unidade||"UN"} · ${evolucaoMaterial.length} recebimento(s) no período`} height={275} legend={[{label:"Preço recebido",color:C.yellow},{label:"Média ponderada",color:C.blue}]}><ResponsiveContainer width="100%" height="100%"><LineChart data={dadosGraficoPreco} margin={{left:4,right:14,top:8,bottom:2}}><CartesianGrid stroke={C.line} vertical={false}/><XAxis dataKey="rotulo" tick={{fill:C.muted,fontSize:8.5}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:8.5}} axisLine={false} tickLine={false} tickFormatter={compactNumber}/><Tooltip content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/><Line type="monotone" dataKey="media" name="Média ponderada" stroke={C.blue} strokeDasharray="5 5" strokeWidth={1.5} dot={false}/><Line type="monotone" dataKey="preco" name="Preço recebido" stroke={C.yellow} strokeWidth={2.5} activeDot={{r:5,fill:C.text,stroke:C.yellow,strokeWidth:2}} dot={{r:3,fill:C.yellow,stroke:C.card,strokeWidth:1.5}}/></LineChart></ResponsiveContainer></ChartPanel>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}><div style={{padding:"11px 13px",borderBottom:`1px solid ${C.line}`,display:"flex",justifyContent:"space-between",gap:8}}><div><p style={{fontSize:11.5,fontWeight:850,color:C.text}}>Memória dos recebimentos</p><p style={{fontSize:9,color:C.muted,marginTop:2}}>Rastreabilidade até o pedido, fornecedor e obra.</p></div><Badge color={C.yellowD}>{materialHistoricoAtual.material.unidade||"UN"}</Badge></div><div style={{maxHeight:330,overflowY:"auto"}}>{[...dadosGraficoPreco].reverse().map(x=><div key={x.id} style={{display:"grid",gridTemplateColumns:pick("1fr auto","90px 1fr auto","90px minmax(150px,1.2fr) minmax(120px,1fr) 90px 105px"),gap:8,alignItems:"center",padding:"9px 12px",borderTop:`1px solid ${C.line}`}}><div><p style={{fontSize:9.5,fontWeight:800,color:C.text}}>{fmtDate(x.data)}</p><p style={{fontSize:8.5,color:C.blue,marginTop:2}}>{x.pedido}</p></div>{pick(null,<div><p className="brk" style={{fontSize:9.5,fontWeight:750,color:C.text}}>{x.fornecedor}</p><p style={{fontSize:8.5,color:C.muted,marginTop:2}}>{x.obra}</p></div>,<><div><p className="brk" style={{fontSize:9.5,fontWeight:750,color:C.text}}>{x.fornecedor}</p></div><div><p className="brk" style={{fontSize:9.5,color:C.muted}}>{x.obra}</p></div><div style={{textAlign:"right"}}><p style={{fontSize:8,color:C.muted,textTransform:"uppercase"}}>Quantidade</p><p style={{fontSize:9.5,fontWeight:800,color:C.text}}>{x.qtd}</p></div></>)}<div style={{textAlign:"right"}}><p style={{fontSize:8,color:C.muted,textTransform:"uppercase"}}>Unitário</p><p style={{fontSize:10.5,fontWeight:850,color:C.yellowD}}>{fmt(x.preco)}</p></div></div>)}</div></div>
        </>}
      </>)}

      {/*  MODAIS  */}
      {modoIA&&<ModoIADocumento modulo="compras" data={data} update={update} showToast={showToast} currentUser={currentUser} obraIdInicial={obraAtual} onClose={()=>setModoIA(false)}/>}
      {cotWpp&&<ModalCotacaoWhatsApp titulo={cotWpp.titulo} itens={cotWpp.itens} obraNome={cotWpp.obraNome} prazo={cotWpp.prazo}
        fornecedores={fornecedores} pedidos={data.pedidos} materiais={data.materiais} data={data} onClose={()=>setCotWpp(null)}
        onContato={(fornecedorId,fornecedorNome)=>registrarContatoSolicitacao(cotWpp.solicitacaoId,fornecedorId,fornecedorNome)}/>}
      {solModal&&<ModalSolicitacaoCompra form={solModal} setForm={setSolModal} onSave={salvarSolicitacao} basesReferencia={basesCompra} obras={obras.filter(o=>!currentUser?.obraId||o.id===currentUser.obraId)} data={data} update={update} showToast={showToast}/>}
      {fornModal && <FornecedorEditorPilot form={fornModal} setForm={setFornModal} onSave={salvarForn}/>}
      {pedModal  && <ModalPedido     form={pedModal}  setForm={setPedModal}  onSave={salvarPedido}
                                     fornecedores={fornecedores} materiais={materiais}
                                     linhasOrc={linhasOrc} data={data} basesReferencia={basesCompra}/>}
      {cotModal  && <ModalCotacao    form={cotModal}  setForm={setCotModal}  onSave={salvarCotacao}
                                     fornecedores={fornecedores} materiais={materiais} linhasOrc={linhasOrc}/>}
      <ModalLegendaDocumento anexo={anexoCotacao} setAnexo={setAnexoCotacao} onClose={()=>!subindoAnexoCotacao&&setAnexoCotacao(null)} onSalvar={salvarDocumentoCotacao} salvando={subindoAnexoCotacao} titulo="Anexar documento da cotação" C={C}/>
      {cotDecisao&&(()=>{const cot=(data.cotacoes||[]).find(c=>c.id===cotDecisao.cotacaoId);const prop=cot?.propostas?.find(p=>p.id===cotDecisao.propostaId);if(!cot||!prop)return null;const menor=Math.min(...cot.propostas.map(p=>Number(p.precoUnit||0)).filter(v=>v>0));const fora=Number(prop.precoUnit)>menor+0.000001;return <Modal title="Decisão da cotação" onClose={()=>setCotDecisao(null)}><div style={{display:"flex",flexDirection:"column",gap:11}}><div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 12px"}}><p style={{fontSize:12,fontWeight:850,color:C.text}}>{nomeMat(cot.materialId)}</p><p style={{fontSize:10,color:C.muted,marginTop:3}}>{nomeForn(prop.fornecedorId)} · {fmt(prop.precoUnit*cot.qtd)} · prazo {prop.prazoDias||0} dia(s)</p></div>{fora&&<div style={{background:`${C.orange}0C`,border:`1px solid ${C.orange}`,borderRadius:6,padding:"8px 10px"}}><p style={{fontSize:10.5,color:C.orange,fontWeight:850}}>Esta não é a proposta de menor preço.</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Registre o motivo: prazo, qualidade, disponibilidade, condição de pagamento ou especificação.</p></div>}<Inp label={fora?"Justificativa obrigatória *":"Observação da decisão"} value={cotDecisao.justificativa} onChange={v=>setCotDecisao(d=>({...d,justificativa:v}))} multiline placeholder="Critério usado para escolher o fornecedor..."/><div style={{display:"flex",gap:8}}><Btn v="ghost" full onClick={()=>setCotDecisao(null)}>Cancelar</Btn><Btn full onClick={()=>gerarPedidoDaCotacao(cot,prop.id,cotDecisao.justificativa)} disabled={fora&&!cotDecisao.justificativa.trim()}>Aprovar e gerar pedido</Btn></div></div></Modal>;})()}
      {recModal  && <ModalRecebimento pedido={recModal} onClose={()=>setRecModal(null)}
                                      onReceber={receber} nomeMat={nomeMat} unidMat={unidMat}
                                      nomeForn={nomeForn}/>}
      {pagModal&&<Modal title={`Pagamento · ${pagModal.pedido.numero}`} onClose={()=>setPagModal(null)}><div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px"}}><div><p style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Total do pedido</p><p style={{fontSize:13,fontWeight:850,color:C.text}}>{fmt(totalPedido(pagModal.pedido))}</p></div><div><p style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Saldo antes deste pagamento</p><p style={{fontSize:13,fontWeight:850,color:C.red}}>{fmt(saldoPagamentoPedido(pagModal.pedido))}</p></div></div>
        <Sel label="Origem real do pagamento *" value={pagModal.origem} onChange={v=>setPagModal(f=>({...f,origem:v,transacaoId:v==="empresa"?f.transacaoId:""}))} options={[{v:"empresa",l:"Conta bancária da empresa"},{v:"caixa_obra",l:"Caixa da obra"},{v:"cliente_direto",l:"Cliente pagou diretamente"}]}/>
        {pagModal.origem==="caixa_obra"&&(()=>{const cx=situacaoCaixaObra(data,pagModal.pedido.obraId),valor=Number(String(pagModal.valor||"").replace(",","."))||0,projetado=cx.saldo-valor,negativo=projetado<-.001,baixo=!negativo&&projetado<=cx.limiteBaixo;return <div style={{background:negativo?`${C.red}0C`:baixo?`${C.orange}0C`:`${C.green}0C`,border:`1px solid ${negativo?C.red:baixo?C.orange:C.green}`,borderRadius:9,padding:"9px 10px"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>{[["Saldo disponível",cx.saldo,cx.saldo>0?C.green:C.red],["Após pagamento",projetado,negativo?C.red:baixo?C.orange:C.green],["Reserva mínima",cx.limiteBaixo,C.muted]].map(([l,v,c])=><div key={l}><p style={{fontSize:8,color:C.muted,textTransform:"uppercase",fontWeight:800}}>{l}</p><p style={{fontSize:11.5,fontWeight:850,color:c,marginTop:2}}>{fmt(v)}</p></div>)}</div>{!((data.obras||[]).find(o=>o.id===pagModal.pedido.obraId)?.hasCaixa)&&<p style={{fontSize:9.5,color:C.red,fontWeight:800,marginTop:7}}>Caixa não ativado no cadastro desta obra.</p>}{negativo&&<p style={{fontSize:9.5,color:C.red,fontWeight:800,marginTop:7}}>Pagamento bloqueado: registre um aporte antes de continuar.</p>}{baixo&&<p style={{fontSize:9.5,color:C.orange,fontWeight:800,marginTop:7}}>Alerta de caixa baixo: o pagamento é possível, mas deixará a reserva abaixo do nível recomendado.</p>}</div>;})()}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Inp label="Valor pago *" type="number" value={pagModal.valor} onChange={v=>setPagModal(f=>({...f,valor:v}))}/><Inp label="Data *" type="date" value={pagModal.data} onChange={v=>setPagModal(f=>({...f,data:v}))}/></div>
        {pagModal.origem==="empresa"&&<Sel label="Vincular à transação bancária (opcional)" value={pagModal.transacaoId} onChange={v=>setPagModal(f=>({...f,transacaoId:v,conciliado:!!v}))} options={[{v:"",l:"Sem transação vinculada"},...(data.transacoes||[]).filter(t=>Number(t.valor)<0).slice().sort((a,b)=>(b.data||"").localeCompare(a.data||"")).slice(0,80).map(t=>({v:t.id,l:`${fmtDate(t.data)} · ${fmt(Math.abs(Number(t.valor||0)))} · ${t.descricao||"Saída bancária"}`}))]}/>}
        <Inp label="Comprovante / referência" value={pagModal.referencia} onChange={v=>setPagModal(f=>({...f,referencia:v}))} placeholder="PIX, boleto, recibo ou identificação do cliente"/>
        <label style={{padding:"11px 12px",border:`1.5px dashed ${pagModal.comprovanteFile?C.green:C.blue}66`,borderRadius:9,textAlign:"center",cursor:"pointer",background:pagModal.comprovanteFile?`${C.green}08`:C.surface}}><p style={{fontSize:10.5,fontWeight:850,color:pagModal.comprovanteFile?C.green:C.blue}}>{pagModal.comprovanteFile?pagModal.comprovanteFile.name:"Anexar comprovante de pagamento"}</p><p style={{fontSize:8.5,color:C.muted,marginTop:2}}>PDF, JPG, PNG ou WEBP · salvo no OneDrive da obra</p><input type="file" accept=".pdf,image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>5.5*1024*1024){showToast("O comprovante deve ter no máximo 5,5 MB.","error");return;}setPagModal(f=>({...f,comprovanteFile:file,comprovanteLegenda:String(file.name||"").replace(/\.[^.]+$/,"")}));}}/></label>
        {pagModal.comprovanteFile&&<Inp label="Legenda do comprovante" value={pagModal.comprovanteLegenda} onChange={v=>setPagModal(f=>({...f,comprovanteLegenda:v}))} placeholder="Ex.: PIX pago ao fornecedor"/>}
        <label style={{display:"flex",gap:8,alignItems:"center",fontSize:10,color:C.text,cursor:"pointer"}}><input type="checkbox" checked={!!pagModal.conciliado} onChange={e=>setPagModal(f=>({...f,conciliado:e.target.checked}))}/><span>Pagamento/comprovante já conferido e conciliado</span></label>
        <Inp label="Observação" value={pagModal.observacao} onChange={v=>setPagModal(f=>({...f,observacao:v}))} multiline/>
        <div style={{display:"flex",gap:8}}><Btn v="ghost" full onClick={()=>setPagModal(null)} disabled={subindoComprovantePagamento}>Cancelar</Btn><Btn full onClick={registrarPagamento} disabled={subindoComprovantePagamento}><Ic n="check"/> {subindoComprovantePagamento?"Salvando comprovante...":"Registrar pagamento"}</Btn></div>
      </div></Modal>}
      {excluirCompraModal&&<Modal title={`Excluir compra · ${excluirCompraModal.pedido.numero}`} onClose={()=>setExcluirCompraModal(null)}><div style={{display:"flex",flexDirection:"column",gap:11}}>
        <div style={{padding:"11px 12px",border:`1px solid ${C.red}`,borderRadius:8,background:`${C.red}09`}}>
          <p style={{fontSize:12,fontWeight:850,color:C.red}}>Esta exclusão remove a compra dos controles operacionais.</p>
          <p style={{fontSize:9.5,color:C.muted,lineHeight:1.5,marginTop:4}}>Entradas no estoque e pagamentos criados diretamente pelo pedido serão retirados. Notas fiscais permanecem no Financeiro, são desvinculadas e recebem um alerta. A ação ficará registrada na auditoria.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6}}>
          {[
            ["Total da compra",fmt(totalPedido(excluirCompraModal.pedido))],
            ["Valor pago",fmt(totalPagoPedido(excluirCompraModal.pedido))],
            ["Entradas no estoque",excluirCompraModal.movimentos.length],
            ["Saídas no caixa",excluirCompraModal.caixas.length],
            ["Notas desvinculadas",excluirCompraModal.notas.length],
            ["Recebimentos",(excluirCompraModal.pedido.itens||[]).reduce((s,i)=>s+(i.recebimentos||[]).length,0)],
          ].map(([label,valor])=><div key={label} style={{padding:"8px 9px",border:`1px solid ${C.border}`,borderRadius:6,background:C.surface}}><p style={{fontSize:8,color:C.muted,textTransform:"uppercase",fontWeight:800}}>{label}</p><b style={{display:"block",fontSize:11.5,color:C.text,marginTop:3}}>{valor}</b></div>)}
        </div>
        <Inp label="Motivo da exclusão *" value={excluirCompraModal.motivo} onChange={v=>setExcluirCompraModal(f=>({...f,motivo:v}))} multiline placeholder="Ex.: compra duplicada, obra incorreta ou pedido criado por engano"/>
        <Inp label={`Digite ${excluirCompraModal.pedido.numero} para confirmar *`} value={excluirCompraModal.confirmacao} onChange={v=>setExcluirCompraModal(f=>({...f,confirmacao:v}))}/>
        <div style={{display:"flex",gap:8}}><Btn v="ghost" full disabled={cancelandoCompra} onClick={()=>setExcluirCompraModal(null)}>Manter compra</Btn><Btn v="danger" full disabled={cancelandoCompra} onClick={excluirCompraDefinitivamente}><Ic n="trash"/> {cancelandoCompra?"Cancelando...":"Excluir compra"}</Btn></div>
      </div></Modal>}
    </div>
  );
}
