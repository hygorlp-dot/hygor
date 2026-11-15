import {it,expect,vi} from 'vitest';
import {prepareStatementDelivery,dispatchStatementDelivery,createWahaStatementTransport} from './client-statement-delivery.js';
const recipient={id:'cliente',email:'cliente@example.test',whatsapp:'81999990000'};
const report={projectId:'w',projectName:'Obra',month:'2026-11',simulation:true,charges:[{balance:50}]};
const make=()=>prepareStatementDelivery({report,recipient,pdf:Buffer.from('%PDF-fixture')});
const journal=()=>{const states=new Map();return {states,reserve:(key,value)=>{if(states.has(key))return false;states.set(key,value);return true;},finish:(key,value)=>states.set(key,value)};};
it('simula os dois canais sem transporte externo e evita duplicidade entre solicitações simultâneas',async()=>{
 const store=journal(),transport=vi.fn(),delivery=make();
 const results=await Promise.all([dispatchStatementDelivery({delivery,journal:store,transports:{email:transport,whatsapp:transport}}),dispatchStatementDelivery({delivery,journal:store})]);
 expect(results.flat().filter(row=>row.state==='simulated')).toHaveLength(2);expect(transport).not.toHaveBeenCalled();expect(delivery.outstanding).toBe(50);
 expect((await dispatchStatementDelivery({delivery,journal:store,mode:'live',enabled:true})).every(row=>row.state==='blocked')).toBe(true);
});
it('não reenvia resultado incerto e exige uma revisão explícita para nova entrega',async()=>{
 const delivery=prepareStatementDelivery({report:{...report,simulation:false},recipient,pdf:Buffer.from('%PDF-fixture')}),store=journal(),transport=vi.fn(async()=>{throw new Error('timeout');});
 expect((await dispatchStatementDelivery({delivery,journal:store,mode:'live',enabled:true,transports:{email:transport,whatsapp:transport}})).every(row=>row.state==='uncertain')).toBe(true);
 await dispatchStatementDelivery({delivery,journal:store,mode:'live',enabled:true,transports:{email:transport,whatsapp:transport}});expect(transport).toHaveBeenCalledTimes(2);
 const changed=prepareStatementDelivery({report,recipient,pdf:Buffer.from('%PDF-new')});expect(changed.jobs[0].key).toBe(delivery.jobs[0].key);
});
it('confere o remetente financeiro antes de usar a mesma API WAHA dos comprovantes',async()=>{
 const request=vi.fn(async path=>path.startsWith('/api/sessions')?{status:'WORKING',me:{id:'558188888888@c.us'}}:{id:'x'});
 await expect(createWahaStatementTransport({request,session:'marcell-test'})(make().jobs[1])).rejects.toThrow('financeiro');expect(request).toHaveBeenCalledTimes(1);
 request.mockImplementation(async path=>path.startsWith('/api/sessions')?{status:'WORKING',me:{id:'5581989751300@c.us'}}:path.includes('check-exists')?{numberExists:true,chatId:'5581999990000@c.us'}:{id:'accepted'});
 expect(await createWahaStatementTransport({request,session:'marcell-test'})(make().jobs[1])).toEqual({id:'accepted'});
 expect(request.mock.calls.at(-1)[0]).toBe('/api/sendFile');expect(request.mock.calls.at(-1)[1].file.mimetype).toBe('application/pdf');
});
