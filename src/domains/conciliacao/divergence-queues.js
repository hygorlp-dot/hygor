const text=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const divergenceLabels={all:'Todas',amount:'Valor divergente',counterparty:'Contraparte divergente',duplicate:'Possível duplicidade',blocked:'Bloqueada',missing:'Sem correspondência',review:'Conferir sugestão',partial:'Vínculo parcial'};
export function reconciliationDivergences(transaction,analysis){
 if(!['pendente','parcial'].includes(transaction.status))return [];
 const c=analysis?.melhorCandidata,tags=[];
 const evidence=text([...(c?.alertas||[]),...(c?.bloqueios||[]),...(c?.motivos||[])].join(' '));
 if(transaction.status==='parcial')tags.push('partial');
 if(/duplic/.test(evidence))tags.push('duplicate');
 if(c&&Number.isFinite(Number(c.saldoCentavos))&&Math.abs(Math.round(Math.abs(Number(transaction.valor))*100)-Number(c.saldoCentavos))>1)tags.push('amount');
 if(/(contraparte|titular|beneficiario|recebedor).*(diverg|difer|incompativ)|(diverg|difer).*(contraparte|titular|beneficiario|recebedor)/.test(evidence))tags.push('counterparty');
 if(c?.bloqueios?.length||analysis?.classificacaoOperacional==='bloqueada')tags.push('blocked');
 if(!c)tags.push('missing');
 return tags.length?tags:['review'];
}
