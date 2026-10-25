import {describe,it,expect,vi} from 'vitest';
import {criarProtecaoPin} from './pin.js';
describe('proteção de PIN persiste sem gravar credencial',()=>{
  it('reabrir e recriar o controlador mantém bloqueio e não reexecuta conferência',async()=>{
    let value=null,now=100000;const store={ler:async()=>value,gravar:async v=>{value=v;},agora:()=>now};
    for(let i=0;i<5;i++)await criarProtecaoPin(store).tentar(()=>null);
    const confer=vi.fn(()=>({userId:'u'}));
    expect(await criarProtecaoPin(store).tentar(confer)).toEqual({ok:false,esperaMs:30000});expect(confer).not.toHaveBeenCalled();
    now+=30000;expect(await criarProtecaoPin(store).tentar(()=>null)).toEqual({ok:false,esperaMs:60000});
    now+=60000;expect(await criarProtecaoPin(store).tentar(confer)).toMatchObject({ok:true,responsavel:{userId:'u'}});expect(JSON.parse(value)).toEqual({erros:0,bloqueadoAte:0});
  });
  it('registra tentativa antes da derivação e falha fechado se armazenamento falhar',async()=>{
    const calls=[],protection=criarProtecaoPin({ler:async()=>null,gravar:async value=>calls.push(JSON.parse(value)),agora:()=>100});
    await protection.tentar(()=>{expect(calls).toEqual([{erros:1,bloqueadoAte:100}]);return null;});
    const verify=vi.fn();await expect(criarProtecaoPin({ler:async()=>null,gravar:async()=>{throw Error('disco');}}).tentar(verify)).rejects.toThrow('disco');expect(verify).not.toHaveBeenCalled();
  });
});
