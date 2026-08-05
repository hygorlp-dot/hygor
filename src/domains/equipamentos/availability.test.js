import { describe,expect,it } from "vitest";
import { buildEquipmentUnavailability,fleetAvailability,rentalAvailability,rentalLifecycleAvailability } from "./availability.js";

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

  it("usa o menor saldo real e não soma períodos sequenciais como simultâneos",()=>{
    const result=fleetAvailability({
      data:{equipmentUnavailability:[
        {id:"r1",equipmentId:"eq-1",type:"reservation",quantity:2,startDate:"2026-08-01",endDate:"2026-08-05",status:"ativa"},
        {id:"r2",equipmentId:"eq-1",type:"reservation",quantity:2,startDate:"2026-08-06",endDate:"2026-08-10",status:"ativa"},
      ]},equipment,startDate:"2026-08-01",endDate:"2026-08-10",requested:1,
    });
    expect(result).toMatchObject({total:3,reservado:2,livre:1,exceeded:false});
  });

  it("projeta legado somente quando não existe evento materializado",()=>{
    const events=buildEquipmentUnavailability({
      equipmentUnavailability:[{id:"u1",equipmentId:"eq-1",type:"rental",rentalId:"l1",quantity:1,startDate:"2026-08-01",endDate:"2026-08-02"}],
      locacoesEquip:[{id:"l1",equipamentoId:"eq-1",quantidade:1,inicio:"2026-08-01",fim:"2026-08-02"}],
      manutencoesEquip:[{id:"m1",equipamentoId:"eq-1",data:"2026-08-03",descricao:"Revisão"}],
      transferenciasEquip:[{id:"t1",equipamentoId:"eq-1",data:"2026-08-04",paraObraId:"o1"}],
    });
    expect(events.filter(item=>item.rentalId==="l1")).toHaveLength(1);
    expect(events.map(item=>item.type)).toEqual(["rental","maintenance","transport"]);
    expect(events.find(item=>item.type==="transport")).toMatchObject({quantity:0,affectsCapacity:false});
  });

  it("projeta cada estágio do ciclo na categoria correta",()=>{
    expect(rentalLifecycleAvailability({lifecycleState:"draft",status:"ativa"})).toMatchObject({affectsCapacity:false,status:"inativa"});
    expect(rentalLifecycleAvailability({lifecycleState:"reserved",status:"ativa"})).toMatchObject({type:"reservation",affectsCapacity:true});
    expect(rentalLifecycleAvailability({lifecycleState:"in_transport",status:"ativa"})).toMatchObject({type:"transport",affectsCapacity:true});
    expect(rentalLifecycleAvailability({lifecycleState:"active",status:"ativa"})).toMatchObject({type:"rental",affectsCapacity:true});
    expect(rentalLifecycleAvailability({lifecycleState:"under_inspection",status:"ativa"})).toMatchObject({type:"inspection",affectsCapacity:true});
    expect(rentalLifecycleAvailability({lifecycleState:"awaiting_adjustment",status:"ativa"})).toMatchObject({type:"damage",affectsCapacity:true});
  });

  it("sincroniza evento materializado quando a locação muda de estado",()=>{
    const base={equipmentUnavailability:[{id:"u1",equipmentId:"eq-1",rentalId:"l1",type:"rental",quantity:1,startDate:"2026-08-01",status:"ativa"}]};
    const transported=buildEquipmentUnavailability({...base,locacoesEquip:[{id:"l1",equipamentoId:"eq-1",inicio:"2026-08-01",quantidade:1,status:"ativa",lifecycleState:"in_transport"}]});
    expect(transported[0]).toMatchObject({type:"transport",affectsCapacity:true});
    const cancelled=buildEquipmentUnavailability({...base,locacoesEquip:[{id:"l1",equipamentoId:"eq-1",inicio:"2026-08-01",quantidade:1,status:"cancelada",lifecycleState:"cancelled"}]});
    expect(cancelled[0]).toMatchObject({status:"inativa",affectsCapacity:false});
  });
});
