import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {WorkforceReserveSettings} from './WorkforceReserveSettings.jsx';

it('salva parâmetros ajustáveis preservando a configuração de custos existente',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const data={config:{version:4,laborCharges:{fgtsPercent:8},companyName:'Empresa',workforceReserve:{enabled:true,noticePercent:0}}};
 const dispatchCommand=vi.fn(async factory=>{const command=factory(data);expect(command.payload.config.laborCharges).toEqual(data.config.laborCharges);expect(command.payload.config.companyName).toBe('Empresa');expect(command.payload.config.workforceReserve.noticePercent).toBe(0);expect(command.payload.config.workforceReserve.tenureMonths).toBe(18);expect(command.expectedVersion).toBe(4);return {ok:true};});
 try{
  await act(async()=>root.render(<WorkforceReserveSettings data={data} currentUser={{role:'admin'}} dispatchCommand={dispatchCommand} showToast={vi.fn()}/>));
  const input=[...host.querySelectorAll('input')].find(node=>node.value==='12');expect(input).toBeTruthy();
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'18');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
  const button=[...host.querySelectorAll('button')].find(node=>node.textContent.includes('Salvar parâmetros'));
  await act(async()=>button.click());expect(dispatchCommand).toHaveBeenCalledTimes(1);
  await act(async()=>root.render(<WorkforceReserveSettings data={data} currentUser={{role:'operador'}} dispatchCommand={dispatchCommand} showToast={vi.fn()}/>));
  expect(button.disabled).toBe(true);expect([...host.querySelectorAll('input')].every(input=>input.disabled)).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();}
});
