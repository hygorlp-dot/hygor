import {buildFinancialLedger,selectAccountsPayable,active} from './ledger.js';
import {isFinancialDate} from './dates.js';
import {isDateInClosedPeriod} from './workflows.js';
import {calculateWithholdings} from '../terceirizados/withholdings.js';
import {technicalRetentionCents} from '../terceirizados/technical-retention.js';
import {createThirdPartyPayment} from './third-party-payment-mutations.js';
import {arcdApprovalEngine} from '../aprovacoes/arcd-engine.js';

export const TECHNICAL_RETENTION_COMMAND=Object.freeze({
 THIRD_PARTY_RETENTION_SAVED:'GARANTIA_TERCEIRO_DEFINIDA',
 THIRD_PARTY_RETENTION_RELEASED:'GARANTIA_TERCEIRO_LIBERADA',
 THIRD_PARTY_RETENTION_PAID:'GARANTIA_TERCEIRO_PAGA',
});
export const TECHNICAL_RETENTION_TYPES=new Set(Object.values(TECHNICAL_RETENTION_COMMAND));
const fail=reason=>({ok:false,reason});
const text=v=>String(v||'').trim();
const inactive=m=>!active(m)&&!['rascunho','rejeitada'].includes(m?.status);
export function applyTechnicalRetentionCommand(data,command,now){
 if(!TECHNICAL_RETENTION_TYPES.has(command.type))return null;
 const p=command.payload||{},m=(data.medicoesTerc||[]).find(row=>row.id===p.measurementId);
 if(!command.actorId||!['admin','financeiro'].includes(command.actorRole))return fail('Somente administrador ou financeiro pode operar a garantia.');
 if(!m||inactive(m))return fail('Medição inexistente ou cancelada.');
 if(command.expectedVersion==null||Number(command.expectedVersion)!==Number(m.version||0))return fail('A medição mudou. Atualize a tela e confira a garantia.');
 const contract=(data.terceirizados||[]).find(c=>c.id===m.tercId&&c.obraId===m.obraId);
 if(!contract||(data.obras||[]).every(w=>w.id!==m.obraId))return fail('Confira contrato, beneficiário e obra da medição.');
 if(command.type===TECHNICAL_RETENTION_COMMAND.THIRD_PARTY_RETENTION_SAVED&&isDateInClosedPeriod(data,m.data||m.dataMedicao))return fail('O período da medição está fechado.');
 const reason=text(p.reason);
 if(reason.length<5||reason.length>2000)return fail('Informe uma justificativa entre 5 e 2.000 caracteres.');
 const audit={at:now,byId:String(command.actorId),by:text(command.actorName)||'Usuário autenticado',reason};
 const previous=m.technicalRetention||null;
 const positions=selectAccountsPayable(buildFinancialLedger(data),{obraId:m.obraId}).items;
 const principal=positions.find(row=>row.sourceType==='medicao_terceiro'&&row.sourceId===m.id);
 const guarantee=positions.find(row=>row.sourceType==='garantia_terceiro'&&row.sourceId===m.id);
 const settlements=(principal?.decreaseCents||0)+(guarantee?.decreaseCents||0);
 let retention=previous,kind='defined',next=data;
 if(command.type===TECHNICAL_RETENTION_COMMAND.THIRD_PARTY_RETENTION_SAVED){
  if(!['rascunho','rejeitada','aprovada'].includes(m.status))return fail('Confira a situação de aprovação da medição antes de definir a garantia.');
  if(previous?.release||settlements||m.pagamentoId||(data.pagsTerceiros||[]).some(pg=>active(pg)&&(pg.medicaoTercId===m.id||pg.medicaoId===m.id))||(m.pagamentos||[]).some(active))return fail('Há liberação ou baixa nesta medição. Concilie e estorne na origem antes de definir a garantia.');
  const amount=p.amountCents,gross=Math.round(Number(m.total)*100),tax=calculateWithholdings(m.total,contract);
  if(!Number.isSafeInteger(gross)||gross<=0||!Number.isSafeInteger(amount)||amount<0||amount>gross||tax.error||amount>Math.round(tax.liquido*100))return fail('A garantia deve ser informada em centavos e caber no bruto após as retenções tributárias.');
  const condition=text(p.condition);
  if(amount>0&&(condition.length<5||condition.length>2000))return fail('Descreva a condição de liberação entre 5 e 2.000 caracteres.');
  retention={amountCents:amount,grossBasisCents:gross,condition,beneficiaryId:contract.id,beneficiaryName:contract.name||contract.nome||'',...audit,release:null};
 }else{
  const amount=technicalRetentionCents(m);
  if(m.status!=='aprovada'||!amount||previous?.grossBasisCents!==Math.round(Number(m.total)*100)||previous?.beneficiaryId!==contract.id)return fail('Confira a garantia e a aprovação da medição antes de liberar ou pagar.');
  if(command.type===TECHNICAL_RETENTION_COMMAND.THIRD_PARTY_RETENTION_RELEASED){
   if(previous.release)return fail('A garantia já foi liberada.');
   if(p.conditionConfirmed!==true||text(p.evidence).length<5||text(p.evidence).length>2000)return fail('Confirme a condição cumprida e informe a evidência da liberação.');
   if(!isFinancialDate(p.date)||p.date>now.slice(0,10)||!isFinancialDate(p.dueDate)||p.dueDate<p.date)return fail('Confira a data da liberação e o vencimento; não antecipe uma liberação futura.');
   if(p.date<String(m.data||m.dataMedicao)||isDateInClosedPeriod(data,p.date)||isDateInClosedPeriod(data,p.dueDate))return fail('Datas anteriores à medição ou em período fechado não permitem liberação.');
   kind='released';retention={...previous,release:{date:p.date,dueDate:p.dueDate,evidence:text(p.evidence),...audit}};
  }else{
   if(!previous.release)return fail('Libere a garantia após conferir a condição antes de registrar o pagamento.');
   if(guarantee?.decreaseCents||!guarantee||guarantee.balanceCents!==amount)return fail('A garantia já possui baixa ou saldo divergente. Confira a origem.');
   const payment=p.payment||{},id=text(payment.id);
   if(!id||[...(data.pagsTerceiros||[]),...(data.notasFiscais||[]).flatMap(n=>n.pagamentos||[]),...(data.medicoesTerc||[]).flatMap(n=>n.pagamentos||[])].some(pg=>pg.id===id))return fail('Pagamento sem identificação única.');
   if(!isFinancialDate(payment.date)||payment.date<previous.release.date||payment.date>now.slice(0,10)||isDateInClosedPeriod(data,payment.date))return fail('Confira a data do pagamento da garantia e o período aberto.');
   if(!['empresa','obra'].includes(payment.pagador))return fail('Informe quem realizou o pagamento.');
   const approval=arcdApprovalEngine.iniciarInstancia(data,{entidadeTipo:'pagamentoTerceiro',entidadeId:id,contexto:{valorTotal:amount/100,obraId:m.obraId,possuiMedicao:'sim',solicitanteId:command.actorId},operador:{id:command.actorId,nome:audit.by},agora:now,comportamentoSemPolitica:data.configAprovacao?.comportamentoSemPolitica||'auto_aprovar'});
   next=createThirdPartyPayment({data:approval.data,actor:{id:command.actorId,nome:audit.by},id,now,payment:{tercId:m.tercId,tercName:previous.beneficiaryName,obraId:m.obraId,medicaoTercId:m.id,amount:amount/100,liquido:amount/100,issRetido:0,inssRetido:0,date:payment.date,pagador:payment.pagador,guaranteePayment:true,description:'Pagamento da garantia técnica',aprovacaoInstanciaId:approval.resumo.instanciaId}});
   kind='paid';
  }
 }
 const updated={...m,technicalRetention:retention,technicalRetentionHistory:[...(m.technicalRetentionHistory||[]),{kind,before:previous,after:retention,paymentId:p.payment?.id||'',...audit}],version:Number(m.version||0)+1,updatedAt:now,updatedById:command.actorId,updatedBy:audit.by};
 return {ok:true,entityId:m.id,data:{...next,medicoesTerc:(next.medicoesTerc||[]).map(row=>row.id===m.id?updated:row)}};
}
