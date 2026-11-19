import {afterEach,expect,it,vi} from 'vitest';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();vi.resetModules();});
const successful={companyId:'mrc',companyIsolationEnabled:true,usuario:{id:'admin',role:'admin'},data:{obras:[{id:'k'}]},updatedAt:'mrc-v1'};
it('só adota a empresa após acesso confirmado e rejeita resposta tardia anterior',async()=>{
  let resolveOld;
  const old=new Promise(resolve=>resolveOld=resolve);
  const fetch=vi.fn((_,options)=>JSON.parse(options.body).companyId==='mrc'?response(successful):old);
  vi.stubGlobal('fetch',fetch);
  const api=await import('./api.js'),scope=await import('./lib/company-scope.js');api.abrirSessao('admin','1234');
  const reading=api.readRecoveryData();expect(await api.trocarEmpresa('mrc')).toEqual({ok:true,companyId:'mrc'});
  resolveOld(response({data:{secret:'ARCD'},updatedAt:'arcd-v1'}));
  expect(await reading).toMatchObject({ok:false,status:0});expect(scope.activeCompany()).toBe('mrc');
  await api.readRecoveryData();expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toMatchObject({companyId:'mrc',userId:'admin',pin:'1234'});
});
it('recusa acesso negado ou resposta de outra empresa conservando a origem',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(response({error:'Sem acesso'},403)).mockResolvedValueOnce(response({...successful,companyId:'arcd'})));
  const api=await import('./api.js'),scope=await import('./lib/company-scope.js');api.abrirSessao('admin','1234');
  expect((await api.trocarEmpresa('mrc')).ok).toBe(false);expect(scope.activeCompany()).toBe('arcd');
  expect((await api.trocarEmpresa('mrc')).ok).toBe(false);expect(scope.activeCompany()).toBe('arcd');
});
