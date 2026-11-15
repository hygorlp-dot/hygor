import {expect,it,vi} from 'vitest';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {createReviewMicrosoftToken,readOnlyDatabaseFetch,readOnlyOneDriveFetch} from './client-portal-real-source.mjs';
it('permite autenticação Microsoft local, mantendo gravações no Graph e banco bloqueadas',async()=>{
 const fetchImpl=vi.fn(async()=>new Response('{}')),request=readOnlyOneDriveFetch(fetchImpl);
 await request('https://login.microsoftonline.com/common/oauth2/v2.0/token',{method:'POST',body:new URLSearchParams({grant_type:'authorization_code'})});
 for(const url of ['https://graph.microsoft.com/v1.0/me/drive/items','https://db.example.test/rest/v1/company_app_data'])expect(()=>request(url,{method:'POST'})).toThrow('Gravação');
 expect(()=>request('https://login.microsoftonline.com/common/oauth2/v2.0/token',{method:'POST',body:new URLSearchParams({grant_type:'client_credentials'})})).toThrow('Gravação');
 expect(fetchImpl).toHaveBeenCalledTimes(1);
 await request('https://graph.microsoft.com/v1.0/drives/drive/items/item/content',{method:'GET',redirect:'manual'});
 expect(fetchImpl.mock.calls[1][1].redirect).toBe('manual');
 await request('https://graph.microsoft.com/v1.0/me/drive',{method:'GET',redirect:'follow'});
 expect(fetchImpl.mock.calls[2][1].redirect).toBe('error');
});
it('bloqueia gravações na origem antes de qualquer tráfego',async()=>{
 const fetchImpl=vi.fn(async()=>new Response('{}'));
 const request=readOnlyDatabaseFetch(fetchImpl);
 for(const method of ['POST','PUT','PATCH','DELETE'])expect(()=>request('https://db.example.test/rest/v1/company_app_data',{method})).toThrow('Gravação na origem real bloqueada.');
 expect(fetchImpl).not.toHaveBeenCalled();await request('https://db.example.test/rest/v1/company_app_data');expect(fetchImpl).toHaveBeenCalledTimes(1);
});
it('renova apenas em memória sem persistir sessão nem enviar a credencial para outro destino',async()=>{
 const secret='segredo-exclusivo-do-teste',iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update(secret).digest(),iv);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({refreshToken:'refresh-teste'})),cipher.final()]);
 const sealed=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
 const db={from:vi.fn(()=>db),select:vi.fn(()=>db),eq:vi.fn(()=>db),maybeSingle:vi.fn(async()=>({data:{value:{sealed}}}))};
 const fetchImpl=vi.fn(async()=>new Response(JSON.stringify({access_token:'token-teste',refresh_token:'novo-refresh-nao-persistido',expires_in:3600})));
 const token=createReviewMicrosoftToken({remote:db,env:{MICROSOFT_CLIENT_ID:'cliente-teste',MICROSOFT_CLIENT_SECRET:secret},fetchImpl});
 expect(await token()).toBe('token-teste');expect(await token()).toBe('token-teste');
 expect(fetchImpl).toHaveBeenCalledTimes(1);expect(fetchImpl.mock.calls[0][0]).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
 expect(db.maybeSingle).toHaveBeenCalledTimes(1);expect(Object.keys(db)).not.toContain('update');expect(Object.keys(db)).not.toContain('upsert');
});
