import {mkdir,readFile,writeFile,rename,cp,realpath} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {companySourceView} from '../../server/company-source-view.js';
import {decodeAppData,encodeAppData,compactProfiles,profileIndexOutdated} from '../../server/data-codec.js';
import {assertCompanyProjectScope} from '../../server/company-project-guard.js';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outside=(base,target)=>{const part=relative(base,target);return isAbsolute(part)||part==='..'||part.startsWith('..'+sep);};
export function syncSimulationTables(state){
  const row=state.tables.company_app_data.find(row=>row.key==='arced_ponto_v1');
  const core=decodeAppData(row.value),{localCompanySimulation,...data}=state.data;
  row.value=encodeAppData({...core,...data});
  const profile=state.tables.company_app_data.find(row=>row.key==='arced_auth_profiles_v1');
  if(profile&&profileIndexOutdated(decodeAppData(profile.value),data))profile.value=compactProfiles(data);
  for(const project of state.tables.core_projects||[]){
    const work=data.obras.find(work=>String(work.id)===String(project.id));
    if(work&&project.payload)project.payload={...project.payload,...Object.fromEntries(Object.entries(work).filter(([key])=>key.startsWith('oneDrive')))};
  }
}

export async function createCompanySimulation({plan,proof,preparation,preparedDirectory,output}){
  if(!proof.dataVerified||proof.sourceHash!==plan.sourceHash||preparation.sourceHash!==plan.sourceHash||preparation.planHash!==digest(plan))throw new Error('As provas locais não correspondem ao plano.');
  const target=resolve(output),parent=await realpath(join(target,'..')),repo=await realpath('.');
  if(!outside(repo,target)||!outside(repo,parent))throw new Error('Guarde a simulação privada fora do repositório.');
  const prepared=await realpath(preparedDirectory);
  const preparationBytes=await readFile(join(prepared,'preparation.json')),preparedProof=JSON.parse(await readFile(join(prepared,'local-proof.json'),'utf8'));
  if(createHash('sha256').update(preparationBytes).digest('hex')!==preparedProof.manifestSha256||digest(JSON.parse(preparationBytes))!==digest(preparation))throw new Error('O manifesto de preparação não confere com a prova.');
  for(const photo of preparation.photos){
    const source=await realpath(photo.preparedLocalCopy.path);if(outside(prepared,source))throw new Error('Foto fora da preparação privada.');
    const bytes=await readFile(source);if(createHash('sha256').update(bytes).digest('hex')!==photo.sha256)throw new Error('Foto preparada alterada.');
  }
  await mkdir(target);await mkdir(join(target,'companies'));await mkdir(join(target,'backups'));
  await cp(join(prepared,'workspaces'),join(target,'workspaces'),{recursive:true,force:false,errorOnExist:true});
  await cp(join(prepared,'storage'),join(target,'storage'),{recursive:true,force:false,errorOnExist:true});
  const audit=JSON.parse(await readFile(join(prepared,'preview-file-audit.json'),'utf8'));
  for(const object of audit.objects){
    const photo=preparation.photos.find(photo=>photo.objectId===object.id);
    if(photo){
      object.localCopy={...photo.preparedLocalCopy,path:join(target,relative(prepared,photo.preparedLocalCopy.path))};
      if(createHash('sha256').update(await readFile(object.localCopy.path)).digest('hex')!==photo.sha256)throw new Error('A foto copiada para a simulação não confere.');
    }
  }
  await writeFile(join(target,'file-audit.json'),JSON.stringify(audit,null,2),{flag:'wx',mode:0o600});
  const companies=[];
  for(const companyId of ['arcd','mrc']){
    const tables=structuredClone(plan.companies[companyId].tables),{data,missingArchives}=companySourceView(tables,companyId);
    if(missingArchives.length)throw new Error('Histórico de mão de obra incompleto.');
    assertCompanyProjectScope(data,plan.projects,companyId);
    data.localCompanySimulation={enabled:true,companyId,sourceHash:plan.sourceHash};
    for(const workspace of preparation.workspaces.filter(ws=>ws.company===companyId)){
      const work=data.obras.find(work=>String(work.id)===workspace.projectId);
      work.oneDriveDriveId=`local-${companyId}`;work.oneDriveFolderId=`local:${workspace.projectId}`;work.oneDriveUrl='';
      work.oneDriveFolders=Object.fromEntries(workspace.categories.map(category=>[category.name,`local:${workspace.projectId}:${Buffer.from(category.name).toString('base64url')}`]));
    }
    const state={version:1,companyId,sourceHash:plan.sourceHash,localOnly:true,revision:0,data,tables,receipts:[]};syncSimulationTables(state);
    await writeFile(join(target,'companies',`${companyId}.json`),JSON.stringify(state),{flag:'wx',mode:0o600});
    companies.push({companyId,works:data.obras.length,bankAccounts:(data.contasBancarias||[]).length,nativeBankAccounts:(tables.bank_accounts||[]).length,transactions:(data.transacoes||[]).length,statements:(data.extratos||[]).length});
  }
  const manifest={version:1,sourceHash:plan.sourceHash,localOnly:true,remoteWrites:0,cloudVerified:false,activationReady:false,companies,preparedWorkspaces:preparation.workspaces.map(ws=>({companyId:ws.company,projectId:ws.projectId,categories:ws.categories.length,referenceOnlyDocuments:ws.documents.length})),privatePhotos:preparation.photos.length};
  await writeFile(join(target,'simulation.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});return manifest;
}

export async function openCompanySimulation(directory,sourceHash){
  const root=await realpath(directory),manifest=JSON.parse(await readFile(join(root,'simulation.json'),'utf8'));
  if(!manifest.localOnly||manifest.sourceHash!==sourceHash)throw new Error('Simulação incompatível com esta captura.');
  let pending=Promise.resolve();
  const read=async company=>{
    if(!['arcd','mrc'].includes(company))throw new Error('Empresa inválida.');
    const state=JSON.parse(await readFile(join(root,'companies',`${company}.json`),'utf8'));
    if(state.companyId!==company||state.sourceHash!==sourceHash||!state.localOnly)throw new Error('Estado local de outra empresa.');return state;
  };
  return {manifest,root,read,mutate(company,operation){
    const execute=async()=>{
      const before=await read(company),result=await operation(before);if(!result.ok||result.idempotent)return result;
      if(result.state.companyId!==company)throw new Error('Mudança de empresa recusada.');
      const backup=`${company}-${Date.now()}-${randomUUID()}.json`;
      await writeFile(join(root,'backups',backup),JSON.stringify(before),{flag:'wx',mode:0o600});
      syncSimulationTables(result.state);
      const path=join(root,'companies',`${company}.json`),temporary=path+'.'+randomUUID()+'.tmp';
      await writeFile(temporary,JSON.stringify(result.state),{flag:'wx',mode:0o600});await rename(temporary,path);
      return {...result,backup};
    };
    const job=pending.then(execute);pending=job.catch(()=>{});return job;
  }};
}
