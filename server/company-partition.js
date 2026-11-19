import {createHash} from 'node:crypto';
import {decodeAppData,encodeAppData,compactProfiles} from './data-codec.js';
import {COMPANY_ISOLATION_KEY} from './company-context.js';
import {companyEngineerDependencies} from './company-engineer-links.js';
import {companySourceView} from './company-source-view.js';

const CORE='arced_ponto_v1',PROFILE='arced_auth_profiles_v1';
const companies=['arcd','mrc'];
const copy=value=>structuredClone(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const present=value=>value!==undefined&&value!==null&&value!=='';
const projectFields=new Set(['obraId','projectId','project_id','obra_id','workId','obraOrigemId','obraDestinoId','origemObraId','destinoObraId','fromWorkId','toWorkId']);
const projectKeyedSections=new Set(['technicalMeasurementProgress']);
const referenceFields=new Set(['pedidoId','orderId','purchase_order_id','solicitacaoId','requestId','cotacaoId','quoteId','notaFiscalId','invoiceId','employeeId','employee_id','funcionarioId','terceiroId','supplierId','fornecedorId','materialId','title_id','financial_title_id','settlement_id','bank_transaction_id','equipment_id','equipmentId','equipamentoId','proprietarioId','condominioId','portal_user_id']);
const weakReferences=new Set(['employeeId','employee_id','funcionarioId','terceiroId','supplierId','fornecedorId','materialId','equipment_id','equipmentId','equipamentoId','proprietarioId','condominioId']);
const dependencyMasterKinds=new Set(['employees','core_employees','terceirizados','core_third_party_profiles','fornecedores','core_suppliers','materiais','equipamentos','core_equipment','proprietariosEquip','condominios']);
const referenceKinds={
 pedidoId:['pedidos','purchase_orders'],orderId:['pedidos','purchase_orders'],purchase_order_id:['pedidos','purchase_orders'],
 solicitacaoId:['solicitacoesCompra','purchase_requests'],requestId:['solicitacoesCompra','purchase_requests'],
 cotacaoId:['cotacoes','purchase_quotations'],quoteId:['cotacoes','purchase_quotations'],
 notaFiscalId:['notasFiscais'],invoiceId:['notasFiscais'],
 employeeId:['employees','core_employees'],employee_id:['employees','core_employees'],funcionarioId:['employees','core_employees'],
 terceiroId:['terceirizados','core_third_party_profiles'],supplierId:['fornecedores','core_suppliers'],fornecedorId:['fornecedores','core_suppliers'],
 materialId:['materiais'],title_id:['financial_titles'],financial_title_id:['financial_titles'],settlement_id:['financial_settlements','settlements'],bank_transaction_id:['bank_transactions'],
 equipment_id:['equipamentos','core_equipment'],equipmentId:['equipamentos','core_equipment'],equipamentoId:['equipamentos','core_equipment'],proprietarioId:['proprietariosEquip'],condominioId:['condominios'],portal_user_id:['client_portal_users'],
};
const catalogSections=new Set(['unidades','fases']);
const sourceDomainKeys=new Set(['__ponto','__lookahead','__config','__equipamentos','__patrimonio','__rdo','__orcamentos'].map(suffix=>CORE+suffix));
const historyTables=new Set(['audit_events','operational_audit_events','client_portal_audit_events','ponto_apropriacoes_auditoria','company_app_data_backup']);

// This planner never connects to a database. Every undecidable record stays
// outside both outputs until an exact path is allocated by the operator.
export function planCompanyPartition(snapshot,manifest={}){
  const tables={...(snapshot.tables||{}),company_app_data:snapshot.tables?.company_app_data||snapshot.sourceRows||[]};
  const rows=tables.company_app_data||[];
  if(Object.values(tables).some(records=>records.some(row=>row.company_id==='mrc'))||Object.values(snapshot.externalTables||{}).some(table=>table.companyCounts?.mrc>0))throw new Error('O destino MRC já contém dados. É necessário reconciliar o destino antes de migrar.');
  const coreRow=rows.find(row=>row.company_id==='arcd'&&row.key===CORE);
  if(!coreRow)throw new Error('Snapshot sem a linha principal da ARCD.');
  const core=decodeAppData(coreRow.value),works=core.obras||[];
  const assignedProjects=new Map(),issues=[],allocations=[],ownership=new Map(),issueGroups=new Map();
  for(const code of ['K1-10','I1-08']){
    const explicit=manifest.mrcProjectIds?.[code];
    const matches=works.filter(work=>explicit?String(work.id)===String(explicit):[work.codigo,work.code,work.name].some(value=>String(value||'').trim().toUpperCase()===code));
    if(matches.length!==1)throw new Error(`Identifique o ID exato da obra ${code} em mrcProjectIds; encontrados ${matches.length} registros.`);
    if(assignedProjects.has(String(matches[0].id)))throw new Error('As duas obras devem possuir identidades distintas.');
    assignedProjects.set(String(matches[0].id),'mrc');
  }
  for(const work of works)if(!assignedProjects.has(String(work.id)))assignedProjects.set(String(work.id),'arcd');
  const mrcEngineers=new Set(companyEngineerDependencies({works,users:core.usuarios||[],projectCompanies:Object.fromEntries(assignedProjects),companyId:'mrc'}).map(dependency=>String(dependency.user.id)));
  const fail=(path,reason)=>{
    const table=path.split('/')[1];
    if(table!=='company_app_data'&&tables[table]?.length>100){
      const key=table+':'+reason;
      if(!issueGroups.has(key)){const group={path:`/${table}`,reason,count:0,examples:[]};issueGroups.set(key,group);issues.push(group);}
      const group=issueGroups.get(key);group.count++;if(group.examples.length<3)group.examples.push(path);
    }else issues.push({path,reason});
    return [];
  };
  const warnings=[],unknownProjects=new Set(),archivedTables={};
  const projectOwners=(value,kind='')=>{
    const owners=new Set();
    function walk(node,nodeKind){
      if(!node||typeof node!=='object')return;
      for(const [key,item] of Object.entries(node)){
        const employeeWork=['employees','core_employees'].includes(nodeKind)&&['obra','lastObra'].includes(key);
        if((projectFields.has(key)||employeeWork)&&present(item)&&typeof item!=='object'){
          const owner=assignedProjects.get(String(item));
          if(!owner&&manifest.unlinkedCompany==='arcd')unknownProjects.add(String(item));
          owners.add(owner||(manifest.unlinkedCompany==='arcd'?'arcd':'unknown'));
        }else if(item&&typeof item==='object')walk(item,Array.isArray(node)?nodeKind:nodeKind==='core_employees'&&key==='payload'?nodeKind:key);
      }
    }
    walk(value,kind);return owners;
  };
  const register=(id,owners,kind)=>{
    if(!present(id)||!owners.size||owners.has('unknown'))return false;
    const key=`${kind}:${id}`,previous=ownership.get(key)||new Set(),next=new Set([...previous,...owners]);
    ownership.set(key,next);return next.size!==previous.size;
  };

  const objects=[];
  function collect(value,kind){
    if(!value||typeof value!=='object')return;
    if(!Array.isArray(value))objects.push({value,kind});
    for(const [key,item] of Object.entries(value))if(item&&typeof item==='object')collect(item,Array.isArray(value)?kind:key);
  }
  for(const [table,records] of Object.entries(tables))for(const row of records){
    if(row.company_id!=='arcd')continue;
    // Old audit snapshots are evidence, never the current ownership registry.
    // Public cost catalog rows also carry no project ownership.
    if(historyTables.has(table)||table.endsWith('_shadow_runs')||table.startsWith('budget_reference_'))continue;
    if(table==='company_app_data'&&row.key!==CORE&&!sourceDomainKeys.has(row.key)&&!row.key.startsWith(CORE+'__ponto__obra__')&&!row.key.startsWith(CORE+'__arq__'))continue;
    collect(table==='company_app_data'?decodeAppData(row.value):row,table);
  }
  for(const {value,kind} of objects)register(value.id||value.event_id,projectOwners(value,kind),kind);
  const ownersFromReferences=(value,kind='')=>{
    const owners=projectOwners(value,kind),hasDirect=owners.size>0;
    function walk(node){
      if(!node||typeof node!=='object')return;
      for(const [key,item] of Object.entries(node)){
        if(referenceFields.has(key)&&present(item)&&!(hasDirect&&weakReferences.has(key)))for(const kind of referenceKinds[key]||[])for(const owner of ownership.get(`${kind}:${item}`)||[])owners.add(owner);
        else if(item&&typeof item==='object')walk(item);
      }
    }
    walk(value);return owners;
  };
  // Fixed point over explicit identifiers only, never description or amount.
  for(let round=0;round<objects.length;round++){
    let changed=false;
    for(const {value,kind} of objects)changed=register(value.id||value.event_id,ownersFromReferences(value,kind),kind)||changed;
    if(!changed)break;
  }
  const dependencies=new Map();
  if(manifest.masterDependencies){
    const note=(kind,id,owners)=>{
      if(!dependencyMasterKinds.has(kind)||!present(id))return;
      const key=`${kind}:${id}`,companies=dependencies.get(key)||new Set();for(const owner of owners)if(owner!=='unknown')companies.add(owner);dependencies.set(key,companies);
    };
    const references=(node,owners)=>{
      if(!node||typeof node!=='object')return;
      for(const [key,value] of Object.entries(node)){
        if(referenceFields.has(key)&&present(value))for(const kind of referenceKinds[key]||[])note(kind,value,owners);
        else if(value&&typeof value==='object')references(value,owners);
      }
    };
    for(const {value,kind} of objects){
      // Attendance carries its employee identity in the dictionary key, not
      // an employeeId field. Preserve that exact dependency when planning.
      if(kind==='attendance')for(const [employeeId,days]of Object.entries(value)){
        if(!days||typeof days!=='object'||Array.isArray(days))continue;
        for(const cell of Object.values(days)){
          const owners=projectOwners(cell);
          if(owners.size===1&&!owners.has('unknown'))note('employees',employeeId,owners);
        }
      }
      const direct=kind==='obras'&&assignedProjects.has(String(value.id))?new Set([assignedProjects.get(String(value.id))]):ownersFromReferences(value,kind);
      if(direct.size===1&&!direct.has('unknown'))references(value,direct);
    }
    // Dependencies of a required master (for example the equipment owner)
    // inherit only the proved companies, with identity and type preserved.
    for(let round=0;round<dependencyMasterKinds.size;round++){
      const before=[...dependencies.values()].reduce((sum,owners)=>sum+owners.size,0);
      for(const {value,kind} of objects){const owners=dependencies.get(`${kind}:${value.id}`);if(owners)references(value,owners);}
      if(before===[...dependencies.values()].reduce((sum,owners)=>sum+owners.size,0))break;
    }
  }
  const choose=(value,path,{catalog=false,user=false}={})=>{
    const table=path.split('/')[1];
    const kind=table==='company_app_data'?path.split('/').at(-2):table;
    const owners=ownersFromReferences(value,kind),explicit=manifest.assignments?.[path]??(table!=='company_app_data'?manifest.tableAssignments?.[table]:undefined);
    if(owners.has('unknown'))return fail(path,'Vínculo com obra ausente do snapshot.');
    if(['employees','core_employees'].includes(kind)&&new Set([...owners,...(dependencies.get(`${kind}:${value?.id}`)||[])]).size>1)return fail(path,'Funcionário necessário em ambas as empresas exige conferência específica da folha, lotação histórica e feriados; não duplicar automaticamente.');
    if(explicit===undefined&&dependencyMasterKinds.has(kind)&&dependencies.has(`${kind}:${value?.id}`)){
      const required=dependencies.get(`${kind}:${value.id}`);
      return [...new Set([...(owners.size?owners:required.size?required:manifest.unlinkedCompany?[manifest.unlinkedCompany]:[]),...required])];
    }
    if(owners.size>1)return fail(path,'O registro contém vínculos das duas empresas; exige tratamento específico sem duplicar o fato.');
    if(explicit!==undefined){
      const selected=Array.isArray(explicit)?explicit:[explicit];
      if(!selected.length||selected.some(company=>!companies.includes(company))||new Set(selected).size!==selected.length)return fail(path,'Distribuição explícita inválida.');
      if(selected.length>1&&!catalog&&!user)return fail(path,'Não é permitido duplicar fatos operacionais ou financeiros.');
      if(owners.size&&selected.some(company=>!owners.has(company)))return fail(path,'Distribuição contraria o vínculo comprovado da obra.');
      return selected;
    }
    if(owners.size===1)return [...owners];
    if(user&&mrcEngineers.has(String(value.id)))return companies;
    if(user&&value.role==='admin'&&value.active!==false&&!value.obraId)return companies;
    if(catalog)return companies;
    if(manifest.unlinkedCompany==='arcd')return ['arcd'];
    return fail(path,'Sem vínculo suficiente: informe a empresa pelo caminho exato.');
  };
  const out=Object.fromEntries(companies.map(company=>[company,{tables:{}}]));
  const add=(company,table,row)=>{(out[company].tables[table]||=[]).push({...copy(row),company_id:company});};
  const splitObject=(value,path)=>{
    const result={arcd:{},mrc:{}};
    for(const [key,item] of Object.entries(value||{})){
      const fieldPath=`${path}/${key}`;
      if(key==='obras'){
        for(const company of companies)result[company][key]=item.filter(work=>assignedProjects.get(String(work.id))===company).map(copy);
      }else if(Array.isArray(item)){
        for(const company of companies)result[company][key]=[];
        if(key==='fechamentosFinanceiros'&&item.length){
          fail(fieldPath,'Fechamento anterior à separação exige conferência própria e preservação da trilha imutável.');
          continue;
        }
        item.forEach((record,index)=>{
          const recordPath=`${fieldPath}/${record?.id||index}`;
          const targets=choose(record,recordPath,{catalog:catalogSections.has(key),user:key==='usuarios'});
          for(const company of targets)result[company][key].push(copy(record));
          if(targets.length)allocations.push({path:recordPath,companies:targets,hash:hash(record)});
        });
      }else if(item&&typeof item==='object'&&Object.keys(item).length){
        // Attendance/locks are dictionaries keyed by composite identities;
        // never infer a project from a partial substring of their keys.
        if(key==='config'){
          for(const company of companies){
            const supplied=manifest.config?.[company];
            if(!supplied){fail(fieldPath+'/'+company,'Configuração da empresa exige conferência explícita (dados fiscais, contas e integrações).');continue;}
            result[company][key]={...copy(supplied),companyId:company};
          }
        }else if(projectKeyedSections.has(path.split('/').at(-1))&&assignedProjects.has(key)){
          result[assignedProjects.get(key)][key]=copy(item);
        }else if(key==='attendanceLocks'){
          for(const [lockId,lock] of Object.entries(item)){
            const match=/^\d{4}-\d{2}-\d{2}__(.+)$/.exec(lockId),owner=match&&assignedProjects.get(match[1]);
            if(!owner){fail(`${fieldPath}/${lockId}`,'Bloqueio de ponto sem obra identificada.');continue;}
            (result[owner][key]||={})[lockId]=copy(lock);
          }
          for(const company of companies)result[company][key]||={};
        }else if(Object.keys(item).some(field=>projectFields.has(field)||referenceFields.has(field))){
          // A dictionary value can be a whole attendance cell or a financial
          // record; split at that boundary, never field by field.
          for(const company of choose(item,fieldPath))result[company][key]=copy(item);
        }else{
          const nested=splitObject(item,fieldPath);
          for(const company of companies)result[company][key]=nested[company];
        }
      }else if(!present(item)||item===false||item===0||key==='schemaVersion'||key==='fasesVersion'||item&&typeof item==='object'&&Object.keys(item).length===0){
        for(const company of companies)result[company][key]=copy(item);
      }else{
        for(const company of choose(item,fieldPath))result[company][key]=copy(item);
      }
    }
    return result;
  };
  for(const [table,records] of Object.entries(tables))for(const row of records){
    if(row.company_id!=='arcd')continue;
    if(manifest.archiveHistory&&(historyTables.has(table)||table.endsWith('_shadow_runs')||table==='financial_events'&&row.event_type==='dre_snapshot')){
      // Preserve the complete originals in the private capture; do not place
      // mixed pre-separation snapshots in either operational company's audit.
      archivedTables[table]=(archivedTables[table]||0)+1;
      continue;
    }
    if(table==='company_app_data'){
      if(row.key===PROFILE||row.key===COMPANY_ISOLATION_KEY)continue;
      const path=`/company_app_data/${row.key}`,value=decodeAppData(row.value);
      // Known domain blobs are partitioned by section; other rows (chat,
      // credentials, archive, receipts) require their own explicit allocation.
      if(row.key.startsWith(CORE+'__ponto__obra__')){
        const projectId=row.key.slice((CORE+'__ponto__obra__').length),owner=assignedProjects.get(projectId)||(projectId==='sem_obra'&&manifest.unlinkedCompany==='arcd'?'arcd':null);
        if(!owner){fail(path,'Linha de ponto sem obra identificada.');continue;}
        if([...projectOwners(value)].some(company=>company!==owner)){fail(path,'A linha de ponto contém registros de outra empresa.');continue;}
        add(owner,table,row);
        allocations.push({path,companies:[owner],hash:hash(row)});
      }else if(row.key===CORE||sourceDomainKeys.has(row.key)||row.key.startsWith(CORE+'__arq__')){
        const parts=splitObject(value,path);
        for(const company of companies)add(company,table,{...row,value:encodeAppData(parts[company])});
      }else{
        const targets=choose(value,path);
        for(const company of targets)add(company,table,row);
        if(targets.length)allocations.push({path,companies:targets,hash:hash(row)});
      }
    }else{
      const identity=row.id||row.event_id||hash(row),path=`/${table}/${identity}`;
      if(table==='core_projects'){
        const owner=assignedProjects.get(String(row.id))||(manifest.unlinkedCompany==='arcd'?'arcd':null);
        if(!owner){fail(path,'Cadastro relacional de obra sem identidade correspondente na origem.');continue;}
        add(owner,table,row);allocations.push({path,companies:[owner],hash:hash(row)});continue;
      }
      if(['accounting_periods','financial_closings','dre_snapshots'].includes(table)||row.event_type==='dre_snapshot'){
        fail(path,'Projeção agregada ou fechamento anterior à separação exige reconciliação específica.');
        continue;
      }
      const targets=choose(row,path);
      for(const company of targets)add(company,table,row);
      if(targets.length)allocations.push({path,companies:targets,hash:hash(row)});
    }
  }
  if(snapshot.complete!==true)fail('/inventory','O snapshot deve conter o inventário completo de tabelas, arquivos e vínculos, conferido antes da ativação.');
  // Copying a private Storage path or an immutable mixed-company closing
  // snapshot does not migrate ownership. Require an explicit reviewed plan.
  if(!manifest.filesVerified)fail('/files','Conferir arquivos privados, pastas, URLs antigas e credenciais de integração antes de ativar.');
  if(manifest.filesVerified){
    const roots=new Map();
    for(const company of companies){
      const companyRows=out[company].tables.company_app_data||[],data=decodeAppData(companyRows.find(row=>row.key===CORE)?.value);
      for(const work of data?.obras||[]){
        if(!work.oneDriveDriveId||!work.oneDriveFolderId)continue;
        const identity=JSON.stringify([work.oneDriveDriveId,work.oneDriveFolderId]),previous=roots.get(identity);
        if(previous&&previous!==company)fail('/files/workspaces','Uma pasta OneDrive está vinculada a obras de empresas diferentes; separar por identidade de documento antes de certificar.');
        roots.set(identity,company);
      }
    }
    if(manifest.config?.arcd?.oneDriveRootUrl&&manifest.config.arcd.oneDriveRootUrl===manifest.config?.mrc?.oneDriveRootUrl)fail('/files/roots','As empresas precisam de raízes OneDrive exclusivas e conferidas.');
  }
  const sourceHash=hash(snapshot);
  for(const [table,metadata] of Object.entries(snapshot.externalTables||{})){
    if(historyTables.has(table)&&manifest.archiveHistory)archivedTables[table]=metadata.rowCount;
    else if(table.startsWith('budget_reference_')&&manifest.unlinkedCompany==='arcd'){
      (out.arcd.externalTables||={})[table]={...metadata,destinationCompany:'arcd'};
    }else fail(`/${table}`,'Tabela externa exige destino ou preservação de histórico explícita.');
  }
  for(const company of companies){
    const companyRows=out[company].tables.company_app_data||[];
    if(!companyRows.some(row=>row.key===CORE))continue;
    const data=companySourceView(out[company].tables,company).data;
    const employeeIds=new Set((data.employees||[]).map(employee=>String(employee.id)));
    for(const [employeeId,days]of Object.entries(data.attendance||{}))if(!employeeIds.has(employeeId)&&Object.values(days||{}).some(cell=>cell&&typeof cell==='object'&&Object.keys(cell).length))fail(`/companies/${company}/attendance/${employeeId}`,'Ponto sem cadastro correspondente de funcionário no destino; não certificar custo incompleto.');
  }
  const ready=issues.length===0;
  if(unknownProjects.size)warnings.push({code:'PREEXISTING_PROJECT_REFERENCE_UNAVAILABLE',companyId:manifest.unlinkedCompany,projectIds:[...unknownProjects].sort(),reason:'Vínculos antigos sem cadastro atual preservados no destino autorizado; nenhum cadastro ou vínculo foi inventado.'});
  for(const company of companies){
    const companyRows=out[company].tables.company_app_data||[];
    const data=decodeAppData(companyRows.find(row=>row.key===CORE)?.value);
    const config=companyRows.find(row=>row.key===CORE+'__config');
    if(config)data.config=decodeAppData(config.value).config;
    add(company,'company_app_data',{key:PROFILE,value:compactProfiles(data)});
    if(ready)add(company,'company_app_data',{key:COMPANY_ISOLATION_KEY,value:{version:1,status:'verified',companyId:company,sourceHash,projectCompanies:Object.fromEntries(assignedProjects)}});
  }
  return {version:1,ready,sourceHash,projects:Object.fromEntries(assignedProjects),issues,warnings,allocations,companies:out,historicalArchive:{sourceHash,tables:archivedTables,originalsPreservedInSource:true},
    dre:{createsFinancialEvents:false,duplicatesFinancialFacts:false,policy:'Preservar competência, valores, reconhecimento, pagamentos e identidades; conciliar totais por origem antes de instalar o certificado.'}};
}
