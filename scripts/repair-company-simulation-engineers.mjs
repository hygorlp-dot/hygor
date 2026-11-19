import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {openCompanySimulation,syncSimulationTables} from './lib/company-local-simulation.mjs';
import {linkCompanyEngineers} from '../server/company-engineer-links.js';
import {decodeAppData,profileIndexOutdated} from '../server/data-codec.js';
import {buildRequestedDreProjectionRows} from '../server/dre-projection.js';
import {canonicalDreEvents} from '../server/financial-dre-integration.js';
import {assertCompanyProjectScope} from '../server/company-project-guard.js';

// Offline maintenance of the private JSON simulator. Never opens a DB or env.
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
for(const key of ['--simulation','--plan','--output'])if(!args.includes(key)||!option(key))throw new Error(`Informe ${key}.`);
const output=resolve(option('--output')),part=relative(resolve('.'),output);
if(!isAbsolute(part)&&part!=='..'&&!part.startsWith('..'+sep))throw new Error('Guarde a prova privada fora do repositório.');
const plan=JSON.parse(await readFile(option('--plan'),'utf8'));
const store=await openCompanySimulation(option('--simulation'),plan.sourceHash);
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const arcdPath=join(store.root,'companies/arcd.json'),mrcPath=join(store.root,'companies/mrc.json');
const arcdBytes=await readFile(arcdPath),before=await store.read('mrc'),beforeHash=hash(before);
const arcd=JSON.parse(arcdBytes),linked=linkCompanyEngineers({data:before.data,sourceUsers:arcd.data.usuarios,projectCompanies:plan.projects,companyId:'mrc'});
const candidate=structuredClone(before);candidate.data=linked.data;
assertCompanyProjectScope(candidate.data,plan.projects,'mrc');
syncSimulationTables(candidate);
const invariant=(ok,message)=>{if(!ok)throw new Error(message);};
const withoutUsers=data=>Object.fromEntries(Object.entries(data).filter(([key])=>key!=='usuarios'));
invariant(hash(withoutUsers(before.data))===hash(withoutUsers(candidate.data)),'Mudança operacional inesperada.');
const independent=tables=>Object.fromEntries(Object.entries(tables).filter(([key])=>key!=='company_app_data'));
invariant(hash(independent(before.tables))===hash(independent(candidate.tables)),'Mudança em tabelas independentes.');
const appIndependent=tables=>tables.company_app_data.filter(row=>!['arced_ponto_v1','arced_auth_profiles_v1'].includes(row.key));
invariant(hash(appIndependent(before.tables))===hash(appIndependent(candidate.tables)),'Mudança em outras linhas do aplicativo.');
const projection=state=>{
  const events=canonicalDreEvents({titles:state.tables.financial_titles||[],settlements:state.tables.settlements||[],banks:state.tables.bank_transactions||[]}).events;
  const requests=['company_dre',...state.data.obras.map(work=>work.id)].flatMap(scope=>Array.from({length:12},(_,month)=>({year:2026,month,period:'mes',scope})));
  return buildRequestedDreProjectionRows(state.data,requests,events).map(row=>Object.fromEntries(Object.entries(row.payload||{}).filter(([,value])=>typeof value==='number')));
};
invariant(hash(projection(before))===hash(projection(candidate)),'O DRE da MRC mudou.');
const main=decodeAppData(candidate.tables.company_app_data.find(row=>row.key==='arced_ponto_v1').value);
invariant(hash(main.usuarios)===hash(candidate.data.usuarios),'Cadastro persistido divergente.');
invariant(!profileIndexOutdated(decodeAppData(candidate.tables.company_app_data.find(row=>row.key==='arced_auth_profiles_v1').value),candidate.data),'Índice de acesso desatualizado.');
await mkdir(dirname(output),{recursive:true});
// Reserve the proof destination before touching the operational copy.
await writeFile(output,JSON.stringify({status:'preflight',localOnly:true,sourceHash:plan.sourceHash,beforeHash,added:linked.added},null,2),{flag:'wx',mode:0o600});
const applied=await store.mutate('mrc',current=>{
  invariant(hash(current)===beforeHash,'A MRC mudou durante a conferência.');
  if(!linked.added.length)return {ok:true,idempotent:true,state:current};
  candidate.revision=current.revision+1;candidate.updatedAt=new Date().toISOString();
  candidate.receipts=[...(current.receipts||[]),{operation:'link-existing-responsible-engineer',localOnly:true,at:candidate.updatedAt,added:linked.added}];
  return {ok:true,state:candidate};
});
const after=await store.read('mrc');
invariant(hash(await readFile(arcdPath))===hash(arcdBytes),'A ARCD mudou durante a manutenção.');
invariant(hash(projection(after))===hash(projection(before)),'DRE divergente após gravar.');
invariant(hash(withoutUsers(after.data))===hash(withoutUsers(before.data)),'Dados operacionais divergentes após gravar.');
if(applied.backup)invariant(hash(await readFile(join(store.root,'backups',applied.backup)))===hash(JSON.stringify(before)),'Backup divergente.');
const proof={status:'verified',localOnly:true,remoteWrites:0,activationReady:false,sourceHash:plan.sourceHash,added:linked.added,idempotent:!!applied.idempotent,backup:applied.backup,beforeHash,afterHash:hash(after),arcdSha256:hash(arcdBytes),revision:after.revision,users:after.data.usuarios.length,checks:{arcdByteIdentical:true,mrcOnlyUsersChanged:true,independentTablesUnchanged:true,compactIndexSynchronized:true,mrcDreUnchanged:true,arcdDreUnchanged:true,backupVerified:!!applied.backup}};
await writeFile(output,JSON.stringify(proof,null,2),{mode:0o600});
console.log(JSON.stringify({status:proof.status,added:linked.added.length,revision:proof.revision,checks:proof.checks}));
