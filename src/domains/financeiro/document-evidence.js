import {active} from './ledger.js';
import {financialDocumentUrl,protectedDocumentReference} from './document-links.js';

export function documentEvidenceInfo(document={},driveId){
 const url=financialDocumentUrl(document.url||document.webUrl);
 const drive=document.driveId||document.parentReference?.driveId||driveId;
 const reference=protectedDocumentReference(url)||(drive&&document.id?{driveId:String(drive),itemId:String(document.id)}:null);
 return {url,reference,resolvable:Boolean(url||reference),state:url||reference?'registered':'unavailable'};
}

/** Keep the actual record/payment/receipt provenance; never match by text or amount. */
export function entryEvidenceDocuments(entry={}){
 const record=entry.record||{};
 const paymentSource=['cash_in','cash_out','payable_decrease','receivable_decrease'].includes(entry.effect)||String(entry.sourceType||'').startsWith('pagamento');
 const specific=paymentSource&&entry.sourceSubId&&[...(record.pagamentos||[]),...(record.recebimentos||[])].find(item=>String(item.id)===String(entry.sourceSubId));
 const related=specific?[specific]:[...(record.pagamentos||[]),...(record.recebimentos||[])].filter(active);
 return [
  ...(record.documentos||[]),...(record.comprovantes||[]),...(entry.documents||[]),
  ...related.flatMap(item=>[...(item.documentos||[]),...(item.comprovantes||[])]),
  ...(record.itens||[]).flatMap(item=>(item.recebimentos||[]).filter(active).flatMap(receipt=>[...(receipt.documentos||[]),...(receipt.comprovantes||[])])),
  ...(entry.invoices||[]).filter(invoice=>!entry.obraId||!invoice.obraId||String(invoice.obraId)===String(entry.obraId)||invoice.rateios?.some(row=>String(row.obraId)===String(entry.obraId))).flatMap(invoice=>invoice.documentos||[]),
 ].filter(item=>item&&typeof item==='object');
}

export function documentReadError(status,stage='preview'){
 const code=Number(status);
 if(code===401)return {code:'session',message:'A sessão do provedor precisa ser renovada. Confira sua conexão antes de tentar novamente.'};
 if(code===403)return {code:'access',message:'Seu acesso não permite abrir este documento.'};
 if(code===404)return {code:'not_found',message:'Original não encontrado. Confira o vínculo no registro de origem.'};
 if(code===410)return {code:'expired',message:'O endereço do original expirou. Solicite um novo acesso e tente novamente.'};
 return {code:stage==='access'?'access_unavailable':'preview',message:stage==='access'?'Não foi possível obter acesso ao original. Tente novamente.':'Falha na prévia. O vínculo e os dados do registro foram mantidos; tente abrir o original em nova aba.'};
}
