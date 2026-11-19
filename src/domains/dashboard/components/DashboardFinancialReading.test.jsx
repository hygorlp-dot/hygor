import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {DashboardFinancialReading} from './DashboardFinancialReading.jsx';

const dre={faturamento:250,totalCustos:100,entradasCaixa:70,saidasCaixa:10,saldoCaixa:60};
it.each([
 {showCash:false,showResult:false,cash:false,cost:false},
 {showCash:true,showResult:false,cash:true,cost:false},
 {showCash:false,showResult:true,cash:false,cost:true},
])('limita a explicação às áreas financeiras autorizadas: %j',flags=>{
 const el=document.createElement('div'),root=createRoot(el),before=structuredClone(dre);
 try{
  act(()=>root.render(<DashboardFinancialReading dre={dre} period="Novembro 2026" {...flags}/>));
  expect(el.textContent.includes('Movimento de caixa:')).toBe(flags.cash);
  expect(el.textContent.includes('Custos reconhecidos:')).toBe(flags.cost);
  if(!flags.cash&&!flags.cost)expect(el.textContent).toBe('');
  else expect(el.querySelector('details').open).toBe(false);
  expect(dre).toEqual(before);
 }finally{act(()=>root.unmount());}
});
