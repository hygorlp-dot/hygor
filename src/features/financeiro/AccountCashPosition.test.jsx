import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import CashWorkspace from './CashWorkspace.jsx';
import {buildFinancialLedger} from '../../domains/financeiro/ledger.js';
let root,el;
afterEach(()=>{if(root)act(()=>root.unmount());el?.remove();root=null;el=null;});
const data={contasBancarias:[{id:'a',nome:'Banco A',saldoInicial:100},{id:'b',nome:'Banco B'}],transacoes:[{id:'t',contaBancariaId:'a',data:'2026-10-15',valor:-20,status:'parcial'}]};
const props={data,ledger:buildFinancialLedger(data),today:'2026-10-31',obraId:'work',onOpen:vi.fn()};
function render(extra={}){if(!el){el=document.createElement('div');document.body.append(el);root=createRoot(el);}act(()=>root.render(<CashWorkspace {...props} {...extra}/>));}
function change(input,value){act(()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
const button=text=>[...el.querySelectorAll('button')].find(b=>b.textContent===text);
it('exige data e abertura explícitas e preserva cada conta sem alterar a previsão',()=>{
 render({view:undefined});const selector=el.querySelector('select[aria-label="Conta bancária do caixa"]');change(selector,'a');
 expect(el.textContent).toContain('Posição ainda não calculada');expect(el.textContent).toContain('inclui movimentos de outras obras');
 act(()=>button('Usar valor cadastrado como abertura').click());
 expect(el.textContent).not.toContain('Posição calculada:');
 change(el.querySelector('.account-cash input[type=date]'),'2026-10-01');
 expect(el.textContent).toMatch(/Posição calculada: R\$\s80,00/);expect(el.textContent).not.toContain('Menor saldo previsto:');
 change(selector,'b');expect(el.querySelector('.account-cash input[type=number]').value).toBe('');
 change(selector,'a');expect(el.querySelector('.account-cash input[type=number]').value).toBe('100');expect(el.querySelector('.account-cash input[type=date]').value).toBe('2026-10-01');
});
it('abre pendências no memorial com conta, datas e sinal do movimento',()=>{
 const onOpen=vi.fn();render({onOpen,view:{days:7,opening:'',account:'a',accountPositions:{a:{opening:'0',openingDate:'2026-10-01',referenceDate:'2026-10-31'}}}});
 act(()=>button('Pendentes de conciliação: 1').click());
 expect(onOpen.mock.calls[0][0]).toMatchObject({title:'Pendências de conciliação · Banco A',items:[{amountCents:-2000,record:{id:'t'}}]});expect(onOpen.mock.calls[0][0].context).toContain('31/10/2026');
});
it('recorta movimentos ao trocar referência e não inventa uma posição certificada',()=>{
 render({view:{days:7,opening:'',account:'a',accountPositions:{a:{opening:'0',openingDate:'2026-10-01',referenceDate:'2026-10-10'}}}});
 expect(el.textContent).toMatch(/Posição calculada: R\$\s0,00/);expect(button('Pendentes de conciliação: 0')).toBeTruthy();expect(el.textContent).toContain('Não representa saldo bancário certificado');
});
it('explica a ausência de contas sem inventar um cadastro para a revisão',()=>{
 render({data:{...data,contasBancarias:[]}});
 expect(el.textContent).toContain('Nenhuma conta bancária está cadastrada na base carregada');
 expect(el.querySelector('.account-cash input')).toBeNull();
});
