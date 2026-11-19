import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {companySourceView} from '../server/company-source-view.js';
import {canonicalDreEvents} from '../server/financial-dre-integration.js';
import {buildRequestedDreProjectionRows} from '../server/dre-projection.js';
import {previewLocalBankCleanup,applyLocalBankCleanup} from '../server/local-bank-cleanup.js';
import {assertCompanyProjectScope} from '../server/company-project-guard.js';
const args=process.argv.slice(2),get=name=>args[args.indexOf(name)+1];
for(const key of ['--plan','--simulation','--relations','--output'])if(!args.includes(key)||!get(key))throw new Error(`Informe ${key}.`);
const plan=JSON.parse(await readFile(get('--plan'),'utf8')),relations=JSON.parse(await readFile(get('--relations'),'utf8'));
const states=Object.fromEntries(await Promise.all(['arcd','mrc'].map(async company=>[company,JSON.parse(await readFile(join(get('--simulation'),'companies',`${company}.json`),'utf8'))])));
const events=tables=>canonicalDreEvents({titles:tables.financial_titles||[],settlements:tables.settlements||[],banks:tables.bank_transactions||[]}).events;
const numeric=row=>Object.fromEntries(Object.entries(row||{}).filter(([,value])=>typeof value==='number').map(([key,value])=>[key,Math.round(value*100)]));
const checks=[],check=(name,passed,details)=>checks.push({name,passed,...(details?{details}:{})});
let differences=0;
for(const company of ['arcd','mrc']){
  const state=states[company],original=companySourceView(plan.companies[company].tables,company).data;
  check(`source-${company}`,state.sourceHash===plan.sourceHash&&state.companyId===company&&state.revision===0);
  try{assertCompanyProjectScope(state.data,plan.projects,company);check(`scope-${company}`,true);}catch{check(`scope-${company}`,false);}
  for(const work of original.obras){
    const requests=Array.from({length:12},(_,month)=>({year:2026,month,period:'mes',scope:work.id}));
    const before=buildRequestedDreProjectionRows(original,requests,events(plan.companies[company].tables)),after=buildRequestedDreProjectionRows(state.data,requests,events(state.tables));
    differences+=before.filter((row,index)=>JSON.stringify(numeric(row.payload))!==JSON.stringify(numeric(after[index].payload))).length;
  }
  check(`accounts-${company}`,(original.contasBancarias||[]).length===(state.data.contasBancarias||[]).length,{legacy:(state.data.contasBancarias||[]).length,native:(state.tables.bank_accounts||[]).length,unassignedTransactions:(state.data.transacoes||[]).filter(row=>!row.contaBancariaId).length});
}
check('dre-after-application',differences===0,{projects:18,periods:12,differences});
const preview=previewLocalBankCleanup(states.arcd,'unassigned');
const clean=applyLocalBankCleanup(states.arcd,{scope:'unassigned',reason:'Validação local autorizada da limpeza de conciliação',confirmation:preview.label,expectedRevision:preview.revision,companyId:'arcd'},{role:'admin',id:'local-verification'});
check('cleanup-applies',clean.ok,{counts:preview.counts,values:preview.values,blockers:preview.blockers});
if(clean.ok){
  check('cleanup-zero-active-values',['transacoes','extratos','despesasEmpresa','payments'].every(key=>(clean.state.data[key]||[]).length===0)&&['bank_transactions','financial_titles','settlements','reconciliation_links'].every(key=>(clean.state.tables[key]||[]).length===0));
  const missing=[];
  for(const relation of relations){
    if(!Array.isArray(clean.state.tables[relation.table])||!Array.isArray(clean.state.tables[relation.references]))continue;
    const parents=new Set(clean.state.tables[relation.references].map(row=>JSON.stringify(relation.referenceColumns.map(key=>row[key]))));
    for(const row of clean.state.tables[relation.table])if(relation.columns.every(key=>row[key]!==null&&row[key]!==undefined)&&!parents.has(JSON.stringify(relation.columns.map(key=>row[key]))))missing.push(relation.name);
  }
  check('cleanup-relational-integrity',missing.length===0,{relations:relations.length,missing});
  const request=[{year:2026,month:10,period:'mes',scope:'company_dre'}];
  const before=buildRequestedDreProjectionRows(states.arcd.data,request,events(states.arcd.tables))[0].payload,after=buildRequestedDreProjectionRows(clean.state.data,request,events(clean.state.tables))[0].payload;
  const changes=Object.keys(numeric(before)).filter(key=>numeric(before)[key]!==numeric(after)[key]).map(key=>({key,before:before[key],after:after[key]}));
  check('cleanup-dre-changes-recorded',changes.length>0,{changes});
}
const result={version:1,sourceHash:plan.sourceHash,localOnly:true,remoteWrites:0,activationReady:false,passed:checks.every(row=>row.passed),checks};
await writeFile(get('--output'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify(result));if(!result.passed)process.exitCode=2;
