import {selectCommitments} from './ledger.js';
import {positionEntries} from './workspace.js';
import {serviceContractPositions} from '../compras/service-contract-position.js';

const total=(rows,key)=>{
 if(rows.some(row=>!Number.isSafeInteger(row[key])||row[key]<0))return null;
 const result=rows.reduce((sum,row)=>sum+row[key],0);
 return Number.isSafeInteger(result)?result:null;
};

// Posição atual, não uma reconstrução histórica. Os saldos ficam separados:
// não há vínculo universal entre contrato de serviço, pedido e estoque que
// comprove que os três representam compromissos economicamente distintos.
export function workCommitments(data,ledger,obraId){
 if(!obraId||!(data.obras||[]).some(work=>String(work.id)===String(obraId)))return null;
 const work=(data.obras||[]).find(work=>String(work.id)===String(obraId));
 const purchases=positionEntries(data,selectCommitments(ledger,{obraId}));
 const services=serviceContractPositions(data,{workIds:[obraId],includeInactive:true,ledger})
  .filter(row=>row.canMeasure&&!['concluido','concluida','encerrado','encerrada'].includes(String(row.contract.status||'').trim().toLowerCase()))
  .map(row=>{
   const contract=row.contract;
   const explicit=contract.contractValue;
   const values=explicit!=null&&explicit!==''&&Number(explicit)!==0?[explicit]:(contract.etapas||[]).map(stage=>stage.valor);
   const issues=[...row.issues.map(issue=>issue.description)];
   const valid=values.length>0&&values.every(value=>value!==''&&value!=null&&Number.isFinite(Number(value))&&Number(value)>=0&&Number.isSafeInteger(Math.round(Number(value)*100)))&&Number.isSafeInteger(row.contractCents);
   if(!valid)issues.push('Valor contratado ausente ou inválido. Confira o cadastro em Terceiros.');
   if(row.approvedCents>row.contractCents)issues.push('As medições aprovadas superam o valor contratado. Confira as medições e os aditivos.');
   if(row.overpaidCents>0)issues.push('Há liquidação acima da obrigação. Confira os pagamentos vinculados.');
   if(row.unallocated.length)issues.push('Há pagamento sem medição vinculada. Ele não reduz automaticamente o saldo a medir.');
   const remainingCents=valid?row.remainingCents:null;
   return {id:String(contract.id),name:contract.name||'Contrato sem nome',contractCents:valid?row.contractCents:null,
    approvedCents:row.approvedCents,pendingCents:row.pendingCents,balanceCents:row.balanceCents,remainingCents,issues,
    entry:{id:`contract-commitment:${contract.id}`,description:`Saldo a medir · ${contract.name||'Terceirizado'}`,counterparty:contract.name||'',
     sourceType:'contrato_terceiro',sourceId:String(contract.id),obraId:work.id,obra:work.name,amountCents:remainingCents??0,
     record:{nome:contract.name||'',contratado:valid?row.contractCents/100:'Não disponível',medicoesAprovadas:row.approvedCents/100,medicoesEmRevisao:row.pendingCents/100,aPagarDasMedicoes:row.balanceCents/100,saldoAMedir:remainingCents==null?'Não disponível':remainingCents/100},
     note:`Posição atual dos cadastros. Saldo a medir = contratado menos medições aprovadas, limitado a zero. Rascunhos e pagamentos não reduzem esse saldo. ${issues.join(' ')}`}};
  });
 const calculable=services.filter(row=>row.remainingCents!==null);
 return {purchases,services,purchaseCents:total(purchases,'amountCents'),serviceCents:total(calculable,'remainingCents'),
  incompleteCount:services.length-calculable.length,reviewCount:services.filter(row=>row.issues.length).length};
}
