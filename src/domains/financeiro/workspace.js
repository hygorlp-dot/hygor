import {selectDRE,selectCashFlow,selectAccountsPayable,selectAccountsReceivable,selectCommitments} from './ledger.js';
import {isFinancialDate} from './dates.js';

const collections={medicao:'medicoes',nota_fiscal:'notasFiscais',pagamento_nota:'notasFiscais',pedido:'pedidos',medicao_terceiro:'medicoesTerc',pagamento_terceiro:'medicoesTerc',pagamento_terceiro_legado:'pagsTerceiros',outra_despesa:'outrasDesp',despesa_empresa:'despesasEmpresa',rescisao:'rescisoes',recebimento_avulso:'payments',caixa_obra:'caixaObra',titulo_folha:'titulosFolha',pagamento_folha:'titulosFolha'};
export function financialEntry(data,event){
  const type=event.sourceType||event.origem;
  const record=(data[collections[type]]||[]).find(r=>String(r.id)===String(event.sourceId))||event.metadata?.titleDetails||null;
  const obraId=event.obraId||record?.obraId||'';
  const work=(data.obras||[]).find(o=>String(o.id)===String(obraId));
  const partyName=value=>typeof value==='string'?value:value?.nome||value?.name||'';
  const supplier=record?.fornecedorId?(data.fornecedores||[]).find(f=>String(f.id)===String(record.fornecedorId)):null;
  const customerSource=['medicao','recebimento_avulso'].includes(type);
  const counterparty=partyName(event.counterparty)||partyName(record?.fornecedorNome)||partyName(record?.fornecedor)||partyName(supplier)||partyName(record?.cliente)||(customerSource?partyName(work?.cliente):'');
  const invoices=(data.notasFiscais||[]).filter(n=>(record?.notaFiscalId&&n.id===record.notaFiscalId)||(type==='pedido'&&n.pedidoId===event.sourceId)||(type==='medicao_terceiro'&&n.medicaoTercId===event.sourceId));
  const transaction=(data.transacoes||[]).find(t=>t.id===(event.transactionId||record?.transacaoId));
  return {...event,sourceType:type,documentNumber:event.documentNumber||event.documento||record?.numero||record?.numeroParcela||record?.documento,counterparty,description:event.description||event.descricao||record?.descricao||record?.numero||'Lançamento',
    amountCents:event.amountCents??event.valorCents??0,date:event.date||event.data||record?.emissao||record?.dataEmissao||record?.data,competence:event.competence||event.competencia||record?.competencia,
    obraId,obra:work?.name||obraId||'Empresa (sem obra)',record,invoices,
    metadata:{...event.metadata,...(transaction?{movimentoBancario:transaction}:{})},
    documents:(data.documentosMovimentacoes||[]).filter(d=>d.movimentoId===event.id).flatMap(d=>d.documentos||[])};
}
export function positionEntries(data,position){
  return position.items.filter(p=>p.balanceCents>0).map(p=>{
    const entry=financialEntry(data,{...p.events[0],...p,id:p.key,amountCents:p.balanceCents});
    const originalDueDate=p.dueDate||entry.record?.dataVencimento||entry.record?.vencimento||entry.record?.previsao||'';
    const dueDate=isFinancialDate(originalDueDate)?originalDueDate:'';
    return {...entry,dueDate,metadata:{...entry.metadata,vencimento:originalDueDate,...(originalDueDate&&!dueDate?{vencimentoInvalido:true}:{}),valorOriginal:p.increaseCents/100,liquidado:p.decreaseCents/100,saldo:p.balanceCents/100,historico:p.events.map(e=>({data:e.date,descricao:e.description,valor:e.amountCents/100,tipo:e.effect,origem:e.sourceType,documento:e.documentNumber,transacaoId:e.transactionId}))}};
  });
}
export function todayQueues(data,ledger,obraId,today){
  const filters={...(obraId==='all'?{}:{obraId}),asOfDate:today};
  const payable=positionEntries(data,selectAccountsPayable(ledger,filters));
  const receivable=positionEntries(data,selectAccountsReceivable(ledger,filters));
  const end=new Date(`${today}T12:00:00`);end.setDate(end.getDate()+7);
  const until=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
  const all=[...payable.map(p=>({...p,direction:'A pagar'})),...receivable.map(p=>({...p,direction:'A receber'}))];
  return [
    {id:'payToday',label:'Pagar hoje',items:all.filter(p=>p.direction==='A pagar'&&p.dueDate===today)},
    {id:'receiveToday',label:'Receber hoje',items:all.filter(p=>p.direction==='A receber'&&p.dueDate===today)},
    {id:'overdue',label:'Vencidos',items:all.filter(p=>p.dueDate&&p.dueDate<today)},
    {id:'nextWeek',label:'Próximos 7 dias',items:all.filter(p=>p.dueDate>today&&p.dueDate<=until)},
    {id:'undated',label:'Sem vencimento',items:all.filter(p=>!p.dueDate)},
  ].map(q=>({...q,items:q.items.sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))),amountCents:q.items.reduce((s,p)=>s+p.amountCents,0)}));
}
export function overviewEntries(data,selected,obraId,key){
  const filters={...(obraId==='all'?{}:{obraId}),startDate:selected.per0,endDate:selected.perF,competence:selected.per0.slice(0,7)};
  const positionFilters={...(obraId==='all'?{}:{obraId}),asOfDate:selected.perF};
  if(['payable','receivable','committed'].includes(key))return positionEntries(data,({payable:selectAccountsPayable,receivable:selectAccountsReceivable,committed:selectCommitments}[key])(selected.ledger,positionFilters));
  const cash=key==='cashIn'||key==='cashOut';
  const events=cash?selectCashFlow(selected.ledger,{...filters,competence:undefined}).events:selectDRE(selected.ledger,filters).events;
  const filtered=events.filter(e=>key==='result'||(key==='revenue'?e.effect.startsWith('revenue'):key==='costs'?e.effect.startsWith('cost'):e.effect===(key==='cashIn'?'cash_in':'cash_out')));
  const entries=filtered.map(e=>({...financialEntry(data,e),amountCents:e.amountCents*(e.effect.endsWith('_reversal')?-1:1)*(key==='result'&&e.effect.startsWith('cost')?-1:1)}));
  if(obraId==='all'&&!cash){
    for(const [kind,value] of [['revenue',selected.equipReceita],['costs',selected.equipCustoEmpresa]]){
      if((key===kind||key==='result')&&value)entries.push({id:`equipment:${kind}`,description:kind==='revenue'?'Receita de equipamentos':'Custos de equipamentos',amountCents:Math.round(value*100)*(key==='result'&&kind==='costs'?-1:1),obra:'Empresa',competence:filters.competence,sourceType:'equipamentos',record:{locacoes:(data.locacoesEquip||[]).filter(r=>r.status!=='cancelada'&&r.inicio<=selected.perF&&(!r.fim||r.fim>=selected.per0)),manutencoes:(data.manutencoesEquip||[]).filter(r=>String(r.data||'').slice(0,7)===filters.competence)},note:'Composição calculada pelo módulo de equipamentos; consulte as datas de cada registro.'});
    }
  }
  return entries;
}
