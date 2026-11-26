import {active} from '../financeiro/facts.js';
import {isCompetenceInClosedPeriod,isDateInClosedPeriod} from '../financeiro/workflows.js';
import {findReconciliationCategory} from './categories.js';
import {isFinancialDate} from '../financeiro/dates.js';

const supported=new Set(['payments','outrasDesp','despesasEmpresa']);
const text=value=>String(value||'').trim();
export function reconciliationEditableEntries(data,transaction){
  if(!transaction||transaction.status!=='conciliado'||transaction.importReversal||transaction.recebedorMaoObra||!isFinancialDate(transaction.data))return [];
  const references=(transaction.gerados||[]).length?transaction.gerados:[transaction.vinculo].filter(Boolean);
  if(!references.length||references.some(ref=>!supported.has(ref?.tipo)))return [];
  const entries=references.map(ref=>{
    const source=(data[ref.tipo]||[]).find(row=>String(row.id)===String(ref.entidadeId||ref.id));
    if(!source||!active(source)||source.transacaoId!==transaction.id||source.medicaoId||source.contratoId||source.rentalInvoiceId||source.locacaoId)return null;
    return {sourceType:ref.tipo,sourceId:source.id,destination:ref.tipo==='outrasDesp'||(ref.tipo==='payments'&&source.obraId)?'obra':'empresa',
      obraId:source.obraId||'',category:source.categoria||'outros',description:source.description||source.descricao||'',
      competence:source.competencia||String(source.data||source.date||transaction.data).slice(0,7),
      amount:Number(source.amount??source.valor),version:Number(source.version||0)};
  });
  if(entries.some(item=>!item)||new Set(entries.map(item=>`${item.sourceType}:${item.sourceId}`)).size!==entries.length)return [];
  const expected=Math.round(Math.abs(Number(transaction.valor))*100),total=entries.reduce((sum,item)=>sum+Math.round(item.amount*100),0);
  if(!Number.isSafeInteger(expected)||expected<=0||entries.some(item=>!Number.isFinite(item.amount)||item.amount<=0)||total!==expected)return [];
  return entries;
}

export const reconciliationClassificationFingerprint=(data,transaction)=>JSON.stringify({
  id:transaction?.id,date:transaction?.data,amount:transaction?.valor,entries:reconciliationEditableEntries(data,transaction),
});

export function editReconciliationClassification(data,transaction,payload,actor){
  const fail=motivo=>({data,resumo:{ok:false,motivo}});
  if(!['admin','financeiro'].includes(actor?.role)||actor.obraId)return fail('A edição exige perfil financeiro sem restrição de obra.');
  const current=reconciliationEditableEntries(data,transaction);
  if(!current.length)return fail('Este vínculo deve ser corrigido no lançamento de origem. Nenhum registro foi alterado.');
  if(payload.expectedFingerprint!==reconciliationClassificationFingerprint(data,transaction))return fail('A classificação mudou. Atualize os dados e revise a edição.');
  const proposed=payload.entries;
  if(!Array.isArray(proposed)||proposed.length!==current.length||new Set(proposed.map(row=>`${row.sourceType}:${row.sourceId}`)).size!==current.length)return fail('Confira todos os lançamentos vinculados.');
  if(isDateInClosedPeriod(data,transaction.data))return fail('O período bancário está fechado. Reabra o fechamento antes de editar.');
  const updates=[];
  for(const original of current){
    const input=proposed.find(row=>row.sourceType===original.sourceType&&row.sourceId===original.sourceId);
    if(!input||!['empresa','obra'].includes(input.destination)||(input.destination!==original.destination&&original.sourceType!=='payments')||('amount' in input&&Number(input.amount)!==original.amount))return fail('Preserve o destino e o valor do lançamento de origem.');
    const destination=input.destination,category=text(input.category),description=text(input.description).slice(0,240),competence=text(input.competence),obraId=destination==='obra'?text(input.obraId):'';
    if(!description||!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence))return fail('Informe descrição e competência válidas.');
    if(destination==='obra'&&!(data.obras||[]).some(work=>String(work.id)===obraId&&active(work)))return fail('Selecione uma obra disponível nesta empresa.');
    const definition=findReconciliationCategory(data,{direction:original.sourceType==='payments'?'entrada':'saida',destination,category});
    if(!definition)return fail('Selecione uma categoria do DRE válida para o lançamento.');
    if(isCompetenceInClosedPeriod(data,original.competence)||isCompetenceInClosedPeriod(data,competence))return fail('A competência anterior ou a nova está fechada. Reabra o período antes de editar.');
    updates.push({...original,destination,obraId,category,description,competence,effect:definition.effect});
  }
  const now=new Date().toISOString();let next={...data};
  for(const update of updates){
    next[update.sourceType]=next[update.sourceType].map(source=>source.id!==update.sourceId?source:{...source,
      categoria:update.category,competencia:update.competence,obraId:update.obraId,
      ...(update.sourceType==='payments'?{description:update.description,dataReconhecimento:String(source.date||source.data).startsWith(update.competence)?source.date||source.data:`${update.competence}-01`,
        efeitoDRE:update.effect==='revenue'?'receita':update.effect==='unallocated'?'a_classificar':'sem_efeito',naturezaEntrada:update.effect}
        :{descricao:update.description,dataPagamento:source.dataPagamento||source.data||transaction.data,data:String(source.data).startsWith(update.competence)?source.data:`${update.competence}-01`}),
      version:Number(source.version||0)+1,updatedAt:now,updatedById:actor.id,
    });
  }
  next.transacoes=(data.transacoes||[]).map(row=>row.id!==transaction.id?row:{...row,
    rateios:updates.map(item=>({destino:item.destination,obraId:item.obraId,categoria:item.category,valor:item.amount,competencia:item.competence})),
    version:Number(row.version||0)+1,updatedAt:now,updatedById:actor.id,
  });
  next.historicoConc=[...(data.historicoConc||[]),{id:`edit_${transaction.id}_${now}`,transacaoId:transaction.id,extratoId:transaction.extratoId,
    acao:'classificacao_editada',criadoEm:now,operadorId:actor.id,descricao:'Classificação atualizada no mesmo lançamento do DRE',valor:transaction.valor,
    detalhes:{antes:current,depois:updates},statusAnterior:'conciliado',statusNovo:'conciliado'}];
  return {data:next,resumo:{ok:true,editados:updates.length}};
}
