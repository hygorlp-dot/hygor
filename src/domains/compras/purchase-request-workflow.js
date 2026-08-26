const text=value=>String(value??"").trim();

const validatePurchaseRequestItem=(item,index=0)=>{
  const errors={};
  if(!text(item?.descricaoRef))errors.descricaoRef="Informe a descrição do material.";
  if(!text(item?.unidadeRef))errors.unidadeRef="Informe a unidade de referência.";
  if(!(Number(item?.quantidade)>0))errors.quantidade="Informe uma quantidade maior que zero.";
  const referenceUnit=text(item?.unidadeRef||"UN").toUpperCase();
  const purchaseUnit=text(item?.unidadeCompra||referenceUnit).toUpperCase();
  if(purchaseUnit!==referenceUnit&&!(Number(item?.fatorConversao)>0)){
    errors.fatorConversao=`Informe quanto contém cada ${purchaseUnit}.`;
  }
  return {index,id:item?.id||String(index),errors,valid:Object.keys(errors).length===0};
};

export const validatePurchaseRequest=form=>{
  const fieldErrors={};
  if(!text(form?.obraId))fieldErrors.obraId="Selecione a obra.";
  if(!text(form?.necessidade))fieldErrors.necessidade="Informe a data necessária na obra.";
  if(form?.prioridade==="urgente"&&!text(form?.observacao)){
    fieldErrors.observacao="Explique o motivo e o impacto da urgência.";
  }
  const items=(form?.itens||[]).map(validatePurchaseRequestItem);
  if(!items.length)fieldErrors.itens="Adicione ao menos um material.";
  return {
    valid:Object.keys(fieldErrors).length===0&&items.every(item=>item.valid),
    fieldErrors,items,
    firstInvalidItem:items.find(item=>!item.valid)||null,
  };
};

export const changePurchaseRequestProject=(form,obraId)=>({
  ...form,obraId,
  itens:(form?.itens||[]).map(item=>({...item,orcItemId:"",orcNivel1Id:""})),
});

export const purchaseRequestSummary=form=>({
  itemCount:(form?.itens||[]).length,
  totalQuantity:(form?.itens||[]).reduce((total,item)=>total+Number(item?.quantidade||0),0),
  urgent:form?.prioridade==="urgente",
});
