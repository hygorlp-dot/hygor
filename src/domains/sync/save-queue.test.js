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
    queue.enqueue({id:"a"});await Promise.resolve();
    expect(queue.getState()).toBe(SAVE_QUEUE_STATE.CONFLICT);expect(queue.hasPending()).toBe(true);
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
});
