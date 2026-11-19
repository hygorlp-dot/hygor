import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareCompanyFileSeparation} from '../server/company-file-preparation.js';

// Intentionally offline. This command has no cloud client, .env loader,
// authentication flow or apply mode. It only creates a new private directory.
const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
for(const key of ['--plan','--audit','--targets','--output'])if(!args.includes(key)||!get(key))throw new Error(`Informe ${key}.`);
const outside=(base,path)=>{const part=relative(base,path);return isAbsolute(part)||part==='..'||part.startsWith('..'+sep);};
const output=resolve(get('--output')),parent=await realpath(join(output,'..')),repo=await realpath('.');
if(!outside(repo,output)||!outside(repo,parent))throw new Error('Prepare os arquivos privados fora do repositório.');
const plan=JSON.parse(await readFile(get('--plan'),'utf8')),audit=JSON.parse(await readFile(get('--audit'),'utf8')),targets=JSON.parse(await readFile(get('--targets'),'utf8'));
const preparation=prepareCompanyFileSeparation(plan,audit,targets);
const copyRoot=await realpath(join(resolve(get('--audit')),'..','storage-copy'));
const bytesById=new Map();
for(const photo of preparation.photos){
  const source=await realpath(photo.sourceLocalCopy.path);
  if(outside(copyRoot,source)||source===copyRoot)throw new Error('Foto fora da captura privada.');
  const bytes=await readFile(source),sha256=createHash('sha256').update(bytes).digest('hex');
  if(sha256!==photo.sha256||bytes.length!==photo.bytes||photo.mime!=='image/jpeg'||!bytes.subarray(0,3).equals(Buffer.from([255,216,255])))throw new Error('Os bytes da foto não conferem com a captura.');
  bytesById.set(photo.objectId,bytes);
}
// Refuse reuse rather than replacing a previous preparation or source copy.
await mkdir(output);
for(const workspace of preparation.workspaces){
  const folder=join(output,'workspaces',workspace.company,...workspace.destination.segments);
  await mkdir(folder,{recursive:true});
  for(const category of workspace.categories)await mkdir(join(output,'workspaces',workspace.company,...category.destinationSegments),{recursive:true});
  await writeFile(join(folder,'workspace-plan.json'),JSON.stringify(workspace,null,2),{flag:'wx',mode:0o600});
  await writeFile(join(folder,'LEIA-ME.md'),`# ${workspace.projectName} — ${workspace.company.toUpperCase()}\n\nEstrutura local de preparação. Não contém cópias dos documentos OneDrive. As referências comprovadas estão em workspace-plan.json.\n\nA pasta de origem é compartilhada: não mover nem copiar seu conteúdo inteiro. Os destinos na nuvem ainda não existem e seus IDs permanecem vazios até a conferência.\n`,{flag:'wx',mode:0o600});
}
for(const photo of preparation.photos){
  const target=join(output,'storage',photo.destination.bucket,...photo.destination.name.split('/'));
  await mkdir(join(target,'..'),{recursive:true});
  await writeFile(target,bytesById.get(photo.objectId),{flag:'wx',mode:0o600});
  const check=await readFile(target);
  if(createHash('sha256').update(check).digest('hex')!==photo.sha256)throw new Error('Falha ao conferir a foto preparada.');
  photo.preparedLocalCopy={path:target,sha256:photo.sha256,bytes:check.length};
}
const derivedAudit=structuredClone(audit);
for(const object of derivedAudit.objects){
  const photo=preparation.photos.find(photo=>photo.objectId===object.id);
  if(photo)object.localCopy=photo.preparedLocalCopy;
}
const privateWrite=(name,value)=>writeFile(join(output,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
await privateWrite('preparation.json',preparation);
await privateWrite('private-photo-index.json',preparation.photos);
await privateWrite('preview-file-audit.json',derivedAudit);
const unchanged=createHash('sha256').update(JSON.stringify(plan)).digest('hex')===preparation.planHash;
if(!unchanged)throw new Error('O plano de dados foi alterado durante a preparação.');
const proof={version:1,sourceHash:preparation.sourceHash,preparationHash:preparation.preparationHash,manifestSha256:createHash('sha256').update(JSON.stringify(preparation,null,2)).digest('hex'),localPrepared:true,financialPlanUntouched:unchanged,photoBytesVerified:true,remoteWrites:0,cloudVerified:false,activationReady:false,summary:preparation.summary};
await privateWrite('local-proof.json',proof);
await privateWrite('bucket-contract.json',preparation.storageContract);
await writeFile(join(output,'LEIA-ME.md'),'# Separação local de pastas e fotos\n\nOs destinos workspaces/mrc e workspaces/arcd são independentes. As pastas contêm referências por ID, sem documentos fictícios. Os arquivos JPEG reais estão em storage/company-files-private/arcd, com hash conferido. Uma foto possui vínculo ativo e a outra permanece sem novo vínculo.\n\npreparation.json registra as condições para cópia e atualização futura. Não existe comando de aplicação na nuvem nesta preparação. A pasta compartilhada, os links e as duas fotos públicas originais permanecem intactos.\n\npreview-file-audit.json permite usar estas cópias no servidor local protegido, sem nova conexão externa.\n',{flag:'wx',mode:0o600});
if(args.includes('--summary'))await writeFile(get('--summary'),JSON.stringify(proof,null,2),{flag:'wx'});
console.log(JSON.stringify(proof));
