import {getActiveBudgetBaseline} from '../orcamentos/calculations.js';
import {isActiveThirdPartyContract} from '../terceirizados/lifecycle.js';
import {selectDRE,selectCommitments,buildFinancialLedger,toCents} from './ledger.js';
import {posicaoDoPedido} from '../compras/purchase-position.js';
import {forecastStageRoot} from './forecast-duplication.js';

export const SERVICE_LINK_COMMAND='VINCULO_PREVISAO_TERCEIRO_SALVO';
const same=(a,b)=>a!=null&&b!=null&&String(a)!==''&&String(a)===String(b);
export const forecastContractActive=c=>c&&!c.deletedAt&&isActiveThirdPartyContract(c)&&!['concluido','concluida','encerrado','encerrada'].includes(String(c.status||'').toLowerCase())&&(c.tipoContrato==='medicao'||c.etapas?.length);
export const serviceContractAmount=c=>{
 const values=c?.contractValue!=null&&c.contractValue!==''&&Number(c.contractValue)!==0?[c.contractValue]:(c?.etapas||[]).map(e=>e.valor);
 if(!values.length||values.some(v=>v==null||v===''||!Number.isFinite(Number(v))||Number(v)<0))return null;
 const total=values.reduce((s,v)=>s+toCents(v),0);return Number.isSafeInteger(total)?total:null;
};
const contractBasis=c=>[String(c.id),String(c.obraId),c.active!==false,String(c.status||'').trim().toLowerCase(),c.tipoContrato||'medicao',Number(c.contractValue||0),(c.etapas||[]).map(e=>[String(e.id),Number(e.valor||0),e.tarefaId||''])];
const orderBasis=o=>[String(o.id),String(o.obraId),posicaoDoPedido(o,[]).viva,[o.valorTotal,o.total,o.valor].map(v=>Number(v||0)),(o.itens||[]).map(i=>[i.id||'',Number(i.qtd||0),Number(i.precoUnit||0),i.orcNivel1Id||'',i.orcItemId||''])];
export function serviceLinkSources(data,contractId,orderIds=[]){
 const c=(data.terceirizados||[]).find(c=>same(c.id,contractId));
 return JSON.stringify([c?contractBasis(c):null,[...orderIds].sort().map(id=>{const o=(data.pedidos||[]).find(o=>same(o.id,id));return o?orderBasis(o):null;})]);
}
export function serviceForecastBasis(data,obraId){
 const work=(data.obras||[]).find(w=>same(w.id,obraId));
 return [(data.terceirizados||[]).filter(c=>same(c.obraId,obraId)).map(contractBasis),work?.costPlanning?.serviceLinks||{},
  Object.values(work?.costPlanning?.serviceLinks||{}).map(link=>serviceLinkSources(data,link.contractId,link.orderIds))];
}
function sourceConflict(data,contract,orderIds,budget,stageId){
 const root=id=>forecastStageRoot(budget,id),orders=(data.pedidos||[]).filter(o=>orderIds.some(id=>same(id,o.id)));
 if(orders.length!==orderIds.length||orders.some(o=>!same(o.obraId,contract.obraId)||!posicaoDoPedido(o,[]).viva))return 'Pedido ausente, inativo ou de outra obra. Reconfira o vínculo.';
 if(orders.some(o=>(o.itens||[]).some(i=>{const id=i.orcNivel1Id||budget.itens?.find(b=>same(b.id,i.orcItemId))?.etapaId;return id&&root(id)!==stageId;})))return 'O pedido possui itens de outra etapa ou de uma etapa removida. Confira a apropriação antes de vincular.';
 const measurements=(data.medicoesTerc||[]).filter(m=>same(m.tercId,contract.id));
 if(measurements.some(m=>!same(m.obraId,contract.obraId)))return 'Há medição com obra divergente. Corrija o vínculo em Terceiros.';
 const invoices=(data.notasFiscais||[]).filter(n=>orderIds.some(id=>same(id,n.pedidoId))||measurements.some(m=>same(m.notaFiscalId,n.id)||same(m.id,n.medicaoTercId)));
 if(invoices.some(n=>n.medicaoTercId&&!measurements.some(m=>same(m.id,n.medicaoTercId))))return 'Uma nota está vinculada a medição de outro contrato. Reconfira as origens.';
 if(invoices.some(n=>(data.medicoesTerc||[]).some(m=>same(m.notaFiscalId,n.id)&&!same(m.tercId,contract.id))))return 'Uma nota possui vínculo com outro contrato. Reconfira as origens.';
 if(invoices.some(n=>!same(n.obraId,contract.obraId)||n.rateios?.some(r=>!same(r.obraId,contract.obraId))))return 'Há nota com obra ou rateio divergente. Confira a nota antes de vincular.';
 if([...measurements,...invoices].some(r=>{const ids=[r.etapaId||r.orcNivel1Id,...(r.rateios||[]).map(a=>a.etapaId)].filter(Boolean);return ids.some(id=>root(id)!==stageId);} ))return 'Há custo explicitamente apropriado em outra etapa. Reconfira a apropriação antes de vincular.';
 return '';
}
export function applyServiceLinkCommand(data,command,now){
 const fail=reason=>({ok:false,reason}),p=command.payload||{};
 if(!command.actorId||!['admin','financeiro'].includes(command.actorRole))return fail('Seu perfil não pode vincular compromissos à previsão.');
 const work=(data.obras||[]).find(w=>same(w.id,p.obraId));
 if(!work)return fail('Obra não encontrada.');
 const planning=work.costPlanning||{},version=Number(planning.version||0);
 if(command.expectedVersion==null||Number(command.expectedVersion)!==version)return fail('A previsão foi alterada por outra pessoa. Atualize a tela.');
 const contract=(data.terceirizados||[]).find(c=>same(c.id,p.contractId)&&same(c.obraId,work.id));
 if(!contract)return fail('Contrato não encontrado nesta obra.');
 const note=String(p.note||'').trim();if(note.length<5||note.length>2000)return fail('Informe uma justificativa de 5 a 2.000 caracteres.');
 const previous=planning.serviceLinks?.[contract.id];
 let link=null;
 if(!p.remove){
  const budget=getActiveBudgetBaseline(data,work.id,'controle').budget;
  if(!budget||!same(budget.obraId,work.id)||budget.id!==p.budgetId)return fail('O orçamento de controle mudou. Atualize a tela.');
  if(!budget.etapas?.some(s=>same(s.id,p.stageId)&&!s.parentId))return fail('Escolha uma etapa de primeiro nível do orçamento de controle.');
  if(!forecastContractActive(contract)||serviceContractAmount(contract)===null)return fail('Confira a situação e o valor do contrato antes de vincular.');
  if(!Array.isArray(p.orderIds)||p.orderIds.length>200||p.orderIds.some(id=>typeof id!=='string'||!id)||new Set(p.orderIds).size!==p.orderIds.length)return fail('Pedidos sobrepostos inválidos.');
  if(p.orderIds.length&&!p.confirmOverlap)return fail('Confirme que os pedidos representam o mesmo escopo do contrato.');
  const sources=serviceLinkSources(data,contract.id,p.orderIds);
  if(p.sources!==sources)return fail('O contrato ou os pedidos mudaram. Reabra o vínculo e confira os dados.');
  const conflict=sourceConflict(data,contract,p.orderIds,budget,p.stageId);if(conflict)return fail(conflict);
  const positions=selectCommitments(buildFinancialLedger(data),{obraId:work.id}).items;
  if(p.orderIds.some(id=>!positions.some(row=>row.sourceType==='pedido'&&same(row.sourceId,id))))return fail('Um pedido não possui compromisso reconhecido no razão. Confira sua situação.');
  if(Object.values(planning.serviceLinks||{}).some(l=>!same(l.contractId,contract.id)&&l.orderIds?.some(id=>p.orderIds.includes(id))))return fail('Um pedido já está vinculado a outro contrato. Desvincule-o primeiro para evitar dupla contagem.');
  link={contractId:contract.id,budgetId:budget.id,stageId:p.stageId,orderIds:[...p.orderIds].sort(),sources,at:now,byId:command.actorId,by:command.actorName||'',note,version:version+1};
 }else if(!previous)return fail('Este contrato não possui vínculo para remover.');
 const links={...planning.serviceLinks};if(link)links[contract.id]=link;else delete links[contract.id];
 const event={contractId:contract.id,before:previous||null,after:link,at:now,byId:command.actorId,by:command.actorName||'',note,version:version+1};
 return {ok:true,entityId:work.id,data:{...data,obras:data.obras.map(w=>w===work?{...w,costPlanning:{...planning,version:version+1,serviceLinks:links,serviceLinkHistory:[...(planning.serviceLinkHistory||[]),event]}}:w)}};
}

// Cada vínculo declara um único escopo econômico. Pedidos sobrepostos não
// geram outra soma: envelope = max(contrato, pedidos). O custo reconhecido
// vem da união dos eventos do razão, que já elimina nota/medição espelhada.
export function serviceForecast(data,ledger,obraId,budget,asOf){
 const work=(data.obras||[]).find(w=>same(w.id,obraId)),links=work?.costPlanning?.serviceLinks||{},groups=[],issues=[],coveredOrders=new Set(),sourceStages=new Map();
 const costs=selectDRE(ledger,{obraId,endDate:asOf.slice(0,7)}).events;
 const purchasePositions=selectCommitments(ledger,{obraId}).items.filter(p=>p.sourceType==='pedido');
 for(const c of (data.terceirizados||[]).filter(c=>same(c.obraId,obraId)&&forecastContractActive(c))){
  const link=links[c.id],amount=serviceContractAmount(c);let reason='';
  if(!link)reason='Vincule o contrato a uma etapa e confira se há pedidos do mesmo escopo.';
  else if(!budget||link.budgetId!==budget.id||!budget.etapas?.some(s=>s.id===link.stageId&&!s.parentId))reason='Orçamento ou etapa do vínculo mudou. Reconfira o vínculo.';
  else if(amount===null||link.sources!==serviceLinkSources(data,c.id,link.orderIds))reason='As condições do contrato ou dos pedidos mudaram. Reconfira o vínculo.';
  else reason=sourceConflict(data,c,link.orderIds,budget,link.stageId);
  if(!reason&&link.orderIds.some(id=>coveredOrders.has(id)))reason='Pedido vinculado mais de uma vez. Reconfira os vínculos.';
  if(reason){issues.push({contractId:c.id,name:c.name||'Terceirizado',reason});continue;}
  const orders=(data.pedidos||[]).filter(o=>link.orderIds.includes(String(o.id)));
  if(orders.some(o=>!purchasePositions.some(p=>same(p.sourceId,o.id)))){issues.push({contractId:c.id,name:c.name,reason:'Pedido sem compromisso reconhecido no razão. Reconfira o vínculo.'});continue;}
  const measurements=(data.medicoesTerc||[]).filter(m=>same(m.tercId,c.id)&&same(m.obraId,obraId)),ids=new Set(measurements.map(m=>String(m.id)));
  const invoices=(data.notasFiscais||[]).filter(n=>same(n.obraId,obraId)&&(link.orderIds.includes(String(n.pedidoId))||ids.has(String(n.medicaoTercId))||measurements.some(m=>same(m.notaFiscalId,n.id))));
  const invoiceIds=new Set(invoices.map(n=>String(n.id)));
  const entries=costs.filter(e=>e.sourceType==='medicao_terceiro'&&ids.has(e.sourceId)||e.sourceType==='nota_fiscal'&&invoiceIds.has(e.sourceId));
  const recognized=entries.reduce((sum,e)=>sum+(e.effect==='cost_reversal'?-1:1)*e.amountCents,0);
  const orderCents=purchasePositions.filter(p=>link.orderIds.includes(String(p.sourceId))).reduce((sum,p)=>sum+p.increaseCents,0),envelope=Math.max(amount,orderCents),remaining=Math.max(0,envelope-recognized);
  if(![recognized,envelope,remaining].every(Number.isSafeInteger)){issues.push({contractId:c.id,name:c.name,reason:'Valores fora da precisão monetária suportada. Confira as origens.'});continue;}
  link.orderIds.forEach(id=>coveredOrders.add(id));
  for(const id of ids)for(const type of ['medicao_terceiro','pagamento_terceiro','garantia_terceiro','pagamento_garantia_terceiro'])sourceStages.set(`${type}:${id}`,link.stageId);
  for(const id of invoiceIds)for(const type of ['nota_fiscal','pagamento_nota'])sourceStages.set(`${type}:${id}`,link.stageId);
  const notices=[];if(orderCents>amount)notices.push('Pedidos superam o contrato; foi preservado o maior compromisso.');if(recognized>envelope)notices.push('Custo reconhecido acima do compromisso; confira as origens.');
  groups.push({contractId:c.id,name:c.name||'Terceirizado',stageId:link.stageId,amountCents:amount,orderCents,envelopeCents:envelope,recognizedCents:recognized,remainingCents:remaining,orderIds:link.orderIds,notices,
   entry:{id:`service-forecast:${c.id}`,sourceType:'contrato_terceiro',sourceId:String(c.id),obraId,obra:work.name,description:`Compromisso integrado · ${c.name||'Terceirizado'}`,amountCents:remaining,
    record:{nome:c.name,contratado:amount/100,pedidosSobrepostos:orderCents/100,envelopeSemDuplicidade:envelope/100,custoReconhecido:recognized/100,saldoAIncorrer:remaining/100},note:`Contrato e pedidos do mesmo escopo considerados uma vez pelo maior valor, menos a união dos custos reconhecidos até ${asOf.slice(0,7)}. Rascunhos e pagamentos não reduzem o compromisso. ${notices.join(' ')}`}});
 }
 return {groups,issues,coveredOrders,sourceStages};
}
