// Comandos operacionais são a fronteira transitória entre o LegacyApp e uma
// persistência por agregado. Eles são puros para poderem ser exercitados sem
// navegador e, principalmente, não fazem "last write wins" para a mesma
// entidade. A migração do endpoint para comandos usa este mesmo contrato.
export const OPERATIONAL_COMMAND = Object.freeze({
  TECHNICAL_MEASUREMENT_CREATED:"MEDICAO_TECNICA_CRIADA",
  TECHNICAL_MEASUREMENT_CANCELLED:"MEDICAO_TECNICA_CANCELADA",
  FIELD_REPORT_CHANGED:"RDO_CAMPO_ALTERADO",
  FIELD_REPORT_CANCELLED:"RDO_CANCELADO",
  PURCHASE_RECEIPT_RECORDED:"PEDIDO_RECEBIMENTO_REGISTRADO",
});

const receipts=data=>Array.isArray(data?.operationalCommandReceipts)?data.operationalCommandReceipts:[];
const versionOf=entity=>Number(entity?.version||0);
const fail=reason=>({ok:false,reason});
const appendReceipt=(data,command,entityId,now)=>({
  ...data,
  operationalCommandReceipts:[...receipts(data),{
    idempotencyKey:command.idempotencyKey,type:command.type,entityId,
    appliedAt:now,actorId:command.actorId||"",
  }].slice(-2000),
});
const commandIsValid=command=>command&&typeof command.type==="string"&&String(command.idempotencyKey||"").length>=8;
const duplicate=(data,key)=>receipts(data).some(item=>item.idempotencyKey===key);
const requiresVersion=(current,expected,label)=>{
  if(expected==null)return "";
  return versionOf(current)===Number(expected)?"":`${label} foi alterado por outra pessoa. Atualize a tela antes de tentar novamente.`;
};

export const applyOperationalCommand=(data,command)=>{
  if(!commandIsValid(command))return fail("Comando operacional sem chave idempotente válida.");
  if(duplicate(data,command.idempotencyKey))return {ok:true,idempotent:true,data};
  const now=command.now||new Date().toISOString();

  if(command.type===OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED){
    const measurement=command.payload?.measurement;
    if(!measurement?.id)return fail("Medição técnica sem identificação.");
    if((data?.medicoesObra||[]).some(item=>item.id===measurement.id))return fail("Já existe uma medição técnica com esta identificação.");
    const next={...data,medicoesObra:[...(data?.medicoesObra||[]),{...measurement,version:1,createdAt:measurement.createdAt||now,updatedAt:now}]};
    return {ok:true,data:appendReceipt(next,command,measurement.id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED){
    const id=String(command.payload?.measurementId||"");
    const current=(data?.medicoesObra||[]).find(item=>item.id===id);
    if(!current)return fail("Medição técnica não encontrada.");
    const versionError=requiresVersion(current,command.expectedVersion,"A medição técnica");
    if(versionError)return fail(versionError);
    if(["cancelada","cancelado"].includes(current.status))return fail("A medição técnica já está cancelada.");
    const cancelled={...current,status:"cancelada",motivoCancelamento:String(command.payload?.reason||"").trim(),canceladaEm:now,canceladaPorId:command.actorId||"",canceladaPor:command.actorName||"",updatedAt:now,version:versionOf(current)+1};
    const next={...data,medicoesObra:(data.medicoesObra||[]).map(item=>item.id===id?cancelled:item)};
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED){
    const report=command.payload?.report;
    if(!report?.id)return fail("Diário de obra sem identificação.");
    const current=(data?.rdos||[]).find(item=>item.id===report.id);
    if(current){
      const versionError=requiresVersion(current,command.expectedVersion,"O diário de obra");
      if(versionError)return fail(versionError);
      const updated={...current,...report,id:current.id,createdAt:current.createdAt||current.criadoEm||now,criadoEm:current.criadoEm||current.createdAt||now,updatedAt:now,atualizadoEm:now,version:versionOf(current)+1};
      const next={...data,rdos:(data.rdos||[]).map(item=>item.id===current.id?updated:item)};
      return {ok:true,data:appendReceipt(next,command,current.id,now)};
    }
    if(command.expectedVersion!=null&&Number(command.expectedVersion)!==0)return fail("O diário de obra ainda não existe na versão esperada.");
    const created={...report,version:1,createdAt:report.createdAt||report.criadoEm||now,criadoEm:report.criadoEm||report.createdAt||now,updatedAt:now,atualizadoEm:now};
    const next={...data,rdos:[...(data?.rdos||[]),created]};
    return {ok:true,data:appendReceipt(next,command,created.id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED){
    const id=String(command.payload?.reportId||"");
    const current=(data?.rdos||[]).find(item=>item.id===id);
    if(!current)return fail("Diário de obra não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O diário de obra");
    if(versionError)return fail(versionError);
    if(current.status==="cancelado")return fail("O diário de obra já está cancelado.");
    const cancelled={...current,status:"cancelado",motivoCancelamento:String(command.payload?.reason||"").trim(),canceladoEm:now,canceladoPorId:command.actorId||"",canceladoPor:command.actorName||"",updatedAt:now,atualizadoEm:now,version:versionOf(current)+1};
    const next={...data,rdos:(data.rdos||[]).map(item=>item.id===id?cancelled:item)};
    return {ok:true,data:appendReceipt(next,command,id,now)};
  }

  if(command.type===OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED){
    const pedidoId=String(command.payload?.pedidoId||"");
    const current=(data?.pedidos||[]).find(item=>item.id===pedidoId);
    if(!current)return fail("Pedido não encontrado.");
    const versionError=requiresVersion(current,command.expectedVersion,"O pedido");
    if(versionError)return fail(versionError);
    const quantities=command.payload?.receivedQuantities;
    const entries=Array.isArray(command.payload?.stockEntries)?command.payload.stockEntries:[];
    if(!quantities||!entries.length)return fail("Recebimento de pedido incompleto.");
    const ids=new Set((data?.movEstoque||[]).map(item=>item.id));
    if(entries.some(item=>!item?.id||ids.has(item.id)))return fail("Há uma entrada de estoque duplicada neste recebimento.");
    const byItem=new Map((current.itens||[]).map(item=>[item.id,item]));
    const requested=Object.entries(quantities).filter(([,value])=>Number(value)>0);
    if(!requested.length)return fail("Informe ao menos uma quantidade recebida.");
    for(const [itemId,value] of requested){
      const item=byItem.get(itemId),quantity=Number(value);
      if(!item||!Number.isFinite(quantity)||quantity<=0)return fail("Item de recebimento inválido.");
      if(quantity>Number(item.qtd||0)-Number(item.qtdRecebida||0)+1e-6)return fail("Recebimento excede o saldo do pedido.");
    }
    if(entries.length!==requested.length||entries.some(entry=>{
      const item=byItem.get(entry?.pedidoItemId||"");
      return !item||entry.pedidoId!==current.id||entry.obraId!==current.obraId||entry.materialId!==item.materialId||Math.abs(Number(entry.qtd||0)-Number(quantities[item.id]||0))>=1e-6;
    }))return fail("Entradas de estoque não correspondem ao recebimento informado.");
    const updated={...current,itens:(current.itens||[]).map(item=>{
      const quantity=Number(quantities[item.id]||0);
      return quantity>0?{...item,qtdRecebida:Number(item.qtdRecebida||0)+quantity,recebimentos:[...(item.recebimentos||[]),{id:entries.find(entry=>entry.pedidoItemId===item.id)?.receiptId||`${command.idempotencyKey}:${item.id}`,data:entries.find(entry=>entry.pedidoItemId===item.id)?.data||now.slice(0,10),qtd:quantity,precoUnit:Number(item.precoUnit||0),responsavelId:command.actorId||"",responsavel:command.actorName||"",registradoEm:now}]}:item;
    }),id:current.id,version:versionOf(current)+1,updatedAt:now};
    const receivedMaterialIds=new Set(requested.map(([itemId])=>byItem.get(itemId).materialId));
    const materials=(data?.materiais||[]).map(material=>{
      if(!receivedMaterialIds.has(material.id))return material;
      const item=(current.itens||[]).find(entry=>entry.materialId===material.id&&Number(quantities[entry.id]||0)>0);
      return {...material,precoMedio:Number(item?.precoUnit||material.precoMedio||0)};
    });
    const next={...data,pedidos:(data.pedidos||[]).map(item=>item.id===pedidoId?updated:item),movEstoque:[...(data?.movEstoque||[]),...entries],materiais:materials};
    return {ok:true,data:appendReceipt(next,command,pedidoId,now)};
  }

  return fail("Tipo de comando operacional não suportado.");
};
