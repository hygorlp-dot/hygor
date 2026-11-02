import {createServer,loadEnv} from 'vite';
import {fileURLToPath} from 'node:url';
import {canReviewRequest,canReviewDatabaseRequest} from './local-finance-review-policy.mjs';
import {createLocalOneDriveReview} from './local-onedrive-review.mjs';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
Object.assign(process.env,loadEnv('development',process.cwd(),''));
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Configure as credenciais do servidor em .env.local.');
// Somente este processo: sem conexão SQL direta, migrations ou proxy Vercel.
process.env.POSTGRES_URL_NON_POOLING='';
const databaseOrigin=new URL(process.env.SUPABASE_URL).origin;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 const method=String(options.method||input?.method||'GET').toUpperCase();
 if(url.origin===databaseOrigin&&url.pathname.startsWith('/rest/v1/')&&!canReviewDatabaseRequest(url.pathname,method))return new Response(JSON.stringify({code:'LOCAL_REVIEW_READ_ONLY',message:'Revisão local: alteração dos dados reais bloqueada.'}),{status:403,headers:{'content-type':'application/json'}});
 if(url.hostname==='graph.microsoft.com'&&!['GET','HEAD'].includes(method))return new Response(JSON.stringify({error:'Alterações no OneDrive bloqueadas na revisão local.'}),{status:403,headers:{'content-type':'application/json'}});
 return nativeFetch(input,options);
};
const {authenticateAppContext}=await import('../server/app-auth.js');
const localOneDrive=createLocalOneDriveReview({
 clientId:process.env.MICROSOFT_CLIENT_ID,clientSecret:process.env.MICROSOFT_CLIENT_SECRET,
 authenticate:body=>authenticateAppContext(body,{scope:'onedrive'}),
});
const modules={
 '/api/data':'../api/data.js','/api/presence':'../api/presence.js',
 '/api/ai-agent':'../api/ai-agent.js','/api/upload':'../api/upload.js',
};
const handlers=new Map();
const server=await createServer({server:{host:'127.0.0.1',port:4192,strictPort:true},plugins:[{
 name:'local-real-finance-review',
 configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,'http://127.0.0.1:4192');
  if(!url.pathname.startsWith('/api/'))return next();
  if(!['127.0.0.1:4192','localhost:4192'].includes(req.headers.host)){res.statusCode=403;return res.end('Host não permitido.');}
  if(['/api/local-onedrive/connect','/api/local-onedrive/callback'].includes(url.pathname))return localOneDrive.handleOAuth(req,res,url);
  const origin=req.headers.origin;
  if(origin&&origin!=='http://127.0.0.1:4192') {res.statusCode=403;return res.end('Origem não permitida.');}
  res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');res.setHeader('X-MARCELL-Review-Mode','real-data-read-only');
  const json=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  if(url.pathname==='/api/local-review-status'&&req.method==='GET')return json(200,{ok:true,mode:'real-data-read-only',authentication:'existing-company-login',financialWritesAllowed:false});
  try{
   let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>1024*1024)return json(413,{error:'Requisição de revisão muito grande.'});raw+=chunk;}
   try{req.body=raw?JSON.parse(raw):{};}catch{return json(400,{error:'Requisição inválida.'});}
   req.query=Object.fromEntries(url.searchParams);req.cookies=Object.fromEntries(String(req.headers.cookie||'').split(';').map(s=>s.trim().split(/=(.*)/s)).filter(([key])=>key));
   const action=req.body.action||req.query.action;
   // Presença da revisão permanece local; não anuncia atividade em produção.
   if(url.pathname==='/api/presence'&&req.method==='POST'&&['heartbeat','offline'].includes(action))return json(200,{ok:true,localReview:true});
   if(!canReviewRequest(url.pathname,req.method,action))return json(403,{error:'Ambiente local de revisão: gravações nos dados reais estão bloqueadas.',code:'LOCAL_REVIEW_READ_ONLY'});
   res.status=code=>{res.statusCode=code;return res;};res.json=body=>{res.end(JSON.stringify(body));return res;};res.send=body=>{res.end(body);return res;};
   req.headers['x-forwarded-for']='127.0.0.1';
   if(url.pathname==='/api/microsoft/onedrive')return await localOneDrive.handleApi(req,res);
   if(!handlers.has(url.pathname))handlers.set(url.pathname,(await import(modules[url.pathname])).default);
   await handlers.get(url.pathname)(req,res);
  }catch(error){console.error(`Revisão local: ${error?.name||'erro'} na consulta.`);if(!res.headersSent)json(500,{error:'Não foi possível concluir a consulta local. Consulte o terminal do servidor.'});else if(!res.writableEnded)res.end();}
 });},
}]});
await server.listen();
console.log('MARCELL local com dados reais: http://127.0.0.1:4192');
console.log('Login habitual da empresa. Consultas habilitadas; gravações financeiras bloqueadas. Nenhum deployment.');
