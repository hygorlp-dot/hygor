import {readFile,writeFile,mkdir,realpath,copyFile,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,relative,isAbsolute,sep,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareCompanyCutover,cutoverHash} from '../server/company-cutover.js';
import {companyCutoverSql,cutoverDelta} from '../server/company-cutover-sql.js';
import {verifyExternalCaptures} from './lib/company-capture-files.mjs';
process.on('uncaughtException',error=>{console.error(JSON.stringify({error:error.message,code:error.code||null}));process.exit(1);});

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
for(const key of ['--review','--output'])if(!args.includes(key)||!option(key))throw new Error(`Informe ${key}.`);
const review=await realpath(option('--review')),output=resolve(option('--output')),parent=await realpath(join(output,'..')),repo=await realpath('.');
const outside=path=>{const part=relative(repo,path);return isAbsolute(part)||part==='..'||part.startsWith('..'+sep);};
if(!outside(output)||!outside(parent))throw new Error('Guarde o pacote privado fora do repositório.');
const read=async name=>JSON.parse(await readFile(join(review,name),'utf8'));
const reconciliationPath=args.includes('--reconciliation')?option('--reconciliation'):null;
const snapshotPath=args.includes('--snapshot')?option('--snapshot'):'snapshot-final.json',planPath=args.includes('--plan')?option('--plan'):'plan-engineer-corrected.json';
const snapshot=await read(snapshotPath),plan=await read(planPath);
const states=Object.fromEntries(await Promise.all(['arcd','mrc'].map(async company=>[company,await read(`erp-simulation/companies/${company}.json`)])));
const stateProof=await read('operations/mrc-engineer-correction-20261118/applied.json'),cleanupProof=await read('erp-simulation/operations/arcd-cleanup-authorized-20261118/verification-final.json');
const reconciliation=reconciliationPath?{proof:await read(reconciliationPath+'/verification-final.json'),beforeState:await read(reconciliationPath+'/before-arcd.json')}:undefined;
const bundle=prepareCompanyCutover({snapshot,plan,states,stateProof,cleanupProof,reconciliation});
await verifyExternalCaptures(snapshot);
await mkdir(output);await mkdir(join(output,'immutable'));
const inputFiles=[snapshotPath,planPath,'operations/mrc-engineer-correction-20261118/applied.json','erp-simulation/operations/arcd-cleanup-authorized-20261118/verification-final.json','erp-simulation/companies/arcd.json','erp-simulation/companies/mrc.json','erp-simulation/file-audit.json',...(reconciliationPath?[reconciliationPath+'/verification-final.json',reconciliationPath+'/before-arcd.json']:[])];
if(args.includes('--catalog'))inputFiles.push(option('--catalog'));
const inputs=[];await mkdir(join(output,'evidence'));
for(const [index,name]of inputFiles.entries()){
 const bytes=await readFile(join(review,name)),file=`evidence/${index}-${name.split('/').at(-1)}`;
 if(name==='erp-simulation/companies/arcd.json'&&createHash('sha256').update(bytes).digest('hex')!==(reconciliation?.proof.afterHash||stateProof.arcdSha256))throw new Error('ARCD mudou durante a preparação.');
 if(name==='erp-simulation/companies/mrc.json'&&createHash('sha256').update(bytes).digest('hex')!==stateProof.afterHash)throw new Error('MRC mudou durante a preparação.');
 await writeFile(join(output,file),bytes,{flag:'wx',mode:0o600});inputs.push({source:name,file,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const [table,external]of Object.entries(bundle.external)){
 const destination=join(output,'immutable',table+'.ndjson');
 await copyFile(external.path,destination,constants.COPYFILE_EXCL);external.path=destination;
}
// Preserve reviewed files as independent local copies as well as their hashes.
const audit=await read('erp-simulation/file-audit.json'),copies=[];await mkdir(join(output,'files'));
for(const [index,object]of audit.objects.filter(object=>object.localCopy).entries()){
 const bytes=await readFile(object.localCopy.path),sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==object.localCopy.sha256)throw new Error('Arquivo privado mudou após a revisão.');
 const file=`files/${index}-${sha256}.bin`;await writeFile(join(output,file),bytes,{flag:'wx',mode:0o600});copies.push({objectId:object.id,companyId:object.company,file,sha256,bytes:bytes.length});
}
const {id:_oldId,...content}=bundle;content.evidence={inputs,copies};const result={...content,id:cutoverHash(content)};
const walk=async directory=>{
 const paths=[];for(const item of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,item.name);if(item.isDirectory())paths.push(...await walk(path));else if(item.isFile())paths.push(path);
 }return paths;
};
const sources=[...await walk('server'),...await walk('src'),...await walk('api'),...await walk('public'),...await walk('scripts'),'index.html','vite.config.mjs','postcss.config.js','jsconfig.json','package.json','package-lock.json','components.json','tsconfig.quality.json','.dependency-cruiser.cjs'];
content.evidence.sources=[];
for(const source of sources.sort()){
 const bytes=await readFile(source),file='runtime/'+source.replaceAll('\\','/');
 await mkdir(dirname(join(output,file)),{recursive:true});await writeFile(join(output,file),bytes,{flag:'wx',mode:0o600});
 content.evidence.sources.push({source:source.replaceAll('\\','/'),file,sha256:createHash('sha256').update(bytes).digest('hex')});
}
result.evidence=content.evidence;result.id=cutoverHash(content);
await verifyExternalCaptures({...snapshot,externalTables:result.external});
await writeFile(join(output,'bundle.json'),JSON.stringify(result),{flag:'wx',mode:0o600});
await writeFile(join(output,'apply.blocked.sql'),companyCutoverSql(result),{flag:'wx',mode:0o600});
await writeFile(join(output,'recover-clean.blocked.sql'),companyCutoverSql(result,{recovery:true}),{flag:'wx',mode:0o600});
const delta=cutoverDelta(result),summary={id:result.id,localOnly:true,remoteWrites:0,activationReady:false,changedTables:result.order.length,operations:Object.fromEntries(Object.entries(delta).map(([table,changes])=>[table,Object.fromEntries(Object.entries(changes).map(([kind,rows])=>[kind,rows.length]))])),externalTables:Object.fromEntries(Object.entries(result.external).map(([table,info])=>[table,info.rowCount])),files:copies.length,dre:result.validation,blockers:result.blockers};
await writeFile(join(output,'preparation.json'),JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});
const artifacts=[];
for(const file of ['bundle.json','apply.blocked.sql','recover-clean.blocked.sql','preparation.json'])artifacts.push({file,sha256:createHash('sha256').update(await readFile(join(output,file))).digest('hex')});
await writeFile(join(output,'package-files.json'),JSON.stringify({id:result.id,localOnly:true,artifacts},null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({id:result.id,changedTables:summary.changedTables,localOnly:true,activationReady:false}));
