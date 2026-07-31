import { describe,expect,it } from "vitest";
import {
  attStatus,
  buildPermissionEmail,
  canEditAttendance,
  employeeRelevantInPeriod,
  getAtt,
  getDays,
  getHolidayPayRule,
  getObraAttendanceSummary,
  getOfficialHolidaysCaruaruPE,
  getPayrollPaymentCalendar,
  getPlanningHolidays,
  getQ,
  hasApprovedUnlock,
  toLocalISODate,
} from "./attendance-engine.js";

describe("motor operacional do ponto",()=>{
  it("gera o calendário local e as quinzenas reais sem perder a virada do ano",()=>{
    expect(toLocalISODate(new Date(2026,6,28,12))).toBe("2026-07-28");
    expect(getDays(2026,1)).toHaveLength(28);
    expect(getQ(2026,11).q1).toEqual([
      "2026-12-06","2026-12-07","2026-12-08","2026-12-09","2026-12-10",
      "2026-12-11","2026-12-12","2026-12-13","2026-12-14","2026-12-15",
      "2026-12-16","2026-12-17","2026-12-18","2026-12-19","2026-12-20",
    ]);
    expect(getQ(2026,11).q2.at(-1)).toBe("2027-01-05");
  });

  it("normaliza registros legados e preserva funcionários no período histórico",()=>{
    const data={attendance:{e1:{"2026-07-05":"P","2026-07-08":{status:null,ot:2,note:"apoio"}}}};
    expect(getAtt(data,"e1","2026-07-05")).toEqual({
      status:"P",ot:0,note:"",obraId:"",
    });
    expect(attStatus(data,"e1","2026-07-05")).toBe("P");
    expect(employeeRelevantInPeriod(data,{
      id:"e1",startDate:"2026-01-01",endDate:"2026-06-30",
    },["2026-07-05","2026-07-08"])).toBe(true);
  });

  it("mantém feriados de Caruaru e inclui os feriados cadastrados no planejamento",()=>{
    const official=getOfficialHolidaysCaruaruPE(2026);
    expect(official).toContain("2026-06-24");
    expect(official).toContain("2026-09-15");
    expect(getPlanningHolidays({
      config:{paymentHolidays:[{date:"2026-07-29",name:"Feriado da obra"}]},
    },[2026])).toContainEqual({
      data:"2026-07-29",
      nome:"Feriado da obra",
    });
  });

  it("antecipa sábado e posterga domingo no calendário de pagamento",()=>{
    expect(getPayrollPaymentCalendar(2026,5,"1",{})).toEqual({
      baseDate:"2026-06-20",
      paymentDate:"2026-06-19",
      adjusted:true,
    });
    expect(getPayrollPaymentCalendar(2026,6,"2",{})).toEqual({
      baseDate:"2026-08-05",
      paymentDate:"2026-08-05",
      adjusted:false,
    });
  });

  it("zera o feriado quando há falta no dia útil imediatamente anterior",()=>{
    const data={attendance:{e1:{"2026-06-23":{status:"F"}}}};
    expect(getHolidayPayRule(data,{id:"e1",dailyRate:150},"2026-06-24",
      getOfficialHolidaysCaruaruPE(2026))).toMatchObject({
      before:"2026-06-23",
      after:"2026-06-25",
      missedBefore:true,
      losesHoliday:true,
      amount:0,
    });
  });

  it("libera um ponto bloqueado somente para o solicitante e dentro da validade",()=>{
    const data={
      attendanceLocks:{"2026-07-28__obra-1":{locked:true}},
      unlockRequests:[{
        obraId:"obra-1",
        date:"2026-07-28",
        requestedById:"engenheira-1",
        status:"approved",
        validUntil:"2026-07-28T15:30:00.000Z",
      }],
    };
    const now=new Date("2026-07-28T15:00:00.000Z");
    expect(hasApprovedUnlock(data,"obra-1","2026-07-28","engenheira-1",now)).toBe(true);
    expect(hasApprovedUnlock(data,"obra-1","2026-07-28","engenheira-2",now)).toBe(false);
    expect(canEditAttendance(data,"obra-1","2026-07-28","engenheira-2")).toBe(false);
  });

  it("resume a conclusão por obra sem considerar funcionário inativo",()=>{
    const data={
      obras:[
        {id:"obra-1",name:"H-02",status:"active"},
        {id:"obra-2",name:"B2-04",status:"active"},
      ],
      employees:[
        {id:"e1",obra:"obra-1",active:true},
        {id:"e2",obra:"obra-1",active:true},
        {id:"e3",obra:"obra-2",active:false},
      ],
      attendance:{e1:{"2026-07-28":{status:"P"}}},
    };
    expect(getObraAttendanceSummary(data,"2026-07-28")).toEqual([
      expect.objectContaining({
        obraId:"obra-1",
        registeredCount:1,
        missingCount:1,
        completed:false,
      }),
      expect.objectContaining({
        obraId:"obra-2",
        totalEmployees:0,
        hasTeam:false,
      }),
    ]);
  });

  it("gera a solicitação por e-mail com os dados auditáveis da alteração",()=>{
    const link=buildPermissionEmail({
      to:"admin@arcd.com",
      obraName:"H-02",
      date:"2026-07-28",
      employeeName:"Maria",
      reason:"Correção de lançamento",
      approvalLink:"https://app.exemplo/aprovar",
    });
    expect(decodeURIComponent(link)).toContain("Data do ponto: 28/07/2026");
    expect(decodeURIComponent(link)).toContain("Trabalhador: Maria");
    expect(decodeURIComponent(link)).toContain("Correção de lançamento");
  });
});
