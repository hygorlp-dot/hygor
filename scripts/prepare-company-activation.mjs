import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {companyIsolationActivationSql,companyIsolationHoldSql} from '../server/company-cutover-activation.js';
import {CUTOVER_EVIDENCE_CHECKS} from '../server/company-cutover-approval.js';
import {cutoverHash,verifyCutoverBundle,requireCutover} from '../server/company-cutover.js';
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];for(const k of ['--bundle','--approval','--verification','--output'])requireCutover(args.includes(k)&&get(k),'Informe '+k);
const out=resolve(get('--output')),repo=await realpath('.'),rel=relative(repo,out);requireCutover(isAbsolute(rel)||rel==='..'||rel.startsWith('../')||rel.startsWith('..\\'),'Guarde a migration privada fora do repositório.');
const read=async p=>JSON.parse(await readFile(p,'utf8')),bundle=verifyCutoverBundle(await read(get('--bundle'))),approval=await read(get('--approval')),verification=await read(get('--verification'));
for(const key of CUTOVER_EVIDENCE_CHECKS){const check=approval.checks?.[key];requireCutover(check?.file,'Evidência ausente '+key);const bytes=await readFile(resolve(dirname(get('--approval')),check.file)),r=JSON.parse(bytes);requireCutover(createHash('sha256').update(bytes).digest('hex')===check.evidenceSha256&&r.passed===true&&r.simulated!==true&&r.packageId===bundle.id&&r.targetHash===cutoverHash(bundle.after),'Evidência inválida '+key);}
const files={'activation.up.sql':companyIsolationActivationSql(bundle,approval,verification),'activation.down.sql':companyIsolationHoldSql(bundle)};await mkdir(out);const entries=[];for(const [file,sql]of Object.entries(files)){await writeFile(out+'/'+file,sql,{mode:0o600,flag:'wx'});entries.push({file,sha256:createHash('sha256').update(sql).digest('hex')});}await writeFile(out+'/manifest.json',JSON.stringify({packageId:bundle.id,attemptId:verification.attemptId,files:entries,remoteWrites:0},null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify({prepared:true,remoteWrites:0,activationReady:false}));
