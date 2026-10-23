import {active} from "../financeiro/ledger.js";

export const validateExistingPaymentLink=(data,{transaction,tipo,entidadeId,pagamentoId})=>{
  const find=(section,id)=>(data[section]||[]).find(item=>item.id===id);
  let candidates=[],sign=-1,parent;
  if(["nota","nota_fiscal","pagamentoNota","pedido","pagamentoPedido"].includes(tipo)){
    parent=find(["pedido","pagamentoPedido"].includes(tipo)?"pedidos":"notasFiscais",entidadeId);
    candidates=parent?.pagamentos||[];
  }else if(tipo==="caixaObra"){
    parent=find("caixaObra",entidadeId);candidates=parent?[parent]:[];
    sign=["receita","entrada","aporte"].includes(parent?.tipo)?1:-1;
  }else if(tipo==="pagsTerceiros"){
    parent=find("pagsTerceiros",pagamentoId||entidadeId);candidates=parent?[parent]:[];
  }else if(tipo==="medicao"){
    parent=find("medicoes",entidadeId);candidates=parent?.recebimentos||[];sign=1;
  }else if(tipo==="medicaoTerc"){
    parent=find("medicoesTerc",entidadeId);candidates=(data.pagsTerceiros||[]).filter(item=>item.medicaoTercId===entidadeId);
  }else if(tipo==="funcionario"){
    parent=find("employees",entidadeId);candidates=(data.pagamentosFolha||[]).filter(item=>(item.employeeId||item.funcionarioId)===entidadeId);
  }else if(tipo==="tituloFolha"){
    parent=find("titulosFolha",entidadeId);candidates=parent?.liquidacoes||[];
  }
  if(!parent||!active(parent)||parent.active===false)return {error:"O fato financeiro selecionado não existe ou está inativo."};
  const value=Math.abs(Number(transaction.valor));
  const amount=item=>Number(item.valor??item.amount??0);
  candidates=candidates.filter(active).filter(item=>pagamentoId?item.id===pagamentoId:Math.abs(amount(item)-value)<=0.01);
  if(candidates.length!==1)return {error:"Selecione um único pagamento existente com valor compatível."};
  const payment=candidates[0];
  if(Math.sign(Number(transaction.valor))!==sign)return {error:"A direção bancária é incompatível com o pagamento ou recebimento."};
  if(Math.abs(amount(payment)-value)>0.01)return {error:"O valor da transação bancária diverge do pagamento existente."};
  if(payment.transacaoId&&payment.transacaoId!==transaction.id)return {error:"O pagamento já está vinculado a outra transação bancária."};
  if((data.transacoes||[]).some(item=>item.id!==transaction.id&&item.status==="conciliado"&&
    (item.vinculo?.pagamentoId===payment.id||(item.gerados||[]).some(g=>g===payment.id||g?.id===payment.id))))return {error:"O pagamento já está conciliado em outra transação."};
  const mirrors=[...(data.pedidos||[]),...(data.notasFiscais||[])].flatMap(item=>item.pagamentos||[]);
  if(mirrors.some(item=>item.id===payment.id&&item.transacaoId&&item.transacaoId!==transaction.id))return {error:"Um espelho do pagamento já está vinculado a outra transação."};
  return {payment};
};

// The same payment ID may be mirrored in invoice and order. Update the
// association on both, preserving the actual amount, date and identity.
export const updatePaymentAssociation=(data,{paymentId,transactionId,linked,actor})=>{
  const update=payment=>payment.id===paymentId&&(linked||payment.transacaoId===transactionId)
    ?{...payment,conciliado:linked,transacaoId:linked?transactionId:null}:payment;
  const parents=(rows,field)=>(rows||[]).map(parent=>{
    const original=parent[field]||[],payments=original.map(update);
    return payments.some((p,i)=>p!==original[i])?{...parent,[field]:payments,version:Number(parent.version||0)+1,
      updatedAt:new Date().toISOString(),updatedById:actor?.id||""}:parent;
  });
  return {...data,pedidos:parents(data.pedidos,"pagamentos"),notasFiscais:parents(data.notasFiscais,"pagamentos"),
    medicoes:parents(data.medicoes,"recebimentos"),titulosFolha:parents(data.titulosFolha,"liquidacoes"),
    pagsTerceiros:(data.pagsTerceiros||[]).map(update),pagamentosFolha:(data.pagamentosFolha||[]).map(update),
    caixaObra:(data.caixaObra||[]).map(update),
    // Legacy expenses already represent real settlements. Unmatching must
    // preserve their paid state even when the old record only had a bank ID.
    ...Object.fromEntries(["outrasDesp","despesasEmpresa"].filter(section=>data[section]).map(section=>[section,data[section].map(item=>
      !linked&&item.id===paymentId&&item.transacaoId===transactionId?{...update(item),pago:true}:item)]))};
};

export const stampChangedPurchaseParents=(before,after,actor)=>{
  const next={...after};
  for(const section of ["pedidos","notasFiscais"]){
    if(!after[section])continue;
    next[section]=after[section].map(parent=>{
      const original=(before[section]||[]).find(item=>item.id===parent.id);
      if(!original||JSON.stringify(parent)===JSON.stringify(original)||Number(parent.version||0)>Number(original.version||0))return parent;
      return {...parent,version:Number(original.version||0)+1,updatedAt:new Date().toISOString(),updatedById:actor?.id||""};
    });
  }
  return next;
};
