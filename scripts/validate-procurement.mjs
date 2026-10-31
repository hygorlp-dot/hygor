import {spawn} from "node:child_process";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
process.chdir(fileURLToPath(new URL("../",import.meta.url)));
const npm=process.env.npm_execpath;
if(!npm)throw new Error("Execute com npm run validate:procurement.");
const directory="artifacts/procurement-validation";
await mkdir(directory,{recursive:true});
const steps={lint:[npm,"run","lint"],types:[npm,"run","typecheck"],architecture:[npm,"run","architecture:check"],unit:["node_modules/vitest/vitest.mjs","run","--reporter=dot"],build:["node_modules/vite/bin/vite.js","build","--sourcemap","false","--outDir","build/operational-pilot-check"],bundle:["scripts/bundle-metrics.mjs"],browser:["node_modules/@playwright/test/cli.js","test","--config","playwright.procurement-validation.config.mjs","--reporter=line"]};
const selected=process.argv.find(arg=>arg.startsWith("--only="))?.slice(7).split(",")||Object.keys(steps);
if(!selected.length||selected.some(name=>!steps[name])||new Set(selected).size!==selected.length)throw new Error("Etapa de validação desconhecida ou repetida.");
const report={startedAt:new Date().toISOString(),full:selected.length===Object.keys(steps).length,checks:[],ok:false};
for(const name of selected){
 console.log(`Validando ${name}…`);const started=Date.now();
 const result=await new Promise(resolve=>{
  const child=spawn(process.execPath,steps[name],{windowsHide:true,env:{...process.env,VITEST_MAX_WORKERS:process.env.VITEST_MAX_WORKERS||"4",BUNDLE_DIST_DIR:"build/operational-pilot-check",BUNDLE_REPORT_PATH:`${directory}/bundle.json`},stdio:["ignore","pipe","pipe"]});let output="";
  child.stdout.on("data",chunk=>{output+=chunk;});child.stderr.on("data",chunk=>{output+=chunk;});
  child.on("error",error=>resolve({exitCode:1,output:`${output}\n${error.message}`}));child.on("close",code=>resolve({exitCode:code??1,output}));
 });
 await writeFile(`${directory}/${name}.log`,result.output);report.checks.push({name,exitCode:result.exitCode,durationMs:Date.now()-started,log:`${directory}/${name}.log`});
 console.log(`${name}: ${result.exitCode===0?"aprovado":"reprovado"}`);
}
report.ok=report.checks.every(check=>check.exitCode===0);report.finishedAt=new Date().toISOString();await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
console.log(`Relatório local: ${directory}/report.json`);if(!report.ok)process.exitCode=1;
