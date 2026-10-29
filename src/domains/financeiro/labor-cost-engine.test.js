import { describe, expect, it, vi } from "vitest";
import { createLaborCostEngine } from "./labor-cost-engine.js";
import { archivedCltScenario } from "../../fixtures/archived-clt.js";
import { rebuildArchivedLaborCosts } from "../../../server/financial-archived-costs-source.js";
import { getPayrollHolidays,getHolidayPayRule,getAtt,isEmployeeEmployedOnDate,prIsWeekdayIso } from "../ponto/attendance-engine.js";

const dependencies = overrides => ({
  getPayrollHolidays:() => [],
  isWeekdayIso:() => true,
  isEmployeeEmployedOnDate:() => true,
  getAttendance:(data, employeeId, date) => data.attendance?.[employeeId]?.[date] || null,
  getHolidayPayRule:() => ({ amount:0 }),
  ...overrides,
});

describe("motor financeiro de mão de obra", () => {
  it("mantém R$ 2.300 de salário e R$ 25 de benefícios após arquivar CLT antigo",()=>{
    const {data,archiveRows,live}=archivedCltScenario();
    const archived=rebuildArchivedLaborCosts({data,archiveRows}).data;
    const engine=createLaborCostEngine({getPayrollHolidays,getHolidayPayRule,getAttendance:getAtt,
      isEmployeeEmployedOnDate,isWeekdayIso:prIsWeekdayIso});
    const days=Array.from({length:31},(_,i)=>`2026-07-${String(i+1).padStart(2,"0")}`);
    for(const source of [live,archived]){
      expect(engine.calculateWorkLaborCost(source,"o1",days)).toEqual({
        laborCost:2200,benefitCost:0,chargesCost:0,totalCost:2200,
      });
      expect(engine.calculateWorkLaborCost(source,"o2",days)).toEqual({
        laborCost:100,benefitCost:25,chargesCost:0,totalCost:125,
      });
    }
  });

  it("separa custo corrente por obra e soma arquivo histórico sem duplicar", () => {
    const engine = createLaborCostEngine(dependencies());
    const data = {
      config:{},
      employees:[
        { id:"e1", obra:"o1", dailyRate:100, vtDaily:10 },
        { id:"e2", obra:"o2", dailyRate:200, vtDaily:20 },
      ],
      attendance:{
        e1:{ "2026-07-01":{ status:"P", obraId:"o1" } },
        e2:{ "2026-07-01":{ status:"P", obraId:"o2" } },
      },
      archivedLaborCosts:{
        q1:{ byDate:{ "2026-07-01":{ o1:{ laborCost:50, benefitCost:5 } } } },
      },
    };

    expect(engine.calculateWorkLaborCost(data, "o1", ["2026-07-01"])).toEqual({
      chargesCost:0,
      laborCost:150,
      benefitCost:15,
      totalCost:165,
    });
  });

  it("preserva feriado remunerado e reutiliza o resultado em cache", () => {
    const holidayPay = vi.fn(() => ({ amount:100 }));
    const engine = createLaborCostEngine(dependencies({
      getPayrollHolidays:() => ["2026-07-06"],
      getHolidayPayRule:holidayPay,
    }));
    const data = {
      config:{},
      employees:[{ id:"e1", obra:"o1", dailyRate:100 }],
      attendance:{ e1:{ "2026-07-06":null } },
    };
    const days = ["2026-07-06"];

    const first = engine.calculateWorkLaborCost(data, "o1", days);
    const second = engine.calculateWorkLaborCost(data, "o1", days);

    expect(first).toEqual({ chargesCost:0, laborCost:100, benefitCost:0, totalCost:100 });
    expect(second).toBe(first);
    expect(holidayPay).toHaveBeenCalledTimes(1);
  });

  it("CLT mensal mantém o mesmo rateio e benefícios depois de arquivar o ponto",()=>{
    const engine=createLaborCostEngine(dependencies());
    const employee={
      id:"e1",obra:"o1",monthlySalary:3100,
      remunerationMode:"clt",remunerationEffectiveFrom:"2026-01-01",
      dailyRate:100,vtDaily:10,vrDaily:15,startDate:"2026-01-01",
    };
    const days=["2026-07-10"];
    const live={
      config:{},employees:[employee],
      attendance:{e1:{"2026-07-10":{status:"P",obraId:"o2"}}},
      archivedLaborCosts:{},
    };
    const archived={
      config:{},employees:[employee],attendance:{},
      archivedLaborCosts:{
        q1:{
          byDate:{"2026-07-10":{o2:{laborCost:0,benefitCost:25}}},
          cltAllocationByDate:{"2026-07-10":{e1:{obraId:"o2",status:"P"}}},
        },
      },
    };

    expect(engine.calculateWorkLaborCost(live,"o2",days))
      .toEqual(engine.calculateWorkLaborCost(archived,"o2",days));
    expect(engine.calculateWorkLaborCost(archived,"o1",days)).toMatchObject({
      laborCost:0,benefitCost:0,totalCost:0,
    });
  });

  it("feriado CLT usa o último dia trabalhado arquivado para escolher a obra",()=>{
    const engine=createLaborCostEngine(dependencies({
      getPayrollHolidays:()=>["2026-07-11"],
    }));
    const employee={
      id:"e1",obra:"o1",monthlySalary:3100,
      remunerationMode:"clt",remunerationEffectiveFrom:"2026-01-01",
      startDate:"2026-01-01",
    };
    const data={
      config:{},employees:[employee],attendance:{},
      archivedLaborCosts:{
        q1:{
          byDate:{},
          cltAllocationByDate:{"2026-07-10":{e1:{obraId:"o2",status:"P"}}},
        },
      },
    };
    const result=engine.calculateWorkLaborCost(data,"o2",["2026-07-11"]);
    expect(result.laborCost).toBeGreaterThan(0);
    expect(engine.calculateWorkLaborCost(data,"o1",["2026-07-11"]).laborCost).toBe(0);
  });

  it("não transfere o custo histórico para a lotação nova do funcionário",()=>{
    const engine=createLaborCostEngine(dependencies());
    const data={
      config:{},obras:[{id:"o1",name:"Obra antiga"},{id:"o2",name:"Obra nova"}],
      employees:[{
        id:"e1",obra:"o2",dailyRate:100,
        obraHistory:[{date:"2026-07-15",fromObraId:"o1",toObraId:"o2"}],
      }],
      attendance:{e1:{
        "2026-07-10":{status:"P"},
        "2026-07-20":{status:"P"},
      }},
    };
    expect(engine.calculateCurrentCost(data,"o1",["2026-07-10"])).toMatchObject({laborCost:100});
    expect(engine.calculateCurrentCost(data,"o2",["2026-07-10"])).toMatchObject({laborCost:0});
    expect(engine.calculateCurrentCost(data,"o2",["2026-07-20"])).toMatchObject({laborCost:100});
  });

  it("MEI: valor mensal pelos dias úteis, na obra da lotação, sem encargos nem benefícios",()=>{
    const engine=createLaborCostEngine({getPayrollHolidays,getHolidayPayRule,getAttendance:getAtt,isEmployeeEmployedOnDate,isWeekdayIso:prIsWeekdayIso});
    const data={obras:[{id:"o1"},{id:"o2"}],attendance:{},changeLog:[],
      config:{laborCharges:{diaristaPercent:10,inssPatronalPercent:20,ratPercent:3,fap:1,terceirosPercent:5.8,fgtsPercent:8,multaFgtsPercent:40,provisionar13Ferias:true}},
      employees:[{id:"m",name:"MEI",obra:"o2",startDate:"2026-01-01",active:true,remunerationMode:"mei",meiMonthlyValue:4400,dailyRate:0,vtDaily:10,vrDaily:20,
        obraHistory:[{date:"2026-07-16",fromObraId:"o1",toObraId:"o2"}]}]};
    const days=Array.from({length:31},(_,i)=>`2026-07-${String(i+1).padStart(2,"0")}`);
    const uteis=days.filter(prIsWeekdayIso),antes=uteis.filter(date=>date<"2026-07-16").length;
    const o1=engine.calculateWorkLaborCost(data,"o1",days),o2=engine.calculateWorkLaborCost(data,"o2",days);
    expect(o1.laborCost+o2.laborCost).toBeCloseTo(4400,6);
    expect(o1.laborCost).toBeCloseTo(4400/uteis.length*antes,6);
    expect(o1.chargesCost+o2.chargesCost).toBe(0);
    expect(o1.benefitCost+o2.benefitCost).toBe(0);
  });
});

