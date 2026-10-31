import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect} from 'vitest';
import CashForecast from './CashForecast.jsx';
import {buildFinancialLedger} from '../../domains/financeiro/ledger.js';
let root,el;
afterEach(()=>{if(root)act(()=>root.unmount());el?.remove();root=null;el=null;});
const data={contasBancarias:[{id:'bank',nome:'Conta A'}],notasFiscais:[{id:'nf',obraId:'a',emissao:'2026-10-01',vencimento:'2026-10-30',status:'aprovada',valorBruto:50}]};
const props={data,ledger:buildFinancialLedger(data),today:'2026-10-30',obraId:'a',onOpen:()=>{}};
function render(extra={}){if(!el){el=document.createElement('div');document.body.append(el);root=createRoot(el);}act(()=>root.render(<CashForecast {...props} {...extra}/>));}
it('mantém entradas e saídas, mas não mostra saldo numérico sem confirmação',()=>{
 render();expect(el.textContent).toContain('Saldo inicial não confirmado');expect(el.textContent).not.toContain('Menor saldo previsto:');
 act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Simular com saldo inicial zero').click());
 expect(el.textContent).toContain('Saldo inicial hipotético:');expect(el.textContent).toContain('Menor saldo previsto:');
 expect(el.textContent).toContain('Não é saldo bancário certificado');
 render({obraId:'b'});expect(el.textContent).not.toContain('Menor saldo previsto:');expect(el.textContent).toContain('Confirmar saldo informado neste recorte');
});
it('exige nova confirmação ao trocar conta ou data, preservando a hipótese digitada',()=>{
 const scenario={days:7,opening:'1500',openingScope:JSON.stringify(['2026-10-30','a','all']),delay:0,overdue:false};
 render({scenario});expect(el.textContent).toContain('Menor saldo previsto:');
 render({scenario:{...scenario,account:'bank'}});expect(el.textContent).not.toContain('Menor saldo previsto:');expect(el.querySelector('input[type=number]').value).toBe('1500');
 render({scenario,today:'2026-10-31'});expect(el.textContent).not.toContain('Menor saldo previsto:');
});
