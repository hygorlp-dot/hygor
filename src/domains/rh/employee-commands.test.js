import { describe, expect, it } from "vitest";
import {
  applyEmployeeCommand,
  EMPLOYEE_COMMAND,
  employeeCommandObraId,
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
});
