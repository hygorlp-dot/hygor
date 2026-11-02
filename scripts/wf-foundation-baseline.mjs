import {spawn} from 'node:child_process';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
const phase=process.env.WF_PHASE||'before',base=process.env.WF_BASE_URL||'http://127.0.0.1:4213';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Somente prévia local.');
const root=`artifacts/wf-foundation/${phase}`;await mkdir(root,{recursive:true});
const pw=(grep,desktop=false)=>['node_modules/@playwright/test/cli.js','test','--config','playwright.workflow-foundation.config.mjs','--grep',grep,...(desktop?['--project','desktop']:[])];
const tasks=[['J01',['scripts/workflow-priorities-verify.mjs']],['J02',pw('solicitação vira cotação e pedido')],['J03',pw('receber parcialmente a prazo')],['J04',['scripts/finance-document-conference-verify.mjs',base]],['J05',pw('WF J05')],['J06',pw('filtros preservam seleção e a revisão só avança',true)],['J07',['scripts/finance-operational-layout-verify.mjs',base]],['J08',pw('solicitação mantém preenchimento após falha')]];
const results=[];
// Two independent scenarios at a time; each owns a fresh intercepted browser context.
for(let index=0;index<tasks.length;index+=2)await Promise.all(tasks.slice(index,index+2).map(async([id,args])=>{
 const directory=`${root}/${id}`;await mkdir(directory,{recursive:true});const started=performance.now();let output='';
 const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,args,{windowsHide:true,env:{...process.env,WF_BASE_URL:base,WORKFLOW_BASE_URL:base,WF_EVIDENCE_DIR:directory,WF_JOURNEY:id},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',e=>{output+=e.message;resolve(1);});child.on('close',code=>resolve(code??1));});
 await writeFile(`${directory}/run.log`,output);const sessions=[];for(const name of await readdir(directory))if(/^session-.*\.json$/.test(name))sessions.push(JSON.parse(await readFile(`${directory}/${name}`,'utf8')));
 results.push({id,exitCode,runnerDurationMs:Math.round(performance.now()-started),sessions:sessions.map(({events,requests,...summary})=>({...summary,apiCalls:requests.length,apiWaitTotalMs:requests.reduce((n,r)=>n+r.durationMs,0)}))});console.log(id,exitCode===0?'PASS':'FAIL');
}));
results.sort((a,b)=>a.id.localeCompare(b.id));await writeFile(`${root}/baseline.json`,JSON.stringify({phase,base,measurement:'automated-run-not-human-task-time',results},null,2));if(results.some(r=>r.exitCode||!r.sessions.length))process.exitCode=1;
