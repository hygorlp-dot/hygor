import {it,expect,vi,afterEach} from 'vitest';
import {criarTransporte} from '../servicos/transporte.js';
import {classificarResposta} from './falhas.js';
const config={url:'https://homologacao.example/api/data',ambiente:'homologacao'};
afterEach(()=>vi.useRealTimers());
it('preserva payload, token e resposta sem confundir recusa com sucesso HTTP',async()=>{
 const fetchImpl=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:false,error:'Código vencido'})});
 const r=await criarTransporte({...config,obterToken:async()=>'segredo',fetchImpl})('ponto-parear',{codigo:'12345678'});
 expect(r).toMatchObject({ok:false,status:200,error:'Código vencido'});
 expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({action:'ponto-parear',codigo:'12345678',ambienteApp:'homologacao'});
 expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer segredo');
});
it('sessão local indisponível não vira diagnóstico de internet e não envia pedido',async()=>{
 const fetchImpl=vi.fn();const r=await criarTransporte({...config,fetchImpl,obterToken:async()=>{throw Error('dado sensível');}})('ponto-parear');
 expect(r).toMatchObject({ok:false,status:0,code:'SESSAO_LOCAL_INDISPONIVEL'});expect(fetchImpl).not.toHaveBeenCalled();expect(JSON.stringify(r)).not.toContain('sensível');expect(classificarResposta(r).mensagem).toContain('sessão');
});
it('URL ausente bloqueia antes de ler sessão ou enviar qualquer dado',async()=>{
 const obterToken=vi.fn(),fetchImpl=vi.fn();expect(await criarTransporte({obterToken,fetchImpl})('ponto-parear')).toMatchObject({status:-1});expect(obterToken).not.toHaveBeenCalled();expect(fetchImpl).not.toHaveBeenCalled();
});
it('não trata resposta HTML ou JSON vazio como confirmação do registro',async()=>{
 for(const json of [async()=>{throw SyntaxError();},async()=>null,async()=>[]]){
 const r=await criarTransporte({...config,fetchImpl:async()=>({ok:true,status:200,json})})('ponto-sincronizar');expect(r).toMatchObject({ok:false,status:502,code:'RESPOSTA_INVALIDA'});
 }
});
it('status HTTP prevalece sobre campo do corpo e falha 503 continua recusa',async()=>{
 const r=await criarTransporte({...config,fetchImpl:async()=>({ok:false,status:503,json:async()=>({ok:true,status:200})})})('ponto-ambiente');expect(r).toMatchObject({ok:false,status:503});
});
it('falha de fetch não presume que a internet inteira caiu nem expõe detalhes',async()=>{
 const r=await criarTransporte({...config,fetchImpl:async()=>{throw Error('TLS host segredo');}})('ponto-ambiente');expect(r).toMatchObject({status:0,code:'CONEXAO_INDISPONIVEL'});expect(classificarResposta(r).mensagem).not.toContain('Sem internet');expect(JSON.stringify(r)).not.toContain('segredo');
});
it('timeout tem diagnóstico próprio e cancela o pedido sem afirmar que foi salvo',async()=>{
 vi.useFakeTimers();const promise=criarTransporte({...config,limiteMs:50,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('abort'))))})('ponto-parear');
 await vi.advanceTimersByTimeAsync(51);const r=await promise;expect(r).toMatchObject({ok:false,status:0,code:'TEMPO_ESGOTADO'});expect(classificarResposta(r).mensagem).toContain('não respondeu a tempo');
});
