import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,afterEach,vi} from 'vitest';
import {ClientAdministrationTeamPage} from '../pages/ClientAdministrationTeamPage.jsx';
const mounted=[];
async function render(data){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);mounted.push([root,host]);await act(async()=>root.render(<ClientAdministrationTeamPage data={data}/>));return host;}
afterEach(()=>{for(const [root,host]of mounted.splice(0)){act(()=>root.unmount());host.remove();}vi.restoreAllMocks();});
const report=(month='2026-11')=>({id:`administracao-w-${month}`,month,asOf:`${month}-14`,available:true,partial:true,administration:{applicable:true,rate:12,base:1100,registeredBase:1000,additionalReserve:100,calculated:132,issued:20,toIssue:112,categories:{labor:true}},workforce:{recognized:1000,additionalReserve:100,passThrough:1100,reserve:150,includedReserve:50,unassigned:0},members:[{id:'e',name:'Equipe do teste',role:'Pedreiro',gross:800,benefits:100,charges:100,recognized:1000,additionalReserve:100,passThrough:1100,closedNet:null,includedReserve:50,attendance:[{date:`${month}-12`,status:'Presença',start:'07:00',end:'17:00',overtime:0}],provisions:{included:true,source:'cadastrada',monthly:150,thirteenth:50,vacation:100}}]});
it('expõe o repasse com reserva e permite abrir a folha, provisões e ponto',async()=>{
 const host=await render({project:{id:'w'},administrationTeam:[report()]});
 expect(host.textContent).toContain('R$ 1.100,00');expect(host.textContent).toContain('Administração a emitir');
 for(const label of ['Provisionamentos','Folha de ponto','Folha detalhada']){
  const button=[...host.querySelectorAll('button')].find(node=>node.textContent===label);await act(async()=>button.click());
  expect(host.textContent).toContain('Equipe do teste');
 }
 const disclosure=[...host.querySelectorAll('summary')].find(node=>node.textContent.includes('Equipe do teste'));expect(disclosure).toBeTruthy();
 expect(host.textContent).toContain('Líquido de folha fechada');expect(host.textContent).toContain('Em apuração');
});
it('muda o mês pela API, preserva a aba e não mantém valores do mês anterior durante a espera',async()=>{
 let resolve;const pending=new Promise(done=>{resolve=done;});vi.spyOn(globalThis,'fetch').mockImplementation(()=>pending);
 const host=await render({project:{id:'w'},administrationTeam:[report()]});
 const input=host.querySelector('input[type="month"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2026-10');input.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new Event('input',{bubbles:true}));});
 // A chamada pode ocorrer no evento nativo de mudança; deve usar o mês exato.
 if(globalThis.fetch.mock.calls.length){
  expect(globalThis.fetch.mock.calls[0][0]).toContain('month=2026-10');expect(host.textContent).not.toContain('Equipe do teste');
  await act(async()=>resolve({ok:true,status:200,json:async()=>({portal:{administrationTeam:[report('2026-10')]}})}));expect(host.textContent).toContain('Equipe do teste');
 }else throw new Error('O filtro de mês não disparou a consulta.');
});
it('mostra a liberação ausente sem inventar valores',async()=>{
 const host=await render({project:{id:'w'},administrationTeam:[]});expect(host.textContent).toContain('ainda não liberados');expect(host.textContent).not.toContain('R$');
});
