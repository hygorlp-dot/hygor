// @vitest-environment node
// Ensaio local isolado. API, comandos, sincronização, ARP, SQL e auditoria são
// reais; Auth, relógio/NTP e captura física são dublês explícitos de teste.
// Não usa rede, banco de homologação, câmera, banco financeiro ou datas reais.
import {randomUUID} from 'node:crypto';
import {afterAll,it,expect,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {criarServidor,criarAparelho} from '../../apps/ponto-obra/src/logica/cenario.test-helper.js';
import {sincronizarCadastro,enviarPendentes} from '../../apps/ponto-obra/src/logica/sincronizacao.js';
import {camadaSupabase,lerMigration} from '../../server/ponto-eletronico/banco-pglite.test-helper.js';
import {criarTratadorPonto} from '../../server/ponto-eletronico/handler.js';
import {criarFonteHora} from '../../server/ponto-eletronico/tempo/fonte-hora.js';
import {decodeAppData} from '../../server/data-codec.js';
import {createLocalSimulation,simulationEmployees,simulationWorkdays,simulationAllocations,SIMULATION_IDS as IDS,SIMULATION_TIME} from '../../scripts/simulacao/fulano-siclano.mjs';
import {OPERATIONAL_COMMAND as OP} from '../domains/sync/operational-commands.js';
import {advanceDeductionForPeriod} from '../domains/rh/advance-commands.js';
import {advancePaymentStatus} from '../domains/rh/advance-settlements.js';
import {prepareMonthlyPayslip} from '../domains/ponto/clt-preparation.js';
import {MANUAL_DAILY_CLT_CHECKS} from '../domains/ponto/clt-payslip.js';
import {reviewMonthlyPayslip} from '../domains/ponto/clt-review.js';
import {buildMixedPayroll} from '../domains/ponto/mixed-payroll.js';
import {cltPayslipHtml} from '../domains/ponto/clt-report.js';
import {buildRequestedDreProjectionRows} from '../../server/dre-projection.js';
import {buildFinancialLedger,selectAccountsPayable,selectCashFlow} from '../domains/financeiro/ledger.js';

vi.setConfig({testTimeout:120000,hookTimeout:30000});
const state=vi.hoisted(()=>({pg:null,db:null,sql:[]}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
  from:(...args)=>state.db.from(...args),rpc:(...args)=>state.db.rpc(...args),
  storage:{from:(...args)=>state.db.storage.from(...args)},
  auth:{getUser:async token=>({data:{user:token?.startsWith('qa-')?{id:`auth-${token}`} :null},error:null})},
})}));
const JSON_VALUE=Symbol('postgres-json');
const sqlAdapter=pg=>{
  const sql=async(strings,...values)=>{
    const query=strings.reduce((text,part,index)=>text+(index?`$${index}`:'')+part,'');
    state.sql.push(query.replace(/\s+/g,' ').trim());
    const parameters=values.map(value=>value&&typeof value==='object'&&JSON_VALUE in value?JSON.stringify(value[JSON_VALUE]):value);
    return (await pg.query(query,parameters)).rows;
  };
  sql.json=value=>({[JSON_VALUE]:value});
  return sql;
};
vi.mock('postgres',()=>({default:()=>Object.assign(sqlAdapter(state.pg),{
  begin:callback=>state.pg.transaction(transaction=>callback(sqlAdapter(transaction))),end:async()=>{},
})}));

const CORE='arced_ponto_v1';
let handler,server,device,sequence=0;
afterAll(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
const nextKey=label=>`qa-simulacao-${label}-${++sequence}`;
async function call(body,user=IDS.admin){
  let status=200,payload;const res={status(value){status=value;return res;},json(value){payload=value;return value;}};
  await handler({body:{accessToken:user,...body},query:{},headers:{'x-forwarded-for':'127.0.0.1'}},res);
  return {status,body:payload};
}
async function load(){const result=await call({action:'load'});expect(result.status,JSON.stringify(result.body)).toBe(200);return result.body.data;}
async function command(type,payload,{user=IDS.rh,key=nextKey(type),version=0}={}){
  const request={action:'operational-command',command:{type,idempotencyKey:key,expectedVersion:version,payload}};
  const result=await call(request,user);expect(result.status,JSON.stringify(result.body)).toBe(200);
  server.dados=await load();return {request,result};
}
function clock(iso){
  const ms=Date.parse(iso);if(device)device.monotonicoMs+=ms-server.relogioServidor;
  server.relogioServidor=ms;vi.setSystemTime(new Date(ms));
}
const pointHandler=(db)=>{
  const handle=criarTratadorPonto({db,company:IDS.company,lerDados:async()=>server.dados,
  ambienteDeclarado:'homologacao',supabaseUrl:'https://qa-isolated-simulation.supabase.co',autenticarUsuario:async body=>body.accessToken==='admin'?server.dados.usuarios[0]:server.dados.usuarios.find(user=>user.id===body.accessToken),
  fonteHora:criarFonteHora({relogioHost:()=>server.relogioServidor,cacheMs:0,
    ultimaVerificacao:async()=>({ok:true,servidor:'relogio-controlado.invalid',verificadoEm:new Date(server.relogioServidor).toISOString(),offsetMs:0,incertezaMs:1})}),
  });
  // Adaptador em memória inclui o ambiente fixo, como a conexão HTTP do app.
  return request=>handle({...request,body:{ambienteApp:'homologacao',...request.body}});
};
const accountingCosts=data=>buildRequestedDreProjectionRows(data,[IDS.obraA,IDS.obraB].map(scope=>({year:2026,month:9,scope})))
  .map(row=>({scope:row.scope,total:row.payload.totalCustos,labor:row.payload.moData?.laborCost,benefits:row.payload.moData?.benefitCost}));

async function bankPayment(titleId,amount,date,label){
  const transactionId=nextKey(`banco-${label}`),before=await load(),costs=accountingCosts(before);
  await command(OP.BANK_TRANSACTIONS_IMPORTED,{statement:{id:`extrato-${transactionId}`,arquivo:'extrato-SIMULACAO.ofx',hashArquivo:transactionId},
    transactions:[{id:transactionId,chave:transactionId,data:date,descricao:`SIMULAÇÃO — ${label}`,valor:-amount}]},{user:IDS.financeiro});
  const request={action:'reconciliation-command',command:{type:'CONFIRM_PAYMENT',idempotencyKey:nextKey('baixa'),payload:{transactionId,targetType:'tituloFolha',targetId:titleId}}};
  const denied=await call(request,IDS.encarregado);expect(denied.status).toBe(403);
  const paid=await call(request,IDS.financeiro);expect(paid.status,JSON.stringify(paid.body)).toBe(200);
  const after=await load(),title=after.titulosFolha.find(item=>item.id===titleId);
  expect(accountingCosts(after)).toEqual(costs);
  const repeated=await call(request,IDS.financeiro);expect(repeated.status).toBe(200);expect(repeated.body.idempotent).toBe(true);
  expect((await load()).titulosFolha.find(item=>item.id===titleId).liquidacoes).toEqual(title.liquidacoes);
  return after;
}
async function setup(){
  const initial=createLocalSimulation();
  initial.usuarios=initial.usuarios.map(user=>({...user,authUserId:`auth-${user.id}`}));
  initial.employees=initial.employees.map(employee=>({id:employee.id,name:employee.name,testData:true,cadastroPendente:true}));
  initial.operationalCommandReceipts=[];
  server=await criarServidor({dados:initial,estabelecimento:false,comResponsavel:false});
  state.pg=server.pg;state.db=server.db;server.tratar=pointHandler(server.db);
  await server.pg.exec(`create table company_app_data(company_id text not null,key text not null,value jsonb not null,
    updated_at timestamptz not null default now(),updated_by uuid,primary key(company_id,key));
    create table arcd_ambiente(id boolean primary key,ambiente text not null);
    insert into arcd_ambiente values (true,'homologacao');`);
  await server.pg.exec(lerMigration('20260725_append_only_audit.sql'));
  for(const migration of ['20260725_financial_engine.sql','001_sync_legacy_financial.up.sql',
    '002_financial_transactional_projection.up.sql','003_accounting_period_enforcement.up.sql',
    '004_financial_events_projection_conflict.up.sql','008_skip_dre_snapshot_sync_on_write.up.sql',
    '20261023144434_api_reconciliation_integrity.up.sql','20261023154632_dre_cash_allocations.up.sql']){
    await server.pg.exec(lerMigration(migration));
  }
  const {config,attendance,attendanceLocks,...core}=initial;
  for(const [key,value] of [[CORE,core],[CORE+'__ponto',{attendance,attendanceLocks,attendanceOperationReceipts:[]}],[CORE+'__config',{config}]]){
    await server.pg.query('insert into company_app_data(company_id,key,value,updated_at) values ($1,$2,$3::jsonb,$4)',[IDS.company,key,JSON.stringify(value),SIMULATION_TIME]);
  }
  vi.stubEnv('SUPABASE_URL','https://qa-isolated-simulation.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only');
  vi.stubEnv('POSTGRES_URL_NON_POOLING','postgres://local-pglite-only');vi.stubEnv('COMPANY_ID',IDS.company);
  vi.stubEnv('FINANCIAL_ENGINE_ENFORCE','true');vi.stubEnv('PONTO_AMBIENTE','homologacao');
  ({default:handler}=await import('../../api/data.js'));
  vi.useFakeTimers({toFake:['Date']});clock(SIMULATION_TIME);
  for(const employee of simulationEmployees())await command(OP.EMPLOYEE_SAVED,{employee});
  const data=await load();expect(data.employees.map(employee=>employee.employmentRelationship)).toEqual(['clt','clt']);
  expect(data.employees.find(employee=>employee.id===IDS.siclano).monthlySalary||0).toBe(0);
  const wrongRole=await call({action:'operational-command',command:{type:OP.EMPLOYEE_SAVED,idempotencyKey:nextKey('cadastro-negado'),expectedVersion:data.employees[0].version,payload:{employee:data.employees[0]}}},IDS.financeiro);
  expect(wrongRole.status).toBe(403);
  server.estabelecimentoA=await server.criarEstabelecimento('Estabelecimento QA — SIMULAÇÃO',[IDS.obraA,IDS.obraB]);
  device=await criarAparelho(server,{obraId:IDS.obraA,nome:'Aparelho QA — memória de teste'});
}

async function multiworkVariant(employee,date,intervals,sourceEventIds){
  const basePg=state.pg,baseDb=state.db,variant=new PGlite({loadDataDir:await basePg.dumpDataDir(),extensions:{pgcrypto}});
  try{
    state.pg=variant;state.db=camadaSupabase(variant);
    const handler=pointHandler(state.db),changed=await handler({action:'ponto-apropriacao-salvar',body:{accessToken:IDS.rh,
      apropriacao:{...intervals[1],obraApropriadaId:IDS.obraB,motivo:'Variação isolada de jornada em duas obras no mesmo dia'}}});
    expect(changed.status,JSON.stringify(changed.json)).toBe(200);
    const before=await load(),attempt=await call({action:'attendance-import-mobile',operationId:randomUUID(),employeeId:employee.id,date,status:'P',ot:0,atrasoMin:0,
      sourceEventIds,appropriationVersions:intervals.map((interval,index)=>({id:interval.id,version:index===1?changed.json.version:interval.version}))},IDS.rh);
    expect(attempt.status).toBe(409);expect(attempt.body.error).toMatch(/mais de uma obra/);
    const after=await load();expect(after.attendance?.[employee.id]?.[date]).toBeUndefined();
    expect(after.titulosFolha).toEqual(before.titulosFolha);expect(after.pagamentosFolha).toEqual(before.pagamentosFolha);
    expect((await variant.query('select count(*)::int as n from ponto_apropriacoes where employee_id=$1 and data=$2 and status=\'ativa\'',[employee.id,date])).rows[0].n).toBe(2);
  }finally{state.pg=basePg;state.db=baseDb;await variant.close();}
}

async function captureAndImportDay(date,{variant=false}={}){
  clock(`${date}T10:50:00Z`);
  const sync=await sincronizarCadastro({armazem:device.armazem,api:device.api,monotonico:device.monotonico,ambienteApp:'homologacao'});expect(sync.ok).toBe(true);
  const employees=server.dados.employees.filter(employee=>simulationWorkdays(employee,date,date).length);
  if(date==='2026-10-01')expect(server.dados.attendance?.[IDS.siclano]?.[date]).toBeUndefined();
  if(date==='2026-10-06')device.online=false;
  const eventsByEmployee=new Map(employees.map(employee=>[employee.id,[]]));
  for(const hour of ['11:00','15:00','16:00','20:00']){
    clock(`${date}T${hour}:00Z`);
    for(const employee of employees){
      const event=await device.bater({pessoa:{tipo:'funcionario',id:employee.id,cpf:employee.cpf}});
      expect(event.horaConfiavel).toBe(true);eventsByEmployee.get(employee.id).push(event);
    }
  }
  if(!device.online){expect((await enviarPendentes({armazem:device.armazem,api:device.api})).semRede).toBe(true);device.online=true;}
  if(date==='2026-10-07')device.perderResposta=1;
  await enviarPendentes({armazem:device.armazem,api:device.api});
  if(date==='2026-10-07'){
    const count=(await server.eventos()).length;await enviarPendentes({armazem:device.armazem,api:device.api});
    expect((await server.eventos()).length).toBe(count);
  }
  expect(await device.armazem.eventosPendentes(100)).toEqual([]);
  clock(`${date}T20:15:00Z`);
  const locks=new Set();
  for(const employee of employees){
    const proposal=await server.tratar({action:'ponto-apropriacao-propor',body:{accessToken:IDS.rh,employeeId:employee.id,data:date}});
    expect(proposal.status,JSON.stringify(proposal.json)).toBe(200);expect(proposal.json.intervalos).toHaveLength(2);
    const allocations=simulationAllocations(date),obraId=allocations.length===1?allocations[0].obraId:IDS.obraA;
    const intervals=[];
    for(const interval of proposal.json.intervalos){
      const raw={employeeId:employee.id,data:date,inicio:interval.inicio,fim:interval.fim,obraApropriadaId:obraId,origem:'proposta_capturas',motivo:'Cenário base: jornada integral na obra indicada, conferida pelo RH QA'};
      const saved=await server.tratar({action:'ponto-apropriacao-salvar',body:{accessToken:IDS.rh,apropriacao:raw}});
      expect(saved.status,JSON.stringify(saved.json)).toBe(200);intervals.push({...raw,id:saved.json.id,version:saved.json.version});
    }
    const sourceEventIds=eventsByEmployee.get(employee.id).map(event=>event.eventId).sort();
    if(variant&&employee.id===IDS.siclano)await multiworkVariant(employee,date,intervals,sourceEventIds);
    const request={action:'attendance-import-mobile',operationId:randomUUID(),employeeId:employee.id,date,status:'P',ot:0,atrasoMin:0,note:'Conferência sintética do fluxo completo',
      sourceEventIds,appropriationVersions:intervals.map(interval=>({id:interval.id,version:interval.version}))};
    const imported=await call(request,IDS.rh);expect(imported.status,JSON.stringify(imported.body)).toBe(200);
    expect(imported.body.result.attendance[0].record).toMatchObject({status:'P',entrada:'08:00',saida:'17:00',workedMinutes:480,obraId});
    if(date==='2026-10-07'){const again=await call(request,IDS.rh);expect(again.body.idempotent).toBe(true);}
    locks.add(obraId);
  }
  for(const obraId of locks){const locked=await call({action:'attendance-lock',operationId:randomUUID(),date,obraId},IDS.rh);expect(locked.status,JSON.stringify(locked.body)).toBe(200);}
  server.dados=await load();
}

async function createAdvances(){
  const before=await load(),costs=accountingCosts(before);
  for(const [empId,amount] of [[IDS.fulano,1320],[IDS.siclano,600]]){
    const id=`qa-adiantamento-${empId}`;
    await command(OP.PAYROLL_ADVANCE_CREATED,{advance:{id,empId,date:'2026-10-20',firstDueDate:'2026-10-31',amount,installmentCount:1,frequency:'mensal',description:'Adiantamento quinzenal — SIMULAÇÃO'}});
    let data=await load(),advance=data.advances.find(item=>item.id===id);
    expect(advanceDeductionForPeriod(advance,'2026-10-01','2026-10-31',data)).toBe(0);
    expect(advancePaymentStatus(advance,data)).toMatchObject({paid:0,status:'pending'});
    expect(accountingCosts(data)).toEqual(costs);
    data=await bankPayment(advance.paymentTitleId,amount,'2026-10-20',`adiantamento-${empId}`);
    advance=data.advances.find(item=>item.id===id);
    expect(advanceDeductionForPeriod(advance,'2026-10-01','2026-10-31',data)).toBe(amount);
    expect(advancePaymentStatus(advance,data)).toMatchObject({paid:amount,balance:0,status:'paid'});
  }
  expect((await load()).employees.every(employee=>!employee.cltPayroll.drafts['2026-10'])).toBe(true);
}

async function prepareOctober(){
  const nets={};
  for(const id of [IDS.fulano,IDS.siclano]){
    const data=await load(),employee=data.employees.find(item=>item.id===id),prepared=prepareMonthlyPayslip(data,employee,'2026-10');
    expect(prepared.point.errors).toEqual([]);
    const draft={...prepared.draft,...prepared.point.fields,contractPeriodReviewed:true,confirmed:true,
      attendanceSource:{signature:prepared.point.signature,options:prepared.options,importedAt:new Date().toISOString(),importedBy:'RH QA'},
      fiscalMode:'manual',manualInss:id===IDS.fulano?284.60:213.29,manualIrrf:0,manualIrrfBase:id===IDS.fulano?3015.40:2426.71,
      manualReason:'Memória fictícia QA de regime de caixa; valores independentes, sem validação fiscal real.'};
    if(id===IDS.siclano)Object.assign(draft,{manualFgts:211.20,assessmentReference:'QA-SICLANO-OUTUBRO',assessmentResponsible:'Contabilidade QA — SIMULAÇÃO',
      assessmentMemory:'SIMULAÇÃO: 18 diárias de 120 = 2160; descansos 360; feriado 120; cesta 65. INSS 213,29; IRRF 0; base IRRF 2426,71; FGTS 211,20. Memória independente de teste, sem validade fiscal.',
      assessmentReviewChecklist:Object.fromEntries(MANUAL_DAILY_CLT_CHECKS.map(item=>[item.key,true])),
      custom:[['Diárias trabalhadas',2160,true,'18 × 120'],['Descansos',360,true,'Memória QA, item 2'],['Feriado',120,true,'Memória QA, item 3'],['Cesta',65,false,'Memória QA, item 4']]
        .map(([label,amount,tax,reference])=>({label,amount,reference,kind:'earning',inss:tax,irrf:tax,fgts:tax}))});
    await command(OP.EMPLOYEE_SAVED,{employee:{...employee,cltPayroll:{...employee.cltPayroll,drafts:{...employee.cltPayroll.drafts,'2026-10':draft}}}},{version:employee.version});
    const fresh=await load(),review=reviewMonthlyPayslip(fresh,fresh.employees.find(item=>item.id===id),'2026-10');
    expect(review.errors).toEqual([]);nets[id]=review.result.net;
    const html=cltPayslipHtml({company:fresh.config,employee:review.employee,draft:review.draft,result:review.result,bodyOnly:true});
    expect(html).toContain('SIMULAÇÃO');expect(html).toContain('não comprova pagamento');
  }
  expect(nets).toEqual({[IDS.fulano]:1695.40,[IDS.siclano]:1891.71});return nets;
}

it('cumpre o percurso dos dois trabalhadores com SQL real, cronologia e reenvios preservados',async()=>{
  await setup();
  const days=simulationWorkdays(simulationEmployees()[0]);
  for(const date of days){
    await captureAndImportDay(date,{variant:date==='2026-10-19'});
    if(date==='2026-10-20')await createAdvances();
  }
  const fiscals=await server.fiscais(server.estabelecimentoA),allData=await load();
  expect(fiscals).toHaveLength(180);expect(new Set(fiscals.map(item=>String(item.nsr))).size).toBe(180);
  expect(allData.attendance[IDS.fulano]['2026-10-14'].obraId).toBe(IDS.obraB);
  expect(Object.keys(allData.attendance[IDS.siclano])).toHaveLength(21);
  const net=await prepareOctober(),beforeApproval=await load(),costs=accountingCosts(beforeApproval);
  expect(costs.reduce((sum,row)=>sum+Number(row.total),0)).toBeGreaterThan(0);
  const period={year:2026,month:9,cycle:'2',cltPlans:Object.fromEntries(Object.entries(net).map(([id,amount])=>[id,{competence:'2026-10',amount,reference:'Saldo após adiantamento pago e memória conferida'}]))};
  const built=buildMixedPayroll(beforeApproval,period);expect(built.rows).toHaveLength(2);expect(built.rows.flatMap(row=>row.issues)).toEqual([]);
  const payload={period,rowIds:built.rows.map(row=>row.id),sources:Object.fromEntries(built.rows.map(row=>[row.id,row.source])),paymentDate:'2026-11-05'};
  const approved=await command(OP.MIXED_PAYROLL_APPROVED,payload);expect((await call(approved.request,IDS.rh)).body.idempotent).toBe(true);
  let data=await load();expect(data.titulosFolha).toHaveLength(4);expect(accountingCosts(data)).toEqual(costs);
  expect(selectAccountsPayable(buildFinancialLedger(data),{}).balanceCents).toBe(358711);
  for(const row of built.rows){
    data=await bankPayment(row.id,900,'2026-11-05',`folha-parcial-${row.employeeId}`);
    expect(data.titulosFolha.find(title=>title.id===row.id).status).toBe('parcial');
    data=await bankPayment(row.id,Math.round((net[row.employeeId]-900)*100)/100,'2026-11-05',`folha-saldo-${row.employeeId}`);
    expect(data.titulosFolha.find(title=>title.id===row.id)).toMatchObject({status:'pago',saldo:0});
  }
  expect(selectAccountsPayable(buildFinancialLedger(data),{}).balanceCents).toBe(0);
  expect(selectCashFlow(buildFinancialLedger(data),{}).cashOutCents).toBe(550711);
  expect(accountingCosts(data)).toEqual(costs);expect(await server.fiscais(server.estabelecimentoA)).toEqual(fiscals);
  expect(state.sql.some(query=>query.includes('lock table ponto_eventos, ponto_apropriacoes in share mode'))).toBe(true);
  expect(state.sql.some(query=>query.includes('order by key for update'))).toBe(true);
  const audit=(await server.pg.query('select action,actor_id from audit_events')).rows;
  expect(audit.some(item=>item.action==='attendance_import_mobile'&&item.actor_id===IDS.rh)).toBe(true);
  expect(audit.some(item=>item.action==='operational_quinzena_mista_aprovada'&&item.actor_id===IDS.rh)).toBe(true);
  expect(audit.some(item=>item.action==='reconciliation_confirm_payment'&&item.actor_id===IDS.financeiro)).toBe(true);
  await expect(server.pg.query('delete from audit_events')).rejects.toThrow(/append-only/);
  // A competência seguinte conserva sua própria pendência: nunca reaproveita
  // a confirmação/auditoria de outubro nem promete fechar mês ainda aberto.
  const november=prepareMonthlyPayslip(data,data.employees.find(employee=>employee.id===IDS.siclano),'2026-11');
  expect(november.draft.confirmed).toBe(false);expect(november.draft.assessmentReference).toBe('');expect(november.point.errors.length).toBeGreaterThan(0);
  clock('2026-11-06T16:00:00Z');
  const employee=data.employees.find(item=>item.id===IDS.siclano);
  await command(OP.EMPLOYEE_SAVED,{employee:{...employee,active:false,endDate:'2026-11-06',terminationReason:'Desligamento fictício do ensaio'}} ,{version:employee.version});
  await command(OP.PAYROLL_RESCISSION_CREATED,{rescission:{id:'qa-rescisao-siclano',empId:employee.id,empName:employee.name,
    admissao:employee.startDate,demissao:'2026-11-06',valorMensal:2640,diasNoMes:3,tipo:'sem_justa_causa',incluirSaldo:true,incluir13:true,incluirFerias:true,incluirAviso:false,descAdiantamento:0,descOutros:0,
    accounting:{responsible:'Contabilidade QA — SIMULAÇÃO',reference:'QA-RESC-2026: base recebida na memória; sem diária × 26',totalNet:350,confirmed:true}}});
  const ended=await load();expect(ended.rescisoes[0]).toMatchObject({calculationSource:'contabilidade_identificada',totalLiquido:350});
  expect(reviewMonthlyPayslip(ended,ended.employees.find(item=>item.id===IDS.siclano),'2026-10').errors).toEqual([]);
  expect(await server.fiscais(server.estabelecimentoA)).toEqual(fiscals);
  clock('2026-11-07T10:00:00Z');
  await sincronizarCadastro({armazem:device.armazem,api:device.api,monotonico:device.monotonico,ambienteApp:'homologacao'});
  expect((await device.armazem.cadastro()).funcionarios.map(item=>item.id)).not.toContain(IDS.siclano);
  const stored=(await server.pg.query('select value from company_app_data where key=$1',[CORE])).rows[0].value;
  expect(decodeAppData(stored).employees.find(item=>item.id===IDS.siclano).employmentRelationship).toBe('clt');
});
