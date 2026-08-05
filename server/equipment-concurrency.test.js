import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import { applyOperationalCommand,OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";

const apiSource=readFileSync("api/data.js","utf8");
const reserve=(id,key)=>({
  type:OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED,idempotencyKey:key,expectedVersion:0,
  now:"2026-08-04T12:00:00.000Z",actorId:"u-1",actorName:"Ana",
  payload:{unavailability:{id,equipmentId:"eq-1",quantity:1,type:"reservation",
    startDate:"2026-09-01",endDate:"2026-09-02",reason:`Reserva ${id}`}},
});

describe("concorrência da disponibilidade de equipamentos",()=>{
  it("mantém leitura, validação e gravação dentro do bloqueio PostgreSQL",()=>{
    expect(apiSource).toMatch(/select value,updated_at[\s\S]*from company_app_data[\s\S]*for update/);
    expect(apiSource).toMatch(/connection\.begin\(async transaction/);
    expect(apiSource.indexOf("for update")).toBeLessThan(apiSource.indexOf("applyOperationalCommand(current"));
  });

  it("a segunda reserva serializada perde a disputa pela última unidade",()=>{
    const initial={obras:[],equipamentos:[{id:"eq-1",nome:"Betoneira",ativo:true,status:"disponivel",quantidadeTotal:1,version:1}],locacoesEquip:[],manutencoesEquip:[],equipmentUnavailability:[]};
    const first=applyOperationalCommand(initial,reserve("res-1","concurrent-reservation-one"));
    expect(first.ok).toBe(true);
    const second=applyOperationalCommand(first.data,reserve("res-2","concurrent-reservation-two"));
    expect(second).toMatchObject({ok:false});
    expect(second.reason).toMatch(/Reserva res-1.*1 reservada.*0 livre/);
    expect(first.data.equipmentUnavailability).toHaveLength(1);
  });
});
