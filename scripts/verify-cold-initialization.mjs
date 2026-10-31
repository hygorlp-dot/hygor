// Sessão nova por arquivo/tela. Todo tráfego de API é sintético; não utiliza
// o servidor de revisão do usuário e não grava dados externos.
import {createServer,preview} from 'vite';
import {chromium,expect} from '@playwright/test';
import {mkdir,readdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {auditImportGraph} from './lib/import-graph.mjs';
import {ROLE_TABS} from '../src/domains/administracao/abas-acesso.js';
import {data as fixture} from './fixtures/workflow-priorities-data.mjs';

const mode=process.argv.includes('--mode=build')?'build':'dev';
const stage=process.argv.find(arg=>arg.startsWith('--stage='))?.slice(8)||'all';
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
const directory=resolve('artifacts/import-audit');await mkdir(directory,{recursive:true});
const port=mode==='dev'?4272:4273,origin=`http://127.0.0.1:${port}`;
const user={id:'cold-import-admin',nome:'Verificação local',email:'cold@audit.test',role:'admin',active:true};
const data={...structuredClone(fixture),usuarios:[user]};
const report={mode,stage,localOnly:true,startedAt:new Date().toISOString(),results:[]};
const reportName=`cold-${mode}-${stage}${only?'-selected':''}`;
const plugin={name:'cold-module-document',configureServer:install,configurePreviewServer:install};
function install(server){server.middlewares.use('/__cold__',(_request,response)=>{
 response.setHeader('Content-Type','text/html');response.end('<!doctype html><html><head></head><body><div id="root"></div></body></html>');
});}
const server=mode==='dev'?await createServer({cacheDir:'node_modules/.vite-import-audit',plugins:[plugin],server:{host:'127.0.0.1',port,strictPort:true,hmr:false,watch:null}})
 :await preview({plugins:[plugin],build:{outDir:resolve(directory,'build')},preview:{host:'127.0.0.1',port,strictPort:true}});
if(mode==='dev')await server.listen();
const browser=await chromium.launch({headless:true});
async function isolated(width=1440,tab){
 const context=await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768});
 const errors=[],writes=[];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!==origin&&!['data:','blob:'].includes(url.protocol))return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  let body={};try{body=route.request().postDataJSON()||{};}catch{}
  if(['save','save-sections','operational-command','financial-command','reconciliation-command'].includes(body.action)){
   writes.push(body.action);return route.fulfill({status:403,json:{ok:false,error:'Verificação somente leitura.'}});
  }
  if(body.action==='profiles')return route.fulfill({json:{precisaSetup:false}});
  if(body.action==='auth-refresh')return route.fulfill({json:{accessToken:'cold-token',refreshToken:'cold-refresh'}});
  if(body.action==='ponto-equipe-obras')return route.fulfill({json:{ok:true,pessoas:[],obras:data.obras,limitacoes:[],fuso:'America/Bahia',servidorMs:Date.now()}});
  if(body.action?.startsWith('financial-')&&body.action.endsWith('report'))return route.fulfill({json:{ok:true,current:null,history:[],months:[],issues:[]}});
  return route.fulfill({json:{ok:true,connected:false,items:[],bases:[],presencas:[],usuario:user,data,accessToken:'cold-token',refreshToken:'cold-refresh',updatedAt:'2026-10-31T12:00:00Z'}});
 });
 if(tab)await context.addInitScript(({key,tab})=>sessionStorage.setItem(key,tab),{key:`arcd-section:${user.id}`,tab});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',error=>errors.push(error.stack||error.message));
 page.on('console',message=>{if(message.type()==='error'&&/before initialization|ReferenceError|Erro não tratado|error occurred in|Cannot access/i.test(message.text()))errors.push(message.text());});
 return {context,page,errors,writes};
}
async function check(item){
 const started=Date.now(),session=await isolated(item.width||1440,item.tab);
 let result={...item,mode,status:'passed'};
 try{
  if(item.type==='import'){
   await session.page.goto(origin+'/__cold__',{waitUntil:'domcontentloaded'});
   await session.page.evaluate(async url=>{await import(/* @vite-ignore */ url);},origin+item.url);
   await session.page.waitForTimeout(item.bootstrap?500:30);
  }else{
   await session.page.goto(origin+(item.route||'/'),{waitUntil:'domcontentloaded'});
   if(!item.route){
    await session.page.locator('#login-email').fill(user.email);await session.page.locator('#login-senha').fill('isolated-only');
    await session.page.getByRole('button',{name:'Acessar central MARCELL',exact:true}).click();
    await expect(session.page.locator(`.arcd-app-shell[data-tab="${item.tab}"]`)).toBeVisible();
    await expect(session.page.locator('.arcd-page-loading:visible')).toHaveCount(0);
    await expect(session.page.locator('main.arcd-main')).toBeVisible();
   }
   await session.page.waitForTimeout(70);
  }
  await expect(session.page.getByText('Algo quebrou nesta tela',{exact:true})).toHaveCount(0);
  expect(session.errors).toEqual([]);
 }catch(error){
  result={...result,status:'failed',error:error.message,pageErrors:session.errors};
  const name=`${mode}-${item.type}-${item.name.replace(/[^\w-]/g,'-')}-${item.width||1440}`;
  await session.page.screenshot({path:resolve(directory,name+'.png'),fullPage:true}).catch(()=>{});
 }finally{await session.context.close();}
 result.durationMs=Date.now()-started;result.blockedMutations=session.writes;report.results.push(result);
 await appendFile(resolve(directory,reportName+'.jsonl'),JSON.stringify(result)+'\n');
 if(result.status==='failed'||report.results.length%25===0)console.log(`${mode}: ${report.results.length} checked; ${report.results.filter(r=>r.status==='failed').length} failed; ${item.name}`);
}
try{
 // Aquece somente o compilador/otimizador do servidor. O contexto é descartado;
 // cada cenário abaixo continua sem cookies, módulos ou storage anteriores.
 const warm=await isolated();try{await warm.page.goto(origin,{waitUntil:'domcontentloaded'});await expect(warm.page.locator('#login-email')).toBeVisible({timeout:60000});}finally{await warm.context.close();}
 const items=[];
 if(stage!=='screens'){
  if(mode==='dev'){
   const graph=auditImportGraph();
   for(const file of Object.keys(graph.graph).sort())if(file.startsWith('src/')&&!/test-setup|\.cjs$|\.worker\.[jt]s$/.test(file))items.push({type:'import',name:file,url:'/'+file,bootstrap:file==='src/index.js'});
  }else for(const name of (await readdir(resolve(directory,'build/assets'))).sort())if(name.endsWith('.js')&&!/worker/i.test(name))items.push({type:'import',name,url:'/assets/'+name,bootstrap:/^index-/.test(name)});
 }
 if(stage!=='imports'){
  for(const width of [1440,390])for(const tab of [...new Set(ROLE_TABS.admin)])items.push({type:'screen',name:tab,tab,width});
  for(const route of ['/cliente','/aceite-pedido','/responder-cotacao'])items.push({type:'public',name:route,route,width:390});
 }
 const selected=only?items.filter(item=>item.name.includes(only)):items;
 let cursor=0;async function runner(){while(cursor<selected.length)await check(selected[cursor++]);}
 await Promise.all([runner(),runner()]);
 report.summary={total:report.results.length,passed:report.results.filter(r=>r.status==='passed').length,failed:report.results.filter(r=>r.status==='failed').length};
 report.finishedAt=new Date().toISOString();
 await writeFile(resolve(directory,reportName+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
 if(report.summary.failed)process.exitCode=1;
}finally{await browser.close();if(mode==='dev')await server.close();else await new Promise(resolve=>server.httpServer.close(resolve));}
