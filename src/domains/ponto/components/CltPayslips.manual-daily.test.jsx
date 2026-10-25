import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi,afterEach} from 'vitest';
let root,container;
const render=ui=>{container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(ui));};
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();window.sessionStorage.clear();vi.restoreAllMocks();});
const labelField=label=>[...container.querySelectorAll('label')].find(e=>e.childNodes[0]?.textContent===label)?.querySelector('input,select,textarea');
const change=(element,value)=>act(()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element),'value').set.call(element,value);element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});
vi.mock('../../../LegacyApp',()=>({
  Btn:({children,onClick,disabled})=><button onClick={onClick} disabled={disabled}>{children}</button>,
  Inp:({label,value,onChange,type='text',disabled})=><label>{label}<input type={type} value={value??''} disabled={disabled} onChange={e=>onChange(e.target.value)}/></label>,
  Sel:({label,value,onChange,options,disabled})=><label>{label}<select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(option=><option key={option.v} value={option.v}>{option.l}</option>)}</select></label>,
  fmt:value=>Number(value||0).toFixed(2),uid:()=> 'manual-daily-test',
}));
vi.mock('./CltClosingSummary.jsx',()=>({CltClosingSummary:()=>null}));
import {CltPayslips} from './CltPayslips.jsx';
const worker={id:'siclano',name:'Siclano — SIMULAÇÃO',role:'Servente',cpf:'00010000208',employmentRelationship:'clt',
  remunerationMode:'daily',dailyRate:120,monthlySalary:0,active:true,startDate:'2026-10-06',obra:'obra',
  cltPayroll:{profile:{registration:'QA-0002',cbo:'717020',category:'helper'}}};
const data={employees:[worker],obras:[{id:'obra'}],config:{companyName:'Construtora QA',cnpj:'00'},attendance:{},attendanceLocks:{},advances:[]};
const props={data,currentUser:{id:'rh',role:'rh',nome:'RH QA'},dispatchCommand:vi.fn(),showToast:vi.fn(),year:2026,month:9};

it('apresenta memória CLT por diária, mantém tributos vazios e exige nova confirmação após editar',()=>{
  render(<CltPayslips {...props}/>);
  change(labelField('Funcionário do holerite'),'siclano');
  expect(container.textContent).toContain('Diária contratual de referência: 120.00');
  expect(labelField('Salário contratual mensal (R$)')).toBeUndefined();
  expect(labelField('Apuração de INSS e IRRF')).toBeUndefined();
  expect(labelField('INSS apurado (R$)').value).toBe('');
  expect(labelField('FGTS do empregador apurado (R$)').value).toBe('');
  expect(labelField('Responsável pela apuração')).toBeTruthy();
  const confirmation=[...container.querySelectorAll('label')].find(label=>label.textContent.startsWith('Confirmo contrato'))?.querySelector('input');
  act(()=>confirmation.click());expect(confirmation.checked).toBe(true);
  change(container.querySelector('textarea[aria-label="Memória de cálculo"]'),'Memória fictícia de apuração conferida para teste.');
  expect(confirmation.checked).toBe(false);
  expect([...container.querySelectorAll('button')].find(button=>button.textContent==='Exportar holerite PDF').disabled).toBe(true);
});
it('mantém a preparação mensal existente para o mensalista',()=>{
  render(<CltPayslips {...props} data={{...data,employees:[{...worker,remunerationMode:'clt',monthlySalary:3300}]}}/>);
  change(labelField('Funcionário do holerite'),'siclano');
  expect(labelField('Salário contratual mensal (R$)').value).toBe('3300');
  expect(labelField('Apuração de INSS e IRRF')).toBeTruthy();
  expect(container.querySelector('textarea[aria-label="Memória de cálculo"]')).toBeNull();
});
