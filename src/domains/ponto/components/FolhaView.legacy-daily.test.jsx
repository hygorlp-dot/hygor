import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {fireEvent,screen} from '@testing-library/dom';
import {afterEach,expect,it,vi} from 'vitest';
import {getQ,prIsWeekdayIso} from '../attendance-engine.js';
import {newCltDraft} from '../clt-payslip.js';
import {buildMixedPayroll,MIXED_PAYROLL_COMMAND} from '../mixed-payroll.js';
import {applyOperationalCommand,OPERATIONAL_COMMAND} from '../../sync/operational-commands.js';
import {advanceDeductionForPeriod} from '../../rh/advance-commands.js';
import {isCltPayrollOnDate} from '../../rh/payroll-classification.js';
import {newProvisionDraft} from '../labor-provisions.js';
import Folha from './FolhaView.jsx';
import Equipe from '../../rh/components/EquipeView.jsx';

const exportsState=vi.hoisted(()=>({books:[]}));
vi.mock('../../../LegacyApp',async original=>({
  ...await original(),carregarXLSX:vi.fn(async()=>{}),
  XLSX:{utils:{book_new:()=>({sheets:[]}),aoa_to_sheet:rows=>({rows}),book_append_sheet:(book,sheet,name)=>book.sheets.push({name,...sheet})},
    writeFile:vi.fn(async(book,name)=>exportsState.books.push({name,book}))},
}));
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());root=null;container?.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();exportsState.books=[];window.sessionStorage.clear();});
const now='2026-10-06T12:00:00.000Z',period={year:2026,month:8,cycle:'2',cltPlans:{monthly:{competence:'2026-09',amount:700,reference:'Parcela mensal conferida — teste'}}};
function fixture(mode){
  const daily={id:'legacy',name:'Diária preservada',role:'Servente',obra:'A',active:true,version:2,startDate:'2026-01-01',dailyRate:100,monthlySalary:2800,
    workdayHours:8,workStart:'07:00',vtDaily:0,vrDaily:0,overtimeAdditionalPercent:50,pixType:'email',pixKey:'ficticio@example.invalid',pixHolder:'Diária preservada',cpf:'529.982.247-25'};
  if(mode)daily.remunerationMode=mode;
  const monthly={...daily,id:'monthly',name:'Mensal independente',remunerationMode:'clt',dailyRate:150,monthlySalary:3300,
    cltPayroll:{drafts:{'2026-09':{...newCltDraft('2026-09',{salary:3300}),paymentDate:'2026-09-30',workedDays:22,registration:'QA-02',cbo:'715210',confirmed:true}}}};
  const dates=getQ(2026,8).q2.filter(prIsWeekdayIso);
  return {config:{companyName:'Empresa fictícia',cnpj:'00.000.000/0000-00'},obras:[{id:'A',name:'Obra A'}],employees:[daily,monthly],
    attendance:{legacy:Object.fromEntries(dates.map(date=>[date,{status:'P',obraId:'A'}]))},attendanceLocks:Object.fromEntries(dates.map(date=>[`${date}__A`,{locked:true}])),changeLog:[],
    advances:[{id:'old-single',empId:'legacy',date:'2026-09-23',amount:150},{id:'old-installment',empId:'legacy',date:'2026-09-10',amount:300,installments:[{dueDate:'2026-09-30',amount:50},{dueDate:'2026-10-20',amount:250}]}],
    titulosFolha:[{id:'old-paid',employeeId:'legacy',periodoInicio:'2026-09-06',periodoFim:'2026-09-20',competencia:'2026-09',liquido:500,valorPago:500,status:'pago',snapshotCalculo:{kind:'daily',dailyRate:100},liquidacoes:[{id:'old-payment',valor:500,data:'2026-09-21'}]}],
    pagamentosFolha:[{id:'old-payment',valor:500}],quinzenasArquivadas:{'2026-09-Q1':{inicio:'2026-09-06',fim:'2026-09-20'}},archivedLaborCosts:{'2026-09-Q1':{preserved:true}}};
}
function render(component){container=document.createElement('div');document.body.append(container);root=createRoot(container);act(()=>root.render(component));}
async function exportReport(label){
  await act(async()=>screen.getByRole('button',{name:label,exact:true}).click());
  const continueButton=screen.queryByRole('button',{name:'Gerar com pendências',exact:true});
  if(continueButton)await act(async()=>continueButton.click());
}

it.each([undefined,'daily'])('mantém o legado %s e o mensal na mesma quinzena, sem inferir vínculo pelo salário preenchido',mode=>{
  const data=fixture(mode),before=structuredClone(data),daily=data.employees[0];
  expect(daily).not.toHaveProperty('employmentRelationship');expect(isCltPayrollOnDate(daily,'2026-09-30')).toBe(false);
  expect(newProvisionDraft(daily,'2026-09').included).toBe(false);
  const saved=applyOperationalCommand(data,{type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,actorId:'rh',actorRole:'rh',now,idempotencyKey:`legacy-contact-${mode||'absent'}-0001`,expectedVersion:2,payload:{employee:{...daily,phone:'81900000000'}}});
  expect(saved.ok,saved.reason).toBe(true);expect(saved.data.employees[0]).toMatchObject({remunerationMode:'daily',employmentRelationship:'',dailyRate:100,monthlySalary:2800});
  expect(saved.data.employees[0].employmentRelationshipHistory).toEqual([]);
  expect(saved.data.advances).toEqual(before.advances);expect(saved.data.titulosFolha).toEqual(before.titulosFolha);expect(saved.data.attendance).toEqual(before.attendance);
  const built=buildMixedPayroll(saved.data,period),row=built.rows.find(item=>item.employeeId==='legacy'),monthly=built.rows.find(item=>item.employeeId==='monthly');
  expect(built.start).toBe('2026-09-21');expect(built.end).toBe('2026-10-05');
  expect(row).toMatchObject({kind:'daily',gross:1100,advances:200,net:900,issues:[]});expect(monthly).toMatchObject({kind:'clt',net:700,issues:[]});
  const approved=applyOperationalCommand(saved.data,{type:MIXED_PAYROLL_COMMAND,actorId:'rh',actorRole:'rh',now,idempotencyKey:`legacy-coexist-${mode||'absent'}-0001`,payload:{period,rowIds:[row.id,monthly.id],sources:{[row.id]:row.source,[monthly.id]:monthly.source},paymentDate:'2026-10-06'}});
  expect(approved.ok,approved.reason).toBe(true);expect(approved.data.titulosFolha.find(title=>title.id==='old-paid')).toEqual(before.titulosFolha[0]);
  expect(approved.data.titulosFolha.filter(title=>title.id!=='old-paid').map(title=>title.liquido)).toEqual([900,700]);
  expect(approved.data.pagamentosFolha).toEqual(before.pagamentosFolha);expect(approved.data.archivedLaborCosts).toEqual(before.archivedLaborCosts);
  expect(data).toEqual(before);
});

it('mantém descontos dos adiantamentos antigos sem exigir título novo ou baixa retroativa',()=>{
  const data=fixture(),before=structuredClone(data);
  expect(advanceDeductionForPeriod(data.advances[0],'2026-09-21','2026-10-05',data)).toBe(150);
  expect(advanceDeductionForPeriod(data.advances[1],'2026-09-21','2026-10-05',data)).toBe(50);
  expect(advanceDeductionForPeriod(data.advances[1],'2026-10-06','2026-10-20',data)).toBe(250);
  expect(data.advances.every(advance=>!advance.paymentTitleId)).toBe(true);expect(data).toEqual(before);
});

it('preserva folha, PDF e seis abas de Excel da diária quando há mensalista no mesmo cadastro',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,9,5,12));
  const data=fixture(),before=structuredClone(data),popup={document:{open:vi.fn(),write:vi.fn(),close:vi.fn()},focus:vi.fn(),print:vi.fn()};vi.spyOn(window,'open').mockReturnValue(popup);
  render(<Folha data={data} currentUser={{id:'rh',role:'rh'}} showToast={()=>{}}/>);
  expect(container.querySelector('.payroll-summary-strip__net strong').textContent).toMatch(/900,00/);
  expect(container.querySelectorAll('article')).toHaveLength(1);expect(container.querySelector('article').textContent).toContain('Diária preservada');
  await exportReport('Gerar PDF');const html=popup.document.write.mock.calls.at(-1)[0];
  expect(html).toContain('Diária preservada');expect(html).toContain('900,00');expect(html).not.toContain('Mensal independente');
  await exportReport('Exportar Excel');expect(exportsState.books).toHaveLength(1);
  const {book,name}=exportsState.books[0];expect(name).toBe('arcd-folha-2026-09-Q2.xlsx');expect(book.sheets.map(sheet=>sheet.name)).toEqual(['Folha','Resumo por Obra','Responsabilidade','Funcionario por Obra','Ponto Diario','Sindicato']);
  const payroll=book.sheets.find(sheet=>sheet.name==='Folha').rows.find(row=>row[0]==='Diária preservada');expect(payroll.at(-1)).toBe(900);
  expect(book.sheets.find(sheet=>sheet.name==='Ponto Diario').rows.filter(row=>row[2]==='Diária preservada')).toHaveLength(11);
  expect(data).toEqual(before);
});

it('mostra diária e salário como valores independentes ao escolher a modalidade de cada funcionário',()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,9,5,12));
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  const data=fixture('daily'),before=structuredClone(data);
  render(<Equipe data={data} currentUser={{id:'rh',role:'rh'}} showToast={()=>{}} update={()=>{}} dispatchCommand={vi.fn()}/>);
  act(()=>screen.getAllByRole('button',{name:'Editar',exact:true})[0].click());
  expect(screen.getByLabelText('Diária *',{exact:true}).value).toBe('100');expect(screen.getByLabelText('Salário mensal para opção CLT',{exact:true}).value).toBe('2800');
  act(()=>fireEvent.change(screen.getByRole('combobox',{name:'Modalidade de remuneração',exact:true}),{target:{value:'clt'}}));
  expect(screen.getByLabelText('Diária de referência para custeio *',{exact:true}).value).toBe('100');expect(screen.getByLabelText('Salário contratual mensal *',{exact:true}).value).toBe('2800');
  expect(container.textContent).toContain('Usada no custo do ponto. O salário mensal define o holerite.');
  expect(data).toEqual(before);
});
