import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareIncidentMutation, readMonitoring, monitoringReadiness } from '../../server/marcell-monitoring.js';
const user={id:'u',role:'admin',active:true};
const grant={id:'grant',userId:'u',obraIds:['o'],scopes:['monitoramento:write','monitoramento:read']};
const data={usuarios:[user],obras:[{id:'o'},{id:'other'}]};
const body={eventId:'incident_event_0001',obraId:'o',code:'DATA_SAVE_FAILED',module:'financeiro'};
const ctx=(b=body,d=data)=>({data:d,user,grant,body:b,now:'2026-10-31T18:00:00Z'});
test('persists fixed safe incident with server actor/time and unverified classification',()=>{
 const before=JSON.stringify(data),r=prepareIncidentMutation(ctx());assert.equal(r.kind,'save');assert.equal(JSON.stringify(data),before);
 const event=r.data.integrationIncidents[0];assert.equal(event.severity,'critical');assert.equal(event.verification,'reported-unverified');assert.equal(event.actorId,'u');assert.equal(event.recordedAt,'2026-10-31T18:00:00.000Z');assert.equal(r.after.integrationGrantId,'grant');
});
test('raw errors, secrets, stacks, paths, recipients and forged severity are rejected without persistence',()=>{
 for(const key of ['message','stack','pathname','headers','token','recipient','webhookUrl','severity','actorId','recordedAt']){
  const r=prepareIncidentMutation(ctx({...body,[key]:'Bearer SECRET email@example.com 123.456.789-10'}));assert.equal(r.status,400);assert.equal(r.data,undefined);assert.equal(JSON.stringify(r).includes('SECRET'),false);
 }
});
test('unknown code/module and malformed event ID fail closed',()=>{
 for(const change of [{code:'__proto__'},{code:'made-up'},{module:'https://evil.test'},{eventId:'x'}])assert.equal(prepareIncidentMutation(ctx({...body,...change})).status,400);
});
test('exact replay is idempotent but same event ID with different code conflicts',()=>{
 const next=prepareIncidentMutation(ctx()).data;assert.equal(prepareIncidentMutation(ctx(body,next)).kind,'idempotent');
 assert.equal(prepareIncidentMutation(ctx({...body,code:'CLIENT_RUNTIME_ERROR'},next)).status,409);
 assert.equal(next.integrationMonitoringCounters[0].count,1);
});
test('cross-obra, inactive actor, unprivileged role and missing scope cannot report/read',()=>{
 assert.equal(prepareIncidentMutation(ctx({...body,obraId:'other'})).status,403);
 assert.equal(readMonitoring(ctx({...body,obraId:'other'})).status,403);
 assert.equal(prepareIncidentMutation({...ctx(),data:{...data,usuarios:[{...user,active:false}]}}).status,403);
 assert.equal(prepareIncidentMutation({...ctx(),grant:{...grant,scopes:['monitoramento:read']}}).status,403);
 const viewer={...user,role:'visualizador'};assert.equal(prepareIncidentMutation({...ctx(),user:viewer,data:{...data,usuarios:[viewer]}}).status,403);
});
test('atomic stored counter permits20 per minute and denies21st, allowing next minute',()=>{
 let current=data;for(let i=0;i<20;i++){const r=prepareIncidentMutation(ctx({...body,eventId:`incident_event_${String(i).padStart(4,'0')}`},current));assert.equal(r.kind,'save');current=r.data;}
 assert.equal(prepareIncidentMutation(ctx({...body,eventId:'incident_event_9999'},current)).status,429);
 assert.equal(prepareIncidentMutation({...ctx({...body,eventId:'incident_event_9999'},current),now:'2026-10-31T18:01:00Z'}).kind,'save');
});
test('counter cardinality is capped and expired buckets are cleaned rather than evicting active limits',()=>{
 const bucket=Math.floor(Date.parse('2026-10-31T18:00:00Z')/60000);
 const full={...data,integrationMonitoringCounters:Array.from({length:200},(_,i)=>({subject:String(i),bucket,count:1}))};
 assert.equal(prepareIncidentMutation(ctx(body,full)).status,503);
 const expired={...full,integrationMonitoringCounters:full.integrationMonitoringCounters.map(c=>({...c,bucket:bucket-11}))};
 const r=prepareIncidentMutation(ctx(body,expired));assert.equal(r.kind,'save');assert.equal(r.data.integrationMonitoringCounters.length,1);
});
test('per-work retention keeps100 newest incidents and never returns private receipt or actor data',()=>{
 const old=Array.from({length:500},(_,i)=>({id:`old${i}`,obraId:'o',code:'CLIENT_RUNTIME_ERROR',recordedAt:'2026-10-01',receipt:`old${i}`,fingerprint:'PRIVATE',actorId:'PRIVATE'}));
 const r=prepareIncidentMutation(ctx(body,{...data,integrationIncidents:old}));assert.equal(r.data.integrationIncidents.length,100);assert.equal(r.data.integrationIncidents[0].id,'old401');
 const feed=readMonitoring(ctx({obraId:'o'},r.data));assert.equal(feed.total,100);assert.equal(feed.incidents.length,50);assert.equal(JSON.stringify(feed).includes('PRIVATE'),false);assert.equal(feed.incidents[0].id,r.incidentId);
});
test('feed is scoped, bounded and reconstructs safe summary even if stored text was corrupted',()=>{
 const current={...data,integrationIncidents:[{id:'safe',obraId:'o',code:'DATA_SAVE_FAILED',summary:'SECRET',severity:'critical',recordedAt:'2026-10-31'},{id:'hidden',obraId:'other',code:'DATA_SAVE_FAILED'}]};
 const r=readMonitoring(ctx({obraId:'o',severity:'critical'},current));assert.equal(r.total,1);assert.equal(JSON.stringify(r).includes('SECRET'),false);assert.equal(JSON.stringify(r).includes('hidden'),false);
 assert.equal(readMonitoring(ctx({obraId:'o',limit:101},current)).status,400);
});
test('readiness never claims scheduling/delivery or verified critical facts; missing data is not zero',()=>{
 const r=monitoringReadiness();assert.equal(r.schedulerActive,false);assert.equal(r.deliveryActive,false);assert.equal(r.requestedSchedule.timezone,'America/Recife');assert.equal(r.requestedSchedule.time,'18:00');assert.deepEqual(r.requestedSchedule.weekdays,[1,2,3,4,5]);
 assert.equal(readMonitoring(ctx({obraId:'o'})).total,null);assert.equal(readMonitoring(ctx({obraId:'o'})).availability,'not-initialized');
});

test('malformed stored scalar fields cannot leak nested content in incident feed',()=>{
 const malformed={...data,integrationIncidents:[{id:{token:'SECRET'},obraId:'o',code:'unknown',module:{pin:'SECRET'},recordedAt:'SECRET'}]};
 assert.equal(JSON.stringify(readMonitoring(ctx({obraId:'o'},malformed))).includes('SECRET'),false);
});

test('noisy obra retention preserves another obra incidents while enforcing company cap',()=>{
 const old=Array.from({length:499},(_,i)=>({id:`old${i}`,obraId:i<400?'o':`work${i}`,code:'CLIENT_RUNTIME_ERROR'}));
 const r=prepareIncidentMutation(ctx(body,{...data,integrationIncidents:old}));
 assert.equal(r.data.integrationIncidents.filter(i=>i.obraId==='o').length,100);
 assert.equal(r.data.integrationIncidents.filter(i=>i.obraId!=='o').length,99);
});
