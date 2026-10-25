import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {fireEvent,screen,waitFor} from '@testing-library/dom';
import {afterEach,expect,it,vi} from 'vitest';
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();vi.clearAllMocks();});
vi.mock('../../../LegacyApp',()=>({
  Btn:({children,onClick,disabled})=><button disabled={disabled} onClick={onClick}>{children}</button>,
  Inp:({label,value,onChange,type='text'})=><label>{label}<input type={type} value={value??''} onChange={e=>onChange(e.target.value)}/></label>,
  Sel:({label,value,onChange,options,disabled})=><label>{label}<select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></label>,
  today:()=> '2026-10-25',
}));
vi.mock('../../../api.js',()=>({employeeDocumentsRequest:vi.fn()}));
import {employeeDocumentsRequest} from '../../../api.js';
import {EmployeeDossier} from './EmployeeDossier.jsx';
const employee={id:'siclano',name:'Siclano fictício',employmentRelationship:'clt',employmentRelationshipEffectiveFrom:'2026-10-06',remunerationMode:'daily',startDate:'2026-10-06',dailyRate:120,workArea:'campo',obra:'qa'};
async function openDossier(result){
  employeeDocumentsRequest.mockResolvedValue(result);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<EmployeeDossier data={{employees:[employee]}} currentUser={{role:'rh'}} showToast={vi.fn()}/>));
  await act(async()=>fireEvent.change(screen.getByLabelText('Funcionário do prontuário'),{target:{value:'siclano'}}));
  await waitFor(()=>expect(employeeDocumentsRequest).toHaveBeenCalled());
}
it('mostra pendências de admissão, ASO vencido e cadastro incompleto sem abrir o checklist',async()=>{
  await openDossier({ok:true,documents:[{id:'aso',name:'ASO antigo',category:'aso',issuedAt:'2026-01-01',expiresAt:'2026-10-24'},{id:'identity',name:'Identidade arquivada',category:'identity',archivedAt:'2026-10-20'}]});
  expect(screen.getByRole('region',{name:'Conferência do prontuário'}).textContent).toContain('ASO e exames ocupacionais: arquivo vencido');
  expect(screen.getByRole('region',{name:'Conferência do prontuário'}).textContent).toContain('Identificação e CPF: sem arquivo ativo');
  expect(screen.getByRole('region',{name:'Conferência do cadastro'}).textContent).toContain('Matrícula');
  expect(screen.getByRole('region',{name:'Conferência do cadastro'}).textContent).not.toContain('Salário contratual mensal');
});
it('falha de leitura não afirma que documentos estão ausentes ou conferidos',async()=>{
  await openDossier({ok:false,error:'Falha temporária no prontuário.'});
  expect(container.textContent).toContain('Falha temporária no prontuário.');
  expect(screen.queryByRole('region',{name:'Conferência do prontuário'})).toBeNull();
  expect(container.textContent).not.toContain('Nenhum documento cadastrado');
});
