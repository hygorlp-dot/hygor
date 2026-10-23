import { active, toCents } from "../financeiro/ledger.js";
import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { hasValidUnitConversion, purchaseUnitOf } from "./unit-conversion.js";
import { proximoNumeroPedido } from "./calculations.js";
import { instanciaDaSolicitacao, limiteAprovacaoEngenheiro, pedidoDentroDaAlcada } from "./purchase-approval.js";
import { avaliarEscolhasCotacao, cotacaoMultiItens, decisoesDaCotacao, itensDaCotacao } from "./quote-map.js";

export const PURCHASE_ORDER_COMMAND=Object.freeze({
  PURCHASE_ORDER_SAVED:"PEDIDO_COMPRA_SALVO",
  PURCHASE_ORDER_CREATED_FROM_QUOTE:"PEDIDO_COMPRA_GERADO_COTACAO",
  PURCHASE_ORDER_DOCUMENT_ATTACHED:"DOCUMENTO_PEDIDO_COMPRA_ANEXADO",
  PURCHASE_QUOTE_CANCELLED:"COTACAO_COMPRA_CANCELADA",
  QUOTATION_SAVED:"COTACAO_COMPRA_SALVA",
  PURCHASE_QUOTE_DOCUMENT_ATTACHED:"DOCUMENTO_COTACAO_COMPRA_ANEXADO",
  QUOTE_MAP_DECIDED:"MAPA_COTACAO_DECIDIDO",
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
// Pedido vivo = não cancelado. `active()` do razão trata rascunho como
// inativo (não é compromisso financeiro), mas rascunho continua editável.
const orderAlive=order=>order&&order.status!=="cancelado"&&order.deletedAt==null&&order.ativo!==false;
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

const normalizeOrder=(data,raw,current,{newMaterials=[],siblingQuoteId=""}={})=>{
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
  if(request&&request.status==="cancelada")return {error:"A solicitação relacionada foi cancelada e não pode gerar pedido."};
  // Solicitação só vira pedido depois de aprovada. As antigas, criadas antes
  // de a aprovação existir, não têm instância e seguem como antes.
  const approval=instanciaDaSolicitacao(data,request);
  if(!current&&approval&&approval.status!=="aprovada"){
    return {error:["reprovada","cancelada"].includes(approval.status)
      ?"A solicitação foi reprovada na aprovação e não pode gerar pedido."
      :"A solicitação ainda aguarda aprovação e não pode gerar pedido."};
  }
  const requestOrder=request?.pedidoId&&String(request.pedidoId)!==id?orderById(data,request.pedidoId):null;
  // Pedidos do mesmo mapa de cotação dividem a solicitação (um por fornecedor).
  const sibling=siblingQuoteId&&String(requestOrder?.cotacaoId||"")===String(siblingQuoteId);
  if(orderAlive(requestOrder)&&!sibling){
    return {error:`Esta solicitação já gerou o pedido ${requestOrder.numero}.`};
  }
  const quoteId=String(raw.cotacaoId||"");
  const quote=quoteId?quoteById(data,quoteId):null;
  if(quoteId&&!quote)return {error:"A cotação relacionada ao pedido não existe."};
  if(quote&&String(quote.obraId)!==obraId)return {error:"Pedido e cotação precisam pertencer à mesma obra."};
  const candidate={
    ...current,...raw,id,obraId,fornecedorId,data:date,previsao:forecast,
    numero:String(raw.numero||"").trim(),
    // Rascunho pode ser enviado ao fornecedor depois; o caminho inverso não
    // existe (pedido enviado já é compromisso com o fornecedor).
    status:current
      ?(current.status==="rascunho"&&raw.status==="enviado"?"enviado":current.status)
      :(["rascunho","enviado"].includes(raw.status)?raw.status:"enviado"),
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

const saveOrder=(data,command,now,{siblingQuoteId=""}={})=>{
  const payload=command.payload||{},sent=payload.order||{};
  const current=orderById(data,sent.id);
  // Pedido novo sem número digitado: o servidor numera sob a trava da linha.
  const raw=!current&&!String(sent.numero||"").trim()
    ?{...sent,numero:proximoNumeroPedido(data.pedidos)}:sent;
  if(current&&!sameVersion(current,command.expectedVersion)){
    return fail("O pedido foi alterado por outra pessoa. Atualize a tela.");
  }
  if(!current&&command.expectedVersion!==0)return fail("A criação do pedido exige versão inicial zero.");
  if(current&&!orderAlive(current)){
    return fail("Este pedido foi cancelado e não pode mais ser alterado.");
  }
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
  const normalized=normalizeOrder(withCatalog,raw,current,{newMaterials:materialResult.materials,siblingQuoteId});
  if(normalized.error)return fail(normalized.error);
  const actor=actorOf(command);
  const totalNew=orderTotalCents(normalized.order)/100;
  const raisesTotal=!current||totalNew>orderTotalCents(current)/100+0.005;
  if(raisesTotal&&!pedidoDentroDaAlcada(withCatalog,{total:totalNew,request:normalized.request,actorRole:command.actorRole})){
    const limite=limiteAprovacaoEngenheiro(withCatalog).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    return fail(`Pedido acima de ${limite} precisa de aprovação do Administrador: lance pela solicitação aprovada por ele ou peça ao Administrador para lançar.`);
  }
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
      ...item,status:"pedido_gerado",
      pedidoId:siblingQuoteId&&orderAlive(orderById(withCatalog,item.pedidoId))?item.pedidoId:saved.id,
      ...(siblingQuoteId?{pedidoIds:[...new Set([...(item.pedidoIds||[]),saved.id])]}:{}),
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

// Achado ao mapear o próximo elo da cadeia de Compras (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): diferente de todo o resto deste
// domínio (decidir cotação, cancelar cotação, cancelar pedido, pagamentos,
// recebimento), a CRIAÇÃO de uma cotação nunca foi um comando operacional -
// era update() direto do componente (ComprasView.jsx, salvarCotacao), sem
// versão, sem autoria e sem nenhum teste de comportamento. Este comando
// espelha exatamente a validação que já existia no cliente (material,
// quantidade, mínimo de 2 propostas válidas) e acrescenta o que só os
// outros comandos deste domínio já tinham: versionamento otimista,
// autoria, e a mesma checagem de conversão de unidade que normalizeItems
// já aplica aos itens do pedido (createFromQuote copia esses mesmos campos
// da cotação para o item do pedido - validar aqui só antecipa o erro).
const normalizeQuote=(data,raw,current,now)=>{
  const id=String(raw.id||"");
  if(!id)return {error:"Cotação sem identificação única."};
  const obraId=String(raw.obraId||current?.obraId||"");
  if(!projectById(data,obraId))return {error:"Selecione uma obra existente para a cotação."};
  if(Array.isArray(raw.itens))return normalizeQuoteMap(data,raw,current,now,{id,obraId});
  const materialId=String(raw.materialId||"");
  if(!(data.materiais||[]).some(item=>String(item.id)===materialId)){
    return {error:"Selecione um insumo existente para a cotação."};
  }
  const quantity=Number(raw.qtd);
  if(!Number.isFinite(quantity)||quantity<=0)return {error:"Informe a quantidade da cotação."};
  const proposals=(raw.propostas||[])
    .filter(item=>item?.fornecedorId&&Number(item.precoUnit)>0)
    .map(item=>({
      id:String(item.id||""),fornecedorId:String(item.fornecedorId),
      precoUnit:Number(item.precoUnit),prazoDias:Number(item.prazoDias||0),
      obs:String(item.obs||""),
      documentos:Array.isArray(item.documentos)?item.documentos.map(doc=>({...doc})):[],
    }));
  if(proposals.length<2)return {error:"Uma cotação precisa de ao menos 2 propostas."};
  if(proposals.some(item=>!item.id||!supplierById(data,item.fornecedorId))){
    return {error:"A cotação contém proposta sem identificação ou fornecedor válido."};
  }
  // A validação roda sobre os campos originais (não sobre um valor já
  // com fallback aplicado) - Number(raw.fatorConversao||1) mascararia um
  // fatorConversao:0 genuinamente inválido, transformando-o em 1 antes de
  // a checagem rodar. Mesmo cuidado que normalizeItems já tem para os
  // itens do pedido.
  if(!hasValidUnitConversion(raw)){
    return {error:"A conversão entre a unidade de compra e a unidade de referência é inválida."};
  }
  const conversion={
    unidadeRef:String(raw.unidadeRef||"").trim()||"UN",
    unidadeCompra:purchaseUnitOf(raw),
    fatorConversao:Number(raw.fatorConversao||1),
  };
  // O vínculo com a solicitação só é atribuído na criação - editar uma
  // cotação existente não pode trocar de onde ela veio (a solicitação de
  // origem já recebeu o id desta cotação em cotacaoIds e não é revertido
  // aqui, então mudar o vínculo deixaria essa lista desatualizada).
  const requestId=String(current?.solicitacaoId||raw.solicitacaoId||"");
  const request=requestId?requestById(data,requestId):null;
  if(requestId&&!request)return {error:"A solicitação relacionada à cotação não existe."};
  if(request&&String(request.obraId)!==obraId){
    return {error:"Cotação e solicitação precisam pertencer à mesma obra."};
  }
  const quote={
    id,obraId,materialId,qtd:quantity,
    unidadeRef:conversion.unidadeRef,unidadeCompra:conversion.unidadeCompra,
    fatorConversao:conversion.fatorConversao,precoRef:Number(raw.precoRef||0),
    orcItemId:String(raw.orcItemId||""),orcNivel1Id:String(raw.orcNivel1Id||""),
    data:String(raw.data||"").trim()||now.slice(0,10),
    propostas:proposals,solicitacaoId:requestId,
  };
  return {quote,request};
};

const materialExists=(data,id)=>(data.materiais||[]).some(item=>String(item.id)===String(id));

const quoteRequestOf=(data,raw,current,obraId)=>{
  const requestId=String(current?.solicitacaoId||raw.solicitacaoId||"");
  const request=requestId?requestById(data,requestId):null;
  if(requestId&&!request)return {error:"A solicitação relacionada à cotação não existe."};
  if(request&&String(request.obraId)!==obraId){
    return {error:"Cotação e solicitação precisam pertencer à mesma obra."};
  }
  return {requestId,request};
};

// Mapa de cotação (C1.3): vários itens, um preço por item em cada proposta.
// Mesmas regras do formato antigo: insumo existente, quantidade, conversão
// de unidade válida e ao menos 2 propostas. Cada fornecedor aparece uma vez,
// porque a decisão gera um pedido por fornecedor.
const normalizeQuoteMap=(data,raw,current,now,{id,obraId})=>{
  if(!raw.itens.length||raw.itens.length>200)return {error:"A cotação precisa possuir entre 1 e 200 itens."};
  const ids=new Set(),items=[];
  for(const item of raw.itens){
    const itemId=String(item?.id||""),materialId=String(item?.materialId||"");
    if(!itemId||ids.has(itemId))return {error:"A cotação contém item sem identificação ou repetido."};
    if(!materialExists(data,materialId))return {error:"Selecione um insumo existente para cada item da cotação."};
    const quantity=Number(item.qtd);
    if(!Number.isFinite(quantity)||quantity<=0)return {error:"Informe a quantidade de cada item da cotação."};
    if(!hasValidUnitConversion(item)){
      return {error:"A conversão entre a unidade de compra e a unidade de referência é inválida."};
    }
    ids.add(itemId);
    items.push({
      id:itemId,materialId,qtd:quantity,
      unidadeRef:String(item.unidadeRef||"").trim()||"UN",unidadeCompra:purchaseUnitOf(item),
      fatorConversao:Number(item.fatorConversao||1),precoRef:Number(item.precoRef||0),
      orcItemId:String(item.orcItemId||""),orcNivel1Id:String(item.orcNivel1Id||""),
      solicitacaoItemId:String(item.solicitacaoItemId||""),
    });
  }
  if(current&&cotacaoMultiItens(current)){
    const decided=new Set(Object.keys(decisoesDaCotacao(current)));
    if([...decided].some(itemId=>!ids.has(itemId))){
      return {error:"Um item que já virou pedido não pode sair da cotação."};
    }
  }
  const proposals=[];
  for(const item of raw.propostas||[]){
    if(!item?.fornecedorId)continue;
    const precos=Object.fromEntries(Object.entries(item.precos||{})
      .filter(([itemId,value])=>ids.has(itemId)&&Number.isFinite(Number(value))&&Number(value)>0)
      .map(([itemId,value])=>[itemId,Number(value)]));
    if(!Object.keys(precos).length)continue;
    proposals.push({
      id:String(item.id||""),fornecedorId:String(item.fornecedorId),precos,
      prazoDias:Number(item.prazoDias||0),obs:String(item.obs||""),
      documentos:Array.isArray(item.documentos)?item.documentos.map(doc=>({...doc})):[],
    });
  }
  if(proposals.length<2)return {error:"Uma cotação precisa de ao menos 2 propostas."};
  if(proposals.some(item=>!item.id||!supplierById(data,item.fornecedorId))){
    return {error:"A cotação contém proposta sem identificação ou fornecedor válido."};
  }
  if(new Set(proposals.map(item=>item.fornecedorId)).size!==proposals.length){
    return {error:"Cada fornecedor deve aparecer em uma única proposta do mapa."};
  }
  if(current&&cotacaoMultiItens(current)){
    const byId=new Map(items.map(item=>[item.id,item]));
    const previous=new Map(current.itens.map(item=>[String(item.id),item]));
    const changed=Object.entries(decisoesDaCotacao(current)).some(([itemId,decision])=>{
      const before=previous.get(itemId),after=byId.get(itemId);
      const proposal=proposals.find(item=>item.id===String(decision.propostaId));
      const oldProposal=(current.propostas||[]).find(item=>String(item.id)===String(decision.propostaId));
      return !proposal||!after||String(after.materialId)!==String(before?.materialId)
        ||Math.abs(after.qtd-Number(before?.qtd||0))>1e-9
        ||Math.abs(Number(proposal.precos[itemId]||0)-Number(oldProposal?.precos?.[itemId]||0))>1e-9;
    });
    if(changed)return {error:"Um item que já virou pedido não pode ser alterado na cotação."};
  }
  const link=quoteRequestOf(data,raw,current,obraId);
  if(link.error)return link;
  const first=items[0];
  const quote={
    // materialId/qtd do primeiro item mantêm a cotação visível no registro
    // de compras (core_quotations exige material).
    id,obraId,materialId:first.materialId,qtd:first.qtd,
    unidadeRef:first.unidadeRef,unidadeCompra:first.unidadeCompra,fatorConversao:first.fatorConversao,
    precoRef:first.precoRef,orcItemId:first.orcItemId,orcNivel1Id:first.orcNivel1Id,
    itens:items,decisoes:current?.decisoes||{},pedidoIds:current?.pedidoIds||[],
    data:String(raw.data||"").trim()||now.slice(0,10),
    propostas:proposals,solicitacaoId:link.requestId,
  };
  return {quote,request:link.request};
};

const saveQuote=(data,command,now)=>{
  const payload=command.payload||{},raw=payload.quote||{};
  const current=quoteById(data,raw.id);
  if(current&&current.status!=="aberta"){
    return fail("Esta cotação já foi decidida ou cancelada e não pode mais ser editada.");
  }
  if(current&&!sameVersion(current,command.expectedVersion)){
    return fail("A cotação foi alterada por outra pessoa. Atualize a tela.");
  }
  if(!current&&Number(command.expectedVersion)!==0)return fail("A criação da cotação exige versão inicial zero.");
  const normalized=normalizeQuote(data,raw,current,now);
  if(normalized.error)return fail(normalized.error);
  const actor=actorOf(command);
  const saved={
    ...normalized.quote,
    status:"aberta",escolhida:current?.escolhida||"",pedidoId:current?.pedidoId||"",
    version:current?versionOf(current)+1:1,
    criadoEm:current?.criadoEm||now,criadoPorId:current?.criadoPorId||actor.id,
    criadoPor:current?.criadoPor||actor.nome,
    updatedAt:now,updatedById:actor.id,updatedBy:actor.nome,
  };
  const request=normalized.request;
  const requests=request?(data.solicitacoesCompra||[]).map(item=>String(item.id)===String(request.id)?{
    ...item,status:item.status==="enviada"?"em_analise":item.status,
    analisadoEm:item.analisadoEm||now,analisadoPor:item.analisadoPor||actor.nome,
    cotacaoIds:[...new Set([...(item.cotacaoIds||[]),saved.id])],
  }:item):(data.solicitacoesCompra||[]);
  return {
    ok:true,entityId:saved.id,
    data:{...data,solicitacoesCompra:requests,
      cotacoes:current
        ?(data.cotacoes||[]).map(item=>String(item.id)===saved.id?saved:item)
        :[...(data.cotacoes||[]),saved]},
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

// Decisão do mapa de cotação (C1.3): escolhe a proposta de cada item
// pendente e gera um pedido por fornecedor vencedor, todos na mesma
// operação. Itens sem escolha continuam pendentes na cotação. A alçada de
// aprovação considera a soma dos pedidos gerados, para que dividir a compra
// entre fornecedores não escape do Administrador.
const decideQuoteMap=(data,command,now)=>{
  const payload=command.payload||{},quote=quoteById(data,payload.quoteId);
  if(!quote||quote.status!=="aberta")return fail("Cotação não encontrada ou já encerrada.");
  if(!sameVersion(quote,command.expectedVersion)){
    return fail("A cotação foi alterada por outra pessoa. Atualize a tela.");
  }
  const evaluation=avaliarEscolhasCotacao(quote,payload.choices,payload.justifications);
  if(evaluation.erro)return fail(evaluation.erro);
  const orders=payload.orders||{};
  const orderIds=evaluation.grupos.map(group=>String(orders[group.fornecedorId]?.orderId||""));
  if(orderIds.some(id=>!id||orderById(data,id))||new Set(orderIds).size!==orderIds.length){
    return fail("Os novos pedidos possuem identificação inválida ou repetida.");
  }
  const request=quote.solicitacaoId?requestById(data,quote.solicitacaoId):null;
  if(!pedidoDentroDaAlcada(data,{total:evaluation.total,request,actorRole:command.actorRole})){
    const limite=limiteAprovacaoEngenheiro(data).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    return fail(`Compra acima de ${limite} precisa de aprovação do Administrador: lance pela solicitação aprovada por ele ou peça ao Administrador para decidir.`);
  }
  const date=String(payload.date||now.slice(0,10));
  let next=data;
  const created=[];
  for(const [index,group] of evaluation.grupos.entries()){
    const orderId=orderIds[index];
    const raw={
      id:orderId,numero:String(orders[group.fornecedorId]?.number||"").trim(),obraId:quote.obraId,
      fornecedorId:group.fornecedorId,data:date,previsao:String(payload.forecast||""),
      status:"enviado",origemPagamento:"empresa",
      solicitacaoId:quote.solicitacaoId||"",cotacaoId:quote.id,transacaoId:"",
      itens:group.itens.map(({linha,precoUnit})=>({
        id:`${orderId}-${linha.item.id}`,materialId:linha.item.materialId,qtd:linha.qtd,
        precoUnit,qtdRecebida:0,orcItemId:linha.item.orcItemId||"",
        orcNivel1Id:linha.item.orcNivel1Id||"",recebimentos:[],
        unidadeRef:linha.item.unidadeRef||"",
        unidadeCompra:linha.item.unidadeCompra||linha.item.unidadeRef||"",
        fatorConversao:Number(linha.item.fatorConversao||1),precoRef:Number(linha.item.precoRef||0),
        cotacaoItemId:linha.item.id,
      })),
      pagamentos:[],documentos:[],obs:"",
    };
    const saved=saveOrder(next,{...command,expectedVersion:0,payload:{order:raw}},now,{siblingQuoteId:quote.id});
    if(!saved.ok)return saved;
    next=saved.data;
    created.push({orderId,group});
  }
  const actor=actorOf(command);
  const multi=cotacaoMultiItens(quote);
  const decisions={...(quote.decisoes||{})};
  for(const {orderId,group} of created){
    for(const {linha} of group.itens){
      decisions[linha.item.id]={...evaluation.decisoes[linha.item.id],pedidoId:orderId,
        decididoPorId:actor.id,decididoPorNome:actor.nome,decididoEm:now};
    }
  }
  const allDecided=itensDaCotacao(quote).every(item=>multi?decisions[item.id]:true);
  const first=created[0];
  const quotes=(next.cotacoes||[]).map(item=>String(item.id)!==String(quote.id)?item:{
    ...item,
    ...(multi?{decisoes:decisions,pedidoIds:[...(item.pedidoIds||[]),...created.map(entry=>entry.orderId)]}
      :{escolhida:first.group.propostaId,
        justificativaEscolha:Object.values(evaluation.decisoes)[0]?.justificativa||""}),
    status:allDecided?"decidida":"aberta",
    pedidoId:item.pedidoId||first.orderId,
    decididoPorId:actor.id,decididoPorNome:actor.nome,decididoEm:now,
    // Soma das decisões vigentes: cancelar um pedido e decidir de novo não duplica.
    economia:multi
      ?Object.values(decisions).reduce((sum,decision)=>sum+Number(decision.economia||0),0)
      :evaluation.economia,
    version:versionOf(item)+1,updatedAt:now,
  });
  return {
    ok:true,entityId:first.orderId,orderIds:created.map(entry=>entry.orderId),
    data:{...next,cotacoes:quotes},
  };
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
  // Mapa de cotação pode ter gerado um pedido por fornecedor: todos perdem o vínculo.
  const linkedIds=new Set([linked?.id,...(quote.pedidoIds||[])].filter(Boolean).map(String));
  const orders=(data.pedidos||[]).map(item=>linkedIds.has(String(item.id))&&String(item.cotacaoId||"")===String(quote.id)?{
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

// Achado ao completar a lacuna de comandos de Compras (24/08/2026, ver
// docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): anexar documento a uma proposta
// de cotação (ComprasView.jsx, salvarDocumentoCotacao) era a última
// escrita do domínio ainda feita por update() direto. Espelha
// attachDocument (pedidos) - a diferença é que o documento pertence a uma
// PROPOSTA dentro da cotação, não à cotação diretamente. O cache de pasta
// do OneDrive em `data.obras` continua fora deste comando, de propósito:
// mesmo padrão já usado por PURCHASE_ORDER_DOCUMENT_ATTACHED em
// LegacyApp.jsx (dispatchCommand só para o domínio auditado; a
// atualização do campo de cache em `obras` é um update() best-effort
// separado, feito pelo chamador depois que o comando confirma).
const attachQuoteDocument=(data,command,now)=>{
  const payload=command.payload||{},quote=quoteById(data,payload.quoteId);
  if(!quote)return fail("Cotação não encontrada.");
  if(quote.status!=="aberta"){
    return fail("Esta cotação já foi decidida ou cancelada e não recebe mais documentos.");
  }
  if(!sameVersion(quote,command.expectedVersion)){
    return fail("A cotação foi alterada por outra pessoa. Atualize a tela.");
  }
  const proposal=(quote.propostas||[]).find(item=>String(item.id)===String(payload.proposalId));
  if(!proposal)return fail("A proposta não pertence a esta cotação.");
  const document=payload.document||{};
  if(!document.id||!String(document.nome||"").trim()||!String(document.url||"").trim()){
    return fail("O documento da cotação está incompleto.");
  }
  if((proposal.documentos||[]).some(item=>String(item.id)===String(document.id))){
    return fail("Este documento já está vinculado a esta proposta.");
  }
  const actor=actorOf(command);
  const updated={
    ...quote,
    propostas:(quote.propostas||[]).map(item=>String(item.id)===String(proposal.id)
      ?{...item,documentos:[...(item.documentos||[]),{...document}]}:item),
    version:versionOf(quote)+1,updatedAt:now,updatedById:actor.id,updatedBy:actor.nome,
  };
  return {
    ok:true,entityId:quote.id,
    data:{...data,cotacoes:(data.cotacoes||[]).map(item=>item.id===quote.id?updated:item)},
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
  if(command.type===PURCHASE_ORDER_COMMAND.QUOTATION_SAVED){
    return String(quoteById(data,payload.quote?.id)?.obraId||payload.quote?.obraId||"");
  }
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED){
    return String(quoteById(data,payload.quoteId)?.obraId||"");
  }
  if(command.type===PURCHASE_ORDER_COMMAND.QUOTE_MAP_DECIDED){
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
  if(command.type===PURCHASE_ORDER_COMMAND.QUOTATION_SAVED)return saveQuote(data,command,now);
  if(command.type===PURCHASE_ORDER_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED){
    return attachQuoteDocument(data,command,now);
  }
  if(command.type===PURCHASE_ORDER_COMMAND.QUOTE_MAP_DECIDED)return decideQuoteMap(data,command,now);
  return cancelQuote(data,command,now);
};
