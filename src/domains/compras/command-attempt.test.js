import {it,expect,vi} from 'vitest';
import {dispatchConfirmedAttempt} from '../../features/workflow/command-attempt.js';
it('reenvia o mesmo comando após resposta perdida, mesmo com nova versão no cliente',async()=>{
 const attempt={},build=vi.fn(data=>({idempotencyKey:'fixed',expectedVersion:data.version,payload:{paymentId:'p',stockEntries:[{id:'s'}]}}));let version=2;
 const dispatch=vi.fn(async factory=>{const command=factory({version});if(version===2){version=3;return {ok:false,status:503};}return {ok:true,command};});
 await dispatchConfirmedAttempt(attempt,dispatch,build);const original=attempt.command;
 const result=await dispatchConfirmedAttempt(attempt,dispatch,build);expect(result.command).toBe(original);expect(result.command.expectedVersion).toBe(2);expect(build).toHaveBeenCalledTimes(1);expect(attempt.command).toBeUndefined();
});
it('rejeição definitiva libera correção; erro de rede mantém o comando',async()=>{
 const attempt={},build=()=>({idempotencyKey:'fixed'});
 await dispatchConfirmedAttempt(attempt,async f=>{f({});return {ok:false,status:403};},build);expect(attempt.command).toBeUndefined();
 await dispatchConfirmedAttempt(attempt,async f=>{f({});throw Error('offline');},build);expect(attempt.command).toBeDefined();
});
it('ignora confirmação concorrente enquanto há envio',async()=>{
 let done;const attempt={},dispatch=vi.fn(f=>{f({});return new Promise(resolve=>{done=resolve;});});const first=dispatchConfirmedAttempt(attempt,dispatch,()=>({idempotencyKey:'one'}));expect(await dispatchConfirmedAttempt(attempt,dispatch,()=>({}))).toMatchObject({ok:false});expect(dispatch).toHaveBeenCalledTimes(1);done({ok:true});await first;
});
