import { describe,expect,it } from "vitest";
import { applyAttendanceStatus,applyAttendanceStatusBatch } from "./attendance-mutations";

describe("mutações de ponto",()=>{
  it("permite ao primeiro clique confirmar a equipe e lançar a presença",()=>{
    const data={attendance:{},dailyCheckDate:""};
    const next=applyAttendanceStatus({
      data,
      employeeId:"func-1",
      date:"2026-07-28",
      currentDate:"2026-07-28",
      status:"P",
      obraId:"obra-isabela",
    });

    expect(next.dailyCheckDate).toBe("2026-07-28");
    expect(next.attendance["func-1"]["2026-07-28"]).toMatchObject({
      status:"P",
      obraId:"obra-isabela",
    });
    expect(data.attendance).toEqual({});
  });

  it("remove horas contraditórias ao marcar falta",()=>{
    const data={
      attendance:{
        "func-1":{
          "2026-07-28":{
            status:"P",
            obraId:"obra-michelly",
            ot:2,
            entrada:"07:00",
            saida:"17:00",
            workedMinutes:540,
          },
        },
      },
      dailyCheckDate:"",
    };
    const next=applyAttendanceStatus({
      data,
      employeeId:"func-1",
      date:"2026-07-28",
      currentDate:"2026-07-28",
      status:"F",
      obraId:"obra-michelly",
    });

    expect(next.attendance["func-1"]["2026-07-28"]).toMatchObject({
      status:"F",
      obraId:"obra-michelly",
      ot:0,
      entrada:"",
      saida:"",
      workedMinutes:0,
    });
  });

  it("marca toda a equipe na obra sem apagar apontamentos anteriores",()=>{
    const data={
      attendance:{
        "func-1":{"2026-07-27":{status:"P",obraId:"obra-isabela"}},
      },
      dailyCheckDate:"",
    };
    const next=applyAttendanceStatusBatch({
      data,
      employees:[{id:"func-1"},{id:"func-2"}],
      date:"2026-07-28",
      currentDate:"2026-07-28",
      status:"P",
      obraId:"obra-isabela",
    });

    expect(next.dailyCheckDate).toBe("2026-07-28");
    expect(next.attendance["func-1"]["2026-07-27"].status).toBe("P");
    expect(next.attendance["func-1"]["2026-07-28"].status).toBe("P");
    expect(next.attendance["func-2"]["2026-07-28"]).toMatchObject({
      status:"P",
      obraId:"obra-isabela",
    });
  });
});
