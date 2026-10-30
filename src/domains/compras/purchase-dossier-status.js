import {urlDocumentoCompra} from "./purchase-dossier.js";
export function purchaseDossierPending(f){
 const orders=f.orders.filter(p=>!["cancelado","rascunho"].includes(p.status)&&!p.deletedAt);
 const pending=[];
 const review=(f.quote?.respostasFornecedor||[]).filter(r=>r.status==="pendente").length;
 if(review)pending.push({key:"origin",label:`${review} resposta(s) de fornecedor para revisar`});
 if(f.approval&&!['aprovada','aprovado'].includes(f.approval.status))pending.push({key:"origin",label:`Conferir aprovação: ${f.approval.status||"sem situação"}`});
 const deliveries=orders.filter(p=>(p.itens||[]).some(i=>Number(i.qtd)>Number(i.qtdRecebida||0)));
 if(deliveries.length)pending.push({key:"orders",label:`${deliveries.length} pedido(s) com itens a receber`});
 const missingInvoices=orders.filter(p=>!f.invoices.some(n=>String(n.pedidoId)===String(p.id)&&!n.deletedAt&&n.ativo!==false&&!['cancelada','cancelado','estornada','estornado'].includes(n.status)));
 if(missingInvoices.length)pending.push({key:"invoices",label:`${missingInvoices.length} pedido(s) sem nota fiscal vinculada`});
 const invalid=f.documents.filter(d=>!urlDocumentoCompra(d)).length;
 if(invalid)pending.push({key:"documents",label:`${invalid} anexo(s) com endereço inválido`});
 return {pending,orders:orders.length,deliveries:deliveries.length,missingInvoices:missingInvoices.length};
}
