// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {enviarUdpViaVercel,NTP_BRIDGE_URL} from './ntp-vercel.js';
import {montarPedidoNtp,consultarNtp} from './ntp.js';
import {criarPonteNtp} from '../../../scripts/homologacao/time-function.mjs';

const start=Date.parse('2026-10-25T12:00:00Z'),server='a.st1.ntp.br',challenge='00000000-0000-4000-8000-000000000001';
const body=()=>({ambiente:'homologacao',servidor:server,nonce:challenge,pacote:montarPedidoNtp(start).toString('base64')});
function responsePacket(){
  const packet=Buffer.alloc(48);packet[0]=36;packet[1]=1;
  montarPedidoNtp(start).copy(packet,24,40,48);
  montarPedidoNtp(start+900).copy(packet,32,40,48);
  montarPedidoNtp(start+1100).copy(packet,40,40,48);
  return packet;
}
async function call(fn,payload=body(),method='POST'){
  const result={status:200,headers:{}};
  const res={setHeader(k,v){result.headers[k]=v;},status(v){result.status=v;return res;},json(v){result.body=v;return v;}};
  await fn({method,body:payload},res);return result;
}
it('ponte só transporta os bytes; o relógio Edge mede offset e incerteza incluindo HTTPS',async()=>{
  const udp=vi.fn().mockResolvedValue(responsePacket()),fn=criarPonteNtp({enviarUdp:udp});
  const request=vi.fn(async(url,options)=>{
    expect(url).toBe(NTP_BRIDGE_URL);expect(options.redirect).toBe('error');
    const result=await call(fn,JSON.parse(options.body));
    return {ok:result.status===200,json:async()=>result.body};
  });
  const times=[start,start+1200];
  const result=await consultarNtp({servidor:server,relogio:()=>times.shift(),enviarUdp:enviarUdpViaVercel({request,nonce:()=>challenge})});
  expect(result.offsetMs).toBeCloseTo(400,2);expect(result.incertezaMs).toBeCloseTo(500,2);
  expect(result.verificadoEm).toBe('2026-10-25T12:00:01.200Z');expect(udp.mock.calls[0][0]).toMatchObject({host:server,porta:123,timeoutMs:1500});
});
it.each([{servidor:'127.0.0.1'},{nonce:'short'},{ambiente:'producao'},{pacote:'x'.repeat(1000)},
  {pacote:Buffer.alloc(48,1).toString('base64')}])('recusa destino e pacote não autorizados %#',async patch=>{
  const udp=vi.fn(),result=await call(criarPonteNtp({enviarUdp:udp}),{...body(),...patch});
  expect(result.status).toBe(400);expect(udp).not.toHaveBeenCalled();
});
it('falha UDP mantém hora não verificada e não devolve relógio local como sucesso',async()=>{
  const fn=criarPonteNtp({enviarUdp:async()=>{throw Error('native UDP unavailable');}});
  const result=await call(fn);expect(result.status).toBe(503);expect(result.body.ok).toBe(false);
  expect(result.body).not.toHaveProperty('serverTime');expect(result.headers['Cache-Control']).toBe('no-store');
  expect((await call(fn,body(),'GET')).status).toBe(405);
});
it('resposta repetida com nonce diferente e redirecionamentos nunca viram evidência',async()=>{
  const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({...body(),ok:true,nonce:'different-challenge',pacote:responsePacket().toString('base64')})});
  const send=enviarUdpViaVercel({request,nonce:()=>challenge});
  await expect(send({host:server,porta:123,pacote:montarPedidoNtp(start)})).rejects.toThrow('Resposta da ponte');
  await expect(send({host:'attacker.invalid',porta:123,pacote:montarPedidoNtp(start)})).rejects.toThrow('Destino NTP');
});
