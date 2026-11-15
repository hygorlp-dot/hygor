import {createServer} from 'vite';
import {createServer as createHttpServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {newPortalDatabase} from '../server/client-portal.test-helper.js';
import {seedPortalSource} from '../server/client-portal.fixture.js';
import {decodeAppData} from '../server/data-codec.js';
import {readClientPortalSource} from '../server/client-portal-source.js';
import {executeClientPortalAdmin} from '../server/client-portal-admin.js';
import {handleClientPortal} from '../api/client.js';
import {readPortalSession} from '../server/client-portal-runtime.js';
import {protectedDocumentReference} from '../src/domains/financeiro/document-links.js';
import {createLocalOneDriveReview} from './local-onedrive-review.mjs';
import {loadRealPortalSnapshot,createReviewMicrosoftToken,reviewFingerprint,readOnlyOneDriveFetch} from './client-portal-real-source.mjs';
import {buildClientFinancialRows} from '../server/client-portal-financial.js';
import {buildClientContractPosition} from '../server/client-portal-contract.js';
import {active} from '../src/domains/financeiro/facts.js';

const projectId=process.argv.find(arg=>arg.startsWith('--work='))?.slice(7);
if(!projectId)throw new Error('Informe --work com o ID exato da obra a revisar.');
const output='C:/dev/marcell-local-review/portal-real';
await mkdir(output,{recursive:true});
const snapshot=await loadRealPortalSnapshot(),db=await newPortalDatabase();
await seedPortalSource(db,{});
for(const row of snapshot.sourceRows)await db.pg.query('insert into company_app_data(company_id,key,value,updated_at) values($1,$2,$3::jsonb,$4) on conflict(company_id,key) do update set value=excluded.value,updated_at=excluded.updated_at',['arcd',row.key,JSON.stringify(row.value),row.updated_at]);
for(const [table,rows] of Object.entries(snapshot.tables))if(rows.length)await db.pg.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1::jsonb)`,[JSON.stringify(rows)]);
const original=await readClientPortalSource(db,'arcd'),work=original.data.obras?.find(item=>String(item.id)===projectId);
if(!work)throw new Error('Obra não encontrada na captura real.');
const flags=['publicarFotos','publicarCronograma','publicarFinanceiro','publicarDocumentos','publicarCustos','publicarAdministracaoEquipe','publicarOrcamentoEtapas','publicarCaixaObra','publicarCompras','publicarNotasFiscais'];
const coreRow=snapshot.sourceRows.find(row=>row.key==='arced_ponto_v1'),core=structuredClone(decodeAppData(coreRow.value));
if(process.argv.includes('--workforce-model')){
 const config={...original.data.config,workforceReserve:{...original.data.config?.workforceReserve,enabled:true}};
 core.config=config;
 // A configuração separada tem precedência sobre core no leitor real.
 const configRow=snapshot.sourceRows.find(row=>row.key==='arced_ponto_v1__config');
 if(configRow){
  const domain={...decodeAppData(configRow.value),config};
  await db.pg.query("update company_app_data set value=$1::jsonb where company_id='arcd' and key='arced_ponto_v1__config'",[JSON.stringify(domain)]);
 }
}
core.obras=core.obras.map(item=>String(item.id)===projectId?{...item,portalCliente:{...item.portalCliente,ativo:true,...Object.fromEntries(flags.map(flag=>[flag,true]))}}:item);
await db.pg.query("update company_app_data set value=$1::jsonb where company_id='arcd' and key='arced_ponto_v1'",[JSON.stringify(core)]);
const {data}=await readClientPortalSource(db,'arcd');
const email='revisao-real@example.test',password='RevisaoRealLocal2026';
for(const operation of ['provision','publish']){
 const result=await executeClientPortalAdmin({db,companyId:'arcd',data,actor:{id:'revisor-local',role:'admin'},body:{operation,obraId:projectId,email,password,profile:'owner'}});
 if(result.status!==200)throw new Error('Não foi possível preparar o acesso local.');
}
const metadata={capturedAt:snapshot.capturedAt,projectId,projectName:work.name,sourceUpdatedAt:coreRow.updated_at,sourceFingerprint:snapshot.fingerprint,localDataFingerprint:reviewFingerprint(original.data),remoteDatabaseWrites:0,remoteGraphWrites:0,localPublicationOnly:true,originalFlags:Object.fromEntries(['ativo',...flags].map(flag=>[flag,work.portalCliente?.[flag]??null])),sourceCounts:{diaries:(original.data.rdos||[]).filter(item=>item.obraId===projectId).length,completedDiaries:(original.data.rdos||[]).filter(item=>item.obraId===projectId&&['concluido','concluído'].includes(item.status)).length,invoices:(original.data.notasFiscais||[]).filter(item=>item.obraId===projectId).length},canonicalIssues:original.canonical.issues.map(issue=>({code:issue.code,obraId:issue.obraId}))};
await writeFile(`${output}/capture.json`,JSON.stringify(metadata,null,2));
const asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(snapshot.capturedAt));
const cash=(original.data.caixaObra||[]).filter(item=>item.obraId===projectId&&active(item)&&item.data&&item.data<=asOf);
const expectations={asOf,costs:buildClientFinancialRows({data:original.data,projectId,asOf,canonicalEvents:original.canonical.events,issues:original.canonical.issues}),contract:buildClientContractPosition({data:original.data,projectId,asOf}).payload,cash:{count:cash.length,contributions:cash.filter(item=>item.tipo==='aporte').reduce((sum,item)=>sum+Number(item.valor||0),0),expenses:cash.filter(item=>item.tipo!=='aporte').reduce((sum,item)=>sum+Number(item.valor||0),0)},purchases:(original.data.pedidos||[]).filter(item=>item.obraId===projectId&&active(item)).length,diaryStatuses:(original.data.rdos||[]).filter(item=>item.obraId===projectId).map(item=>item.status),photoAuditPaths:(original.data.rdos||[]).filter(item=>item.obraId===projectId).flatMap(report=>(report.fotos||[]).map((photo,index)=>`/api/client/__review/photo/${encodeURIComponent(report.id)}/${index}`))};
await writeFile(`${output}/expected.json`,JSON.stringify(expectations,null,2));
const INTERNAL=Symbol('local-read-context');
const fileReader=createLocalOneDriveReview({clientId:snapshot.env.MICROSOFT_CLIENT_ID,clientSecret:snapshot.env.MICROSOFT_CLIENT_SECRET,resolveAccessToken:createReviewMicrosoftToken(snapshot),fetchImpl:readOnlyOneDriveFetch(),authenticate:async body=>body[INTERNAL]||null,returnUrl:'http://127.0.0.1:4199/cliente',reviewWorkbookPath:process.argv.find(arg=>arg.startsWith('--review-workbook='))?.slice(18)});
let localOAuthServer;
if(process.argv.includes('--onedrive-local-login')){
 localOAuthServer=createHttpServer((req,res)=>{
  const url=new URL(req.url,'http://localhost:4192');
  if(!['localhost:4192','127.0.0.1:4192'].includes(req.headers.host)||!['/api/local-onedrive/connect','/api/local-onedrive/callback'].includes(url.pathname)){res.statusCode=403;return res.end('Somente autenticação local.');}
  return fileReader.handleOAuth(req,res,url);
 });
 await new Promise((resolve,reject)=>{localOAuthServer.once('error',reject);localOAuthServer.listen(4192,'127.0.0.1',resolve);});
}
async function sourceFingerprint(){return reviewFingerprint(await Promise.all(['company_app_data',...Object.keys(snapshot.tables)].map(async table=>(await db.pg.query(`select * from ${table} order by ${table==='company_app_data'?'key':'id'}`)).rows)));}
const baselineFingerprint=await sourceFingerprint();
async function openReference(req,res,reference){
 if(!reference)return res.status(404).json({error:'O cadastro não contém referência protegida para este arquivo.'});
 const active=await readPortalSession(req,db);
 if(!active?.projects.some(item=>item.projectId===projectId))return res.status(401).json({error:'Entre no portal local para conferir este arquivo.'});
 const capture={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 await fileReader.handleApi({method:'POST',body:{action:'file-link',driveId:reference.driveId,itemId:reference.itemId,[INTERNAL]:{user:{obraId:projectId},payload:{obras:[work]}}}},capture);
 if(capture.statusCode!==200)return res.status(capture.statusCode).json(capture.body);
 res.setHeader('Location',capture.body.url);return res.status(302).end();
}
const server=await createServer({server:{host:'127.0.0.1',port:4199,strictPort:true,fs:{strict:true,allow:[process.cwd()]}},plugins:[{name:'portal-real-read-only',transformIndexHtml:html=>html.replace('/src/index.js','/scripts/client-portal-real-review.jsx'),configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
 const url=new URL(req.url,'http://127.0.0.1:4199');
 if(!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/client/__review/'))return next();
 res.status=function(code){this.statusCode=code;return this;};res.json=function(body){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(body));return this;};res.send=function(body){this.end(body);return this;};
 res.setHeader('Cache-Control','private, no-store');
 if(!['127.0.0.1:4199','localhost:4199'].includes(req.headers.host)||req.headers.origin&&!['http://127.0.0.1:4199','http://localhost:4199'].includes(req.headers.origin))return res.status(403).json({error:'Acesso restrito à revisão local.'});
 try{
  if(url.pathname==='/api/client/__review/status'&&req.method==='GET'){
   const active=await readPortalSession(req,db);if(!active?.projects.some(item=>item.projectId===projectId))return res.status(401).json({error:'Entre no portal local.'});
   return res.json({projectId,baselineFingerprint,currentFingerprint:await sourceFingerprint(),capturedAt:snapshot.capturedAt,remoteWritesBlocked:true});
  }
  if(url.pathname==='/api/client/__review/workbook-source'&&req.method==='GET'){
   const active=await readPortalSession(req,db);if(!active?.projects.some(item=>item.projectId===projectId))return res.status(401).json({error:'Entre na revisão local.'});
   const original=await fileReader.readReviewWorkbook();res.setHeader('Content-Type',original.mime);res.setHeader('Content-Disposition','attachment; filename="referencia-custo-equipe.xlsx"');return res.send(original.bytes);
  }
  if(url.pathname==='/api/microsoft/onedrive'&&req.method==='GET'){req.query=Object.fromEntries(url.searchParams);return fileReader.handleApi(req,res);}
  if(url.pathname.startsWith('/api/client/__review/photo/')&&req.method==='GET'){
   const parts=url.pathname.split('/'),report=original.data.rdos.find(item=>item.id===decodeURIComponent(parts[5])&&item.obraId===projectId),photo=report?.fotos?.[Number(parts[6])];
   return openReference(req,res,protectedDocumentReference(photo?.clientUrl||photo?.url));
  }
  if(!url.pathname.startsWith('/api/client/'))return res.status(403).json({error:'Comandos do ERP bloqueados nesta revisão.'});
  req.query={...Object.fromEntries(url.searchParams),route:url.pathname.slice('/api/client/'.length)};
  const parts=req.query.route.split('/');
  if(req.method==='GET'&&parts[0]==='projects'&&['media','files','documents'].includes(parts[2])){
   if(decodeURIComponent(parts[1])!==projectId)return res.status(403).json({error:'Obra fora desta revisão.'});
   const rows=(await db.pg.query("select domain,payload from client_portal_publications where status='published' and project_id=$1",[projectId])).rows;
   const id=decodeURIComponent(parts[3]||'');
   const record=rows.find(row=>row.domain===({media:'media',files:'invoice',documents:'document'}[parts[2]])&&row.payload.id===id)?.payload;
   const reference=parts[2]==='files'?record?.documents?.find(doc=>doc.id===decodeURIComponent(parts[4]||''))?.reference:record?.reference;
   return openReference(req,res,reference);
  }
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384)return res.status(413).json({error:'Pedido muito grande.'});}
  req.body=raw?JSON.parse(raw):{};return handleClientPortal(req,res,db);
 }catch(error){return res.status(error.status||503).json({error:error.status?error.message:'Não foi possível concluir a leitura local.'});}
});}}]});
await server.listen();
console.log(JSON.stringify({url:'http://127.0.0.1:4199/cliente',projectName:work.name,email,password,capturedAt:snapshot.capturedAt,remoteWrites:0,reportDirectory:output}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{localOAuthServer?.close();await server.close();await db.pg.close();process.exit(0);});
