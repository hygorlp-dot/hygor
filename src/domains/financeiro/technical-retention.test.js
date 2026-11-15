import {it,expect} from 'vitest';
import {applyOperationalCommand,OPERATIONAL_COMMAND as C} from '../sync/operational-commands.js';
import {buildFinancialLedger,selectDRE,selectAccountsPayable,selectCashFlow} from './ledger.js';
import {forecastCash} from './cash-forecast.js';
import {serviceContractPositions} from '../compras/service-contract-position.js';
import {validateTechnicalRetentionPolicy} from '../../../server/section-authorizations.js';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';
import {validatePurchasePayment} from './purchase-payment-validation.js';
import {vincularPagamentoExistente,registrarPagamentoEConciliar} from '../conciliacao/mutations.js';
import {criarIndicesFinanceiros} from '../conciliacao/selectors.js';
import {gerarCandidatosConciliacao} from '../conciliacao/matching.js';

const fixture=()=>({obras:[{id:'w',name:'Casa'}],terceirizados:[{id:'t',obraId:'w',name:'Instalações',active:true,tipoContrato:'medicao',contractValue:2000,retISS:5,retISSQuem:'fonte',retINSS:11,retINSSQuem:'fonte',etapas:[{id:'s',nome:'Execução',valor:2000}]}],
 medicoesTerc:[{id:'m',tercId:'t',obraId:'w',status:'aprovada',total:1000,data:'2026-10-01',version:1,itens:[{etapaId:'s',pctAnterior:0,pctAcum:50,valor:1000}],fotos:[{id:'photo'}]}],pagsTerceiros:[],notasFiscais:[]});
const now='2026-11-13T15:00:00.000Z';
const command=(d,type,p={})=>({type,idempotencyKey:type+'-'+(d.medicoesTerc[0].version||0),actorId:'f',actorName:'Financeiro',actorRole:'financeiro',expectedVersion:d.medicoesTerc[0].version,payload:{measurementId:'m',reason:'Condição e documentos conferidos',...p},now});
const apply=(d,type,p={})=>{const result=applyOperationalCommand(d,command(d,type,p));expect(result.ok,result.reason).toBe(true);return result.data;};
const define=d=>apply(d,C.THIRD_PARTY_RETENTION_SAVED,{amountCents:10000,condition:'Aceite técnico após o prazo de garantia'});
const release=d=>apply(d,C.THIRD_PARTY_RETENTION_RELEASED,{date:'2026-11-13',dueDate:'2026-11-20',evidence:'Termo de aceite aprovado e conferido',conditionConfirmed:true});
const principal=d=>apply(d,C.THIRD_PARTY_MEASUREMENT_PAID,{payment:{id:'p',date:'2026-11-13',pagador:'empresa'}});
const guarantee=d=>apply(d,C.THIRD_PARTY_RETENTION_PAID,{payment:{id:'g',date:'2026-11-13',pagador:'empresa'}});
const position=d=>selectAccountsPayable(buildFinancialLedger(d),{obraId:'w'});
const dre=d=>selectDRE(buildFinancialLedger(d),{obraId:'w'});

it('retém parte do bruto, separa obrigação e preserva DRE, contrato e saldo a medir',()=>{
 const d=fixture(),before=structuredClone(d),next=define(d),positions=position(next);
 expect(d).toEqual(before);expect(next.terceirizados).toEqual(d.terceirizados);expect(dre(next)).toEqual(dre(d));
 expect(positions.balanceCents).toBe(100000);expect(positions.items.find(p=>p.sourceType==='medicao_terceiro').balanceCents).toBe(90000);
 expect(positions.items.find(p=>p.sourceType==='garantia_terceiro')).toMatchObject({balanceCents:10000,guaranteeHeld:true,dueDate:''});
 expect(serviceContractPositions(next,{workIds:['w']})[0]).toMatchObject({approvedCents:100000,remainingCents:100000,balanceCents:100000,counts:{toPay:1}});
 expect(next.medicoesTerc[0].technicalRetention).toMatchObject({beneficiaryId:'t',beneficiaryName:'Instalações',grossBasisCents:100000});
});
it('principal baixa 900, paga líquido 740 e mantém garantia 100, com tributos separados',()=>{
 const d=define(fixture()),next=principal(d),p=next.pagsTerceiros[0];
 expect(p).toMatchObject({amount:900,issRetido:50,inssRetido:110,liquido:740,technicalRetentionCents:10000,guaranteePayment:false});
 expect(position(next).balanceCents).toBe(10000);expect(selectCashFlow(buildFinancialLedger(next),{obraId:'w'}).cashOutCents).toBe(74000);expect(dre(next)).toEqual(dre(d));
});
it('libera só com condição/evidência e agenda sem novo custo; paga garantia sem repetir tributos',()=>{
 const d=principal(define(fixture())),released=release(d),paid=guarantee(released);
 expect(dre(released)).toEqual(dre(d));expect(dre(paid)).toEqual(dre(d));
 expect(position(released).items.find(p=>p.sourceType==='garantia_terceiro')).toMatchObject({balanceCents:10000,dueDate:'2026-11-20',guaranteeHeld:false});
 expect(paid.pagsTerceiros.find(p=>p.id==='g')).toMatchObject({amount:100,liquido:100,issRetido:0,inssRetido:0,guaranteePayment:true});
 expect(position(paid).balanceCents).toBe(0);expect(selectCashFlow(buildFinancialLedger(paid),{obraId:'w'}).cashOutCents).toBe(84000);
 expect(paid.medicoesTerc[0].technicalRetentionHistory.map(h=>h.kind)).toEqual(['defined','released','paid']);
 expect(paid.medicoesTerc[0].pagamentoId).toBe('p');
});
it('caixa não agenda retido antes da liberação e consulta anterior respeita sua data',()=>{
 const d=define(fixture()),pending=forecastCash(d,buildFinancialLedger(d),{today:'2026-11-13',obraId:'w'});
 expect(pending.undated.some(p=>p.sourceType==='garantia_terceiro'&&p.amountCents===10000)).toBe(true);
 const r=release(d);expect(selectAccountsPayable(buildFinancialLedger(r),{asOfDate:'2026-11-12'}).items.find(p=>p.sourceType==='garantia_terceiro')).toMatchObject({guaranteeHeld:true,dueDate:''});
 expect(forecastCash(r,buildFinancialLedger(r),{today:'2026-11-13',obraId:'w'}).scheduled.filter(p=>p.sourceType==='garantia_terceiro')[0].dueDate).toBe('2026-11-20');
});
it('período antigo fechado não impede liberar/pagar garantia no período aberto',()=>{
 const d=define(fixture());d.fechamentosFinanceiros=[{status:'fechado',dataInicio:'2026-10-01',dataFim:'2026-10-31'}];
 expect(position(guarantee(release(d))).balanceCents).toBe(90000);
 expect(applyOperationalCommand(d,command(d,C.THIRD_PARTY_RETENTION_SAVED,{amountCents:5000})).ok).toBe(false);
});
it.each([NaN,1.5,-1,100001,90000])('não aceita garantia inválida %s nem valores informados de beneficiário',amountCents=>{
 const d=fixture(),r=applyOperationalCommand(d,command(d,C.THIRD_PARTY_RETENTION_SAVED,{amountCents,condition:'Aceite técnico aprovado',beneficiaryId:'other'}));expect(r.ok).toBe(false);
});
it('versão, idempotência, papel, aba e obra impedem alteração indevida',()=>{
 const d=fixture(),cmd=command(d,C.THIRD_PARTY_RETENTION_SAVED,{amountCents:10000,condition:'Aceite técnico da obra'}),r=applyOperationalCommand(d,cmd);
 expect(r.ok).toBe(true);expect(applyOperationalCommand(r.data,cmd)).toMatchObject({ok:true,idempotent:true});
 expect(applyOperationalCommand(r.data,{...cmd,idempotencyKey:'different'}).ok).toBe(false);
 expect(applyOperationalCommand(d,{...cmd,actorRole:'engenheiro'}).ok).toBe(false);
 for(const user of [{id:'f',role:'financeiro',obraId:'other'},{id:'f',role:'financeiro',accessTabs:[]},{id:'e',role:'engenheiro'},{id:'f',role:'financeiro',active:false}])expect(validateOperationalCommandScope({data:d,command:cmd,user}).ok).toBe(false);
 expect(validateOperationalCommandScope({data:d,command:cmd,user:{id:'f',role:'financeiro',obraId:'w'}}).ok).toBe(true);
});
it('bloqueia alteração após baixa, liberação duplicada e pagamento antes de liberar ou duplicado',()=>{
 let d=define(fixture());
 expect(applyOperationalCommand(d,command(d,C.THIRD_PARTY_RETENTION_PAID,{payment:{id:'g',date:'2026-11-13',pagador:'empresa'}})).ok).toBe(false);
 d=principal(d);expect(applyOperationalCommand(d,command(d,C.THIRD_PARTY_RETENTION_SAVED,{amountCents:20000})).ok).toBe(false);
 d=release(d);expect(applyOperationalCommand(d,command(d,C.THIRD_PARTY_RETENTION_RELEASED)).ok).toBe(false);
 d=guarantee(d);expect(applyOperationalCommand(d,command(d,C.THIRD_PARTY_RETENTION_PAID,{payment:{id:'g2',date:'2026-11-13',pagador:'empresa'}})).ok).toBe(false);
});
it('snapshot não altera retenção/histórico, bruto da medição, baixas ou nota protegida',()=>{
 const d=define(fixture());for(const edit of [n=>n.medicoesTerc[0].technicalRetention.amountCents=1,n=>n.medicoesTerc[0].technicalRetentionHistory=[],n=>n.medicoesTerc[0].total=100,n=>n.medicoesTerc=[],n=>n.pagsTerceiros=[{id:'fake',medicaoTercId:'m',amount:1000}]]){
  const n=structuredClone(d);edit(n);expect(validateTechnicalRetentionPolicy(d,n)).not.toBe('');
 }
 expect(validateTechnicalRetentionPolicy(d,structuredClone(d))).toBe('');
 const defaults=structuredClone(d),m=defaults.medicoesTerc[0];
 Object.assign(m,{dataMedicao:m.data,numero:0,observacao:'',pagamentoId:'',notaFiscalId:'',responsavelEvidenciaId:'',responsavelEvidencia:'',responsavelEvidenciaRole:''});
 expect(validateTechnicalRetentionPolicy(d,defaults)).toBe('');
 const reordered=structuredClone(d);reordered.medicoesTerc[0]=Object.fromEntries(Object.entries(reordered.medicoesTerc[0]).reverse());
 expect(validateTechnicalRetentionPolicy(d,reordered)).toBe('');
});
it('nota vinculada mantém bruto uma vez e não pode pagar garantia pela fila genérica',()=>{
 const d=define(fixture());d.notasFiscais=[{id:'n',obraId:'w',medicaoTercId:'m',emissao:'2026-10-01',status:'aprovada',valorBruto:1000}];d.medicoesTerc[0].notaFiscalId='n';
 expect(dre(d).events.filter(e=>e.effect==='cost')).toHaveLength(1);
 expect(validatePurchasePayment(d,{type:'nota',target:d.notasFiscais[0],value:100}).error).toContain('garantia');
});
it('conciliação vincula o líquido existente e preserva retenção e DRE, sem outra baixa',()=>{
 const d=principal(define(fixture()));d.transacoes=[{id:'tr',data:'2026-11-13',valor:-740,status:'pendente'}];
 const result=vincularPagamentoExistente(d,{transacaoId:'tr',tipo:'pagsTerceiros',entidadeId:'p',pagamentoId:'p',operador:{id:'f',nome:'Financeiro'}});
 expect(result.resumo.ok,result.resumo.motivo).toBe(true);expect(result.data.pagsTerceiros).toHaveLength(1);expect(result.data.pagsTerceiros[0].conciliado).toBe(true);
 expect(position(result.data).balanceCents).toBe(10000);expect(dre(result.data)).toEqual(dre(d));
 const blocked=registrarPagamentoEConciliar(d,{transacaoId:'tr',tipo:'medicaoTerc',entidadeId:'m',operador:{id:'f',role:'financeiro'}});
 expect(blocked.resumo.ok).toBe(false);expect(blocked.resumo.motivo).toContain('garantia');
 const candidates=gerarCandidatosConciliacao(d.transacoes[0],d,criarIndicesFinanceiros(d));
 expect(candidates.some(c=>c.pagamentoId==='p'&&c.podeVincular)).toBe(true);
});
it('estorno da garantia reabre só o retido, preservando pagamento principal e custo',()=>{
 const d=guarantee(release(principal(define(fixture())))),g=d.pagsTerceiros.find(p=>p.id==='g');
 const result=applyOperationalCommand(d,{...command(d,C.THIRD_PARTY_PAYMENT_REVERSED),expectedVersion:g.version,payload:{paymentId:'g',reason:'Pagamento informado por engano'}});
 expect(result.ok,result.reason).toBe(true);expect(position(result.data).balanceCents).toBe(10000);expect(result.data.medicoesTerc[0].pagamentoId).toBe('p');expect(dre(result.data)).toEqual(dre(d));
});
it('garantia integral sem tributos é paga uma vez e pode existir sem pagamento de principal',()=>{
 const d=fixture();d.terceirizados[0].retISS=0;d.terceirizados[0].retINSS=0;
 const held=apply(d,C.THIRD_PARTY_RETENTION_SAVED,{amountCents:100000,condition:'Aceite final previsto na contratação'});
 expect(position(held).balanceCents).toBe(100000);
 const paid=guarantee(release(held));expect(position(paid).balanceCents).toBe(0);expect(dre(paid)).toEqual(dre(d));
 expect(selectCashFlow(buildFinancialLedger(paid),{obraId:'w'}).cashOutCents).toBe(100000);
});
it('remoção anterior à baixa preserva trilha e devolve o principal sem mudar o DRE',()=>{
 const d=define(fixture()),removed=apply(d,C.THIRD_PARTY_RETENTION_SAVED,{amountCents:0,condition:''});
 expect(position(removed).items.some(p=>p.sourceType==='garantia_terceiro')).toBe(false);
 expect(position(removed).balanceCents).toBe(100000);expect(dre(removed)).toEqual(dre(d));expect(removed.medicoesTerc[0].technicalRetentionHistory).toHaveLength(2);
});
it('datas futuras, condição não confirmada e identificador espelhado não liberam ou pagam garantia',()=>{
 const d=define(fixture());
 for(const extra of [{date:'2026-11-14'},{conditionConfirmed:false},{dueDate:'2026-02-30'},{evidence:''}]){
  const r=applyOperationalCommand(d,command(d,C.THIRD_PARTY_RETENTION_RELEASED,{date:'2026-11-13',dueDate:'2026-11-20',evidence:'Termo técnico de aceite',conditionConfirmed:true,...extra}));expect(r.ok).toBe(false);
 }
 const released=release(d);released.notasFiscais=[{id:'other',obraId:'other',status:'aprovada',valorBruto:100,pagamentos:[{id:'same',valor:100}]}];
 expect(applyOperationalCommand(released,command(released,C.THIRD_PARTY_RETENTION_PAID,{payment:{id:'same',date:'2026-11-13',pagador:'empresa'}})).ok).toBe(false);
});
