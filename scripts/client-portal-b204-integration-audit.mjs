// Auditoria local da origem real. Transporte remoto somente GET/HEAD; todas
// as sessões, publicações e sentinelas de segurança ficam no PGlite em memória.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadRealPortalSnapshot,reviewFingerprint} from './client-portal-real-source.mjs';
import {newPortalDatabase} from '../server/client-portal.test-helper.js';
import {seedPortalSource} from '../server/client-portal.fixture.js';
import {readClientPortalSource} from '../server/client-portal-source.js';
import {executeClientPortalAdmin} from '../server/client-portal-admin.js';
import {handleClientPortal} from '../api/client.js';
import {buildClientFinancialRows} from '../server/client-portal-financial.js';
import {buildClientAdministrationTeam} from '../server/client-portal-team.js';
import {buildClientContractPosition} from '../server/client-portal-contract.js';
import {buildClientPortalPublicationRows} from '../server/client-portal-publication.js';
import {active,toCents} from '../src/domains/financeiro/facts.js';
import {decodeAppData} from '../server/data-codec.js';

const projectId='kep278px87cr',nativeFetch=globalThis.fetch,remoteRequests=[],blockedWrites=[];
globalThis.fetch=async(input,options={})=>{
 const method=String(options.method||input?.method||'GET').toUpperCase(),url=new URL(String(input?.url||input));
 if(!['GET','HEAD'].includes(method)){blockedWrites.push({method,host:url.hostname});throw new Error('Auditoria: gravação remota bloqueada.');}
 remoteRequests.push({method,host:url.hostname});return nativeFetch(input,options);
};
const snapshot=await loadRealPortalSnapshot(),db=await newPortalDatabase(),company=snapshot.env.COMPANY_ID||'arcd';
assert.equal(company,'arcd');
const asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(snapshot.capturedAt));
const directory=`C:/dev/marcell-local-review/b204-integration-${asOf}`;await mkdir(directory,{recursive:true});
await writeFile(`${directory}/snapshot-private.json`,JSON.stringify({sourceRows:snapshot.sourceRows,tables:snapshot.tables,capturedAt:snapshot.capturedAt,fingerprint:snapshot.fingerprint}),{mode:0o600});
await seedPortalSource(db,{});
for(const row of snapshot.sourceRows)await db.pg.query('insert into company_app_data(company_id,key,value,updated_at) values($1,$2,$3::jsonb,$4) on conflict(company_id,key) do update set value=excluded.value,updated_at=excluded.updated_at',[company,row.key,JSON.stringify(row.value),row.updated_at]);
for(const [table,rows]of Object.entries(snapshot.tables))if(rows.length)await db.pg.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1::jsonb)`,[JSON.stringify(rows)]);
const original=await readClientPortalSource(db,company),data=original.data,work=data.obras.find(row=>row.id===projectId);assert(work);
const before=reviewFingerprint(data),scoped=(key)=>(data[key]||[]).filter(row=>String(row.obraId||row.obra_id||'')===projectId);
const flags=['publicarFotos','publicarCronograma','publicarFinanceiro','publicarDocumentos','publicarCustos','publicarOrcamentoEtapas','publicarCaixaObra','publicarCompras','publicarNotasFiscais','publicarAdministracaoEquipe','publicarCotacoes'];
const local={date:asOf,capturedAt:snapshot.capturedAt,project:{id:work.id,name:work.name},sourceFingerprint:snapshot.fingerprint,
 originalFlags:Object.fromEntries(['ativo',...flags].map(key=>[key,work.portalCliente?.[key]??null])),sourceCounts:{},links:[],unbound:{},duplicates:[],crossWorkLinks:[],checks:[],issues:[]};
const check=(name,condition,details)=>{assert(condition,name);local.checks.push({name,passed:true,...(details?{details}:{})});};
const issue=(severity,area,detail,records=[])=>local.issues.push({severity,area,detail,records});
const cash=scoped('caixaObra').filter(active),orders=scoped('pedidos'),notes=scoped('notasFiscais'),diaries=scoped('rdos');
for(const key of ['pedidos','notasFiscais','caixaObra','rdos','medicoes','medicoesObra','medicoesTerc','pagsTerceiros','outrasDesp','rescisoes','locacoesEquip','orcamentos','planos'])local.sourceCounts[key]=scoped(key).length;
const customers=data.comercial?.clientes||data.clientes||[],engineers=data.usuarios||[];
local.links.push({relation:'clienteId',linked:customers.some(row=>String(row.id)===String(work.clienteId)),value:work.clienteId||null},{relation:'engineerId',linked:engineers.some(row=>String(row.id)===String(work.engineerId)),value:work.engineerId||null},{relation:'faseId',linked:(data.fases||[]).some(row=>String(row.id)===String(work.faseId)),value:work.faseId||null});
for(const link of local.links)if(!link.linked)issue('atenção','cadastro',`Vínculo ${link.relation} ausente ou não encontrado no conjunto de origem.`,[link.value].filter(Boolean));
for(const key of ['pedidos','notasFiscais','caixaObra','medicoes','medicoesObra','medicoesTerc','pagsTerceiros','outrasDesp','rdos']){
 const rows=data[key]||[],seen=new Set(),duplicate=[];
 for(const row of rows){if(seen.has(String(row.id)))duplicate.push(row.id);seen.add(String(row.id));}
 if(duplicate.length)local.duplicates.push({collection:key,ids:duplicate});
 const missing=rows.filter(row=>active(row)&&!row.obraId&&!row.obra_id&&!row.rateios?.some(r=>r.obraId));
 if(missing.length)local.unbound[key]={count:missing.length,ids:missing.map(row=>row.id)};
 for(const row of scoped(key))for(const [field,target]of [['pedidoId','pedidos'],['notaFiscalId','notasFiscais'],['medicaoTercId','medicoesTerc']])if(row[field]){
  const linked=(data[target]||[]).find(item=>String(item.id)===String(row[field]));
  if(!linked)issue('atenção',key,`${field} aponta para um registro inexistente.`,[row.id,row[field]]);
  else if(linked.obraId&&String(linked.obraId)!==projectId)local.crossWorkLinks.push({collection:key,id:row.id,field,targetId:row[field],targetWork:linked.obraId});
 }
}
if(local.crossWorkLinks.length)issue('alta','vínculos','Foram encontrados vínculos de registros da B2-04 com outra obra.');
local.cash={entries:cash.filter(row=>row.tipo==='aporte').reduce((sum,row)=>sum+toCents(row.valor),0)/100,exits:cash.filter(row=>row.tipo!=='aporte').reduce((sum,row)=>sum+toCents(row.valor),0)/100,
 unlinkedExpenses:cash.filter(row=>row.tipo!=='aporte'&&!row.pedidoId&&!row.notaFiscalId&&!row.pagamentoId).map(row=>({id:row.id,date:row.data,amount:row.valor,category:row.categoria||null}))};local.cash.balance=Math.round((local.cash.entries-local.cash.exits)*100)/100;
local.diaries=diaries.map(row=>({id:row.id,date:row.data,status:row.status,photoCount:row.fotos?.length||0,publishable:active(row)&&['concluido','concluído'].includes(String(row.status).toLowerCase())&&row.publicarCliente!==false}));
if(local.diaries.some(row=>!row.publishable))issue('pendência','diários','Há diário ainda não concluído; seu texto e suas fotos devem permanecer ocultos.',local.diaries.filter(row=>!row.publishable).map(row=>row.id));
if(!notes.length)issue('pendência','notas fiscais','Nenhuma nota fiscal cadastrada com vínculo à B2-04. Não há anexos fiscais para apresentar.');
local.purchaseLinks=orders.map(row=>({id:row.id,number:row.numero,status:row.status,supplierLinked:(data.fornecedores||[]).some(f=>f.id===row.fornecedorId),invoices:notes.filter(n=>n.pedidoId===row.id).map(n=>n.id),items:(row.itens||[]).map(item=>({id:item.id,materialId:item.materialId||null,materialLinked:(data.materiais||[]).some(m=>m.id===item.materialId),stageId:item.orcNivel1Id||item.etapaId||null}))}));
for(const order of local.purchaseLinks){if(!order.supplierLinked)issue('atenção','compras','Fornecedor do pedido não encontrado.',[order.id]);if(order.items.some(row=>!row.materialLinked))issue('atenção','compras','Item sem vínculo válido com o cadastro de material.',[order.id]);}
const financial=buildClientFinancialRows({data,projectId,asOf,canonicalEvents:original.canonical.events,issues:original.canonical.issues});
const editorial=buildClientPortalPublicationRows({data,projectId,publishedAt:snapshot.capturedAt});
local.progress=editorial.find(row=>row.domain==='project_summary').payload;
const technical=scoped('medicoesObra').filter(row=>active(row)&&row.status==='aprovada').sort((a,b)=>String(b.dataMedicao||'').localeCompare(String(a.dataMedicao||'')))[0];
if(technical)issue('conferência','avanço físico',`A medição técnica aprovada usada no portal é de ${technical.dataMedicao||'data não informada'} e informa ${technical.avancoFisico??'percentual não informado'}%. Não foi criada uma nova medição.`,[technical.id]);
local.rentalLinks={count:scoped('locacoesEquip').length,missingEquipment:scoped('locacoesEquip').filter(row=>!(data.equipamentos||[]).some(item=>item.id===row.equipamentoId)).map(row=>row.id)};
if(local.rentalLinks.missingEquipment.length)issue('atenção','equipamentos','Locação sem equipamento válido no cadastro.',local.rentalLinks.missingEquipment);
if(typeof work.capaUrl==='string'&&/\/storage\/v1\/object\/public\//.test(work.capaUrl)){
 const response=await fetch(work.capaUrl,{redirect:'error'});const bytes=Buffer.from(await response.arrayBuffer());
 local.cover={anonymousStatus:response.status,mime:response.headers.get('content-type'),bytes:bytes.length};
 if(response.ok)issue('privacidade','capa','A imagem de capa está em armazenamento público e abre sem login. Quem já tiver esse endereço pode visualizar a capa, independentemente da autorização do portal.');
}
local.costs=financial.find(row=>row.domain==='cost_summary').payload;local.budget=financial.find(row=>row.domain==='stage_budget').payload;
local.contract=buildClientContractPosition({data,projectId,asOf}).payload;
if(!local.budget.hasBudget)issue('pendência','orçamento','Não há orçamento de controle aprovado/vinculado para comparar previsto e realizado por etapa.');
const unassignedStage=local.budget.rows.find(row=>row.id==='unassigned');
if(unassignedStage?.recognized>0)issue('pendência','etapas',`R$ ${unassignedStage.recognized.toLocaleString('pt-BR',{minimumFractionDigits:2})} de custo estão em Sem apropriação, sem etapa determinada pela integração.`);
const orderPayments=local.costs.categories.find(row=>row.category==='compras');
if(orderPayments?.paid>0&&!notes.length)issue('pendência','materiais',`R$ ${orderPayments.paid.toLocaleString('pt-BR',{minimumFractionDigits:2})} pagos em pedidos aparecem como pagamentos de compras, mas não como material reconhecido por nota fiscal; falta a documentação fiscal vinculada.`);
local.canonicalIssues=original.canonical.issues.filter(row=>!row.obraId||row.obraId===projectId).map(row=>({code:row.code,severity:row.severity||null,sourceId:row.sourceId||null}));
if(local.canonicalIssues.length)issue('atenção','custos','O motor canônico retornou pendências; conferir antes de afirmar cobertura completa.');
const months=[];for(let month=String(work.startDate).slice(0,7);month<=asOf.slice(0,7);){months.push(month);const [y,m]=month.split('-').map(Number);month=`${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;if(months.length>120)throw new Error('Período excessivo.');}
local.team=months.map(month=>{const report=buildClientAdministrationTeam({data,projectId,month,asOf,canonicalEvents:original.canonical.events,issues:original.canonical.issues}).payload;return {month,available:report.available,members:report.members.length,workforce:report.workforce,administration:report.administration};});
if(local.team.some(row=>row.workforce.pendingReserves>0))issue('pendência','equipe','Existem competências sem base de provisão ou sem detalhamento individual suficiente; o repasse completo deve ficar em apuração.',local.team.filter(row=>row.workforce.pendingReserves>0).map(row=>row.month));
// Examinar disponibilidade de acesso/publicação sem buscar senhas ou alterar o ERP.
local.remotePortal={};
for(const [table,columns]of [['client_portal_project_memberships','id,profile,active'],['client_portal_publications','domain,status']]){
 const result=await snapshot.remote.from(table).select(columns).eq('company_id',company).eq('project_id',projectId).limit(1000);
 local.remotePortal[table]=result.error?{available:false,errorCode:result.error.code||null}:{available:true,count:result.data.length,rows:result.data};
}
if(local.remotePortal.client_portal_project_memberships.count===0)issue('pendência','acesso','Não há vínculo de cliente por login/senha cadastrado para a B2-04 no novo portal. O acesso antigo por link é um fluxo separado.');
if(local.remotePortal.client_portal_publications.count===0)issue('pendência','publicação','Ainda não há publicações da B2-04 gravadas para o novo portal. A publicação desta auditoria existe somente na cópia local.');
async function request(route,{cookie='',method='GET',body={},query={}}={}){
 const res={code:200,headers:{},body:null,status(code){this.code=code;return this;},setHeader(key,value){this.headers[key]=value;},json(value){this.body=value;return this;},end(value){this.body=value;return this;}};
 await handleClientPortal({method,query:{route,...query},body,headers:{host:'audit.local',cookie}},res,db);return res;
}
const actor={id:'audit-local',role:'admin'},email='audit-b204@example.test',password='AuditoriaB204Local2026';
for(const operation of ['provision','publish'])assert.equal((await executeClientPortalAdmin({db,companyId:company,data,actor,body:{operation,obraId:projectId,email,password,profile:'owner'}})).status,200);
const login=await request('auth/login',{method:'POST',body:{email,password}});assert.equal(login.code,200);const cookie=String(login.headers['Set-Cookie']).split(';')[0];
const initial=await request(`projects/${projectId}/dashboard`,{cookie});check('Portal com as liberações originais abre',initial.code===200);
local.originalVisible=Object.fromEntries(Object.entries(initial.body.portal).filter(([,value])=>Array.isArray(value)).map(([key,value])=>[key,value.length]));
check('Caixa desabilitado não aparece',initial.body.portal.projectCashMovements.length===0&&initial.body.portal.projectCashSummary.length===0);
check('Notas desabilitadas não aparecem',initial.body.portal.invoices.length===0);
check('Diário em preparação não é publicado',initial.body.portal.dailyReports.length===0&&initial.body.portal.publishedMedia.length===0);
// Ampliação SOMENTE NA CÓPIA LOCAL para não depender de abas fechadas.
const clone=structuredClone(data),target=clone.obras.find(row=>row.id===projectId),foreign=clone.obras.find(row=>row.id!==projectId);assert(foreign);
for(const item of [target,foreign])item.portalCliente={...item.portalCliente,ativo:true,...Object.fromEntries(flags.map(flag=>[flag,true]))};
const marker='SENTINELA_OUTRA_OBRA_SOMENTE_LOCAL';
clone.notasFiscais.push({id:'foreign-invoice-audit',obraId:foreign.id,status:'aprovada',numero:marker,valorBruto:123.45,emissao:asOf,competencia:asOf.slice(0,7),documentos:[{id:'foreign-invoice-document',driveId:'audit-only',nome:marker}]});
clone.rdos.push({id:'foreign-diary-audit',obraId:foreign.id,status:'concluido',data:asOf,descricao:marker,fotos:[{id:'foreign-photo-audit',url:'/api/microsoft/onedrive?action=file&driveId=audit-only&itemId=foreign-photo',legenda:marker}]});
foreign.documentosOneDrive=[{id:'foreign-document-audit',nome:marker,publicarCliente:true,url:'/api/microsoft/onedrive?action=file&driveId=audit-only&itemId=foreign-document'}];
await seedPortalSource(db,clone);
// RDO tem linha própria e prevalece sobre core; inserir a sentinela somente
// nessa cópia em memória para que o controle positivo exerça o leitor real.
const rdoRow=(await db.pg.query("select value from company_app_data where company_id=$1 and key='arced_ponto_v1__rdo'",[company])).rows[0];
if(rdoRow)await db.pg.query("update company_app_data set value=$1::jsonb where company_id=$2 and key='arced_ponto_v1__rdo'",[JSON.stringify({...decodeAppData(rdoRow.value),rdos:clone.rdos}),company]);
for(const id of [projectId,foreign.id])assert.equal((await executeClientPortalAdmin({db,companyId:company,data:clone,actor,body:{operation:'publish',obraId:id}})).status,200);
const full=await request(`projects/${projectId}/dashboard`,{cookie,query:{month:asOf.slice(0,7)}});check('Portal com todas as áreas abre na cópia local',full.code===200);const portal=full.body.portal;
check('Campos privados não atravessam a projeção',!/["'](?:cpf|pixKey|monthlySalary|medicalReason|password_hash)["']\s*:/.test(JSON.stringify(portal)));
check('Custos do portal iguais ao razão canônico',JSON.stringify(portal.costSummaries[0])===JSON.stringify(local.costs));
check('Saldo do caixa igual à origem',portal.projectCashSummary[0].balance===local.cash.balance);
check('Nenhuma sentinela de outra obra chega ao dashboard',!JSON.stringify(portal).includes(marker));
check('Nenhuma nota de outra obra foi associada à B2-04',portal.invoices.length===notes.length);
const foreignEmail='audit-foreign@example.test';assert.equal((await executeClientPortalAdmin({db,companyId:company,data:clone,actor,body:{operation:'provision',obraId:foreign.id,email:foreignEmail,password,profile:'owner'}})).status,200);
const foreignLogin=await request('auth/login',{method:'POST',body:{email:foreignEmail,password}});assert.equal(foreignLogin.code,200);const foreignCookie=String(foreignLogin.headers['Set-Cookie']).split(';')[0];
const positiveForeign=await request(`projects/${foreign.id}/dashboard`,{cookie:foreignCookie});check('Controle positivo: os registros da outra obra existem e seu próprio cliente os recebe',positiveForeign.code===200&&JSON.stringify(positiveForeign.body.portal).includes(marker)&&positiveForeign.body.portal.invoices.some(row=>row.id==='foreign-invoice-audit')&&positiveForeign.body.portal.publishedMedia.some(row=>row.id==='foreign-photo-audit')&&positiveForeign.body.portal.publishedDocuments.some(row=>row.id==='foreign-document-audit'));
const parameterAttack=await request(`projects/${projectId}/dashboard`,{cookie,query:{obraId:foreign.id,projectId:foreign.id},body:{obraId:foreign.id}});check('Parâmetros extras não trocam a obra autorizada',parameterAttack.code===200&&parameterAttack.body.portal.project.id===projectId&&!JSON.stringify(parameterAttack.body.portal).includes(marker));
const session=await request('auth/session',{cookie});check('Sessão lista somente a obra autorizada',session.body.projects.length===1&&session.body.projects[0].projectId===projectId);
let crossRequests=0;
for(const work of data.obras.filter(row=>row.id!==projectId))for(const suffix of ['dashboard','statement','media/foreign-photo-audit','documents/foreign-document-audit','files/foreign-invoice-audit/foreign-invoice-document']){
 const result=await request(`projects/${work.id}/${suffix}`,{cookie});check(`Outra obra bloqueada: ${work.id}/${suffix}`,result.code===403);crossRequests++;
}
for(const suffix of ['media/foreign-photo-audit','documents/foreign-document-audit','files/foreign-invoice-audit/foreign-invoice-document']){
 const result=await request(`projects/${projectId}/${suffix}`,{cookie});check(`ID de outra obra sob URL da B2-04 bloqueado: ${suffix}`,result.code===404);crossRequests++;
}
for(const suffix of ['dashboard','statement','media/foreign-photo-audit','documents/foreign-document-audit','files/foreign-invoice-audit/foreign-invoice-document'])check(`Sem sessão bloqueado: ${suffix}`,(await request(`projects/${projectId}/${suffix}`)).code===401);
const statement=await request(`projects/${projectId}/statement`,{cookie,query:{month:asOf.slice(0,7),format:'json'}});check('Prestação de contas respeita a B2-04',statement.code===200&&!JSON.stringify(statement.body).includes(marker));
const ownPdf=await request(`projects/${projectId}/statement`,{cookie,query:{month:asOf.slice(0,7)}});check('PDF da obra autorizada é gerado',ownPdf.code===200&&Buffer.isBuffer(ownPdf.body)&&ownPdf.body.subarray(0,5).toString()==='%PDF-');await writeFile(`${directory}/prestacao-B2-04-local.pdf`,ownPdf.body,{mode:0o600});
await db.pg.query("update client_portal_project_memberships set profile='observer' where project_id=$1",[projectId]);
const observer=await request(`projects/${projectId}/dashboard`,{cookie});check('Perfil observador não recebe financeiro ou folha',observer.code===200&&observer.body.portal.administrationTeam.length===0&&observer.body.portal.costSummaries.length===0&&observer.body.portal.projectCashMovements.length===0);check('Observador não baixa prestação financeira',(await request(`projects/${projectId}/statement`,{cookie})).code===403);
await db.pg.query("update client_portal_project_memberships set profile='owner',active=false where project_id=$1",[projectId]);check('Revogação de vínculo bloqueia sessão existente',(await request(`projects/${projectId}/dashboard`,{cookie})).code===403);
local.security={crossRequests,checksPassed:local.checks.length,foreignWorkCount:data.obras.length-1,unauthorizedContentReturned:false,duplicateLegacyTokenOtherWorkCount:data.obras.filter(row=>row.id!==projectId&&row.portalCliente?.token&&row.portalCliente.token===work.portalCliente?.token).length};
check('O token legado não é compartilhado com outra obra',local.security.duplicateLegacyTokenOtherWorkCount===0);
check('Dados originais em memória preservados',reviewFingerprint(data)===before);check('Nenhuma escrita remota tentada',blockedWrites.length===0);
local.security.checksPassed=local.checks.length;
// A segunda leitura detecta alteração externa durante a auditoria; não a corrige.
const latest=await loadRealPortalSnapshot();local.remoteSourceUnchanged=latest.fingerprint===snapshot.fingerprint;
local.remoteReads=remoteRequests.length;local.remoteWrites=blockedWrites.length;
if(!local.remoteSourceUnchanged)issue('atenção','origem','A origem mudou externamente durante a auditoria; os resultados valem para a captura registrada.');
await writeFile(`${directory}/integration.json`,JSON.stringify(local,null,2),{mode:0o600});
const hidden=flags.filter(flag=>work.portalCliente?.[flag]!==true);
const markdown=`# Auditoria local da B2-04\n\nData da posição: ${asOf}. Captura: ${snapshot.capturedAt}.\n\n## Resultado\n\n${local.checks.length} verificações locais aprovadas; ${crossRequests} tentativas de acesso cruzado bloqueadas, abrangendo ${data.obras.length-1} outras obras. Sem escrita remota. A confirmação refere-se ao código e à captura testados localmente.\n\n## Integração financeira\n\nCusto reconhecido acumulado: R$ ${local.costs.recognized?.toLocaleString('pt-BR',{minimumFractionDigits:2})}. Pagamentos: R$ ${local.costs.paid?.toLocaleString('pt-BR',{minimumFractionDigits:2})}. Saldo do caixa: R$ ${local.cash.balance.toLocaleString('pt-BR',{minimumFractionDigits:2})}. Cobranças emitidas em aberto: ${local.contract.openInstallments.length}. Estes números representam fatos distintos e não devem ser somados.\n\n## Liberações atuais\n\nÁreas sem liberação explícita: ${hidden.join(', ')}. Na cópia de teste, as áreas foram liberadas somente em memória para testar a integração e o isolamento. Nenhuma liberação foi gravada no ERP.\n\n## Pendências e informações faltantes\n\n${local.issues.map(row=>`- **${row.severity} · ${row.area}:** ${row.detail}${row.records.length?` Referências: ${row.records.join(', ')}.`:''}`).join('\n')}\n\n## Registros sem obra\n\n${Object.entries(local.unbound).map(([key,value])=>`- ${key}: ${value.count} registro(s) sem vínculo explícito. Não é possível afirmar que pertençam à B2-04; nenhuma ligação por nome foi feita.`).join('\n')||'Nenhum registro sem obra nestes conjuntos.'}\n\n## Segurança\n\nTestados: troca do ID da obra, IDs de fotos/documentos/notas de outra obra dentro da URL da B2-04, ausência de sessão, perfil sem acesso financeiro, revogação do vínculo com sessão já aberta e sentinelas exclusivas de outra obra. Fotos e diários não concluídos permaneceram ocultos.\n\n## Limites\n\nArquivos originais do OneDrive não são abertos por esta rotina. A auditoria confirma vínculos e autorização, não substitui a verificação de disponibilidade do provedor ou a revisão humana de documentos ausentes. Cadastros sem obra não são atribuídos por semelhança. A auditoria não emite cobrança nem reconhece custo novo no DRE. Integridade da origem entre capturas: ${local.remoteSourceUnchanged?'sem alteração detectada':'alteração externa detectada'}.\n`;
await writeFile(`${directory}/RELATORIO.md`,markdown,{mode:0o600});
console.log(JSON.stringify({directory,asOf,sourceCounts:local.sourceCounts,costs:local.costs,cash:local.cash,originalFlags:local.originalFlags,issues:local.issues,links:local.links,unboundCounts:Object.fromEntries(Object.entries(local.unbound).map(([k,v])=>[k,v.count])),duplicates:local.duplicates,crossWorkLinks:local.crossWorkLinks,security:local.security,remotePortal:local.remotePortal,remoteSourceUnchanged:local.remoteSourceUnchanged,remoteWrites:local.remoteWrites},null,2));
await db.pg.close();globalThis.fetch=nativeFetch;
