import { describe, expect, it } from "vitest";
import {
  applyEmployeeCommand,
  EMPLOYEE_COMMAND,
  employeeCommandObraId,
  employeeLifecycleStatus,
} from "./employee-commands.js";

const base = () => ({
  employees:[],
  obras:[{ id:"obra-1", name:"Obra A" }, { id:"obra-2", name:"Obra B" }],
  changeLog:[],
});
const employee = overrides => ({
  id:"emp-1",
  name:"José da Silva",
  role:"Pedreiro",
  obra:"obra-1",
  dailyRate:150,
  startDate:"2026-01-10",
  active:true,
  ...overrides,
});
const command = (record, expectedVersion = 0) => ({
  type:EMPLOYEE_COMMAND.EMPLOYEE_SAVED,
  idempotencyKey:"employee-command-0001",
  expectedVersion,
  actorId:"rh-1",
  actorName:"Operador RH",
  payload:{ employee:record },
});

describe("comando transacional de funcionários", () => {
  it("valida CLT mensal sem modificar pagamentos ou a diária de custeio",()=>{
    expect(applyEmployeeCommand(base(),command(employee({remunerationMode:"clt",monthlySalary:0}))).ok).toBe(false);
    const state={...base(),financialSettlements:[{id:"real",amount:600}]};
    const result=applyEmployeeCommand(state,command(employee({remunerationMode:"clt",monthlySalary:2406.8})));
    expect(result.ok).toBe(true);expect(result.data.employees[0]).toMatchObject({dailyRate:150,monthlySalary:2406.8,remunerationMode:"clt"});
    expect(result.data.financialSettlements).toEqual(state.financialSettlements);
  });
  it("cria um cadastro validado e auditável", () => {
    const result = applyEmployeeCommand(
      base(),
      command(employee()),
      "2026-07-29T10:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    expect(result.data.employees[0]).toMatchObject({
      id:"emp-1",
      dailyRate:150,
      workdayHours:8,
      version:1,
      createdById:"rh-1",
    });
    expect(result.data.changeLog[0]).toMatchObject({
      type:"created",
      empId:"emp-1",
      operador:"Operador RH",
    });
  });

  it("impede obra inexistente, diária inválida e datas incoerentes", () => {
    expect(applyEmployeeCommand(base(), command(employee({ obra:"fantasma" }))).reason)
      .toMatch(/obra.*não existe/i);
    expect(applyEmployeeCommand(base(), command(employee({ dailyRate:-1 }))).reason)
      .toMatch(/diária positiva/i);
    expect(applyEmployeeCommand(base(), command(employee({
      active:false,
      endDate:"2025-12-01",
    }))).reason).toMatch(/não pode anteceder/i);
  });

  it("protege edição concorrente pela versão do funcionário", () => {
    const data = {
      ...base(),
      employees:[{ ...employee(), version:2 }],
    };
    const result = applyEmployeeCommand(data, command(employee({ role:"Mestre" }), 1));
    expect(result.reason).toMatch(/alterado por outra pessoa/i);
  });

  it("registra transferência, alteração de diária e desligamento sem apagar", () => {
    const data = {
      ...base(),
      employees:[{ ...employee(), version:1 }],
    };
    const result = applyEmployeeCommand(
      data,
      command(employee({
        obra:"obra-2",
        dailyRate:180,
        active:false,
        endDate:"2026-07-29",
        terminationReason:"Demitido",
      }), 1),
      "2026-07-29T11:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    expect(result.data.employees).toHaveLength(1);
    expect(result.data.employees[0]).toMatchObject({
      obra:"obra-2",
      active:false,
      lastObra:"obra-1",
      version:2,
    });
    expect(result.data.changeLog.map(item => item.type)).toEqual([
      "transfer",
      "dismissal",
      "salary_change",
    ]);
    expect(employeeCommandObraId(data, command(employee({ obra:"obra-2" }), 1)))
      .toBe("obra-2");
  });

  it("reativa preservando o cadastro e incrementando a versão", () => {
    const data = {
      ...base(),
      employees:[{
        ...employee(),
        active:false,
        endDate:"2026-07-20",
        terminationReason:"Demitido",
        version:3,
      }],
    };
    const result = applyEmployeeCommand(
      data,
      command(employee({ active:true, endDate:"", terminationReason:"" }), 3),
    );
    expect(result.data.employees[0]).toMatchObject({
      active:true,
      endDate:"",
      version:4,
    });
    expect(result.data.changeLog.at(-1).type).toBe("reactivation");
  });

  it("agenda um desligamento futuro sem retirar antes do último dia trabalhado", () => {
    const data = { ...base(), employees:[{ ...employee(), version:1 }] };
    const result = applyEmployeeCommand(data, command(employee({
      active:true,
      status:"desligamento_agendado",
      endDate:"2026-08-20",
      terminationReason:"Término de contrato",
    }), 1), "2026-08-05T10:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.employees[0]).toMatchObject({
      active:true,
      status:"desligamento_agendado",
      endDate:"2026-08-20",
    });
    expect(employeeLifecycleStatus(result.data.employees[0], "2026-08-05")).toBe("desligamento_agendado");
    expect(employeeLifecycleStatus(result.data.employees[0], "2026-08-21")).toBe("desligado");
    expect(result.data.changeLog.at(-1).type).toBe("dismissal_scheduled");
  });
});


describe("desligamento de cadastro legado sem admissão conhecida", () => {
  const now = "2026-10-30T20:00:00.000Z";
  const legacy = employee({startDate:"0001-01-01",version:3});
  const state = () => ({...base(),employees:[legacy],payments:[{id:"real",amount:100}],attendance:{"emp-1":{"2026-09-15":{status:"P"}}}});
  const terminated = extra => ({...legacy,active:false,status:"desligado",endDate:"2026-09-30",terminationReason:"Desligamento informado pelo administrador",...extra});
  it("encerra o vínculo, preservando admissão desconhecida, ponto e pagamentos", () => {
    const data=state(),r=applyEmployeeCommand(data,command(terminated(),3),now);
    expect(r.ok).toBe(true);
    expect(r.data.employees[0]).toMatchObject({startDate:"0001-01-01",endDate:"2026-09-30",active:false,status:"desligado",workSchedules:[]});
    expect(r.data.attendance).toEqual(data.attendance);expect(r.data.payments).toEqual(data.payments);
    expect(r.data.changeLog.some(e=>e.type==="dismissal")).toBe(true);
  });
  it.each([{dailyRate:999},{role:"Outra"},{startDate:""},{workScheduleDraft:{code:"44h-seg-sex",effectiveFrom:"2026-10-29"}},{active:true},{endDate:"2026-11-01"},{endDate:"2026-02-31"}])("não permite alteração paralela ou data inválida/futura: %j",extra=>{
    expect(applyEmployeeCommand(state(),command(terminated(extra),3),now).ok).toBe(false);
  });
  it("não permite criar cadastro inválido nem reativar vínculo legado",()=>{
    expect(applyEmployeeCommand(base(),command(terminated()),now).ok).toBe(false);
    const inactive={...legacy,active:false,status:"desligado",endDate:"2026-09-30"};
    expect(applyEmployeeCommand({...state(),employees:[inactive]},command({...inactive,active:true,endDate:""},3),now).ok).toBe(false);
  });
  it("mantém a proteção de edição concorrente",()=>{
    expect(applyEmployeeCommand(state(),command(terminated(),2),now).reason).toMatch(/alterado por outra pessoa/);
  });
});
