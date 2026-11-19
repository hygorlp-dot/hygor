import {expect,it} from 'vitest';
import {planCompanyPartition} from './company-partition.js';
import {verifyCompanyPartition} from './company-partition-verification.js';
const scenario=()=>({complete:true,tables:{company_app_data:[{company_id:'arcd',key:'arced_ponto_v1',value:{config:{},obras:[{id:'k',name:'K1-10'},{id:'i',name:'I1-08'},{id:'a',name:'Obra ARCD'}],employees:[],usuarios:[{id:'admin',role:'admin'}],notasFiscais:[{id:'nf',obraId:'k',competencia:'2026-07',valorBruto:500}],medicoes:[{id:'m',obraId:'k',competencia:'2026-07',valorPrevisto:2000}]}}]}});
const manifest={config:{mrc:{},arcd:{}},filesVerified:true};
it('compara fatos, competências e DRE no motor existente sem executar comandos',()=>{
  const source=scenario(),plan=planCompanyPartition(source,manifest),result=verifyCompanyPartition(source,plan);
  expect(result.checks.filter(item=>!item.passed)).toEqual([]);expect(result.dataVerified).toBe(true);expect(result.activationReady).toBe(true);expect(result.createsFinancialEvents).toBe(false);
});
it('detecta custo duplicado e exige inventário, mesmo quando a tela de obras está correta',()=>{
  const source=scenario(),plan=planCompanyPartition(source,manifest);
  plan.companies.mrc.tables.company_app_data[0].value.notasFiscais.push({id:'duplicada',obraId:'k',competencia:'2026-07',valorBruto:500});
  const result=verifyCompanyPartition(source,plan);
  expect(result.dataVerified).toBe(false);expect(result.checks.find(item=>item.name==='facts-notasFiscais').passed).toBe(false);expect(result.differences.length).toBeGreaterThan(0);
  const incomplete=scenario();incomplete.complete=false;
  expect(verifyCompanyPartition(incomplete,planCompanyPartition(incomplete,manifest)).checks.find(item=>item.name==='captured-inventory').passed).toBe(false);
});
it('detecta filho que dependeria de um cadastro pertencente à outra empresa',()=>{
  const source=scenario();source.tables.core_suppliers=[{company_id:'arcd',id:'supplier'}];
  source.tables.purchase_requests=[{company_id:'arcd',id:'request',project_id:'k',supplier_id:'supplier'}];
  source.inventory=Object.keys(source.tables);
  source.foreignKeys=[{name:'request_supplier',table:'purchase_requests',columns:['supplier_id'],references:'core_suppliers',referenceColumns:['id']}];
  const plan=planCompanyPartition(source,{...manifest,unlinkedCompany:'arcd'}),result=verifyCompanyPartition(source,plan);
  expect(result.checks.find(check=>check.name==='relational-company-boundaries')).toMatchObject({passed:false,missingParents:[{company:'mrc',table:'purchase_requests',id:'request',relation:'request_supplier',parentTable:'core_suppliers'}]});
});
