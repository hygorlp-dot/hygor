import { describe, it, expect } from "vitest";
import { applyAttendanceCommand } from "./attendance-command.js";
import { inspectDay, sourceSignature, recordSignature, EVENT_TYPES } from "../src/domains/ponto-eletronico/conferencia.js";
import { SCHEDULE_44, scheduleOnDate, appendWorkSchedule } from "../src/domains/rh/work-schedule.js";
import { calculateAttendanceDayCost } from "../src/domains/ponto/payroll.js";

const now="2026-10-30T21:00:00Z",date="2026-10-29";
const user={id:"rh-1",nome:"RH",role:"rh"};
const employee={id:"e1",name:"Ana",active:true,startDate:"2020-01-01",dailyRate:180,workdayHours:8,obra:"o1",workSchedules:[{code:SCHEDULE_44,effectiveFrom:"2026-10-01"}]};
const base=()=>({employees:[employee],obras:[{id:"o1",name:"Obra 1"}],attendance:{}});
const events=(day=date,hours=["07:00","12:00","13:00","17:00"])=>hours.map((h,i)=>({id:`id-${i}`,eventId:`id-${i}`,employeeId:"e1",obraId:"o1",tipoRegistro:"ponto",tipoEvento:EVENT_TYPES[i],horaConfiavel:true,marcadoEm:new Date(`${day}T${h}:00-03:00`).toISOString()}));
const command=(data=base(),ev=events(),day=date)=>({action:"attendance-review-punches",operationId:"10000000-0000-4000-8000-000000000001",employeeId:"e1",date:day,selectedObraId:"o1",status:"P",
  clocks:inspectDay(ev,employee,day).clocks,sourceSignature:sourceSignature(ev),scheduleSignature:JSON.stringify(scheduleOnDate(employee,day)),expectedRecord:recordSignature(data.attendance?.e1?.[day])});
const apply=(data=base(),cmd=command(data),ev=events(),actor=user)=>applyAttendanceCommand(data,actor,cmd,now,ev);

describe("escala e conferência do RH",()=>{
  it("totaliza 44h, com sexta de 8h e sábado/domingo livres",()=>{
    expect([26,27,28,29,30,31].map(d=>scheduleOnDate(employee,`2026-10-${d}`).minutes)).toEqual([540,540,540,540,480,0]);
    expect(scheduleOnDate(employee,"2026-11-01").minutes).toBe(0);
    expect(scheduleOnDate(employee,"2026-09-30")).toBeNull();
    expect(scheduleOnDate({},date)).toBeNull();
  });
  it("preserva histórico e exige vigência válida posterior",()=>{
    expect(appendWorkSchedule(employee,{code:SCHEDULE_44,effectiveFrom:"2026-02-31"},"rh",now).ok).toBe(false);
    expect(appendWorkSchedule(employee,{code:SCHEDULE_44,effectiveFrom:"2026-10-01"},"rh",now).ok).toBe(false);
    const next=appendWorkSchedule(employee,{code:SCHEDULE_44,effectiveFrom:"2026-11-01"},"rh",now);
    expect(next.history).toHaveLength(2);expect(employee.workSchedules).toHaveLength(1);
  });
  it("duas batidas e uma saída isolada nunca fecham automaticamente a jornada",()=>{
    expect(inspectDay(events().filter((_,i)=>i===0||i===3),employee,date).situacao).toBe("conferir");
    expect(inspectDay([events()[3]],employee,date).situacao).toBe("conferir");
    expect(inspectDay(events().map(e=>({...e,tipoEvento:null})),employee,date).situacao).toBe("conferir");
    expect(inspectDay(events(),employee,date).situacao).toBe("aguardando_rh");
  });
  it("integra 9h sem hora extra na quinta e mantém as batidas intactas",()=>{
    const ev=events(),before=structuredClone(ev),r=apply(base(),command(),ev);
    expect(r.ok).toBe(true);
    const record=r.data.attendance.e1[date];
    expect(record).toMatchObject({workedMinutes:540,ot:0,archivedWorkdayHours:9,pontoReview:{reviewedBy:"rh-1",revision:1}});
    expect(calculateAttendanceDayCost({employee,record}).workdayHours).toBe(9);
    expect(r.audit.action).toBe("attendance_review_punches");expect(ev).toEqual(before);
  });
  it("sexta de 8h não gera extra; 9h na sexta gera 1h",()=>{
    const day="2026-10-30",ev=events(day,["07:00","12:00","13:00","16:00"]);
    expect(apply(base(),command(base(),ev,day),ev).data.attendance.e1[day]).toMatchObject({workedMinutes:480,ot:0,archivedWorkdayHours:8});
    const extra=events(day);expect(apply(base(),command(base(),extra,day),extra).data.attendance.e1[day].ot).toBe(1);
  });
  it("RH trata intervalos ausentes com justificativa; não inventa horários",()=>{
    const ev=events().filter((_,i)=>i===0||i===3),cmd=command(base(),ev);
    expect(apply(base(),cmd,ev).ok).toBe(false);
    cmd.clocks={entrada:"07:00",intervaloSaida:"12:00",intervaloRetorno:"13:00",saida:"17:00"};
    expect(apply(base(),cmd,ev).ok).toBe(false);
    expect(apply(base(),{...cmd,reason:"Intervalo confirmado pelo RH"},ev).ok).toBe(true);
  });
  it.each(["engenheiro","financeiro","mestre"])("rejeita conferência pelo perfil %s",role=>{
    expect(apply(base(),command(),events(),{id:"x",role}).status).toBe(403);
  });
  it("não aceita eventos fornecidos no corpo, sem consulta confiável",()=>{
    expect(applyAttendanceCommand(base(),user,{...command(),sourceEvents:events()},now).ok).toBe(false);
  });
  it("rejeita novas batidas e escala alterada após abrir a conferência",()=>{
    expect(apply(base(),command(),[...events(),{...events()[0],id:"new",eventId:"new"}]).error).toMatch(/batidas mudaram/);
    expect(apply(base(),{...command(),scheduleSignature:"antiga"}).error).toMatch(/escala mudou/);
  });
  it("rejeita dia finalizado e quinzena arquivada",()=>{
    const data=base();data.attendanceLocks={[`${date}__o1`]:{locked:true}};
    expect(apply(data).error).toMatch(/finalizado/);
    data.attendanceLocks={};data.quinzenasArquivadas={"2026-10-Q2":{}};
    expect(apply(data).error).toMatch(/arquivada/);
  });
  it("repetição não duplica e outra conferência obsoleta é rejeitada",()=>{
    const r=apply();expect(apply(r.data).idempotent).toBe(true);
    const stale={...command(),operationId:"10000000-0000-4000-8000-000000000002"};
    expect(apply(r.data,stale).error).toMatch(/alterado por outra pessoa/);
  });
  it("revisão mantém a trilha e exige justificativa",()=>{
    const first=apply();const cmd={...command(first.data),operationId:"10000000-0000-4000-8000-000000000002"};
    expect(apply(first.data,cmd).ok).toBe(false);
    const next=apply(first.data,{...cmd,reason:"Revisão confirmada pelo RH"});
    expect(next.data.attendance.e1[date].pontoReview.revision).toBe(2);
    expect(next.audit.before.attendance.pontoReview.revision).toBe(1);
  });
  it("bloqueia edição comum ou flag forjada de lançamento conferido",()=>{
    const first=apply();const cmd={...command(),action:"attendance-upsert",operationId:"10000000-0000-4000-8000-000000000002",record:{status:"F"},reviewedByServer:true};
    expect(apply(first.data,cmd).ok).toBe(false);
  });
  it("dias sem escala ou sem expediente não são integrados por suposição",()=>{
    expect(apply({...base(),employees:[{...employee,workSchedules:[]}]}).ok).toBe(false);
    const ev=events("2026-10-31");expect(apply(base(),command(base(),ev,"2026-10-31"),ev).ok).toBe(false);
  });
});
