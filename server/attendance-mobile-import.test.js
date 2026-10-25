import {describe,it,expect,vi} from 'vitest';
import {applyAttendanceCommand,ATTENDANCE_COMMAND} from './attendance-command.js';
import {loadMobileAttendanceSource} from './attendance-mobile-source.js';
const day='2026-10-01',user={id:'rh',role:'rh'};
const data=()=>({employees:[{id:'e',active:true,obra:'A'}],obras:[{id:'A'},{id:'B'}],attendance:{},attendanceLocks:{},titulosFolha:[],payments:[{id:'real',amount:800}],bankTransactions:[{id:'pix',amount:800}]});
const baseSource=()=>({employeeId:'e',date:day,proposal:{marcacoes:[{eventId:'1',marcadoEm:`${day}T10:00:00Z`,obraCapturaId:'A',horaConfiavel:true},{eventId:'2',marcadoEm:`${day}T15:00:00Z`,obraCapturaId:'A',horaConfiavel:true}],avisos:[]},appropriations:[{id:'a',version:1,inicio:`${day}T10:00:00Z`,fim:`${day}T15:00:00Z`,obraApropriadaId:'A',status:'ativa'}]});
const source=()=>{const s=baseSource();return {...s,companyId:'company',fuso:'America/Recife',eventos:s.proposal.marcacoes.map((e,i)=>({...e,companyId:'company',employeeId:'e',tipoRegistro:'ponto',dispositivoId:'d',estabelecimentoId:'est',nsr:i+1,fuso:'America/Recife'}))};};
const command=()=>({action:ATTENDANCE_COMMAND.IMPORT_MOBILE,operationId:'10000000-0000-4000-8000-000000000001',employeeId:'e',date:day,status:'P',ot:0,atrasoMin:0,note:'Jornada conferida pelo RH',sourceEventIds:['1','2'],appropriationVersions:[{id:'a',version:1}],record:{entrada:'00:00',obraId:'B'}});
const run=(d=data(),c=command(),s=source(),u=user)=>applyAttendanceCommand(d,u,c,'2026-10-02T12:00:00Z',s);
describe('importação móvel para ponto operacional',()=>{
  it('recusa origem fiscal ausente e preserva entrada',()=>{
    const s=source();s.eventos[0].nsr=null;expect(run(data(),command(),s)).toMatchObject({ok:false,status:409});
    s.eventos[0].nsr=1;s.eventos[0].fuso='UTC';expect(run(data(),command(),s).ok).toBe(false);
  });
  it('referência de hora ausente também exige tratamento próprio',()=>{
    const s=source();delete s.proposal.marcacoes[0].horaConfiavel;
    expect(run(data(),command(),s)).toMatchObject({ok:false,status:409});
  });
  it('usa fonte exclusiva do servidor, registra uma presença e preserva originais e pagamentos',()=>{
    const d=data(),s=source(),before=structuredClone({d,s}),r=run(d,command(),s);
    expect(r.ok).toBe(true);expect(r.result.attendance).toHaveLength(1);
    expect(r.data.attendance.e[day]).toMatchObject({entrada:'07:00',saida:'12:00',workedMinutes:300,status:'P',obraId:'A',mobileSource:{eventIds:['1','2'],reviewedBy:'rh'}});
    expect(r.data.attendance.e[day].mobileSource.publicacao).toMatchObject({contratoVersao:1,companyId:'company',estado:'aprovado',intervalos:[{eventIds:['1','2'],obraApropriadaId:'A',duracaoMs:18000000}]});expect(r.data.payments).toEqual(d.payments);expect(r.data.bankTransactions).toEqual(d.bankTransactions);expect({d,s}).toEqual(before);
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
  it('apropriação em outra obra mantém captura, mas multiobra e relógio inseguro exigem tratamento',()=>{
    const s=source();s.appropriations[0].obraApropriadaId='B';expect(run(data(),command(),s).data.attendance.e[day]).toMatchObject({obraId:'B',mobileSource:{captureObraId:'A'}});
    s.proposal.marcacoes[0].horaConfiavel=false;expect(run(data(),command(),s).ok).toBe(false);
    const multi=source();multi.proposal.marcacoes[1].obraCapturaId='B';expect(run(data(),command(),multi).ok).toBe(false);
  });
  it('leitor transacional filtra empresa/funcionário/dia e deriva a proposta dos eventos persistidos',async()=>{
    const tagged=vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{event_id:'1',dispositivo_id:'d',estabelecimento_id:'est',nsr:1,timezone:'America/Recife',marcado_em:`${day}T10:00:00Z`,obra_id:'A',hora_confiavel:true},{event_id:'2',dispositivo_id:'d',estabelecimento_id:'est',nsr:2,timezone:'America/Recife',marcado_em:`${day}T15:00:00Z`,obra_id:'A',hora_confiavel:true}]).mockResolvedValueOnce([{id:'a',employee_id:'e',inicio:`${day}T10:00:00Z`,fim:`${day}T15:00:00Z`,obra_apropriada_id:'A',status:'ativa',version:1}]);
    const s=await loadMobileAttendanceSource(tagged,{company:'company',employeeId:'e',date:day});expect(tagged).toHaveBeenCalledTimes(4);expect(tagged.mock.calls[1][0].join('')).toContain('share mode');expect(tagged.mock.calls[2].slice(1)).toEqual(['company','e',`${day}T03:00:00.000Z`,'2026-10-02T02:59:59.999Z']);expect(run(data(),command(),s).ok).toBe(true);
    expect(await loadMobileAttendanceSource(tagged,{company:'company',employeeId:'e',date:'2026-02-31'})).toBeNull();
  });
});
