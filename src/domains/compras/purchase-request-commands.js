import { validatePurchaseRequest } from "./purchase-request-workflow.js";
import { hasValidUnitConversion } from "./unit-conversion.js";

export const PURCHASE_REQUEST_COMMAND=Object.freeze({
  PURCHASE_REQUEST_SAVED:"SOLICITACAO_COMPRA_SALVA",
  PURCHASE_REQUEST_CANCELLED:"SOLICITACAO_COMPRA_CANCELADA",
});

export const PURCHASE_REQUEST_COMMAND_TYPES=new Set(Object.values(PURCHASE_REQUEST_COMMAND));

const fail=reason=>({ok:false,reason});
const versionOf=item=>Number(item?.version||0);
const requestById=(data,id)=>(data.solicitacoesCompra||[]).find(item=>String(item.id)===String(id));

const normalizeCatalogMaterials=(data,requestId,rawMaterials=[])=>{
  if(!Array.isArray(rawMaterials)||rawMaterials.length>500){
    return {error:"A lista de insumos da solicitação é inválida."};
  }
  const catalog=new Map((data.materiais||[]).map(item=>[String(item.id),item]));
  const changed=[];
  for(const raw of rawMaterials){
    const id=String(raw?.id||""),description=String(raw?.descricao||"").trim();
    if(!id||!description)return {error:"A solicitação contém um insumo sem identificação ou descrição."};
    const current=catalog.get(id);
    if(current&&String(current.solicitacaoOrigemId||"")!==String(requestId)){
      return {error:"Um insumo compartilhado do catálogo não pode ser sobrescrito pela solicitação."};
    }
    const price=Number(raw.precoMedio||0);
    if(!Number.isFinite(price)||price<0)return {error:"O preço de referência do insumo é inválido."};
    const material={...current,...raw,id,descricao:description,
      unidade:String(raw.unidade||current?.unidade||"UN").trim()||"UN",
      precoMedio:price,ativo:raw.ativo!==false,solicitacaoOrigemId:requestId};
    catalog.set(id,material);changed.push(material);
  }
  return {materials:[...catalog.values()],changed};
};

const saveRequest=(data,command,now)=>{
  const payload=command.payload||{},raw=payload.request||{};
  const id=String(raw.id||""),obraId=String(raw.obraId||"");
  const current=requestById(data,id);
  if(!id)return fail("Solicitação sem identificação única.");
  if(current?.status==="cancelada")return fail("Esta solicitação foi cancelada e não pode mais ser editada.");
  if(!(data.obras||[]).some(item=>String(item.id)===obraId))return fail("Selecione uma obra existente para a solicitação.");
  if(current&&versionOf(current)!==Number(command.expectedVersion)){
    return fail("A solicitação foi alterada por outra pessoa. Atualize a tela e tente novamente.");
  }
  if(!current&&Number(command.expectedVersion)!==0)return fail("A criação da solicitação exige versão inicial zero.");
  const validation=validatePurchaseRequest(raw);
  if(!validation.valid)return fail("Revise os campos e materiais da solicitação antes de formalizar.");
  if((raw.itens||[]).some(item=>!item?.id||!hasValidUnitConversion(item))){
    return fail("A solicitação contém item sem identificação ou conversão de unidade válida.");
  }
  if((data.solicitacoesCompra||[]).some(item=>String(item.id)!==id&&String(item.numero||"")===String(raw.numero||""))){
    return fail("Já existe uma solicitação com este número.");
  }
  const catalogResult=normalizeCatalogMaterials(data,id,payload.catalogMaterials||[]);
  if(catalogResult.error)return fail(catalogResult.error);
  const validMaterialIds=new Set(catalogResult.materials.map(item=>String(item.id)));
  if((raw.itens||[]).some(item=>!validMaterialIds.has(String(item.materialId||"")))){
    return fail("Todos os itens precisam estar vinculados a insumos persistidos no catálogo.");
  }
  const actorName=String(command.actorName||"").trim()||"Usuário autenticado";
  const saved={...current,...raw,id,obraId,status:current?.status||"aberta",
    version:versionOf(current)+1,atualizadoEm:now,updatedAt:now,
    atualizadoPor:actorName,updatedBy:actorName,updatedById:String(command.actorId||""),
    ...(!current?{criadoEm:raw.criadoEm||now,criadoPor:raw.criadoPor||actorName,
      criadoPorId:raw.criadoPorId||String(command.actorId||"")}:{})};
  let next={...data,materiais:catalogResult.materials,
    solicitacoesCompra:current
      ?(data.solicitacoesCompra||[]).map(item=>String(item.id)===id?saved:item)
      :[...(data.solicitacoesCompra||[]),saved]};
  const approval=payload.approvalInstance;
  if(approval?.id){
    const existing=(next.instanciasAprovacao||[]).some(item=>String(item.id)===String(approval.id));
    next={...next,instanciasAprovacao:existing
      ?(next.instanciasAprovacao||[]).map(item=>String(item.id)===String(approval.id)?approval:item)
      :[...(next.instanciasAprovacao||[]),approval]};
  }
  return {ok:true,entityId:id,data:next};
};

// Cancelamento é sempre soft-delete (status:"cancelada") - mesmo padrão de
// EQUIPMENT_RENTAL_CANCELLED (src/domains/equipamentos/commands.js): o
// registro nunca é removido do array, só marcado. Não existia nenhum
// comando de cancelamento/exclusão de solicitação de compra até esta
// mudança (24/08/2026, ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md) - o único
// jeito de "remover" uma solicitação de teste era um utilitário
// administrativo estreito que removia a linha de verdade do array, sem
// nenhuma auditoria de negócio.
const cancelRequest=(data,command,now)=>{
  const payload=command.payload||{};
  const id=String(payload.requestId||"");
  const current=requestById(data,id);
  if(!id||!current)return fail("Solicitação não encontrada.");
  if(current.status==="cancelada")return fail("Esta solicitação já foi cancelada.");
  if(versionOf(current)!==Number(command.expectedVersion)){
    return fail("A solicitação foi alterada por outra pessoa. Atualize a tela e tente novamente.");
  }
  const reason=String(payload.reason||"").trim();
  const actorName=String(command.actorName||"").trim()||"Usuário autenticado";
  const saved={...current,status:"cancelada",version:versionOf(current)+1,
    atualizadoEm:now,updatedAt:now,atualizadoPor:actorName,updatedBy:actorName,
    updatedById:String(command.actorId||""),
    canceladoEm:now,canceladoPor:actorName,canceladoPorId:String(command.actorId||""),
    motivoCancelamento:reason};
  const next={...data,solicitacoesCompra:(data.solicitacoesCompra||[])
    .map(item=>String(item.id)===id?saved:item)};
  return {ok:true,entityId:id,data:next};
};

export const purchaseRequestCommandObraId=(data={},command={})=>{
  if(!PURCHASE_REQUEST_COMMAND_TYPES.has(command?.type))return "";
  const requestId=command.payload?.request?.id||command.payload?.requestId;
  const request=command.payload?.request||{};
  return String(requestById(data,requestId)?.obraId||request.obraId||"");
};

export const applyPurchaseRequestCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!PURCHASE_REQUEST_COMMAND_TYPES.has(command.type))return null;
  if(!command.actorId)return fail("Sessão do usuário indisponível para salvar a solicitação.");
  if(command.type===PURCHASE_REQUEST_COMMAND.PURCHASE_REQUEST_CANCELLED)return cancelRequest(data,command,now);
  return saveRequest(data,command,now);
};
