import {describe,it,expect,vi} from 'vitest';
import {applyAttendanceCommand,ATTENDANCE_COMMAND} from './attendance-command.js';
import {loadMobileAttendanceSource} from './attendance-mobile-source.js';
import {applyAdvanceCommand,ADVANCE_COMMAND} from '../src/domains/rh/advance-commands.js';
const day='2026-10-01',user={id:'rh',role:'rh'};
const data=()=>({employees:[{id:'e',active:true,obra:'A',attendancePunchMode:'entry_exit',workBreakStart:'08:00',workBreakEnd:'09:00',workdayHours:4,timeBankEnabled:true}],obras:[{id:'A'},{id:'B'}],attendance:{},attendanceLocks:{},titulosFolha:[],payments:[{id:'real',amount:800}],bankTransactions:[{id:'pix',amount:800}]});
const source=()=>({employeeId:'e',date:day,proposal:{marcacoes:[{eventId:'1',marcadoEm:`${day}T10:00:00Z`,obraCapturaId:'A',horaConfiavel:true},{eventId:'2',marcadoEm:`${day}T15:00:00Z`,obraCapturaId:'A',horaConfiavel:true}],avisos:[]},appropriations:[{id:'a',version:1,inicio:`${day}T10:00:00Z`,fim:`${day}T15:00:00Z`,obraApropriadaId:'A',status:'ativa'}]});
const command=()=>({action:ATTENDANCE_COMMAND.IMPORT_MOBILE,operationId:'10000000-0000-4000-8000-000000000001',employeeId:'e',date:day,status:'P',ot:0,atrasoMin:0,bankMinutes:0,note:'Jornada conferida pelo RH',sourceEventIds:['1','2'],appropriationVersions:[{id:'a',version:1}],record:{entrada:'00:00',obraId:'B'}});
const run=(d=data(),c=command(),s=source(),u=user)=>applyAttendanceCommand(d,u,c,'2026-10-02T12:00:00Z',s);
describe('importação móvel para ponto operacional',()=>{
  it('solicitação de adiantamento não fecha o dia e permite importar as batidas conferidas',()=>{
    const request=applyAdvanceCommand(data(),{type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED,
      actorId:user.id,payload:{advance:{id:'advance-import',empId:'e',date:day,firstDueDate:'2026-10-20',amount:200}}},`${day}T12:00:00Z`);
    expect(request.ok).toBe(true);expect(request.data.titulosFolha[0].snapshotCalculo.kind).toBe('advance');
    const imported=run(request.data);
    expect(imported.ok).toBe(true);expect(imported.data.titulosFolha).toEqual(request.data.titulosFolha);
  });
  it('título CLT do mês anterior não fecha ponto do mês seguinte incluído no corte de pagamento',()=>{
    const d=data();d.titulosFolha=[{employeeId:'e',competencia:'2026-09',periodoInicio:'2026-09-21',periodoFim:'2026-10-05',status:'pago',snapshotCalculo:{kind:'clt'}}];
    expect(run(d).ok).toBe(true);
    d.titulosFolha[0].competencia='2026-10';expect(run(d).ok).toBe(false);
  });
  it('referência de hora ausente também exige tratamento próprio',()=>{
    const s=source();delete s.proposal.marcacoes[0].horaConfiavel;
    expect(run(data(),command(),s)).toMatchObject({ok:false,status:409});
  });
  it('usa fonte exclusiva do servidor, registra uma presença e preserva originais e pagamentos',()=>{
    const d=data(),s=source(),before=structuredClone({d,s}),r=run(d,command(),s);
    expect(r.ok).toBe(true);expect(r.result.attendance).toHaveLength(1);
    expect(r.data.attendance.e[day]).toMatchObject({entrada:'07:00',intervaloSaida:'08:00',intervaloRetorno:'09:00',saida:'12:00',workedMinutes:240,breakSource:'preassigned',punchMode:'entry_exit',bankMinutes:0,status:'P',obraId:'A',mobileSource:{eventIds:['1','2'],reviewedBy:'rh'}});
    expect(r.data.payments).toEqual(d.payments);expect(r.data.bankTransactions).toEqual(d.bankTransactions);expect({d,s}).toEqual(before);
    expect(run(data(),{...command(),mobileSource:s},null).ok).toBe(false);
  });
  it('retry da mesma operação é idempotente inclusive após fechamento; nova operação não duplica',()=>{
    const first=run(),closed={...first.data,attendanceLocks:{[`${day}__A`]:{locked:true}}};
    expect(run(closed).idempotent).toBe(true);expect(run(first.data,{...command(),operationId:'10000000-0000-4000-8000-000000000002'})).toMatchObject({ok:false,status:409});
  });
  it('recusa fotos antigas de capturas e versões, sem aceitar horários enviados pelo cliente',()=>{
    expect(run(data(),{...command(),sourceEventIds:['1']}).status).toBe(409);
    expect(run(data(),{...command(),appropriationVersions:[{id:'a',version:2}]}).status).toBe(409);
    const s=source();s.proposal.marcacoes.push({...s.proposal.marcacoes[1],eventId:'3'});expect(run(data(),command(),s).ok).toBe(false);
  });
  it.each([
    {attendanceLocks:{[`${day}__A`]:{locked:true}}},
    {attendance:{e:{[day]:{status:'F',obraId:'A'}}}},
    {quinzenasArquivadas:{q:{inicio:'2026-09-21',fim:'2026-10-05'}}},
    {titulosFolha:[{employeeId:'e',periodoInicio:'2026-09-21',periodoFim:'2026-10-05',status:'pago',valorPago:800}]},
    {fechamentosFinanceiros:[{status:'fechado',dataInicio:day,dataFim:day}]},
  ])('preserva período já registrado/fechado %#',patch=>{const d={...data(),...patch},before=structuredClone(d);expect(run(d).ok).toBe(false);expect(d).toEqual(before);});
  it('não infere presença, hora extra ou atraso e mantém permissões',()=>{
    expect(run(data(),{...command(),status:''}).ok).toBe(false);expect(run(data(),{...command(),ot:6}).ok).toBe(false);expect(run(data(),{...command(),note:''}).ok).toBe(false);
    expect(run(data(),command(),source(),{id:'a',role:'auditor'}).status).toBe(403);
    expect(run(data(),command(),source(),{id:'b',role:'engenheiro',obraId:'B'}).status).toBe(403);
  });
  it('separa hora extra paga de crédito no banco e limita o saldo ao excedente real',()=>{
    const s=source();s.proposal.marcacoes[1].marcadoEm=`${day}T16:00:00Z`;s.appropriations[0].fim=`${day}T16:00:00Z`;
    expect(run(data(),{...command(),bankMinutes:60},s).data.attendance.e[day].bankMinutes).toBe(60);
    expect(run(data(),{...command(),bankMinutes:61},s).ok).toBe(false);
    expect(run(data(),{...command(),ot:1,bankMinutes:1},s).ok).toBe(false);
    const disabled=data();disabled.employees[0].timeBankEnabled=false;
    expect(run(disabled,{...command(),bankMinutes:1},s).ok).toBe(false);
  });
  it('apropriação em outra obra mantém captura, mas multiobra e relógio inseguro exigem tratamento',()=>{
    const s=source();s.appropriations[0].obraApropriadaId='B';expect(run(data(),command(),s).data.attendance.e[day]).toMatchObject({obraId:'B',mobileSource:{captureObraId:'A'}});
    s.proposal.marcacoes[0].horaConfiavel=false;expect(run(data(),command(),s).ok).toBe(false);
    const multi=source();multi.proposal.marcacoes[1].obraCapturaId='B';expect(run(data(),command(),multi).ok).toBe(false);
  });
  it('leitor transacional filtra empresa/funcionário/dia e deriva a proposta dos eventos persistidos',async()=>{
    const tagged=vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{event_id:'1',marcado_em:`${day}T10:00:00Z`,obra_id:'A',hora_confiavel:true},{event_id:'2',marcado_em:`${day}T15:00:00Z`,obra_id:'A',hora_confiavel:true}]).mockResolvedValueOnce([{id:'a',employee_id:'e',inicio:`${day}T10:00:00Z`,fim:`${day}T15:00:00Z`,obra_apropriada_id:'A',status:'ativa',version:1}]);
    const s=await loadMobileAttendanceSource(tagged,{company:'company',employeeId:'e',date:day});expect(tagged).toHaveBeenCalledTimes(4);expect(tagged.mock.calls[1][0].join('')).toContain('share mode');expect(tagged.mock.calls[2].slice(1)).toEqual(['company','e',`${day}T03:00:00.000Z`,'2026-10-02T02:59:59.999Z']);expect(run(data(),command(),s).ok).toBe(true);
    expect(await loadMobileAttendanceSource(tagged,{company:'company',employeeId:'e',date:'2026-02-31'})).toBeNull();
  });
});
