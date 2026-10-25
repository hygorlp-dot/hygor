import {describe,expect,it} from 'vitest';
import {applyEmployeeCommand,EMPLOYEE_COMMAND} from './employee-commands.js';
import {newProvisionDraft} from '../ponto/labor-provisions.js';
import {employeeCostReport} from './employee-costs.js';

const employee=()=>({id:'siclano',name:'Siclano fictício',role:'Ajudante',startDate:'2026-10-06',active:true,version:1,dailyRate:120,remunerationMode:'daily',employmentRelationship:'clt',employmentRelationshipEffectiveFrom:'2026-10-06',obra:'obra-qa'});
const state=()=>({employees:[employee()],obras:[{id:'obra-qa'}],ponto:{},config:{},titulosFolha:[],liquidacoesFolha:[],financialSettlements:[],changeLog:[]});
const reserve=()=>({...newProvisionDraft(employee(),'2026-10'),base:2550,average:50,fgtsPercent:8,finePercent:40,fgtsOnVacation:true,
  assessmentReference:'QA-101',assessmentResponsible:'Contabilidade fictícia',assessmentMemory:'Base independente informada para ensaio da reserva; médias e incidências conferidas.',assessmentConfirmed:true});
const command=record=>({type:EMPLOYEE_COMMAND.EMPLOYEE_SAVED,expectedVersion:1,actorId:'rh-qa',actorName:'RH fictício',payload:{employee:record}});

describe('reserva manual de CLT por diária pelo cadastro oficial',()=>{
  it('impede salvar exclusão silenciosa, método forjado ou base sem origem',()=>{
    for(const changes of [{included:false},{assessmentMethod:'automatic',assessmentReference:''},{assessmentResponsible:''},{assessmentMemory:''},{assessmentConfirmed:false},{fgtsPercent:''}]){
      const data=state(),before=structuredClone(data),record={...employee(),laborProvisions:{'2026-10':{...reserve(),...changes}}};
      expect(applyEmployeeCommand(data,command(record)).ok).toBe(false);
      expect(data).toEqual(before);
    }
  });
  it('carimba autor e data no servidor sem criar pagamento nem alterar salário ou ponto',()=>{
    const data=state(),record={...employee(),laborProvisions:{'2026-10':{...reserve(),manualAssessmentAudit:{reviewedBy:'forjado',reviewedAt:'2000-01-01'}}}};
    const response=applyEmployeeCommand(data,command(record),'2026-10-25T12:00:00.000Z');
    expect(response.ok).toBe(true);
    const saved=response.data.employees[0];
    expect(saved.laborProvisions['2026-10']).toMatchObject({assessmentMethod:'manual_daily_clt_reserve',updatedBy:'rh-qa',manualAssessmentAudit:{reviewedBy:'rh-qa',reviewedByName:'RH fictício',reviewedAt:'2026-10-25T12:00:00.000Z',reference:'QA-101'}});
    expect(saved.monthlySalary).toBeUndefined();expect(saved.dailyRate).toBe(120);
    for(const key of ['ponto','titulosFolha','liquidacoesFolha','financialSettlements'])expect(response.data[key]).toEqual(data[key]);
    expect(employeeCostReport(response.data,'2026-10').rows[0].provision?.monthly).toBe(645.38);
  });
  it('não transforma ausência, booleano ou espaços em percentual zero auditado',()=>{
    for(const key of ['base','average','fgtsPercent','finePercent','extraReserve'])for(const value of [null,undefined,false,true,'   ',[]]){
      const record={...employee(),laborProvisions:{'2026-10':{...reserve(),[key]:value}}};
      expect(applyEmployeeCommand(state(),command(record)).ok,`${key}: ${String(value)}`).toBe(false);
    }
    for(const explicitZero of [0,'0']){
      const record={...employee(),laborProvisions:{'2026-10':{...reserve(),fgtsPercent:explicitZero,finePercent:explicitZero}}};
      expect(applyEmployeeCommand(state(),command(record)).ok).toBe(true);
    }
  });
  it('preserva reserva antiga ao editar telefone e sinaliza falta de memória no relatório',()=>{
    const stored={...reserve(),included:false,assessmentMethod:undefined,assessmentReference:undefined,assessmentResponsible:undefined,assessmentMemory:undefined,assessmentConfirmed:undefined};
    const before={...employee(),laborProvisions:{'2026-10':stored}},data={...state(),employees:[before]};
    const response=applyEmployeeCommand(data,command({...before,phone:'81900000000'}));
    expect(response.ok).toBe(true);expect(response.data.employees[0].laborProvisions['2026-10']).toEqual(stored);
    expect(employeeCostReport(response.data,'2026-10').rows[0].provision).toBeNull();
  });
});
