import { active, toCents } from "../financeiro/ledger.js";
import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { hasValidUnitConversion } from "./unit-conversion.js";

export const PURCHASE_ORDER_COMMAND=Object.freeze({
  PURCHASE_ORDER_SAVED:"PEDIDO_COMPRA_SALVO",
  PURCHASE_ORDER_CREATED_FROM_QUOTE:"PEDIDO_COMPRA_GERADO_COTACAO",
  PURCHASE_ORDER_DOCUMENT_ATTACHED:"DOCUMENTO_PEDIDO_COMPRA_ANEXADO",
  PURCHASE_QUOTE_CANCELLED:"COTACAO_COMPRA_CANCELADA",
});

export const PURCHASE_ORDER_COMMAND_TYPES=new Set(Object.values(PURCHASE_ORDER_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const sameVersion=(item,expected)=>expected!=null&&versionOf(item)===Number(expected);
const validDate=value=>!value||/^\d{4}-\d{2}-\d{2}$/.test(String(value));
const actorOf=command=>({
  id:String(command.actorId||""),
  nome:String(command.actorName||"").trim()||"Usuário autenticado",
});
const orderById=(data,id)=>(data.pedidos||[]).find(item=>String(item.id)===String(id));
const quoteById=(data,id)=>(data.cotacoes||[]).find(item=>String(item.id)===String(id));
const projectById=(data,id)=>(data.obras||[]).find(item=>String(item.id)===String(id));
const supplierById=(data,id)=>(data.fornecedores||[]).find(item=>String(item.id)===String(id));
const requestById=(data,id)=>(data.solicitacoesCompra||[]).find(item=>String(item.id)===String(id));
const activePayments=order=>(order?.pagamentos||[]).filter(active);
const orderTotalCents=order=>(order?.itens||[])
  .reduce((sum,item)=>sum+toCents(Number(item.qtd||0)*Number(item.precoUnit||0)),0);

const normalizeNewSupplier=(data,raw)=>{
  if(!raw)return {supplier:null};
  const id=String(raw.id||""),nome=String(raw.nome||"").trim();
  if(!id||!nome)return {error:"O novo fornecedor precisa de identificação e nome."};
  if(supplierById(data,id))return {error:"Já existe um fornecedor com esta identificação."};
  return {supplier:{
    id,nome,cnpj:String(raw.cnpj||"").trim(),categorias:Array.isArray(raw.categorias)?raw.categorias:[],
    ativo:true,criadoEm:raw.criadoEm||new Date().toISOString(),
  }};
};

const normalizeNewMaterials=(data,raw=[])=>{
  if(!Array.isArray(raw)||raw.length>100)return {error:"A inclusão de insumos do pedido é inválida."};
  const existing=new Set((data.materiais||[]).map(item=>String(item.id)));
  const ids=new Set(),materials=[];
  for(const item of raw){
    const id=String(item?.id||""),description=String(item?.descricao||"").trim();
    if(!id||!description||existing.has(id)||ids.has(id)){
      return {error:"O pedido contém um novo insumo inválido ou duplicado."};
    }
    ids.add(id);
    const price=Number(item.precoMedio||0);
    if(!Number.isFinite(price)||price<0)return {error:"O preço de referência do insumo é inválido."};
    materials.push({
      ...item,id,descricao:description,unidade:String(item.unidade||"UN").trim()||"UN",
      precoMedio:price,ativo:item.ativo!==false,
    });
  }
  return {materials};
};

const normalizeItems=(data,rawItems,newMaterials,current)=>{
  if(!Array.isArray(rawItems)||!rawItems.length||rawItems.length>500){
    return {error:"O pedido precisa possuir entre 1 e 500 itens."};
  }
  const validMaterialIds=new Set([
    ...(data.materiais||[]).map(item=>String(item.id)),
    ...newMaterials.map(item=>String(item.id)),
  ]);
  const currentItems=new Map((current?.itens||[]).map(item=>[String(item.id),item]));
  const ids=new Set(),items=[];
  for(const raw of rawItems){
    const id=String(raw?.id||""),materialId=String(raw?.materialId||"");
    const quantity=Number(raw?.qtd),unitPrice=Number(raw?.precoUnit||0);
    if(!id||ids.has(id)||!materialId||!validMaterialIds.has(materialId)){
      return {error:"O pedido contém item sem identificação ou insumo válido."};
    }
    if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0){
      return {error:"Quantidade e preço dos itens do pedido precisam ser válidos."};
    }
    if(!hasValidUnitConversion(raw)){
      return {error:"A conversão entre a unidade de compra e a unidade de referência é inválida."};
    }
    ids.add(id);
    const previous=currentItems.get(id);
    const received=Number(previous?.qtdRecebida||0);
    if(quantity+1e-6<received)return {error:"A quantidade comprada não pode ficar abaixo do que já foi recebido."};
    items.push({
      ...raw,id,materialId,qtd:quantity,precoUnit:unitPrice,
      qtdRecebida:received,
      recebimentos:(previous?.recebimentos||[]).map(item=>({...item})),
    });
  }
  if(current&&(current.itens||[]).some(item=>
    Number(item.qtdRecebida||0)>0&&!ids.has(String(item.id)))){
    return {error:"Um item já recebido não pode ser removido do pedido."};
  }
  return {items};
};

const normalizeOrder=(data,raw,current,{newMaterials=[]}={})=>{
  const id=String(raw.id||""),obraId=String(raw.obraId||"");
  const fornecedorId=String(raw.fornecedorId||"");
  const date=String(raw.data||""),forecast=String(raw.previsao||"");
  if(!id)return {error:"Pedido sem identificação única."};
  if(!projectById(data,obraId))return {error:"Selecione uma obra existente para o pedido."};
  if(!supplierById(data,fornecedorId))return {error:"Selecione um fornecedor existente para o pedido."};
  if(!date||!validDate(date)||!validDate(forecast))return {error:"Informe datas válidas para o pedido."};
  if(isDateInClosedPeriod(data,date))return {error:"O período financeiro deste pedido está fechado."};
  const items=normalizeItems(data,raw.itens,newMaterials,current);
  if(items.error)return items;
  const requestId=String(raw.solicitacaoId||"");
  const request=requestId?requestById(data,requestId):null;
  if(requestId&&!request)return {error:"A solicitação relacionada ao pedido não existe."};
  if(request&&String(request.obraId)!==obraId)return {error:"Pedido e solicitação precisam pertencer à mesma obra."};
  const quoteId=String(raw.cotacaoId||"");
  const quote=quoteId?quoteById(data,quoteId):null;
  if(quoteId&&!quote)return {error:"A cotação relacionada ao pedido não existe."};
  if(quote&&String(quote.obraId)!==obraId)return {error:"Pedido e cotação precisam pertencer à mesma obra."};
  const candidate={
    ...current,...raw,id,obraId,fornecedorId,data:date,previsao:forecast,
    numero:String(raw.numero||"").trim(),
    status:current?.status||(["rascunho","enviado"].includes(raw.status)?raw.status:"enviado"),
    origemPagamento:["cliente_direto","caixa_obra","empresa"].includes(raw.origemPagamento)
      ?raw.origemPagamento:"empresa",
    solicitacaoId:requestId,cotacaoId:quoteId,itens:items.items,
    pagamentos:(current?.pagamentos||[]).map(item=>({...item})),
    documentos:(current?.documentos||raw.documentos||[]).map(item=>({...item})),
  };
  if(!candidate.numero)return {error:"Informe o número do pedido."};
  if((data.pedidos||[]).some(item=>
    String(item.id)!==id&&active(item)
    &&String(item.numero||"").trim().toLowerCase()===candidate.numero.toLowerCase())){
    return {error:"Já existe um pedido ativo com este número."};
  }
  const paidCents=activePayments(current).reduce((sum,item)=>sum+toCents(item.valor),0);
  if(orderTotalCents(candidate)<paidCents)return {
    error:"O total do pedido não pode ficar abaixo dos pagamentos ativos.",
  };
  return {order:candidate,request};
};

const saveOrder=(data,command,now)=>{
  const payload=command.payload||{},raw=payload.order||{};
  const current=orderById(data,raw.id);
  if(current&&!sameVersion(current,command.expectedVersion)){
    return fail("O pedido foi alterado por outra pessoa. Atualize a tela.");
  }
  if(!current&&command.expectedVersion!==0)return fail("A criação do pedido exige versão inicial zero.");
  if(current&&!String(payload.adjustmentReason||"").trim()){
    return fail("Informe o motivo do ajuste do pedido.");
  }
  const supplierResult=normalizeNewSupplier(data,payload.newSupplier);
  if(supplierResult.error)return fail(supplierResult.error);
  const withSupplier=supplierResult.supplier
    ?{...data,fornecedores:[...(data.fornecedores||[]),supplierResult.supplier]}:data;
  const materialResult=normalizeNewMaterials(withSupplier,payload.newMaterials||[]);
  if(materialResult.error)return fail(materialResult.error);
  const withCatalog=materialResult.materials.length
    ?{...withSupplier,materiais:[...(withSupplier.materiais||[]),...materialResult.materials]}
    :withSupplier;
  const normalized=normalizeOrder(withCatalog,raw,current,{newMaterials:materialResult.materials});
  if(normalized.error)return fail(normalized.error);
  const actor=actorOf(command);
  const totalNew=orderTotalCents(normalized.order)/100;
  const saved={
    ...normalized.order,
    version:current?versionOf(current)+1:1,
    criadoEm:current?.criadoEm||now,criadoPorId:current?.criadoPorId||actor.id,
    criadoPor:current?.criadoPor||actor.nome,
    atualizadoEm:now,updatedAt:now,updatedById:actor.id,updatedBy:actor.nome,
    ajustes:current?[...(current.ajustes||[]),{
      id:`ajuste-${command.idempotencyKey}`,motivo:String(payload.adjustmentReason).trim(),
      usuarioId:actor.id,usuario:actor.nome,criadoEm:now,
      totalAnterior:orderTotalCents(current)/100,totalNovo:totalNew,
      resumo:`Pedido ${normalized.order.numero}: dados, itens ou valores revisados.`,
    }]:(normalized.order.ajustes||[]),
  };
  const requests=normalized.request?(withCatalog.solicitacoesCompra||[]).map(item=>
    String(item.id)===String(normalized.request.id)?{
      ...item,status:"pedido_gerado",pedidoId:saved.id,
      analisadoEm:item.analisadoEm||now,analisadoPor:item.analisadoPor||actor.nome,
    }:item):(withCatalog.solicitacoesCompra||[]);
  return {
    ok:true,entityId:saved.id,
    data:{
      ...withCatalog,solicitacoesCompra:requests,
      pedidos:current
        ?(withCatalog.pedidos||[]).map(item=>String(item.id)===saved.id?saved:item)
        :[...(withCatalog.pedidos||[]),saved],
    },
  };
};

const createFromQuote=(data,command,now)=>{
  const payload=command.payload||{},quote=quoteById(data,payload.quoteId);
  if(!quote||["cancelada","decidida"].includes(String(quote.status))){
    return fail("Cotação não encontrada ou já encerrada.");
  }
  const proposal=(quote.propostas||[]).find(item=>String(item.id)===String(payload.proposalId));
  if(!proposal)return fail("A proposta escolhida não pertence à cotação.");
  const prices=(quote.propostas||[]).map(item=>Number(item.precoUnit||0)).filter(value=>value>0);
  if(prices.length<2)return fail("A cotação precisa de ao menos duas propostas válidas.");
  const lowest=Math.min(...prices),selected=Number(proposal.precoUnit||0);
  const justification=String(payload.justification||"").trim();
  if(selected>lowest+0.000001&&!justification){
    return fail("Justifique a escolha de uma proposta que não é a mais barata.");
  }
  const orderId=String(payload.orderId||"");
  if(!orderId||orderById(data,orderId))return fail("O novo pedido possui identificação inválida ou repetida.");
  const raw={
    id:orderId,numero:String(payload.number||"").trim(),obraId:quote.obraId,
    fornecedorId:proposal.fornecedorId,data:String(payload.date||now.slice(0,10)),
    previsao:String(payload.forecast||""),status:"enviado",origemPagamento:"empresa",
    solicitacaoId:quote.solicitacaoId||"",cotacaoId:quote.id,transacaoId:"",
    itens:[{
      id:String(payload.itemId||""),materialId:quote.materialId,qtd:Number(quote.qtd),
      precoUnit:selected,qtdRecebida:0,orcItemId:quote.orcItemId||"",
      orcNivel1Id:quote.orcNivel1Id||"",recebimentos:[],
      unidadeRef:quote.unidadeRef||"",unidadeCompra:quote.unidadeCompra||quote.unidadeRef||"",
      fatorConversao:Number(quote.fatorConversao||1),precoRef:Number(quote.precoRef||0),
    }],
    pagamentos:[],documentos:[],obs:"",
  };
  const saved=saveOrder(data,{...command,expectedVersion:0,payload:{order:raw}},now);
  if(!saved.ok)return saved;
  const actor=actorOf(command);
  const highest=Math.max(...prices);
  const quotes=(saved.data.cotacoes||[]).map(item=>String(item.id)===String(quote.id)?{
    ...item,status:"decidida",escolhida:proposal.id,pedidoId:orderId,
    decididoPorId:actor.id,decididoPorNome:actor.nome,decididoEm:now,
    justificativaEscolha:justification,
    economia:Math.max(0,(highest-selected)*Number(quote.qtd||0)),
    version:versionOf(item)+1,updatedAt:now,
  }:item);
  return {ok:true,entityId:orderId,data:{...saved.data,cotacoes:quotes}};
};

const attachDocument=(data,command,now)=>{
  const payload=command.payload||{},order=orderById(data,payload.orderId);
  if(!order)return fail("Pedido não encontrado.");
  if(!sameVersion(order,command.expectedVersion)){
    return fail("O pedido foi alterado por outra pessoa. Atualize a tela.");
  }
  const document=payload.document||{};
  if(!document.id||!String(document.nome||"").trim()||!String(document.url||"").trim()){
    return fail("O documento do pedido está incompleto.");
  }
  if((order.documentos||[]).some(item=>String(item.id)===String(document.id))){
    return fail("Este documento já está vinculado ao pedido.");
  }
  const actor=actorOf(command);
  const updated={
    ...order,documentos:[...(order.documentos||[]),{...document}],
    version:versionOf(order)+1,updatedAt:now,updatedById:actor.id,updatedBy:actor.nome,
  };
  return {
    ok:true,entityId:order.id,
    data:{...data,pedidos:(data.pedidos||[]).map(item=>item.id===order.id?updated:item)},
  };
};

const cancelQuote=(data,command,now)=>{
  const payload=command.payload||{},quote=quoteById(data,payload.quoteId);
  if(!quote||String(quote.status)==="cancelada")return fail("Cotação não encontrada ou já cancelada.");
  const reason=String(payload.reason||"").trim();
  if(!reason)return fail("Informe o motivo do cancelamento da cotação.");
  const actor=actorOf(command);
  const linked=(data.pedidos||[]).find(item=>
    String(item.id)===String(quote.pedidoId||"")||String(item.cotacaoId||"")===String(quote.id));
  if(linked&&payload.expectedOrderVersion!=null&&!sameVersion(linked,payload.expectedOrderVersion)){
    return fail("O pedido vinculado foi alterado por outra pessoa. Atualize a tela.");
  }
  const quotes=(data.cotacoes||[]).map(item=>String(item.id)===String(quote.id)?{
    ...item,status:"cancelada",canceladaEm:now,canceladaPorId:actor.id,
    canceladaPor:actor.nome,motivoCancelamento:reason,
    version:versionOf(item)+1,updatedAt:now,
  }:item);
  const orders=(data.pedidos||[]).map(item=>linked&&item.id===linked.id?{
    ...item,cotacaoId:"",version:versionOf(item)+1,updatedAt:now,
  }:item);
  const requests=(data.solicitacoesCompra||[]).map(item=>({
    ...item,cotacaoIds:(item.cotacaoIds||[]).filter(id=>String(id)!==String(quote.id)),
  }));
  const log={
    id:`quote-cancel-${command.idempotencyKey}`,date:now.slice(0,10),at:now,
    type:"purchase_quote_deleted",obraId:quote.obraId,cotacaoId:quote.id,
    pedidoId:linked?.id||"",operador:actor.nome,operadorId:actor.id,
    message:`Cotação cancelada: ${reason}.`,
  };
  return {
    ok:true,entityId:quote.id,
    data:{...data,cotacoes:quotes,pedidos:orders,solicitacoesCompra:requests,
      changeLog:[...(data.changeLog||[]),log].slice(-500)},
  };
};

export const purchaseOrderCommandObraId=(data={},command={})=>{
  const payload=command.payload||{};
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SAVED){
    return String(orderById(data,payload.order?.id)?.obraId||payload.order?.obraId||"");
  }
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE){
    return String(quoteById(data,payload.quoteId)?.obraId||"");
  }
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_DOCUMENT_ATTACHED){
    return String(orderById(data,payload.orderId)?.obraId||"");
  }
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_CANCELLED){
    return String(quoteById(data,payload.quoteId)?.obraId||"");
  }
  return "";
};

export const applyPurchaseOrderCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!PURCHASE_ORDER_COMMAND_TYPES.has(command.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para alterar pedidos.");
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_SAVED)return saveOrder(data,command,now);
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE){
    return createFromQuote(data,command,now);
  }
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_ORDER_DOCUMENT_ATTACHED){
    return attachDocument(data,command,now);
  }
  return cancelQuote(data,command,now);
};
