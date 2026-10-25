import {describe,expect,it} from 'vitest';
import {applyOperationalCommand,OPERATIONAL_COMMAND} from '../sync/operational-commands.js';
import {employeeEngineeringScope,stampEmployeeEngineeringCommand} from './employee-engineering.js';
import {projectDataForUser} from '../../../server/data-projection.js';
const now='2026-10-25T12:00:00.000Z';
const state=()=>({employees:[{id:'siclano',name:'Siclano',obra:'A',startDate:'2026-10-06',active:true}],obras:[{id:'A'},{id:'B'}],attendance:{siclano:{'2026-10-24':{status:'P',obraId:'A'}}},titulosFolha:[{id:'pago',liquido:100}],employeeEngineeringRecords:[]});
const actor={id:'eng-a',nome:'Engenharia A',role:'engenheiro',obraId:'A'};
const create=()=>stampEmployeeEngineeringCommand({type:OPERATIONAL_COMMAND.EMPLOYEE_ENGINEERING_CREATED,idempotencyKey:'worker-notice-create-0001',expectedVersion:0,
  actorId:'forjado',actorRole:'admin',now:'2000-01-01T00:00:00Z',payload:{record:{id:'aviso-0001',employeeId:'siclano',obraId:'A',kind:'orientation',title:'Integração na obra',message:'Conferir orientação operacional antes da nova atividade.',createdBy:'forjado',createdAt:'2000',history:[{private:true}]}}},actor,now);
describe('avisos da engenharia na ficha do operário',()=>{
  it('registra autor real, data do servidor e histórico; reenvio não duplica nem mexe em ponto ou pagamento',()=>{
    const data=state(),result=applyOperationalCommand(data,create());
    expect(result.ok).toBe(true);
    const record=result.data.employeeEngineeringRecords[0];
    expect(record).toMatchObject({createdBy:'eng-a',createdByName:'Engenharia A',createdAt:now,status:'pending',version:1});
    expect(record.history).toEqual([{actorId:'eng-a',actorName:'Engenharia A',actorRole:'engenheiro',at:now,status:'pending',note:'Aviso registrado'}]);
    expect(result.data.attendance).toEqual(data.attendance);expect(result.data.titulosFolha).toEqual(data.titulosFolha);
    const retry=applyOperationalCommand(result.data,create());expect(retry.idempotent).toBe(true);expect(retry.data.employeeEngineeringRecords).toHaveLength(1);
  });
  it('recusa outro papel, outra obra, funcionário de outra lotação e tentativa de trocar obra na atualização',()=>{
    expect(employeeEngineeringScope({...actor,role:'financeiro'},state(),create()).ok).toBe(false);
    expect(employeeEngineeringScope({...actor,obraId:'B'},state(),create()).ok).toBe(false);
    const foreign={...create(),payload:{record:{...create().payload.record,obraId:'B'}},actorRole:'admin'};
    expect(applyOperationalCommand(state(),foreign).ok).toBe(false);
    const saved=applyOperationalCommand(state(),create()).data;
    const update={type:OPERATIONAL_COMMAND.EMPLOYEE_ENGINEERING_STATUS_SET,payload:{recordId:'aviso-0001',obraId:'B'}};
    expect(employeeEngineeringScope({...actor,obraId:'B'},saved,update).ok).toBe(false);
  });
  it('guarda providência por versão e preserva encerrados; engenharia não cancela aviso',()=>{
    let data=applyOperationalCommand(state(),create()).data;
    const change=(status,version,key,as=actor)=>stampEmployeeEngineeringCommand({type:OPERATIONAL_COMMAND.EMPLOYEE_ENGINEERING_STATUS_SET,idempotencyKey:key,expectedVersion:version,payload:{recordId:'aviso-0001',status,note:'Providência registrada para conferência.'}},as,now);
    expect(applyOperationalCommand(data,change('cancelled',1,'worker-cancel-0001')).ok).toBe(false);
    data=applyOperationalCommand(data,change('acknowledged',1,'worker-aware-0001')).data;
    expect(applyOperationalCommand(data,change('resolved',1,'worker-stale-0001')).ok).toBe(false);
    data=applyOperationalCommand(data,change('resolved',2,'worker-resolve-0001')).data;
    expect(data.employeeEngineeringRecords[0].history).toHaveLength(3);
    expect(applyOperationalCommand(data,change('pending',3,'worker-reopen-0001')).ok).toBe(false);
  });
  it('projeta aviso somente na obra autorizada e mantém documentos/valores pessoais fora da engenharia',()=>{
    const data=applyOperationalCommand(state(),create()).data;
    data.employees[0].cltPayroll={drafts:{private:true}};data.employees[0].birthDate='1990-01-01';
    const own=projectDataForUser(data,actor),other=projectDataForUser(data,{...actor,obraId:'B'});
    expect(own.employeeEngineeringRecords).toHaveLength(1);expect(other.employeeEngineeringRecords).toEqual([]);
    expect(own.employees[0].cltPayroll).toBeUndefined();expect(own.employees[0].birthDate).toBeUndefined();
    expect(projectDataForUser(data,{id:'rh',role:'rh'}).employees[0].cltPayroll).toEqual(data.employees[0].cltPayroll);
  });
  it('mantém a lotação vigente e a identidade mínima para consultar avisos após transferência',()=>{
    const data=state();data.attendance={};data.employees[0]={...data.employees[0],obra:'B',cpf:'Privado',obraHistory:[{date:'2026-11-01',fromObraId:'A',toObraId:'B'}]};
    data.employeeEngineeringRecords=[{id:'aviso-a',employeeId:'siclano',obraId:'A',status:'pending'},{id:'aviso-b',employeeId:'siclano',obraId:'B',status:'pending'}];
    const current=projectDataForUser(data,actor,'2026-10-25');
    expect(current.employees.map(employee=>employee.id)).toEqual(['siclano']);expect(current.employees[0]).not.toHaveProperty('engineeringHistoryOnly');
    expect(current.employeeEngineeringRecords.map(record=>record.id)).toEqual(['aviso-a']);
    const past=projectDataForUser(data,actor,'2026-11-02');
    expect(past.employees).toEqual([{id:'siclano',name:'Siclano',role:undefined,engineeringHistoryOnly:true,engineeringScopeObraId:'A'}]);
    expect(past.employeeEngineeringRecords.map(record=>record.id)).toEqual(['aviso-a']);
    expect(past.attendance).toEqual({});
  });
});
