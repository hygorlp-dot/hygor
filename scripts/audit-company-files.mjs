import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,isAbsolute,relative} from 'node:path';
import {loadEnv} from 'vite';
import {auditCompanyFiles} from '../server/company-file-audit.js';

const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
for(const key of ['--plan','--storage','--output'])if(!args.includes(key)||!get(key))throw new Error(`Informe ${key}.`);
const output=resolve(get('--output')),within=relative(resolve('.'),output);
if(!within.startsWith('..')&&!isAbsolute(within))throw new Error('Guarde o inventário privado fora do repositório.');
const plan=JSON.parse(await readFile(get('--plan'),'utf8')),storage=JSON.parse(await readFile(get('--storage'),'utf8')),environment=loadEnv('development',process.cwd(),'');
const manifest=args.includes('--manifest')?JSON.parse(await readFile(get('--manifest'),'utf8')):{};
const audit=auditCompanyFiles(plan,storage,{environment,unlinkedCompany:manifest.unlinkedCompany});
if(args.includes('--existing-copy')){
  const previous=JSON.parse(await readFile(get('--existing-copy'),'utf8'));
  if(previous.sourceHash!==plan.sourceHash)throw new Error('A cópia anterior pertence a outra origem.');
  const base=resolve(join(output,'..','storage-copy'));
  for(const object of audit.objects){
    const old=previous.objects.find(item=>item.id===object.id&&item.bucket===object.bucket&&item.name===object.name&&item.company===object.company&&item.updatedAt===object.updatedAt);
    if(!old?.localCopy)throw new Error('Objeto não conferido na cópia anterior.');
    const inside=relative(base,resolve(old.localCopy.path));
    if(inside.startsWith('..')||isAbsolute(inside))throw new Error('Cópia fora do diretório privado.');
    const bytes=await readFile(old.localCopy.path),sha256=createHash('sha256').update(bytes).digest('hex');
    if(sha256!==old.localCopy.sha256||bytes.length!==Number(object.size)||(object.expectedSha256&&object.expectedSha256!==sha256))throw new Error('Conteúdo da cópia anterior não confere.');
    object.localCopy={path:old.localCopy.path,sha256,bytes:bytes.length};
  }
}
if(args.includes('--download-storage')){
  if(audit.objects.some(object=>!object.company))throw new Error('Resolva o destino dos objetos antes de copiar bytes.');
  const base=resolve(join(output,'..','storage-copy'));
  await mkdir(base,{recursive:true});
  const origin=new URL(environment.SUPABASE_URL);
  for(const object of audit.objects){
    // Only GET on the configured Storage origin, no refresh, RPC or writes.
    const url=new URL(`/storage/v1/object/authenticated/${encodeURIComponent(object.bucket)}/${object.name.split('/').map(encodeURIComponent).join('/')}`,origin);
    if(url.origin!==origin.origin)throw new Error('Origem Storage divergente.');
    const response=await fetch(url,{method:'GET',headers:{apikey:environment.SUPABASE_SERVICE_ROLE_KEY,authorization:`Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`},redirect:'error',signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw new Error(`Falha ao ler objeto ${object.id}: HTTP ${response.status}.`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length!==Number(object.size))throw new Error(`Tamanho alterado no objeto ${object.id}; recapture o inventário.`);
    const sha256=createHash('sha256').update(bytes).digest('hex'),folder=join(base,object.company,object.quarantine?'archive':'verified'),target=join(folder,sha256);
    if(object.expectedSha256&&object.expectedSha256!==sha256)throw new Error(`Conteúdo diverge do hash registrado no objeto ${object.id}.`);
    await mkdir(folder,{recursive:true});
    try{await writeFile(target,bytes,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;const existing=await readFile(target);if(createHash('sha256').update(existing).digest('hex')!==sha256)throw new Error('Cópia local alterada.');}
    if((await stat(target)).size!==bytes.length)throw new Error('Cópia local incompleta.');
    object.localCopy={path:target,sha256,bytes:bytes.length};
  }
}
audit.summary.downloadedObjects=audit.objects.filter(object=>object.localCopy).length;
audit.summary.downloadedBytes=audit.objects.reduce((n,object)=>n+(object.localCopy?.bytes||0),0);
await writeFile(output,JSON.stringify(audit,null,2),{flag:'wx',mode:0o600});
if(args.includes('--summary'))await writeFile(get('--summary'),JSON.stringify({version:1,sourceHash:audit.sourceHash,localOnly:true,remoteWrites:0,cloudVerified:false,activationReady:false,summary:audit.summary,integrations:audit.integrations,issuesByCode:Object.fromEntries([...new Set(audit.issues.map(issue=>issue.code))].map(code=>[code,audit.issues.filter(issue=>issue.code===code).length])),pending:audit.pending},null,2),{flag:'wx'});
console.log(JSON.stringify({summary:audit.summary,issuesByCode:Object.fromEntries([...new Set(audit.issues.map(issue=>issue.code))].map(code=>[code,audit.issues.filter(issue=>issue.code===code).length])),activationReady:audit.activationReady}));
