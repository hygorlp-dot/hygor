import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();});
vi.mock('../../../hooks/useBreakpoint',()=>({useBreakpoint:()=>({cols:()=> '1fr'})}));
vi.mock('../../../LegacyApp',()=>({
  Badge:({children})=><span>{children}</span>,C:{},TYPO:{},fmt:value=>Number(value).toFixed(2),fmtDateFull:value=>value,today:()=> '2026-10-25',
  PageHero:({title})=><h1>{title}</h1>,MiniKpi:({label,value,sub})=><section aria-label={label}>{value}<small>{sub}</small></section>,
}));
import Indicadores from './IndicadoresView.jsx';
it('painel mostra saldo a pagar após baixa parcial e ASO vencido no desligamento futuro',()=>{
  const data={employees:[{id:'e',name:'Siclano fictício',active:true,startDate:'2026-10-06',endDate:'2026-10-31',examExpiresAt:'2026-10-24'}],
    advances:[{id:'a',empId:'e',amount:600,date:'2026-10-20',paymentTitleId:'t'},{id:'old',amount:500}],
    titulosFolha:[{id:'t',employeeId:'e',status:'parcial',snapshotCalculo:{kind:'advance',advanceId:'a'},liquidacoes:[{id:'p',data:'2026-10-20',valor:250}]}]};
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<Indicadores data={data}/>));
  expect(container.querySelector('[aria-label="Adiantamentos a pagar"]').textContent).toContain('350.00');
  expect(container.querySelector('[aria-label="Documentação vencida"]').textContent).toContain('1de 1 ativos');
  expect(container.textContent).toContain('Siclano fictício');
  expect(container.textContent).toContain('Exame ocupacional (ASO)');
  expect(container.textContent).toContain('500.00, permanecem no histórico');
});
