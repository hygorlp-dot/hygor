import Dexie from 'dexie';
import {indexedDB,IDBKeyRange} from 'fake-indexeddb';
import {it,expect,afterEach} from 'vitest';
import {createSnapshotJournal,expandSnapshot,canRecoverSnapshot} from './snapshot-journal.js';
import {reviewSnapshot} from './snapshot-merge.js';
import {createSaveQueue} from './save-queue.js';
Dexie.dependencies.indexedDB=indexedDB;Dexie.dependencies.IDBKeyRange=IDBKeyRange;
const stores=[];const store=()=>{const s=createSnapshotJournal('recovery-'+crypto.randomUUID());stores.push(s);return s;};
afterEach(async()=>{await Promise.all(stores.splice(0).map(s=>s.db.delete()));});
const user={id:'a',role:'admin'},tab='one';
it('protege só a intenção, isola contas e não apaga revisão mais nova',async()=>{
 const s=store(),base={eventosEmpresa:[],obras:[{id:'o'}],attendance:{x:1}},intended={...base,eventosEmpresa:[{id:'e',titulo:'Primeiro'}],attendance:{x:2}};
 const old=await s.protect({user,tab,base,intended});
 const latest=await s.protect({user,tab,base,intended:{...intended,eventosEmpresa:[{id:'e',titulo:'Segundo'}]}});
 expect(await s.read('other',tab)).toBeUndefined();await s.release(old);
 const row=await s.read(user.id,tab);expect(Object.keys(row.changes)).toEqual(['eventosEmpresa']);
 const expanded=expandSnapshot(row.changes,base);expect(expanded.intended.eventosEmpresa[0].titulo).toBe('Segundo');
 await s.release(latest);expect(await s.read(user.id,tab)).toBeUndefined();
});
it('bloqueia recuperação com escopo alterado ou registro transferido',async()=>{
 const s=store(),scoped={...user,obraId:'a'},base={pedidos:[{id:'p',obraId:'a',nome:'Antes'}]};
 await s.protect({user:scoped,tab,base,intended:{pedidos:[{...base.pedidos[0],nome:'Depois'}]}});
 const row=await s.read(user.id,tab);
 expect(canRecoverSnapshot(row,scoped,base)).toBe(true);
 expect(canRecoverSnapshot(row,{...scoped,role:'financeiro'},base)).toBe(false);
 expect(canRecoverSnapshot(row,scoped,{pedidos:[{id:'p',obraId:'b'}]})).toBe(false);
});
it('conflitos exigem escolha e preservam campo independente e exclusão concorrente',()=>{
 const base={items:[{id:1,nome:'A',valor:1}]},intended={items:[{id:1,nome:'B',valor:1}]},current={items:[{id:1,nome:'C',valor:2}]};
 let r=reviewSnapshot(base,intended,current);expect(r.ready).toBe(false);expect(r.conflicts[0].path).toEqual(['items','1','nome']);
 r=reviewSnapshot(base,intended,current,{[r.conflicts[0].key]:'local'});expect(r.ready).toBe(true);expect(r.merged.items[0]).toEqual({id:1,nome:'B',valor:2});
 expect(reviewSnapshot(base,intended,{items:[]}).ready).toBe(false);
});
it('falha do armazenamento impede API e a retomada protege novamente',async()=>{
 let blocked=true,calls=0;const q=createSaveQueue({protect:async()=>{if(blocked)throw Error('quota');return 'saved';},save:async()=>{calls++;return {ok:true};}});
 expect((await q.enqueue({id:'e'})).ok).toBe(false);expect(calls).toBe(0);expect(q.hasPending()).toBe(true);
 blocked=false;q.resume();expect((await q.waitForIdle()).ok).toBe(true);expect(calls).toBe(1);
});
it('confirmar snapshot em voo não apaga a edição seguinte protegida',async()=>{
 const s=store(),base={items:[]};let resolve;const response=new Promise(r=>resolve=r);let calls=0;
 const q=createSaveQueue({protect:intended=>s.protect({user,tab,base,intended}),release:s.release,save:async()=>++calls===1?response:{ok:false,status:401}});
 q.enqueue({items:[{id:'one'}]});await new Promise(r=>setTimeout(r,5));q.enqueue({items:[{id:'one'},{id:'two'}]});
 await new Promise(r=>setTimeout(r,5));resolve({ok:true});await q.waitForIdle();
 const row=await s.read(user.id,tab);expect(row.changes.items.delta.changed).toHaveLength(2);
});
it('não protege credenciais',async()=>{const s=store();await expect(s.protect({user,tab,base:{},intended:{config:{password:'secret'}}})).rejects.toThrow('credenciais');expect(await s.read(user.id,tab)).toBeUndefined();});

it('outra instância não sobrescreve uma revisão ainda não consultada',async()=>{
 const a=store(),b=createSnapshotJournal(a.db.name);stores.push(b);
 const base={items:[]};await a.protect({user,tab,base,intended:{items:[{id:'one'}]}});
 await expect(b.protect({user,tab,base,intended:{items:[{id:'two'}]}})).rejects.toThrow('Outra aba');
 const previous=await b.read(user.id,tab);b.adopt(previous);
 await a.protect({user,tab,base,intended:{items:[{id:'new'}]}});
 await expect(b.protect({user,tab,base,intended:{items:[{id:'two'}]}})).rejects.toThrow('Outra aba');
 expect((await a.read(user.id,tab)).changes.items.delta.changed[0].id).toBe('new');
});
it('falha ao limpar diário não repete uma confirmação recebida',async()=>{
 let calls=0,warnings=0;const q=createSaveQueue({protect:async()=>({revision:'one'}),release:async()=>{throw Error('storage');},onStorageError:()=>warnings++,save:async()=>{calls++;return{ok:true};}});
 expect((await q.enqueue({id:'saved'})).ok).toBe(true);q.resume();expect(calls).toBe(1);expect(warnings).toBe(1);expect(q.hasPending()).toBe(false);
});
it('pode manter servidor num campo e conservar outra edição independente',()=>{
 const base={config:{nome:'A',prazo:1}},mine={config:{nome:'B',prazo:2}},current={config:{nome:'C',prazo:1}};
 const first=reviewSnapshot(base,mine,current);expect(first.changes).toHaveLength(2);
 const result=reviewSnapshot(base,mine,current,{[first.conflicts[0].key]:'current'});
 expect(result.ready).toBe(true);expect(result.merged.config).toEqual({nome:'C',prazo:2});
});

it('criação com mesmo ID alterada no servidor exige escolha, não substituição silenciosa',async()=>{
 const s=store(),base={items:[]},intended={items:[{id:'one',nome:'Meu cadastro'}]},current={items:[{id:'one',nome:'Cadastro atualizado por outra pessoa'}]};
 await s.protect({user,tab,base,intended});const row=await s.read(user.id,tab),expanded=expandSnapshot(row.changes,current);
 expect(reviewSnapshot(expanded.base,expanded.intended,current).ready).toBe(false);
});
it('encontra edição própria ao abrir outra aba, sem expor outra conta',async()=>{
 const s=store();await s.protect({user,tab,base:{items:[]},intended:{items:[{id:'one'}]}});
 expect((await s.readLatest(user.id,'nova-aba')).tab).toBe(tab);expect(await s.readLatest('other','nova-aba')).toBeUndefined();
});

it('captura conta e base antes de aguardar o armazenamento',async()=>{
 let owner='a';const protectedOwners=[];
 const queue=createSaveQueue({capture:()=>({owner}),protect:async(_,context)=>{protectedOwners.push(context.owner);},save:async()=>({ok:true})});
 const result=queue.enqueue({id:'saved'});owner='b';await result;expect(protectedOwners).toEqual(['a']);
});
