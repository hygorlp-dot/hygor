import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaveQueue } from './domains/sync/save-queue.js';

beforeEach(()=>{vi.resetModules();vi.unstubAllGlobals();sessionStorage.clear();});
const response = body => ({ok:true,status:200,json:async()=>body});
describe('confirmação de gravações e respostas externas',()=>{
  it.each([{}, {ok:false,error:'Não foi gravado'}])('não afirma salvamento sem confirmação explícita (%j)',async body=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response(body)));
    const api=await import('./api.js');api.abrirSessao('u','123');
    expect(await api.saveDataDetailed({obras:[]})).toMatchObject({ok:false});
  });
  it('rejeita corpo ilegível em rota autenticada',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('HTML em vez de JSON');}})));
    const api=await import('./api.js');api.abrirSessao('u','123');
    expect(await api.chamarPontoEletronico('ponto-equipe-obras')).toMatchObject({ok:false,status:502});
  });
  it.each([null, [], 'texto'])('rejeita corpo de formato inválido no upload (%j)',async body=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response(body)));
    const api=await import('./api.js');api.abrirSessao('u','123');
    expect(await api.enviarArquivoOneDrive({dataUrl:'local'})).toMatchObject({ok:false,status:502});
  });
  it('mantém gravação confirmada e a versão recebida',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response({ok:true,updatedAt:'2026-10-31T12:00:00Z'})));
    const api=await import('./api.js');api.abrirSessao('u','123');
    expect(await api.saveDataDetailed({obras:[]})).toMatchObject({ok:true,updatedAt:'2026-10-31T12:00:00Z'});
  });
  it.each(['save','save-sections'])('repete %s com o mesmo conteúdo e identidade após perder a resposta',async action=>{
    const fetch=vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockImplementation(async()=>response({ok:true,updatedAt:'2026-11-02T12:00:00Z'}));
    vi.stubGlobal('fetch',fetch);
    const api=await import('./api.js');
    api.abrirSessao('u','123');
    api.adoptServerVersion('2026-11-01T12:00:00Z');
    const scheduled=[];
    let base=action==='save'?null:{obras:[{id:'a',name:'Original'}]};
    const queue=createSaveQueue({
      save:(target,entry)=>api.saveDataDetailed(target,base,entry),
      schedule:fn=>scheduled.push(fn),
    });
    const target={obras:[{id:'a',name:'Nova'}]};
    const first=queue.enqueue(target);
    await vi.waitFor(()=>expect(scheduled).toHaveLength(1));
    api.adoptServerVersion('2026-11-02T12:00:00Z');
    base={obras:[{id:'a',name:'Mais recente'}]};
    scheduled[0]();
    expect(await first).toMatchObject({ok:true});
    const body=index=>JSON.parse(fetch.mock.calls[index][1].body);
    expect(body(0)).toMatchObject({action,operationId:expect.any(String),expectedUpdatedAt:'2026-11-01T12:00:00Z'});
    expect(body(1)).toEqual(body(0));
    expect(await queue.enqueue(target)).toMatchObject({ok:true});
    expect(body(2).operationId).not.toBe(body(0).operationId);
  });
  it.each([{}, {ok:true}, {ok:true,url:'/arquivo-sem-identificacao'}])('não confirma foto sem identificar o arquivo (%j)',async body=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response(body)));
    const api=await import('./api.js');api.abrirSessao('u','123');
    expect(await api.enviarArquivoOneDrive({dataUrl:'local'})).toMatchObject({ok:false});
  });
  it('preserva confirmação completa do upload',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response({ok:true,url:'/arquivo',item:{id:'photo'}})));
    const api=await import('./api.js');api.abrirSessao('u','123');
    expect(await api.enviarArquivoOneDrive({dataUrl:'local'})).toMatchObject({ok:true,url:'/arquivo',item:{id:'photo'}});
  });
});
