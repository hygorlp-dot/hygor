import {createHash} from 'node:crypto';
import {companySourceView} from './company-source-view.js';
import {buildRequestedDreProjectionRows} from './dre-projection.js';
import {canonicalDreEvents} from './financial-dre-integration.js';
import {assertCompanyProjectScope} from './company-project-guard.js';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fingerprints=rows=>rows.map(digest).sort();
const financialSections=['advances','payments','medicoes','outrasDesp','despesasEmpresa','caixaObra','notasFiscais','pagsTerceiros','rescisoes','movEstoque','locacoesEquip','manutencoesEquip','rentalChargeItems','rentalInvoices','rentalInvoiceReceipts','pedidos','cotacoes','solicitacoesCompra'];
const financialTables=['financial_titles','settlements','bank_transactions','reconciliation_links','financial_dre_allocations','journal_entries','goods_receipts','supplier_invoices'];
const withoutCompany=row=>{const {company_id,...rest}=row;return rest;};
const native=(tables,company)=>canonicalDreEvents({titles:(tables.financial_titles||[]).filter(row=>row.company_id===company),settlements:(tables.settlements||[]).filter(row=>row.company_id===company),banks:(tables.bank_transactions||[]).filter(row=>row.company_id===company)});

export function verifyCompanyPartition(snapshot,plan,{years=[2026],externalVerification=[]}={}){
  const checks=[],differences=[],sourceHash=digest(snapshot);
  const check=(name,passed,details={})=>checks.push({name,passed,...details});
  check('source-fingerprint',sourceHash===plan.sourceHash);
  check('captured-inventory',snapshot.complete===true||Array.isArray(snapshot.inventory)&&snapshot.inventory.length>0&&snapshot.inventory.every(table=>Array.isArray(snapshot.tables[table]))&&financialTables.every(table=>snapshot.inventory.includes(table)));
  check('external-capture-files',Object.entries(snapshot.externalTables||{}).every(([table,metadata])=>externalVerification.some(proof=>proof.table===table&&proof.rowCount===metadata.rowCount&&proof.sha256===metadata.sha256&&proof.fingerprint===metadata.fingerprint)));
  const missingParents=[];
  const globalIdentity=new Set((snapshot.globalIdentityReferences||[]).filter(reference=>reference.targetSchema==='auth').map(reference=>`${reference.table}:${reference.target}`));
  for(const relation of snapshot.foreignKeys||[]){
    if(!snapshot.inventory?.includes(relation.table)||globalIdentity.has(`${relation.table}:${relation.references}`))continue;
    for(const company of ['arcd','mrc']){
      const children=plan.companies[company].tables[relation.table]||[];
      const parents=plan.companies[company].tables[relation.references]||[];
      const parentKeys=new Set(parents.map(row=>JSON.stringify(relation.referenceColumns.map(column=>row[column]))));
      for(const row of children){
        if(relation.columns.some(column=>row[column]===null||row[column]===undefined))continue;
        if(!parentKeys.has(JSON.stringify(relation.columns.map(column=>row[column]))))missingParents.push({company,table:relation.table,id:row.id||null,relation:relation.name,parentTable:relation.references});
      }
    }
  }
  check('relational-company-boundaries',missingParents.length===0,{relations:snapshot.foreignKeys?.length||0,missingParents});
  const original=companySourceView(snapshot.tables),views=Object.fromEntries(['arcd','mrc'].map(company=>[company,companySourceView(plan.companies[company].tables,company)]));
  check('historical-labor-sources',original.missingArchives.length===0&&Object.values(views).every(view=>view.missingArchives.length===0));
  for(const company of ['arcd','mrc']){
    const ids=views[company].data.obras.map(work=>String(work.id));
    check(`projects-${company}`,ids.length===Object.values(plan.projects).filter(owner=>owner===company).length&&ids.every(id=>plan.projects[id]===company));
    try{assertCompanyProjectScope(views[company].data,plan.projects,company);check(`foreign-references-${company}`,true);}
    catch{check(`foreign-references-${company}`,false);}
  }
  for(const section of financialSections){
    const before=fingerprints(original.data[section]||[]),after=fingerprints(Object.values(views).flatMap(view=>view.data[section]||[]));
    check(`facts-${section}`,JSON.stringify(before)===JSON.stringify(after),{before:before.length,after:after.length});
  }
  for(const table of financialTables){
    const before=fingerprints((snapshot.tables[table]||[]).filter(row=>row.company_id==='arcd').map(withoutCompany));
    const after=fingerprints(['arcd','mrc'].flatMap(company=>(plan.companies[company].tables[table]||[]).map(withoutCompany)));
    check(`native-facts-${table}`,JSON.stringify(before)===JSON.stringify(after),{before:before.length,after:after.length});
  }
  const originalNative=native(snapshot.tables,'arcd'),natives=Object.fromEntries(['arcd','mrc'].map(company=>[company,native(plan.companies[company].tables,company)]));
  check('canonical-classification',originalNative.issues.length===0&&Object.values(natives).every(item=>item.issues.length===0));
  const periods=years.flatMap(year=>Array.from({length:12},(_,month)=>({year,month,period:'mes'})));
  const numeric=value=>Object.fromEntries(Object.entries(value||{}).filter(([,item])=>typeof item==='number').map(([key,item])=>[key,Math.round(item*100)]));
  for(const [projectId,company] of Object.entries(plan.projects)){
    const requests=periods.map(period=>({...period,scope:projectId}));
    const before=buildRequestedDreProjectionRows(original.data,requests,originalNative.events);
    const after=buildRequestedDreProjectionRows(views[company].data,requests,natives[company].events);
    for(let index=0;index<before.length;index++){
      const left=numeric(before[index].payload),right=numeric(after[index].payload);
      if(JSON.stringify(left)!==JSON.stringify(right))differences.push({projectId,company,year:requests[index].year,month:requests[index].month+1,fields:[...new Set([...Object.keys(left),...Object.keys(right)])].filter(key=>left[key]!==right[key]).map(key=>({field:key,beforeCents:left[key],afterCents:right[key]}))});
    }
  }
  check('dre-per-project',differences.length===0,{projects:Object.keys(plan.projects).length,periods:periods.length});
  const companyRequests=periods.map(period=>({...period,scope:'company_dre'}));
  const beforeCompany=buildRequestedDreProjectionRows(original.data,companyRequests,originalNative.events);
  const afterCompanies=Object.fromEntries(['arcd','mrc'].map(company=>[company,buildRequestedDreProjectionRows(views[company].data,companyRequests,natives[company].events)]));
  const resultFields=['faturamentoTotal','totalCSP','totalDespOp','lucroLiquido'];
  let companyResultPreserved=true;
  for(let index=0;index<beforeCompany.length;index++)for(const field of resultFields){
    const before=Math.round(Number(beforeCompany[index].payload[field]||0)*100);
    const after=['arcd','mrc'].reduce((sum,company)=>sum+Math.round(Number(afterCompanies[company][index].payload[field]||0)*100),0);
    if(before!==after){companyResultPreserved=false;differences.push({scope:'company_dre',year:companyRequests[index].year,month:companyRequests[index].month+1,field,beforeCents:before,afterCents:after});}
  }
  check('dre-company-result',companyResultPreserved);
  return {version:1,sourceHash,dataVerified:checks.every(item=>item.passed),activationReady:plan.ready&&snapshot.complete===true&&checks.every(item=>item.passed),checks,differences,createsFinancialEvents:false};
}
