// @vitest-environment node
import {beforeAll,afterAll,beforeEach,it,expect,vi} from "vitest";
import {newPortalDatabase} from "../server/client-portal.test-helper.js";
import {executeClientPortalAdmin} from "../server/client-portal-admin.js";
import {createPortalSessionToken,hashPortalSessionToken,verifyPortalPassword} from "../server/client-portal-auth.js";
import {portalFixture,seedPortalSource} from "../server/client-portal.fixture.js";
import {portalSimulationFixture} from "../server/client-portal-simulation.fixture.js";
import {portalAccountabilityFixture} from '../server/client-portal-accountability.fixture.js';
import {attendanceObraKey} from "../server/attendance-obra-routing.js";
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const state=vi.hoisted(()=>({db:null}));
vi.mock("../server/client-portal-runtime.js",async original=>({...await original(),portalDb:()=>state.db}));
vi.mock("../server/microsoft/graph.js",()=>({refresh:vi.fn(async()=>({accessToken:"token-exclusivo-servidor"})),graph:vi.fn(async(token,path)=>({json:async()=>path.includes("$select=")?{id:"file"}:{"@microsoft.graph.downloadUrl":"https://files.example.test/temporario.pdf"}}))}));
import {graph} from "../server/microsoft/graph.js";
import handler from "./client.js";
let db;
async function pdfText(bytes){
 const document=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
 try{
  const pages=[];
  for(let page=1;page<=document.numPages;page++)pages.push((await (await document.getPage(page)).getTextContent()).items.map(item=>item.str).join(' '));
  return pages.join(' ').replace(/\s+/g,' ');
 }finally{await document.destroy();}
}
it('usa o dia da Bahia para incluir o aporte somente na data efetiva, preservando o saldo anterior',async()=>{
 vi.useFakeTimers({toFake:['Date']});
 try{
  vi.setSystemTime(new Date('2026-11-18T02:59:00Z'));
  const source=portalAccountabilityFixture();await seedPortalSource(db,source);
  for(const operation of ['provision','publish'])await executeClientPortalAdmin({db,companyId:'arcd',data:source,actor,body:{operation,obraId:'obra-local',email:'cliente@example.com',password:'SenhaInicial1234',profile:'owner'}});
  const before=await request('projects/obra-local/statement',{cookie:await login(),query:{month:'2026-11',format:'json'}});
  expect(before.code).toBe(200);expect(before.body.statement.asOf).toBe('2026-11-17');expect(before.body.statement.cash.closing).toBe(8620);
  expect(before.body.statement.cash.movements.some(row=>row.id==='aporte-futuro-sim')).toBe(false);
  vi.setSystemTime(new Date('2026-11-18T03:00:00Z'));
  const after=await request('projects/obra-local/statement',{cookie:await login(),query:{month:'2026-11',format:'json'}});
  expect(after.code).toBe(200);expect(after.body.statement.asOf).toBe('2026-11-18');expect(after.body.statement.cash.closing).toBe(13620);
  expect(after.body.statement.cash.entries-before.body.statement.cash.entries).toBe(5000);
  expect(after.body.statement.cash.exits).toBe(before.body.statement.cash.exits);
  const pdf=await request('projects/obra-local/statement',{cookie:await login(),query:{month:'2026-11'}});
  expect(await pdfText(pdf.body)).toContain('Saldo final: R$ 13.620,00');
  const email=await request('projects/obra-local/statement',{cookie:await login(),query:{month:'2026-11',format:'email'}});
  const attachment=email.body.match(/Content-Type: application\/pdf[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--marcell_statement_boundary--/);
  expect(attachment).toBeTruthy();
  expect(await pdfText(Buffer.from(attachment[1],'base64'))).toContain('Saldo final: R$ 13.620,00');
 }finally{vi.useRealTimers();}
});
it('baixa PDF e e-mail com anexo e aplica sessão, vínculo, mês e revogação dos custos',async()=>{
 vi.useFakeTimers({toFake:['Date']});
 try{
 vi.setSystemTime(new Date('2026-11-17T15:00:00-03:00'));
 const source=portalAccountabilityFixture();await seedPortalSource(db,source);
 for(const operation of ['provision','publish'])await executeClientPortalAdmin({db,companyId:'arcd',data:source,actor,body:{operation,obraId:'obra-local',email:'cliente@example.com',password:'SenhaInicial1234',profile:'owner'}});
 expect((await request('projects/obra-local/statement')).code).toBe(401);
 const cookie=await login();
 const json=await request('projects/obra-local/statement',{cookie,query:{month:'2026-11',format:'json'}});expect(json.code).toBe(200);expect(json.body.statement.asOf).toBe('2026-11-17');expect(json.body.statement.cash.closing).toBe(8620);
 const pdf=await request('projects/obra-local/statement',{cookie,query:{month:'2026-11'}});expect(pdf.code).toBe(200);expect(pdf.headers['Content-Type']).toBe('application/pdf');expect(pdf.body.subarray(0,5).toString()).toBe('%PDF-');
 expect(await pdfText(pdf.body)).toContain('Saldo final: R$ 8.620,00');
 const email=await request('projects/obra-local/statement',{cookie,query:{month:'2026-11',format:'email'}});expect(email.code).toBe(200);expect(email.body).toContain('To: cliente@example.com');expect(email.body).toContain('Content-Type: application/pdf');
 expect((await request('projects/other/statement',{cookie})).code).toBe(403);
 expect((await request('projects/obra-local/statement',{cookie,query:{month:'2099-01'}})).code).toBe(400);
 source.obras[0].portalCliente.publicarCustos=false;await seedPortalSource(db,source);expect((await request('projects/obra-local/statement',{cookie})).code).toBe(403);
 }finally{vi.useRealTimers();}
});
const actor={id:"admin-1",role:"admin"},data={obras:[{id:"a",name:"Casa A",portalCliente:{ativo:true,publicarFotos:false,publicarCronograma:false}},{id:"b",name:"Casa B"}]};
const admin=(operation,extra={})=>executeClientPortalAdmin({db,companyId:"arcd",data,actor,body:{operation,obraId:"a",...extra}});
async function request(route,{method="GET",body={},cookie="",headers={},query={}}={}){
  const res={code:200,headers:{},body:null,status(code){this.code=code;return this;},setHeader(key,value){this.headers[key]=value;},json(body){this.body=body;return this;},end(body){this.body=body;return this;}};
  await handler({method,query:{route,...query},body,headers:{host:"portal.test",cookie,...headers}},res);return res;
}
async function login(){
  const result=await request("auth/login",{method:"POST",body:{email:"cliente@example.com",password:"SenhaInicial1234"}});
  expect(result.code).toBe(200);return result.headers["Set-Cookie"].split(";")[0];
}
beforeAll(async()=>{db=await newPortalDatabase();state.db=db;},30000);
afterAll(async()=>{await db.pg.close();});
it('libera administração/equipe somente por permissão e flag, com consulta por mês e revogação imediata',async()=>{
 const source=portalFixture();source.obras[0]={...source.obras[0],contractType:'admin_only',adminPercentage:12};
 source.obras[0].portalCliente.publicarAdministracaoEquipe=true;
 source.employees=[{id:'e',name:'Equipe liberada',role:'Pedreiro',obra:'obra-local',startDate:'2026-11-01',dailyRate:100,cpf:'NAO-EXIBIR-CPF',pixKey:'NAO-EXIBIR-PIX'}];
 source.attendance={e:{'2026-11-12':{status:'P',obraId:'obra-local',note:'NAO-EXIBIR-NOTA'}}};
 await seedPortalSource(db,source);
 for(const operation of ['provision','publish'])await executeClientPortalAdmin({db,companyId:'arcd',data:source,actor,body:{operation,obraId:'obra-local',email:'cliente@example.com',password:'SenhaInicial1234',profile:'owner'}});
 const cookie=await login();
 const response=await request('projects/obra-local/dashboard',{cookie,query:{month:'2026-11'}});expect(response.code).toBe(200);
 expect(response.body.portal.administrationTeam).toHaveLength(1);
 for(const secret of ['NAO-EXIBIR-CPF','NAO-EXIBIR-PIX','NAO-EXIBIR-NOTA'])expect(JSON.stringify(response.body)).not.toContain(secret);
 expect((await request('projects/obra-local/dashboard',{cookie,query:{month:'2099-12'}})).code).toBe(400);
 await db.pg.query("update client_portal_project_memberships set profile='observer' where project_id='obra-local'");
 expect((await request('projects/obra-local/dashboard',{cookie})).body.portal.administrationTeam).toEqual([]);
 await db.pg.query("update client_portal_project_memberships set profile='owner' where project_id='obra-local'");
 source.obras[0].portalCliente.publicarAdministracaoEquipe=false;await seedPortalSource(db,source);
 expect((await request('projects/obra-local/dashboard',{cookie})).body.portal.administrationTeam).toEqual([]);
});
it('aplica a revogação atual por área e não repete resumos antigos na consulta',async()=>{
 const source=portalFixture();await seedPortalSource(db,source);
 for(const operation of ['provision','publish'])await executeClientPortalAdmin({db,companyId:'arcd',data:source,actor,body:{operation,obraId:'obra-local',email:'cliente@example.com',password:'SenhaInicial1234',profile:'owner'}});
 await db.pg.query("insert into client_portal_publications(company_id,project_id,domain,status,payload,created_by) values('arcd','obra-local','cost_summary','published',$1::jsonb,'admin-1')",[JSON.stringify({id:'antigo',available:true,recognized:999999})]);
 const cookie=await login();
 const first=await request('projects/obra-local/dashboard',{cookie});expect(first.code).toBe(200);expect(first.body.portal.costSummaries).toHaveLength(1);expect(first.body.portal.costSummaries[0].id).toBe('custos-obra-local');
 Object.assign(source.obras[0].portalCliente,{publicarFotos:false,publicarCustos:false,publicarCaixaObra:false,publicarNotasFiscais:false,publicarCompras:false,publicarFinanceiro:false,publicarOrcamentoEtapas:false,publicarCronograma:false});await seedPortalSource(db,source);
 const after=await request('projects/obra-local/dashboard',{cookie});expect(after.code).toBe(200);
 for(const key of ['dailyReports','publishedMedia','weeklyUpdates','costSummaries','stageBudgets','projectCashSummary','projectCashMovements','invoices','purchaseOrders','financialSummary','contractPositions','timeline'])expect(after.body.portal[key],key).toEqual([]);
 source.obras[0].portalCliente.ativo=false;await seedPortalSource(db,source);expect((await request('projects/obra-local/dashboard',{cookie})).code).toBe(404);
});
beforeEach(async()=>{await db.pg.exec("truncate client_portal_audit_events,client_portal_sessions,client_portal_project_memberships,client_portal_publications,client_portal_users cascade");await seedPortalSource(db,data);await admin("provision",{email:"cliente@example.com",password:"SenhaInicial1234",profile:"owner"});});
it("percorre provisionamento, publicação, login, sessão, dashboard e logout com SQL real",async()=>{
  expect((await db.pg.query("select * from client_portal_publications")).rows).toHaveLength(0);
  await admin("publish");
  const cookie=await login();
  const session=await request("auth/session",{cookie});expect(session.body.projects[0]).toMatchObject({projectId:"a",name:"Casa A"});
  const dashboard=await request("projects/a/dashboard",{cookie});expect(dashboard.code).toBe(200);expect(dashboard.body.portal.project.name).toBe("Casa A");
  expect((await request("projects/b/dashboard",{cookie})).code).toBe(403);
  expect((await request("auth/logout",{cookie,method:"POST"})).code).toBe(204);
  expect((await request("auth/session",{cookie})).code).toBe(401);
});
it("entrega progresso, fase e término da publicação sem perder o formato",async()=>{
  await admin("publish");await db.pg.query("update client_portal_publications set payload=payload||$1::jsonb where domain='project_summary'",[JSON.stringify({progress:73,currentPhase:"Acabamento",estimatedCompletion:"2026-12-20"})]);
  const response=await request("projects/a/dashboard",{cookie:await login()});
  expect(response.body.portal.project).toMatchObject({progress:73,currentPhase:"Acabamento",estimatedCompletion:"2026-12-20"});
});
it("preserva a publicação anterior quando uma linha inválida aborta a atualização",async()=>{
  await admin("publish");
  const old=(await db.pg.query("select id from client_portal_publications where status='published' order by id")).rows;
  const result=await db.rpc("client_portal_manage",{p_company_id:"arcd",p_project_id:"a",p_actor_id:actor.id,p_operation:"publish",p_values:{rows:[{domain:"project_summary",payload:{name:"Novo"}},{domain:"media",payload:null}]}});
  expect(result.error).toBeTruthy();expect((await db.pg.query("select id from client_portal_publications where status='published' order by id")).rows).toEqual(old);
});
it("revoga sessões ao redefinir a senha e ao revogar o vínculo",async()=>{
  const cookie=await login();await admin("provision",{email:"cliente@example.com",password:"OutraSenha123456",profile:"owner"});
  expect((await request("auth/session",{cookie})).code).toBe(401);
  const membership=(await db.pg.query("select id from client_portal_project_memberships")).rows[0];await admin("revoke",{membershipId:membership.id});
  expect((await db.pg.query("select active from client_portal_project_memberships")).rows[0].active).toBe(false);
});
it("altera a senha e encerra todas as sessões sem expor o hash",async()=>{
  const cookie=await login();
  expect((await request("auth/password",{cookie,method:"POST",body:{currentPassword:"SenhaInicial1234",password:"SenhaNova123456"}})).body).toEqual({ok:true});
  expect((await request("auth/session",{cookie})).code).toBe(401);
  const user=(await db.pg.query("select password_hash from client_portal_users")).rows[0];expect(verifyPortalPassword("SenhaNova123456",user.password_hash)).toBe(true);
});
it("bloqueia origem externa e ignora sessão expirada ou cookie malformado",async()=>{
  expect((await request("auth/login",{method:"POST",headers:{origin:"https://outro.test"}})).code).toBe(403);
  expect((await request("auth/session",{cookie:"arcd_client_session=%E0%A4%A"})).code).toBe(401);
  const token=createPortalSessionToken(),user=(await db.pg.query("select id from client_portal_users")).rows[0];
  await db.pg.query("insert into client_portal_sessions(company_id,portal_user_id,token_hash,expires_at) values ('arcd',$1,$2,now()-interval '1 hour')",[user.id,hashPortalSessionToken(token)]);
  expect((await request("auth/session",{cookie:`arcd_client_session=${token}`})).code).toBe(401);
});
it("suspende a publicação sem conceder dados a outra obra",async()=>{
  await admin("publish");const cookie=await login();await admin("suspend");
  expect((await request("projects/a/dashboard",{cookie})).code).toBe(404);
  expect((await request("projects/b/files/nf/doc",{cookie})).code).toBe(403);
});
it("restringe administração e funções SQL aos papéis esperados",async()=>{
  expect((await executeClientPortalAdmin({db,companyId:"arcd",data,actor:{id:"f",role:"financeiro"},body:{obraId:"a",operation:"provision"}})).status).toBe(403);
  const row=(await db.pg.query("select has_function_privilege('anon','client_portal_manage(text,text,text,text,jsonb)','execute') as anon, has_function_privilege('authenticated','client_portal_manage(text,text,text,text,jsonb)','execute') as authenticated")).rows[0];
  expect(row).toEqual({anon:false,authenticated:false});
});
it("consulta caixa atual e gastos/etapas pela origem, sem duplicar custo por compra ou pagamento",async()=>{
  const source=portalFixture();await seedPortalSource(db,source);
  const setup=operation=>executeClientPortalAdmin({db,companyId:"arcd",data:source,actor,body:{operation,obraId:"obra-local",email:"cliente@example.com",password:"SenhaInicial1234",profile:"owner"}});
  await setup("provision");await setup("publish");const cookie=await login();
  const first=await request("projects/obra-local/dashboard",{cookie});
  expect(first.code).toBe(200);
  expect(first.body.portal.projectCashSummary[0].balance).toBe(9400);
  expect(first.body.portal.costSummaries[0]).toMatchObject({available:true,recognized:1200,paid:600});
  expect(first.body.portal.stageBudgets[0].rows.find(row=>row.id==="fundacao")).toMatchObject({budget:6000,recognized:1000});
  expect(first.body.portal.invoices[0]).toMatchObject({orderId:"pedido-local",documents:[{id:"doc-local",title:"Nota fiscal 1001.pdf",url:"https://files.example.test/nota-1001.pdf"}]});
  source.caixaObra.push({id:"aporte2",obraId:"obra-local",tipo:"aporte",data:"2026-11-07",valor:300});await seedPortalSource(db,source);
  const second=await request("projects/obra-local/dashboard",{cookie});
  expect(second.body.portal.projectCashSummary[0].balance).toBe(9700);
  expect(second.body.portal.costSummaries[0].recognized).toBe(1200);
  const serialized=JSON.stringify(second.body.portal);
  for(const key of ["password_hash","salary","employees","pix","bankAccount","reference","ledger"])expect(serialized).not.toContain(key);
});
it("autoriza originais protegidos por obra, nota e anexo sem entregar referências internas",async()=>{
  const source=portalFixture();source.notasFiscais[0].documentos=[{id:"doc-local",nome:"Nota original.pdf",url:"/api/microsoft/onedrive?action=file&driveId=drive-privado&itemId=item-privado"}];
  source.rdos[0].fotos[0].url="/api/microsoft/onedrive?action=file&driveId=drive-privado&itemId=foto-privada";
  source.obras[0].documentosOneDrive=[{id:"doc-obra",nome:"Documento da obra.pdf",publicarCliente:true,url:"/api/microsoft/onedrive?action=file&driveId=drive-privado&itemId=documento-privado"}];
  await seedPortalSource(db,source);
  for(const operation of ["provision","publish"])await executeClientPortalAdmin({db,companyId:"arcd",data:source,actor,body:{operation,obraId:"obra-local",email:"cliente@example.com",password:"SenhaInicial1234",profile:"owner"}});
  const cookie=await login();
  const dashboard=await request("projects/obra-local/dashboard",{cookie});
  expect(JSON.stringify(dashboard.body.portal)).not.toContain("drive-privado");expect(JSON.stringify(dashboard.body.portal)).not.toContain("item-privado");
  expect(dashboard.body.portal.invoices[0].documents[0].url).toBe("/api/client/projects/obra-local/files/nf-local/doc-local");
  expect(dashboard.body.portal.projectCashMovements.find(item=>item.id==="caixa-local").invoiceDocuments[0].url).toBe("/api/client/projects/obra-local/files/nf-local/doc-local");
  expect((await request("projects/obra-local/files/nf-local/doc-local",{cookie})).code).toBe(302);
  expect((await request("projects/obra-local/media/foto1",{cookie})).code).toBe(302);
  expect((await request("projects/obra-local/documents/doc-obra",{cookie})).code).toBe(302);
  const calls=graph.mock.calls.length;
  expect((await request("projects/obra-local/files/nf-local/outro",{cookie})).code).toBe(404);
  expect((await request("projects/outra-obra/files/nf-local/doc-local",{cookie})).code).toBe(403);
  expect(graph.mock.calls.length).toBe(calls);
  await db.pg.query("update client_portal_project_memberships set revokes=$1::jsonb where project_id='obra-local'",[JSON.stringify(["downloadDocuments"])]);
  const restricted=await request("projects/obra-local/dashboard",{cookie});
  expect(restricted.body.portal.projectCashMovements.find(item=>item.id==="caixa-local").invoiceDocuments).toEqual([]);
  expect((await request("projects/obra-local/files/nf-local/doc-local",{cookie})).code).toBe(403);
  expect(graph.mock.calls.length).toBe(calls);
});
it("reconstrói diários, orçamento e ponto separados e confere toda a simulação sem gravar finanças",async()=>{
  const source=portalSimulationFixture();
  await seedPortalSource(db,{...source,rdos:[],orcamentos:[],attendance:{}});
  for(const [key,value] of [["arced_ponto_v1__rdo",{rdos:source.rdos}],["arced_ponto_v1__orcamentos",{orcamentos:source.orcamentos}],[attendanceObraKey("arced_ponto_v1__ponto","obra-local"),{attendance:source.attendance}]])await db.pg.query("insert into company_app_data(company_id,key,value) values('arcd',$1,$2::jsonb) on conflict(company_id,key) do update set value=excluded.value",[key,JSON.stringify(value)]);
  for(const operation of ["provision","publish"])await executeClientPortalAdmin({db,companyId:"arcd",data:source,actor,body:{operation,obraId:"obra-local",email:"cliente@example.com",password:"SenhaInicial1234",profile:"owner"}});
  const before=(await db.pg.query("select key,value from company_app_data order by key")).rows;
  const cookie=await login();
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-11-14T15:00:00Z"));
  try{
    const response=await request("projects/obra-local/dashboard",{cookie});expect(response.code).toBe(200);
    const portal=response.body.portal;
    expect(portal.project).toMatchObject({progress:78,currentPhase:"Acabamento"});
    expect(portal.dailyReports).toHaveLength(14);expect(portal.publishedMedia).toHaveLength(13);
    expect(portal.dailyReports.filter(report=>report.date==="2026-11-13")).toHaveLength(2);
    expect(portal.dailyReports[0].services[0]).toMatchObject({quantity:22,unit:"m²",progress:30});
    expect(portal.timeline).toHaveLength(2);expect(portal.purchaseOrders).toHaveLength(2);expect(portal.invoices).toHaveLength(2);
    expect(portal.publishedDocuments).toHaveLength(1);expect(portal.approvedChanges).toHaveLength(1);
    expect(portal.projectCashSummary[0]).toMatchObject({totalContributions:12000,totalExpenses:2400,balance:9600});
    expect(portal.projectCashMovements.find(item=>item.id==="caixa-sim-2")).toMatchObject({invoiceNumber:"2002",invoiceDocuments:[{id:"doc-sim-2",title:"Nota fiscal ilustrativa 2002.pdf",url:"https://files.example.test/nota-2002.pdf"}]});
    expect(portal.costSummaries[0]).toMatchObject({available:true,recognized:4960,paid:2400,laborToDate:600,laborBenefitsToDate:60});
    expect(portal.costSummaries[0].categories).toEqual(expect.arrayContaining([{category:"material",recognized:3500,paid:2400},{category:"outros",recognized:800,paid:0}]));
    expect(portal.stageBudgets[0].rows.reduce((sum,row)=>sum+row.recognized,0)).toBe(4960);
    expect(portal.contractPositions[0]).toMatchObject({contractCurrent:110000,accumulatedPercentage:50,accumulatedAmount:55000});
    expect(portal.contractPositions[0].openInstallments[0]).toMatchObject({amount:10000,paid:2500,balance:7500});
    expect(portal.financialSummary[0]).toMatchObject({contractCurrent:110000,measured:55000,paid:47500,openAmount:7500});
    expect(portal.payments.reduce((sum,row)=>sum+row.amount,0)).toBe(47500);
    const payload=JSON.stringify(portal);
    for(const privateValue of ["Pessoa fictícia","Conteúdo privado","Relato reservado","Documento interno","recebimento-futuro","aporte-futuro-sim"])expect(payload).not.toContain(privateValue);
    expect((await db.pg.query("select key,value from company_app_data order by key")).rows).toEqual(before);
    expect((await db.pg.query("select * from financial_titles")).rows).toHaveLength(0);
    // Um título nativo entra; o espelho canônico da nota legada não repete o custo.
    await db.pg.query("insert into financial_titles(id,company_id,origin_type,obra_id,direction,competence,due_date,original_amount,status,metadata) values($1,'arcd','manual','obra-local','payable','2026-11-01','2026-11-20',500,'open',$3::jsonb),($2,'arcd','nota','obra-local','payable','2026-11-01','2026-11-20',1000,'open',$4::jsonb)",["00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002",JSON.stringify({financialKind:"cost",dreCategory:"outros"}),JSON.stringify({legacyId:"nf-local",financialKind:"cost"})]);
    await db.pg.query("insert into settlements(id,company_id,title_id,amount,settlement_date,status) values('00000000-0000-4000-8000-000000000003','arcd','00000000-0000-4000-8000-000000000001',200,'2026-11-13','active')");
    const native=(await request("projects/obra-local/dashboard",{cookie})).body.portal;
    expect(native.costSummaries[0]).toMatchObject({recognized:5460,paid:2600});
    expect(native.stageBudgets[0].rows.reduce((sum,row)=>sum+row.recognized,0)).toBe(5460);
    expect(native.projectCashSummary[0].balance).toBe(9600);
    await db.pg.query("update company_app_data set value=jsonb_set(value,'{quinzenasArquivadas}',$1::jsonb) where key='arced_ponto_v1'",[JSON.stringify({"arquivo-ausente":{}})]);
    const incomplete=(await request("projects/obra-local/dashboard",{cookie})).body.portal;
    expect(incomplete.costSummaries[0]).toMatchObject({available:false,recognized:null,laborToDate:null});
    expect(incomplete.dailyReports).toHaveLength(14);
  }finally{vi.useRealTimers();}
});
