import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,dirname,join} from 'node:path';
import {verifyCutoverBundle,cutoverHash,requireCutover} from '../server/company-cutover.js';
import {CUTOVER_EVIDENCE_CHECKS,assertCompanyCutoverApproval} from '../server/company-cutover-approval.js';
import {prepareCompanyCutoverStages} from './lib/company-cutover-staging.mjs';
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
for(const key of ['--bundle','--approval','--output'])requireCutover(args.includes(key)&&option(key),`Informe ${key}.`);
const bundlePath=await realpath(option('--bundle')),approvalPath=await realpath(option('--approval')),repo=await realpath('.'),output=resolve(option('--output')),parent=await realpath(dirname(output));
const outside=path=>{const part=relative(repo,path);return isAbsolute(part)||part==='..'||part.startsWith('../')||part.startsWith('..\\');};
requireCutover(outside(output)&&outside(parent),'As migrations com dados privados devem ficar fora do repositório.');
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const bundle=verifyCutoverBundle(await read(bundlePath)),approval=await read(approvalPath);assertCompanyCutoverApproval(bundle,approval);
requireCutover(approval.simulated!==true,'Uma aprovação simulada não pode gerar migrations de implantação.');
requireCutover(Array.isArray(bundle.fileBindings)&&bundle.fileBindings.every(binding=>binding.status==='verified-private-destination'),'Os destinos privados dos arquivos ainda não estão certificados no pacote.');
const evidence=[];
for(const key of CUTOVER_EVIDENCE_CHECKS){
 const check=approval.checks[key];requireCutover(check.file,`Arquivo de evidência ausente: ${key}.`);
 const path=await realpath(resolve(dirname(approvalPath),check.file)),bytes=await readFile(path),sha256=createHash('sha256').update(bytes).digest('hex'),report=JSON.parse(bytes);
 requireCutover(sha256===check.evidenceSha256&&report.passed===true&&report.packageId===bundle.id&&report.targetHash===cutoverHash(bundle.after)&&report.simulated!==true,`Evidência inválida, simulada ou de outro corte: ${key}.`);
 if(key==='releaseCode')requireCutover(report.commit===approval.releaseCommit,'Código da publicação diverge da aprovação.');
 evidence.push({key,file:path,sha256});
}
const staged=prepareCompanyCutoverStages(bundle,approval);await mkdir(output);
const files=[['00-infrastructure.up.sql',await readFile(new URL('../migrations/023_company_cutover_private_journal.up.sql',import.meta.url),'utf8')],['01-register.up.sql',staged.registration],...staged.fragments.map((sql,index)=>[`02-part-${String(index).padStart(4,'0')}.up.sql`,sql]),['03-apply-once.up.sql',staged.apply]];
const manifest={version:1,kind:'private-reviewed-company-migration',attemptId:staged.id,packageId:staged.packageId,targetHash:approval.targetHash,releaseCommit:approval.releaseCommit,expiresAt:approval.expiresAt,activationReady:false,remoteWrites:0,evidence,body:{sha256:staged.sha256,bytes:staged.bytes},files:[]};
for(const [file,sql]of files){const bytes=Buffer.from(sql);requireCutover(bytes.length<1000000,'Fragmento excede o limite do conector.');await writeFile(join(output,file),bytes,{flag:'wx',mode:0o600});manifest.files.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({prepared:true,attemptId:staged.id,packageId:staged.packageId,files:files.length,remoteWrites:0,activationReady:false}));
