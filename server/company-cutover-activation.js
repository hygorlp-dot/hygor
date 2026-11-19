import {cutoverHash,verifyCutoverBundle,requireCutover} from './company-cutover.js';
import {assertCompanyCutoverApproval} from './company-cutover-approval.js';
import {COMPANY_ISOLATION_KEY} from './company-context.js';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export function companyIsolationActivationSql(bundle,approval,verification,{now=Date.now()}={}){
 verifyCutoverBundle(bundle);assertCompanyCutoverApproval(bundle,approval,{now});
 const attemptId=cutoverHash({packageId:bundle.id,approval});
 requireCutover(approval.simulated!==true&&verification?.simulated!==true&&verification?.rehearsalOnly!==true&&verification?.passed===true&&verification?.productionEvidenceCertified===true&&verification?.packageId===bundle.id&&verification?.targetHash===cutoverHash(bundle.after)&&verification?.attemptId===attemptId&&verification?.remoteWrites===0,'A ativação exige conferência real posterior à aplicação exata.');
 for(const key of ['companyData','identities','privateFiles','privatePhotos','privateHistoryArchive','dre','cleanup','controls'])requireCutover(verification.checks?.[key]===true,'Conferência posterior ausente: '+key);
 const projects={...bundle.projects};
 for(const row of bundle.after.core_projects||[]){requireCutover(['arcd','mrc'].includes(row.company_id)&&(!projects[row.id]||projects[row.id]===row.company_id),'Empresa divergente na identidade do projeto.');projects[row.id]=row.company_id;}
 const rows=['arcd','mrc'].map(companyId=>({companyId,value:{version:1,status:'verified',companyId,packageId:bundle.id,targetHash:approval.targetHash,releaseCommit:approval.releaseCommit,verifiedAt:verification.at,attemptId,projectCompanies:projects,evidence:approval.checks}}));
 const deadline=literal(approval.expiresAt)+'::timestamptz';
 return ['begin;',"set local lock_timeout='5s';","set local statement_timeout='60s';",'lock table public.company_app_data in share row exclusive mode;',
  'do $activate$ begin',`if clock_timestamp()>=${deadline} then raise exception 'Corte expirado; revalidar antes de ativar'; end if;`,
  `if not exists(select 1 from company_cutover_private.runs where id=${literal(bundle.id)} and mode='cutover') or not exists(select 1 from company_cutover_private.staged_runs where id=${literal(attemptId)} and package_id=${literal(bundle.id)} and applied_at is not null and approval=${literal(JSON.stringify(approval))}::jsonb) then raise exception 'Migração aplicada não confirmada'; end if;`,
  `if exists(select 1 from public.company_app_data where company_id in ('arcd','mrc') and key=${literal(COMPANY_ISOLATION_KEY)} and value->>'packageId' is distinct from ${literal(bundle.id)}) then raise exception 'Certificado anterior divergente'; end if;`,
  'end $activate$;',...rows.map(row=>`insert into public.company_app_data(company_id,key,value,updated_at,updated_by) values (${literal(row.companyId)},${literal(COMPANY_ISOLATION_KEY)},${literal(JSON.stringify(row.value))}::jsonb,${literal(verification.at)}::timestamptz,null) on conflict(company_id,key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;`),'commit;'].join('\n');
}
export function companyIsolationHoldSql(bundle){
 verifyCutoverBundle(bundle);
 return `begin; update public.company_app_data set value=jsonb_set(value,'{status}','"blocked"'::jsonb),updated_at=clock_timestamp() where company_id in ('arcd','mrc') and key=${literal(COMPANY_ISOLATION_KEY)} and value->>'packageId'=${literal(bundle.id)}; commit;`;
}
