import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect,vi,afterEach} from 'vitest';
let root,container;
const render=ui=>{container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(ui));};
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();vi.restoreAllMocks();});
const screen={
 getByLabelText:label=>[...container.querySelectorAll('label')].find(e=>e.childNodes[0]?.textContent===label)?.querySelector('input,select,textarea'),
 getByRole:(role,{name})=>[...container.querySelectorAll(role==='combobox'?'select':role==='checkbox'?'input[type=checkbox]':'button')].find(e=>{const text=role==='combobox'||role==='checkbox'?e.closest('label')?.textContent:e.textContent;return name instanceof RegExp?name.test(text):text?.trim()===name;}),
};
const fireEvent={change:(el,{target:{value}})=>act(()=>{const prototype=Object.getPrototypeOf(el);Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}),click:el=>act(()=>el.click())};
vi.mock('../../../LegacyApp',()=>({
  Btn:({children,onClick,disabled})=><button onClick={onClick} disabled={disabled}>{children}</button>,
  Inp:({label,value,onChange,type='text'})=><label>{label}<input type={type} value={value??''} onChange={e=>onChange(e.target.value)}/></label>,
  Sel:({label,value,onChange,options})=><label>{label}<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></label>,
  PageHero:({title,description})=><header><h1>{title}</h1><p>{description}</p></header>,
  Modal:({children})=><div>{children}</div>,Ic:()=>null,C:{},
  fmt:value=>Number(value||0).toFixed(2),fmtDateFull:v=>v,today:()=> '2026-09-30',uid:()=> 'test-uid',escapeHtml:v=>String(v??''),
}));
vi.mock('../../../hooks/useBreakpoint',()=>({useBreakpoint:()=>({formGrid:()=> '1fr 1fr'})}));
vi.mock('../../../reports/marcell-report.js',()=>({marcellReportHtml:html=>html}));
import Rescisao from './RescisaoView.jsx';
const employee={id:'e',name:'Operário QA',role:'Pedreiro',cpf:'000',obra:'o',startDate:'2026-01-01',active:true,remunerationMode:'clt',dailyRate:120,monthlySalary:3000,remunerationValuesHistory:[{date:'2026-01-01',monthlySalary:2406.8},{date:'2026-10-01',monthlySalary:3000}]};
const data={employees:[employee],obras:[{id:'o',name:'Obra QA'}],config:{},advances:[],rescisoes:[]};
describe('rescisão: base contratual e apuração recebida',()=>{
  it('sugere salário vigente, reavalia por data e não substitui uma base manual',()=>{
    render(<Rescisao data={data} showToast={vi.fn()} dispatchCommand={vi.fn()}/>);
    fireEvent.change(screen.getByRole('combobox',{name:/Selecionar da lista/}),{target:{value:'e'}});
    const base=screen.getByLabelText('Valor mensal (R$) *');expect(base.value).toBe('2406.8');
    fireEvent.change(screen.getByLabelText('Data de rescisão *'),{target:{value:'2026-10-01'}});expect(base.value).toBe('3000');
    fireEvent.change(base,{target:{value:'3100'}});fireEvent.change(screen.getByLabelText('Data de rescisão *'),{target:{value:'2026-09-30'}});expect(base.value).toBe('3100');
  });
  it('não sugere diária ×26, nem permite registrar prévia sem apuração identificada',()=>{
    render(<Rescisao data={{...data,employees:[{...employee,remunerationMode:'daily'}]}} showToast={vi.fn()} dispatchCommand={vi.fn()}/>);
    fireEvent.change(screen.getByRole('combobox',{name:/Selecionar da lista/}),{target:{value:'e'}});
    expect(screen.getByLabelText('Valor mensal (R$) *').value).toBe('');
    expect(screen.getByRole('button',{name:'Registrar apuração conferida'}).disabled).toBe(true);
  });
  it('envia líquido da contabilidade e invalida confirmação quando os dados mudam',async()=>{
    const dispatch=vi.fn().mockResolvedValue({ok:true});render(<Rescisao data={data} currentUser={{id:'rh',nome:'RH'}} showToast={vi.fn()} dispatchCommand={dispatch}/>);
    fireEvent.change(screen.getByRole('combobox',{name:/Selecionar da lista/}),{target:{value:'e'}});
    fireEvent.change(screen.getByLabelText('Responsável pela apuração contábil'),{target:{value:'Contador QA'}});
    fireEvent.change(screen.getByLabelText('Referência da apuração contábil'),{target:{value:'Memória 09-2026'}});
    fireEvent.change(screen.getByLabelText('Líquido apurado pela contabilidade (R$)'),{target:{value:'789.45'}});
    const confirmation=screen.getByRole('checkbox',{name:/Recebi e conferi a apuração/});fireEvent.click(confirmation);
    const save=screen.getByRole('button',{name:'Registrar apuração conferida'});expect(save.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Observações (aparece no documento)'),{target:{value:'Revisar dado'}});expect(save.disabled).toBe(true);
    fireEvent.click(confirmation);await act(async()=>save.click());expect(dispatch).toHaveBeenCalledTimes(1);
    const command=dispatch.mock.calls[0][0]();expect(command.payload.rescission.accounting).toMatchObject({responsible:'Contador QA',reference:'Memória 09-2026',totalNet:'789.45',confirmed:true});
  });
  it('PDF do histórico distingue líquido recebido da contabilidade e simulação preservada',()=>{
    const write=vi.fn();vi.spyOn(window,'open').mockReturnValue({document:{write,close:vi.fn()}});
    const record={id:'r',empId:'e',empName:'Operário QA',tipo:'sem_justa_causa',admissao:'2026-01-01',demissao:'2026-09-30',createdAt:'2026-09-30T12:00:00Z',valorMensal:3000,totalLiquido:789.45,totalBruto:1000,totalDesc:210.55,status:'ativa',anos:0,totalMeses:8,diasResto:29,preliminaryCalculation:{anos:0,totalMeses:8,diasResto:29,totalBruto:123,totalDesc:0,totalLiquido:123},accounting:{responsible:'Contador QA',reference:'Memória 09-2026',totalNet:789.45,confirmed:true}};
    render(<Rescisao data={{...data,rescisoes:[record]}} showToast={vi.fn()} dispatchCommand={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:/Ver.*histórico de rescisões/}));fireEvent.click(screen.getByRole('button',{name:'PDF'}));
    const html=write.mock.calls[0][0];expect(html).toContain('Líquido informado pela contabilidade: 789.45');expect(html).toContain('LÍQUIDO ESTIMADO DA PRÉVIA');expect(html).toContain('123');expect(html).not.toContain('Declaro ter recebido');expect(html).not.toContain('irrevogável quitação');
  });
});

