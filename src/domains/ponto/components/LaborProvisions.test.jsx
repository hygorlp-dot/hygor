import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {fireEvent,screen} from '@testing-library/dom';
import {afterEach,expect,it,vi} from 'vitest';
import {applyEmployeeCommand} from '../../rh/employee-commands.js';
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();vi.restoreAllMocks();});
vi.mock('../../../LegacyApp',()=>({
  Btn:({children,onClick,disabled})=><button onClick={onClick} disabled={disabled}>{children}</button>,
  Inp:({label,value,onChange,type='text',multiline})=><label>{label}{multiline?<textarea value={value??''} onChange={e=>onChange(e.target.value)}/>:<input type={type} value={value??''} onChange={e=>onChange(e.target.value)}/>}</label>,
  Sel:({label,value,onChange,options})=><label>{label}<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></label>,
  fmt:value=>Number(value||0).toFixed(2),uid:()=> 'reserve-qa',
}));
vi.mock('../../../reports/marcell-report.js',()=>({marcellReportHtml:html=>html}));
import {LaborProvisions} from './LaborProvisions.jsx';
const worker={id:'siclano',name:'Siclano fictício',startDate:'2026-10-06',dailyRate:120,remunerationMode:'daily',employmentRelationship:'clt',employmentRelationshipEffectiveFrom:'2026-10-06',obra:'qa',active:true,version:1};
const base=()=>({employees:[worker],obras:[{id:'qa',name:'Obra QA'}],config:{},ponto:{},titulosFolha:[],liquidacoesFolha:[]});
const props={currentUser:{role:'rh',id:'rh-qa',nome:'RH fictício'},showToast:vi.fn(),year:2026,month:9};
function render(data,dispatchCommand=vi.fn()){
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  act(()=>root.render(<LaborProvisions {...props} data={data} dispatchCommand={dispatchCommand}/>));
}
const change=(label,value)=>act(()=>fireEvent.change(screen.getByLabelText(label),{target:{value}}));
it('mostra CLT diário pendente e bloqueia PDF sem base, incidências e memória',()=>{
  render(base());
  expect(container.textContent).toContain('1 com apuração pendente');
  expect(screen.getByRole('button',{name:'Exportar provisões PDF'}).disabled).toBe(true);
  act(()=>screen.getByRole('button',{name:'Ajustar Siclano fictício'}).click());
  expect(screen.getByLabelText('Base mensal para provisões (R$)').value).toBe('');
  expect(screen.getByLabelText('Alíquota FGTS da reserva (%)').value).toBe('');
  expect(screen.getByLabelText('Incluir este funcionário nas provisões trabalhistas').disabled).toBe(true);
});
it('salva pela validação oficial, exige nova conferência ao editar e leva origem ao PDF',async()=>{
  let data=base();
  const dispatch=vi.fn(async builder=>{const result=applyEmployeeCommand(data,builder(data),'2026-10-25T12:00:00.000Z');if(result.ok){data=result.data;root.render(<LaborProvisions {...props} data={data} dispatchCommand={dispatch}/>);}return result;});
  render(data,dispatch);act(()=>screen.getByRole('button',{name:'Ajustar Siclano fictício'}).click());
  for(const [label,value] of [['Base mensal para provisões (R$)','2550'],['Média mensal de adicionais e variáveis (R$)','50'],['Alíquota FGTS da reserva (%)','8'],['Cenário para reserva da multa','40'],['FGTS sobre férias gozadas e um terço','true'],['Referência da apuração da reserva','Memória <QA>'],['Responsável pela apuração da reserva','Contabilidade fictícia'],['Memória da base e das incidências da reserva','Base independente de teste; médias e incidências conferidas.']])change(label,value);
  const confirm=screen.getByLabelText('Conferi a base, as médias e as incidências desta reserva');
  act(()=>confirm.click());expect(confirm.checked).toBe(true);
  change('Outras reservas mensais (R$)','25');expect(confirm.checked).toBe(false);
  change('Outras reservas mensais (R$)','0');
  expect(screen.getByRole('button',{name:'Salvar provisões'}).disabled).toBe(true);
  act(()=>confirm.click());await act(async()=>screen.getByRole('button',{name:'Salvar provisões'}).click());
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(data.employees[0].laborProvisions['2026-10'].manualAssessmentAudit.reviewedBy).toBe('rh-qa');
  expect(data.employees[0].monthlySalary).toBeUndefined();expect(data.titulosFolha).toEqual([]);
  act(()=>screen.getByRole('button',{name:'Ajustar Siclano fictício'}).click());
  const write=vi.fn();vi.spyOn(window,'open').mockReturnValue({document:{write,close:vi.fn()}});
  act(()=>screen.getByRole('button',{name:'Exportar provisões PDF'}).click());
  expect(write.mock.calls[0][0]).toContain('Memória &lt;QA&gt;');
  expect(write.mock.calls[0][0]).toContain('RH fictício');
  expect(write.mock.calls[0][0]).toContain('645.38');
});
