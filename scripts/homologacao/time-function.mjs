// Empacotado exclusivamente na homologação como api/homologacao-time.js.
// Não recebe host arbitrário, credencial, ID de pessoa nem comando do banco.
import dgram from 'node:dgram';
import {SERVIDORES_HLB,enviarUdpComDgram} from '../../server/ponto-eletronico/tempo/ntp.js';

export function criarPonteNtp({enviarUdp=enviarUdpComDgram(dgram)}={}){
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    if(req.method!=='POST')return res.status(405).json({ok:false,error:'Use POST.'});
    const body=req.body||{};
    if(body.ambiente!=='homologacao'||!SERVIDORES_HLB.includes(body.servidor)
      ||!/^[a-zA-Z0-9-]{16,64}$/.test(body.nonce||'')||typeof body.pacote!=='string'
      ||body.pacote.length!==64||!/^[A-Za-z0-9+/]{64}$/.test(body.pacote))return res.status(400).json({ok:false,error:'Pedido NTP inválido.'});
    const packet=Buffer.from(body.pacote,'base64');
    if(packet.length!==48||packet[0]!==35||packet.subarray(1,40).some(byte=>byte!==0))return res.status(400).json({ok:false,error:'Pedido NTP inválido.'});
    try{
      const answer=await enviarUdp({host:body.servidor,porta:123,pacote:packet,timeoutMs:1500});
      if(answer.length<48||answer.length>512)throw Error('INVALID_PACKET');
      return res.status(200).json({ok:true,ambiente:'homologacao',servidor:body.servidor,nonce:body.nonce,pacote:answer.toString('base64')});
    }catch{
      return res.status(503).json({ok:false,error:'Servidor NTP sem resposta. Hora permanece não verificada.'});
    }
  };
}

// O projeto usa Vercel Functions sem framework; contrato req/res documentado.
export default criarPonteNtp();
