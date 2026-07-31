import { describe, expect, it } from "vitest";
import { createSaveQueue, SAVE_QUEUE_STATE } from "./save-queue";

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};

describe("fila serializada de salvamento", () => {
  it("preserva o snapshot mais recente chegado durante um salvamento", async () => {
    const first=deferred();const calls=[];
    const queue=createSaveQueue({save:async item=>{calls.push(item);return calls.length===1?first.promise:{ok:true};}});
    queue.enqueue({medicoes:["a"]});queue.enqueue({pedidos:["b"]});
    first.resolve({ok:true});await new Promise(setImmediate);
    expect(calls).toEqual([{medicoes:["a"]},{pedidos:["b"]}]);
  });

  it("não drena a fila antes do backoff agendado", async () => {
    const scheduled=[];let calls=0;
    const queue=createSaveQueue({save:async()=>{calls+=1;return calls===1?{ok:false,reason:"rede"}:{ok:true};},schedule:(fn,delay)=>scheduled.push({fn,delay})});
    queue.enqueue({id:"a"});await Promise.resolve();
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.RETRY_SCHEDULED);expect(calls).toBe(1);expect(scheduled[0].delay).toBe(1500);
    scheduled[0].fn();await Promise.resolve();await Promise.resolve();
    expect(calls).toBe(2);expect(queue.getState()).toBe(SAVE_QUEUE_STATE.IDLE);
  });

  it("para em failed sem loop e só reabre com nova ação", async () => {
    const scheduled=[];let calls=0;
    const queue=createSaveQueue({maxRetries:1,save:async()=>{calls+=1;return{ok:false};},schedule:fn=>scheduled.push(fn)});
    queue.enqueue({id:"a"});await Promise.resolve();scheduled.shift()();await Promise.resolve();
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.FAILED);expect(calls).toBe(2);
    await Promise.resolve();expect(calls).toBe(2);
    queue.enqueue({id:"b"});await Promise.resolve();expect(calls).toBe(3);
  });

  it("preserva conflito para resolução explícita sem last-write-wins", async () => {
    const queue=createSaveQueue({save:async()=>({ok:false,conflict:true})});
    const settled=queue.enqueue({id:"a"});await Promise.resolve();
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.CONFLICT);expect(queue.hasPending()).toBe(true);
    expect(await settled).toEqual({ok:false,state:SAVE_QUEUE_STATE.CONFLICT});
    queue.discard();expect(queue.getState()).toBe(SAVE_QUEUE_STATE.IDLE);expect(queue.hasPending()).toBe(false);
  });

  it("mantém a alteração pendente offline e a retoma quando a conexão volta", async () => {
    let offline=true;let calls=0;
    const queue=createSaveQueue({
      isOffline:()=>offline,
      save:async()=>{calls+=1;return calls===1?{ok:false,reason:"rede"}:{ok:true};},
    });
    queue.enqueue({id:"offline"});await Promise.resolve();
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.OFFLINE);expect(queue.hasPending()).toBe(true);expect(calls).toBe(1);
    offline=false;queue.resume();await Promise.resolve();await Promise.resolve();
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.IDLE);expect(queue.hasPending()).toBe(false);expect(calls).toBe(2);
  });

  it("preserva 100 alterações acumuladas em uma sequência rápida", async () => {
    const first=deferred();const snapshots=[];
    const queue=createSaveQueue({save:async snapshot=>{snapshots.push(snapshot);return snapshots.length===1?first.promise:{ok:true};}});
    for(let index=0;index<100;index+=1)queue.enqueue({eventos:Array.from({length:index+1},(_,i)=>i)});
    first.resolve({ok:true});await new Promise(setImmediate);
    expect(snapshots).toHaveLength(2);
    expect(snapshots.at(-1).eventos).toHaveLength(100);
    expect(snapshots.at(-1).eventos.at(-1)).toBe(99);
  });

  it("não chama erro de regra do servidor de falha de conexão nem repete 409", async()=>{
    let calls=0;let retryCount=0;let failure;
    const queue=createSaveQueue({
      save:async()=>{calls+=1;return{ok:false,status:409,reason:"FIN-003 bloqueou a seção."};},
      onRetry:()=>{retryCount+=1;},
      onFailed:event=>{failure=event;},
    });
    queue.enqueue({attendance:{}});
    await Promise.resolve();

    expect(calls).toBe(1);
    expect(retryCount).toBe(0);
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.FAILED);
    expect(failure.result.reason).toBe("FIN-003 bloqueou a seção.");
  });

  it("não repete recusas 403 nem timeout HTTP 408",async()=>{
    for(const status of [403,408]){
      let calls=0;
      const queue=createSaveQueue({save:async()=>{calls+=1;return{ok:false,status};}});
      queue.enqueue({id:String(status)});
      await Promise.resolve();
      expect(calls).toBe(1);
      expect(queue.getState()).toBe(SAVE_QUEUE_STATE.FAILED);
    }
  });

  it("repete 500 somente até o limite configurado",async()=>{
    const scheduled=[];let calls=0;
    const queue=createSaveQueue({
      maxRetries:3,
      save:async()=>{calls+=1;return{ok:false,status:500};},
      schedule:(fn,delay)=>{scheduled.push({fn,delay});return scheduled.length;},
    });
    queue.enqueue({id:"server-error"});await Promise.resolve();
    expect(scheduled[0].delay).toBe(1500);
    scheduled.shift().fn();await Promise.resolve();
    expect(scheduled[0].delay).toBe(3000);
    scheduled.shift().fn();await Promise.resolve();
    expect(scheduled[0].delay).toBe(4500);
    scheduled.shift().fn();await Promise.resolve();
    expect(calls).toBe(4);
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.FAILED);
    expect(scheduled).toHaveLength(0);
  });

  it("respeita Retry-After do servidor em respostas 429",async()=>{
    const scheduled=[];
    const queue=createSaveQueue({
      save:async()=>({ok:false,status:429,retryAfter:8}),
      schedule:(fn,delay)=>{scheduled.push({fn,delay});return scheduled.length;},
    });
    queue.enqueue({id:"rate-limit"});await Promise.resolve();
    expect(scheduled[0].delay).toBe(8000);
    queue.destroy();
  });

  it("cancela o único timer pendente ao destruir a fila",async()=>{
    const scheduled=[];const cancelled=[];
    const queue=createSaveQueue({
      save:async()=>({ok:false,status:503}),
      schedule:fn=>{const token={fn};scheduled.push(token);return token;},
      cancelSchedule:token=>cancelled.push(token),
    });
    queue.enqueue({id:"retry"});await Promise.resolve();
    expect(scheduled).toHaveLength(1);
    queue.destroy();
    expect(cancelled).toEqual([scheduled[0]]);
    expect(queue.hasPending()).toBe(false);
    scheduled[0].fn();await Promise.resolve();
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.FAILED);
  });

  it("aguarda de verdade a requisição em voo antes de liberar um comando seguinte", async()=>{
    const first=deferred();let settled=false;
    const queue=createSaveQueue({save:async()=>first.promise});
    queue.enqueue({equipamentos:[{id:"eq-1"}]});
    const waiting=queue.waitForIdle().then(result=>{settled=true;return result;});
    await Promise.resolve();
    expect(queue.hasPending()).toBe(true);
    expect(settled).toBe(false);
    first.resolve({ok:true});
    const result=await waiting;
    expect(result).toEqual({ok:true,state:SAVE_QUEUE_STATE.IDLE});
    expect(queue.hasPending()).toBe(false);
  });

  it("só resolve a espera depois de drenar o snapshot mais recente", async()=>{
    const first=deferred();const calls=[];
    const queue=createSaveQueue({save:async snapshot=>{
      calls.push(snapshot);
      return calls.length===1?first.promise:{ok:true};
    }});
    queue.enqueue({eventos:["primeiro"]});
    queue.enqueue({eventos:["primeiro","segundo"]});
    const waiting=queue.waitForIdle();
    first.resolve({ok:true});
    const result=await waiting;
    expect(result.ok).toBe(true);
    expect(calls).toEqual([{eventos:["primeiro"]},{eventos:["primeiro","segundo"]}]);
    expect(queue.hasPending()).toBe(false);
  });
});
