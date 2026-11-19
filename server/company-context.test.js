import {afterEach,expect,it,vi} from 'vitest';
import {assertCompanyReady,currentCompany,requestedCompany,runWithCompany,withCompanyContext} from './company-context.js';
afterEach(()=>vi.unstubAllEnvs());
it('isola requisições concorrentes sem alterar a empresa global',async()=>{
  vi.stubEnv('COMPANY_ISOLATION_ENABLED','true');
  const values=await Promise.all(['mrc','arcd'].map(company=>runWithCompany(company,async()=>{
    await new Promise(resolve=>setTimeout(resolve,company==='mrc'?15:1));
    return currentCompany();
  })));
  expect(values).toEqual(['mrc','arcd']);expect(currentCompany()).toBe('arcd');
});
it('recusa empresa desconhecida, parâmetros divergentes e mudança antes de ativar',()=>{
  vi.stubEnv('COMPANY_ISOLATION_ENABLED','false');
  expect(()=>requestedCompany({body:{companyId:'mrc'}})).toThrow('ainda não foi ativada');
  vi.stubEnv('COMPANY_ISOLATION_ENABLED','true');
  for(const value of ['outra',['mrc'],{},null])expect(()=>requestedCompany({body:{companyId:value}})).toThrow('Empresa inválida');
  expect(()=>requestedCompany({body:{companyId:'mrc'},query:{companyId:'arcd'}})).toThrow('divergente');
});
it('exige certificado verificado da própria empresa, inclusive em falha de leitura',async()=>{
  let row={value:{version:1,status:'verified',companyId:'mrc'}};
  const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:row})};
  const db={from:()=>query};
  await expect(assertCompanyReady('mrc',db)).resolves.toEqual(row.value);
  await expect(assertCompanyReady('arcd',db)).rejects.toMatchObject({status:503});
  row=null;await expect(assertCompanyReady('mrc',db)).rejects.toMatchObject({code:'COMPANY_NOT_READY'});
});
it('leva a empresa até o handler sem permitir cache da resposta',async()=>{
  vi.stubEnv('COMPANY_ISOLATION_ENABLED','true');
  const headers={},res={setHeader:(key,value)=>headers[key]=value,status(){return this;},json:value=>value};
  const handler=withCompanyContext(async(_req,response)=>response.json({usuario:{role:'admin'},data:{company:currentCompany()}}),{readiness:false});
  const result=await handler({body:{companyId:'mrc'}},res);
  expect(result).toMatchObject({companyId:'mrc',companyIsolationEnabled:true,data:{company:'mrc'}});
  expect(headers['Cache-Control']).toBe('no-store');expect(headers['X-MRC-Company']).toBe('mrc');
});
