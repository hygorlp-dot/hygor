import {createServer} from 'vite';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {openCompanySimulation} from './lib/company-local-simulation.mjs';
import {previewLocalBankCleanup,applyLocalBankCleanup} from '../server/local-bank-cleanup.js';
import {randomBytes,createHash,createHmac} from 'node:crypto';
import {projectLocalReviewFiles} from './lib/company-review-files.mjs';
import {companySourceView} from '../server/company-source-view.js';
import {projectDataForUser,publicUser} from '../server/data-projection.js';
import {assertCompanyProjectScope} from '../server/company-project-guard.js';
import {buildRequestedDreProjectionRows,buildAccumulatedWorkCosts} from '../server/dre-projection.js';
import {canonicalDreEvents,buildIntegratedDreManagement} from '../server/financial-dre-integration.js';
import {readAnnualLayout} from '../src/domains/dre/annual-statement.js';

// Review only: uses private copied data and pure domain engines. No .env is
// loaded by this server's API, and no upstream API handler is dispatched.
const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
for(const name of ['--plan','--proof'])if(!args.includes(name)||!get(name))throw new Error(`Informe ${name}.`);
const plan=JSON.parse(await readFile(get('--plan'),'utf8')),proof=JSON.parse(await readFile(get('--proof'),'utf8'));
const simulation=args.includes('--simulation')?await openCompanySimulation(get('--simulation'),plan.sourceHash):null;
const fileAudit=args.includes('--file-audit')?JSON.parse(await readFile(get('--file-audit'),'utf8')):null;
if(fileAudit&&fileAudit.sourceHash!==plan.sourceHash)throw new Error('O inventário de arquivos pertence a outra captura.');
if(!proof.dataVerified||proof.sourceHash!==plan.sourceHash)throw new Error('A cópia local precisa passar pela conferência de dados antes da revisão.');
if(plan.issues.some(issue=>!['/inventory','/files'].includes(issue.path)))throw new Error('Há registros sem distribuição concluída nesta cópia.');
const port=args.includes('--port')?Number(get('--port')):4205;
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Porta local inválida.');
const actor={id:'company-local-review',nome:simulation?'Simulação local · cópia privada':'Revisão local · sem gravação',role:'admin',active:true};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${encode({alg:'local-only'})}.${encode({exp:Math.floor(Date.now()/1000)+86400})}.${randomBytes(32).toString('base64url')}`;
const fileSignature=object=>createHmac('sha256',token).update(`${object.company}:${object.id}:${object.localCopy.sha256}`).digest('hex');
const fileUrl=object=>`/api/local-review-file?companyId=${object.company}&id=${encodeURIComponent(object.id)}&sig=${fileSignature(object)}`;
const views=Object.fromEntries(['arcd','mrc'].map(company=>{
  const tables=plan.companies[company].tables;
  const {data,missingArchives}=companySourceView(tables,company);
  if(missingArchives.length)throw new Error('Falta histórico de mão de obra nesta cópia.');
  const canonical=canonicalDreEvents({titles:tables.financial_titles||[],settlements:tables.settlements||[],banks:tables.bank_transactions||[]});
  return [company,{data,canonical:{...canonical,banks:tables.bank_transactions||[],links:tables.reconciliation_links||[]}}];
}));
const reply=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));};
const readonly='Revisão local: gravações e integrações externas estão desativadas. Nenhum dado de produção foi alterado.';
const projectLocalData=(data,company)=>projectLocalReviewFiles(projectDataForUser({...data,usuarios:[...(data.usuarios||[]),actor]},actor),company,fileAudit,fileUrl);
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true},plugins:[{
  name:'company-isolation-private-review',
  transformIndexHtml(html){
    const boot=`try{const current=JSON.parse(sessionStorage.getItem('arcd_auth_session')||'{}');if(current.userId!==${JSON.stringify(actor.id)}||current.accessToken!==${JSON.stringify(token)})sessionStorage.setItem('arcd_auth_session',${JSON.stringify(JSON.stringify({userId:actor.id,accessToken:token,refreshToken:null,sessionId:'company-review-local-session',companyId:'arcd'}))});}catch{}`;
    return html.replace('<head>',`<head><script>${boot}</script>`);
  },
  configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.statusCode=403;return res.end('Acesso local somente.');}
    res.setHeader('X-Frame-Options','DENY');
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if(req.method==='GET'&&url.pathname==='/')res.setHeader('Set-Cookie',`marcell_review=${token}; HttpOnly; SameSite=Strict; Path=/`);
    if(!url.pathname.startsWith('/api/'))return next();
    if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return reply(res,403,{error:'Origem não autorizada.'});
    try{
      if(req.method==='GET'&&url.pathname==='/api/local-review-file'){
        const object=fileAudit?.objects.find(object=>object.id===url.searchParams.get('id')&&object.company===url.searchParams.get('companyId')&&!object.quarantine&&object.localCopy);
        const cookie=String(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('marcell_review='))?.slice('marcell_review='.length);
        if(!object||cookie!==token||url.searchParams.get('sig')!==fileSignature(object))return reply(res,403,{error:'Arquivo indisponível neste contexto local.'});
        const bytes=await readFile(object.localCopy.path);
        if(createHash('sha256').update(bytes).digest('hex')!==object.localCopy.sha256)return reply(res,409,{error:'Cópia local alterada; repita a conferência.'});
        res.setHeader('Content-Type',object.mime||'application/octet-stream');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");return res.end(bytes);
      }
      if(req.method!=='POST')return reply(res,405,{error:readonly});
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12*1024*1024)return reply(res,413,{error:'Requisição local muito grande.'});}
      const body=raw?JSON.parse(raw):{};
      const scopes=[body.companyId,req.headers['x-mrc-company'],...url.searchParams.getAll('companyId')].filter(value=>value!==undefined&&value!==null);
      if(scopes.some(value=>typeof value!=='string'||!['arcd','mrc'].includes(value))||new Set(scopes).size>1)return reply(res,400,{ok:false,error:'Empresa inválida ou divergente na requisição.'});
      const company=scopes[0]||'arcd';
      let view=views[company];
      if(!view)return reply(res,400,{error:'Empresa inválida.'});
      const send=(status,value)=>reply(res,status,{...value,companyId:company,companyIsolationEnabled:true,localReadOnly:!simulation,localSimulation:!!simulation});
      if(body.accessToken!==token||body.userId!==actor.id)return send(401,{error:'Abra novamente o endereço da revisão local.'});
      assertCompanyProjectScope(body,plan.projects,company);
      const localState=simulation?await simulation.read(company):null;
      if(localState){
        const tables=localState.tables,canonical=canonicalDreEvents({titles:tables.financial_titles||[],settlements:tables.settlements||[],banks:tables.bank_transactions||[]});
        view={data:localState.data,canonical:{...canonical,banks:tables.bank_transactions||[],links:tables.reconciliation_links||[]}};
      }
      const {data,canonical}=view;
      if(url.pathname==='/api/presence')return send(200,{ok:true,presencas:[],mensagens:[],ajustes:[]});
      if(url.pathname==='/api/microsoft/onedrive'&&body.action==='status')return send(200,{ok:true,connected:!!simulation,provider:simulation?'local-simulation':null});
      if(simulation&&url.pathname==='/api/microsoft/onedrive'&&body.action==='list-folder'){
        if(body.driveId!==`local-${company}`)return send(403,{error:'Pasta de outra empresa ou fora da simulação.'});
        let selected=null,category='';
        for(const work of data.obras||[]){
          if(work.oneDriveFolderId===body.parentId){selected=work;break;}
          const match=Object.entries(work.oneDriveFolders||{}).find(([,id])=>id===body.parentId);if(match){selected=work;category=match[0];break;}
        }
        if(!selected||!String(selected.oneDriveFolderId).startsWith('local:'))return send(403,{error:'Pasta indisponível nesta empresa.'});
        const files=await readdir(join(simulation.root,'workspaces',company,'obras',String(selected.id),...category.split('/').filter(Boolean)),{withFileTypes:true});
        return send(200,{ok:true,localSimulation:true,items:files.filter(file=>file.isDirectory()).map(file=>{const name=[category,file.name].filter(Boolean).join('/');return {id:selected.oneDriveFolders[name],name:file.name,type:'folder',url:''};}).filter(item=>item.id),cloudDocumentsCopied:false});
      }
      if(url.pathname!=='/api/data')return send(403,{ok:false,error:readonly});
      if(body.action==='load')return send(200,{ok:true,data:projectLocalData(data,company),usuario:publicUser(actor),updatedAt:localState?.updatedAt||plan.sourceHash});
      if(simulation&&body.action==='local-bank-cleanup-preview')return send(200,{ok:true,preview:previewLocalBankCleanup(localState,body.scope)});
      if(simulation&&body.action==='local-bank-cleanup-apply'){
        const command=body.command||{},key=String(command.idempotencyKey||'');
        if(!/^[a-zA-Z0-9_-]{16,200}$/.test(key))return send(400,{ok:false,error:'Chave idempotente inválida.'});
        const signature=createHash('sha256').update(JSON.stringify(command)).digest('hex');
        const result=await simulation.mutate(company,async before=>{
          const existing=(before.receipts||[]).find(receipt=>receipt.key===key);
          if(existing)return existing.signature===signature?{ok:true,idempotent:true,state:before}:{ok:false,error:'A chave já foi usada com outra confirmação.'};
          const cleaned=applyLocalBankCleanup(before,{...command,companyId:company},actor);if(!cleaned.ok)return cleaned;
          cleaned.state.updatedAt=new Date().toISOString();cleaned.state.receipts=[...(cleaned.state.receipts||[]),{key,signature,at:cleaned.state.updatedAt,scope:command.scope,counts:cleaned.preview.counts}];return cleaned;
        });
        if(!result.ok)return send(409,{ok:false,error:result.error});
        return send(200,{ok:true,data:projectLocalData(result.state.data,company),updatedAt:result.state.updatedAt,idempotent:!!result.idempotent,backupCreated:!!result.backup});
      }
      if(body.action==='financial-dre-report'||body.action==='financial-company-dre-report'){
        const year=Number(body.year),month=Number(body.month),period=['mes','q1','q2'].includes(body.period)?body.period:'mes',scope=body.action==='financial-company-dre-report'?'company_dre':body.obraId||'empresa';
        if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<0||month>11)return send(400,{error:'Período inválido.'});
        const history=Array.from({length:6},(_,index)=>{const date=new Date(year,month-5+index,1);return {year:date.getFullYear(),month:date.getMonth(),period:'mes',scope};});
        const rows=buildRequestedDreProjectionRows(data,[{year,month,period,scope,includeMemorial:true},...history],canonical.events);
        return send(200,{ok:true,source:'local_verified_copy',engineEnforced:false,sourceRevision:plan.sourceHash,current:rows[0].payload,history:rows.slice(1).map(row=>row.payload),issues:canonical.issues});
      }
      if(body.action==='financial-annual-dre-report'){
        const year=Number(body.year);if(!Number.isInteger(year)||year<2000||year>2100)return send(400,{error:'Ano inválido.'});
        const rows=buildRequestedDreProjectionRows(data,Array.from({length:12},(_,month)=>({year,month,period:'mes',scope:'company_dre',includeMemorial:true})),canonical.events);
        return send(200,{ok:true,year,months:rows.map(row=>row.payload),layout:readAnnualLayout(data.config),issues:canonical.issues,source:'local_verified_copy'});
      }
      if(body.action==='obras-custo-acumulado')return send(200,{ok:true,custoAte:`${body.year}-${String(Number(body.month)+1).padStart(2,'0')}`,obras:buildAccumulatedWorkCosts(data,{year:Number(body.year),month:Number(body.month),obraIds:data.obras.map(work=>work.id)},canonical.events)});
      if(body.action==='financial-management-report')return send(200,{ok:true,...buildIntegratedDreManagement(data,canonical),updatedAt:plan.sourceHash});
      return send(403,{ok:false,error:readonly});
    }catch(error){reply(res,error.status||500,{ok:false,error:error.status?error.message:'Não foi possível consultar esta cópia local.'});}
  });},
}]});
await server.listen();console.log(`${simulation?'Simulação local, somente limpeza de conciliação':'Revisão local, sem gravação'}: http://127.0.0.1:${port}/`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
