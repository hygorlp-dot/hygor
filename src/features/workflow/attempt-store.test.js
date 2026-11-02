import Dexie from 'dexie';
import {indexedDB,IDBKeyRange} from 'fake-indexeddb';
import {it,expect,afterEach} from 'vitest';
import {createAttemptStore} from './attempt-store.js';
import {dispatchConfirmedAttempt} from './command-attempt.js';
Dexie.dependencies.indexedDB=indexedDB;Dexie.dependencies.IDBKeyRange=IDBKeyRange;
const stores=[];const store=name=>{const s=createAttemptStore(name);stores.push(s);return s;};afterEach(async()=>{for(const s of stores.splice(0)){s.db.close();await s.db.delete();}});
const cmd={type:'PAGAMENTO_OBRIGACAO_REGISTRADO',idempotencyKey:'payment-durable-0001',actorId:'u',expectedVersion:2,payload:{targetType:'pedido',targetId:'p',payment:{id:'pg',valor:100}}};
it('persiste antes do envio, reabre a mesma identidade após recarga e isola usuários',async()=>{
 const name=`recovery-${crypto.randomUUID()}`,s=store(name),attempt={owner:'u',store:s};let sent;await s.draft('u','pedido','p',{valor:'100'});
 await dispatchConfirmedAttempt(attempt,async factory=>{sent=await factory({});expect((await s.pending('u'))[0].command).toEqual(sent);return {ok:false,status:503};},()=>cmd);
 s.db.close();const reopened=store(name);expect((await reopened.pending('u'))[0].command).toEqual(cmd);expect(await reopened.pending('other')).toEqual([]);
 await dispatchConfirmedAttempt({owner:'u',command:(await reopened.pending('u'))[0].command,store:reopened},async f=>{expect(await f({})).toEqual(cmd);return {ok:true};},()=>{throw Error('must not build again');});expect(await reopened.pending('u')).toEqual([]);expect(await reopened.draft('u','pedido','p')).toBeUndefined();
});
it('impede duas operações ambíguas no mesmo documento e não envia sem proteção local',async()=>{
 const s=store(`conflict-${crypto.randomUUID()}`);await s.protect('u',cmd);
 let notified=false;const notify=()=>{notified=true;};window.addEventListener('marcell-confirmations',notify);
 await expect(s.protect('u',{...cmd,type:'ADIANTAMENTO_PEDIDO_ALOCADO',idempotencyKey:'other-operation'})).rejects.toThrow('Já existe');expect(notified).toBe(true);window.removeEventListener('marcell-confirmations',notify);
 let sent=false;const result=await dispatchConfirmedAttempt({owner:'u',store:{protect:async()=>{throw Error('blocked');}}},async f=>{await f({});sent=true;return {ok:true};},()=>cmd);expect(sent).toBe(false);expect(result).toMatchObject({ok:false,status:400});
});
it('recupera e apaga rascunhos por usuário e registro',async()=>{
 const s=store(`draft-${crypto.randomUUID()}`);await s.draft('u','nota','n',{valor:'12.34'});expect(await s.draft('u','nota','n')).toEqual({valor:'12.34'});expect(await s.draft('v','nota','n')).toBeUndefined();await s.draft('u','nota','n',null);expect(await s.draft('u','nota','n')).toBeUndefined();
});

it('serializa confirmações concorrentes de duas conexões no mesmo registro',async()=>{const name=`tabs-${crypto.randomUUID()}`,a=store(name),b=store(name);const results=await Promise.allSettled([a.protect('u',cmd),b.protect('u',{...cmd,idempotencyKey:'second-tab-command'})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);expect(await a.pending('u')).toHaveLength(1);a.db.close();b.db.close();});

it('preserva confirmação incerta após perda de acesso e reutiliza a identidade quando regularizado',async()=>{const s=store(`auth-${crypto.randomUUID()}`),attempt={owner:'u',store:s};for(const status of [503,403,401]){await dispatchConfirmedAttempt(attempt,async f=>{expect(await f({})).toEqual(cmd);return {ok:false,status};},()=>cmd);expect((await s.pending('u'))[0].command).toEqual(cmd);}await dispatchConfirmedAttempt(attempt,async f=>{expect(await f({})).toEqual(cmd);return {ok:true};},()=>{throw Error('new command');});expect(await s.pending('u')).toEqual([]);});

it('separa nota e pedido com o mesmo identificador sem confundir confirmações',async()=>{const s=store(`types-${crypto.randomUUID()}`);await s.protect('u',cmd);const note={...cmd,idempotencyKey:'note-same-id',payload:{...cmd.payload,targetType:'nota'}};await s.protect('u',note);expect(await s.pending('u')).toHaveLength(2);});
it('mantém o comando em memória quando a proteção local falha durante uma retomada',async()=>{const s=store(`blocked-retry-${crypto.randomUUID()}`),attempt={owner:'u',store:s};await dispatchConfirmedAttempt(attempt,async f=>{await f({});return {ok:false,status:503};},()=>cmd);attempt.store={protect:async()=>{throw Error('storage unavailable');}};let sent=false;await dispatchConfirmedAttempt(attempt,async f=>{await f({});sent=true;},()=>{throw Error('must reuse');});expect(sent).toBe(false);expect(attempt.command).toEqual(cmd);attempt.store=s;const result=await dispatchConfirmedAttempt(attempt,async f=>{expect(await f({})).toEqual(cmd);return {ok:true};},()=>{throw Error('must reuse');});expect(result.ok).toBe(true);});
it('retoma o formato anterior sem duplicar nem apagar sua confirmação',async()=>{const s=store(`legacy-key-${crypto.randomUUID()}`),key=JSON.stringify(['pending','u','financial','p']);await s.db.table('operations').put({key,owner:'u',kind:'pending',command:cmd});expect(await s.protect('u',cmd)).toBe(key);await expect(s.protect('u',{...cmd,idempotencyKey:'different'})).rejects.toThrow('Já existe');await s.resolve(key,true);expect(await s.pending('u')).toHaveLength(0);});

it('trata identificadores numéricos e de texto do mesmo registro como uma única confirmação',async()=>{const s=store(`numeric-${crypto.randomUUID()}`),number={...cmd,payload:{...cmd.payload,targetId:1}};await s.protect('u',number);await expect(s.protect('u',{...number,idempotencyKey:'different',payload:{...number.payload,targetId:'1'}})).rejects.toThrow('Já existe');expect(await s.pending('u')).toHaveLength(1);});

it('preserva registros da versão anterior e impede que o cliente antigo continue gravando',async()=>{const name=`version-${crypto.randomUUID()}`,legacy=new Dexie(name);legacy.version(1).stores({records:'&key,owner,kind'});await legacy.table('records').put({key:JSON.stringify(['pending','u','financial','p']),owner:'u',kind:'pending',command:cmd});legacy.close();const current=store(name);expect((await current.pending('u'))[0].command).toEqual(cmd);await legacy.open();await expect(legacy.table('records').put({key:'old-write',owner:'u',kind:'pending',command:cmd})).rejects.toMatchObject({name:'DataError'});legacy.close();expect(await current.pending('u')).toHaveLength(1);});

it('desfaz toda a atualização se a cópia dos registros falhar',async()=>{const name=`rollback-${crypto.randomUUID()}`,legacy=new Dexie(name);legacy.version(1).stores({records:'&key,owner,kind'});await legacy.table('records').put({key:'original',owner:'u',kind:'pending',command:cmd});legacy.close();const current=store(name);current.db.table('operations').hook('creating',()=>{throw Error('copy blocked');});await expect(current.pending('u')).rejects.toThrow('copy blocked');current.db.close();await legacy.open();expect((await legacy.table('records').get('original')).command).toEqual(cmd);legacy.close();});
