import {describe,it,expect} from 'vitest';
import {applyEmployeeCommand,EMPLOYEE_COMMAND} from './employee-commands.js';
import {employeeEditDraft} from './employee-edit-draft.js';
import {payModeRegistrationIssues} from './attendance-pay-mode.js';

const worker=overrides=>({id:'piloto-k110-siclano',name:'Siclano — SIMULAÇÃO',role:'Servente de obras',
  startDate:'2026-10-06',obra:'piloto-k110',workArea:'campo',active:true,dailyRate:120,remunerationMode:'daily',
  monthlySalary:0,workdayHours:8,workStart:'08:00',vtDaily:0,vrDaily:0,overtimeAdditionalPercent:70,
  cpf:'00010000208',phone:'00900000002',paymentInstructions:'Pagamento exclusivamente simulado.',...overrides});
const dataFor=employees=>({employees,obras:[{id:'piloto-k110'}],changeLog:[]});
const save=(data,employee)=>applyEmployeeCommand(data,{type:EMPLOYEE_COMMAND.EMPLOYEE_SAVED,
  actorId:'rh-qa',actorName:'RH QA',expectedVersion:data.employees[0]?.version||0,payload:{employee}},'2026-10-25T12:00:00Z');

describe('vínculo contratual separado da remuneração',()=>{
  it('registra CLT por diária sem inventar salário mensal, com vigência e autor',()=>{
    const result=save(dataFor([]),worker({employmentRelationship:'clt'}));
    expect(result.ok).toBe(true);
    expect(result.data.employees[0]).toMatchObject({employmentRelationship:'clt',remunerationMode:'daily',
      dailyRate:120,monthlySalary:0,employmentRelationshipEffectiveFrom:'2026-10-06',
      employmentRelationshipHistory:[{date:'2026-10-06',relationship:'clt',changedBy:'rh-qa'}]});
    expect(result.data).not.toHaveProperty('titulosFolha');
  });
  it('não classifica vínculo dos cadastros legados pela modalidade',()=>{
    for(const raw of [worker(),worker({remunerationMode:'clt',monthlySalary:3300})]){
      const result=save(dataFor([]),raw);
      expect(result.ok).toBe(true);
      expect(result.data.employees[0].employmentRelationship).toBe('');
      expect(result.data.employees[0].employmentRelationshipHistory).toEqual([]);
      expect(employeeEditDraft(result.data.employees[0]).employmentRelationship).toBe('');
    }
  });
  it('rejeita vínculo desconhecido e conflito explícito com modalidade mensal CLT',()=>{
    expect(save(dataFor([]),worker({employmentRelationship:'daily'})).reason).toMatch(/vínculo contratual inválido/i);
    expect(save(dataFor([]),worker({employmentRelationship:'autonomous',remunerationMode:'clt',monthlySalary:3300})).reason).toMatch(/mensal CLT.*vínculo/i);
  });
  it('preserva vínculo e histórico ao salvar formulário antigo que não envia esses campos',()=>{
    const before=save(dataFor([]),worker({employmentRelationship:'clt'})).data.employees[0];
    const legacy=worker({version:before.version,role:'Ajudante de pedreiro'});
    const result=save(dataFor([before]),legacy);
    expect(result.ok).toBe(true);
    expect(result.data.employees[0]).toMatchObject({employmentRelationship:'clt',
      employmentRelationshipHistory:before.employmentRelationshipHistory});
  });
  it('não permite apagar ou forjar o histórico pelo cadastro',()=>{
    const before=save(dataFor([]),worker({employmentRelationship:'clt'})).data.employees[0];
    const result=save(dataFor([before]),{...before,employmentRelationshipHistory:[]});
    expect(result.ok).toBe(true);
    expect(result.data.employees[0].employmentRelationshipHistory).toEqual(before.employmentRelationshipHistory);
    expect(save(dataFor([before]),{...before,employmentRelationship:''}).reason).toMatch(/apagar.*vínculo/i);
  });
  it('exige vigência e motivo para definir vínculo de cadastro existente',()=>{
    const before={...worker(),version:1};
    expect(save(dataFor([before]),{...before,employmentRelationship:'clt'}).reason).toMatch(/vigência.*vínculo/i);
    const next={...before,employmentRelationship:'clt',employmentRelationshipEffectiveFrom:'2026-10-06'};
    expect(save(dataFor([before]),next).reason).toMatch(/motivo.*vínculo/i);
    const result=save(dataFor([before]),{...next,employmentRelationshipReason:'Definição conforme contrato de simulação'});
    expect(result.ok).toBe(true);
    expect(result.data.changeLog.at(-1).type).toBe('employment_relationship_change');
  });
  it('impede alterar vínculo dentro de período já encaminhado e conserva versão anterior em vigência futura',()=>{
    const before=save(dataFor([]),worker({employmentRelationship:'clt'})).data.employees[0];
    const data={...dataFor([before]),titulosFolha:[{id:'title',employeeId:before.id,periodoFim:'2026-10-20',status:'em_aberto'}]};
    const change={...before,employmentRelationship:'other',employmentRelationshipEffectiveFrom:'2026-10-19',employmentRelationshipReason:'Alteração contratual identificada em teste'};
    expect(save(data,change).reason).toMatch(/posterior a 2026-10-20/i);
    const result=save(data,{...change,employmentRelationshipEffectiveFrom:'2026-11-01'});
    expect(result.ok).toBe(true);
    expect(result.data.employees[0].employmentRelationshipHistory.map(x=>[x.date,x.relationship])).toEqual([
      ['2026-10-06','clt'],['2026-11-01','other'],
    ]);
  });
  it('exige identificação CLT e ASO para empregado por diária sem exigir salário mensal',()=>{
    const raw=worker({employmentRelationship:'clt'});
    expect(payModeRegistrationIssues(raw,'daily','2026-10-06')).toEqual(expect.arrayContaining(['Matrícula','CBO (seis dígitos)','Categoria na CCT','Validade do ASO na vigência escolhida']));
    const complete={...raw,examExpiresAt:'2027-10-01',cltPayroll:{profile:{registration:'QA-0002',cbo:'717020',category:'helper'}}};
    expect(payModeRegistrationIssues(complete,'daily','2026-10-06')).toEqual([]);
  });
  it('completa placeholder de simulação sem gerar baseline com data de admissão vazia',()=>{
    const placeholder={id:'piloto-k110-siclano',name:'Siclano',testData:true,cadastroPendente:true};
    const raw=worker({employmentRelationship:'clt',employmentRelationshipEffectiveFrom:'2026-10-06',
      employmentRelationshipReason:'Contrato fictício definido para a simulação',
      remunerationValueEffectiveFrom:'2026-10-06',remunerationValueReason:'Primeiro preenchimento do cadastro de simulação',
      testData:true,cadastroPendente:false});
    const result=save(dataFor([placeholder]),raw);
    expect(result.ok).toBe(true);
    const employee=result.data.employees[0];
    expect(employee).toMatchObject({id:placeholder.id,testData:true,cadastroPendente:false,version:1});
    expect(employee.employmentRelationshipHistory).toHaveLength(1);
    expect(employee.remunerationValuesHistory).toHaveLength(1);
    expect([...employee.employmentRelationshipHistory,...employee.remunerationValuesHistory]).toEqual(expect.arrayContaining([
      expect.objectContaining({date:'2026-10-06',changedBy:'rh-qa'}),
    ]));
    expect([...employee.employmentRelationshipHistory,...employee.remunerationValuesHistory].some(item=>!item.date||item.source==='baseline_preservada')).toBe(false);
  });
});
