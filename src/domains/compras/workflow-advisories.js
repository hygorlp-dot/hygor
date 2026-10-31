// Pendências operacionais orientam; nunca autorizam, bloqueiam ou concluem etapas.
// Vínculos vêm dos IDs e da obra. Descrição, nome e valor não criam associação.
const active=item=>item&&item.ativo!==false&&!item.deletedAt&&!['cancelado','cancelada','estornado','estornada','rejeitada'].includes(item.status);
const same=(a,b)=>a!=null&&b!=null&&String(a)!==''&&String(a)===String(b);
const cents=value=>Math.round(Number(value||0)*100);
const sum=(items,amount)=>items.reduce((total,item)=>total+amount(item),0);
export const operationalWarning=(code,stage,owner,message,resolution)=>({code,stage,owner,message,resolution,blocking:false});

export function purchaseWorkflow(data,order){
 if(!order)return {stages:[],warnings:[]};
 const warnings=[];
 const warn=(...args)=>warnings.push(operationalWarning(...args));
 const lines=order.itens||[];
 const invoices=(data.notasFiscais||[]).filter(item=>active(item)&&same(item.pedidoId,order.id)&&same(item.obraId,order.obraId));
 const request=(data.solicitacoesCompra||[]).find(item=>same(item.id,order.solicitacaoId)&&same(item.obraId,order.obraId));
 const approval=(data.instanciasAprovacao||[]).find(item=>same(item.id,request?.aprovacaoInstanciaId));
 if(approval&&approval.status!=='aprovada')warn('APPROVAL_PENDING','compra','Responsável pela aprovação','A compra tem aprovação pendente ou recusada.','Consulte a decisão em Aprovações e registre a regularização. O pedido pode seguir sem alterar essa decisão.');
 if(order.status==='rascunho'||(order.pedidoNaoEnviadoNoRecebimento||order.pedidoNaoEnviadoNoPagamento)&&!order.envios?.length)warn('ORDER_NOT_SENT','compra','Compras','O envio do pedido ao fornecedor precisa ser conferido.','Confira as condições e registre o envio ao fornecedor quando ele ocorrer.');
 const stored=(order.workflowWarnings||[]).filter(item=>['APPROVAL_LIMIT_EXCEEDED','QUOTE_APPROVAL_LIMIT_EXCEEDED','QUOTE_JUSTIFICATION_MISSING'].includes(item.code));
 for(const item of stored)warnings.push({...item,blocking:false});
 const pending=lines.filter(item=>Number(item.qtdRecebida||0)<Number(item.qtd||0));
 const exceeded=lines.filter(item=>Number(item.qtdRecebida||0)>Number(item.qtd||0)+1e-6);
 const anyReceipt=lines.some(item=>Number(item.qtdRecebida||0)>0);
 if(pending.length)warn('DELIVERY_PENDING','recebimento','Responsável pelo recebimento na obra',`${pending.length} item(ns) ainda têm saldo de entrega.`, 'Registre apenas o que chegou e acompanhe o restante com o fornecedor. Entrega pendente não impede nota ou pagamento.');
 if(exceeded.length)warn('RECEIPT_EXCEEDS_ORDER','recebimento','Compras e responsável pelo recebimento','Há quantidade recebida acima do pedido.','Confira a entrega com o fornecedor e ajuste o pedido ou registre a devolução no fluxo disponível, mantendo o histórico.');
 if(!invoices.length)warn('INVOICE_MISSING','documento','Financeiro / conferência fiscal','Não há nota fiscal ativa vinculada ao pedido.','Receba o documento fiscal e vincule-o ao pedido. Recebimento e pagamento podem ser registrados antes disso.');
 const unreviewed=invoices.filter(item=>!['aprovada','paga'].includes(item.status)||item.conferenciaFiscalPendente);
 if(unreviewed.length)warn('INVOICE_REVIEW_PENDING','documento','Financeiro / conferência fiscal','Há documento fiscal com conferência pendente.','Confira a ficha fiscal e registre a decisão. Um pagamento não deve aprovar a nota automaticamente.');
 if(invoices.some(item=>item.divergencias?.length))warn('INVOICE_DIFFERENCES','documento','Compras e Financeiro','Há divergências registradas no documento fiscal.','Compare pedido, entrega e nota; registre a correção ou a decisão de conferência sem apagar a divergência.');
 const paidById=new Map();
 for(const payment of [order,...invoices].flatMap(item=>item.pagamentos||[]).filter(active)){
  // O mesmo pagamento pode estar espelhado na nota e no pedido.
  if(payment.id)paidById.set(String(payment.id),Math.max(paidById.get(String(payment.id))||0,cents(payment.valor)));
 }
 const paidCents=sum([...paidById.values()],value=>value);
 const orderedCents=sum(lines,item=>cents(Number(item.qtd||0)*Number(item.precoUnit||0)));
 const receivedCents=sum(lines,item=>cents(Number(item.qtdRecebida||0)*Number(item.precoUnit||0)));
 const invoicedCents=sum(invoices,item=>cents(item.valorBruto??item.valorLiquido));
 if(paidCents>orderedCents+1)warn('PAYMENTS_EXCEED_ORDER','pagamento','Financeiro','Os pagamentos vinculados ultrapassam o valor do pedido.','Confira adiantamentos, espelhos e pagamentos adicionais antes de qualquer novo lançamento. Use o estorno de origem para corrigir um registro indevido.');
 if(paidCents>Math.min(receivedCents,invoicedCents)+1)warn('PAYMENT_AHEAD_OF_CONFERENCE','pagamento','Financeiro','Há pagamento anterior à conferência completa da entrega e da nota.','Confira o adiantamento e complete os vínculos de entrega e documento. Não registre o mesmo pagamento novamente.');
 const entries=(data.movEstoque||[]).filter(item=>active(item)&&same(item.pedidoId,order.id)&&same(item.obraId,order.obraId)&&item.tipo==='entrada');
 if(anyReceipt&&!entries.length)warn('STOCK_ENTRY_NOT_FOUND','estoque','Responsável pelo estoque','O pedido tem recebimento, mas não foi localizada uma entrada de estoque vinculada.','Confira o histórico do estoque e a origem do recebimento antes de lançar outra entrada.');
 return {warnings,stages:[
  {id:'compra',label:'Compras',owner:'Compras',status:order.status==='rascunho'?'Rascunho':'Pedido registrado'},
  {id:'recebimento',label:'Recebimento',owner:'Responsável na obra',status:exceeded.length?'Quantidade a conferir':pending.length?anyReceipt?'Parcial':'Aguardando entrega':'Registrado'},
  {id:'documento',label:'Documento fiscal',owner:'Financeiro',status:!invoices.length?'Sem nota vinculada':unreviewed.length?'Em conferência':'Conferido'},
  {id:'pagamento',label:'Pagamento',owner:'Financeiro',status:!paidCents?'Não registrado':paidCents>=orderedCents?'Registrado':'Parcial'},
  {id:'estoque',label:'Estoque',owner:'Responsável pelo estoque',status:entries.length?'Entrada vinculada':anyReceipt?'Conferir vínculo':'Aguardando entrada'},
 ],amounts:{orderedCents,receivedCents,invoicedCents,paidCents}};
}
