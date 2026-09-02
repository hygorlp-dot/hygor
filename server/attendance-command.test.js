import {describe,expect,it} from "vitest";
import {applyAttendanceCommand,ATTENDANCE_COMMAND} from "./attendance-command.js";

const NOW="2026-07-28T12:00:00.000Z";
const ids=[
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
];
const operationId=index=>`20000000-0000-4000-8000-${String(index).padStart(12,"0")}`;
const base=()=>({
  obras:[{id:"obra-a",name:"Obra A"},{id:"obra-b",name:"Obra B"}],
  employees:[
    {id:"e-a",name:"Equipe A",obra:"obra-a",active:true,startDate:"2020-01-01"},
    {id:"e-b",name:"Equipe B",obra:"obra-b",active:true,startDate:"2020-01-01"},
  ],
  attendance:{},attendanceLocks:{},unlockRequests:[],changeLog:[],
  config:{attendanceUnlockApproverIds:["rh-aprovador"]},
});
const engineer={id:"eng-a",nome:"Engenheira A",role:"engenheiro",obraId:"obra-a"};
const upsert=(overrides={})=>({
  action:ATTENDANCE_COMMAND.UPSERT,operationId:ids[0],employeeId:"e-a",date:"2026-07-28",
  selectedObraId:"obra-a",record:{status:"P",ot:0,note:"",obraId:"obra-a"},confirmDailyCheck:true,
  ...overrides,
});

describe("comandos granulares do ponto",()=>{
  it("salva somente o registro solicitado e confirma a verificação diária",()=>{
    const result=applyAttendanceCommand(base(),engineer,upsert(),NOW);
    expect(result.ok).toBe(true);
    expect(result.data.attendance).toEqual({"e-a":{"2026-07-28":expect.objectContaining({status:"P",obraId:"obra-a"})}});
    expect(result.data.dailyCheckDate).toBe("2026-07-28");
    expect(result.result).toEqual({
      attendance:[expect.objectContaining({employeeId:"e-a",date:"2026-07-28",obraId:"obra-a"})],
      dailyCheckDate:"2026-07-28",
    });
    expect(JSON.stringify(upsert()).length).toBeLessThan(500);
  });

  // Achado de 02/09/2026: a troca de obra do dia (P1-08 -> CA1-06, por
  // exemplo) "não salvava"/revertia sozinha depois de recarregar, porque
  // api/data.js só gravava a linha da obra NOVA - a cópia na linha da obra
  // ANTIGA nunca era apagada. `previousObraId` é o dado que falta para
  // api/data.js saber qual linha antiga também precisa ser tocada (ver
  // server/attendance-obra-routing.js: groupObraDeparturesByBucket).
  it("o primeiro lançamento do dia não carrega previousObraId (nada para apagar)",()=>{
    const result=applyAttendanceCommand(base(),engineer,upsert(),NOW);
    expect(result.result.attendance[0]).not.toHaveProperty("previousObraId");
  });

  it("uma troca de obra do mesmo dia carrega previousObraId com a obra antiga",()=>{
    const admin={id:"admin-1",nome:"Admin",role:"admin"};
    const primeiro=applyAttendanceCommand(base(),admin,upsert(),NOW);
    const trocado=applyAttendanceCommand(primeiro.data,admin,upsert({
      operationId:ids[1],selectedObraId:"obra-b",record:{status:"P",obraId:"obra-b"},
    }),NOW);
    expect(trocado.ok).toBe(true);
    expect(trocado.result.attendance[0]).toMatchObject({
      employeeId:"e-a",date:"2026-07-28",obraId:"obra-b",previousObraId:"obra-a",
    });
  });

  it("editar sem trocar de obra carrega previousObraId igual ao obraId atual (nada a apagar)",()=>{
    const admin={id:"admin-1",nome:"Admin",role:"admin"};
    const primeiro=applyAttendanceCommand(base(),admin,upsert(),NOW);
    const editado=applyAttendanceCommand(primeiro.data,admin,upsert({
      operationId:ids[1],record:{status:"M",obraId:"obra-a"},
    }),NOW);
    expect(editado.result.attendance[0]).toMatchObject({obraId:"obra-a",previousObraId:"obra-a"});
  });

  it("um lote que muda a obra de um lançamento carrega previousObraId corretamente",()=>{
    const admin={id:"admin-1",nome:"Admin",role:"admin"};
    const primeiro=applyAttendanceCommand(base(),admin,upsert(),NOW);
    const lote=applyAttendanceCommand(primeiro.data,admin,{
      action:ATTENDANCE_COMMAND.BATCH_UPSERT,operationId:ids[1],
      patches:[{employeeId:"e-a",date:"2026-07-28",selectedObraId:"obra-b",record:{status:"P"}}],
    },NOW);
    expect(lote.result.attendance[0]).toMatchObject({obraId:"obra-b",previousObraId:"obra-a"});
  });

  it("impede auditor e engenheiro fora do escopo",()=>{
    expect(applyAttendanceCommand(base(),{...engineer,role:"engenheiro_auditor"},upsert(),NOW))
      .toMatchObject({ok:false,status:403});
    expect(applyAttendanceCommand(base(),{...engineer,role:"engenheiro_auditor"},{
      action:ATTENDANCE_COMMAND.DAILY_CHECK,operationId:ids[4],date:"2026-07-28",
    },NOW)).toMatchObject({ok:false,status:403});
    expect(applyAttendanceCommand(base(),engineer,upsert({
      employeeId:"e-b",selectedObraId:"obra-b",record:{status:"P",obraId:"obra-b"},
    }),NOW)).toMatchObject({ok:false,status:403});
  });

  it("aplica lote de forma atômica e grava a obra explicitamente selecionada",()=>{
    const data=base();
    const command={
      action:ATTENDANCE_COMMAND.BATCH_UPSERT,operationId:ids[1],confirmDailyCheck:true,
      patches:[
        {employeeId:"e-a",date:"2026-07-28",selectedObraId:"obra-a",record:{status:"P"}},
        {employeeId:"inexistente",date:"2026-07-28",selectedObraId:"obra-a",record:{status:"P"}},
      ],
    };
    const invalid=applyAttendanceCommand(data,engineer,command,NOW);
    expect(invalid.ok).toBe(false);
    expect(data.attendance).toEqual({});
    const valid=applyAttendanceCommand(data,engineer,{
      ...command,patches:[command.patches[0]],
    },NOW);
    expect(valid.data.attendance["e-a"]["2026-07-28"].obraId).toBe("obra-a");
  });

  it("operationId torna o comando idempotente",()=>{
    const first=applyAttendanceCommand(base(),engineer,upsert(),NOW);
    const repeated=applyAttendanceCommand(first.data,engineer,upsert({record:{status:"F",obraId:"obra-a"}}),NOW);
    expect(repeated).toMatchObject({ok:true,idempotent:true});
    expect(repeated.data.attendance["e-a"]["2026-07-28"].status).toBe("P");
  });

  it("preserva vinte marcações rápidas sem substituir o histórico",()=>{
    let data=base();
    data.employees=Array.from({length:20},(_,index)=>({
      id:`e-${index}`,name:`Equipe ${index}`,obra:"obra-a",active:true,startDate:"2020-01-01",
    }));
    for(let index=0;index<20;index+=1){
      const result=applyAttendanceCommand(data,engineer,{
        action:ATTENDANCE_COMMAND.UPSERT,operationId:operationId(index),
        employeeId:`e-${index}`,date:"2026-07-28",selectedObraId:"obra-a",
        record:{status:"P",obraId:"obra-a"},
      },NOW);
      expect(result.ok).toBe(true);
      data=result.data;
    }
    expect(Object.keys(data.attendance)).toHaveLength(20);
    expect(Object.values(data.attendance).every(days=>days["2026-07-28"].status==="P")).toBe(true);
  });

  it("gera contexto de auditoria exclusivamente no resultado do servidor",()=>{
    const result=applyAttendanceCommand(base(),engineer,upsert(),NOW);
    expect(result.audit).toMatchObject({
      action:"attendance_upsert",
      before:{attendance:{employeeId:"e-a",date:"2026-07-28",obraId:"obra-a"}},
      after:{attendance:{employeeId:"e-a",date:"2026-07-28",obraId:"obra-a"},operationId:ids[0]},
    });
    expect(result.data.changeLog).toEqual([]);
  });

  it("valida bloqueio usando a obra do lançamento",()=>{
    const data=base();
    data.attendanceLocks["2026-07-28__obra-a"]={id:"2026-07-28__obra-a",obraId:"obra-a",date:"2026-07-28",locked:true};
    expect(applyAttendanceCommand(data,engineer,upsert(),NOW)).toMatchObject({ok:false,status:409});
  });

  it("engenheiro finaliza apenas a própria obra",()=>{
    const command={action:ATTENDANCE_COMMAND.LOCK,operationId:ids[2],obraId:"obra-a",date:"2026-07-28"};
    expect(applyAttendanceCommand(base(),engineer,command,NOW).result.lock).toMatchObject({obraId:"obra-a",locked:true});
    expect(applyAttendanceCommand(base(),engineer,{...command,obraId:"obra-b"},NOW)).toMatchObject({ok:false,status:403});
    expect(applyAttendanceCommand(base(),{id:"rh-1",nome:"RH",role:"rh",obraId:"obra-a"},{...command,obraId:"obra-b"},NOW).result.lock)
      .toMatchObject({obraId:"obra-b",locked:true});
    expect(applyAttendanceCommand(base(),{id:"admin-1",nome:"Admin",role:"admin",obraId:"obra-a"},{...command,obraId:"obra-b"},NOW).result.lock)
      .toMatchObject({obraId:"obra-b",locked:true});
  });

  it("solicitante não aprova a própria liberação",()=>{
    const locked=applyAttendanceCommand(base(),engineer,{
      action:ATTENDANCE_COMMAND.LOCK,operationId:ids[2],obraId:"obra-a",date:"2026-07-28",
    },NOW);
    const requested=applyAttendanceCommand(locked.data,engineer,{
      action:ATTENDANCE_COMMAND.UNLOCK_REQUEST,operationId:ids[3],requestId:"req-1",
      obraId:"obra-a",date:"2026-07-28",employeeId:"e-a",reason:"Correção solicitada pelo RH",
    },NOW);
    expect(requested.result.unlockRequest).toMatchObject({requestedById:"eng-a",status:"pending"});
    expect(applyAttendanceCommand(requested.data,{...engineer,role:"admin"},{
      action:ATTENDANCE_COMMAND.UNLOCK_APPROVE,operationId:ids[4],requestId:"req-1",
    },NOW)).toMatchObject({ok:false,status:403});
    const approved=applyAttendanceCommand(requested.data,{id:"admin-2",nome:"Admin",role:"admin"},{
      action:ATTENDANCE_COMMAND.UNLOCK_APPROVE,operationId:ids[4],requestId:"req-1",
      validMinutes:"inválido",
    },NOW);
    expect(approved.result.unlockRequest).toMatchObject({status:"approved",approvedById:"admin-2"});
    expect(approved.result.unlockRequest.validUntil).toBe("2026-07-28T12:30:00.000Z");
  });
});
