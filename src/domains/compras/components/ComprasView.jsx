import {FilePicker} from '../../../design-system/patterns/FilePicker.jsx';
import MessageRequestImport,{MessageRequestSource} from './MessageRequestImport.jsx';
import {RecordAction} from '../../../design-system/primitives/RecordAction.jsx';
import {Button as StandardButton} from '../../../components/ui/button.jsx';
import {ChoiceControl} from '../../../design-system/primitives/ChoiceControl.jsx';
import {Input as StandardInput} from '../../../components/ui/input.jsx';
import {useUnsavedChanges} from "../../../features/workflow/useUnsavedChanges.js";
import {WorkflowWarnings} from './ProcurementProcessStatus.jsx';
import {planningPurchaseNeeds,planningRequestDraft} from "../../planejamento/purchase-needs.js";
import {useHelpTopic} from '../../../features/help/HelpContext.jsx';
import {PURCHASE_HELP} from '../../../features/help/help-content.js';
import {useWorkspaceState,useWorkspaceScroll} from "../../../features/workflow/workspace-session.jsx";
import SupplierResponseQueue from "./SupplierResponseQueue";
import {OrderTermsFields} from "./OrderConditions";
import {ORDER_TERM_FIELDS} from "../order-terms";
import QuoteComparisonWorkspace from "./QuoteComparisonWorkspace";
import PurchaseRecordFlow from "./PurchaseRecordFlow";
import {quantityLabel} from '../record-flow';
import MaterialPriceHistory from "./MaterialPriceHistory";
import { CommercialTerms, CostComparison } from "./PurchaseFinalCost";
import { PurchaseDossier } from "./PurchaseDossier";
import { marcellReportHtml } from "../../../reports/marcell-report.js";
import { DreIntegration, useRememberWorkflowScope, useWorkflow } from "../../../features/workflow/WorkflowNavigation.jsx";
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

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lazyWithCssRetry as lazy } from "../../../lib/lazy-with-css-retry.js";
import { ArrowLeft } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "../../../components/charts/LazyRecharts";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { ArcdChartTooltip, Badge, Btn, ChartPanel, Ic, Inp, Modal, Sel, TabRow } from "../../../legacy/ui.jsx";
import { C, C_ARCD_SETOR } from "../../../legacy/palette.js";
import { FornecedorEditorPilot, ModalCotacaoWhatsApp, fornecedoresParaMateriais, guardaPreco, linkWhatsApp, melhorPrecoHist, mensagemWhatsAppCobranca, mensagemWhatsAppCompra, oportunidadesConsolidacao, pedidosEmAtraso, slaSolicitacao, UNIDADES_PADRAO, CATS_MATERIAL } from "../LegacySupport.jsx";
import { LinksDocumentosAuditaveis, ModalLegendaDocumento, ModoIADocumento } from "../../../features/financeiro/LegacyDocumentTools.jsx";
import { arquivoComoDataUrl } from "../../../legacy/files.js";
import { calcOrcadoComprado, niveisUmOrcamento } from "../budget-tracking";
import { compactNumber, fmt, fmtCompact, fmtDate, maiusculoOrcamento, proximoCodigoArcd, rotuloRamo, today, uid } from "../../../legacy/format.js";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { SAVE_QUEUE_STATE } from "../../sync/save-queue";
import { getPlanningBudget } from "../../orcamentos/calculations";
import { consolidateReferenceBases as consolidarBasesReferencia } from "../../orcamentos/reference-bases";
import {
  STATUS_PEDIDO, statusPedido, totalPedido, recebidoPedido, pendentePedido,
  totalPagoPedido, saldoPagamentoPedido, statusPagamentoPedido,
  origemPagamentoLabel, situacaoCaixaObra,
  historicoPrecoTodos, mapaGerencialCompras,
} from "../calculations";
import { canManagePurchases } from "../permissions";
import { buildPurchaseWorkspace, matchesPurchaseSearch } from "../workspace";
import { usePurchaseSave } from "../use-purchase-save";
import { PurchaseNavigation, PurchaseWorkspace, PURCHASE_AREA_LABELS } from "./PurchaseWorkspace";
import { PurchasesByWork, motivoSemControle } from "./PurchasesByWork";
import { buildPurchasesByWork } from "../by-work";
import { painelAdocaoCompras } from "../adoption";
import { AdoptionPanel } from "./AdoptionPanel";
import {
  nomeArquivoCompras, planilhaFila, planilhaItensDosPedidos, planilhaNotas, planilhaOrcadoComprado, planilhaOrcadoPorObra, planilhaPedidos,
} from "../export-sheets";
import { Button } from "../../../design-system/primitives/Button";
import { Select } from "../../../design-system/primitives/Select";
import { PageHeader } from "../../../design-system/patterns/PageHeader.jsx";
import { WorkspaceFilters } from "../../../design-system/patterns/WorkspaceNavigation.jsx";
import { conferenciaPagamentoPedido } from "../payment-conference";
import { movementOfOrder } from "../purchase-cancellation-command";
import { alertasOrcamentoDoPedido, segmentosBarraOrcamento } from "../budget-tracking";
import { contratosDisponiveis, saldoItemContrato } from "../supply-contracts";
import PurchaseContractsWorkspace from "./PurchaseContractsWorkspace";
import { atrasoDoItem } from "../delivery-schedule";
import { linhaAtrasada, mensagemCobrancaFornecedor } from "../queue-groups";
import {
  acoesDoPedido, contarPedidosPorStatus, FILTROS_PEDIDOS_VAZIOS, filtrarPedidos, filtrosPedidosAtivos, OPCOES_STATUS_PEDIDO,
} from "../order-list";
import { OrderActionMenu } from "./OrderActionMenu";
import { ModalRecebimento } from "./ReceiptModal";
import { montarRecebimento } from "../receipt";
import { avaliacoesFornecedores, textoNotaFornecedor } from "../supplier-rating";
import {
  avaliarEscolhasCotacao, cotacaoMultiItens, decisoesDaCotacao, escolhaPrecisaJustificativa,
  itensDaCotacao, itensPendentesDaCotacao, mapaDaCotacao, precoDaProposta, sugestaoDeEscolhas,
} from "../quote-map";
import {
  assuntoEmailPedido, documentoPedidoHtml, linkEmailPedido, mensagemPedidoFornecedor,
} from "../order-dispatch";
import { active } from "../../financeiro/ledger";
import {
  changePurchaseRequestProject,
  purchaseRequestSummary,
  validatePurchaseRequest,
} from "../purchase-request-workflow";
import {
  hasValidUnitConversion, purchaseUnitOf,
  referencePricePerPurchaseUnit, referenceQuantityOf, referenceTotalOf,
  suggestedSteelConversion,
} from "../unit-conversion";
import {
  enviarArquivoOneDrive, gerarLinkAceitePedido, listarBasesReferencia, pesquisarInsumosReferencia,
} from "../../../api";

const OperationalPilot = lazy(()=>import("../../../features/pilot/OperationalPilot.jsx"));

function PurchaseSaveNotice({save}){
  const [started,setStarted]=useState(save?.state==="saving");
  useEffect(()=>{if(save?.state==="saving")setStarted(true);},[save?.state]);
  return started&&save&&save.state!=="idle"?<p className="purchase-form-status purchase-save-state" data-state={save.state} role="status" aria-live="polite">{save.message}</p>:null;
}

function ModalSolicitacaoCompra({form,setForm,onSave,basesReferencia=[],obras=[],data,update,showToast,save}){
  const {formGrid}=useBreakpoint();
  const [busca,setBusca]=useState("");const [resultados,setResultados]=useState([]);
  const [loading,setLoading]=useState(false);const [aviso,setAviso]=useState("");
  const [novoInsumo,setNovoInsumo]=useState(null);
  const [buscaCatalogo,setBuscaCatalogo]=useState("");
  const catalogo=useMemo(()=>buscaCatalogo.trim()?(data?.materiais||[]).filter(m=>m.ativo!==false&&matchesPurchaseSearch(buscaCatalogo,m.codigo,m.descricao,m.unidade)):[],[data?.materiais,buscaCatalogo]);
  const adicionarCatalogo=material=>{
    setForm(f=>({...f,itens:[...f.itens,{id:uid(),materialId:material.id,referenciaId:material.referenciaId||"",fonteRef:material.fonteRef||"PRÓPRIO",
      codigoRef:material.codigo||"",descricaoRef:material.descricao,unidadeRef:String(material.unidade||"UN").toUpperCase(),unidadeCompra:String(material.unidade||"UN").toUpperCase(),
      fatorConversao:1,quantidade:"",precoRef:Number(material.precoMedio||0),dataBaseRef:material.dataBaseRef||"",ufRef:material.ufRef||"",orcItemId:"",orcNivel1Id:"",observacao:""}]}));
    setBuscaCatalogo("");
  };
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
  useUnsavedChanges(form,()=>setForm(null),{busy:salvando});
  const fechar=()=>{
    if(salvando)return;
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
    if(salvando)return;
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
  return <Modal title={form.id?`Editar solicitação ${form.numero||""}`:"Solicitar materiais para Compras"} onClose={fechar} wide panelClass="purchase-request-modal"><div className="purchase-request-flow"><fieldset className="purchase-request-fields" disabled={salvando}>
    {form.planningOrigin&&<section className="purchase-request-origin" aria-label="Origem no planejamento"><strong>Planejamento · {form.planningOrigin.taskName}</strong><p>Obra e data vieram do cronograma. Confirme as quantidades abaixo após conferir o estoque e os pedidos existentes; a referência corresponde à etapa inteira.</p>{form.planningOrigin.excludedCount>0&&<p>{form.planningOrigin.excludedCount} linha(s) sem vínculo ou unidade confirmados não foram incluídas. Revise no orçamento.</p>}</section>}
    <MessageRequestImport form={form} setForm={setForm} obras={obras} materiais={data?.materiais||[]} disabled={salvando}/>
    <section className="purchase-request-section"><header><span>1</span><div><h3>Contexto da solicitação</h3><p>Defina onde e quando os materiais precisam chegar.</p></div></header>
    <div className="purchase-request-context" style={{gridTemplateColumns:formGrid(3)}}>
      <div><Sel label="Obra *" value={form.obraId} onChange={trocarObra} options={obras.map(o=>({v:o.id,l:o.name}))}/>{erros.fieldErrors?.obraId&&<small className="purchase-request-error" role="alert">{erros.fieldErrors.obraId}</small>}</div>
      <Inp label="Data necessária na obra *" type="date" value={form.necessidade} onChange={F("necessidade")} error={erros.fieldErrors?.necessidade}/>
      <Sel label="Prioridade" value={form.prioridade} onChange={F("prioridade")} options={[{v:"normal",l:"Normal"},{v:"urgente",l:"Urgente"}]}/>
    </div></section>
    <section className="purchase-request-section"><header><span>2</span><div><h3>Materiais</h3><p>Pesquise uma base oficial ou cadastre o insumo no catálogo.</p></div></header>
    <div className="purchase-request-search">
      <h4>Reutilizar material do catálogo</h4>
      <Inp label="Pesquisar no catálogo" value={buscaCatalogo} onChange={setBuscaCatalogo} placeholder="Ex.: cimento CP II…"/>
      {buscaCatalogo.trim()&&<div className="purchase-catalog-results">
        {catalogo.slice(0,12).map(material=><RecordAction type="button" className="purchase-request-result" key={material.id} onClick={()=>adicionarCatalogo(material)}>
          <b>{material.codigo||"PRÓPRIO"}</b><span>{material.descricao}</span><strong>Adicionar · {material.unidade||"UN"}</strong></RecordAction>)}
        {!catalogo.length&&<p className="purchase-request-hint">Nenhum material encontrado. Pesquise uma base oficial ou cadastre o material abaixo.</p>}
        {catalogo.length>12&&<p className="purchase-request-hint">Mostrando 12 de {catalogo.length}. Acrescente uma palavra para refinar.</p>}
      </div>}
    </div>
    <details className="purchase-reference-search"><summary>Pesquisar insumo SINAPI / ORSE</summary><div className="purchase-request-search">
      <h4>Selecionar uma base oficial</h4>
      <Sel label="Base de referência" value={form.referenciaId||""} onChange={v=>{F("referenciaId")(v);setBusca("");setResultados([]);}}
        options={[{v:"",l:basesReferencia.length?"Selecione a base":"Nenhuma base de referência disponível"},...basesReferencia.map(b=>({v:b.id,l:`${b.fonte} · ${b.dataBase}${b.uf?` · ${b.uf}`:""}${b.fonte==="SINAPI"?` · ${b.desonerado===false?"NÃO DESONERADA":"DESONERADA"}`:""}`}))]}/>
      <Inp label="Código ou descrição" value={busca} onChange={setBusca} placeholder="Ex.: cimento, bloco, aço..."/>
      {form.referenciaId&&busca.trim().length===1&&<p className="purchase-request-hint">Digite pelo menos 2 caracteres para pesquisar.</p>}
      {form.referenciaId&&(loading||aviso||resultados.length>0||busca.trim().length>=2)&&<div style={{maxHeight:220,overflowY:"auto",background:"var(--arcd-surface-page)",border:"1px solid var(--arcd-border-default)",borderRadius:7,padding:"var(--arcd-space-1)"}}>
        {loading&&<p className="purchase-request-hint" role="status">Pesquisando na base selecionada...</p>}{aviso&&<div className="purchase-request-search-error" role="alert"><span>{aviso}</span><Btn size="sm" v="ghost" onClick={()=>setTentativaBusca(n=>n+1)}>Tentar novamente</Btn></div>}
        {resultados.map((item,index)=><RecordAction className="purchase-request-result" key={`${item.fonte}-${item.codigo}-${index}`} onClick={()=>addReferencia(item)} title={item.descricao}><b>{item.fonte} {item.codigo}</b><span>{item.descricao}</span><strong>{fmt(precoRef(item))}/{item.unidade}</strong></RecordAction>)}
        {!loading&&!resultados.length&&!aviso&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-2)"}}>Nenhum insumo encontrado.</p>}
      </div>}
    </div>
    </details>
    <div className="purchase-request-material-head"><h4>Materiais da solicitação</h4><div><Btn size="sm" v="ghost" onClick={addProprio}><Ic n="plus"/> Adicionar somente a esta solicitação</Btn>{data&&<Btn size="sm" v="warning" onClick={abrirNovoInsumo}><Ic n="plus"/> Cadastrar no catálogo e adicionar</Btn>}</div></div>
    {novoInsumo&&<div style={{background:"color-mix(in srgb, var(--arcd-warning-text) 4%, transparent)",border:"1px solid color-mix(in srgb, var(--arcd-warning-text) 33%, transparent)",borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-3)",display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
      <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-warning-text)"}}>NOVO INSUMO NO CATÁLOGO</p>
      <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:"var(--arcd-space-2)"}}>
        <Inp label="Descrição *" value={novoInsumo.descricao} onChange={v=>setNovoInsumo(f=>({...f,descricao:v}))} placeholder="Ex.: Cimento CP-II 50kg"/>
        <Sel label="Unidade *" value={novoInsumo.unidade} onChange={v=>setNovoInsumo(f=>({...f,unidade:v}))} options={UNIDADES_PADRAO.map(u=>({v:u.sigla,l:`${u.sigla} - ${u.nome}`}))}/>
        <Sel label="Categoria" value={novoInsumo.categoria} onChange={v=>setNovoInsumo(f=>({...f,categoria:v}))} options={CATS_MATERIAL}/>
      </div>
      <Inp label="Preço médio (R$)" type="number" value={novoInsumo.precoMedio} onChange={v=>setNovoInsumo(f=>({...f,precoMedio:v}))} placeholder="0,00"/>
      <div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn size="sm" v="ghost" onClick={()=>setNovoInsumo(null)} full>Cancelar</Btn><Btn size="sm" onClick={salvarNovoInsumo} full><Ic n="check"/> Adicionar à solicitação</Btn></div>
    </div>}
    {removido&&<div className="purchase-request-undo" role="status"><span>Material removido da solicitação.</span><StandardButton variant="secondary" type="button" onClick={desfazerRemocao}>Desfazer</StandardButton></div>}
    <div className="purchase-request-items">{form.itens.map((item,itemIndex)=>{const itemErrors=erros.items?.find(e=>e.id===item.id)?.errors||{};return <article key={item.id} data-request-item={item.id} className="purchase-request-item">
      {item.planningQuantity!=null&&<p className="purchase-request-planning-quantity">Referência da etapa: {Number(item.planningQuantity).toLocaleString("pt-BR")} {item.unidadeRef}. Confirme a quantidade a comprar.</p>}
      <div className="purchase-request-item-main">
        <div><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)",marginBottom:"var(--arcd-space-half)"}}>FONTE</p><b style={{fontSize:"var(--arcd-type-label)",color:item.fonteRef==="ORSE"?"var(--arcd-action-primary)":item.fonteRef==="PRÓPRIO"?"var(--arcd-warning-text)":"var(--arcd-action-primary)"}}>{item.fonteRef}</b></div>
        <Inp label="Código" value={item.codigoRef} onChange={v=>setItem(item.id,"codigoRef",v)} placeholder="Opcional"/>
        <Inp label="Descrição *" value={item.descricaoRef} onChange={v=>setItem(item.id,"descricaoRef",v)} error={itemErrors.descricaoRef}/>
        <Inp label="Unidade *" value={item.unidadeRef} onChange={v=>setItem(item.id,"unidadeRef",v)} error={itemErrors.unidadeRef}/>
        <Inp label="Quantidade de compra *" type="number" min="0.0001" value={item.quantidade} onChange={v=>setItem(item.id,"quantidade",v)} error={itemErrors.quantidade}/>
        <Btn v="ghost" size="sm" iconOnly title="Duplicar para lançar em outra etapa" ariaLabel="Duplicar item" onClick={()=>duplicarItem(item.id)}><Ic n="copy" s={12}/></Btn>
        <StandardButton variant="secondary" type="button" className="purchase-request-remove" aria-label={`Remover ${item.descricaoRef||`material ${itemIndex+1}`}`} onClick={()=>removerItem(item.id)}><Ic n="trash" s={14}/><span>Remover</span></StandardButton>
      </div>
      {(()=>{const unidadeCompra=purchaseUnitOf(item),unidadeRef=String(item.unidadeRef||"UN").toUpperCase();
        const conversaoAtiva=unidadeCompra!==unidadeRef;
        const conversaoAco=suggestedSteelConversion(item,unidadeCompra,item.comprimentoBarra||12);
        const quantidadeReferencia=referenceQuantityOf(item);
        const precoCompraRef=referencePricePerPurchaseUnit(item);
        return <div style={{display:"grid",gridTemplateColumns:formGrid(conversaoAtiva?3:2),gap:"var(--arcd-space-2)",marginTop:"var(--arcd-space-2)",padding:"var(--arcd-space-2) var(--arcd-space-2)",background:"var(--arcd-surface-page)",border:"1px solid var(--arcd-border-default)",borderRadius:6}}>
          <Sel label="Unidade de compra" value={unidadeCompra} onChange={v=>setUnidadeCompra(item.id,v)}
            options={UNIDADES_PADRAO.map(u=>({v:u.sigla.toUpperCase(),l:`${u.sigla.toUpperCase()} · ${u.nome}`}))}/>
          {conversaoAco?.purchaseUnit==="BR"&&<Inp label="Comprimento da barra (m) *" type="number" value={item.comprimentoBarra||12} onChange={v=>setComprimentoBarra(item.id,v)} placeholder="12"/>}
          {conversaoAtiva&&<Inp label={`Conteúdo de 1 ${unidadeCompra} em ${unidadeRef} *`} type="number" min="0.0001" value={item.fatorConversao||""} onChange={v=>setItem(item.id,"fatorConversao",v)} placeholder="Ex.: 20" error={itemErrors.fatorConversao}/>}
          <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:"var(--arcd-space-half)"}}>
            <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>Equivalência da solicitação</p>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:hasValidUnitConversion(item)?"var(--arcd-text-primary)":"var(--arcd-danger-text)",marginTop:"var(--arcd-space-half)"}}>
              {hasValidUnitConversion(item)
                ? `${Number(item.quantidade||0).toLocaleString("pt-BR")} ${unidadeCompra} = ${quantidadeReferencia.toLocaleString("pt-BR",{maximumFractionDigits:4})} ${unidadeRef}`
                : `Informe quanto contém cada ${unidadeCompra}`}
            </p>
            {conversaoAtiva&&precoCompraRef>0&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Referência convertida: {fmt(precoCompraRef)}/{unidadeCompra}</p>}
          </div>
          {conversaoAco&&<p style={{gridColumn:"1/-1",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-action-primary)",lineHeight:"var(--arcd-line-height-normal)"}}>
            Conversão automática do aço{conversaoAco.diameterMm?` Ø ${conversaoAco.diameterMm.toLocaleString("pt-BR")} mm`:""}: {conversaoAco.kgPerMeter.toLocaleString("pt-BR",{maximumFractionDigits:4})} kg/m{conversaoAco.purchaseUnit==="BR"?` · barra de ${conversaoAco.barLength.toLocaleString("pt-BR")} m`:""}. O fator pode ser ajustado conforme o certificado do fabricante.
          </p>}
        </div>;})()}
      <div style={{marginTop:"var(--arcd-space-2)"}}><Sel label="Etapa principal do orçamento" value={item.orcNivel1Id||""} onChange={v=>setItem(item.id,"orcNivel1Id",v)} options={[{v:"",l:orcObra?"Selecione a etapa principal":"A obra ainda não possui orçamento"},...linhasOrc]}/></div>
      {contextoOrcamento.source==="rascunho"&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-warning-text)",marginTop:"var(--arcd-space-1)"}}>Vinculação ao orçamento em rascunho. A etapa organiza a compra, sem tornar esta versão uma baseline financeira.</p>}
      {item.precoRef>0&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>Referência {item.dataBaseRef}{item.ufRef?` · ${item.ufRef}`:""}: <b style={{color:"var(--arcd-text-primary)"}}>{fmt(Number(item.precoRef))}/{item.unidadeRef}</b></p>}
    </article>})}{!form.itens.length&&<div className="purchase-request-empty"><strong>Nenhum material adicionado</strong><p>Pesquise uma base oficial ou use uma das opções de cadastro acima.</p></div>}</div>
    <p className="purchase-request-hint">Para usar o mesmo insumo em etapas diferentes, duplique o material e ajuste quantidade e etapa.</p></section>
    <section className="purchase-request-section"><header><span>3</span><div><h3>Revisar e formalizar</h3><p>Confira o conteúdo que será enviado oficialmente ao setor de Compras.</p></div></header>
    <Inp label={form.prioridade==="urgente"?"Justificativa da urgência *":"Observação geral"} value={form.observacao} onChange={F("observacao")} multiline error={erros.fieldErrors?.observacao} placeholder="Local de entrega, especificação e impacto do prazo..."/>
    <div className="purchase-request-summary"><div><span>Obra</span><strong>{obras.find(o=>o.id===form.obraId)?.name||"Não selecionada"}</strong></div><div><span>Materiais</span><strong>{resumo.itemCount}</strong></div><div><span>Quantidades por unidade</span><strong>{Object.entries(form.itens.reduce((groups,item)=>{const unit=purchaseUnitOf(item);groups[unit]=(groups[unit]||0)+Number(item.quantidade||0);return groups;},{})).map(([unit,quantity])=>`${quantity.toLocaleString("pt-BR")} ${unit}`).join(" · ")||"—"}</strong></div><div><span>Prioridade</span><strong>{resumo.urgent?"Urgente":"Normal"}</strong></div></div>
    {erros.fieldErrors?.itens&&<p className="purchase-request-error" role="alert">{erros.fieldErrors.itens}</p>}
    <p className="purchase-request-formal-notice"><Ic n="lock" s={14}/> Ao confirmar, a solicitação será formalizada e registrada com autor, data e horário.</p>
    <div className="purchase-request-actions"><Btn v="ghost" onClick={fechar} disabled={salvando} full>Cancelar</Btn><Btn onClick={enviar} loading={salvando&&"Formalizando..."} full><Ic n="check"/> {form.id?"Salvar alterações":"Formalizar e enviar para Compras"}</Btn></div></section>
    </fieldset>
    {confirmarSaida&&<Modal title="Descartar alterações?" onClose={()=>setConfirmarSaida(false)}><p style={{fontSize:"var(--arcd-type-body)",lineHeight:"var(--arcd-line-height-normal)",color:"var(--arcd-text-primary)"}}>As alterações desta solicitação ainda não foram formalizadas.</p><div style={{display:"flex",gap:"var(--arcd-space-2)",marginTop:"var(--arcd-space-4)"}}><Btn v="ghost" onClick={()=>setConfirmarSaida(false)} full>Continuar editando</Btn><Btn v="danger" onClick={()=>setForm(null)} full>Descartar alterações</Btn></div></Modal>}
    <PurchaseSaveNotice save={save}/>
  </div></Modal>;
}

// C3.2: pedido do formulário no formato do domínio, para simular o impacto
// no orçamento antes de salvar.
const pedidoDoFormulario=f=>({...f,id:f.id||"__pedido_em_edicao",itens:(f.itens||[]).filter(i=>i.materialId&&Number(i.qtd)>0)
  .map(i=>({...i,qtd:Number(i.qtd),precoUnit:Number(i.precoUnit||0)}))});

function ModalPedido({ form, setForm, onSave, fornecedores, materiais, linhasOrc, data, basesReferencia=[],save }) {
  const { formGrid } = useBreakpoint();
  const [salvando,setSalvando]=useState(false);
  const [confirmarSaida,setConfirmarSaida]=useState(false);
  const inicial=useRef(JSON.stringify(form));
  useUnsavedChanges(form,()=>setForm(null),{busy:salvando});
  const fechar=()=>{if(salvando)return;if(inicial.current!==JSON.stringify(form)){setConfirmarSaida(true);return;}setForm(null);};
  const enviar=async()=>{if(salvando)return;setSalvando(true);try{await onSave(form);}finally{setSalvando(false);}};
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
    <Modal title={form.id ? `Pedido ${form.numero}` : "Novo pedido"} onClose={fechar} wide panelClass="purchase-form-panel">
      <fieldset disabled={salvando} style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
        <p className="purchase-form-context"><b>Obra da compra:</b> {(data?.obras||[]).find(o=>o.id===form.obraId)?.name||"Obra não informada"}</p>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-3)"}}>
          <Sel label="Fornecedor *" value={form.fornecedorId} onChange={F("fornecedorId")}
               options={[{v:"",l:"Selecione..."}, ...fornecedores.map(f=>({v:f.id,l:f.nome}))]}/>
          <Inp label="Data" type="date" value={form.data} onChange={F("data")}/>
          <Inp label="Previsão de entrega" type="date" value={form.previsao} onChange={F("previsao")}/>
          <Sel label="Situação" value={form.status} onChange={F("status")}
               options={[{v:"enviado",l:"Enviado ao fornecedor"},{v:"rascunho",l:"Rascunho"}]}/>
          <Sel label="Origem prevista do pagamento *" value={form.origemPagamento||"empresa"} onChange={F("origemPagamento")}
               options={[{v:"empresa",l:"Conta da empresa"},{v:"caixa_obra",l:"Caixa da obra"},{v:"cliente_direto",l:"Cliente paga diretamente"}]}/>
        </div>

        <OrderTermsFields value={form} onChange={(key,value)=>F(key)(value)}/>
        <div style={{background:form.origemPagamento==="cliente_direto"?"color-mix(in srgb, var(--arcd-action-primary) 5%, transparent)":"color-mix(in srgb, var(--arcd-success-text) 5%, transparent)",border:`1px solid ${form.origemPagamento==="cliente_direto"?"var(--arcd-action-primary)":"var(--arcd-success-text)"}55`,borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}>
          <p style={{fontSize:"var(--arcd-type-label)",color:form.origemPagamento==="cliente_direto"?"var(--arcd-action-primary)":"var(--arcd-success-text)",fontWeight:"var(--arcd-font-weight-semibold)"}}>
            {form.origemPagamento==="cliente_direto"
              ? "PAGAMENTO DIRETO DO CLIENTE — a compra será controlada e recebida normalmente, mas não será considerada saída do caixa da empresa."
              : form.origemPagamento==="caixa_obra"?"CAIXA DA OBRA — a entrega só será liberada após o financeiro registrar o pagamento e o comprovante.":"CONTA DA EMPRESA — a entrega só será liberada após o financeiro registrar o pagamento; a conciliação bancária fica rastreada."}
          </p>
        </div>

        {/* Sugestao de fornecedores para os materiais deste pedido */}
        {sugFornecedores.length > 0 && !form.fornecedorId && (
          <div style={{background:"color-mix(in srgb, var(--arcd-action-primary) 4%, transparent)",border:"1px solid color-mix(in srgb, var(--arcd-action-primary) 27%, transparent)",
                       borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",marginBottom:"var(--arcd-space-1)"}}>
              Fornecedores que servem estes materiais:
            </p>
            <div style={{display:"flex",flexWrap:"wrap",gap:"var(--arcd-space-1)"}}>
              {sugFornecedores.map(s => (
                <StandardButton variant="secondary" key={s.forn.id} onClick={()=>F("fornecedorId")(s.forn.id)} style={{textAlign:"left"}}>
                  {s.forn.nome}
                  <span style={{display:"block",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-medium)"}}>
                    {s.motivos[0]}
                  </span>
                </StandardButton>
              ))}
            </div>
          </div>
        )}

        <div style={{background:"color-mix(in srgb, var(--arcd-action-primary) 3%, transparent)",border:"1px solid color-mix(in srgb, var(--arcd-action-primary) 25%, transparent)",borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)",display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
          <div><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)"}}>SELECIONAR INSUMO SINAPI / ORSE</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Escolha a competência usada na comparação e pesquise por código ou descrição. Você pode trocar a base e incluir itens de fontes diferentes no mesmo pedido.</p></div>
          <Sel label="Base de referência para a pesquisa" value={form.referenciaId||""} onChange={v=>{F("referenciaId")(v);setBuscaRef("");setResultadosRef([]);}}
            options={[{v:"",l:basesReferencia.length?"Selecione a fonte, competência e UF":"Nenhuma base pronta no Supabase"},...basesReferencia.map(base=>({v:base.id,l:`${base.fonte} · ${base.dataBase}${base.uf?` · ${base.uf}`:""}${base.fonte==="SINAPI"?` · ${base.desonerado===false?"NÃO DESONERADA":"DESONERADA"}`:""}`}))]}/>
          <Inp label="Pesquisar insumo" value={buscaRef} onChange={setBuscaRef} placeholder="Ex.: cimento, areia, aço ou código..."/>
          {(buscandoRef||avisoRef||resultadosRef.length>0||buscaRef.trim().length>=2)&&<div style={{maxHeight:235,overflowY:"auto",background:"var(--arcd-surface-page)",border:"1px solid var(--arcd-border-default)",borderRadius:7,padding:"var(--arcd-space-1)"}}>
            {buscandoRef&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-action-primary)",padding:"var(--arcd-space-2)"}}>PESQUISANDO NA BASE...</p>}
            {avisoRef&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-warning-text)",padding:"var(--arcd-space-2)"}}>{avisoRef}</p>}
            {resultadosRef.map((item,index)=>{const preco=precoReferenciaResultado(item);return <RecordAction key={`${item.fonte}-${item.codigo}-${index}`} onClick={()=>selecionarReferencia(item)} style={{display:"grid",gridTemplateColumns:"105px minmax(0,1fr) 105px",gap:"var(--arcd-space-2)",alignItems:"center",width:"100%",border:0,borderTop:index?"1px solid var(--arcd-border-default)":"none",background:"transparent",padding:"var(--arcd-space-2) var(--arcd-space-2)",cursor:"pointer",textAlign:"left"}}>
              <b style={{fontSize:"var(--arcd-type-caption)",color:item.fonte==="ORSE"?"var(--arcd-action-primary)":"var(--arcd-action-primary)"}}>{item.fonte} {item.codigo}</b>
              <span title={item.descricao} style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descricao}</span>
              <span style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-action-primary)",textAlign:"right",fontWeight:"var(--arcd-font-weight-semibold)"}}>{fmt(preco)}/{item.unidade}</span>
            </RecordAction>;})}
            {!buscandoRef&&!resultadosRef.length&&!avisoRef&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-2)"}}>Nenhum insumo encontrado nesta base.</p>}
          </div>}
        </div>

        {/* C2.4: contratos vigentes do fornecedor - o item entra com o preço acordado */}
        {data&&form.fornecedorId&&(()=>{const contratos=contratosDisponiveis(data,{fornecedorId:form.fornecedorId,obraId:form.obraId,dataPedido:form.data});
          if(!contratos.length)return null;
          const nomeInsumo=id=>materiais.find(m=>m.id===id)?.descricao||"Insumo";
          return <div style={{background:"color-mix(in srgb, var(--arcd-success-text) 3%, transparent)",border:"1px solid color-mix(in srgb, var(--arcd-success-text) 33%, transparent)",borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-success-text)"}}>Contrato de fornecimento vigente · dispensa cotação</p>
            {contratos.flatMap(c=>(c.itens||[]).map(ci=>{const saldo=saldoItemContrato(data,c,ci.id,{excetoPedidoId:form.id});const usado=(form.itens||[]).some(x=>x.contratoId===c.id&&x.contratoItemId===ci.id);
              return <div key={`${c.id}-${ci.id}`} style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"center",marginTop:"var(--arcd-space-1)",flexWrap:"wrap"}}>
                <span style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)",minWidth:0}} className="brk">{c.numero} · {nomeInsumo(ci.materialId)} · {fmt(ci.precoUnit)}/{purchaseUnitOf(ci)} · saldo {saldo.toLocaleString("pt-BR")} {purchaseUnitOf(ci)}</span>
                <Btn size="sm" v="ghost" disabled={usado||saldo<=0} onClick={()=>setForm(f=>({...f,itens:[...(f.itens||[]).filter(x=>x.materialId||x.qtd),{id:uid(),materialId:ci.materialId,qtd:"",precoUnit:String(ci.precoUnit),qtdRecebida:0,orcItemId:"",orcNivel1Id:"",referenciaId:"",fonteRef:"",codigoRef:"",descricaoRef:"",unidadeRef:ci.unidadeRef||"",unidadeCompra:purchaseUnitOf(ci),fatorConversao:Number(ci.fatorConversao||1),precoRef:0,dataBaseRef:"",ufRef:"",contratoId:c.id,contratoItemId:ci.id}]}))}>{usado?"No pedido":"Usar"}</Btn>
              </div>;}))}
          </div>;})()}

        {(form.itens||[]).map((it, i) => (
          <div key={i} style={{background:"var(--arcd-surface-muted)",border:`1px solid ${it.contratoId?"color-mix(in srgb, var(--arcd-success-text) 53%, transparent)":"var(--arcd-border-default)"}`,
                               borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
            {it.contratoId&&(()=>{const c=(data?.contratosFornecimento||[]).find(x=>x.id===it.contratoId);return <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-success-text)",marginBottom:"var(--arcd-space-1)"}}>Pelo contrato {c?.numero||""} · preço acordado{data&&c?` · saldo ${saldoItemContrato(data,c,it.contratoItemId,{excetoPedidoId:form.id}).toLocaleString("pt-BR")} ${purchaseUnitOf(it)}`:""} <StandardButton variant="secondary" type="button" onClick={()=>setForm(f=>({...f,itens:f.itens.map((x,k)=>k===i?{...x,contratoId:"",contratoItemId:""}:x)}))} style={{}}>Desvincular do contrato</StandardButton></p>;})()}
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-2)"}}>
              <Sel label="Material" value={it.materialId} onChange={v=>setForm(f=>({...f,itens:f.itens.map((x,k)=>k===i?{...x,materialId:v,referenciaId:"",fonteRef:"",codigoRef:"",descricaoRef:"",unidadeRef:"",unidadeCompra:"",fatorConversao:1,precoRef:0,dataBaseRef:"",ufRef:""}:x)}))}
                   options={[{v:"",l:"Selecione..."},...(it.codigoRef&&!materiais.some(m=>m.id===it.materialId)?[{v:it.materialId,l:`${it.descricaoRef} (${it.unidadeRef})`}]:[]), ...materiais.map(m=>({v:m.id,l:`${m.descricao} (${m.unidade})`}))]}/>
              <Inp label={`Quantidade (${purchaseUnitOf(it)})`} type="number" value={it.qtd} onChange={v=>setItem(i,"qtd",v)}
                   placeholder="0"/>
              <div>
                <Inp label={it.contratoId?"Preço acordado (R$)":"Preço unitário (R$)"} type="number" value={it.precoUnit}
                     disabled={!!it.contratoId} onChange={v=>setItem(i,"precoUnit",v)} placeholder="0,00"/>
                {(() => {
                  // Guarda de preço: avisa NA HORA da digitação, antes de o
                  // dinheiro sair. Sem preço digitado, mostra a referência.
                  const h = it.materialId ? (historicoPorMaterial.get(it.materialId) || []) : null;
                  const g = data && it.materialId ? guardaPreco(h, it.precoUnit, fornecedores, referencePricePerPurchaseUnit(it)) : null;
                  if (g && g.nivel) {
                    const cor = g.nivel==="alto" ? C.red : g.nivel==="medio" ? C.orange : C.green;
                    return (
                      <div style={{marginTop:"var(--arcd-space-half)",background:`${cor}0F`,border:`1px solid ${cor}`,borderRadius:5,padding:"var(--arcd-space-1) var(--arcd-space-2)"}}>
                        {g.avisos.map((a,ai)=>(
                          <p key={ai} style={{fontSize:"var(--arcd-type-caption)",color:cor,fontWeight:"var(--arcd-font-weight-semibold)",lineHeight:"var(--arcd-line-height-normal)"}}>
                            {a.nivel==="bom" ? "" : "! "}{a.texto}
                          </p>
                        ))}
                        {g.compras>1&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-0)"}}>{g.compras} compra(s) deste material no histórico</p>}
                      </div>
                    );
                  }
                  const mp = it.materialId && data ? melhorPrecoHist(h, fornecedores) : null;
                  return mp ? (
                    <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-success-text)",marginTop:"var(--arcd-space-half)"}}>
                      melhor ja pago: {fmt(mp.preco)}{mp.fornecedor ? ` (${mp.fornecedor})` : ""}
                    </p>
                  ) : null;
                })()}
              </div>
              <div style={{display:"flex",alignItems:"flex-end"}}>
                <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",paddingBottom:"var(--arcd-space-2)"}}>
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

              {/* C2.2: entrega do item - data própria ou remessas programadas */}
              <div style={{gridColumn:"1/-1",borderTop:"1px dashed var(--arcd-border-default)",paddingTop:"var(--arcd-space-2)"}}>
                {!(it.remessas||[]).length ? (
                  <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:"var(--arcd-space-2)",alignItems:"end"}}>
                    <Inp label="Entrega deste item" type="date" value={it.previsao||""} onChange={v=>setItem(i,"previsao",v)}/>
                    <Btn size="sm" v="ghost" onClick={()=>setItem(i,"remessas",[{id:uid(),data:it.previsao||form.previsao||"",qtd:String(it.qtd||"")}])}>Programar remessas</Btn>
                    {!it.previsao&&<p style={{gridColumn:"1/-1",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>Sem data própria, vale a previsão do pedido.</p>}
                  </div>
                ) : (
                  <div>
                    <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>Remessas programadas</p>
                    {(it.remessas||[]).map((r,ri)=>(
                      <div key={r.id||ri} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr) auto",gap:"var(--arcd-space-2)",alignItems:"end",marginTop:"var(--arcd-space-1)"}}>
                        <Inp label={`Data ${ri+1}`} type="date" value={r.data||""} onChange={v=>setItem(i,"remessas",it.remessas.map((x,k)=>k===ri?{...x,data:v}:x))}/>
                        <Inp label={`Qtd. (${purchaseUnitOf(it)})`} type="number" value={r.qtd} onChange={v=>setItem(i,"remessas",it.remessas.map((x,k)=>k===ri?{...x,qtd:v}:x))}/>
                        <StandardButton variant="secondary" type="button" onClick={()=>setItem(i,"remessas",it.remessas.filter((_,k)=>k!==ri))} style={{}}>Remover item</StandardButton>
                      </div>
                    ))}
                    {(()=>{const soma=(it.remessas||[]).reduce((t,r)=>t+Number(r.qtd||0),0),total=Number(it.qtd||0);return <p style={{fontSize:"var(--arcd-type-caption)",marginTop:"var(--arcd-space-1)",color:soma>total+1e-6?"var(--arcd-danger-text)":"var(--arcd-text-secondary)"}}>{soma.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} {purchaseUnitOf(it)} programados{soma>total+1e-6?" · passa da quantidade do item":soma<total-1e-6?" · o restante segue a data do item ou do pedido":""}</p>;})()}
                    <Btn size="sm" v="ghost" onClick={()=>setItem(i,"remessas",[...(it.remessas||[]),{id:uid(),data:"",qtd:""}])}><Ic n="plus"/> Remessa</Btn>
                  </div>
                )}
              </div>
            </div>
            {it.codigoRef&&<div style={{marginTop:"var(--arcd-space-2)",background:"var(--arcd-surface-page)",border:"1px solid var(--arcd-border-default)",borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}>
              <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:it.fonteRef==="ORSE"?"var(--arcd-action-primary)":"var(--arcd-action-primary)"}}>{it.fonteRef} {it.codigoRef} · {it.descricaoRef} · {it.unidadeRef}</p>
              <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Referência {it.dataBaseRef}{it.ufRef?` · ${it.ufRef}`:""}: <b style={{color:"var(--arcd-text-primary)"}}>{fmt(referencePricePerPurchaseUnit(it))}/{purchaseUnitOf(it)}</b>{purchaseUnitOf(it)!==String(it.unidadeRef||"").toUpperCase()?` · 1 ${purchaseUnitOf(it)} = ${Number(it.fatorConversao||0).toLocaleString("pt-BR")} ${it.unidadeRef}`:""}</p>
              {Number(it.precoUnit)>0&&referencePricePerPurchaseUnit(it)>0&&(()=>{const ref=referencePricePerPurchaseUnit(it),dif=Number(it.precoUnit)-ref,pct=dif/ref*100,cor=dif<=0?C.green:C.red;return <p style={{fontSize:"var(--arcd-type-label)",color:cor,fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-half)"}}>{dif<=0?"ABAIXO DA REFERÊNCIA":"ACIMA DA REFERÊNCIA"}: {fmt(Math.abs(dif))} ({Math.abs(pct).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%)</p>;})()}
            </div>}
            {!it.orcNivel1Id && !it.orcItemId && linhasOrc.length > 0 && Number(it.qtd) > 0 && (
              <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-warning-text)",marginTop:"var(--arcd-space-1)"}}>
                Sem apropriação: esta compra não entra na comparação com o orçamento.
              </p>
            )}
            {Number(it.qtdRecebida) > 0 && (
              <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-success-text)",marginTop:"var(--arcd-space-1)",fontWeight:"var(--arcd-font-weight-semibold)"}}>
                ok {it.qtdRecebida} já recebido - não dá para reduzir abaixo disso
              </p>
            )}
            <div style={{display:"flex",gap:"var(--arcd-space-3)",marginTop:"var(--arcd-space-1)"}}>
              <StandardButton variant="secondary" onClick={()=>duplicarItem(i)} style={{}}>Duplicar para outra etapa</StandardButton>
              {form.itens.length > 1 && Number(it.qtdRecebida) === 0 && (
                <StandardButton variant="secondary" onClick={()=>delItem(i)} style={{}}>Remover item</StandardButton>
              )}
            </div>
          </div>
        ))}

        <Btn v="ghost" onClick={addItem} full><Ic n="plus"/> Adicionar item</Btn>

        <div style={{background:"var(--arcd-surface-muted)",border:"1.5px solid var(--arcd-action-primary)",borderRadius:6,
                     padding:"var(--arcd-space-2) var(--arcd-space-3)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"var(--arcd-space-2)"}}>
          <div><span style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)"}}>TOTAL DO PEDIDO</span><p style={{fontSize:"var(--arcd-type-card-title)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",fontFamily:"var(--arcd-font-sans)",marginTop:"var(--arcd-space-half)"}}>{fmt(total)}</p></div>
          <div><span style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)"}}>TOTAL NA REFERÊNCIA</span><p style={{fontSize:"var(--arcd-type-card-title)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",fontFamily:"var(--arcd-font-sans)",marginTop:"var(--arcd-space-half)"}}>{totalReferencia>0?fmt(totalReferencia):"-"}</p></div>
          {totalReferencia>0&&total>0&&(()=>{const dif=total-totalReferencia;const pct=dif/totalReferencia*100;const cor=dif<=0?C.green:C.red;return <div><span style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)"}}>COMPARAÇÃO</span><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:cor,marginTop:"var(--arcd-space-half)"}}>{dif<=0?"ABAIXO":"ACIMA"} {fmt(Math.abs(dif))} · {Math.abs(pct).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%</p></div>;})()}
        </div>

        {form.id&&<Inp label="Motivo do ajuste *" value={form.motivoAjuste||""} onChange={F("motivoAjuste")} multiline placeholder="Explique o que foi corrigido e por quê. Esta justificativa ficará no histórico do pedido."/>}
        {/* C3.2: o pedido leva alguma etapa a 90% ou além do orçado? */}
        {data&&(()=>{const alertas=alertasOrcamentoDoPedido(data,pedidoDoFormulario(form));if(!alertas.length)return null;
          return <div style={{background:`${alertas.some(a=>a.alerta==="estourou")?"var(--arcd-danger-text)":"var(--arcd-warning-text)"}0D`,border:`1.5px solid ${alertas.some(a=>a.alerta==="estourou")?"var(--arcd-danger-text)":"var(--arcd-warning-text)"}`,borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:alertas.some(a=>a.alerta==="estourou")?"var(--arcd-danger-text)":"var(--arcd-warning-text)"}}>{alertas.some(a=>a.alerta==="estourou")?"Este pedido estoura o orçamento":"Este pedido leva a etapa a 90% do orçamento"}</p>
            {alertas.map(a=><p key={a.etapaId} style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-half)"}}>{a.descricao}: {fmt(a.antes)} → <b>{fmt(a.depois)}</b> de {fmt(a.orcado)} orçado{a.orcado>0?` (${a.pct.toFixed(0)}%)`:""}</p>)}
          </div>;})()}
        <div style={{display:"flex",gap:"var(--arcd-space-2)"}}>
          <Btn v="ghost" onClick={fechar} disabled={salvando} full>Cancelar</Btn>
          <Btn onClick={enviar} disabled={salvando} loading={salvando&&"Salvando…"} full><Ic n="check"/> {form.status==="rascunho"?"Salvar rascunho":"Salvar pedido"}</Btn>
        </div>
      </fieldset>
      <PurchaseSaveNotice save={save}/>
      {confirmarSaida&&<Modal title="Descartar alterações do pedido?" onClose={()=>setConfirmarSaida(false)}><p>As alterações ainda não foram salvas.</p><div className="purchase-header-actions"><Button variant="secondary" onClick={()=>setConfirmarSaida(false)}>Continuar editando</Button><Button variant="danger" onClick={()=>setForm(null)}>Descartar alterações</Button></div></Modal>}
    </Modal>
  );
}

// Mapa de cotação (C1.3): itens nas linhas, fornecedores nas colunas. O
// menor preço de cada linha fica destacado; cada fornecedor aparece uma vez.
const propostaVaziaCotacao=()=>({id:uid(),fornecedorId:"",prazoDias:"",obs:"",documentos:[],precos:{},custoFinal:{frete:"",desconto:"",impostos:"",despesas:""}});
const itemVazioCotacao=()=>({id:uid(),materialId:"",qtd:"",unidadeRef:"UN",unidadeCompra:"UN",fatorConversao:1,precoRef:0,orcItemId:"",orcNivel1Id:""});
// Converte a cotação (antiga ou de vários itens) no formulário do mapa.
const formularioDaCotacao=cot=>{
  const itens=itensDaCotacao(cot);
  return {...cot,itens:itens.map(i=>({...i,qtd:String(i.qtd??"")})),
    propostas:(cot.propostas||[]).map(p=>({...p,documentos:p.documentos||[],
      precos:Object.fromEntries(itens.map(i=>[i.id,precoDaProposta(cot,p,i.id)||""]))}))};
};

function ModalCotacao({ form, setForm, onSave, fornecedores, materiais, linhasOrc=[],save,obraNome }) {
  const [salvando,setSalvando]=useState(false);
  const [confirmarSaida,setConfirmarSaida]=useState(false);
  const inicial=useRef(JSON.stringify(form));
  const fechar=()=>{if(salvando)return;if(inicial.current!==JSON.stringify(form)){setConfirmarSaida(true);return;}setForm(null);};
  const enviar=async()=>{if(salvando)return;setSalvando(true);try{await onSave(form);}finally{setSalvando(false);}};
  const decididos=new Set(Object.keys(decisoesDaCotacao(form)));
  const setItem=(i,patch)=>setForm(f=>({...f,itens:f.itens.map((x,k)=>k===i?{...x,...patch}:x)}));
  const setP=(i,campo,v)=>setForm(f=>({...f,propostas:f.propostas.map((x,k)=>k===i?{...x,[campo]:v}:x)}));
  const setPreco=(i,itemId,v)=>setForm(f=>({...f,propostas:f.propostas.map((x,k)=>k===i?{...x,precos:{...(x.precos||{}),[itemId]:v}}:x)}));
  const addP=()=>setForm(f=>({...f,propostas:[...f.propostas,propostaVaziaCotacao()]}));
  const delP=i=>setForm(f=>({...f,propostas:f.propostas.filter((_,k)=>k!==i)}));
  const addItem=()=>setForm(f=>({...f,itens:[...f.itens,itemVazioCotacao()]}));
  const delItem=i=>setForm(f=>({...f,itens:f.itens.filter((_,k)=>k!==i)}));
  const menorPorItem=Object.fromEntries((form.itens||[]).map(item=>{
    const precos=(form.propostas||[]).map(p=>Number(p.precos?.[item.id]||0)).filter(v=>v>0);
    return [item.id,precos.length?Math.min(...precos):0];
  }));
  const totalProposta=p=>(form.itens||[]).reduce((s,item)=>s+Number(p.precos?.[item.id]||0)*Number(item.qtd||0),0);
  const usados=new Set((form.propostas||[]).map(p=>p.fornecedorId).filter(Boolean));
  const cel={padding:"6px 7px",borderBottom:`1px solid ${C.line}`,verticalAlign:"top"};

  return (
    <Modal title={form.id?"Mapa de cotação":"Nova cotação"} onClose={fechar} wide panelClass="purchase-form-panel">
      <fieldset disabled={salvando} style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
        <p className="purchase-form-context"><b>Obra da cotação:</b> {obraNome||"Obra não informada"}</p>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:"var(--arcd-space-3)"}}>
          <Sel label="Etapa de 1º nível do orçamento" value={form.orcNivel1Id||""} onChange={v=>setForm(f=>({...f,orcNivel1Id:v,itens:f.itens.map(i=>({...i,orcNivel1Id:i.orcNivel1Id||v}))}))} options={[{v:"",l:linhasOrc.length?"Selecione a etapa principal":"Nenhuma etapa disponível"},...linhasOrc.map(l=>({v:l.id,l:`${l.descricao} · ${fmt(l.orcado)}`}))]}/>
        </div>
        <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Informe o preço unitário de cada fornecedor por item (mínimo 2 fornecedores). O menor preço de cada linha aparece em verde.</p>
        <div style={{overflowX:"auto",border:"1px solid var(--arcd-border-default)",borderRadius:7}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:260+180*(form.propostas||[]).length,fontSize:"var(--arcd-type-label)"}}>
            <thead><tr style={{background:"var(--arcd-surface-muted)"}}>
              <th style={{...cel,textAlign:"left",minWidth:230}}>Item</th>
              {(form.propostas||[]).map((p,i)=><th key={p.id} style={{...cel,minWidth:170,textAlign:"left"}}>
                <Sel label={`Fornecedor ${i+1}`} value={p.fornecedorId} onChange={v=>setP(i,"fornecedorId",v)}
                  options={[{v:"",l:"Selecione..."},...fornecedores.filter(f=>f.id===p.fornecedorId||!usados.has(f.id)).map(f=>({v:f.id,l:f.nome}))]}/>
                <Inp label="Prazo (dias)" type="number" value={p.prazoDias} onChange={v=>setP(i,"prazoDias",v)} placeholder="0"/>
                <CommercialTerms proposal={p} disabled={Object.values(decisoesDaCotacao(form)).some(d=>d.propostaId===p.id)} onChange={(field,value)=>setP(i,field,value)}/>
                {form.propostas.length>2&&!Object.values(decisoesDaCotacao(form)).some(d=>d.propostaId===p.id)&&<StandardButton variant="secondary" type="button" onClick={()=>delP(i)} style={{}}>remover fornecedor</StandardButton>}
              </th>)}
            </tr></thead>
            <tbody>
              {(form.itens||[]).map((item,r)=>{const travado=decididos.has(String(item.id));return <tr key={item.id}>
                <td style={cel}>
                  <Sel label={`Insumo ${r+1}${travado?" · já virou pedido":""}`} value={item.materialId} onChange={v=>{const m=materiais.find(x=>x.id===v);setItem(r,{materialId:v,unidadeRef:m?.unidade||"UN",unidadeCompra:m?.unidade||"UN",fatorConversao:1,precoRef:Number(m?.precoMedio||0)});}}
                    options={[{v:"",l:"Selecione..."},...materiais.map(m=>({v:m.id,l:`${m.descricao} (${m.unidade})`}))]}/>
                  <div style={{display:"flex",gap:"var(--arcd-space-1)",alignItems:"flex-end"}}>
                    <div style={{flex:1}}><Inp label={`Quantidade (${purchaseUnitOf(item)})`} type="number" value={item.qtd} onChange={v=>!travado&&setItem(r,{qtd:v})} placeholder="0"/></div>
                    {form.itens.length>1&&!travado&&<StandardButton variant="secondary" type="button" onClick={()=>delItem(r)} style={{}}>Remover item</StandardButton>}
                  </div>
                  {purchaseUnitOf(item)!==String(item.unidadeRef||"").toUpperCase()&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>1 {purchaseUnitOf(item)} = {Number(item.fatorConversao||0).toLocaleString("pt-BR")} {item.unidadeRef}</p>}
                </td>
                {(form.propostas||[]).map((p,i)=>{const v=Number(p.precos?.[item.id]||0),eh=v>0&&v===menorPorItem[item.id];return <td key={p.id} style={{...cel,background:eh?"color-mix(in srgb, var(--arcd-success-text) 6%, transparent)":"transparent"}}>
                  <Inp label="Preço unit. (R$)" type="number" value={p.precos?.[item.id]??""} onChange={val=>!travado&&setPreco(i,item.id,val)} placeholder="0,00"/>
                  {v>0&&Number(item.qtd)>0&&<p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:eh?"var(--arcd-success-text)":"var(--arcd-text-primary)"}}>{fmt(v*Number(item.qtd))}{eh?" · menor":""}</p>}
                </td>;})}
              </tr>;})}
            </tbody>
            <tfoot><tr style={{background:"var(--arcd-surface-muted)"}}>
              <td style={{...cel,fontWeight:"var(--arcd-font-weight-semibold)"}}>Total por fornecedor</td>
              {(form.propostas||[]).map(p=><td key={p.id} style={{...cel,fontWeight:"var(--arcd-font-weight-semibold)"}}>{fmt(totalProposta(p))}</td>)}
            </tr></tfoot>
          </table>
        </div>
        <CostComparison quote={form} supplierName={id=>fornecedores.find(f=>f.id===id)?.nome||"Fornecedor"}/>
        <div style={{display:"flex",gap:"var(--arcd-space-2)",flexWrap:"wrap"}}>
          <Btn v="ghost" onClick={addItem}><Ic n="plus"/> Item</Btn>
          <Btn v="ghost" onClick={addP}><Ic n="plus"/> Fornecedor</Btn>
        </div>
        <div style={{display:"flex",gap:"var(--arcd-space-2)"}}>
          <Btn v="ghost" onClick={fechar} disabled={salvando} full>Cancelar</Btn>
          <Btn onClick={enviar} disabled={salvando} loading={salvando&&"Salvando..."} full><Ic n="check"/> Salvar cotação</Btn>
        </div>
      </fieldset>
      <PurchaseSaveNotice save={save}/>
      {confirmarSaida&&<Modal title="Descartar alterações da cotação?" onClose={()=>setConfirmarSaida(false)}><p>As propostas ainda não foram salvas.</p><div className="purchase-header-actions"><Button variant="secondary" onClick={()=>setConfirmarSaida(false)}>Continuar editando</Button><Button variant="danger" onClick={()=>setForm(null)}>Descartar alterações</Button></div></Modal>}
    </Modal>
  );
}

// Recebimento - o único lugar onde Compras encosta no Estoque.
// Aceita entrega PARCIAL, porque na obra o caminhão chega faltando item.

export default function Compras({ data, update, showToast, currentUser, obraIdFixo="", C=C_ARCD_SETOR, dispatchCommand:rawDispatchCommand=null }) {
  const { cols, pick, isDesktop } = useBreakpoint();
  const [pilotOpen,setPilotOpen]=useState(false);
  const [pilotNotes,setPilotNotes]=useState({});
  const {scopes,intent,navigate}=useWorkflow();
  const useSessionState=(key,initial)=>useWorkspaceState("cmp",key,initial,obraIdFixo);
  const avisarPendencias=result=>{
    const warnings=result?.summary?.workflowWarnings||[];
    if(warnings.length)showToast(`Operação registrada com avisos: ${[...new Set(warnings.map(item=>item.message))].slice(0,2).join(" ")} Consulte a ficha completa da compra para acompanhar.`,"warn");
  };
  useWorkspaceScroll("cmp",obraIdFixo);
  const savedScope=scopes.cmp;
  const {save, dispatch:dispatchCommand} = usePurchaseSave(rawDispatchCommand);
  const [filtrosFluxo,setFiltrosFluxo] = useSessionState("filtrosFluxo",{query:"",stage:"",risk:""});
  const [registroFoco,setRegistroFoco] = useState("");
  const [retornosCompra,setRetornosCompra]=useSessionState("retornosCompra",[]);
  useEffect(()=>{
    if(!registroFoco)return;
    const frame=window.requestAnimationFrame(()=>{
      const target=document.getElementById(`purchase-record-${registroFoco}`);
      target?.scrollIntoView({block:"center",behavior:"auto"});target?.focus({preventScroll:true});
    });
    return()=>window.cancelAnimationFrame(frame);
  },[registroFoco,retornosCompra]);
  const [aba,     setAba]     = useSessionState("aba",["engenheiro","engenheiro_auditor"].includes(currentUser?.role)?"solicitacoes":currentUser?.role==="financeiro"?"financeiro":"fila");
  useHelpTopic('cmp',PURCHASE_HELP[aba]||'cmp');
  const [obraSel, setObraSel] = useSessionState("obraSel",obraIdFixo||currentUser?.obraId||savedScope?.obraId||"");
  const [busca,   setBusca]   = useSessionState("busca","");
  const [filtroPedidos,setFiltroPedidos]=useSessionState("filtroPedidos",FILTROS_PEDIDOS_VAZIOS);

  const [pedModal,  setPedModal]  = useState(null);
  const [recModal,  setRecModal]  = useState(null);   // recebimento
  const [cotModal,  setCotModal]  = useState(null);
  const [fichaCompra,setFichaCompra]=useSessionState("fichaCompra",null);
  const [cotDecisao,setCotDecisao]=useState(null);
  const [envioPedido,setEnvioPedido]=useState(null);
  const [aceitePedido,setAceitePedido]=useState(null);
  const [linkAceite,setLinkAceite]=useState(null);
  const [gerandoLinkAceite,setGerandoLinkAceite]=useState(false);
  const [fornModal, setFornModal] = useState(null);
  const [solModal,setSolModal]=useState(null);
  const [modoIA,setModoIA]=useState(false);
  const [basesReferenciaCompra,setBasesReferenciaCompra]=useState([]);
  const [escopoHistorico,setEscopoHistorico]=useSessionState("escopoHistorico","obra");
  const [periodoHistorico,setPeriodoHistorico]=useSessionState("periodoHistorico","12");
  const [buscaFornecedorHistorico,setBuscaFornecedorHistorico]=useSessionState("buscaFornecedorHistorico","");
  const [fornecedorHistoricoId,setFornecedorHistoricoId]=useSessionState("fornecedorHistoricoId","");
  const [buscaHistoricoCompra,setBuscaHistoricoCompra]=useSessionState("buscaHistoricoCompra","");
  const [statusHistoricoCompra,setStatusHistoricoCompra]=useSessionState("statusHistoricoCompra","todos");
  const [fornecedorHistoricoCompra,setFornecedorHistoricoCompra]=useSessionState("fornecedorHistoricoCompra","");
  const [anexoCotacao,setAnexoCotacao]=useState(null);
  const [subindoAnexoCotacao,setSubindoAnexoCotacao]=useState(false);
  const [pagModal,setPagModal]=useState(null);
  const [excluirCompraModal,setExcluirCompraModal]=useState(null);
  const [subindoComprovantePagamento,setSubindoComprovantePagamento]=useState(false);
  const [cancelandoCompra,setCancelandoCompra]=useState(false);
  const [filtroFinanceiro,setFiltroFinanceiro]=useSessionState("filtroFinanceiro","pendentes");
  const [buscaCotacao,setBuscaCotacao]=useSessionState("buscaCotacao","");
  const [statusCotacao,setStatusCotacao]=useSessionState("statusCotacao","todas");
  const [inicioCotacao,setInicioCotacao]=useSessionState("inicioCotacao","");
  const [fimCotacao,setFimCotacao]=useSessionState("fimCotacao","");
  const [cotacaoExpandida,setCotacaoExpandida]=useSessionState("cotacaoExpandida","");
  const [escopoMapa,setEscopoMapa]=useSessionState("escopoMapa",obraIdFixo||currentUser?.obraId||savedScope?.obraId?"obra":"empresa");
  const [filtroKanban,setFiltroKanban]=useSessionState("filtroKanban","ativos");

  const obras = useMemo(()=>(data.obras || []).filter(o=>!currentUser?.obraId||o.id===currentUser.obraId),[data.obras,currentUser?.obraId]);
  const obraAtual   = obraIdFixo || obraSel || obras[0]?.id || "";
  // Escopo de "todas as obras" (empresa) x obra única - fonte única para o
  // KPI, as listas e o kanban, para não mostrar números de recortes diferentes
  // na mesma tela.
  const obraIdsMapa=useMemo(()=>
    escopoMapa==="empresa"&&!obraIdFixo?obras.map(o=>o.id):[obraAtual],
    [escopoMapa,obraIdFixo,obras,obraAtual]);
  useEffect(()=>{
    if(obraIdFixo||intent?.tabId!=="cmp"||intent.action==="resume")return;
    const next=intent.scope?.obraId||currentUser?.obraId||"";
    if(next&&!obras.some(work=>work.id===next))return;
    setObraSel(next);setEscopoMapa(next?"obra":"empresa");
  },[intent?.sequence,obraIdFixo]);
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
  // Enviar o pedido e registrar o aceite: mesmos perfis do servidor (C2.5).
  const podeEnviarPedido=["admin","compras"].includes(currentUser?.role);
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

  const orcVs = useMemo(() => calcOrcadoComprado(data, obraAtual), [data.orcamentos, data.budgetBaselines, data.pedidos, data.materiais, obraAtual]);
  const pedidoPorIdOrc = useMemo(() => new Map((data.pedidos||[]).map(p=>[String(p.id),p])), [data.pedidos]);
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
      .filter(p => matchesPurchaseSearch(t,p.numero,nomeForn(p.fornecedorId),
        obras.find(o=>o.id===p.obraId)?.name,(p.itens||[]).map(i=>[nomeMat(i.materialId),i.descricaoRef,i.codigoRef])))
      .sort((a,b) => (b.data||"").localeCompare(a.data||""));
  }, [data.pedidos, obraIdsMapa, busca, nomeForn, nomeMat, obras]);
  // R4: filtros da aba Pedidos por cima da busca. As contagens e as opções de
  // fornecedor/obra saem do mesmo recorte (escopo + busca), para não oferecer
  // um filtro que dá lista vazia.
  const atrasadoIds = useMemo(() => new Set(atrasados.map(x => x.pedido.id)), [atrasados]);
  const pedidosVisiveis = useMemo(() => filtrarPedidos(pedidos, filtroPedidos, atrasadoIds), [pedidos, filtroPedidos, atrasadoIds]);
  const contagemPedidos = useMemo(() => contarPedidosPorStatus(pedidos), [pedidos]);
  const qtdAtrasadosNaLista = useMemo(() => pedidos.filter(p => atrasadoIds.has(p.id)).length, [pedidos, atrasadoIds]);
  const fornecedoresDosPedidos = useMemo(() =>
    [...new Set(pedidos.map(p => p.fornecedorId).filter(Boolean))].map(id => ({ value: id, label: nomeForn(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")), [pedidos, nomeForn]);
  const obrasDosPedidos = useMemo(() =>
    [...new Set(pedidos.map(p => p.obraId).filter(Boolean))].map(id => ({ value: id, label: obras.find(o => o.id === id)?.name || "Obra não informada" }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")), [pedidos, obras]);
  const patchFiltroPedidos = patch => setFiltroPedidos(atual => ({ ...atual, ...patch }));
  // Quem manda para a aba Pedidos já sabe qual pedido quer ver: filtro velho
  // não pode escondê-lo.
  const irParaPedidos = (termo = "") => { setBusca(termo); setFiltroPedidos(FILTROS_PEDIDOS_VAZIOS); setAba("pedidos"); };
  const [vistaPainel,setVistaPainel]=useState("resumo");
  // R5: a exceção do painel abre a lista já filtrada pelo que ela aponta.
  const abrirExcecao = alerta => {
    const filtro=alerta.filtro;
    if(filtro?.area==="pedidos"){
      setBusca("");
      setFiltroPedidos({...FILTROS_PEDIDOS_VAZIOS,...(filtro.pedidos||{}),origem:filtro.pedidos?.ids?alerta.titulo:""});
      setAba("pedidos");return;
    }
    if(filtro?.area==="financeiro"){setFiltroFinanceiro(filtro.financeiro||"todos");setAba("financeiro");return;}
    setAba(filtro?.area||alerta.destino);
  };

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
  // A0.1: só calcula quando a vista "Uso" está aberta.
  const adocao=useMemo(()=>vistaPainel==="uso"?painelAdocaoCompras(data,obraIdsMapa,today()):null,[
    vistaPainel,data.pedidos,data.solicitacoesCompra,data.cotacoes,data.notasFiscais,data.caixaObra,data.obras,obraIdsMapa
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
  // R7: cobrar numa só mensagem todas as entregas atrasadas de um fornecedor.
  const linkCobrancaDoGrupo = grupo => {
    const forn=fornecedorPorId.get(grupo.chave);
    if(!forn?.telefone)return null;
    const pedidosAtrasados=grupo.linhas.filter(linhaAtrasada).map(linha=>{
      const atraso=atrasoDe[linha.id];
      return {numero:linha.code,obra:linha.obra,previsao:fmtDate(atraso?.pedido?.previsao||linha.date),
        diasAtraso:atraso?.diasAtraso??Math.abs(Number(String(linha.deadline.label).match(/\d+/)?.[0]||0)),itens:atraso?.itensPendentes||[]};
    });
    if(!pedidosAtrasados.length)return null;
    return linkWhatsApp(forn.telefone,mensagemCobrancaFornecedor({empresa:"MARCELL",fornecedorNome:forn.nome,pedidos:pedidosAtrasados}));
  };
  // C2.3: nota 0-10 do fornecedor (prazo, notas sem divergência, cancelamentos; 12 meses).
  const avaliacaoForn = useMemo(() => avaliacoesFornecedores(data, today()), [data.fornecedores, data.pedidos, data.notasFiscais]);
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
      const materiaisCotacao=itensDaCotacao(c).map(i=>materialPorId.get(i.materialId)).map(m=>`${m?.codigo||""} ${m?.descricao||""}`).join(" ");
      const fornecedoresCotacao=(c.propostas||[]).map(p=>fornecedorPorId.get(p.fornecedorId)?.nome||"").join(" ");
      const solicitacao=solicitacaoPorId.get(c.solicitacaoId);
      return matchesPurchaseSearch(termo,c.numero,c.id,materiaisCotacao,fornecedoresCotacao,solicitacao?.numero);
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
      {id:"pedido",titulo:"Pedidos a enviar",sub:"Rascunho",cor:C.orange,cards:[]},
      {id:"entrega",titulo:"Aguardando entrega",sub:"Enviado ao fornecedor",cor:C.yellowD,cards:[]},
      {id:"concluido",titulo:"Concluídos",sub:"Recebimento confirmado",cor:C.green,cards:[]},
    ];
    const porId=new Map(colunas.map(c=>[c.id,c]));
    (data.solicitacoesCompra||[]).filter(s=>s.obraId===obraAtual&&!["cancelada","pedido_gerado"].includes(s.status)&&!cotacaoAtivaPorSolicitacao.has(s.id)).forEach(s=>{
      const prazo=s.necessidade||s.dataNecessidade||s.prazo||"";
      porId.get("demanda").cards.push({id:s.id,tipo:"solicitacao",codigo:s.numero||"Solicitação",titulo:(s.itens||[])[0]?.descricaoRef||s.observacao||"Materiais da obra",detalhe:`${(s.itens||[]).length} item(ns) · ${s.prioridade||"normal"}`,prazo,risco:risco(prazo),registro:s});
    });
    (data.cotacoes||[]).filter(c=>c.obraId===obraAtual&&c.status==="aberta"&&(cotacaoMultiItens(c)?itensPendentesDaCotacao(c).length>0:!c.pedidoId)).forEach(c=>{
      const sol=solicitacaoPorId.get(c.solicitacaoId);const prazo=sol?.necessidade||sol?.dataNecessidade||"";
      porId.get("cotacao").cards.push({id:c.id,tipo:"cotacao",codigo:c.numero||"Cotação",titulo:cotacaoMultiItens(c)&&c.itens.length>1?`${c.itens.length} itens · ${materialPorId.get(c.materialId)?.descricao||"Material"}`:materialPorId.get(c.materialId)?.descricao||"Material",detalhe:`${(c.propostas||[]).length} proposta(s) · ${cotacaoMultiItens(c)?`${itensPendentesDaCotacao(c).length} item(ns) a decidir`:`${Number(c.qtd||0).toLocaleString("pt-BR")} ${unidMat(c.materialId)}`}`,prazo,risco:risco(prazo),registro:c});
    });
    pedidosAtivos.forEach(p=>{
      // A coluna depende da entrega, não do pagamento (compra a prazo é o
      // normal). O pagamento aparece no próprio cartão.
      const status=statusPedido(p),concluido=status==="recebido";
      const coluna=concluido?"concluido":status==="rascunho"?"pedido":"entrega";
      const pagamento=statusPagamentoPedido(p)==="pago"?"pago":`a pagar ${fmtCompact(saldoPagamentoPedido(p))}`;
      const prazo=p.previsao||p.dataEntrega||"";
      const itens=(p.itens||[]);const primeiro=itens[0];
      porId.get(coluna).cards.push({id:p.id,tipo:"pedido",codigo:p.numero||"Pedido",titulo:primeiro?(materialPorId.get(primeiro.materialId)?.descricao||primeiro.descricaoRef||"Material"):"Pedido de compra",detalhe:`${fornecedorPorId.get(p.fornecedorId)?.nome||"Fornecedor não definido"}${itens.length>1?` · +${itens.length-1} item(ns)`:""} · ${pagamento}`,valor:totalPedido(p),prazo,risco:risco(prazo,concluido),registro:p});
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
      return matchesPurchaseSearch(termo,texto);
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
  //  Fornecedor
  const salvarForn = async (f) => {
    if (!f.nome.trim()) { showToast("Informe o nome do fornecedor.", "error"); return; }
    const p = { ...f, id: f.id || uid(), nome: f.nome.trim(),
      categorias: Array.isArray(f.categorias) ? f.categorias : [], ativo: f.ativo !== false };
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
    let origemMensagem=f.origemMensagem||null;
    if(origemMensagem?.imagem?.dataUrl){
      const imagem=origemMensagem.imagem;
      if(!imagem.url||imagem.obraId!==f.obraId){
        const obra=obras.find(o=>o.id===f.obraId);
        try{
          const uploaded=await enviarArquivoOneDrive({dataUrl:imagem.dataUrl,obraId:f.obraId,obraName:obra?.name||'Obra',
            driveId:obra?.oneDriveDriveId,folderId:obra?.oneDriveFolderId,folders:obra?.oneDriveFolders,
            category:'compras',subfolder:'Solicitações/Conversas',date:today(),fileName:`${imagem.uploadKey||solicitacaoId}-${imagem.nome}`});
          if(!uploaded.ok)throw new Error(uploaded.error||'O Drive não confirmou o envio do print.');
          const confirmada={...imagem,url:uploaded.url,itemId:uploaded.item?.id||'',driveId:uploaded.driveId||'',path:uploaded.path||'',obraId:f.obraId};
          origemMensagem={...origemMensagem,imagem:confirmada};
          const uploadedSource=origemMensagem;
          setSolModal(current=>current?{...current,origemMensagem:uploadedSource}:current);
        }catch(error){showToast(`${error.message} A solicitação permanece aberta. Tente novamente; o original ainda não foi salvo.`,'error');return false;}
      }
      const {dataUrl:localImage,...storedImage}=origemMensagem.imagem;
      void localImage;
      origemMensagem={...origemMensagem,imagem:storedImage};
    }
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
    // Solicitação nova vai sem número: o servidor numera sob a trava da
    // linha, sem colisão entre dois usuários (C2.1).
    const numero=f.numero||"";
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
      planningOrigin:f.planningOrigin||null,origemMensagem,observacao:f.observacao||"",analisadoEm:anterior?.analisadoEm||"",
      analisadoPor:anterior?.analisadoPor||"",pedidoId:anterior?.pedidoId||"",
      cotacaoIds:anterior?.cotacaoIds||[],aprovacaoInstanciaId:anterior?.aprovacaoInstanciaId||"",itens};
    const solicitacoesCompraBase=f.id
      ? (data.solicitacoesCompra||[]).map(s=>s.id===f.id?registro:s)
      : [...(data.solicitacoesCompra||[]),registro];

    // A aprovação nasce no servidor (purchase-approval.js), com a alçada da
    // empresa: a tela não monta nem envia instância de aprovação.
    const dataFinal={...data,materiais:materiaisAtualizados,solicitacoesCompra:solicitacoesCompraBase};
    if(!dispatchCommand){
      showToast("O salvamento seguro da solicitação exige conexão com o servidor.","error");
      return false;
    }
    const solicitacaoFinal=(dataFinal.solicitacoesCompra||[]).find(s=>s.id===solicitacaoId)||registro;
    const catalogMaterials=(dataFinal.materiais||[]).filter(material=>
      String(material.solicitacaoOrigemId||"")===String(solicitacaoId));
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.solicitacoesCompra||[]).find(s=>String(s.id)===String(solicitacaoId));
      return {
        type:OPERATIONAL_COMMAND.PURCHASE_REQUEST_SAVED,
        idempotencyKey:`solicitacao-compra-${solicitacaoId}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{request:solicitacaoFinal,catalogMaterials},
      };
    });
    if(!result?.ok){
      const reason=result?.state===SAVE_QUEUE_STATE.OFFLINE
        ?"Sem conexão. A solicitação continua aberta para você tentar novamente quando a internet voltar."
        :result?.state===SAVE_QUEUE_STATE.CONFLICT
          ?"Outra pessoa alterou os dados ao mesmo tempo. A solicitação não foi formalizada; resolva o conflito e tente novamente."
          :result?.reason||"O servidor não confirmou a solicitação. Seus dados continuam no formulário para uma nova tentativa.";
      showToast(reason,"error");return false;
    }
    setSolModal(null);setAba("solicitacoes");
    const numeroConfirmado=(result.data?.solicitacoesCompra||[]).find(s=>s.id===solicitacaoId)?.numero||numero;
    showToast(f.id?`Solicitação ${numeroConfirmado} atualizada e confirmada pelo servidor.`:`Solicitação ${numeroConfirmado} formalizada com ${itens.length} insumo(s) e confirmada pelo servidor.`);
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
  const decidirAprovacao=async(instancia,etapaId,decisao,justificativa="")=>{
    if(decisao==="reprovado"&&!String(justificativa||"").trim()){showToast("Informe o motivo da reprovação.","error");return;}
    if(!dispatchCommand){showToast("Registrar a decisão exige conexão com o servidor.","error");return;}
    // O servidor registra o usuário autenticado como aprovador e confere se
    // ele é elegível para a etapa (approval-commands.js).
    const result=await dispatchCommand(()=>({
      type:OPERATIONAL_COMMAND.APPROVAL_DECISION_RECORDED,
      idempotencyKey:`aprovacao-${instancia.id}-${etapaId}-${uid()}`,
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{instanciaId:instancia.id,etapaId,decisao,justificativa:String(justificativa||"").trim()},
    }));
    if(!result?.ok){
      showToast(result?.reason||"O servidor não confirmou a decisão. Tente novamente.","error");return;
    }
    showToast(decisao==="aprovado"?"Aprovação registrada.":"Reprovação registrada.");
  };

  // Achado ao fechar a lacuna de comandos de Compras (24/08/2026, ver
  // docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): esta função também cancelava
  // solicitações (status:"cancelada") por update() direto - mesmo com o
  // comando PURCHASE_REQUEST_CANCELLED já existindo e testado desde antes
  // nesta sessão, ele nunca tinha sido conectado a nenhum botão. Cancelar
  // por aqui pulava a checagem de pedidoId (uma solicitação que já gerou
  // pedido não pode ser cancelada - só o pedido), a concorrência otimista
  // e o motivo obrigatório de auditoria. O cancelamento foi movido para
  // cancelarSolicitacao (abaixo, via dispatchCommand); esta função agora só
  // cobre a transição "em_analise", que não tem comando próprio ainda (não
  // altera dado financeiro nem de auditoria crítica).
  // Agora também por comando (versionado, com papel conferido no servidor).
  const atualizarStatusSolicitacao=async(sol,status)=>{
    if(status!=="em_analise")return;
    if(!dispatchCommand){showToast("Marcar a solicitação em análise exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.solicitacoesCompra||[]).find(item=>item.id===sol.id);
      return {
        type:OPERATIONAL_COMMAND.PURCHASE_REQUEST_ANALYSIS_STARTED,
        idempotencyKey:`purchase-request-analysis-${sol.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{requestId:sol.id},
      };
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível marcar a solicitação em análise.","error");return;}
    showToast(`Solicitação ${sol.numero} em análise.`);
  };

  const cancelarSolicitacao=async sol=>{
    const motivo=window.prompt(`Motivo do cancelamento de ${sol.numero}:`);
    if(!String(motivo||"").trim())return;
    if(!dispatchCommand){showToast("O cancelamento seguro da solicitação exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.solicitacoesCompra||[]).find(item=>item.id===sol.id);
      return {
        type:OPERATIONAL_COMMAND.PURCHASE_REQUEST_CANCELLED,
        idempotencyKey:`purchase-request-cancel-${sol.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{requestId:sol.id,reason:String(motivo).trim()},
      };
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível cancelar a solicitação.","error");return;}
    showToast(`Solicitação ${sol.numero} cancelada.`);
  };

  // Registra que a solicitacao foi "emitida" para um fornecedor por WhatsApp
  // (clique no link wa.me em ModalCotacaoWhatsApp). Upsert por fornecedorId -
  // clicar de novo so atualiza o horario, nao duplica a linha.
  const registrarContatoSolicitacao=async(solicitacaoId,fornecedorId,fornecedorNome)=>{
    if(!solicitacaoId||!dispatchCommand)return;
    // O link do WhatsApp já abriu; um erro aqui só avisa, não desfaz o contato.
    const result=await dispatchCommand({
      type:OPERATIONAL_COMMAND.PURCHASE_REQUEST_SUPPLIER_CONTACTED,
      idempotencyKey:`purchase-request-contact-${solicitacaoId}-${fornecedorId}-${uid()}`,
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{requestId:solicitacaoId,supplierId:fornecedorId,supplierName:fornecedorNome},
    });
    if(!result?.ok)showToast(result?.reason||"Não foi possível registrar o contato com o fornecedor.","error");
  };

  const gerarPedidoSolicitacao=(sol)=>{
    if(!podeProcessar){showToast("Somente o setor de Compras pode transformar a solicitação em pedido.","error");return;}
    const instanciaApr=instanciaAprovacaoDe(sol);
    if(instanciaApr&&instanciaApr.status!=="aprovada"){
      showToast("A aprovação está pendente ou recusada. O pedido pode seguir; consulte Aprovações para regularizar a decisão.","warn");
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

  // Sem `item`, cota todos os itens da solicitação num único mapa (C1.3).
  const abrirCotacaoDaSolicitacao=(sol,item)=>{
    if(!podeProcessar){showToast("Somente Compras pode iniciar a cotação.","error");return;}
    const origem=item?[item]:(sol.itens||[]);
    const semInsumo=origem.filter(i=>!(i.materialId&&materiais.some(m=>m.id===i.materialId)));
    if(!origem.length||semInsumo.length===origem.length){showToast("O insumo ainda não está vinculado. Edite e salve a solicitação para regularizar.","error");return;}
    if(semInsumo.length)showToast(`${semInsumo.length} item(ns) sem insumo vinculado ficaram fora da cotação.`,"warn");
    const itens=origem.filter(i=>!semInsumo.includes(i)).map(i=>{const material=materiais.find(m=>m.id===i.materialId);return{
      id:uid(),materialId:material.id,qtd:String(i.quantidade),solicitacaoItemId:i.id||"",
      orcItemId:i.orcItemId||"",orcNivel1Id:i.orcNivel1Id||"",
      unidadeRef:i.unidadeRef||material.unidade||"UN",unidadeCompra:purchaseUnitOf(i),
      fatorConversao:Number(i.fatorConversao||1),comprimentoBarra:Number(i.comprimentoBarra||0),precoRef:Number(i.precoRef||0)};});
    setCotModal({id:"",solicitacaoId:sol.id,obraId:sol.obraId,data:today(),orcNivel1Id:itens[0]?.orcNivel1Id||"",
      itens,propostas:[propostaVaziaCotacao(),propostaVaziaCotacao()]});
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
                   dataBaseRef:i.dataBaseRef||"",ufRef:i.ufRef||"",
                   previsao:i.previsao||"",
                   remessas:(i.remessas||[]).filter(r=>r.data||Number(r.qtd)>0)
                     .map(r=>({id:r.id||uid(),data:r.data||"",qtd:Number(r.qtd||0)})),
                   contratoId:i.contratoId||"",contratoItemId:i.contratoItemId||"" };
      });
    if (!itens.length) { showToast("Adicione ao menos um item.", "error"); return; }
    if(f.id&&itens.some(i=>Number(i.qtd)<Number(i.qtdRecebida||0))){
      showToast("A quantidade comprada não pode ficar abaixo do que já foi recebido.","error");return;
    }
    const pedidoAnterior=f.id?(data.pedidos||[]).find(p=>p.id===f.id):null;
    const totalNovo=itens.reduce((s,i)=>s+Number(i.qtd||0)*Number(i.precoUnit||0),0);
    const totalPago=(pedidoAnterior?.pagamentos||[]).filter(active).reduce((s,pg)=>s+Number(pg.valor||0),0);
    if(f.id&&totalNovo+0.01<totalPago){
      showToast(`O novo total não pode ser menor que o valor já pago (${fmt(totalPago)}).`,"error");return;
    }
    if(f.id&&!String(f.motivoAjuste||"").trim()){
      showToast("Informe o motivo do ajuste para preservar a rastreabilidade.","error");return;
    }
    // C3.2: pedido que estoura o orçamento só segue com confirmação explícita.
    const estouros=alertasOrcamentoDoPedido(data,pedidoDoFormulario({...f,itens}))
      .filter(a=>a.alerta==="estourou"&&f.status!=="rascunho");
    if(estouros.length&&!window.confirm(`Este pedido estoura o orçamento de ${estouros.map(a=>a.descricao).join(", ")}. Salvar mesmo assim?`))return;

    const p = {
      ...Object.fromEntries(Object.keys(ORDER_TERM_FIELDS).map(key=>[key,f[key]||""])),
      id: f.id || uid(),
      numero: f.numero?.trim() || "",
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
        expectedVersion:vigente?Number(f.version||0):0,
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{order:p,newMaterials:novosMateriais,adjustmentReason:String(f.motivoAjuste||"").trim()},
      };
    });
    if(!result?.ok){showToast(result?.reason||"O servidor não confirmou o pedido.","error");return;}
    setPedModal(null);
    const numeroPedido=(result.data?.pedidos||[]).find(item=>item.id===p.id)?.numero||p.numero;
    showToast(f.id ? "Pedido atualizado." : `Pedido ${numeroPedido} criado.`);
    avisarPendencias(result);
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
    if(f.origem==="caixa_obra"&&!obra?.hasCaixa)showToast("Caixa ainda não ativado. Confira a configuração e os movimentos registrados.","warn");
    if(f.origem==="caixa_obra"&&valor>caixa.saldo+.001)showToast("O registro deixará o caixa negativo. Confira aportes e a origem real do pagamento.","warn");
    const conferencia=conferenciaPagamentoPedido(data,pedido.id);
    if(conferencia&&valor>conferencia.liberadoCents/100+.005&&(!f.adiantamento||!String(f.motivoAdiantamento||"").trim())){
      showToast("Pagamento anterior à conferência completa. Será registrado como adiantamento; complete a entrega, a nota e a observação depois.","warn");
    }
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
          workspace,adiantamento:!!f.adiantamento,motivoAdiantamento:String(f.motivoAdiantamento||"").trim(),
        },
      };
    });
    if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o pagamento.");
    const pedidoConfirmado=(result.data?.pedidos||[]).find(item=>item.id===pedido.id);
    const quitado=saldoPagamentoPedido(pedidoConfirmado||pedido)<=.01;
    const saldoProjetado=caixa.saldo-valor;
    setPagModal(null);
    if(f.origem==="caixa_obra"&&saldoProjetado<=caixa.limiteBaixo)showToast(`Pagamento registrado, mas o caixa ficou baixo: ${fmt(saldoProjetado)}. Recomenda-se novo aporte (reserva mínima ${fmt(caixa.limiteBaixo)}).`,"warn");
    else showToast(quitado?`Pedido ${pedido.numero} quitado.`:`Pagamento parcial registrado. Saldo: ${fmt(saldo-valor)}.`);
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
    // recebidos: { [itemId]: qtd que chegou AGORA }. R6: a mesma regra do
    // "Chegou" da tela da obra (montarRecebimento).
    const montado=montarRecebimento(pedido,recebidos,{quando:new Date().toISOString().slice(0,10),novoId:uid,
      descricao:`Pedido ${pedido.numero} · ${nomeForn(pedido.fornecedorId)}`});
    if(!montado.ok){
      const item=(pedido.itens||[]).find(i=>i.id===montado.itemId);
      showToast(item?`"${nomeMat(item.materialId)}": ${montado.erro}`:montado.erro,"error");
      return;
    }
    const entradas=montado.stockEntries;

    if(!dispatchCommand){
      showToast("O recebimento seguro exige conexão com o servidor.","error");
      return;
    }
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.pedidos||[]).find(item=>item.id===pedido.id);
      return {type:OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED,
        idempotencyKey:`pedido-recebimento-${pedido.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{pedidoId:pedido.id,receivedQuantities:montado.receivedQuantities,stockEntries:entradas}};
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
    avisarPendencias(result);
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
  const movimentoDoPedido=movementOfOrder;

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

  // Único ponto de entrada das ações do cartão de pedido (botão principal e
  // menu "⋯"). Cancelar e excluir seguem pelos mesmos fluxos de antes, com o
  // mesmo motivo e a mesma confirmação.
  const executarAcaoPedido=(p,acao)=>{
    if(acao==="receber")return setRecModal(p);
    if(acao==="revisar"||acao==="editar")return setPedModal({...p,itens:p.itens.map(i=>({...i,qtd:String(i.qtd),precoUnit:String(i.precoUnit)}))});
    if(acao==="enviar")return setEnvioPedido(p);
    if(acao==="aceite")return setAceitePedido({pedido:p,nome:"",data:today(),canal:"whatsapp",previsao:p.previsao||"",obs:""});
    if(acao==="saldo"){setAba("financeiro");setFiltroFinanceiro("pendentes");return;}
    if(acao==="cancelar")return cancelarPedido(p);
    if(acao==="excluir")return abrirExclusaoCompra(p);
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
  const salvarCotacao = async (f) => {
    const itens=(f.itens||[]).map(i=>({...i,qtd:Number(i.qtd)}));
    if(!itens.length||itens.some(i=>!i.materialId)){showToast("Selecione o insumo de cada item.","error");return;}
    if(itens.some(i=>!(i.qtd>0))){showToast("Informe a quantidade de cada item.","error");return;}
    const props=(f.propostas||[])
      .filter(p=>p.fornecedorId&&itens.some(i=>Number(p.precos?.[i.id])>0))
      .map(p=>({id:p.id||uid(),fornecedorId:p.fornecedorId,prazoDias:p.prazoDias==null||p.prazoDias===""?null:Number(p.prazoDias),obs:p.obs||"",
        ...Object.fromEntries(Object.keys(ORDER_TERM_FIELDS).map(key=>[key,p[key]||""])),
        documentos:Array.isArray(p.documentos)?p.documentos:[],
        ...(p.custoFinal?{custoFinal:p.custoFinal}:{}),condicoesPagamento:p.condicoesPagamento||"",
        precos:Object.fromEntries(itens.filter(i=>Number(p.precos?.[i.id])>0).map(i=>[i.id,Number(p.precos[i.id])]))}));
    if (props.length < 2) { showToast("Uma cotação precisa de ao menos 2 propostas.", "error"); return; }
    if (!dispatchCommand) { showToast("Salvar a cotação exige conexão com o servidor.", "error"); return; }
    const quote = {
      id: f.id || uid(), obraId: f.obraId || obraAtual,
      itens:itens.map(i=>({id:i.id,materialId:i.materialId,qtd:i.qtd,
        unidadeRef:i.unidadeRef||unidMat(i.materialId)||"UN",unidadeCompra:purchaseUnitOf(i),
        fatorConversao:Number(i.fatorConversao||1),precoRef:Number(i.precoRef||0),
        orcItemId:i.orcItemId||"",orcNivel1Id:i.orcNivel1Id||f.orcNivel1Id||"",
        solicitacaoItemId:i.solicitacaoItemId||""})),
      orcNivel1Id:f.orcNivel1Id||"",
      data: f.data || new Date().toISOString().slice(0,10),
      propostas: props, solicitacaoId:f.solicitacaoId||"",
    };
    const result = await dispatchCommand(atual=>{
      const vigente=(atual.cotacoes||[]).find(item=>item.id===quote.id);
      return {
        type:OPERATIONAL_COMMAND.QUOTATION_SAVED,
        idempotencyKey:`purchase-quote-save-${quote.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{quote},
      };
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível salvar a cotação.","error");return;}
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
    if(!dispatchCommand)throw new Error("Anexar o documento exige conexão com o servidor.");
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.cotacoes||[]).find(item=>item.id===cotacao.id);
      return {
        type:OPERATIONAL_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED,
        idempotencyKey:`purchase-quote-document-${cotacao.id}-${documento.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{quoteId:cotacao.id,proposalId:proposta.id,document:documento},
      };
    });
    if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o vínculo à cotação.");
    // Cache da pasta do OneDrive em `obras` fica fora do comando de
    // propósito - mesmo padrão já usado por PURCHASE_ORDER_DOCUMENT_ATTACHED
    // (LegacyApp.jsx): update() best-effort separado, depois que o comando
    // (o dado auditável de verdade) já confirmou.
    const obrasAtualizadas=(result.data.obras||[]).map(o=>o.id===cotacao.obraId?{...o,oneDriveDriveId:resp.workspace?.driveId||o.oneDriveDriveId,oneDriveFolderId:resp.workspace?.folderId||o.oneDriveFolderId,oneDriveFolders:resp.workspace?.folders||o.oneDriveFolders,oneDriveUrl:resp.workspace?.webUrl||o.oneDriveUrl}:o);
    update({...result.data,obras:obrasAtualizadas});
    setAnexoCotacao(null);showToast("Documento anexado à proposta da cotação.");
  }catch(err){showToast(err.message||"Não foi possível anexar o documento da cotação.","error");}finally{setSubindoAnexoCotacao(false);}};

  // Mapa de cotação decidido por item: um pedido por fornecedor vencedor,
  // sem redigitar nada. Itens sem escolha ficam pendentes na cotação.
  const decidirCotacao = async(cot, escolhas, justificativas={}) => {
    const avaliacao=avaliarEscolhasCotacao(cot,escolhas,justificativas);
    if(avaliacao.erro){showToast(avaliacao.erro,"error");return;}
    if(!dispatchCommand){showToast("A geração segura do pedido exige conexão com o servidor.","error");return;}
    const orders=Object.fromEntries(avaliacao.grupos.map(g=>[g.fornecedorId,{orderId:uid(),number:""}]));
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.cotacoes||[]).find(item=>item.id===cot.id);
      return {
        type:OPERATIONAL_COMMAND.QUOTE_MAP_DECIDED,
        idempotencyKey:`purchase-quote-map-${cot.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{quoteId:cot.id,choices:escolhas,justifications:justificativas,orders,
          date:new Date().toISOString().slice(0,10),forecast:""},
      };
    });
    if(!result?.ok){showToast(result?.reason||"O servidor não confirmou os pedidos da cotação.","error");return;}
    const ids=new Set(Object.values(orders).map(o=>o.orderId));
    const numeros=(result.data?.pedidos||[]).filter(p=>ids.has(p.id)).map(p=>p.numero).join(", ");
    setCotDecisao(null);
    showToast(`${ids.size>1?`Pedidos ${numeros} gerados`:`Pedido ${numeros} gerado`} a partir da cotação.`);
    avisarPendencias(result);
    guardarOrigemCompra({type:'quote',id:cot.id,obraId:cot.obraId,label:cot.numero||cot.id});
    setBusca('');setFiltroPedidos({...FILTROS_PEDIDOS_VAZIOS,ids:[...ids],origem:`Cotação ${cot.numero||cot.id}`});setAba("pedidos");
    setRegistroFoco([...ids][0]||'');
  };

  // Envio do pedido ao fornecedor (C2.5): monta o conteúdo, abre o canal e
  // registra o envio no servidor. O aceite é informado por Compras.
  const conteudoEnvioPedido=(p,link="")=>{
    const forn=fornecedorPorId.get(p.fornecedorId),obra=obraPorId.get(p.obraId);
    const itens=(p.itens||[]).map(i=>({descricao:materialPorId.get(i.materialId)?.descricao||i.descricaoRef||"Material",
      qtd:i.qtd,unidade:purchaseUnitOf(i),precoUnit:i.precoUnit}));
    const base={empresa:"MARCELL",numero:p.numero,data:p.data,fornecedorNome:forn?.nome||"",
      fornecedorCnpj:forn?.cnpj||"",obraNome:obra?.name||"",itens,previsao:p.previsao,observacao:p.obs||"",linkAceite:link};
    const snapshot=p.historicoCondicoesPedido?.at(-1);
    if(snapshot){base.fornecedorNome=snapshot.fornecedor?.nome||"Não registrado";base.fornecedorCnpj=snapshot.fornecedor?.documento||"";base.obraNome=snapshot.obra?.nome||"Não registrado";}
    const terms=snapshot?.condicoes||p;
    base.condicoes=[...(!snapshot||snapshot.origem==="legado"?["Acordo original sem registro histórico."]:[]),...Object.entries(ORDER_TERM_FIELDS).map(([key,label])=>`${label}: ${terms[key]||"Não registrado"}`)];
    return {forn,texto:mensagemPedidoFornecedor(base),assunto:assuntoEmailPedido(base),html:documentoPedidoHtml(base)};
  };
  const registrarEnvioPedido=async(p,canal,destino="")=>{
    if(!dispatchCommand){showToast("Registrar o envio exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>({
      type:OPERATIONAL_COMMAND.PURCHASE_ORDER_SENT_TO_SUPPLIER,
      idempotencyKey:`purchase-order-sent-${p.id}-${uid()}`,
      expectedVersion:Number((atual.pedidos||[]).find(x=>x.id===p.id)?.version||0),
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{orderId:p.id,channel:canal,destination:destino},
    }));
    if(!result?.ok){showToast(result?.reason||"O servidor não registrou o envio do pedido.","error");return;}
    showToast(`Envio do pedido ${p.numero} registrado.`);
  };
  // Link para o fornecedor aceitar sozinho: o servidor assina e nada fica
  // guardado. Pedido alterado depois disso invalida o link.
  const gerarLinkAceite=async p=>{
    setGerandoLinkAceite(true);
    try{
      const result=await gerarLinkAceitePedido(p.id);
      if(!result?.ok||!result.token){showToast(result?.error||"Não foi possível gerar o link de aceite.","error");return;}
      setLinkAceite({pedidoId:p.id,url:`${window.location.origin}/aceite-pedido#${result.token}`,expiraEm:result.expiraEm});
      showToast("Link de aceite gerado. Ele já vai na mensagem ao fornecedor.");
    }finally{setGerandoLinkAceite(false);}
  };
  const imprimirPedido=p=>{
    const janela=window.open("","_blank");
    if(!janela){showToast("Permita a abertura de janelas para gerar o PDF do pedido.","error");return false;}
    janela.document.write(marcellReportHtml(conteudoEnvioPedido(p).html));
    janela.document.close();
    janela.focus();
    janela.print();
    return true;
  };
  const salvarAceitePedido=async()=>{
    const f=aceitePedido;if(!f)return;
    if(!String(f.nome||"").trim()){showToast("Informe quem confirmou o pedido no fornecedor.","error");return;}
    if(!dispatchCommand){showToast("Registrar o aceite exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(atual=>({
      type:OPERATIONAL_COMMAND.PURCHASE_ORDER_SUPPLIER_ACCEPTED,
      idempotencyKey:`purchase-order-accepted-${f.pedido.id}-${uid()}`,
      expectedVersion:Number((atual.pedidos||[]).find(x=>x.id===f.pedido.id)?.version||0),
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{orderId:f.pedido.id,acceptedBy:f.nome,acceptedAt:f.data,channel:f.canal,
        confirmedForecast:f.previsao||"",note:f.obs||""},
    }));
    if(!result?.ok){showToast(result?.reason||"O servidor não registrou o aceite.","error");return;}
    setAceitePedido(null);
    showToast(`Aceite do pedido ${f.pedido.numero} registrado.`);
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
      if(!(card.registro.itens||[]).length){showToast("A solicitação não possui item para cotar.","error");return;}
      abrirCotacaoDaSolicitacao(card.registro);
      showToast("Cotação preparada. Inclua as propostas para concluir a movimentação.");return;
    }
    if(card.tipo==="cotacao"&&destino==="pedido"){
      const mapa=mapaDaCotacao(card.registro);
      if(mapa.linhas.every(l=>!l.ofertas.length)){
        setCotModal(formularioDaCotacao(card.registro));
        showToast("Complete ao menos duas propostas antes de gerar o pedido.","warn");return;
      }
      // Arrastar não pode comprar sozinho: abre a decisão por item.
      setCotDecisao({cotacaoId:card.registro.id,escolhas:sugestaoDeEscolhas(card.registro),justificativas:{}});return;
    }
    if(card.tipo==="pedido"&&destino==="entrega"){
      // Do rascunho para "Aguardando entrega" = enviar ao fornecedor.
      setPedModal({...card.registro,status:"enviado",motivoAjuste:"Pedido enviado ao fornecedor.",
        itens:(card.registro.itens||[]).map(i=>({...i,qtd:String(i.qtd),precoUnit:String(i.precoUnit)}))});
      showToast("Confira e salve para enviar o pedido ao fornecedor.");return;
    }
    if(card.tipo==="pedido"&&destino==="concluido"){
      // Recebimento não depende de pagamento prévio (compra a prazo é o caso
      // normal) - o saldo em aberto continua visível na tela financeira, só
      // não bloqueia mais a chegada do material.
      setRecModal(card.registro);showToast("Confirme as quantidades recebidas para concluir o cartão.");return;
    }
    showToast("Esta movimentação deve ser concluída no registro de origem.","warn");
  };

  const hojeFluxo=today();
  const fluxoCompras=useMemo(()=>buildPurchaseWorkspace(data,obraIdsMapa,hojeFluxo),[data,obraIdsMapa,hojeFluxo]);
  // Comparativo entre obras: só faz sentido (e só é calculado) no escopo "Todas as obras".
  const porObra=useMemo(()=>todasObras?buildPurchasesByWork(data,obras,hojeFluxo):null,[todasObras,data,obras,hojeFluxo]);
  // A0.3: exporta exatamente o que a tela mostra (lista filtrada e escopo da obra).
  // A biblioteca de planilha só é carregada no clique.
  const [exportando,setExportando]=useState("");
  const exportarExcel=async(assunto,planilhas)=>{
    if(exportando)return;
    setExportando(assunto);
    try{
      const {writeTables}=await import("../../../lib/spreadsheet");
      await writeTables(planilhas,nomeArquivoCompras(assunto,today()));
    }catch{showToast?.("Não foi possível gerar a planilha. Tente novamente.","error");}
    finally{setExportando("");}
  };
  const botaoExportar=(assunto,planilhas,rotulo)=><Button variant="secondary" size="sm" className="purchase-export"
    disabled={!!exportando||!planilhas.some(p=>p.linhas.length)} onClick={()=>exportarExcel(assunto,planilhas)}
    aria-label={rotulo}>{exportando===assunto?"Gerando planilha…":"Exportar para Excel"}</Button>;
  const abrirRegistroFluxo=row=>{
    if(row.type==="order"){
      if(row.stage==="recebimentos"){setRecModal(row.record);return;}
      if(podeProcessar){setPedModal({...row.record,motivoAjuste:"",itens:(row.record.itens||[]).map(i=>({...i,qtd:String(i.qtd),precoUnit:String(i.precoUnit)}))});return;}
      irParaPedidos(row.code);return;
    }
    if(row.type==="quote"){
      setAba("cotacoes");setBuscaCotacao("");setStatusCotacao("todas");setInicioCotacao("");setFimCotacao("");
      setCotacaoExpandida(row.id);setRegistroFoco(row.id);return;
    }
    setAba("solicitacoes");setRegistroFoco(row.id);
  };
  const comprasAbas=[
    ["kanban","Kanban de compras"],
    ["mapa","Mapa gerencial"],
    ["por_pagador","Por quem pagou"],
    ["financeiro",`Pagamentos${resumoFinanceiro.pendentes?` · ${resumoFinanceiro.pendentes}`:""}`],
    ["solicitacoes",`Solicitações${solicitacoesPendentes?` · ${solicitacoesPendentes}`:""}`],
    ["cotacoes","Cotações"],["pedidos","Pedidos"],["historico_compras","Histórico de compras"],["orcado","Orçado x comprado"],
    ["forn","Cadastro de fornecedores"],["contratos","Contratos e medições"],["hist_fornecedor","Histórico por fornecedor"],["precos","Evolução de insumos"]
  ];
  const irParaArea=id=>{
    setAba(id);setRegistroFoco("");setRetornosCompra([]);
    window.requestAnimationFrame(()=>document.getElementById("compras-area-atual")?.focus({preventScroll:true}));
  };
  const guardarOrigemCompra=source=>setRetornosCompra(previous=>[...previous.slice(-7),{
    area:aba,recordId:source.id,workId:source.obraId,label:`${{request:'solicitação',quote:'cotação',order:'pedido'}[source.type]} ${source.label}`,
    scope:obraIdsMapa.join('|'),busca,filtroPedidos,buscaCotacao,statusCotacao,inicioCotacao,fimCotacao,cotacaoExpandida,
  }]);
  const abrirVinculoCompra=(target,source)=>{
    const collection={request:data.solicitacoesCompra,quote:data.cotacoes,order:data.pedidos}[target.type]||[];
    const record=collection.find(item=>item.id===target.id&&item.obraId===target.obraId&&obraIdsMapa.includes(item.obraId));
    if(!record){showToast('O registro não está disponível neste recorte. Confira a obra e os vínculos.','warn');return;}
    guardarOrigemCompra(source);
    if(target.type==='quote'){
      setBuscaCotacao('');setStatusCotacao('todas');setInicioCotacao('');setFimCotacao('');setCotacaoExpandida(target.id);setAba('cotacoes');
    }else if(target.type==='order'){
      setBusca('');setFiltroPedidos({...FILTROS_PEDIDOS_VAZIOS,ids:[target.id],origem:target.label});setAba('pedidos');
    }else setAba('solicitacoes');
    setRegistroFoco(target.id);
  };
  const retornoCompra=retornosCompra.at(-1);
  const voltarOrigemCompra=()=>{
    if(!retornoCompra||retornoCompra.scope!==obraIdsMapa.join('|')){setRetornosCompra([]);return;}
    setBusca(retornoCompra.busca);setFiltroPedidos(retornoCompra.filtroPedidos);
    setBuscaCotacao(retornoCompra.buscaCotacao);setStatusCotacao(retornoCompra.statusCotacao);setInicioCotacao(retornoCompra.inicioCotacao);setFimCotacao(retornoCompra.fimCotacao);setCotacaoExpandida(retornoCompra.cotacaoExpandida);
    setAba(retornoCompra.area);setRegistroFoco(retornoCompra.recordId);setRetornosCompra(previous=>previous.slice(0,-1));
  };
  // Abre a obra escolhida no comparativo: troca o escopo, zera os filtros da fila e vai para a área pedida.
  const abrirObra=(obraId,area="fila")=>{setEscopoMapa("obra");setObraSel(obraId);setFiltrosFluxo({query:"",stage:"",risk:""});irParaArea(area);};
  const abrirModoAnalise=()=>setModoIA(true);
  const planningIntentHandled=useRef(null);
  useEffect(()=>{
    if(intent?.tabId!=="cmp"||!["planning-request","open-request","open-order"].includes(intent.action)||planningIntentHandled.current===intent.sequence)return;
    planningIntentHandled.current=intent.sequence;
    const scopedWork=obraIdFixo||currentUser?.obraId||intent.scope?.obraId;
    if(!scopedWork||!obras.some(work=>work.id===scopedWork))return;
    if(intent.action==="open-order"){
      const order=(data.pedidos||[]).find(record=>record.id===intent.record?.pedidoId&&record.obraId===scopedWork&&!record.deletedAt);
      if(!order){showToast("O pedido não está disponível nesta obra. Confira o vínculo na origem.","warn");return;}
      setBusca("");setFiltroPedidos({...FILTROS_PEDIDOS_VAZIOS,ids:[order.id],origem:"Planejamento e compras"});setAba("pedidos");setRegistroFoco(order.id);setFichaCompra({pedidoId:order.id});return;
    }
    setAba("solicitacoes");
    if(intent.action==="open-request"){
      setBusca("");
      const request=(data.solicitacoesCompra||[]).find(r=>r.id===intent.record?.requestId&&r.obraId===scopedWork);
      if(request)setRegistroFoco(request.id);
      return;
    }
    if(intent.record?.obraId!==scopedWork)return;
    const needs=planningPurchaseNeeds(data,{...intent.record,obraId:scopedWork});
    if(needs.error){showToast(needs.error,"error");return;}
    if(needs.requests.length){setRegistroFoco(needs.requests[0].id);return;}
    const draft=planningRequestDraft(needs,uid);
    if(draft)setSolModal(draft);
    else showToast("Vincule os insumos desta etapa no orçamento antes de solicitar.","error");
  },[intent?.sequence]);
  const abrirNovaSolicitacao=()=>setSolModal({obraId:currentUser?.obraId||obraAtual,necessidade:"",prioridade:"normal",referenciaId:basesCompra[0]?.id||"",observacao:"",itens:[]});
  const abasSecundarias=comprasAbas.filter(([id])=>!["solicitacoes","cotacoes","pedidos","financeiro","historico_compras","precos"].includes(id));
  const [competenciaDre,setCompetenciaDre]=useSessionState("competenciaDre",()=>savedScope?.year!=null&&savedScope?.month!=null?`${savedScope.year}-${String(savedScope.month+1).padStart(2,"0")}`:new Date().toISOString().slice(0,7));
  const escopoDre={obraId:todasObras?"":obraAtual,year:Number(competenciaDre.slice(0,4)),month:Number(competenciaDre.slice(5,7))-1,period:"mes"};
  useRememberWorkflowScope("cmp",escopoDre);
  const escopoFluxo=todasObras?"Todas as obras":obraPorId.get(obraAtual)?.name||"Selecione uma obra";
  const abrirNovoPedido=()=>setPedModal({id:"",numero:"",obraId:obraAtual,fornecedorId:"",
          data:new Date().toISOString().slice(0,10),previsao:"",status:"enviado",
          origemPagamento:"empresa",pagamentos:[],referenciaId:basesCompra[0]?.id||"",itens:[{id:uid(),materialId:"",qtd:"",precoUnit:"",qtdRecebida:0,orcItemId:"",orcNivel1Id:"",referenciaId:"",fonteRef:"",codigoRef:"",descricaoRef:"",unidadeRef:"",unidadeCompra:"",fatorConversao:1,precoRef:0,dataBaseRef:"",ufRef:""}],obs:""});
  const abrirNovaCotacao=()=>setCotModal({id:"",obraId:obraAtual,orcNivel1Id:"",data:today(),
    itens:[itemVazioCotacao()],propostas:[propostaVaziaCotacao(),propostaVaziaCotacao()]});

  if(pilotOpen)return <Suspense fallback={<p role="status">Carregando piloto…</p>}><OperationalPilot data={data} mode="compras" scope={{workId:obraIdFixo||(!todasObras?obraAtual:"")}} notes={pilotNotes} onNotes={setPilotNotes} onClose={()=>setPilotOpen(false)}/></Suspense>;

  return (
    <div className="anim compras-view" style={{display:"flex",flexDirection:"column",gap:isDesktop?12:10}}>
      <PageHeader className="workspace-header purchase-header" title="Compras" description="Solicitações, pedidos e entregas."
        secondaryActions={<div className="purchase-context-bar">
          <div className="compras-project-picker">{obraIdFixo
            ? <Inp label="Obra" value={obras.find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
            : <Select label="Obra" value={todasObras?"all":obraAtual} onChange={event=>{const v=event.target.value;
                setRegistroFoco("");setRetornosCompra([]);
                if(v==="all"){setEscopoMapa("empresa");return;}
                setEscopoMapa("obra");setObraSel(v);
              }} options={[{value:"all",label:"Todas as obras"},...obras.map(o=>({value:o.id,label:o.name}))]}/>}</div>
        </div>}
        primaryAction={<div className="purchase-header-actions">
          {aba==="cotacoes"&&<Button variant="secondary" size="icon" aria-label="Voltar à fila" title="Voltar à fila" onClick={()=>irParaArea("fila")}><ArrowLeft aria-hidden="true" size={18}/></Button>}
          <Button onClick={aba==="cotacoes"?abrirNovaCotacao:aba==="pedidos"?abrirNovoPedido:abrirNovaSolicitacao}>{aba==="cotacoes"?"Adicionar cotação":aba==="pedidos"?"Novo pedido":"Nova solicitação"}</Button>
          <OrderActionMenu label="Mais ações de Compras" comuns={[
            {id:"analisar",label:"Analisar documento"},
            {id:"piloto",label:"Piloto de conferência"},
            ...(["cotacoes","pedidos"].includes(aba)?[{id:"solicitar",label:"Nova solicitação"}]:[]),
            ...(aba!=="fila"&&aba!=="cotacoes"?[{id:"fila",label:"Voltar à fila"}]:[]),
          ]} onSelect={id=>{if(id==="piloto")setPilotOpen(true);else if(id==="analisar")abrirModoAnalise();else if(id==="solicitar")abrirNovaSolicitacao();else irParaArea("fila");}}/>
        </div>}>
        {save.state!=="idle"&&<p role="status" aria-live="polite" className="purchase-save-state" data-state={save.state}>{save.message}</p>}
      </PageHeader>
      <PurchaseNavigation area={aba} onNavigate={irParaArea} counts={fluxoCompras.counts}
        orderCount={(data.pedidos||[]).filter(p=>obraIdsMapa.includes(p.obraId)).length} financeCount={resumoFinanceiro.pendentes} otherAreas={abasSecundarias}/>
      {retornoCompra&&retornoCompra.scope===obraIdsMapa.join('|')&&<nav className="purchase-flow-return" aria-label="Retorno à origem da compra"><p>Origem: {retornoCompra.label}. O recorte anterior será restaurado ao voltar.</p><Button variant="secondary" onClick={voltarOrigemCompra}>Voltar para {retornoCompra.label}</Button></nav>}
      {/* Na fila, aprovações e recebimentos o painel abaixo já tem título próprio:
          o nome da área fica só para leitor de tela e como destino do foco. */}
      <div id="compras-area-atual" className="purchase-area-heading" tabIndex={-1}
        data-compact={["fila","aprovacoes","recebimentos","cotacoes"].includes(aba)||undefined}>
        <h3>{PURCHASE_AREA_LABELS[aba]||comprasAbas.find(([id])=>id===aba)?.[1]}</h3>
        {aba!=="fila"&&aba!=="cotacoes"&&<Button variant="ghost" size="sm" onClick={()=>irParaArea("fila")}>Voltar à fila</Button>}
      </div>
      {["fila","aprovacoes","recebimentos"].includes(aba)&&<PurchaseWorkspace model={fluxoCompras} area={aba} scope={escopoFluxo}
        filters={filtrosFluxo} onFiltersChange={setFiltrosFluxo} onOpen={abrirRegistroFluxo}
        supplierName={nomeForn} supplierChargeLink={linkCobrancaDoGrupo}
        exportButton={linhas=>botaoExportar(aba,[planilhaFila(linhas)],`Exportar para Excel os ${linhas.length} registro(s) da lista`)}
        afterMetrics={porObra&&porObra.linhas.length>1?<PurchasesByWork model={porObra} onOpenWork={id=>abrirObra(id,"fila")}/>:null}/>}

      {aba==="kanban"&&<div className="purchase-kanban-view">
        <section className="purchase-kanban-head">
          <div><p>Controle visual de abastecimento</p><h3>Kanban de compras</h3><span>Os cartões avançam conforme solicitação, cotação, pagamento e recebimento são registrados.</span></div>
          <div className="purchase-kanban-filters">
            {[["ativos","Fluxo ativo"],["criticos","Atrasados e atenção"],["todos","Todos"]].map(([id,label])=><StandardButton variant="secondary" key={id} type="button" aria-pressed={filtroKanban===id} data-active={filtroKanban===id} onClick={()=>setFiltroKanban(id)}>{label}</StandardButton>)}
          </div>
        </section>
        <div className="purchase-andon-legend" aria-label="Legenda de prazos">
          <span><i style={{background:"var(--arcd-success-text)"}}/>No prazo</span><span><i style={{background:"var(--arcd-action-primary)"}}/>Até 3 dias</span><span><i style={{background:"var(--arcd-danger-text)"}}/>Atrasado</span><span><i style={{background:"var(--arcd-text-secondary)"}}/>Sem prazo</span>
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
                {cards.map(card=><RecordAction type="button" draggable className="purchase-kanban-card" key={`${card.tipo}-${card.id}`} style={{"--risk-color":card.risco.cor}}
                  onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/arcd-kanban",`${card.tipo}:${card.id}`);e.currentTarget.dataset.dragging="true";}}
                  onDragEnd={e=>{delete e.currentTarget.dataset.dragging;}}
                  onClick={()=>{
                  if(card.tipo==="solicitacao")setSolModal({...card.registro,itens:(card.registro.itens||[]).map(i=>({...i}))});
                  else if(card.tipo==="cotacao")setCotModal(formularioDaCotacao(card.registro));
                  else setPedModal({...card.registro,itens:(card.registro.itens||[]).map(i=>({...i}))});
                }}>
                  <div className="purchase-kanban-card-top"><span>{card.codigo}</span><b style={{color:card.risco.cor}}>{card.risco.rotulo}</b></div>
                  <h4>{card.titulo}</h4><p>{card.detalhe}</p>
                  <footer><span>{card.prazo?`Prazo ${fmtDate(card.prazo)}`:"Defina o prazo"}</span>{card.valor>0&&<strong>{fmtCompact(card.valor)}</strong>}</footer>
                </RecordAction>)}
                {!cards.length&&<div className="purchase-kanban-empty">Nenhum cartão nesta etapa</div>}
              </div>
            </section>;
          })}
        </div>
        <p className="purchase-kanban-help"><b>Regra Andon:</b> vermelho exige ação imediata; amarelo deve ser tratado antes de entrar em atraso. Clique em um cartão para atualizar o registro de origem.</p>
      </div>}

      {aba==="mapa"&&<div className="compras-management-map" style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
        <section style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"var(--arcd-space-3)",flexWrap:"wrap",padding:"var(--arcd-space-3) var(--arcd-space-4)",background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:10}}>
          <div><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",letterSpacing:"var(--arcd-letter-spacing-body)",textTransform:"uppercase"}}>Comando de suprimentos</p><h3 style={{fontSize:"var(--arcd-type-section-title)",fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-half)"}}>Mapa gerencial de Compras</h3><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)",maxWidth:680,lineHeight:"var(--arcd-line-height-normal)"}}>Visão do compromisso até a entrega: demanda, concorrência, fornecedor, pagamento, estoque e risco de abastecimento.</p></div>
          {!obraIdFixo&&<div style={{display:"flex",padding:"var(--arcd-space-half)",background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:8}}>{[["empresa","Empresa"],["obra","Obra selecionada"]].map(([v,l])=><StandardButton variant="secondary" key={v} aria-pressed={escopoMapa===v} onClick={()=>setEscopoMapa(v)} style={{}}>{l}</StandardButton>)}</div>}
        </section>
        {/* R5: "Resumo" responde o que fazer agora; "Análises" guarda o retrato gerencial; A0.1: "Uso da equipe" mede a adoção. Nenhuma ação destrutiva aqui. */}
        <div className="purchase-panel-views" role="tablist" aria-label="Vistas do painel de compras">
          {[["resumo","Resumo"],["analises","Análises"],["uso","Uso da equipe"]].map(([id,label])=><StandardButton variant="secondary" key={id} type="button" role="tab" aria-selected={vistaPainel===id} onClick={()=>setVistaPainel(id)}>{label}</StandardButton>)}
        </div>
        {vistaPainel==="uso"&&adocao?<AdoptionPanel model={adocao} nomeObra={id=>(data.obras||[]).find(o=>o.id===id)?.name||"Obra"}/>
        :vistaPainel==="resumo"?<>
        <section style={{display:"grid",gridTemplateColumns:cols(2,3,6),gap:"var(--arcd-space-2)"}}>
          {[
            ["Comprometido",fmt(mapaCompras.totalComprometido),`A faturar ${fmt(mapaCompras.totalAFaturar)}`,C.text],
            ["Pago",fmt(mapaCompras.totalPago),`${mapaCompras.totalComprometido?Math.min(100,Math.round(mapaCompras.totalPago/mapaCompras.totalComprometido*100)):0}% do compromisso`,C.blue],
            ["Recebido físico",fmt(mapaCompras.totalRecebido),`${mapaCompras.totalComprometido?Math.round(mapaCompras.totalRecebido/mapaCompras.totalComprometido*100):0}% entregue`,C.green],
            ["A pagar",fmt(mapaCompras.totalPendente),`${mapaCompras.fila.pagamentos} pedido(s)`,mapaCompras.totalPendente?C.red:C.green],
            ["Economia registrada",fmt(mapaCompras.economia),"Decisões de cotação",C.green],
            ["Qualidade dos dados",`${Math.round(mapaCompras.completude)}%`,"Base para decisões",mapaCompras.completude>=75?C.green:mapaCompras.completude>=50?C.orange:C.red],
          ].map(([l,v,d,c])=><div key={l} style={{padding:"var(--arcd-space-3)",background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderTop:`3px solid ${c}`,borderRadius:9,minWidth:0}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",letterSpacing:"var(--arcd-letter-spacing-body)"}}>{l}</p><b style={{display:"block",fontSize:"var(--arcd-type-card-title)",color:c,marginTop:"var(--arcd-space-1)",fontVariantNumeric:"tabular-nums",overflowWrap:"anywhere"}}>{v}</b><span style={{display:"block",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{d}</span></div>)}
        </section>
        <section style={{display:"grid",gridTemplateColumns:isDesktop?"minmax(0,1fr) minmax(0,1fr)":"1fr",gap:"var(--arcd-space-2)"}}>
          <div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:10,overflow:"hidden"}}><div style={{padding:"var(--arcd-space-3) var(--arcd-space-3)",borderBottom:"1px solid var(--arcd-border-default)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-danger-text)",textTransform:"uppercase"}}>Exceções para decidir agora</p><h4 style={{fontSize:"var(--arcd-type-body)",marginTop:"var(--arcd-space-half)"}}>{mapaCompras.alertas.length?`${mapaCompras.alertas.length} risco(s) ativo(s)`:"Operação sem exceções críticas"}</h4></div><div>{mapaCompras.alertas.length?mapaCompras.alertas.slice(0,8).map((a,i)=>{const cor=a.nivel==="critico"?C.red:a.nivel==="alto"?C.orange:C.yellowD;return <RecordAction key={`${a.titulo}-${i}`} onClick={()=>abrirExcecao(a)} style={{display:"grid",gridTemplateColumns:"8px 1fr auto",gap:"var(--arcd-space-2)",alignItems:"center",width:"100%",border:0,borderTop:i?"1px solid var(--arcd-border-default)":"none",background:"transparent",padding:"var(--arcd-space-2) var(--arcd-space-3)",textAlign:"left",cursor:"pointer"}}><i style={{width:8,height:8,borderRadius:99,background:cor}}/><span><b style={{display:"block",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)"}}>{a.titulo}</b><small style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{a.detalhe}</small></span><span style={{color:"var(--arcd-text-secondary)"}}>›</span></RecordAction>}):<p style={{padding:"var(--arcd-space-5)",textAlign:"center",fontSize:"var(--arcd-type-label)",color:"var(--arcd-success-text)"}}>Nenhuma exceção automática encontrada.</p>}</div></div>
          <div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"var(--arcd-space-3) var(--arcd-space-3)",borderBottom:"1px solid var(--arcd-border-default)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>Fluxo sob responsabilidade</p><h4 style={{fontSize:"var(--arcd-type-body)",marginTop:"var(--arcd-space-half)"}}>Onde o dinheiro e o material estão</h4></div>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(5,1fr)":"1fr 1fr"}}>
              {[
                [{area:"solicitacoes"},"Solicitações",mapaCompras.fila.solicitacoes,"Aguardam análise"],
                [{area:"cotacoes"},"Cotações",mapaCompras.fila.cotacoes,"Em concorrência"],
                [{area:"pedidos"},"Pedidos",mapaCompras.fila.pedidos,"Em fornecimento"],
                [{area:"financeiro",financeiro:"pendentes"},"Pagamentos",mapaCompras.fila.pagamentos,"Com saldo"],
                [{area:"pedidos",pedidos:{status:"a_receber"}},"Recebimentos",mapaCompras.fila.recebimentos,"Enviados, não entregues"],
              ].map(([filtro,l,v,d],i)=><StandardButton variant="secondary" key={l} onClick={()=>abrirExcecao({titulo:l,filtro})} style={{borderLeft:isDesktop&&i?"1px solid var(--arcd-border-default)":"none",borderTop:!isDesktop&&i>1?"1px solid var(--arcd-border-default)":"none",textAlign:"left"}}><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{l}</span><b style={{display:"block",fontSize:"var(--arcd-type-section-title)",color:v?"var(--arcd-warning-text)":"var(--arcd-success-text)",marginTop:"var(--arcd-space-half)"}}>{v}</b><small style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{d}</small></StandardButton>)}
            </div>
          </div>
        </section>
        {porObra&&porObra.linhas.length>1&&<PurchasesByWork model={porObra} titulo="Compras por obra" onOpenWork={id=>abrirObra(id,"fila")}/>}
        </>:<>
        <section className="purchase-dashboard-kanban">
          <div className="purchase-kanban-head">
            <div><p>Controle visual Andon</p><h3>Fluxo de compras e prazos</h3><span>Prioridades organizadas da necessidade ao recebimento, sem ocultar os indicadores gerenciais.</span></div>
            <div style={{display:"flex",gap:"var(--arcd-space-1)",flexWrap:"wrap"}}><div className="purchase-kanban-filters">
              {[["ativos","Fluxo ativo"],["criticos","Críticos"],["todos","Todos"]].map(([id,label])=><StandardButton variant="secondary" key={id} type="button" aria-pressed={filtroKanban===id} data-active={filtroKanban===id} onClick={()=>setFiltroKanban(id)}>{label}</StandardButton>)}
            </div><Btn size="sm" v="ghost" onClick={()=>irParaArea("kanban")}>Ampliar Kanban →</Btn></div>
          </div>
          <div className="purchase-andon-legend"><span><i style={{background:"var(--arcd-success-text)"}}/>No prazo</span><span><i style={{background:"var(--arcd-action-primary)"}}/>Até 3 dias</span><span><i style={{background:"var(--arcd-danger-text)"}}/>Atrasado</span><span><i style={{background:"var(--arcd-text-secondary)"}}/>Sem prazo</span></div>
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
                <div className="purchase-kanban-cards">{cards.slice(0,5).map(card=><RecordAction type="button" draggable className="purchase-kanban-card" key={`${card.tipo}-${card.id}`} style={{"--risk-color":card.risco.cor}}
                  onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/arcd-kanban",`${card.tipo}:${card.id}`);e.currentTarget.dataset.dragging="true";}}
                  onDragEnd={e=>{delete e.currentTarget.dataset.dragging;}}
                  onClick={()=>{
                  if(card.tipo==="solicitacao")setSolModal({...card.registro,itens:(card.registro.itens||[]).map(i=>({...i}))});
                  else if(card.tipo==="cotacao")setCotModal(formularioDaCotacao(card.registro));
                  else setPedModal({...card.registro,itens:(card.registro.itens||[]).map(i=>({...i}))});
                }}><div className="purchase-kanban-card-top"><span>{card.codigo}</span><b style={{color:card.risco.cor}}>{card.risco.rotulo}</b></div><h4>{card.titulo}</h4><p>{card.detalhe}</p><footer><span>{card.prazo?fmtDate(card.prazo):"Defina o prazo"}</span>{card.valor>0&&<strong>{fmtCompact(card.valor)}</strong>}</footer></RecordAction>)}
                  {!cards.length&&<div className="purchase-kanban-empty">Nenhum cartão</div>}{cards.length>5&&<StandardButton variant="secondary" className="purchase-kanban-more" onClick={()=>irParaArea("kanban")}>+ {cards.length-5} cartão(ões)</StandardButton>}
                </div>
              </section>;
            })}
          </div>
        </section>
        <section style={{display:"grid",gridTemplateColumns:isDesktop?"minmax(0,1fr) minmax(0,1fr)":"1fr",gap:"var(--arcd-space-2)"}}>
          <div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:10,padding:"var(--arcd-space-3) var(--arcd-space-3)"}}>
            <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>Maturidade do controle</p>
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"var(--arcd-space-3)",alignItems:"center",marginTop:"var(--arcd-space-2)"}}><div style={{width:68,height:68,borderRadius:"50%",display:"grid",placeItems:"center",background:`conic-gradient(${mapaCompras.completude>=75?C.green:C.yellow} ${mapaCompras.completude}%,var(--arcd-surface-muted) 0)`,position:"relative"}}><span style={{width:52,height:52,borderRadius:"50%",background:"var(--arcd-surface-card)",display:"grid",placeItems:"center",fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{Math.round(mapaCompras.completude)}%</span></div><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",lineHeight:"var(--arcd-line-height-normal)"}}>{mapaCompras.completude>=80?"Dados suficientes para decisões gerenciais consistentes.":mapaCompras.completude>=55?"A base já orienta decisões, mas ainda existem pontos cegos.":"A base é insuficiente para prever prazo, custo e risco com segurança."}</p></div>
            <div style={{marginTop:"var(--arcd-space-3)",display:"grid",gap:"var(--arcd-space-1)"}}>{[
              ["Cobertura por cotação",`${mapaCompras.coberturaCotacao.toFixed(0)}%`],
              ["Propostas por cotação",mapaCompras.concorrencia.toFixed(1)],
              ["Entregas no prazo",mapaCompras.pontualidade===null?"Sem base":`${mapaCompras.pontualidade.toFixed(0)}%`],
              ["Concentração top 3",`${mapaCompras.concentracaoTop3.toFixed(0)}%`],
            ].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",paddingTop:"var(--arcd-space-1)",borderTop:"1px solid var(--arcd-border-default)"}}><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{l}</span><b style={{fontSize:"var(--arcd-type-caption)"}}>{v}</b></div>)}</div>
          </div>
          <div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:10,overflow:"hidden"}}><div style={{padding:"var(--arcd-space-3) var(--arcd-space-3)",borderBottom:"1px solid var(--arcd-border-default)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",textTransform:"uppercase"}}>Dependência e poder de negociação</p><h4 style={{fontSize:"var(--arcd-type-body)",marginTop:"var(--arcd-space-half)"}}>Maiores fornecedores por volume</h4></div><div>{mapaCompras.fornecedores.slice(0,6).map((f,i)=><div key={f.id} style={{padding:"var(--arcd-space-2) var(--arcd-space-3)",borderTop:i?"1px solid var(--arcd-border-default)":"none"}}><div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)"}}><span style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{i+1}. {f.nome}</span><b style={{fontSize:"var(--arcd-type-label)"}}>{fmt(f.valor)} · {f.participacao.toFixed(0)}%</b></div><div style={{height:4,background:"var(--arcd-surface-muted)",borderRadius:99,marginTop:"var(--arcd-space-1)",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,f.participacao)}%`,background:i===0?"var(--arcd-action-primary)":"var(--arcd-action-primary)"}}/></div></div>)}{!mapaCompras.fornecedores.length&&<p style={{padding:"var(--arcd-space-5)",textAlign:"center",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Ainda não há pedidos suficientes.</p>}</div><StandardButton variant="secondary" onClick={()=>irParaArea("forn")} style={{width:"100%",borderTop:"1px solid var(--arcd-border-default)"}}>Abrir fornecedores →</StandardButton></div>
        </section>
        <section style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr":"1fr",gap:"var(--arcd-space-2)"}}>
          <div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:10,padding:"var(--arcd-space-3) var(--arcd-space-3)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>Origem real dos pagamentos</p><div style={{display:"grid",gap:"var(--arcd-space-2)",marginTop:"var(--arcd-space-2)"}}>{[["Empresa",mapaCompras.origens.empresa,C.blue],["Caixa das obras",mapaCompras.origens.caixa_obra,C.yellowD],["Cliente direto",mapaCompras.origens.cliente_direto,C.purple]].map(([l,v,c])=><div key={l} style={{display:"grid",gridTemplateColumns:"110px 1fr auto",gap:"var(--arcd-space-2)",alignItems:"center"}}><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{l}</span><div style={{height:6,background:"var(--arcd-surface-muted)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${mapaCompras.totalPago?Math.min(100,v/mapaCompras.totalPago*100):0}%`,background:c}}/></div><b style={{fontSize:"var(--arcd-type-caption)",color:c}}>{fmt(v)}</b></div>)}</div></div>
          <div style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:10,padding:"var(--arcd-space-3) var(--arcd-space-3)"}}><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",textTransform:"uppercase"}}>Veredicto gerencial</p><h4 style={{fontSize:"var(--arcd-type-body)",marginTop:"var(--arcd-space-half)"}}>{mapaCompras.completude>=80&&mapaCompras.alertas.length<=2?"Controle suficiente, com boa rastreabilidade":mapaCompras.completude>=55?"Controle operacional útil, ainda não completo":"Controle insuficiente para uma carteira de obras"}</h4><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",lineHeight:"var(--arcd-line-height-normal)",marginTop:"var(--arcd-space-1)"}}>Para o segmento de construção, o mapa precisa ligar necessidade da frente de serviço, orçamento SINAPI/ORSE, concorrência, frete, prazo prometido, qualidade recebida, pagamento, estoque e consumo. O sistema já cobre esse ciclo; os maiores ganhos agora vêm de preencher previsão, registrar ao menos três propostas e encerrar recebimentos com evidência.</p></div>
        </section>
        <section style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:10,overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)",flexWrap:"wrap",padding:"var(--arcd-space-3) var(--arcd-space-3)",borderBottom:"1px solid var(--arcd-border-default)"}}>
            <div><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>Controle dos pedidos</p><h4 style={{fontSize:"var(--arcd-type-body)",marginTop:"var(--arcd-space-half)"}}>{pedidosMapa.length} pedido(s) no escopo gerencial</h4></div>
            <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>Painel só de leitura: para editar, cancelar ou excluir, abra o pedido.</span>
          </div>
          {!pedidosMapa.length?<p style={{padding:"var(--arcd-space-5)",textAlign:"center",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Nenhum pedido de compra neste escopo.</p>:
          <div style={{maxHeight:360,overflowY:"auto"}}>
            {pedidosMapa.map((p,index)=>{
              const st=statusPedido(p),meta=STATUS_PEDIDO[st]||{l:st,c:C.muted};
              return <div key={p.id} style={{display:"grid",gridTemplateColumns:isDesktop?"110px minmax(190px,1fr) minmax(130px,.7fr) 110px auto":"1fr auto",gap:"var(--arcd-space-2)",alignItems:"center",padding:"var(--arcd-space-2) var(--arcd-space-3)",borderTop:index?"1px solid var(--arcd-border-default)":"none"}}>
                <div><b style={{display:"block",fontSize:"var(--arcd-type-label)",color:"var(--arcd-action-primary)"}}>{p.numero||"Sem número"}</b><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{fmtDate(p.data)}</span></div>
                <div style={{minWidth:0}}><b className="brk" style={{display:"block",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)"}}>{nomeForn(p.fornecedorId)}</b><span className="brk" style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"} · {(p.itens||[]).length} item(ns)</span></div>
                {isDesktop&&<div><Badge color={meta.c}>{meta.l}</Badge><span style={{display:"block",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{statusPagamentoPedido(p)==="pago"?"Pagamento concluído":`${fmt(saldoPagamentoPedido(p))} a pagar`}</span></div>}
                <b style={{fontSize:"var(--arcd-type-label)",textAlign:"right",whiteSpace:"nowrap"}}>{fmt(totalPedido(p))}</b>
                <Btn size="sm" v="ghost" onClick={()=>irParaPedidos(p.numero||"")} ariaLabel={`Abrir o pedido ${p.numero||""} na aba Pedidos`}>Abrir</Btn>
              </div>;
            })}
          </div>}
        </section>
        </>}
      </div>}

      {aba==="por_pagador"&&<div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
        {[["empresa","Empresa",C.blue],["caixa_obra","Caixa da obra",C.yellowD],["cliente_direto","Cliente direto",C.purple]].map(([id,label,cor])=>{
          const lista=pedidosPorPagador[id]||[];
          const total=lista.reduce((s,p)=>s+totalPedido(p),0);
          return <section key={id} style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderTop:`3px solid ${cor}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)",flexWrap:"wrap",padding:"var(--arcd-space-3) var(--arcd-space-3)",borderBottom:"1px solid var(--arcd-border-default)"}}>
              <div><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:cor,textTransform:"uppercase"}}>{label}</p><h4 style={{fontSize:"var(--arcd-type-body)",marginTop:"var(--arcd-space-half)"}}>{lista.length} pedido(s)</h4></div>
              <b style={{fontSize:"var(--arcd-type-card-title)",color:cor}}>{fmt(total)}</b>
            </div>
            {!lista.length?<p style={{padding:"var(--arcd-space-4)",textAlign:"center",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Nenhum pedido pago por {label.toLowerCase()}.</p>:
            <div style={{maxHeight:300,overflowY:"auto"}}>
              {lista.map((p,index)=>{
                const st=statusPedido(p),meta=STATUS_PEDIDO[st]||{l:st,c:C.muted};
                return <div key={p.id} style={{display:"grid",gridTemplateColumns:isDesktop?"110px minmax(190px,1fr) minmax(130px,.7fr) 110px":"1fr auto",gap:"var(--arcd-space-2)",alignItems:"center",padding:"var(--arcd-space-2) var(--arcd-space-3)",borderTop:index?"1px solid var(--arcd-border-default)":"none"}}>
                  <div><b style={{display:"block",fontSize:"var(--arcd-type-label)",color:"var(--arcd-action-primary)"}}>{p.numero||"Sem número"}</b><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{fmtDate(p.data)}</span></div>
                  <div style={{minWidth:0}}><b className="brk" style={{display:"block",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)"}}>{nomeForn(p.fornecedorId)}</b><span className="brk" style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"} · {(p.itens||[]).length} item(ns)</span></div>
                  {isDesktop&&<div><Badge color={meta.c}>{meta.l}</Badge><span style={{display:"block",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{statusPagamentoPedido(p)==="pago"?"Pagamento concluído":`${fmt(saldoPagamentoPedido(p))} a pagar`}</span></div>}
                  <b style={{fontSize:"var(--arcd-type-label)",textAlign:"right",whiteSpace:"nowrap"}}>{fmt(totalPedido(p))}</b>
                </div>;
              })}
            </div>}
          </section>;
        })}
      </div>}

      {aba==="financeiro"&&<>
        <section className="compras-finance-summary" style={{display:"grid",gridTemplateColumns:isDesktop?"minmax(180px,.8fr) repeat(3,minmax(120px,1fr))":"1fr 1fr",background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:8,overflow:"hidden"}}>
          <div style={{gridColumn:isDesktop?"auto":"1/-1",padding:"var(--arcd-space-3) var(--arcd-space-3)",background:resumoFinanceiro.aPagar?"color-mix(in srgb, var(--arcd-danger-text) 3%, transparent)":"var(--arcd-surface-muted)",borderRight:isDesktop?"1px solid var(--arcd-border-default)":"none",borderBottom:!isDesktop?"1px solid var(--arcd-border-default)":"none"}}><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)",textTransform:"uppercase"}}>Total a pagar</p><p style={{fontSize:"var(--arcd-type-section-title)",fontWeight:"var(--arcd-font-weight-semibold)",color:resumoFinanceiro.aPagar?"var(--arcd-danger-text)":"var(--arcd-text-primary)",marginTop:"var(--arcd-space-half)",fontVariantNumeric:"tabular-nums"}}>{fmt(resumoFinanceiro.aPagar)}</p></div>
          {[["Pedidos aguardando",resumoFinanceiro.pendentes,C.orange],["Liberados",resumoFinanceiro.liberados,C.green],["Sem conciliação",fmt(resumoFinanceiro.naoConciliado),resumoFinanceiro.naoConciliado?C.orange:C.muted]].map(([l,v,c],index)=><div key={l} style={{padding:"var(--arcd-space-3)",borderLeft:index||!isDesktop?"1px solid var(--arcd-border-default)":"none"}}><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{l}</p><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:c,marginTop:"var(--arcd-space-half)",fontVariantNumeric:"tabular-nums"}}>{v}</p></div>)}
        </section>
        <div className="compras-funding" style={{display:"grid",gridTemplateColumns:cols(1,3,3),gap:"var(--arcd-space-1)"}}>{[["Conta da empresa",resumoFinanceiro.empresa,C.blue],["Caixa da obra",resumoFinanceiro.caixaObra,C.yellowD],["Cliente direto",resumoFinanceiro.cliente,C.purple]].map(([l,v,c])=><div key={l} style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",padding:"var(--arcd-space-2) var(--arcd-space-2)",border:"1px solid var(--arcd-border-default)",borderRadius:8,background:"var(--arcd-surface-muted)"}}><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{l}</span><b style={{fontSize:"var(--arcd-type-label)",color:c}}>{fmt(v)}</b></div>)}</div>
        {obraTemCaixa&&<div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"center",flexWrap:"wrap",padding:"var(--arcd-space-2) var(--arcd-space-3)",border:`1px solid ${caixaPagamento.baixo?"var(--arcd-warning-text)":"var(--arcd-success-text)"}`,borderLeft:`1px solid ${caixaPagamento.baixo?"var(--arcd-warning-text)":"var(--arcd-success-text)"}`,borderRadius:9,background:caixaPagamento.baixo?"color-mix(in srgb, var(--arcd-warning-text) 4%, transparent)":"color-mix(in srgb, var(--arcd-success-text) 3%, transparent)"}}><div><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:caixaPagamento.baixo?"var(--arcd-warning-text)":"var(--arcd-success-text)",textTransform:"uppercase"}}>{caixaPagamento.baixo?"Alerta · caixa da obra baixo":"Caixa da obra disponível"}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Aportes {fmt(caixaPagamento.aportes)} · despesas {fmt(caixaPagamento.despesas)} · reserva recomendada {fmt(caixaPagamento.limiteBaixo)}</p></div><b style={{fontSize:"var(--arcd-type-card-title)",color:caixaPagamento.saldo>=0?"var(--arcd-success-text)":"var(--arcd-danger-text)"}}>{fmt(caixaPagamento.saldo)}</b></div>}
        <TabRow tabs={[["pendentes","Pendentes"],["liberados","Liberados"],["nao_conciliados","Sem conciliação"],["todos","Todos"]]} active={filtroFinanceiro} onChange={setFiltroFinanceiro}/>
        {pedidosFinanceiros.length===0?<div className="compras-empty" style={{padding:"var(--arcd-space-6)",textAlign:"center",border:"1px dashed var(--arcd-border-default)",borderRadius:12}}><Ic n="check" s={22} color={C.green}/><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-2)"}}>Nenhuma pendência neste filtro</p></div>:pedidosFinanceiros.map(p=>{const st=statusPagamentoPedido(p),saldo=saldoPagamentoPedido(p),recebido=statusPedido(p)==="recebido",cor=st==="pago"?C.green:st==="parcial"?C.orange:C.red;return <div className="compras-payment-card" data-status={st} key={p.id} style={{background:"var(--arcd-surface-card)",border:`1px solid ${cor}55`,borderRadius:10,padding:"var(--arcd-space-3) var(--arcd-space-3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"flex-start",flexWrap:"wrap"}}><div style={{minWidth:0}}><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{p.numero} · {nomeForn(p.fornecedorId)}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{(p.itens||[]).map(i=>`${nomeMat(i.materialId)} (${Number(i.qtd||0).toLocaleString("pt-BR")} ${purchaseUnitOf(i)})`).join(" · ")}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>Pedido {fmtDate(p.data)}{p.previsao?` · entrega prevista ${fmtDate(p.previsao)}`:""}</p></div><div style={{textAlign:"right"}}><Badge color={cor}>{st==="pago"?"QUITADO / LIBERADO":st==="parcial"?"PAGAMENTO PARCIAL":"AGUARDANDO PAGAMENTO"}</Badge><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-1)"}}>{fmt(totalPedido(p))}</p>{saldo>0&&<p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-danger-text)"}}>saldo {fmt(saldo)}</p>}</div></div>
          {(p.pagamentos||[]).length>0&&<div style={{display:"flex",gap:"var(--arcd-space-1)",flexWrap:"wrap",marginTop:"var(--arcd-space-2)"}}>{p.pagamentos.map(pg=><div key={pg.id} style={{display:"inline-flex",alignItems:"center",gap:"var(--arcd-space-1)",fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:pg.conciliado?"var(--arcd-success-text)":"var(--arcd-warning-text)",background:pg.conciliado?"color-mix(in srgb, var(--arcd-success-text) 5%, transparent)":"color-mix(in srgb, var(--arcd-warning-text) 5%, transparent)",border:`1px solid ${pg.conciliado?"var(--arcd-success-text)":"var(--arcd-warning-text)"}44`,borderRadius:99,padding:"var(--arcd-space-half) var(--arcd-space-1) var(--arcd-space-half) var(--arcd-space-2)"}}><span>{fmt(pg.valor)} · {origemPagamentoLabel(pg.origem)} · {pg.conciliado?"conciliado":"a conciliar"}</span>{(pg.comprovantes||[]).map(a=><a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{color:"var(--arcd-action-primary)",textDecoration:"underline",fontWeight:"var(--arcd-font-weight-semibold)"}} title={a.legenda||a.nome}>comprovante ↗</a>)}{canManagePurchases(currentUser?.role)&&<StandardButton variant="secondary" type="button" onClick={()=>excluirPagamento(p,pg)} title="Excluir pagamento" aria-label={`Excluir pagamento de ${fmt(pg.valor)}`} style={{display:"inline-grid",placeItems:"center",width:20,height:20}}><Ic n="trash" s={10}/></StandardButton>}</div>)}</div>}
          {recebido&&st!=="pago"&&<p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-danger-text)",marginTop:"var(--arcd-space-2)"}}>Registro legado: material recebido sem quitação vinculada. Regularize o financeiro para encerrar a inconsistência.</p>}
          <div style={{display:"flex",gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-2)",flexWrap:"wrap"}}>{saldo>0&&canManagePurchases(currentUser?.role)&&<Btn size="sm" onClick={()=>abrirPagamento(p)}>Registrar pagamento</Btn>}{st==="pago"&&!recebido&&<Btn size="sm" v="success" onClick={()=>setRecModal(p)}><Ic n="check"/> Receber na obra</Btn>}<Btn size="sm" v="ghost" onClick={()=>irParaPedidos(p.numero)}>Abrir pedido</Btn>{podeExcluirCompra&&<Btn size="sm" v="danger" onClick={()=>abrirExclusaoCompra(p)}><Ic n="trash"/> Excluir compra</Btn>}</div>
        </div>})}
      </>}

      {aba==="solicitacoes"&&<>
        <Btn onClick={abrirNovaSolicitacao} full><Ic n="plus"/> SOLICITAR MATERIAIS PARA A OBRA</Btn>
        <div style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",lineHeight:"var(--arcd-line-height-normal)"}}>A Engenharia pode selecionar insumos SINAPI/ORSE ou criar itens próprios. Solicitações enviadas acendem o alerta de Compras até serem colocadas em análise.</p></div>

        {/* Consolidação multi-obra: mesmo material, obras diferentes, mesma janela.
            Comprar junto é o único jeito de ter volume com 11 obras rodando. */}
        {consolidar.length>0&&(
          <div style={{background:"color-mix(in srgb, var(--arcd-action-primary) 5%, transparent)",border:"1.5px solid var(--arcd-action-primary)",borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)"}}>
              {consolidar.length} MATERIAL(IS) PEDIDO(S) POR MAIS DE UMA OBRA
            </p>
            <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)",lineHeight:"var(--arcd-line-height-normal)"}}>
              Solicitações abertas dos últimos 10 dias. Comprar junto dá volume para negociar; a entrega continua separada por obra.
            </p>
            <div style={{marginTop:"var(--arcd-space-2)"}}>
              {consolidar.slice(0,5).map((c,ix)=>(
                <div key={ix} style={{borderTop:"1px solid var(--arcd-border-default)",paddingTop:"var(--arcd-space-1)",marginTop:"var(--arcd-space-1)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"baseline"}}>
                    <p className="brk" style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",minWidth:0}}>{c.descricao}</p>
                    <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",whiteSpace:"nowrap",flexShrink:0}}>
                      {c.total.toLocaleString("pt-BR")} {c.unidade}
                    </p>
                  </div>
                  {c.obras.map(o=>(
                    <p key={o.obraId} style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-0)"}}>
                      {o.obraNome}: {o.qtd.toLocaleString("pt-BR")} {c.unidade} <span style={{color:"var(--arcd-text-muted)"}}>({o.solicitacoes.join(", ")})</span>
                    </p>
                  ))}
                </div>
              ))}
              {consolidar.length>5&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-muted)",marginTop:"var(--arcd-space-1)"}}>e mais {consolidar.length-5} material(is)...</p>}
            </div>
            <div style={{marginTop:"var(--arcd-space-2)"}}>
              <Btn size="sm" v="info" full onClick={()=>setCotWpp({
                titulo:`Cotação consolidada · ${consolidar.length} material(is)`,
                itens:consolidar.map(c=>({descricao:c.descricao,qtd:Number(c.total.toFixed(2)),unidade:c.unidade})),
                obraNome:"", prazo:"",
              })}><Ic n="cart"/> COTAR VOLUME CONSOLIDADO</Btn>
            </div>
          </div>
        )}
        {!solicitacoes.length?<p style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-5)"}}>Nenhuma solicitação para esta obra.</p>:solicitacoes.map(sol=>{
          const status={enviada:{l:"NOVA · AGUARDANDO COMPRAS",c:C.orange},em_analise:{l:"EM ANÁLISE",c:C.blue},pedido_gerado:{l:"PEDIDO GERADO",c:C.green},cancelada:{l:"CANCELADA",c:C.red}}[sol.status]||{l:sol.status,c:C.muted};
          const pedido=pedidoPorId.get(sol.pedidoId);
          const sla=slaSolicitacao(sol,today());
          const corBorda=sla&&sla.status==="estourado"?C.red:status.c;
          const instanciaApr=instanciaAprovacaoDe(sol);
          const etapasApr=etapasPendentesParaMim(instanciaApr);
          const aprCor={aprovada:C.green,reprovada:C.red,bloqueada:C.orange,em_andamento:C.blue}[instanciaApr?.status];
          const aprRotulo={aprovada:"APROVADA",reprovada:"REPROVADA",bloqueada:"AGUARDANDO CONFIGURAÇÃO",em_andamento:"AGUARDANDO APROVAÇÃO"}[instanciaApr?.status];
          return <div id={`purchase-record-${sol.id}`} tabIndex={-1} data-purchase-highlight={registroFoco===sol.id} key={sol.id} style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderLeft:`1px solid ${corBorda}`,borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"flex-start"}}><div><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{sol.numero}{sol.prioridade==="urgente"&&<span style={{color:"var(--arcd-danger-text)"}}> · URGENTE</span>}</p><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Solicitado por {sol.solicitanteNome||"Solicitante não informado"} · {sol.criadoEm?new Date(sol.criadoEm).toLocaleString("pt-BR"):""}{sol.necessidade?` · necessário em ${fmtDate(sol.necessidade)}`:""}</p></div><div style={{textAlign:"right",flexShrink:0}}><Badge color={status.c}>{status.l}</Badge>
              {instanciaApr&&instanciaApr.status!=="aprovada"&&<div style={{marginTop:"var(--arcd-space-half)"}}><Badge color={aprCor}>{aprRotulo}</Badge></div>}
              {sla&&<div style={{marginTop:"var(--arcd-space-half)"}}><Badge color={sla.status==="estourado"?C.red:sla.status==="no_limite"?C.orange:C.muted}>
                {sla.status==="estourado"?`SLA ESTOURADO · ${sla.dias}d (limite ${sla.limite}d)`:sla.status==="no_limite"?`ÚLTIMO DIA DO SLA`:`${sla.dias}d de ${sla.limite}d`}
              </Badge></div>}
            </div></div>
            {etapasApr.length>0&&<div style={{marginTop:"var(--arcd-space-2)",background:"color-mix(in srgb, var(--arcd-action-primary) 5%, transparent)",border:"1px solid color-mix(in srgb, var(--arcd-action-primary) 27%, transparent)",borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}>
              <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)"}}>Aguardando sua aprovação · {etapasApr[0].etapa.nome}</p>
              <div style={{display:"flex",gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-1)"}}>
                <Btn size="sm" onClick={()=>decidirAprovacao(instanciaApr,etapasApr[0].etapa.id,"aprovado")}><Ic n="check"/> Aprovar</Btn>
                <Btn size="sm" v="danger" onClick={()=>{const motivo=window.prompt("Motivo da reprovação:");if(motivo)decidirAprovacao(instanciaApr,etapasApr[0].etapa.id,"reprovado",motivo);}}>Reprovar</Btn>
              </div>
            </div>}
            <div style={{marginTop:"var(--arcd-space-2)",borderTop:"1px solid var(--arcd-border-default)",paddingTop:"var(--arcd-space-1)"}}>{sol.itens.map(item=><div key={item.id} style={{display:"grid",gridTemplateColumns:isDesktop?"95px minmax(0,1fr) auto auto":"78px minmax(0,1fr) auto",gap:"var(--arcd-space-2)",fontSize:"var(--arcd-type-label)",marginTop:"var(--arcd-space-1)",alignItems:"center"}}><b style={{color:item.fonteRef==="ORSE"?"var(--arcd-action-primary)":item.fonteRef==="PRÓPRIO"?"var(--arcd-warning-text)":"var(--arcd-action-primary)"}}>{item.fonteRef} {item.codigoRef}</b><span style={{color:"var(--arcd-text-secondary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={item.descricaoRef}>{item.descricaoRef}</span><b style={{color:"var(--arcd-text-primary)",whiteSpace:"nowrap"}}>{Number(item.quantidade||0).toLocaleString("pt-BR")} {purchaseUnitOf(item)}{purchaseUnitOf(item)!==String(item.unidadeRef||"").toUpperCase()?<small style={{display:"block",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{referenceQuantityOf(item).toLocaleString("pt-BR",{maximumFractionDigits:4})} {item.unidadeRef}</small>:null}</b>{podeProcessar&&["enviada","em_analise"].includes(sol.status)&&<Btn size="sm" v="ghost" onClick={()=>abrirCotacaoDaSolicitacao(sol,item)}>COTAR</Btn>}</div>)}{podeProcessar&&["enviada","em_analise"].includes(sol.status)&&sol.itens.length>1&&<div style={{marginTop:"var(--arcd-space-2)"}}><Btn size="sm" onClick={()=>abrirCotacaoDaSolicitacao(sol)}>COTAR TODOS OS ITENS ({sol.itens.length})</Btn></div>}</div>
            {sol.observacao&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-2)"}}>{sol.observacao}</p>}
            {sol.contatos?.length>0&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-success-text)",fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-2)"}}>
              Enviado para {sol.contatos.length} fornecedor(es): {sol.contatos.map(c=>c.fornecedorNome).filter(Boolean).join(", ")}
            </p>}
            {pedido&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-success-text)",fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-2)"}}>Vinculada ao pedido {pedido.numero}</p>}
            <MessageRequestSource source={sol.origemMensagem}/>
            <PurchaseRecordFlow data={data} type="request" record={sol} onOpen={abrirVinculoCompra}/>
            <div style={{display:"flex",gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-2)",flexWrap:"wrap"}}>
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
              {sol.status!=="pedido_gerado"&&sol.status!=="cancelada"&&(podeProcessar||sol.solicitanteId===currentUser?.id)&&<Btn size="sm" v="danger" onClick={()=>cancelarSolicitacao(sol)}>CANCELAR</Btn>}
            </div>
          </div>;
        })}
      </>}

      {/* HISTÓRICO DE COMPRAS — consulta e correção com trilha de auditoria */}
      {aba === "historico_compras" && (<>
        <div style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderLeft:"1px solid var(--arcd-action-primary)",borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
          <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>Tudo o que foi comprado, em uma única linha do tempo</p>
          <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)",lineHeight:"var(--arcd-line-height-normal)"}}>Consulte itens, fornecedor, pagamento e recebimento. Ajustes exigem justificativa e ficam registrados no próprio pedido.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:pick("1fr","minmax(220px,1.4fr) 1fr","minmax(260px,1.5fr) 190px 190px 190px"),gap:"var(--arcd-space-2)",alignItems:"end"}}>
          <Inp label="Buscar" value={buscaHistoricoCompra} onChange={setBuscaHistoricoCompra} placeholder="Pedido, material, fornecedor ou obra..."/>
          <Sel label="Situação" value={statusHistoricoCompra} onChange={setStatusHistoricoCompra} options={[
            {v:"todos",l:"Todas as situações"},{v:"enviado",l:"Aguardando entrega"},{v:"parcial",l:"Recebido parcialmente"},
            {v:"recebido",l:"Recebido"},{v:"cancelado",l:"Cancelado"},{v:"rascunho",l:"Rascunho"},
          ]}/>
          <Sel label="Fornecedor" value={fornecedorHistoricoCompra} onChange={setFornecedorHistoricoCompra} options={[{v:"",l:"Todos os fornecedores"},...fornecedores.map(f=>({v:f.id,l:f.nome}))]}/>
          <Sel label="Período" value={periodoHistorico} onChange={setPeriodoHistorico} options={[["6","Últimos 6 meses"],["12","Últimos 12 meses"],["24","Últimos 24 meses"],["todos","Todo o histórico"]].map(([v,l])=>({v,l}))}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)",flexWrap:"wrap"}}>
          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}><b style={{color:"var(--arcd-text-primary)"}}>{comprasHistoricoFiltradas.length}</b> compra(s) · total <b style={{color:"var(--arcd-text-primary)"}}>{fmt(comprasHistoricoFiltradas.reduce((s,p)=>s+totalPedido(p),0))}</b> · empresa <b style={{color:"var(--arcd-action-primary)"}}>{fmt(comprasHistoricoFiltradas.reduce((s,p)=>s+(p.pagamentos||[]).filter(pg=>pg.origem==="empresa").reduce((a,pg)=>a+Number(pg.valor||0),0),0))}</b> · caixa das obras <b style={{color:"var(--arcd-action-primary)"}}>{fmt(comprasHistoricoFiltradas.reduce((s,p)=>s+(p.pagamentos||[]).filter(pg=>pg.origem==="caixa_obra").reduce((a,pg)=>a+Number(pg.valor||0),0),0))}</b> · cliente direto <b style={{color:"var(--arcd-action-primary)"}}>{fmt(comprasHistoricoFiltradas.reduce((s,p)=>s+(p.pagamentos||[]).filter(pg=>pg.origem==="cliente_direto").reduce((a,pg)=>a+Number(pg.valor||0),0),0))}</b></p>
          {!obraIdFixo&&<div style={{display:"flex",padding:"var(--arcd-space-half)",background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:7}}>{[["obra","Obra atual"],["todas","Todas visíveis"]].map(([v,l])=><StandardButton variant="secondary" key={v} aria-pressed={escopoHistorico===v} onClick={()=>setEscopoHistorico(v)} style={{}}>{l}</StandardButton>)}</div>}
        </div>
        {!comprasHistoricoFiltradas.length?<div style={{padding:"var(--arcd-space-6)",textAlign:"center",background:"var(--arcd-surface-card)",border:"1px dashed var(--arcd-border-default)",borderRadius:8}}><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>Nenhuma compra encontrada</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Altere os filtros ou amplie o período.</p></div>:
          <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
            {comprasHistoricoFiltradas.map(p=>{
              const st=statusPedido(p),meta=STATUS_PEDIDO[st]||{l:st,c:C.muted};
              const pagoEmpresa=(p.pagamentos||[]).filter(pg=>pg.origem==="empresa").reduce((s,pg)=>s+Number(pg.valor||0),0);
              const pagoCaixa=(p.pagamentos||[]).filter(pg=>pg.origem==="caixa_obra").reduce((s,pg)=>s+Number(pg.valor||0),0);
              const pagoCliente=(p.pagamentos||[]).filter(pg=>pg.origem==="cliente_direto").reduce((s,pg)=>s+Number(pg.valor||0),0);
              const recebido=(p.itens||[]).reduce((s,i)=>s+Number(i.qtdRecebida||0)*Number(i.precoUnit||0),0);
              const ultimoAjuste=(p.ajustes||[]).slice(-1)[0];
              return <article key={p.id} style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderLeft:`1px solid ${meta.c}`,borderRadius:7,padding:"var(--arcd-space-3) var(--arcd-space-3)"}}>
                <div style={{display:"grid",gridTemplateColumns:pick("1fr auto","1fr auto","100px minmax(170px,1.2fr) 115px auto"),gap:"var(--arcd-space-2)",alignItems:"center"}}>
                  <div><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)"}}>{p.numero}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{fmtDate(p.data)}</p></div>
                  {pick(null,<div><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{nomeForn(p.fornecedorId)}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"}</p></div>,<div><p className="brk" style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{nomeForn(p.fornecedorId)}</p><p className="brk" style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"} · {(p.itens||[]).length} item(ns)</p></div>)}
                  {pick(null,null,<div><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>Recebido na obra</p><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{fmt(recebido)}</p></div>)}
                  <div style={{textAlign:"right"}}><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{fmt(totalPedido(p))}</p><Badge color={meta.c}>{meta.l}</Badge></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:cols(1,3,3),gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-2)"}}>
                  {[
                    ["empresa","Pago pela empresa",pagoEmpresa,C.blue],
                    ["caixa_obra","Pago pelo caixa da obra",pagoCaixa,C.yellowD],
                    ["cliente_direto","Pago diretamente pelo cliente",pagoCliente,C.purple],
                  ].map(([origem,label,totalOrigem,cor])=><div key={origem}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=cor;}}
                    onDragLeave={e=>{e.currentTarget.style.borderColor=`${cor}45`;}}
                    onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor=`${cor}45`;const pagamentoId=e.dataTransfer.getData("text/arcd-pagamento");if(pagamentoId)reclassificarOrigemPagamento(p,pagamentoId,origem);}}
                    style={{minHeight:76,padding:"var(--arcd-space-2) var(--arcd-space-2)",border:`1px dashed ${cor}45`,background:`${cor}07`,borderRadius:5,transition:"border-color .15s,background .15s"}}>
                    <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>{label}</span>
                    <b style={{display:"block",fontSize:"var(--arcd-type-body)",color:cor,marginTop:"var(--arcd-space-half)"}}>{fmt(totalOrigem)}</b>
                    <div style={{display:"flex",gap:"var(--arcd-space-1)",flexWrap:"wrap",marginTop:"var(--arcd-space-1)"}}>
                      {(p.pagamentos||[]).filter(pg=>pg.origem===origem).map(pg=><StandardButton variant="secondary" type="button" draggable key={pg.id}
                        onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/arcd-pagamento",pg.id);}}
                        title="Arraste para outra coluna para corrigir a origem"
                        style={{}}>
                        ⋮⋮ {fmt(pg.valor)} · {fmtDate(pg.data)}
                      </StandardButton>)}
                      {!(p.pagamentos||[]).some(pg=>pg.origem===origem)&&<small style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>Arraste um pagamento para cá</small>}
                    </div>
                  </div>)}
                </div>
                <div style={{marginTop:"var(--arcd-space-2)",paddingTop:"var(--arcd-space-2)",borderTop:"1px solid var(--arcd-border-default)",display:"flex",flexDirection:"column",gap:"var(--arcd-space-1)"}}>
                  {(p.itens||[]).map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",fontSize:"var(--arcd-type-caption)"}}><span className="brk" style={{color:"var(--arcd-text-secondary)"}}>{nomeMat(i.materialId)} · {Number(i.qtd)} {purchaseUnitOf(i)} × {fmt(Number(i.precoUnit||0))}</span><b style={{color:"var(--arcd-text-primary)",whiteSpace:"nowrap"}}>{fmt(Number(i.qtd||0)*Number(i.precoUnit||0))}</b></div>)}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"var(--arcd-space-2)",flexWrap:"wrap",marginTop:"var(--arcd-space-2)"}}>
                  <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{ultimoAjuste?`Último ajuste: ${ultimoAjuste.usuario||"Operador"} · ${new Date(ultimoAjuste.criadoEm).toLocaleString("pt-BR")} · ${ultimoAjuste.motivo}`:"Sem ajustes registrados"}</p>
                  <div style={{display:"flex",gap:"var(--arcd-space-1)",flexWrap:"wrap"}}>
                    <Button variant="secondary" onClick={()=>setFichaCompra({pedidoId:p.id})}>Ficha completa · notas e anexos</Button>
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
          <div className="purchase-delivery-attention" role="status"><div><strong>{quantityLabel(atrasados.length,'pedido')} com entrega atrasada</strong><p>{atrasados.slice(0,3).map(x=>[x.pedido.numero,nomeForn(x.pedido.fornecedorId),quantityLabel(x.diasAtraso,'dia')].join(" · ")).join(" · ")}</p></div><Button variant="outline" size="sm" aria-pressed={filtroPedidos.atrasados} onClick={()=>patchFiltroPedidos({atrasados:!filtroPedidos.atrasados})}>{filtroPedidos.atrasados?"Mostrar todos os pedidos":"Ver só os atrasados"}</Button></div>
        )}
        <div className="purchase-order-toolbar"><Inp label="Buscar pedidos" value={busca} onChange={setBusca} placeholder="Pedido, material, fornecedor ou obra…"/>


        {pedidos.length>0&&(
          <div className="purchase-order-filters" role="group" aria-label="Filtros de pedidos"><WorkspaceFilters activeCount={[filtroPedidos.status!=="todos",Boolean(filtroPedidos.fornecedorId),Boolean(filtroPedidos.obraId),filtroPedidos.atrasados,Array.isArray(filtroPedidos.ids)].filter(Boolean).length}>
            <Select label="Situação" value={filtroPedidos.status} onChange={e=>patchFiltroPedidos({status:e.target.value})}
              options={OPCOES_STATUS_PEDIDO.map(o=>({value:o.value,label:o.value==="todos"?`${o.label} (${contagemPedidos.todos})`:`${o.label} (${contagemPedidos[o.value]||0})`}))}/>
            <Select label="Fornecedor" value={filtroPedidos.fornecedorId} onChange={e=>patchFiltroPedidos({fornecedorId:e.target.value})}
              options={[{value:"",label:"Todos os fornecedores"},...fornecedoresDosPedidos]}/>
            {obrasDosPedidos.length>1&&<Select label="Obra" value={filtroPedidos.obraId} onChange={e=>patchFiltroPedidos({obraId:e.target.value})}
              options={[{value:"",label:"Todas as obras"},...obrasDosPedidos]}/>}
            <label className="purchase-order-filters__toggle"><ChoiceControl type="checkbox" checked={filtroPedidos.atrasados} onChange={e=>patchFiltroPedidos({atrasados:e.target.checked})}/> Só entregas atrasadas ({qtdAtrasadosNaLista})</label>
            {filtrosPedidosAtivos(filtroPedidos)&&<Button variant="ghost" onClick={()=>setFiltroPedidos(FILTROS_PEDIDOS_VAZIOS)}>Limpar filtros</Button>}
          </WorkspaceFilters></div>
        )}
        </div>
        {pedidos.length>0&&<div className="purchase-order-count-row">
          <p className="purchase-order-count" role="status">{pedidosVisiveis.length} de {quantityLabel(pedidos.length,'pedido')}</p>
          {botaoExportar("pedidos",[planilhaPedidos(data,pedidosVisiveis),planilhaItensDosPedidos(data,pedidosVisiveis),planilhaNotas(data,pedidosVisiveis)],
            `Exportar para Excel os ${pedidosVisiveis.length} pedido(s) da lista, com itens e notas`)}
        </div>}
        {Array.isArray(filtroPedidos.ids)&&<p className="purchase-order-origin" role="note">
          Mostrando os pedidos de <strong>{filtroPedidos.origem||"um recorte selecionado"}</strong>.
          <Button variant="ghost" size="sm" onClick={()=>patchFiltroPedidos({ids:null,origem:""})}>Ver todos os pedidos</Button></p>}

        {pedidos.length === 0
          ? <p style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-5)"}}>Nenhum pedido nesta obra.</p>
          : pedidosVisiveis.length === 0
          ? <p style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-5)"}}>Nenhum pedido com estes filtros.</p>
          : pedidosVisiveis.map(p => {
            const st = statusPedido(p);
            const meta = STATUS_PEDIDO[st];
            const pend = pendentePedido(p);
            return (
              <article id={`purchase-record-${p.id}`} tabIndex={-1} data-purchase-highlight={registroFoco===p.id} key={p.id} aria-label={`Pedido ${p.numero}`} style={{
                background:"var(--arcd-surface-card)", border:"1px solid var(--arcd-border-default)",
                borderLeft:`1px solid ${meta.c}`, borderRadius:6, padding:"var(--arcd-space-2) var(--arcd-space-3)",
              }}>
                <div className="fluid-grid" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"var(--arcd-space-2)"}}>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",
                               fontFamily:"var(--arcd-font-sans)"}}>{p.numero}</p>
                    <p className="brk" style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>
                      {nomeForn(p.fornecedorId)}
                    </p>
                    <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-0)"}}>
                      {fmtDate(p.data)} · {quantityLabel(p.itens.length,'item','itens')}
                      {p.previsao && `  entrega ${fmtDate(p.previsao)}`}
                    </p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <Badge color={meta.c}>{meta.l}</Badge>
                    <div style={{marginTop:"var(--arcd-space-half)"}}><Badge color={statusPagamentoPedido(p)==="pago"?C.green:C.orange}>{statusPagamentoPedido(p)==="pago"?`PAGO · ${origemPagamentoLabel(p.origemPagamento)}`:`PREVISTO · ${origemPagamentoLabel(p.origemPagamento)}`}</Badge></div>
                    {atrasoDe[p.id]&&<div style={{marginTop:"var(--arcd-space-half)"}}><Badge color={C.red}>ATRASADO +{atrasoDe[p.id].diasAtraso}d</Badge></div>}
                    {p.aceiteFornecedor?.nome
                      ?<div style={{marginTop:"var(--arcd-space-half)"}}><Badge color={C.green}>ACEITO · {p.aceiteFornecedor.nome} · {fmtDate(p.aceiteFornecedor.data)}</Badge></div>
                      :(p.envios||[]).length>0&&<div style={{marginTop:"var(--arcd-space-half)"}}><Badge color={C.orange}>ENVIADO · AGUARDANDO ACEITE</Badge></div>}
                    <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-1)",whiteSpace:"nowrap"}}>
                      {fmt(totalPedido(p))}
                    </p>
                    {pend > 0.01 && st !== "rascunho" && st !== "cancelado" && (
                      <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-warning-text)",marginTop:"var(--arcd-space-0)"}}>
                        A receber em materiais: {fmt(pend)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Itens */}
                <div style={{marginTop:"var(--arcd-space-2)",paddingTop:"var(--arcd-space-2)",borderTop:"1px solid var(--arcd-border-default)"}}>
                  {p.itens.map(i => {
                    const completo = Number(i.qtdRecebida) >= Number(i.qtd) - 1e-6;
                    return (
                      <div key={i.id} style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",
                                              fontSize:"var(--arcd-type-label)",marginTop:"var(--arcd-space-half)",alignItems:"baseline"}}>
                        <span className="brk" style={{color:"var(--arcd-text-secondary)",minWidth:0}}>
                          {nomeMat(i.materialId)}
                          {!i.orcNivel1Id&&!i.orcItemId && linhasOrc.length > 0 && (
                            <span style={{color:"var(--arcd-warning-text)",fontSize:"var(--arcd-type-caption)"}}>  sem apropriação</span>
                          )}
                          {referencePricePerPurchaseUnit(i)>0&&(Number(i.precoUnit)>0?(()=>{const ref=referencePricePerPurchaseUnit(i),dif=Number(i.precoUnit)-ref,pct=dif/ref*100,cor=dif<=0?C.green:C.red;return <span style={{display:"block",fontSize:"var(--arcd-type-caption)",color:cor,fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-0)"}}>{i.fonteRef} {i.codigoRef} · compra {fmt(Number(i.precoUnit))} · ref. {fmt(ref)}/{purchaseUnitOf(i)} · {dif<=0?"abaixo":"acima"} {Math.abs(pct).toLocaleString("pt-BR",{maximumFractionDigits:2})}%</span>;})():<span style={{display:"block",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-0)"}}>{i.fonteRef} {i.codigoRef} · ref. {fmt(referencePricePerPurchaseUnit(i))}/{purchaseUnitOf(i)} · preço de compra não informado</span>)}
                        </span>
                        <span style={{whiteSpace:"nowrap",flexShrink:0,textAlign:"right",
                                      color: completo ? "var(--arcd-success-text)" : "var(--arcd-text-primary)", fontWeight:"var(--arcd-font-weight-semibold)"}}>
                          {i.qtdRecebida > 0 && `${i.qtdRecebida}/`}{i.qtd} {purchaseUnitOf(i)}
                          {completo && " ok"}
                          {/* C2.2: atraso e próxima entrega do item */}
                          {!completo&&(st==="enviado"||st==="parcial")&&(()=>{const a=atrasoDoItem(i,p,today());
                            if(a.atrasada)return <small style={{display:"block",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-danger-text)",fontWeight:"var(--arcd-font-weight-semibold)"}}>atrasado {a.diasAtraso}d · {a.atrasada.toLocaleString("pt-BR")} {purchaseUnitOf(i)}</small>;
                            return a.proximaData?<small style={{display:"block",fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",fontWeight:"var(--arcd-font-weight-semibold)"}}>entrega {fmtDate(a.proximaData)}</small>:null;})()}
                        </span>
                      </div>
                    );
                  })}
	                </div>
                <PurchaseRecordFlow data={data} type="order" record={p} onOpen={abrirVinculoCompra}/>
                {p.analiseIA&&<div style={{marginTop:"var(--arcd-space-2)",padding:"var(--arcd-space-2) var(--arcd-space-2)",background:"color-mix(in srgb, var(--arcd-action-primary) 3%, transparent)",border:"1px solid color-mix(in srgb, var(--arcd-action-primary) 18%, transparent)",borderRadius:7,display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-action-primary)",fontWeight:"var(--arcd-font-weight-semibold)"}}><Ic n="brain" s={11}/> Sugestão da IA revisada por {p.analiseIA.revisadoPor||"operador"} · confiança {Number(p.analiseIA.confianca||0)}%</span><span>{(p.documentos||[]).map(a=><a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-action-primary)",marginLeft:"var(--arcd-space-2)"}}>{a.nome} ↗</a>)}</span></div>}

                {(() => {
                  const forn = fornecedorPorId.get(p.fornecedorId);
                  const telefone = forn?.telefone;
                  const acoes = acoesDoPedido({
                    pedido:p, podeEnviar:podeEnviarPedido, podeExcluir:podeExcluirCompra,
                    atrasado:!!atrasoDe[p.id], temTelefone:!!telefone, temSaldoEmAberto:saldoPagamentoPedido(p)>.01,
                  });
                  const obra = obraPorId.get(p.obraId);
                  const hrefs = !telefone ? {} : {
                    cobrar: atrasoDe[p.id] ? linkWhatsApp(telefone, mensagemWhatsAppCobranca({
                      empresa:"MARCELL", fornecedorNome:forn.nome, obraNome:obra?.name||"", numero:p.numero,
                      previsao:fmtDate(p.previsao), diasAtraso:atrasoDe[p.id].diasAtraso, itens:atrasoDe[p.id].itensPendentes,
                    })) : "",
                    whatsapp: linkWhatsApp(telefone, mensagemWhatsAppCompra({
                      empresa:"MARCELL", fornecedorNome:forn.nome, obraNome:obra?.name||"", prazo:p.previsao?fmtDate(p.previsao):"",
                      itens:(p.itens||[]).map(i => { const mat=materialPorId.get(i.materialId); return { descricao:mat?.descricao||"Material", qtd:i.qtd, unidade:mat?.unidade||"" }; }),
                    })),
                  };
                  const comuns = acoes.comuns.map(a => ({
                    ...a, href:hrefs[a.id]||undefined,
                    label:a.id==="saldo" ? `${a.label} · ${fmt(saldoPagamentoPedido(p))}` : a.label,
                  }));
                  return (
                    <div className="purchase-order-actions">
                      {acoes.principal && <Btn className="purchase-order-primary" onClick={()=>executarAcaoPedido(p, acoes.principal.id)}>
                        <Ic n={acoes.principal.id==="receber"?"check":"edit"}/> {acoes.principal.label}
                      </Btn>}
                      <Button className="purchase-order-reference" variant="secondary" onClick={()=>setFichaCompra({pedidoId:p.id})}>Ficha completa · notas e anexos</Button>
                      <OrderActionMenu label={`Mais ações do pedido ${p.numero}`} comuns={comuns} destrutivas={acoes.destrutivas}
                        busy={cancelandoCompra} onSelect={id=>executarAcaoPedido(p, id)}/>
                    </div>
                  );
                })()}
              </article>
            );
          })}
      </>)}

      {/*  ORÇADO x COMPRADO  */}
      {aba === "orcado" && todasObras && porObra?.linhas.length>0 && <div className="purchase-export-row">
        {botaoExportar("orcado",[planilhaOrcadoPorObra(porObra)],"Exportar para Excel o orçado × comprometido das obras")}</div>}
      {aba === "orcado" && !todasObras && orcVs.orc && <div className="purchase-export-row">
        {botaoExportar("orcado",[planilhaOrcadoComprado(orcVs,(obras||[]).find(o=>o.id===obraAtual)?.name||"")],"Exportar para Excel o orçado × comprometido da obra")}</div>}
      {aba === "orcado" && (
        todasObras ? (
          porObra&&porObra.linhas.length
            ? <PurchasesByWork model={porObra} titulo="Orçado × comprado por obra" onOpenWork={id=>abrirObra(id,"orcado")}
                legenda="Compare as obras e abra uma para ver o detalhe por etapa do orçamento. Ordenado por risco."/>
            : <p style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-5)",lineHeight:"var(--arcd-line-height-normal)"}}>Nenhuma obra disponível para comparar.</p>
        ) : !orcVs.orc ? (
          <p role="status" style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-5)",lineHeight:"var(--arcd-line-height-normal)"}}>
            <strong style={{color:"var(--arcd-text-primary)"}}>{motivoSemControle(orcVs).label}.</strong><br/>
            {motivoSemControle(orcVs).dica}
          </p>
        ) : (<>
          <div style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
            <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",lineHeight:"var(--arcd-line-height-normal)"}}>
              Comparação em <strong style={{color:"var(--arcd-text-primary)"}}>reais</strong>, não em quantidade: o
              orçamento fala em serviço (m de alvenaria), a compra fala em material (saco de
              cimento). O orçado é o <strong style={{color:"var(--arcd-text-primary)"}}>custo</strong>, sem BDI -
              BDI é sua margem, não entra no que você paga ao fornecedor.
            </p>
          </div>

          {/* Total */}
          {(() => {
            const totOrc  = orcVs.linhas.reduce((s,l) => s + l.orcado, 0);
            const totComp = orcVs.linhas.reduce((s,l) => s + l.comprometido, 0);
            const totRec  = orcVs.linhas.reduce((s,l) => s + l.recebido, 0);
            const pct = totOrc ? (totComp/totOrc)*100 : 0;
            return (
              <div style={{background:"var(--arcd-surface-card)",border:"1.5px solid var(--arcd-action-primary)",
                           borderRadius:6,padding:"var(--arcd-space-3) var(--arcd-space-3)"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"var(--arcd-space-2)"}}>
                  {[["Orçado",fmt(totOrc),C.text],["Comprometido",fmt(totComp),C.blue],["Recebido",fmt(totRec),C.purple],
                    ["Saldo",fmt(totOrc-totComp), totComp > totOrc ? C.red : C.green]].map(([l,v,c])=>(
                    <div key={l}>
                      <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:"var(--arcd-font-weight-semibold)"}}>{l}</p>
                      <p style={{fontSize:"var(--arcd-type-card-title)",fontWeight:"var(--arcd-font-weight-semibold)",color:c,
                                 whiteSpace:"nowrap",fontFamily:"var(--arcd-font-sans)"}}>{v}</p>
                    </div>
                  ))}
                </div>
                {(()=>{const barra=segmentosBarraOrcamento(pct);return(
                  <div style={{marginTop:"var(--arcd-space-2)",height:6,background:"var(--arcd-border-default)",borderRadius:99,overflow:"hidden",display:"flex"}}>
                    <div style={{height:"100%",width:`${barra.dentro}%`,background:pct>100?"var(--arcd-text-secondary)":"var(--arcd-action-primary)"}}/>
                    {barra.excesso>0&&<div style={{height:"100%",width:`${barra.excesso}%`,background:"var(--arcd-danger-text)"}}/>}
                  </div>
                );})()}
                <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>
                  {pct.toFixed(1)}% do orçamento comprometido em pedidos enviados
                </p>
              </div>
            );
          })()}

          {/* Compras sem apropriação - o número que denuncia */}
          {orcVs.semApropriacao > 0.01 && (
            <div style={{background:"color-mix(in srgb, var(--arcd-warning-text) 5%, transparent)",border:"1.5px solid var(--arcd-warning-text)",
                         borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)"}}>
              <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-warning-text)"}}>
                {fmt(orcVs.semApropriacao)} comprado sem apropriação
              </p>
              <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)",lineHeight:"var(--arcd-line-height-normal)"}}>
                Dinheiro gasto que não bate com nenhuma linha do orçamento. Ou faltou apontar
                o item no pedido, ou o orçamento não previu esse gasto - e nos dois casos vale
                descobrir qual.
              </p>
            </div>
          )}

          {/* Linhas */}
          {orcVs.linhas.length > 1 && (
            <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>
              Etapas em ordem de risco: primeiro as que estouraram, depois as que passaram de 90%, sempre o maior percentual antes. Na barra, o trecho vermelho é o que passou do orçado.
            </p>
          )}
          {orcVs.linhas.map(l => {
            const cor = l.alerta==="estourou" ? C.red : l.alerta==="atencao" ? C.orange : C.green;
            return (
              <div key={l.it.id} className="orc-etapa" data-alerta={l.alerta} style={{
                background:"var(--arcd-surface-card)", border:"1px solid var(--arcd-border-default)",
                borderLeft:`1px solid ${cor}`, borderRadius:6, padding:"var(--arcd-space-2) var(--arcd-space-3)",
              }}>
                <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",
                           fontWeight:"var(--arcd-font-weight-semibold)",letterSpacing:"var(--arcd-letter-spacing-body)"}}>{l.etapa}</p>
                <p className="brk" style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-half)"}}>
                  {l.it.descricao || l.it.codigo}
                </p>

                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(105px,1fr))",gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-2)"}}>
                  {[["Orçado",l.orcado,C.muted],["Comprometido",l.comprometido,C.text],["Recebido",l.recebido,C.purple],
                    ["Saldo",l.saldo,cor]].map(([lb,v,c])=>(
                    <div key={lb}>
                      <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:"var(--arcd-font-weight-semibold)"}}>{lb}</p>
                      <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:c,whiteSpace:"nowrap"}}>{fmt(v)}</p>
                    </div>
                  ))}
                </div>

                {(()=>{const barra=segmentosBarraOrcamento(l.pct);return(
                  <div className="orc-barra" role="img"
                       aria-label={l.orcado>0?`${l.pct.toFixed(0)}% do orçado comprometido`:"Comprometido sem orçamento na etapa"}
                       style={{position:"relative",marginTop:"var(--arcd-space-2)",height:5,background:"var(--arcd-border-default)",borderRadius:99,overflow:"hidden",display:"flex"}}>
                    <div data-segmento="dentro" style={{height:"100%",width:`${barra.dentro}%`,background:l.alerta==="estourou"?"var(--arcd-text-secondary)":cor}}/>
                    {barra.excesso>0&&<div data-segmento="excesso" style={{height:"100%",width:`${barra.excesso}%`,background:"var(--arcd-danger-text)"}}/>}
                  </div>
                );})()}

                {l.estourou && (
                  <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-danger-text)",marginTop:"var(--arcd-space-1)",fontWeight:"var(--arcd-font-weight-semibold)"}}>
                     Estourou {fmt(l.comprometido - l.orcado)}{l.orcado>0?` (${(l.pct-100).toFixed(0)}% acima)`:" sem orçamento na etapa"}
                  </p>
                )}
                {l.alerta==="atencao" && (
                  <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-warning-text)",marginTop:"var(--arcd-space-1)",fontWeight:"var(--arcd-font-weight-semibold)"}}>
                    Atenção: {l.pct.toFixed(0)}% do orçado já comprometido
                  </p>
                )}
                {l.alerta==="ok" && l.comprometido > 0 && (
                  <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-1)"}}>
                    {l.pct.toFixed(0)}% comprometido
                  </p>
                )}
                {l.previsto > 0.01 && (
                  <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>
                    + {fmt(l.previsto)} em pedidos ainda em rascunho
                  </p>
                )}
                {l.pedidos.length > 0 && (
                  <details style={{marginTop:"var(--arcd-space-1)"}}>
                    <summary style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-action-primary)",cursor:"pointer",fontWeight:"var(--arcd-font-weight-semibold)"}}>
                      Ver {l.pedidos.length===1?"o pedido":`os ${l.pedidos.length} pedidos`} desta etapa
                    </summary>
                    <ul style={{listStyle:"none",margin:"var(--arcd-space-1) var(--arcd-space-0) var(--arcd-space-0)",padding:0,display:"grid",gap:"var(--arcd-space-1)"}}>
                      {l.pedidos.map(item=>{
                        const pedido=pedidoPorIdOrc.get(item.id);
                        const st=pedido?statusPedido(pedido):item.status;
                        const meta=STATUS_PEDIDO[st]||{l:st||"-",c:C.muted};
                        return (
                          <li key={item.id} style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",flexWrap:"wrap",
                                                    fontSize:"var(--arcd-type-label)",borderTop:"1px solid var(--arcd-border-default)",paddingTop:"var(--arcd-space-1)"}}>
                            <span className="brk" style={{color:"var(--arcd-text-primary)",minWidth:0}}>
                              <strong>{item.numero||"Sem número"}</strong> · {nomeForn(item.fornecedorId)}
                              <span style={{color:meta.c}}> · {meta.l}</span>
                              {item.rascunho&&<span style={{color:"var(--arcd-text-secondary)"}}> (não comprometido)</span>}
                            </span>
                            <strong style={{color:"var(--arcd-text-primary)",whiteSpace:"nowrap"}}>{fmt(item.valor)}</strong>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </>)
      )}

      {/*  COTAÇÕES  */}
      {aba === "cotacoes" && (<>
        <div className="purchase-quote-filters">
          <Inp label="Buscar" value={buscaCotacao} onChange={setBuscaCotacao} placeholder="Código, insumo, solicitação ou fornecedor..."/>
          <WorkspaceFilters activeCount={[inicioCotacao,fimCotacao].filter(Boolean).length}>
            <Inp label="Data inicial" type="date" value={inicioCotacao} onChange={setInicioCotacao}/>
            <Inp label="Data final" type="date" value={fimCotacao} onChange={setFimCotacao}/>
            <Btn size="sm" v="ghost" onClick={()=>{setBuscaCotacao("");setInicioCotacao("");setFimCotacao("");setStatusCotacao("todas");}}>Limpar filtros</Btn>
          </WorkspaceFilters>
        </div>

        <div className="purchase-quote-status"><Select label="Situação da cotação" value={statusCotacao} onChange={event=>setStatusCotacao(event.target.value)} options={[
          {value:'todas',label:`Todas (${cotacoes.length})`},
          {value:'aberta',label:`Em decisão (${cotacoes.filter(c=>c.status==='aberta').length})`},
          {value:'decidida',label:`Decisão concluída (${cotacoes.filter(c=>c.status==='decidida').length})`},
        ]}/><p role="status">{quantityLabel(cotacoesFiltradas.length,'cotação','cotações')} neste recorte. Itens sem decisão continuam na cotação.</p></div>
        {registroFoco===cotacaoExpandida&&cotacoes.some(c=>c.id===registroFoco)&&!cotacoesFiltradas.some(c=>c.id===registroFoco)&&<div className="purchase-flow-return" role="status"><p>A cotação de origem está fora dos filtros atuais. O recorte foi preservado.</p><Button variant="secondary" onClick={()=>{const id=registroFoco;setBuscaCotacao('');setStatusCotacao('todas');setInicioCotacao('');setFimCotacao('');setRegistroFoco('');requestAnimationFrame(()=>setRegistroFoco(id));}}>Mostrar cotação de origem</Button></div>}

        <SupplierResponseQueue quotes={cotacoesFiltradas} data={data} onOpen={id=>{setCotacaoExpandida(id);requestAnimationFrame(()=>{const row=document.getElementById(`purchase-record-${id}`);row?.scrollIntoView({block:"start"});row?.focus({preventScroll:true});});}}/>
        {!cotacoesFiltradas.length
          ? <div style={{padding:"var(--arcd-space-8)",textAlign:"center",border:"1px dashed var(--arcd-border-default)",borderRadius:9,background:"var(--arcd-surface-card)"}}><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>Nenhuma cotação encontrada</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Ajuste os filtros ou adicione uma nova cotação.</p></div>
          : <div className="purchase-quotes-list" style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:9,overflow:"auto"}}>
            {isDesktop&&<div className="purchase-quotes-list__header" style={{display:"grid",gridTemplateColumns:"90px minmax(220px,1.5fr) 100px 115px 105px 100px 132px",gap:"var(--arcd-space-2)",padding:"var(--arcd-space-2) var(--arcd-space-3)",background:"var(--arcd-surface-muted)",borderBottom:"1px solid var(--arcd-border-default)",fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}><span>Código</span><span>Insumo</span><span>Fornecedores</span><span>Necessidade</span><span>Status</span><span>Prioridade</span><span>Ações</span></div>}
            {cotacoesFiltradas.map((c,index)=>{
              const ord=c.propostas||[],mapa=mapaDaCotacao(c),multi=cotacaoMultiItens(c),pendentes=mapa.linhas.filter(l=>!l.decisao).length;
              const sol=solicitacaoPorId.get(c.solicitacaoId),expandida=cotacaoExpandida===c.id;
              const codigo=c.numero||`CT-${String(cotacoes.indexOf(c)+1).padStart(4,"0")}`;
              const prioridade=sol?.prioridade||"normal";
              const rotuloCotacao=c.status==="cancelada"?"Cancelada":c.status==="decidida"?"Decisão concluída":(c.respostasFornecedor||[]).some(r=>r.status==="pendente")?"Revisar resposta":Object.keys(decisoesDaCotacao(c)).length&&pendentes?"Decisão parcial":ord.length?"Em decisão":"Sem propostas";
              return <div id={`purchase-record-${c.id}`} tabIndex={-1} data-purchase-highlight={registroFoco===c.id} key={c.id} style={{borderTop:index?"1px solid var(--arcd-border-default)":"none"}}>
                <div className="purchase-quote-row" style={{display:"grid",gridTemplateColumns:isDesktop?"90px minmax(220px,1.5fr) 100px 115px 105px 100px 132px":"1fr auto",gap:"var(--arcd-space-2)",width:"100%",alignItems:"center",padding:isDesktop?"11px":"12px",border:0,background:expandida?"color-mix(in srgb, var(--arcd-action-primary) 2%, transparent)":"transparent",textAlign:"left"}}>
                  {isDesktop&&<b style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-action-primary)"}}>{codigo}</b>}
                  <Button variant="ghost" className="purchase-quote-open" aria-label={`${expandida?"Recolher análise":"Comparar propostas"} · ${codigo}`} aria-expanded={expandida} aria-controls={expandida?`quote-comparison-${c.id}`:undefined} onClick={()=>setCotacaoExpandida(expandida?"":c.id)}>
                    <b className="brk">{multi?`${mapa.linhas.length} ${mapa.linhas.length===1?"item":"itens"} · ${nomeMat(c.materialId)}${mapa.linhas.length>1?" e outros":""}`:nomeMat(c.materialId)}</b>
                    <span>{multi?`${mapa.linhas.length-pendentes} de ${mapa.linhas.length} decidido(s)`:`${Number(c.qtd||0).toLocaleString("pt-BR")} ${unidMat(c.materialId)}`}{sol?.numero?` · ${sol.numero}`:""}{!isDesktop?` · ${codigo}`:""}</span>
                    <span>{expandida?"Recolher análise":"Comparar propostas"}</span>
                  </Button>
                  {isDesktop&&<span style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)"}}>{ord.length}</span>}
                  {isDesktop&&<span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{fmtDate(sol?.necessidade||c.data)}</span>}
                  {isDesktop&&<Badge color={c.status==="decidida"?C.green:C.blue}>{rotuloCotacao}</Badge>}
                  {isDesktop&&<span style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:prioridade==="urgente"?"var(--arcd-danger-text)":"var(--arcd-warning-text)"}}>{prioridade==="urgente"?"Alta":"Média"}</span>}
                  <div className="purchase-quote-actions">{podeProcessar&&<OrderActionMenu label={`Mais ações da cotação ${codigo}`} destrutivas={[{id:"excluir",label:"Excluir cotação"}]} onSelect={()=>excluirCotacao(c)}/>}</div>
                </div>
                {!isDesktop&&<div style={{display:"flex",gap:"var(--arcd-space-1)",padding:"var(--arcd-space-0) var(--arcd-space-3) var(--arcd-space-2)",flexWrap:"wrap"}}><Badge color={c.status==="decidida"?C.green:C.blue}>{rotuloCotacao}</Badge><Badge color={prioridade==="urgente"?C.red:C.orange}>{prioridade==="urgente"?"Alta":"Média"}</Badge><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",alignSelf:"center"}}>{ord.length} fornecedor(es) · {fmtDate(sol?.necessidade||c.data)}</span></div>}
                <PurchaseRecordFlow data={data} type="quote" record={c} onOpen={abrirVinculoCompra}/>
                {expandida&&<div id={`quote-comparison-${c.id}`} style={{padding:"var(--arcd-space-0) var(--arcd-space-3) var(--arcd-space-3)",background:"var(--arcd-surface-muted)",borderTop:"1px solid var(--arcd-border-default)"}}>
                  <QuoteComparisonWorkspace quote={c} data={data} canManage={podeProcessar}
                    actions={podeProcessar&&c.status==="aberta"&&pendentes>0?<Btn v="success" onClick={()=>setCotDecisao({cotacaoId:c.id,escolhas:sugestaoDeEscolhas(c),justificativas:{}})}>Decidir e gerar pedidos</Btn>:null} dispatchCommand={dispatchCommand} currentUser={currentUser}
                    supplierRating={id=>textoNotaFornecedor(avaliacaoForn.get(String(id)))}
                    onOpenOrder={pedidoId=>setFichaCompra({pedidoId})}
                    documents={ord.map(p=><div key={p.id} className="purchase-quote-documents"><b>Documentos · {nomeForn(p.fornecedorId)}</b><LinksDocumentosAuditaveis documentos={p.documentos||[]} subindo={subindoAnexoCotacao&&anexoCotacao?.cotacao?.id===c.id&&anexoCotacao?.proposta?.id===p.id} onSelecionar={e=>selecionarDocumentoCotacao(c,p,e)} C={C}/></div>)}/>
                  <Button variant="secondary" onClick={()=>setFichaCompra({cotacaoId:c.id})}>Ficha da compra conjunta · notas e anexos</Button>
                  <div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"center",flexWrap:"wrap",marginTop:"var(--arcd-space-2)"}}>
                    <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{c.economia>0?`Economia registrada: ${fmt(c.economia||0)}`:"Escolha a proposta de cada item considerando preço, prazo e documentação."}</span>
                    <div style={{display:"flex",gap:"var(--arcd-space-1)",flexWrap:"wrap"}}>
                      {podeProcessar&&c.status==="aberta"&&<Btn size="sm" v="ghost" onClick={()=>setCotModal(formularioDaCotacao(c))}>Editar mapa</Btn>}
                      {podeProcessar&&c.status==="aberta"&&pendentes>0&&<Btn size="sm" v="success" onClick={()=>setCotDecisao({cotacaoId:c.id,escolhas:sugestaoDeEscolhas(c),justificativas:{}})}>Decidir e gerar pedidos</Btn>}
                      {podeProcessar&&<Btn size="sm" v="danger" onClick={()=>excluirCotacao(c)}><Ic n="trash"/> Excluir cotação</Btn>}
                    </div>
                  </div>
                </div>}
              </div>;
            })}
          </div>}
      </>)}

      {/*  FORNECEDORES  */}
      {aba === "contratos" && <PurchaseContractsWorkspace key={obraIdsMapa.join("|")} data={data} update={update} dispatchCommand={dispatchCommand} currentUser={currentUser} showToast={showToast} C={C} workIds={obraIdsMapa} onOpenOrder={pedidoId=>setFichaCompra({pedidoId})}/>}

      {aba === "forn" && (<>
        <Btn onClick={()=>setFornModal({id:"",nome:"",nomeFantasia:"",razaoSocial:"",cnpj:"",contato:"",telefone:"",email:"",categorias:[],atividadeCnae:"",situacaoCadastral:"",dataAbertura:"",cep:"",endereco:"",numero:"",complemento:"",bairro:"",cidade:"",uf:"",obs:""})} full>
          <Ic n="plus"/> Novo fornecedor
        </Btn>
        {fornecedores.length === 0
          ? <p style={{fontSize:"var(--arcd-type-body)",color:"var(--arcd-text-secondary)",textAlign:"center",padding:"var(--arcd-space-5)"}}>Nenhum fornecedor.</p>
          : fornecedores.map(f => (
            <div key={f.id} onClick={()=>setFornModal(f)} style={{background:"var(--arcd-surface-card)",
              border:"1px solid var(--arcd-border-default)",borderRadius:6,padding:"var(--arcd-space-2) var(--arcd-space-3)",cursor:"pointer"}}>
              <p className="brk" style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{f.nome}</p>
              <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>
                {[f.cnpj, f.contato, f.telefone].filter(Boolean).join(" · ") || "sem contato"}
              </p>
              {(f.cidade || f.bairro) && (
                <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>
                  {[f.bairro, f.cidade, f.uf].filter(Boolean).join(", ")}
                </p>
              )}
              {(f.categorias||[]).length > 0 && (
                <div style={{display:"flex",flexWrap:"wrap",gap:"var(--arcd-space-1)",marginTop:"var(--arcd-space-1)"}}>
                  {(f.categorias||[]).slice(0,5).map(c=>(
                    <span key={c} style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)",
                          background:"color-mix(in srgb, var(--arcd-action-primary) 9%, transparent)",padding:"var(--arcd-space-half) var(--arcd-space-2)",borderRadius:99}}>
                      {rotuloRamo(c)}
                    </span>
                  ))}
                  {(f.categorias||[]).length > 5 && (
                    <span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",padding:"var(--arcd-space-half) var(--arcd-space-1)"}}>
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
        <div style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:10,padding:"var(--arcd-space-3) var(--arcd-space-3)"}}>
          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",lineHeight:"var(--arcd-line-height-normal)"}}><strong style={{color:"var(--arcd-text-primary)"}}>Memória comercial auditável.</strong> Consulte tudo o que foi pedido, recebido, em quais obras e quais insumos cada fornecedor entregou. Pedidos cancelados não entram nos indicadores.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:pick("1fr","1fr 180px","1fr 190px 210px"),gap:"var(--arcd-space-2)",alignItems:"end"}}>
          <Inp label="Buscar fornecedor" value={buscaFornecedorHistorico} onChange={setBuscaFornecedorHistorico} placeholder="Nome ou CNPJ..."/>
          <Sel label="Período" value={periodoHistorico} onChange={setPeriodoHistorico} options={[["6","Últimos 6 meses"],["12","Últimos 12 meses"],["24","Últimos 24 meses"],["todos","Todo o histórico"]].map(([v,l])=>({v,l}))}/>
          {!obraIdFixo&&<div><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",marginBottom:"var(--arcd-space-1)"}}>Abrangência</p><div style={{display:"flex",padding:"var(--arcd-space-half)",background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:8}}>{[["obra","Obra atual"],["todas","Todas visíveis"]].map(([v,l])=><StandardButton variant="secondary" key={v} aria-pressed={escopoHistorico===v} onClick={()=>setEscopoHistorico(v)} style={{flex:1}}>{l}</StandardButton>)}</div></div>}
        </div>
        {resumoFornecedoresHistorico.length===0?<div style={{padding:"var(--arcd-space-6)",textAlign:"center",background:"var(--arcd-surface-card)",border:"1px dashed var(--arcd-border-default)",borderRadius:12}}><Ic n="box" s={22} color={C.muted}/><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-2)"}}>Nenhuma compra encontrada</p><p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Ajuste o período, a obra ou o termo pesquisado.</p></div>:
        <div style={{display:"grid",gridTemplateColumns:pick("1fr","minmax(230px,.8fr) minmax(0,1.2fr)","minmax(270px,.72fr) minmax(0,1.55fr)"),gap:"var(--arcd-space-2)",alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-1)",maxHeight:570,overflowY:"auto",paddingRight:"var(--arcd-space-half)"}}>
            {resumoFornecedoresHistorico.map((r,idx)=>{const ativo=r.fornecedorId===fornecedorHistoricoAtualId;return <StandardButton variant="secondary" key={r.fornecedorId} aria-pressed={ativo} onClick={()=>setFornecedorHistoricoId(r.fornecedorId)} style={{width:"100%",textAlign:"left",borderLeft:`1px solid ${ativo?"var(--arcd-action-primary)":"var(--arcd-border-default)"}`}}><div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"flex-start"}}><div style={{minWidth:0}}><p className="brk" style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{r.fornecedor?.nome||"Fornecedor não cadastrado"}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{r.pedidos} pedido(s) · {r.obras.size} obra(s) · {r.materiais.size} insumo(s)</p></div><span style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:idx<3?"var(--arcd-action-primary)":"var(--arcd-text-secondary)"}}>#{idx+1}</span></div><div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",marginTop:"var(--arcd-space-2)",paddingTop:"var(--arcd-space-2)",borderTop:"1px solid var(--arcd-border-default)"}}><span style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>Recebido</span><b style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)"}}>{fmt(r.recebido)}</b></div></StandardButton>})}
          </div>
          {resumoFornecedorAtual&&<div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)",minWidth:0}}>
            <div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:12,padding:"var(--arcd-space-3) var(--arcd-space-3)"}}><div style={{display:"flex",justifyContent:"space-between",gap:"var(--arcd-space-2)",alignItems:"flex-start",flexWrap:"wrap"}}><div><p style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",letterSpacing:"var(--arcd-letter-spacing-body)",textTransform:"uppercase",color:"var(--arcd-action-primary)"}}>Fornecedor selecionado</p><h3 style={{fontSize:"var(--arcd-type-card-title)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-half)"}}>{resumoFornecedorAtual.fornecedor?.nome||"Fornecedor não cadastrado"}</h3><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{[resumoFornecedorAtual.fornecedor?.cnpj,resumoFornecedorAtual.fornecedor?.telefone,resumoFornecedorAtual.fornecedor?.cidade].filter(Boolean).join(" · ")||"Dados cadastrais não informados"}</p></div><Badge color={C.blue}>Última compra {fmtDate(resumoFornecedorAtual.ultima)}</Badge></div><div style={{display:"grid",gridTemplateColumns:cols(2,2,4),gap:"var(--arcd-space-2)",marginTop:"var(--arcd-space-3)"}}>{[["Total pedido",fmt(resumoFornecedorAtual.comprado),C.text],["Total recebido",fmt(resumoFornecedorAtual.recebido),C.green],["Pedidos",resumoFornecedorAtual.pedidos,C.blue],["Insumos",resumoFornecedorAtual.materiais.size,C.yellowD]].map(([l,v,c])=><div key={l} style={{background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:8,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:"var(--arcd-font-weight-semibold)"}}>{l}</p><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:c,marginTop:"var(--arcd-space-half)"}}>{v}</p></div>)}</div></div>
            {comprasMensaisFornecedor.length>0&&<ChartPanel eyebrow="Evolução das compras" title="Volume mensal com o fornecedor" subtitle="Pedido emitido versus material efetivamente recebido" height={205} legend={[{label:"Pedido",color:C.yellow},{label:"Recebido",color:C.green}]}><ResponsiveContainer width="100%" height="100%"><BarChart data={comprasMensaisFornecedor} barGap={3} barSize={13}><CartesianGrid stroke={C.line} vertical={false}/><XAxis dataKey="rotulo" tick={{fill:C.muted,fontSize:"var(--arcd-type-caption)"}} axisLine={false} tickLine={false}/><YAxis tick={{fill:C.muted,fontSize:"var(--arcd-type-caption)"}} axisLine={false} tickLine={false} tickFormatter={compactNumber}/><Tooltip cursor={{fill:`${C.yellow}08`}} content={<ArcdChartTooltip formatter={v=>fmt(v)}/>}/><Bar dataKey="comprado" name="Pedido" fill={C.yellow} radius={[4,4,1,1]}/><Bar dataKey="recebido" name="Recebido" fill={C.green} radius={[4,4,1,1]}/></BarChart></ResponsiveContainer></ChartPanel>}
            <div style={{background:"var(--arcd-surface-card)",border:"1px solid var(--arcd-border-default)",borderRadius:12,overflow:"hidden"}}><div style={{padding:"var(--arcd-space-3) var(--arcd-space-3)",borderBottom:"1px solid var(--arcd-border-default)"}}><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>Pedidos do fornecedor</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>Clique em Pedidos para editar ou receber uma compra.</p></div><div style={{maxHeight:310,overflowY:"auto"}}>{pedidosFornecedorAtual.map(p=><div key={p.id} style={{display:"grid",gridTemplateColumns:pick("1fr auto","1fr auto","100px minmax(120px,1fr) 120px 100px"),gap:"var(--arcd-space-2)",alignItems:"center",padding:"var(--arcd-space-2) var(--arcd-space-3)",borderTop:"1px solid var(--arcd-border-default)"}}><div><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-action-primary)"}}>{p.numero}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{fmtDate(p.data)}</p></div>{pick(null,null,<div><p className="brk" style={{fontSize:"var(--arcd-type-caption)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{obraPorId.get(p.obraId)?.name||"Obra não informada"}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{(p.itens||[]).length} item(ns)</p></div>)}{pick(null,null,<div><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase"}}>Recebido</p><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-success-text)",marginTop:"var(--arcd-space-half)"}}>{fmt(recebidoPedido(p))}</p></div>)}<div style={{textAlign:"right"}}><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{fmt(totalPedido(p))}</p><Badge color={statusPedido(p)==="recebido"?C.green:statusPedido(p)==="parcial"?C.orange:C.blue}>{statusPedido(p)}</Badge></div></div>)}</div></div>
          </div>}
        </div>}
      </>)}

      {aba === "precos" && <MaterialPriceHistory data={data} works={obras} currentWorkId={obraAtual} onOpen={pedidoId=>setFichaCompra({pedidoId})}/>}

      <DreIntegration kind="purchases" currentUser={currentUser} {...escopoDre}>
        <label>Competência do DRE<StandardInput type="month" value={competenciaDre} onChange={event=>{if(event.target.value)setCompetenciaDre(event.target.value);}}/></label>
        <p>Este mês é usado na consulta ao DRE. Os registros de compras mantêm os próprios filtros de prazo e histórico.</p>
      </DreIntegration>

      {/*  MODAIS  */}
      {modoIA&&<ModoIADocumento modulo="compras" data={data} update={update} showToast={showToast} currentUser={currentUser} obraIdInicial={obraAtual} onClose={()=>setModoIA(false)}/>}
      {cotWpp&&<ModalCotacaoWhatsApp titulo={cotWpp.titulo} itens={cotWpp.itens} obraNome={cotWpp.obraNome} prazo={cotWpp.prazo}
        fornecedores={fornecedores} pedidos={data.pedidos} materiais={data.materiais} data={data} onClose={()=>setCotWpp(null)}
        onContato={(fornecedorId,fornecedorNome)=>registrarContatoSolicitacao(cotWpp.solicitacaoId,fornecedorId,fornecedorNome)}/>}
      {solModal&&<ModalSolicitacaoCompra form={solModal} setForm={setSolModal} onSave={salvarSolicitacao} save={save} basesReferencia={basesCompra} obras={obras.filter(o=>!currentUser?.obraId||o.id===currentUser.obraId)} data={data} update={update} showToast={showToast}/>}
      {fornModal && <FornecedorEditorPilot form={fornModal} setForm={setFornModal} onSave={salvarForn}/>}
      {pedModal  && <ModalPedido     form={pedModal}  setForm={setPedModal}  onSave={salvarPedido}
                                     fornecedores={fornecedores} materiais={materiais}
                                     linhasOrc={niveisUmOrcamento(getPlanningBudget(data,pedModal.obraId).budget)} data={data} basesReferencia={basesCompra} save={save}/>}
      {fichaCompra&&<PurchaseDossier data={data} selection={fichaCompra} currentUser={currentUser} onClose={()=>setFichaCompra(null)}/>}
      {cotModal  && <ModalCotacao    form={cotModal}  setForm={setCotModal}  onSave={salvarCotacao}
                                     fornecedores={fornecedores} materiais={materiais} linhasOrc={niveisUmOrcamento(getPlanningBudget(data,cotModal.obraId).budget)} save={save} obraNome={obraPorId.get(cotModal.obraId)?.name}/>}
      <ModalLegendaDocumento anexo={anexoCotacao} setAnexo={setAnexoCotacao} onClose={()=>!subindoAnexoCotacao&&setAnexoCotacao(null)} onSalvar={salvarDocumentoCotacao} salvando={subindoAnexoCotacao} titulo="Anexar documento da cotação" C={C}/>
      {envioPedido&&(()=>{const p=(data.pedidos||[]).find(x=>x.id===envioPedido.id)||envioPedido;const link=linkAceite?.pedidoId===p.id?linkAceite:null;const {forn,texto,assunto}=conteudoEnvioPedido(p,link?.url||"");
        return <Modal title={`Enviar pedido ${p.numero}`} onClose={()=>{setEnvioPedido(null);setLinkAceite(null);}} wide><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Escolha o canal. O envio fica registrado no pedido com data e autor; o aceite do fornecedor é registrado depois.</p>
          <pre style={{whiteSpace:"pre-wrap",fontFamily:"var(--arcd-font-sans)",fontSize:"var(--arcd-type-label)",background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-3)",color:"var(--arcd-text-primary)",maxHeight:260,overflow:"auto"}}>{texto}</pre>
          <div style={{display:"flex",gap:"var(--arcd-space-2)",flexWrap:"wrap"}}>
            {forn?.telefone?<a href={linkWhatsApp(forn.telefone,texto)} target="_blank" rel="noreferrer" style={{textDecoration:"none"}} onClick={()=>registrarEnvioPedido(p,"whatsapp",forn.telefone)}><Btn size="sm">WhatsApp</Btn></a>:<Btn size="sm" disabled title="Fornecedor sem telefone">WhatsApp</Btn>}
            {forn?.email?<a href={linkEmailPedido(forn.email,assunto,texto)} style={{textDecoration:"none"}} onClick={()=>registrarEnvioPedido(p,"email",forn.email)}><Btn size="sm" v="ghost">E-mail</Btn></a>:<Btn size="sm" v="ghost" disabled title="Fornecedor sem e-mail">E-mail</Btn>}
            <Btn size="sm" v="ghost" onClick={()=>{if(imprimirPedido(p))registrarEnvioPedido(p,"impresso");}}>Imprimir / PDF</Btn>
            {!p.aceiteFornecedor?.nome&&<Btn size="sm" v="ghost" disabled={gerandoLinkAceite||!!link} loading={gerandoLinkAceite&&"Gerando..."} onClick={()=>gerarLinkAceite(p)}>{link?"Link de aceite incluído":"Gerar link de aceite"}</Btn>}
          </div>
          {link&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>O fornecedor confirma pelo link, sem login, até {fmtDate(String(link.expiraEm).slice(0,10))}. Se o pedido for alterado, o link deixa de valer e é preciso gerar outro.</p>}
          {(p.envios||[]).length>0&&<div style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>{p.envios.map(e=><p key={e.id}>{({whatsapp:"WhatsApp",email:"E-mail",impresso:"Impresso/PDF"})[e.canal]||e.canal} · {new Date(e.enviadoEm).toLocaleString("pt-BR")} · {e.enviadoPor}</p>)}</div>}
          <Btn v="ghost" full onClick={()=>{setEnvioPedido(null);setLinkAceite(null);}}>Fechar</Btn>
        </div></Modal>;})()}
      {aceitePedido&&<Modal title={`Aceite do pedido ${aceitePedido.pedido.numero}`} onClose={()=>setAceitePedido(null)}><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
        <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Registre quem confirmou o pedido no fornecedor e o prazo de entrega que ele assumiu.</p>
        <Inp label="Quem confirmou no fornecedor *" value={aceitePedido.nome} onChange={v=>setAceitePedido(f=>({...f,nome:v}))} placeholder="Nome do vendedor ou responsável"/>
        <Inp label="Data do aceite *" type="date" value={aceitePedido.data} onChange={v=>setAceitePedido(f=>({...f,data:v}))}/>
        <Sel label="Canal *" value={aceitePedido.canal} onChange={v=>setAceitePedido(f=>({...f,canal:v}))} options={[{v:"whatsapp",l:"WhatsApp"},{v:"email",l:"E-mail"},{v:"telefone",l:"Telefone"},{v:"presencial",l:"Presencial"},{v:"documento",l:"Documento assinado"}]}/>
        <Inp label="Entrega confirmada" type="date" value={aceitePedido.previsao} onChange={v=>setAceitePedido(f=>({...f,previsao:v}))}/>
        <Inp label="Observação" value={aceitePedido.obs} onChange={v=>setAceitePedido(f=>({...f,obs:v}))} multiline/>
        <div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn v="ghost" full onClick={()=>setAceitePedido(null)}>Cancelar</Btn><Btn full onClick={salvarAceitePedido}><Ic n="check"/> Registrar aceite</Btn></div>
      </div></Modal>}
      {cotDecisao&&(()=>{const cot=(data.cotacoes||[]).find(c=>c.id===cotDecisao.cotacaoId);if(!cot)return null;
        const pendentesCot=itensPendentesDaCotacao(cot),escolhas=cotDecisao.escolhas||{},just=cotDecisao.justificativas||{};
        const avaliacao=avaliarEscolhasCotacao(cot,escolhas,just);
        return <Modal title="Decisão do mapa de cotação" onClose={()=>setCotDecisao(null)} wide><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
          <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-secondary)"}}>Escolha o fornecedor de cada item. Os valores incluem rateio dos custos comerciais informados. Propostas antigas sem esses dados exibem apenas o preço dos itens e precisam de conferência. Item sem escolha fica pendente. Fora do menor preço ou com uma só proposta, registre o motivo.</p>
          {pendentesCot.map(l=>{const sel=escolhas[l.item.id]||"",exige=sel&&escolhaPrecisaJustificativa(l,sel);return <div key={l.item.id} style={{background:"var(--arcd-surface-muted)",border:`1px solid ${exige&&!String(just[l.item.id]||"").trim()?"var(--arcd-warning-text)":"var(--arcd-border-default)"}`,borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}>
            <p className="brk" style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{nomeMat(l.item.materialId)} · {l.qtd.toLocaleString("pt-BR")} {purchaseUnitOf(l.item)}</p>
            <Sel label="Fornecedor" value={sel} onChange={v=>setCotDecisao(d=>({...d,escolhas:{...d.escolhas,[l.item.id]:v}}))}
              options={[{v:"",l:"Deixar pendente"},...l.ofertas.map(o=>({v:o.proposta.id,l:`${nomeForn(o.proposta.fornecedorId)} · ${fmt(o.precoUnit)} · ${fmt(o.total)}${o.proposta.id===l.melhorPropostaId?" · menor":""} · nota ${textoNotaFornecedor(avaliacaoForn.get(String(o.proposta.fornecedorId)))}`}))]}/>
            {exige&&<Inp label="Justificativa da decisão (recomendada)" value={just[l.item.id]||""} onChange={v=>setCotDecisao(d=>({...d,justificativas:{...d.justificativas,[l.item.id]:v}}))} placeholder={l.ofertas.length<2?"Item com uma única proposta: por que comprar assim?":"Prazo, qualidade, disponibilidade, condição de pagamento..."}/>}
          </div>;})}
          {!avaliacao.erro&&<div style={{background:"color-mix(in srgb, var(--arcd-success-text) 4%, transparent)",border:"1px solid var(--arcd-success-text)",borderRadius:7,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}>
            <p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-success-text)"}}>{avaliacao.grupos.length} pedido(s) · {fmt(avaliacao.total)}{avaliacao.restantes?` · ${avaliacao.restantes} item(ns) pendente(s)`:""}</p>
            {avaliacao.grupos.map(g=><p key={g.fornecedorId} style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>{nomeForn(g.fornecedorId)}: {g.itens.length} item(ns) · {fmt(g.total)}</p>)}
          </div>}
          <WorkflowWarnings warnings={avaliacao.warnings||[]}/>
          {avaliacao.erro&&<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-warning-text)",fontWeight:"var(--arcd-font-weight-semibold)"}}>{avaliacao.erro}</p>}
          <div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn v="ghost" full onClick={()=>setCotDecisao(null)}>Cancelar</Btn><Btn full onClick={()=>decidirCotacao(cot,escolhas,just)} disabled={!!avaliacao.erro}>Aprovar e gerar pedido(s)</Btn></div>
        </div></Modal>;})()}
      {recModal  && <ModalRecebimento pedido={recModal} onClose={()=>setRecModal(null)}
                                      onReceber={receber} nomeMat={nomeMat}
                                      nomeForn={nomeForn} notice={<PurchaseSaveNotice save={save}/>}/>}
      {pagModal&&<Modal title={`Pagamento · ${pagModal.pedido.numero}`} onClose={()=>setPagModal(null)}><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--arcd-space-2)",background:"var(--arcd-surface-muted)",border:"1px solid var(--arcd-border-default)",borderRadius:8,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}><div><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:"var(--arcd-font-weight-semibold)"}}>Total do pedido</p><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-text-primary)"}}>{fmt(totalPedido(pagModal.pedido))}</p></div><div><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:"var(--arcd-font-weight-semibold)"}}>Saldo antes deste pagamento</p><p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-danger-text)"}}>{fmt(saldoPagamentoPedido(pagModal.pedido))}</p></div></div>
        <Sel label="Origem real do pagamento *" value={pagModal.origem} onChange={v=>setPagModal(f=>({...f,origem:v,transacaoId:v==="empresa"?f.transacaoId:""}))} options={[{v:"empresa",l:"Conta bancária da empresa"},{v:"caixa_obra",l:"Caixa da obra"},{v:"cliente_direto",l:"Cliente pagou diretamente"}]}/>
        {pagModal.origem==="caixa_obra"&&(()=>{const cx=situacaoCaixaObra(data,pagModal.pedido.obraId),valor=Number(String(pagModal.valor||"").replace(",","."))||0,projetado=cx.saldo-valor,negativo=projetado<-.001,baixo=!negativo&&projetado<=cx.limiteBaixo;return <div style={{background:negativo?"color-mix(in srgb, var(--arcd-danger-text) 5%, transparent)":baixo?"color-mix(in srgb, var(--arcd-warning-text) 5%, transparent)":"color-mix(in srgb, var(--arcd-success-text) 5%, transparent)",border:`1px solid ${negativo?"var(--arcd-danger-text)":baixo?"var(--arcd-warning-text)":"var(--arcd-success-text)"}`,borderRadius:9,padding:"var(--arcd-space-2) var(--arcd-space-2)"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"var(--arcd-space-2)"}}>{[["Saldo disponível",cx.saldo,cx.saldo>0?C.green:C.red],["Após pagamento",projetado,negativo?C.red:baixo?C.orange:C.green],["Reserva mínima",cx.limiteBaixo,C.muted]].map(([l,v,c])=><div key={l}><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:"var(--arcd-font-weight-semibold)"}}>{l}</p><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:c,marginTop:"var(--arcd-space-half)"}}>{fmt(v)}</p></div>)}</div>{!((data.obras||[]).find(o=>o.id===pagModal.pedido.obraId)?.hasCaixa)&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-danger-text)",fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-2)"}}>Caixa não ativado no cadastro desta obra.</p>}{negativo&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-danger-text)",fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-2)"}}>Aviso: o saldo ficará negativo. Confira aportes e a origem real do pagamento.</p>}{baixo&&<p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-warning-text)",fontWeight:"var(--arcd-font-weight-semibold)",marginTop:"var(--arcd-space-2)"}}>Alerta de caixa baixo: o pagamento é possível, mas deixará a reserva abaixo do nível recomendado.</p>}</div>;})()}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"var(--arcd-space-2)"}}><Inp label="Valor pago *" type="number" value={pagModal.valor} onChange={v=>setPagModal(f=>({...f,valor:v}))}/><Inp label="Data *" type="date" value={pagModal.data} onChange={v=>setPagModal(f=>({...f,data:v}))}/></div>
        {pagModal.origem==="empresa"&&<Sel label="Vincular à transação bancária (opcional)" value={pagModal.transacaoId} onChange={v=>setPagModal(f=>({...f,transacaoId:v,conciliado:!!v}))} options={[{v:"",l:"Sem transação vinculada"},...(data.transacoes||[]).filter(t=>Number(t.valor)<0).slice().sort((a,b)=>(b.data||"").localeCompare(a.data||"")).slice(0,80).map(t=>({v:t.id,l:`${fmtDate(t.data)} · ${fmt(Math.abs(Number(t.valor||0)))} · ${t.descricao||"Saída bancária"}`}))]}/>}
        <Inp label="Comprovante / referência" value={pagModal.referencia} onChange={v=>setPagModal(f=>({...f,referencia:v}))} placeholder="PIX, boleto, recibo ou identificação do cliente"/>
        <FilePicker buttonLabel="Selecionar comprovante" accept=".pdf,image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>5.5*1024*1024){showToast("O comprovante deve ter no máximo 5,5 MB.","error");return;}setPagModal(f=>({...f,comprovanteFile:file,comprovanteLegenda:String(file.name||"").replace(/\.[^.]+$/,"")}));}} style={{padding:"var(--arcd-space-3) var(--arcd-space-3)",border:`1.5px dashed ${pagModal.comprovanteFile?"var(--arcd-success-text)":"var(--arcd-action-primary)"}66`,borderRadius:9,textAlign:"center",cursor:"pointer",background:pagModal.comprovanteFile?"color-mix(in srgb, var(--arcd-success-text) 3%, transparent)":"var(--arcd-surface-muted)"}}><p style={{fontSize:"var(--arcd-type-label)",fontWeight:"var(--arcd-font-weight-semibold)",color:pagModal.comprovanteFile?"var(--arcd-success-text)":"var(--arcd-action-primary)"}}>{pagModal.comprovanteFile?pagModal.comprovanteFile.name:"Anexar comprovante de pagamento"}</p><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>PDF, JPG, PNG ou WEBP · salvo no OneDrive da obra</p></FilePicker>
        {pagModal.comprovanteFile&&<Inp label="Legenda do comprovante" value={pagModal.comprovanteLegenda} onChange={v=>setPagModal(f=>({...f,comprovanteLegenda:v}))} placeholder="Ex.: PIX pago ao fornecedor"/>}
        <label style={{display:"flex",gap:"var(--arcd-space-2)",alignItems:"center",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)",cursor:"pointer"}}><ChoiceControl type="checkbox" checked={!!pagModal.conciliado} onChange={e=>setPagModal(f=>({...f,conciliado:e.target.checked}))}/><span>Pagamento/comprovante já conferido e conciliado</span></label>
        {(()=>{
          // C1.4: o servidor só libera até o conferido (recebido e com nota)
          // mais a tolerância; o resto é adiantamento, com motivo.
          const conf=conferenciaPagamentoPedido(data,pagModal.pedido.id);if(!conf)return null;
          const valor=Number(String(pagModal.valor||"").replace(",","."))||0,liberado=conf.liberadoCents/100,acima=valor>liberado+0.005;
          return <div style={{background:acima?"color-mix(in srgb, var(--arcd-warning-text) 5%, transparent)":"var(--arcd-surface-muted)",border:`1px solid ${acima?"var(--arcd-warning-text)":"var(--arcd-border-default)"}`,borderRadius:8,padding:"var(--arcd-space-2) var(--arcd-space-2)",display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
            <p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)"}}>Conferido: recebido {fmt(conf.receivedCents/100)} · notas {fmt(conf.invoicedCents/100)} · referência de conferência <b>{fmt(liberado)}</b></p>
            {acima&&<label style={{display:"flex",gap:"var(--arcd-space-2)",alignItems:"center",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)",cursor:"pointer"}}><ChoiceControl type="checkbox" checked={!!pagModal.adiantamento} onChange={e=>setPagModal(f=>({...f,adiantamento:e.target.checked}))}/><span>Identificar como adiantamento ao fornecedor</span></label>}
            {acima&&pagModal.adiantamento&&<Inp label="Motivo do adiantamento (recomendado)" value={pagModal.motivoAdiantamento||""} onChange={v=>setPagModal(f=>({...f,motivoAdiantamento:v}))} placeholder="Ex.: sinal de 30% exigido pelo fornecedor"/>}
          </div>;
        })()}
        <Inp label="Observação" value={pagModal.observacao} onChange={v=>setPagModal(f=>({...f,observacao:v}))} multiline/>
        <div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn v="ghost" full onClick={()=>setPagModal(null)} disabled={subindoComprovantePagamento}>Cancelar</Btn><Btn full onClick={registrarPagamento} disabled={subindoComprovantePagamento}><Ic n="check"/> {subindoComprovantePagamento?"Salvando comprovante...":"Registrar pagamento"}</Btn></div>
      </div></Modal>}
      {excluirCompraModal&&<Modal title={`Excluir compra · ${excluirCompraModal.pedido.numero}`} onClose={()=>setExcluirCompraModal(null)}><div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-3)"}}>
        <div style={{padding:"var(--arcd-space-3) var(--arcd-space-3)",border:"1px solid var(--arcd-danger-text)",borderRadius:8,background:"color-mix(in srgb, var(--arcd-danger-text) 4%, transparent)"}}>
          <p style={{fontSize:"var(--arcd-type-body)",fontWeight:"var(--arcd-font-weight-semibold)",color:"var(--arcd-danger-text)"}}>Esta exclusão remove a compra dos controles operacionais.</p>
          <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",lineHeight:"var(--arcd-line-height-normal)",marginTop:"var(--arcd-space-1)"}}>Entradas no estoque e pagamentos criados diretamente pelo pedido serão retirados. Notas fiscais permanecem no Financeiro, são desvinculadas e recebem um alerta. A ação ficará registrada na auditoria.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:"var(--arcd-space-1)"}}>
          {[
            ["Total da compra",fmt(totalPedido(excluirCompraModal.pedido))],
            ["Valor pago",fmt(totalPagoPedido(excluirCompraModal.pedido))],
            ["Entradas no estoque",excluirCompraModal.movimentos.length],
            ["Saídas no caixa",excluirCompraModal.caixas.length],
            ["Notas desvinculadas",excluirCompraModal.notas.length],
            ["Recebimentos",(excluirCompraModal.pedido.itens||[]).reduce((s,i)=>s+(i.recebimentos||[]).length,0)],
          ].map(([label,valor])=><div key={label} style={{padding:"var(--arcd-space-2) var(--arcd-space-2)",border:"1px solid var(--arcd-border-default)",borderRadius:6,background:"var(--arcd-surface-muted)"}}><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",textTransform:"uppercase",fontWeight:"var(--arcd-font-weight-semibold)"}}>{label}</p><b style={{display:"block",fontSize:"var(--arcd-type-label)",color:"var(--arcd-text-primary)",marginTop:"var(--arcd-space-half)"}}>{valor}</b></div>)}
        </div>
        <Inp label="Motivo da exclusão *" value={excluirCompraModal.motivo} onChange={v=>setExcluirCompraModal(f=>({...f,motivo:v}))} multiline placeholder="Ex.: compra duplicada, obra incorreta ou pedido criado por engano"/>
        <Inp label={`Digite ${excluirCompraModal.pedido.numero} para confirmar *`} value={excluirCompraModal.confirmacao} onChange={v=>setExcluirCompraModal(f=>({...f,confirmacao:v}))}/>
        <div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn v="ghost" full disabled={cancelandoCompra} onClick={()=>setExcluirCompraModal(null)}>Manter compra</Btn><Btn v="danger" full disabled={cancelandoCompra} onClick={excluirCompraDefinitivamente}><Ic n="trash"/> {cancelandoCompra?"Cancelando...":"Excluir compra"}</Btn></div>
      </div></Modal>}
    </div>
  );
}
