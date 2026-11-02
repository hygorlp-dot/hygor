import {describe,it,expect} from 'vitest';
import {purchaseRecordFlow} from './record-flow';

describe('vínculos e próxima providência da compra',()=>{
 it('expõe decisão parcial e pedidos por identidade sem inferir cobertura da solicitação',()=>{
  const request={id:'r',obraId:'a',status:'em_analise'};
  const quote={id:'q',obraId:'a',solicitacaoId:'r',status:'aberta',itens:[{id:'i1',qtd:2},{id:'i2',qtd:4}],decisoes:{i1:{pedidoId:'p'}}};
  const data={cotacoes:[quote],pedidos:[{id:'p',obraId:'a',cotacaoId:'q'},{id:'other',obraId:'b',solicitacaoId:'r'}]};
  const result=purchaseRecordFlow(data,'request',request);
  expect(result.next).toContain('1 item de cotação ainda sem decisão');
  expect(result.links.map(l=>l.id)).toEqual(['q','p']);
  expect(purchaseRecordFlow(data,'quote',quote).detail).toContain('1 de 2 itens decididos');
 });
 it('não apresenta vínculo de outra obra nem cotação cancelada por similaridade',()=>{
  const data={cotacoes:[{id:'q',obraId:'b',solicitacaoId:'r'},{id:'cancel',obraId:'a',solicitacaoId:'r',status:'cancelada'}],pedidos:[{id:'same-name',obraId:'a',numero:'r'}]};
  expect(purchaseRecordFlow(data,'request',{id:'r',obraId:'a'}).links).toEqual([]);
 });
 it('mantém aprovação e cancelamento explícitos mesmo quando existem cotações',()=>{
  const data={instanciasAprovacao:[{id:'approval',status:'bloqueada'}]};
  expect(purchaseRecordFlow(data,'request',{id:'r',obraId:'a',aprovacaoInstanciaId:'approval'}).next).toContain('Confira a aprovação');
  expect(purchaseRecordFlow(data,'request',{id:'r',obraId:'a',status:'cancelada'}).next).toContain('Solicitação cancelada');
 });
 it('separa saldo físico de pagamento e não soma unidades diferentes',()=>{
  const order={id:'p',obraId:'a',status:'parcial',itens:[{qtd:10,qtdRecebida:4,unidadeCompra:'UN'},{qtd:20,qtdRecebida:20,unidadeCompra:'KG'}]};
  const result=purchaseRecordFlow({},'order',order);
  expect(result.next).toContain('1 item com saldo de entrega');
  expect(result.detail).toContain('pagamento são controles separados');
  expect(purchaseRecordFlow({},'order',{...order,status:'cancelado'}).next).toContain('Pedido cancelado');
 });
 it('cotação cancelada mantém a consulta do pedido e não pede outra decisão',()=>{
  const quote={id:'q',obraId:'a',status:'cancelada',materialId:'m',qtd:1};
  const result=purchaseRecordFlow({pedidos:[{id:'p',obraId:'a',cotacaoId:'q'}]},'quote',quote);
  expect(result.next).toContain('Cotação cancelada');expect(result.links.map(l=>l.id)).toEqual(['p']);
 });
});
