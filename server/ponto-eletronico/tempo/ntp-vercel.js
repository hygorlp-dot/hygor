import {SERVIDORES_HLB} from './ntp.js';

export const NTP_BRIDGE_URL='https://ponto-homologacao.vercel.app/api/homologacao-time';

// Only transports SNTP bytes. t0/t3 stay on the Edge host and the canonical
// NTP parser includes BOTH HTTPS legs in offset and uncertainty. The bridge's
// wall clock never becomes the Edge clock's evidence.
export function enviarUdpViaVercel({request=globalThis.fetch,nonce=()=>globalThis.crypto.randomUUID()}={}){
  return async({host,porta,pacote,timeoutMs})=>{
    if(!SERVIDORES_HLB.includes(host)||porta!==123||pacote.length!==48)throw Error('Destino NTP não autorizado.');
    const challenge=nonce();
    const response=await request(NTP_BRIDGE_URL,{
      method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(Math.min(Math.max(timeoutMs||3000,1000),6000)),
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ambiente:'homologacao',servidor:host,nonce:challenge,pacote:Buffer.from(pacote).toString('base64')}),
    });
    if(!response.ok)throw Error('Consulta NTP pela ponte indisponível.');
    const body=await response.json();
    if(body.ok!==true||body.ambiente!=='homologacao'||body.nonce!==challenge||body.servidor!==host
      ||typeof body.pacote!=='string'||body.pacote.length>684||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.pacote))throw Error('Resposta da ponte NTP inválida.');
    const packet=Buffer.from(body.pacote,'base64');
    if(packet.length<48||packet.length>512)throw Error('Resposta NTP inválida.');
    return packet;
  };
}
