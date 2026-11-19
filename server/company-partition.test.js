import {expect,it} from 'vitest';
import {planCompanyPartition} from './company-partition.js';
import {decodeAppData} from './data-codec.js';
import {buildRequestedDreProjectionRows} from './dre-projection.js';
const fixture=()=>({complete:true,tables:{company_app_data:[{company_id:'arcd',key:'arced_ponto_v1',value:{
  schemaVersion:1,config:{companyName:'Antiga'},usuarios:[{id:'admin',role:'admin',active:true},{id:'eng',role:'engenheiro',obraId:'k'}],
  obras:[{id:'k',name:'K1-10'},{id:'i',name:'I1-08'},{id:'a',name:'A-01'}],
  pedidos:[{id:'p-k',obraId:'k',valor:100},{id:'p-a',obraId:'a',valor:200}],notasFiscais:[{id:'n-k',pedidoId:'p-k',valor:100}],
  unidades:[{id:'un',sigla:'un'}],attendance:{},
}}],financial_titles:[{company_id:'arcd',id:'t-k',obra_id:'k',original_amount:100,status:'paid'},{company_id:'arcd',id:'t-a',obra_id:'a',original_amount:200,status:'open'}],
financial_settlements:[{company_id:'arcd',id:'s-k',title_id:'t-k',amount:100}]}});
const manifest=()=>({filesVerified:true,config:{arcd:{companyName:'ARCD'},mrc:{companyName:'MRC'}}});
const core=(plan,company)=>decodeAppData(plan.companies[company].tables.company_app_data.find(row=>row.key==='arced_ponto_v1').value);
it('inclui na MRC o perfil exato do responsável das obras, preservando a ARCD',()=>{
  const source=fixture(),data=source.tables.company_app_data[0].value;
  delete data.usuarios[1].obraId;data.usuarios.push({id:'unrelated',nome:'Mesmo nome',role:'engenheiro',active:true});
  data.obras.filter(work=>['k','i'].includes(work.id)).forEach(work=>{work.engineerId='eng';});
  const plan=planCompanyPartition(source,{...manifest(),assignments:{'/company_app_data/arced_ponto_v1/usuarios/unrelated':'arcd'}});
  expect(core(plan,'mrc').usuarios.map(user=>user.id)).toEqual(['admin','eng']);
  expect(core(plan,'arcd').usuarios.map(user=>user.id)).toEqual(['admin','eng','unrelated']);
  expect(plan.companies.mrc.tables.company_app_data.find(row=>row.key==='arced_auth_profiles_v1').value.usuarios.map(user=>user.id)).toEqual(['admin','eng']);
});
it('não certifica duas empresas com a mesma pasta mesmo se a conferência for declarada',()=>{
  const source=fixture();for(const work of source.tables.company_app_data[0].value.obras)Object.assign(work,{oneDriveDriveId:'drive',oneDriveFolderId:'shared-root'});
  const plan=planCompanyPartition(source,manifest());expect(plan.ready).toBe(false);expect(plan.issues.some(issue=>issue.path==='/files/workspaces')).toBe(true);
  expect(plan.companies.mrc.tables.company_app_data.some(row=>row.key==='marcell_company_isolation_v1')).toBe(false);
});
it('separa histórico e cadeia financeira por identidade sem gerar ou duplicar fatos',()=>{
  const source=fixture(),original=structuredClone(source),plan=planCompanyPartition(source,manifest());
  expect(plan.issues).toEqual([]);expect(plan.ready).toBe(true);expect(source).toEqual(original);
  expect(core(plan,'mrc').obras.map(row=>row.id)).toEqual(['k','i']);expect(core(plan,'arcd').obras.map(row=>row.id)).toEqual(['a']);
  expect(core(plan,'mrc').notasFiscais.map(row=>row.id)).toEqual(['n-k']);expect(core(plan,'arcd').notasFiscais).toEqual([]);
  expect(core(plan,'mrc').usuarios.map(row=>row.id)).toEqual(['admin','eng']);expect(core(plan,'arcd').usuarios.map(row=>row.id)).toEqual(['admin']);
  expect(plan.companies.mrc.tables.financial_settlements[0]).toMatchObject({id:'s-k',amount:100,company_id:'mrc'});
  const titles=Object.values(plan.companies).flatMap(company=>company.tables.financial_titles||[]);
  expect(titles.map(row=>row.id).sort()).toEqual(['t-a','t-k']);expect(titles.reduce((sum,row)=>sum+row.original_amount,0)).toBe(300);
  expect(plan.dre.createsFinancialEvents).toBe(false);
});
it('não resolve nome parecido e exige ID quando a identificação é ambígua',()=>{
  const source=fixture();source.tables.company_app_data[0].value.obras[0].name='K1-10 antiga';
  expect(()=>planCompanyPartition(source,manifest())).toThrow('ID exato');
  expect(planCompanyPartition(source,{...manifest(),mrcProjectIds:{'K1-10':'k','I1-08':'i'}}).ready).toBe(true);
});
it('bloqueia documento misto e cadastro sem vínculo em vez de copiar para ambas',()=>{
  const source=fixture();source.tables.company_app_data[0].value.despesasEmpresa=[{id:'sem-obra',valor:50}];
  source.tables.company_app_data[0].value.transacoes=[{id:'mista',rateios:[{obraId:'k'},{obraId:'a'}]}];
  const plan=planCompanyPartition(source,manifest());
  expect(plan.ready).toBe(false);expect(plan.issues).toEqual(expect.arrayContaining([expect.objectContaining({path:'/company_app_data/arced_ponto_v1/despesasEmpresa/sem-obra'}),expect.objectContaining({path:'/company_app_data/arced_ponto_v1/transacoes/mista'})]));
  expect(plan.companies.mrc.tables.company_app_data.some(row=>row.key==='marcell_company_isolation_v1')).toBe(false);
});
it('exige inventário e conferência dos arquivos e rejeita destino já preenchido',()=>{
  const source=fixture();delete source.complete;
  expect(planCompanyPartition(source,{...manifest(),filesVerified:false}).issues.map(row=>row.path)).toEqual(['/inventory','/files']);
  source.tables.company_app_data.push({company_id:'mrc',key:'existing',value:{}});
  expect(()=>planCompanyPartition(source,manifest())).toThrow('já contém dados');
});
it('não apresenta um fechamento consolidado antigo como fechamento de uma única empresa',()=>{
  const source=fixture();source.tables.company_app_data[0].value.fechamentosFinanceiros=[{id:'fechado',snapshot:{lucroLiquido:300}}];
  const plan=planCompanyPartition(source,{...manifest(),assignments:{'/company_app_data/arced_ponto_v1/fechamentosFinanceiros/fechado':'arcd'}});
  expect(plan.ready).toBe(false);expect(plan.issues.some(issue=>issue.path.endsWith('/fechamentosFinanceiros'))).toBe(true);
});
it('preserva no motor de DRE a competência, o custo reconhecido e o faturamento de cada obra',()=>{
  const source=fixture(),data=source.tables.company_app_data[0].value;
  data.pedidos=[];
  data.notasFiscais=[{id:'nf-k',obraId:'k',numero:'77',valorBruto:500,competencia:'2026-07',emissao:'2026-08-03'}];
  data.medicoes=[{id:'med-k',obraId:'k',competencia:'2026-07',valorPrevisto:2000,dataEmissao:'2026-08-02'}];
  const plan=planCompanyPartition(source,manifest());expect(plan.ready).toBe(true);
  const requests=[{year:2026,month:6,period:'mes',scope:'k'},{year:2026,month:7,period:'mes',scope:'k'}];
  const before=buildRequestedDreProjectionRows(data,requests),after=buildRequestedDreProjectionRows(core(plan,'mrc'),requests);
  expect(before[0].payload).toMatchObject({totalCustos:500,faturamento:2000});
  expect(after.map(row=>row.payload)).toEqual(before.map(row=>row.payload));
  expect(core(plan,'arcd').notasFiscais).toEqual([]);expect(core(plan,'arcd').medicoes).toEqual([]);
});
it('separa células e dicionários de ponto preservando a estrutura completa do registro',()=>{
  const source=fixture(),coreSource=source.tables.company_app_data[0].value;
  coreSource.attendance={eng:{'2026-11-01':{obraId:'k',s:'P',obs:'Dia completo'},'2026-11-02':{obraId:'a',s:'M',obs:'Meio dia'}}};
  coreSource.attendanceLocks={'2026-11-01__k':{locked:true,lockedBy:'admin'},'2026-11-02__a':{locked:true}};
  source.tables.company_app_data.push({company_id:'arcd',key:'arced_ponto_v1__ponto__obra__i',value:{attendance:{eng:{'2026-11-03':{obraId:'i',s:'P'}}},attendanceSyncedAt:{eng:{'2026-11-03':'revision'}}}});
  const plan=planCompanyPartition(source,manifest());expect(plan.ready).toBe(false);
  expect(plan.issues.some(issue=>issue.reason.includes('Ponto sem cadastro'))).toBe(true);
  expect(core(plan,'mrc').attendance).toEqual({eng:{'2026-11-01':{obraId:'k',s:'P',obs:'Dia completo'}}});
  expect(core(plan,'arcd').attendance).toEqual({eng:{'2026-11-02':{obraId:'a',s:'M',obs:'Meio dia'}}});
  expect(core(plan,'mrc').attendanceLocks).toEqual({'2026-11-01__k':{locked:true,lockedBy:'admin'}});
  expect(plan.companies.mrc.tables.company_app_data.some(row=>row.key.endsWith('__obra__i'))).toBe(true);
  expect(plan.companies.arcd.tables.company_app_data.some(row=>row.key.endsWith('__obra__i'))).toBe(false);
});
it('um snapshot antigo da auditoria não redefine a propriedade de um registro atual',()=>{
  const source=fixture();source.tables.audit_events=[{company_id:'arcd',id:'audit',before_snapshot:{pedidos:[{id:'p-k',obraId:'a'}]}}];
  const plan=planCompanyPartition(source,manifest());
  expect(core(plan,'mrc').notasFiscais.map(row=>row.id)).toEqual(['n-k']);
});
it('aplica a confirmação de I-8 por ID, mantém os sem vínculo na ARCD e leva apenas o condomínio relacionado',()=>{
  const source=fixture(),data=source.tables.company_app_data[0].value;data.obras[1].name='I-8';data.obras[0].condominioId='cond';
  data.condominios=[{id:'cond',nome:'Condomínio da obra'},{id:'other',nome:'Outro'}];data.despesasEmpresa=[{id:'corporativa',valor:800}];
  const plan=planCompanyPartition(source,{...manifest(),mrcProjectIds:{'K1-10':'k','I1-08':'i'},unlinkedCompany:'arcd',masterDependencies:true});
  expect(core(plan,'mrc').obras.map(work=>work.name)).toEqual(['K1-10','I-8']);
  expect(core(plan,'mrc').condominios.map(item=>item.id)).toEqual(['cond']);
  expect(core(plan,'arcd').despesasEmpresa).toEqual([{id:'corporativa',valor:800}]);expect(core(plan,'mrc').despesasEmpresa).toEqual([]);
});
it('preserva auditoria mista no arquivo original em vez de colocá-la no histórico de uma empresa',()=>{
  const source=fixture();source.tables.audit_events=[{id:'old',company_id:'arcd',before_snapshot:{obras:[{id:'k'},{id:'a'}]}}];
  const plan=planCompanyPartition(source,{...manifest(),archiveHistory:true});
  expect(plan.historicalArchive.tables.audit_events).toBe(1);expect(plan.companies.arcd.tables.audit_events).toBeUndefined();expect(plan.companies.mrc.tables.audit_events).toBeUndefined();
  expect(source.tables.audit_events).toHaveLength(1);
});

function payrollPartitionFixture({currentWork=true,nativeDependency=false}={}){
 const data={config:{},usuarios:[{id:'admin',role:'admin',active:true}],obras:[{id:'a',name:'A-01'},{id:'k',name:'K1-10'},{id:'i',name:'I1-08'}],employees:[{id:'synthetic-e',...(currentWork?{obra:'k'}:{}),dailyRate:100,active:true}],attendance:{'synthetic-e':{'2026-11-12':{status:'P',obraId:'a'},'2026-11-13':{status:'P',obraId:'k'}}}};
 const tables={company_app_data:[{company_id:'arcd',key:'arced_ponto_v1',value:data}]};
 if(nativeDependency)tables.core_attendance_records=[{company_id:'arcd',id:'synthetic-native',obra_id:'k',employee_id:'synthetic-e'}];
 return {complete:true,tables};
}
const payrollManifest=()=>({filesVerified:true,unlinkedCompany:'arcd',masterDependencies:true,config:{arcd:{},mrc:{}}});
it('bloqueia ponto cuja chave de funcionário exige ambas as empresas sem zerar custo silenciosamente',()=>{
 const source=payrollPartitionFixture(),before=structuredClone(source),plan=planCompanyPartition(source,payrollManifest());
 expect(plan.ready).toBe(false);expect(plan.issues.some(issue=>issue.reason.includes('Funcionário necessário em ambas'))).toBe(true);expect(source).toEqual(before);
 for(const company of ['arcd','mrc'])expect(plan.companies[company].tables.company_app_data.some(row=>row.key==='marcell_company_isolation_v1')).toBe(false);
});
it('bloqueia duplicação de empregado sem lotação que alteraria a obra pagadora do feriado',()=>{
 const source=payrollPartitionFixture({currentWork:false,nativeDependency:true}),before=structuredClone(source),plan=planCompanyPartition(source,payrollManifest());
 expect(plan.ready).toBe(false);expect(plan.issues.some(issue=>issue.reason.includes('Funcionário necessário em ambas'))).toBe(true);expect(source).toEqual(before);
});
it('não certifica ponto sem cadastro e não atribui à ARCD funcionário comprovadamente necessário só na MRC',()=>{
 const source=payrollPartitionFixture({currentWork:false});delete source.tables.company_app_data[0].value.attendance['synthetic-e']['2026-11-12'];
 const plan=planCompanyPartition(source,payrollManifest());expect(decodeAppData(plan.companies.arcd.tables.company_app_data.find(row=>row.key==='arced_ponto_v1').value).employees).toEqual([]);
 expect(plan.ready).toBe(true);
 source.tables.company_app_data[0].value.employees=[];const orphan=planCompanyPartition(source,payrollManifest());expect(orphan.ready).toBe(false);expect(orphan.issues.some(issue=>issue.reason.includes('Ponto sem cadastro'))).toBe(true);
});
