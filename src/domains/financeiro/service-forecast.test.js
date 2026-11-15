import {expect,it} from 'vitest';
import {buildFinancialLedger} from './ledger.js';
import {workStageCosts} from './work-stage-costs.js';
import {costPlanningFingerprint,COST_CONTROL_COMMAND,applyCostControlCommand} from './cost-control.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {serviceLinkSources,SERVICE_LINK_COMMAND,serviceForecast} from './service-forecast.js';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';
import {validateBudgetBaselinePolicy} from '../../../server/section-authorizations.js';
import {costAtCompletion} from './management-forecasts.js';

const fixture=()=>({obras:[{id:'w',name:'Casa',startDate:'2026-01-01'},{id:'other'}],budgetBaselines:[{obraId:'w',tipo:'controle',ativo:true,budgetId:'b'}],
 orcamentos:[{id:'b',obraId:'w',etapas:[{id:'s',nome:'Estrutura'},{id:'p',nome:'Pintura'}],itens:[{id:'i',etapaId:'s',quantidade:1,precoUnit:1000}]}],
 terceirizados:[{id:'t',obraId:'w',name:'Serviço',tipoContrato:'medicao',active:true,contractValue:2000,etapas:[{id:'e',valor:2000}]}],
 pedidos:[{id:'o',obraId:'w',status:'enviado',data:'2026-10-01',itens:[{id:'l',qtd:1,precoUnit:2000,orcNivel1Id:'s'}]}],
 medicoesTerc:[{id:'m',tercId:'t',obraId:'w',status:'aprovada',data:'2026-10-01',total:500}],notasFiscais:[],pagsTerceiros:[]});
const cmd=(d,extra={})=>({type:SERVICE_LINK_COMMAND,actorId:'f',actorRole:'financeiro',actorName:'Financeiro',expectedVersion:d.obras[0].costPlanning?.version||0,idempotencyKey:'service-link-00001',payload:{obraId:'w',contractId:'t',budgetId:'b',stageId:'s',orderIds:['o'],confirmOverlap:true,sources:serviceLinkSources(d,'t',['o']),note:'Mesmo serviço contratado e pedido',...extra}});
const link=d=>{const r=applyOperationalCommand(d,cmd(d));expect(r.ok,r.reason).toBe(true);return r.data;};
const report=(d,date='2026-10-31')=>workStageCosts(d,buildFinancialLedger(d),'w',date);
const row=d=>report(d).rows.find(r=>r.id==='s');

it('persiste vínculo auditado e idempotente sem modificar contrato, notas ou pagamentos',()=>{
 const d=fixture(),result=applyOperationalCommand(d,cmd(d));expect(result.ok).toBe(true);
 expect(result.data.obras[0].costPlanning).toMatchObject({version:1,serviceLinks:{t:{stageId:'s',orderIds:['o'],byId:'f'}},serviceLinkHistory:[{contractId:'t',before:null}]});
 expect(result.data.terceirizados).toBe(d.terceirizados);expect(result.data.medicoesTerc).toBe(d.medicoesTerc);
 expect(applyOperationalCommand(result.data,cmd(d))).toMatchObject({ok:true,idempotent:true});
});
it('contrato e pedido sobrepostos usam o maior escopo menos custo reconhecido, não duas somas',()=>{
 const d=link(fixture()),r=row(d);
 expect(r).toMatchObject({incurred:50000,openCommitted:200000,serviceCommitted:150000,commitmentFloor:150000,automaticRemaining:150000,forecast:200000});
 expect(report(d).totals.incurred).toBe(50000);expect(r.entries.serviceCommitted[0].amountCents).toBe(150000);
});
it('a previsão gerencial usa a mesma integração e deixa custo final indisponível com vínculo obsoleto',()=>{
 const d=link(fixture());expect(costAtCompletion(d,{workIds:['w'],asOf:'2026-10-31'})[0].forecast).toBe(200000);
 d.terceirizados[0].contractValue=2500;const r=costAtCompletion(d,{workIds:['w'],asOf:'2026-10-31'})[0];expect(r.forecast).toBeNull();expect(r.warnings.join(' ')).toContain('sem vínculo válido');
});
it('compras independentes e contrato somam seus saldos, sem somar novamente o saldo do orçamento',()=>{
 const d=fixture();const r=applyOperationalCommand(d,cmd(d,{orderIds:[],confirmOverlap:false,sources:serviceLinkSources(d,'t',[])}));expect(r.ok).toBe(true);
 expect(row(r.data)).toMatchObject({commitmentFloor:350000,automaticRemaining:350000,forecast:400000});
});
it('respeita total do pedido reconhecido no razão e invalida vínculo quando esse total muda',()=>{
 const d=fixture();d.pedidos[0].valorTotal=3000;const saved=link(d);
 expect(row(saved)).toMatchObject({commitmentFloor:250000,forecast:300000});
 saved.pedidos[0].valorTotal=3100;expect(report(saved).services.issues[0].reason).toContain('condições');
});
it('também conserva o total canônico de compras independentes ao integrar o contrato',()=>{
 const d=fixture();d.pedidos[0].valorTotal=3000;
 const r=applyOperationalCommand(d,cmd(d,{orderIds:[],sources:serviceLinkSources(d,'t',[])}));expect(r.ok).toBe(true);
 expect(row(r.data)).toMatchObject({openCommitted:300000,commitmentFloor:450000,forecast:500000});
});
it('nota vinculada à medição e pagamento espelhado não duplicam custo nem reduzem duas vezes o compromisso',()=>{
 const d=fixture(),payment={id:'pay',obraId:'w',tercId:'t',medicaoTercId:'m',data:'2026-10-02',date:'2026-10-02',valor:200,amount:200};
 d.medicoesTerc[0].notaFiscalId='nf';d.notasFiscais=[{id:'nf',obraId:'w',pedidoId:'o',medicaoTercId:'m',status:'aprovada',valorBruto:500,emissao:'2026-10-01',pagamentos:[payment]}];d.pagsTerceiros=[payment];
 expect(row(link(d))).toMatchObject({incurred:50000,paid:20000,commitmentFloor:150000,forecast:200000});
});
it('nota de pedido distinta e medição compõem a união dos custos do mesmo escopo',()=>{
 const d=fixture();d.notasFiscais=[{id:'nf',obraId:'w',pedidoId:'o',status:'aprovada',valorBruto:300,emissao:'2026-10-01'}];
 expect(row(link(d))).toMatchObject({incurred:80000,serviceCommitted:120000,commitmentFloor:120000,forecast:200000});
});
it('rascunho, nota cancelada e pagamentos não reduzem o piso; competência posterior respeita o corte',()=>{
 const d=fixture();d.medicoesTerc[0].status='rascunho';d.notasFiscais=[{id:'nf',obraId:'w',pedidoId:'o',status:'cancelada',valorBruto:300,emissao:'2026-10-01'}];
 expect(row(link(d)).commitmentFloor).toBe(200000);
 d.medicoesTerc[0].status='aprovada';d.medicoesTerc[0].data='2026-11-01';const saved=link(d);
 expect(report(saved).rows[0]).toMatchObject({incurred:0,commitmentFloor:200000});expect(report(saved,'2026-11-30').rows[0]).toMatchObject({incurred:50000,commitmentFloor:150000});
});
it('mudança de valor, cancelamento ou orçamento retiram vínculo obsoleto e exigem conferência',()=>{
 const saved=link(fixture()),signature=costPlanningFingerprint(saved,'w');
 const d=structuredClone(saved);d.terceirizados[0].contractValue=2500;
 expect(costPlanningFingerprint(d,'w')).not.toBe(signature);expect(report(d).services.issues).toHaveLength(1);expect(row(d).serviceCommitted).toBe(0);
 d.terceirizados[0].status='cancelado';expect(report(d).services.groups).toHaveLength(0);
 const changed=structuredClone(saved);changed.budgetBaselines=[];expect(report(changed).services.issues[0].reason).toContain('Orçamento');
});
it('preserva previsão manual e histórico, mas invalida sua base quando o vínculo muda',()=>{
 const d=fixture(),before=row(d),r=applyCostControlCommand(d,{type:COST_CONTROL_COMMAND.COST_FORECAST_SAVED,actorId:'f',expectedVersion:0,payload:{obraId:'w',budgetId:'b',stageId:'s',remainingCents:12300,asOf:'2026-10-31',fingerprint:costPlanningFingerprint(d,'w'),basis:{budget:before.budget,incurred:before.incurred,committed:before.committed},note:'Valor revisado com fontes'}},'2026-10-31T10:00:00Z');
 expect(r.ok).toBe(true);const saved=link(r.data);
 expect(row(saved)).toMatchObject({remaining:12300,reviewValid:false});expect(saved.obras[0].costPlanning.history).toHaveLength(1);
});
it('rejeita concorrência, fontes alteradas, outro orçamento, etapa removida e pedidos sem confirmação',()=>{
 const d=fixture();for(const change of [{stageId:'removed'},{budgetId:'old'},{sources:'stale'},{confirmOverlap:false},{orderIds:['o','o']}])expect(applyOperationalCommand(d,cmd(d,change)).ok).toBe(false);
 expect(applyOperationalCommand(d,{...cmd(d),expectedVersion:2}).ok).toBe(false);
});
it('rejeita pedido de outra obra, rateio/etapa conflitante e o mesmo pedido em dois contratos',()=>{
 const d=fixture();d.pedidos[0].obraId='other';expect(applyOperationalCommand(d,cmd(d)).ok).toBe(false);d.pedidos[0].obraId='w';
 d.pedidos[0].itens[0].orcNivel1Id='p';expect(applyOperationalCommand(d,cmd(d)).ok).toBe(false);d.pedidos[0].itens[0].orcNivel1Id='s';
 const saved=link(d);saved.terceirizados.push({...d.terceirizados[0],id:'second'});
 expect(applyOperationalCommand(saved,{...cmd(saved,{contractId:'second',sources:serviceLinkSources(saved,'second',['o'])}),idempotencyKey:'another-contract-link'}).reason).toContain('outro contrato');
});
it('retira vínculo explicitamente, mantendo histórico e sem apagar fatos financeiros',()=>{
 const d=link(fixture()),r=applyOperationalCommand(d,{...cmd(d,{remove:true,note:'Retirar sobreposição indevida'}),idempotencyKey:'remove-service-link'});
 expect(r.ok).toBe(true);expect(r.data.obras[0].costPlanning.serviceLinks).toEqual({});expect(r.data.obras[0].costPlanning.serviceLinkHistory).toHaveLength(2);
 expect(row(r.data).serviceCommitted).toBe(0);expect(buildFinancialLedger(r.data).events).toEqual(buildFinancialLedger(d).events);
});
it('protege permissão, escopo e edição por snapshot mesmo por administrador',()=>{
 const d=fixture();for(const user of [{id:'e',role:'engenheiro'},{id:'f',role:'financeiro',obraId:'other'},{id:'f',role:'financeiro',accessTabs:['home']},{id:'f',role:'financeiro',active:false}])expect(validateOperationalCommandScope({data:d,user,command:cmd(d)}).ok).toBe(false);
 expect(validateOperationalCommandScope({data:d,user:{id:'f',role:'financeiro',obraId:'w'},command:cmd(d)}).ok).toBe(true);
 const saved=link(d);expect(validateBudgetBaselinePolicy(d,saved,{role:'admin'})).toContain('comando');
 expect(validateBudgetBaselinePolicy(saved,{obras:[{...saved.obras[0],costPlanning:{}}]},{role:'admin'})).toContain('comando');
 expect(validateBudgetBaselinePolicy(saved,{obras:[]},{role:'admin'})).toContain('histórico');
 expect(serviceForecast(d,buildFinancialLedger(d),'other',null,'2026-10-31').groups).toEqual([]);
});
