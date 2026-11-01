import {authorizeSectionChanges} from '../../server/section-authorizations.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readIntegration,integrationReport,prepareIntegrationCommand,annotateIntegrationResult,integrationCapabilities} from '../../server/marcell-integration.js';
import {reviseIntegrationBudget,budgetSourceHash} from '../../server/marcell-budget-revision.js';
import {applyOperationalCommand} from '../../src/domains/sync/operational-commands.js';
const user={id:'u',role:'admin',active:true};
const grant={id:'g',userId:'u',obraIds:['o'],scopes:['orcamento:read','orcamento:write','planejamento:write','financeiro:read','contratos:read','rdo:read','rdo:write','producao:read','seguranca:read','equipe:read','equipamentos:read','relatorios:read']};
const data={usuarios:[user],obras:[{id:'o',aditivosContrato:[{id:'a',descricao:'Aditivo',valor:100,status:'proposto',pix:'SECRET'}]},{id:'other'}],orcamentos:[{id:'b',obraId:'o',versionId:'v1',versionStatus:'aprovado',status:'aprovado',lockedAt:'2026-01-01',approvedById:'u',itens:[{id:'i',quantidade:2,precoUnit:100}],etapas:[]}],budgetBaselines:[{id:'base',obraId:'o',budgetId:'b',budgetVersionId:'v1',tipo:'controle',ativo:true}],rdos:[{id:'r',obraId:'o',status:'preparacao',version:1,data:'2026-10-31',descricao:'Dia produtivo'}]};
const body={obraId:'o',budgetId:'b',newId:'b2',newVersionId:'v2',sourceHash:budgetSourceHash(data.orcamentos[0]),changes:[{id:'i',quantidade:3}],idempotencyKey:'budget_request_0001'};
const ctx=(bodyOverride=body)=>({data,user,grant,body:bodyOverride});
test('budget revision persists new draft, keeping approved source and baseline byte-for-byte',()=>{
 const before=JSON.stringify(data);const result=reviseIntegrationBudget(ctx());assert.equal(result.kind,'save');
 assert.equal(JSON.stringify(data),before);assert.deepEqual(result.data.budgetBaselines,data.budgetBaselines);assert.deepEqual(result.data.orcamentos[0],data.orcamentos[0]);
 assert.equal(result.data.orcamentos[1].versionStatus,'rascunho');assert.equal(result.data.orcamentos[1].itens[0].quantidade,3);assert.equal(result.data.orcamentos[1].approvedById,'');assert.equal(result.after.integrationGrantId,'g');
});
test('budget revision exact replay is idempotent and changed payload with same key conflicts',()=>{
 const saved=reviseIntegrationBudget(ctx()).data;
 assert.equal(reviseIntegrationBudget({...ctx(),data:saved}).kind,'idempotent');
 assert.equal(reviseIntegrationBudget({...ctx({...body,changes:[]}),data:saved}).status,409);
});
test('budget revision rejects stale source, duplicate identities, cross obra and injected status',()=>{
 for(const changes of [{sourceHash:'a'.repeat(64)},{newId:'b'},{newVersionId:'v1'}])assert.equal(reviseIntegrationBudget(ctx({...body,...changes})).status,409);
 assert.equal(reviseIntegrationBudget(ctx({...body,obraId:'other'})).status,403);
 assert.equal(reviseIntegrationBudget(ctx({...body,changes:[{id:'i',status:'aprovado'}]})).status,400);
});
test('budget revision requires independent write scope and active authorized actor',()=>{
 assert.equal(reviseIntegrationBudget({...ctx(),grant:{...grant,scopes:['orcamento:read']}}).status,403);
 assert.equal(reviseIntegrationBudget({...ctx(),data:{...data,usuarios:[{...user,active:false}]}}).status,403);
});
test('budget read exposes stable source hash required for optimistic revision',()=>{
 const result=readIntegration(ctx({obraId:'o',module:'orcamento'}));assert.equal(result.sections.orcamentos.records[0].sourceHash,body.sourceHash);
});
test('contract reads expose bounded proposed amendments without secret fields',()=>{
 const result=readIntegration(ctx({obraId:'o',module:'contratos'}));assert.equal(result.sections.obras.records[0].aditivosContrato[0].id,'a');assert.equal(JSON.stringify(result).includes('SECRET'),false);
});
test('operational team and equipment reads never disclose personnel pay/bank data',()=>{
 const expanded={...data,employees:[{id:'e',obra:'o',name:'Operador',monthlySalary:9999,paymentInstructions:'SECRET',cpf:'SECRET'}],equipamentos:[{id:'eq',obraAtualId:'o',nome:'Guindaste'},{id:'other',obraAtualId:'other'}]};
 const team=readIntegration({...ctx({obraId:'o',module:'equipe'}),data:expanded});assert.equal(JSON.stringify(team).includes('SECRET'),false);assert.equal(JSON.stringify(team).includes('9999'),false);
 assert.equal(readIntegration({...ctx({obraId:'o',module:'equipamentos'}),data:expanded}).sections.equipamentos.total,1);
});
test('report exposes missing sources as unavailable/null, not fabricated zero or errors',()=>{
 const result=integrationReport(ctx({obraId:'o',date:'2026-10-31'}));assert.equal(result.ok,true);assert.equal(result.modules.financeiro.payments.total,null);assert.equal(result.coverage.persistentClientErrors,false);assert.equal(result.coverage.scheduled,false);assert.equal(result.observations.some(o=>o.id==='r'),true);
 assert.equal(integrationReport(ctx({obraId:'other',date:'2026-10-31'})).status,403);
});
test('scoped safety/producao role can read results without expanding legacy blob access',()=>{
 const actor={...user,role:'engenheiro'};const expanded={...data,usuarios:[actor],jobRiskAnalyses:[{id:'apr',obraId:'o',risks:['queda'],controls:['cinto'],token:'SECRET'}],progressRecords:[{id:'pr',obraId:'o',quantity:5,data:'2026-10-31'}]};
 const safety=readIntegration({...ctx({obraId:'o',module:'seguranca'}),data:expanded,user:actor});assert.equal(safety.sections.jobRiskAnalyses.records[0].risks[0],'queda');assert.equal(JSON.stringify(safety).includes('SECRET'),false);
 assert.equal(readIntegration({...ctx({obraId:'o',module:'producao'}),data:expanded,user:actor}).sections.progressRecords.records[0].quantity,5);
});
test('registry commands route and tagged replay survives later workflow transition, rejects changed body',()=>{
 const request={operation:'save-field-report-draft',obraId:'o',expectedVersion:1,idempotencyKey:'rdo_request_0001',record:{id:'r',data:'2026-10-31',descricao:'Atualizado'}};
 const prepared=prepareIntegrationCommand(ctx(request));assert.equal(prepared.ok,true);
 const command={...prepared.command,actorId:'u'};const applied=annotateIntegrationResult(applyOperationalCommand(data,command),{grant,body:request},command);
 assert.equal(applied.ok,true);applied.data.rdos[0].status='concluido';
 assert.equal(prepareIntegrationCommand({...ctx(request),data:applied.data}).replay,true);
 assert.equal(prepareIntegrationCommand({...ctx({...request,record:{...request.record,descricao:'Outro'}}),data:applied.data}).status,409);
});
test('capabilities disclose risk and no grant silently enables financial execution',()=>{
 const result=integrationCapabilities(grant,user,true);assert.equal(result.writes.includes('create-budget-revision'),true);assert.equal(result.writes.includes('create-project-expense'),false);assert.equal(result.commandDetails['save-supply-contract'].risk,'contract-activation');assert.equal(result.unavailable.includes('bank-payments'),true);
});

test('prototype-named operation and impossible report date fail closed without exception',()=>{
 assert.equal(prepareIntegrationCommand(ctx({operation:'__proto__',obraId:'o',expectedVersion:0,idempotencyKey:'prototype_request_01'})).status,403);
 assert.equal(integrationReport(ctx({obraId:'o',date:'2026-02-31'})).status,400);
});

test('legacy generic save cannot forge/delete signature evidence or incident quota even as admin',()=>{
 for(const key of ['integrationIncidents','integrationMonitoringCounters','integrationSignaturePackets'])assert.notEqual(authorizeSectionChanges({role:'admin'},{[key]:[]}), '');
 assert.equal(authorizeSectionChanges({role:'admin'},{orcamentos:[]}), '');
});
