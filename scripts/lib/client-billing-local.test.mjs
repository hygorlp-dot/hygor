// @vitest-environment node
import {it,expect} from 'vitest';
import {privateBridge} from './client-billing-local.mjs';
it.skipIf(process.platform!=='win32')('cifra a senha com DPAPI e devolve o original sem gravar configuração real',async()=>{
 const password=Buffer.from('senha-ficticia-validacao-local-!á');const encrypted=await privateBridge('protect',password);
 expect(encrypted.includes(password)).toBe(false);expect(encrypted.length).toBeGreaterThan(password.length);
 expect(await privateBridge('unprotect',encrypted)).toEqual(password);
 const changed=Buffer.from(encrypted);changed[changed.length-1]^=1;
 await expect(privateBridge('unprotect',changed)).rejects.toThrow('privada');
});
