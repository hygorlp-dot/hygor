import {expect,it} from 'vitest';
import {purchaseQuantityConference} from './purchase-quantity-conference.js';

it('reconcilia embalagens pela conversão existente e mantém unidades e vínculos incertos fora do total',()=>{
 const order={id:'p',obraId:'a',itens:[
  {id:'i',descricao:'Cimento',qtd:10,qtdRecebida:6,unidadeCompra:'SC',unidadeRef:'KG',fatorConversao:50,precoUnit:40},
  {id:'j',descricao:'Areia',qtd:4,qtdRecebida:1,unidadeCompra:'M3',precoUnit:30},
 ]};
 const note=(numero,itensNota,fields={})=>({id:numero,numero,pedidoId:'p',obraId:'a',status:'aprovada',itensNota,...fields});
 const line={pedidoItemId:'i',descricao:'Cimento',unidade:'KG',qtd:200,precoUnit:0.8};
 const result=purchaseQuantityConference(order,[note('1',[line]),note('2',[{...line,unidade:'SC',qtd:3,precoUnit:42},
  {pedidoItemId:'j',descricao:'Areia',unidade:'KG',qtd:60},{descricao:'Areia',unidade:'M3',qtd:2}]),
  note('3',[line],{status:'cancelada'}),note('4',[line],{obraId:'b'})]);
 expect(result.rows).toMatchObject([{ordered:10,received:6,billed:7,open:4,unit:'SC'},{billed:null,open:3}]);
 expect(result.issues).toEqual([
  'NF 2 · Cimento com preço unitário diferente do pedido.',
  'NF 2 · Areia com unidade ou quantidade a conferir.',
  'NF 2 · Areia sem vínculo confirmado com um item do pedido.',
  'Cimento com quantidade faturada acima da recebida em NF 1, NF 2.',
 ]);
 expect(purchaseQuantityConference(order,[]).rows[0].billed).toBe(0);
});
