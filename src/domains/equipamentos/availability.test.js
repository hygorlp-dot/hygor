import { describe,expect,it } from "vitest";
import { rentalAvailability } from "./availability.js";

const equipment={id:"eq-1",ativo:true,status:"disponivel",quantidadeTotal:3};

describe("disponibilidade de equipamentos",()=>{
  it("calcula locado, indisponível e livre no período inteiro",()=>{
    const result=rentalAvailability({
      data:{
        locacoesEquip:[{id:"l1",equipamentoId:"eq-1",inicio:"2026-07-01",fim:"2026-07-10",quantidade:1}],
        manutencoesEquip:[{id:"m1",equipamentoId:"eq-1",inicio:"2026-07-08",fim:"2026-07-12",quantidade:1,status:"programada"}],
      },
      equipment,
      rental:{inicio:"2026-07-09",fim:"2026-07-11",quantidade:2},
    });
    expect(result).toMatchObject({total:3,rented:1,unavailable:1,free:1,requested:2,exceeded:true});
    expect(result.conflicts.map(item=>item.type)).toEqual(["rental","maintenance"]);
  });

  it.each(["manutencao","bloqueado","avariado","aguardando_inspecao"])("bloqueia o estado %s",status=>{
    const result=rentalAvailability({data:{},equipment:{...equipment,status},rental:{inicio:"2026-08-01",fim:"2026-08-02",quantidade:1}});
    expect(result).toMatchObject({unavailable:3,free:0,exceeded:true});
    expect(result.conflicts[0].reason).toBeTruthy();
  });
});
