import {it,expect,vi,afterEach} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();vi.resetModules();});
it('renovar sessão mantém o operador e recusa trocar de conta durante a edição',async()=>{
 sessionStorage.setItem('arcd_auth_session',JSON.stringify({userId:'same',accessToken:'expired'}));vi.resetModules();
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data:{},usuario:{id:'other'},accessToken:'different-token'}),{status:200,headers:{'content-type':'application/json'}})).mockResolvedValueOnce(new Response(JSON.stringify({data:{},usuario:{id:'same'},accessToken:'renewed-token',refreshToken:'renewed-refresh'}),{status:200,headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',fetch);
 const {renewEditingSession}=await import('./api.js');
 expect(await renewEditingSession({email:'same@local.test',password:'local-test',userId:'same'})).toMatchObject({ok:false});expect(JSON.parse(sessionStorage.getItem('arcd_auth_session')).accessToken).toBe('expired');
 expect(await renewEditingSession({email:'same@local.test',password:'local-test',userId:'same'})).toMatchObject({ok:true});expect(JSON.parse(sessionStorage.getItem('arcd_auth_session')).userId).toBe('same');expect(JSON.parse(sessionStorage.getItem('arcd_auth_session')).accessToken).toBe('renewed-token');
});
