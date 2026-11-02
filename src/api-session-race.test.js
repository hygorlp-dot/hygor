import {it,expect,vi,afterEach} from 'vitest';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:value=>resolve(value)};};
const loginBody={usuario:{id:'b'},data:{},accessToken:'token-b',refreshToken:'refresh-b'};
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();vi.resetModules();});
function previous(){sessionStorage.setItem('arcd_auth_session',JSON.stringify({userId:'a',accessToken:'expired-a',refreshToken:'refresh-a'}));vi.resetModules();}
it('resposta antiga não é aplicada depois de trocar de conta',async()=>{
 previous();const old=deferred();vi.stubGlobal('fetch',vi.fn((_,options)=>JSON.parse(options.body).action==='auth-login'?response(loginBody):old.promise));
 const api=await import('./api.js');const reading=api.readRecoveryData();await api.entrarComEmail('b@local.test','local');old.resolve(response({data:{secret:'old'},updatedAt:'old'}));
 expect(await reading).toMatchObject({ok:false,status:0});expect(JSON.parse(sessionStorage.getItem('arcd_auth_session')).userId).toBe('b');
});
it('renovação tardia não substitui credenciais da nova conta',async()=>{
 previous();const old=deferred();vi.stubGlobal('fetch',vi.fn((_,options)=>JSON.parse(options.body).action==='auth-login'?response(loginBody):old.promise));
 const api=await import('./api.js');const restoring=api.restaurarSessaoEmail();await api.entrarComEmail('b@local.test','local');old.resolve(response({accessToken:'renewed-a',refreshToken:'renewed-refresh-a'}));
 await restoring;expect(JSON.parse(sessionStorage.getItem('arcd_auth_session')).accessToken).toBe('token-b');
});
it('401 antigo não renova nem reenvia sob a nova conta',async()=>{
 previous();const old=deferred();const fetch=vi.fn((_,options)=>{const action=JSON.parse(options.body).action;if(action==='auth-login')return response(loginBody);if(action==='auth-refresh')return response({error:'invalido'},401);return old.promise;});vi.stubGlobal('fetch',fetch);
 const api=await import('./api.js');const reading=api.readRecoveryData();await api.entrarComEmail('b@local.test','local');old.resolve(response({error:'Sessão antiga'},401));
 expect(await reading).toMatchObject({ok:false,status:0});expect(fetch).toHaveBeenCalledTimes(2);
});
