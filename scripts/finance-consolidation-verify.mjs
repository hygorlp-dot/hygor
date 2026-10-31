// Regressão local das jornadas do financeiro, com APIs interceptadas pelos
// próprios cenários. Use um build estático para não sofrer recargas de HMR.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const baseURL=process.argv[2]||'http://127.0.0.1:4191';
const url=new URL(baseURL);
if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password)throw new Error('Informe somente a URL de um servidor HTTP local.');
const directory='artifacts/financeiro';await mkdir(directory,{recursive:true});
const result={startedAt:new Date().toISOString(),baseURL,ok:false,checks:[],browserChecks:0,e2e:null};
const save=()=>writeFile(`${directory}/consolidacao-browser.json`,JSON.stringify(result,null,2));
const run=(label,args,env={})=>new Promise((resolve,reject)=>{
 console.log(`Verificando ${label}…`);
 const child=spawn(process.execPath,args,{env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
 child.on('error',reject);
 child.on('close',async code=>{
  try{await writeFile(`${directory}/consolidacao-${label}.log`,output);if(code!==0)throw new Error(`${label}: saída ${code}\n${output.slice(-3500)}`);resolve(output);}catch(error){reject(error);}
 });
});
const suites=[
 ['integracao','scripts/finance-integration-verify.mjs','revisao-browser.json'],
 ['continuidade','scripts/finance-navigation-verify.mjs','continuidade-browser.json'],
 ['originais','scripts/finance-document-conference-verify.mjs','conferencia-original-browser.json'],
 ['previas','scripts/finance-previews-verify.mjs','previas-browser.json'],
 ['relatorios','scripts/finance-reports-verify.mjs','relatorios-browser.json'],
 ['custos','scripts/finance-cost-control-verify.mjs','custos-browser.json'],
];
try{
 for(const [label,script,artifact] of suites){
  await run(label,[script,baseURL]);
  const evidence=JSON.parse(await readFile(`${directory}/${artifact}`,'utf8'));
  if(evidence.errors?.length)throw new Error(`${label}: erros de página encontrados.`);
  result.checks.push({label,count:evidence.passed.length,artifact});result.browserChecks+=evidence.passed.length;await save();
  console.log(`${label}: ${evidence.passed.length} verificações aprovadas.`);
 }
 const output=await run('dre-conciliacao',['node_modules/@playwright/test/cli.js','test','--config=playwright.finance-review.config.js','--reporter=json'],{FINANCE_REVIEW_BASE_URL:baseURL});
 const e2e=JSON.parse(output);result.e2e=e2e.stats;
 if(e2e.stats.unexpected||e2e.stats.flaky||e2e.stats.skipped)throw new Error('DRE/conciliação com falha, instabilidade ou teste não executado.');
 result.ok=true;console.log(`Concluído: ${result.browserChecks} verificações de jornada e ${e2e.stats.expected} testes de DRE/conciliação.`);
}catch(error){result.error=error.message;process.exitCode=1;console.error(error.message);}
finally{result.finishedAt=new Date().toISOString();await save();}
