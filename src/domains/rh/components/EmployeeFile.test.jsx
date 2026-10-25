import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {fireEvent,screen} from '@testing-library/dom';
import {afterEach,expect,it,vi} from 'vitest';
import {simulationEmployees} from '../../../../scripts/simulacao/fulano-siclano.mjs';
import {applyOperationalCommand} from '../../sync/operational-commands.js';
import {stampEmployeeEngineeringCommand} from '../employee-engineering.js';
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();vi.clearAllMocks();});
vi.mock('../../../LegacyApp',()=>({
  Modal:({title,children,onClose})=><div role="dialog" aria-label={title}><button onClick={onClose}>Fechar ficha</button>{children}</div>,
  Btn:({children,onClick,disabled})=><button disabled={disabled} onClick={onClick}>{children}</button>,
  Inp:({label,value,onChange,type='text',multiline})=><label>{label}{multiline?<textarea value={value??''} onChange={e=>onChange(e.target.value)}/>:<input type={type} value={value??''} onChange={e=>onChange(e.target.value)}/>}</label>,
  Sel:({label,value,onChange,options,disabled})=><label>{label}<select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></label>,
  fmt:value=>Number(value||0).toFixed(2),fmtDateFull:value=>value||'',today:()=> '2026-10-25',uid:()=> crypto.randomUUID(),
}));
vi.mock('../../../api.js',()=>({employeeDocumentsRequest:vi.fn(),carregarQuinzenaArquivada:vi.fn(),chamarPontoEletronico:vi.fn()}));
vi.mock('../../ponto-eletronico/components/ReceivedPointReview.jsx',()=>({default:({employeeId,day,canEdit,onClose})=><section aria-label="Revisão reaproveitada">{employeeId} · {day} · {canEdit?'editar':'consultar'}<button onClick={onClose}>Voltar à ficha</button></section>}));
import {employeeDocumentsRequest,carregarQuinzenaArquivada} from '../../../api.js';
import {EmployeeFile} from './EmployeeFile.jsx';
const base=()=>({employees:[simulationEmployees()[1]],obras:[{id:'piloto-k110',name:'Obra QA'}],attendance:{'piloto-k110-siclano':{'2026-10-20':{status:'P',entrada:'08:00',saida:'17:00',obraId:'piloto-k110',mobileSource:{eventIds:['a','b']}}}},titulosFolha:[],advances:[],employeeEngineeringRecords:[],changeLog:[]});
const rh={id:'rh-qa',nome:'RH QA',role:'rh'};
const props={showToast:vi.fn(),onClose:vi.fn(),onEdit:vi.fn(),onExport:vi.fn(),onNavigate:vi.fn()};
async function render(data,user=rh,dispatchCommand=vi.fn()){
  employeeDocumentsRequest.mockResolvedValue({ok:true,documents:[]});container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<EmployeeFile {...props} employee={data.employees[0]} data={data} currentUser={user} dispatchCommand={dispatchCommand}/>));
}
const tab=name=>act(()=>screen.getByRole('tab',{name,exact:true}).click());
const change=(label,value)=>act(()=>fireEvent.change(screen.getByLabelText(label),{target:{value}}));
it('reúne sete seções, cadastro, pendências e consulta das batidas pela revisão já existente',async()=>{
  const data=base();await render(data);
  expect(screen.getAllByRole('tab')).toHaveLength(7);
  expect(screen.getByRole('region',{name:'Pendências do operário'}).textContent).toContain('Reserva trabalhista com apuração pendente');
  tab('Dados');expect(container.textContent).toContain('Rua de Testes');expect(container.textContent).toContain('120.00');
  tab('Ponto');expect(container.textContent).toContain('08:00 · 17:00');expect(container.textContent).toContain('App → ponto');
  act(()=>screen.getByRole('button',{name:'Ver batidas de 2026-10-20'}).click());
  expect(screen.getByRole('region',{name:'Revisão reaproveitada'}).textContent).toContain('piloto-k110-siclano · 2026-10-20 · consultar');
  act(()=>screen.getByRole('button',{name:'Voltar à ficha'}).click());
  await act(async()=>screen.getByRole('tab',{name:'Documentos e fotos',exact:true}).click());
  expect(screen.queryByLabelText('Funcionário do prontuário')).toBeNull();
  expect(screen.getByRole('option',{name:'Foto do funcionário'})).toBeTruthy();
});
it('engenharia não recebe controles privados nem consulta API de documentos, mesmo com dado completo na fixture',async()=>{
  const data=base();await render(data,{id:'eng',role:'engenheiro',obraId:'piloto-k110'});
  expect(screen.queryByRole('tab',{name:'Documentos e fotos'})).toBeNull();expect(screen.queryByRole('tab',{name:'Pagamentos'})).toBeNull();
  tab('Dados');expect(container.textContent).not.toContain(data.employees[0].cpf);expect(container.textContent).not.toContain(data.employees[0].email);expect(container.textContent).not.toContain('Rua de Testes');
  expect(screen.queryByRole('button',{name:'Editar cadastro'})).toBeNull();expect(employeeDocumentsRequest).not.toHaveBeenCalled();
});
it('registra aviso e providências pelo comando oficial sem alterar o ponto ou os pagamentos',async()=>{
  let data=base();const before=structuredClone(data),user={id:'eng',nome:'Engenharia QA',role:'engenheiro',obraId:'piloto-k110'};
  const dispatch=vi.fn(async command=>{const result=applyOperationalCommand(data,stampEmployeeEngineeringCommand(command,user,'2026-10-25T12:00:00.000Z'));if(result.ok){data=result.data;root.render(<EmployeeFile {...props} employee={data.employees[0]} data={data} currentUser={user} dispatchCommand={dispatch}/>);}return result;});
  await render(data,user,dispatch);tab('Engenharia');
  change('Título do aviso','Conferir integração');change('Descrição do aviso operacional','Conferir orientação operacional antes da atividade.');
  await act(async()=>screen.getByRole('button',{name:'Registrar aviso'}).click());
  expect(data.employeeEngineeringRecords[0]).toMatchObject({createdBy:'eng',status:'pending'});
  change('Providência para Conferir integração','Orientação confirmada pelo responsável da obra.');
  await act(async()=>screen.getByRole('button',{name:'Marcar ciente'}).click());
  expect(data.employeeEngineeringRecords[0].status).toBe('acknowledged');
  change('Providência para Conferir integração','Atividade liberada depois de concluída a orientação.');
  await act(async()=>screen.getByRole('button',{name:'Resolver aviso'}).click());
  expect(data.employeeEngineeringRecords[0].history).toHaveLength(3);
  expect(data.attendance).toEqual(before.attendance);expect(data.titulosFolha).toEqual(before.titulosFolha);
});
it('envia aviso à lotação vigente quando já existe transferência futura no cadastro',async()=>{
  let data=base();data.employees[0]={...data.employees[0],obra:'obra-futura',obraHistory:[{date:'2099-11-01',fromObraId:'piloto-k110',toObraId:'obra-futura'}]};data.obras.push({id:'obra-futura',name:'Obra futura'});
  const user={id:'eng',nome:'Engenharia QA',role:'engenheiro',obraId:'piloto-k110'};
  const dispatch=vi.fn(async command=>{const result=applyOperationalCommand(data,stampEmployeeEngineeringCommand(command,user,'2026-10-25T12:00:00.000Z'));if(result.ok)data=result.data;return result;});
  await render(data,user,dispatch);tab('Engenharia');change('Título do aviso','Orientação vigente');change('Descrição do aviso operacional','Conferir a orientação na obra vigente hoje.');
  await act(async()=>screen.getByRole('button',{name:'Registrar aviso'}).click());
  expect(dispatch.mock.calls[0][0].payload.record.obraId).toBe('piloto-k110');
  expect(data.employeeEngineeringRecords[0]).toMatchObject({obraId:'piloto-k110',status:'pending'});
});
it('identifica ponto arquivado e consulta o arquivo existente sem restaurar nem alterar o ponto atual',async()=>{
  const data=base(),before=structuredClone(data);data.attendance={};data.quinzenasArquivadas={'2026-10-Q1':{inicio:'2026-10-06',fim:'2026-10-20',label:'Outubro — primeira quinzena'}};
  carregarQuinzenaArquivada.mockResolvedValue({ok:true,arquivo:{attendance:before.attendance}});
  await render(data);tab('Ponto');
  expect(screen.getByRole('row',{name:/2026-10-20/}).textContent).toContain('Em arquivo — consultar');
  await act(async()=>screen.getByRole('button',{name:'Consultar arquivo Outubro — primeira quinzena'}).click());
  expect(carregarQuinzenaArquivada).toHaveBeenCalledWith('2026-10-Q1');
  const row=screen.getByRole('row',{name:/2026-10-20/});expect(row.textContent).toContain('08:00 · 17:00');expect(row.textContent).toContain('Arquivo consultado');
  expect(data.attendance).toEqual({});
});
