import {data as financialFixture} from './fixtures/financial-kpis-data.mjs';
import {createServer} from 'vite';
import {data as dailyFixture,splitData,legacyData,profile,engineer} from './fixtures/daily-production-data.mjs';
import {data as performanceFixture} from './fixtures/work-performance-data.mjs';
import {data as executiveFixture} from './fixtures/executive-report-data.mjs';
const fixture=process.env.MARCELL_ACCOUNTING_DEMO==='1'?(await import('./fixtures/accounting-data.mjs')).data:process.env.MARCELL_SPI_DEMO==='1'?(await import('./fixtures/spi-data.mjs')).data:process.env.MARCELL_SCHEDULE_DEMO==='1'?(await import('./fixtures/schedule-indicators-data.mjs')).data:process.env.MARCELL_FINANCIAL_KPI_DEMO==='1'?financialFixture:process.env.MARCELL_EXECUTIVE_DEMO==='1'?executiveFixture:process.env.MARCELL_KPI_DEMO==='1'?performanceFixture:dailyFixture;
let data=structuredClone(fixture),applyOperationalCommand,projectCompanyData;
// Specs freeze the browser clock; the server must stamp approvals on the same day, or reports at that reference skip them.
const demoNow=process.env.MARCELL_DEMO_NOW?new Date(process.env.MARCELL_DEMO_NOW).toISOString():'';
const port=Number(process.env.MARCELL_DAILY_PORT||4222),users=[profile,engineer,...(process.env.MARCELL_ACCOUNTING_DEMO==='1'?[(await import('./fixtures/accounting-data.mjs')).accountingFinance,(await import('./fixtures/accounting-data.mjs')).scopedFinance]:[])];
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true,watch:{ignored:['**/artifacts/**']}},plugins:[{name:'local-daily-production-api',configureServer(vite){
  vite.middlewares.use('/api',async(req,res)=>{
    res.setHeader('content-type','application/json;charset=utf-8');res.setHeader('cache-control','no-store');
    const send=(body,status=200)=>{if(process.env.MARCELL_ACCOUNTING_DEMO==='1'&&body.data)body={...body,data:projectCompanyData(body.data,body.usuario||profile)};res.statusCode=status;res.end(JSON.stringify(body));};
    try{
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024*1024)throw new Error('size');}const body=raw?JSON.parse(raw):{};
      if(body.action==='local-reset')data=structuredClone(body.variant==='split'?splitData:body.variant==='legacy'?legacyData:fixture);
      const tokenUser=req.headers.authorization?.replace(/^Bearer local-daily-/, '');
      const usuario=users.find(user=>user.id===body.userId||user.id===tokenUser||user.email===body.email)||profile;
      if(process.env.MARCELL_SPI_DEMO==='1'&&body.action==='save-sections'){const sections=body.sections||{};if(Object.keys(sections).some(key=>!['planos','condominios'].includes(key)))return send({ok:false,error:'A demonstração permite somente ajustes do planejamento fictício.'},403);data={...data,...sections};return send({ok:true,updatedAt:new Date().toISOString(),savedSections:Object.keys(sections)});}
      if(['save','save-sections','financial-command'].includes(body.action))return send({ok:false,error:'Demonstração local: gravação financeira bloqueada.'},403);
      if(body.action==='operational-command'){
        const command=body.command;
        if(!['RDO_CAMPO_ALTERADO','RDO_CAMPO_REABERTO','RDO_CAMPO_CANCELADO',...(process.env.MARCELL_SPI_DEMO==='1'?['BASE_PLANEJAMENTO_PROPOSTA','BASE_PLANEJAMENTO_APROVADA']:[]),...(process.env.MARCELL_ACCOUNTING_DEMO==='1'?['BASE_CONTABIL_IMPORTADA','BASE_CONTABIL_CONFERIDA']:[])].includes(command?.type))return send({ok:false,error:'Somente diários fictícios podem ser alterados nesta demonstração.'},403);
        if(command.payload?.report?.status==='concluido'&&usuario.role!=='engenheiro')return send({ok:false,error:'Use o perfil da engenharia para concluir.'},403);
        if(command?.type?.startsWith('BASE_PLANEJAMENTO_')||command?.type?.startsWith('BASE_CONTABIL_')){const scope=await server.ssrLoadModule('/server/operational-command-policy.js');const auth=scope.validateOperationalCommandScope({user:usuario,data,command});if(!auth.ok)return send({ok:false,error:auth.error},403);command.now=demoNow||new Date().toISOString();}
        const previous=data;
        const result=applyOperationalCommand(data,{...command,actorId:usuario.id,actorName:usuario.nome,actorRole:usuario.role});
        if(!result.ok)return send(result,422);data=result.data;
        if(process.env.MARCELL_ACCOUNTING_DEMO==='1'&&command.type.startsWith('BASE_CONTABIL_')){const {projectChangedSectionsPatch}=await server.ssrLoadModule('/server/section-patch.js');return send({ok:true,sections:projectChangedSectionsPatch(previous,data,usuario),updatedAt:new Date().toISOString()});}
      }
      const extra=body.action==='profiles'?{usuarios:users,precisaSetup:false}:{};
      send({ok:true,data,usuario,items:[],bases:[],presencas:[],...extra,accessToken:`local-daily-${usuario.id}`,refreshToken:'local-daily',updatedAt:new Date().toISOString()});
    }catch(error){send({ok:false,error:error.message||'Falha local.'},400);}
  });
}}]});
({applyOperationalCommand}=await server.ssrLoadModule('/src/domains/sync/operational-commands.js'));
if(process.env.MARCELL_ACCOUNTING_DEMO==='1'){
 ({projectDataForUser:projectCompanyData}=await server.ssrLoadModule('/server/data-projection.js'));
 const {applyAccountingCommand,ACCOUNTING_COMMAND,accountingErpComparison}=await server.ssrLoadModule('/src/domains/financeiro/accounting-indicators.js');
 const {accountingCsv}=await import('./fixtures/accounting-data.mjs');
 const actor={actorId:profile.id,actorName:profile.nome,actorRole:'admin'};
 const draft=applyAccountingCommand(data,{...actor,type:ACCOUNTING_COMMAND.ACCOUNTING_BASE_IMPORTED,expectedVersion:0,payload:{id:'accounting-example-v1',csv:accountingCsv,filename:'balancete-ficticio-outubro.csv',entity:data.config.companyName,document:'Balancete fictício de outubro/2026',note:'Base fictícia preparada para testar os indicadores conferíveis.',start:'2026-10-01',end:'2026-10-31'}},'2026-11-02T15:00:00Z');
 if(!draft.ok)throw new Error(draft.reason);
 const reviewed=applyAccountingCommand(draft.data,{...actor,type:ACCOUNTING_COMMAND.ACCOUNTING_BASE_REVIEWED,expectedVersion:1,payload:{id:'accounting-example-v1',completeCoverage:true,erpFingerprint:accountingErpComparison(draft.data,'2026-10-01','2026-10-31').fingerprint,reconciliationNote:'Exemplo fictício: a contabilidade da empresa inclui receitas, despesas e ajustes além do recorte operacional das obras.'}},'2026-11-02T15:01:00Z');
 if(!reviewed.ok)throw new Error(reviewed.reason);
 data=reviewed.data;fixture.accountingBases=structuredClone(data.accountingBases);
}
if(process.env.MARCELL_SPI_DEMO==='1'){
 const {proposeBaselineSnapshot,applyBaselineCommand,BASELINE_COMMAND}=await server.ssrLoadModule('/src/domains/planejamento/approved-baseline.js');
 const signature=proposeBaselineSnapshot(data,'a').signature;
 const proposed=applyBaselineCommand(data,{type:BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED,actorId:profile.id,actorName:profile.nome,actorRole:'admin',expectedVersion:0,payload:{obraId:'a',id:'spi-baseline-v1',signature,reason:'Base inicial fictícia aprovada para teste local'}},'2026-10-01T12:00:00Z');
 if(!proposed.ok)throw new Error(proposed.reason);
 const approved=applyBaselineCommand(proposed.data,{type:BASELINE_COMMAND.SCHEDULE_BASELINE_APPROVED,actorId:profile.id,actorName:profile.nome,actorRole:'admin',expectedVersion:1,payload:{obraId:'a',id:'spi-baseline-v1'}},'2026-10-01T13:00:00Z');
 if(!approved.ok)throw new Error(approved.reason);
 data=approved.data;fixture.scheduleBaselines=structuredClone(data.scheduleBaselines);
}
if(process.env.MARCELL_EXECUTIVE_DEMO==='1'){
  const {costForecastBundle}=await server.ssrLoadModule('/src/domains/financeiro/management-forecasts.js');
  const report=costForecastBundle(data,{workIds:['a'],asOf:'2026-11-02'}).reports[0].report;
  const work=data.obras.find(item=>item.id==='a');
  work.costPlanning={version:1,stages:Object.fromEntries(report.rows.map(row=>[row.id,{budgetId:report.budget.id,fingerprint:report.fingerprint,asOf:'2026-11-02',basis:{incurred:row.incurred,committed:row.committed,budget:row.budget},remainingCents:row.id==='forecast-stage'?Math.max(0,report.totals.budget-report.totals.incurred):0,contingencyCents:0,note:'Revisão fictícia para testar a apresentação: saldo de pessoal incluído na etapa, sem duplicar custos sem apropriação.'}]))};
}
await server.listen();
console.log(`Integração diária fictícia: http://127.0.0.1:${port}. Diários somente na memória; reiniciar descarta alterações.`);
console.log('Financeiro: piloto@local.test / piloto-local. Engenharia: engenharia@local.test / piloto-local. Nenhuma conexão com produção.');
