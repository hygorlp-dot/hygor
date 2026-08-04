import { describe, expect, it } from "vitest";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../sync/operational-commands.js";

const now="2026-07-28T12:00:00.000Z";
const command=(type,key,payload,expectedVersion)=>({
  type,idempotencyKey:key,payload,expectedVersion,now,actorId:"u-1",actorName:"Ana",
});
const equipment=(overrides={})=>({
  id:"eq-1",nome:"Betoneira",status:"disponivel",ativo:true,quantidadeTotal:2,
  tarifas:{dia:100,semana:0,quinzena:0,mes:0},tarifasCusto:{dia:50,semana:0,quinzena:0,mes:0},
  ...overrides,
});
const base=()=>({obras:[{id:"obra-a"},{id:"obra-b"}],equipamentos:[],locacoesEquip:[],manutencoesEquip:[],transferenciasEquip:[]});

describe("comandos transacionais de equipamentos",()=>{
  it("materializa o cadastro físico legado uma única vez com auditoria",()=>{
    const initial={...base(),equipamentos:[equipment({quantidadeTotal:1,patrimonio:"EQ-1"})]};
    const result=applyOperationalCommand(initial,command(
      OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_MIGRATED,"equipment-registry-migration-0001",{},0,
    ));
    expect(result.ok).toBe(true);
    expect(result.data.equipmentModels).toHaveLength(1);
    expect(result.data.equipmentUnits).toHaveLength(1);
    expect(result.data.equipamentos).toEqual(initial.equipamentos);
    expect(result.data.equipmentRegistryMigration).toMatchObject({version:1,migratedById:"u-1"});
  });

  it("cria, versiona e impede sobrescrita de equipamento",()=>{
    const created=applyOperationalCommand(base(),command(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,"equipment-save-0001",{equipment:equipment()},0));
    expect(created.ok).toBe(true);
    expect(created.data.equipamentos[0]).toMatchObject({id:"eq-1",version:1,valorDiaria:100});
    const updated=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,"equipment-save-0002",{equipment:equipment({nome:"Betoneira 400 L"})},1));
    expect(updated.data.equipamentos[0]).toMatchObject({nome:"Betoneira 400 L",version:2});
    const stale=applyOperationalCommand(updated.data,command(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,"equipment-save-0003",{equipment:equipment({nome:"Valor perdido"})},1));
    expect(stale).toMatchObject({ok:false});
    expect(stale.reason).toMatch(/alterado por outra pessoa/);
  });

  it("permite cadastrar o ativo antes de definir a tabela de locação",()=>{
    const draft=equipment({
      tarifas:{dia:0,semana:0,quinzena:0,mes:0},
      tarifasCusto:{dia:0,semana:0,quinzena:0,mes:0},
    });
    const created=applyOperationalCommand(
      base(),
      command(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,"equipment-without-rates-0001",{equipment:draft},0),
    );
    expect(created.ok).toBe(true);
    expect(created.data.equipamentos[0]).toMatchObject({
      id:"eq-1",
      valorDiaria:0,
      tarifas:{dia:0,semana:0,quinzena:0,mes:0},
    });
  });

  it("é idempotente e recusa patrimônio ativo duplicado",()=>{
    const first=applyOperationalCommand(base(),command(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,"equipment-idempotent-0001",{equipment:equipment({patrimonio:"EQ-10"})},0));
    const repeated=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,"equipment-idempotent-0001",{equipment:equipment({patrimonio:"EQ-10"})},0));
    expect(repeated.idempotent).toBe(true);
    expect(repeated.data.equipamentos).toHaveLength(1);
    const duplicate=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.EQUIPMENT_SAVED,"equipment-duplicate-0001",{equipment:equipment({id:"eq-2",patrimonio:"eq-10"})},0));
    expect(duplicate).toMatchObject({ok:false});
    expect(duplicate.reason).toMatch(/patrimônio/);
  });

  it("controla a capacidade por período e libera a frota ao encerrar",()=>{
    const initial={...base(),equipamentos:[equipment({version:1,obraAtualId:""})]};
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"equipment-rental-0001",{rental:{
      id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-07-01",fim:"",quantidade:1,
    }},0));
    expect(first.data.locacoesEquip[0]).toMatchObject({status:"ativa",version:1});
    expect(first.data.equipamentos[0]).toMatchObject({status:"locado",obraAtualId:"obra-a",version:2});
    const second=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"equipment-rental-0002",{rental:{
      id:"loc-2",equipamentoId:"eq-1",obraId:"obra-b",inicio:"2026-07-10",fim:"",quantidade:1,
    }},0));
    expect(second.ok).toBe(true);
    const excess=applyOperationalCommand(second.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"equipment-rental-0003",{rental:{
      id:"loc-3",equipamentoId:"eq-1",obraId:"obra-b",inicio:"2026-07-15",fim:"",quantidade:1,
    }},0));
    expect(excess).toMatchObject({ok:false});
    expect(excess.reason).toMatch(/indisponível.*2026-07-15.*2 locada.*0 livre.*1 solicitada/);
    const closeOne=applyOperationalCommand(second.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,"equipment-rental-close-0001",{rentalId:"loc-1",endDate:"2026-07-20"},1));
    expect(closeOne.data.equipamentos[0].status).toBe("locado");
    const closeTwo=applyOperationalCommand(closeOne.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,"equipment-rental-close-0002",{rentalId:"loc-2",endDate:"2026-07-20"},1));
    expect(closeTwo.data.equipamentos[0]).toMatchObject({status:"disponivel",obraAtualId:""});
  });

  it("impede inativação com locação aberta e preserva o histórico ao inativar",()=>{
    const initial={...base(),equipamentos:[equipment({version:1})],locacoesEquip:[{
      id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-07-01",fim:"",status:"ativa",
    }]};
    const blocked=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,"equipment-deactivate-0001",{equipmentId:"eq-1",reason:"Baixa"},1));
    expect(blocked).toMatchObject({ok:false});
    const closed={...initial,locacoesEquip:[{...initial.locacoesEquip[0],fim:"2026-07-20",status:"encerrada"}]};
    const result=applyOperationalCommand(closed,command(OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,"equipment-deactivate-0002",{equipmentId:"eq-1",reason:"Baixa patrimonial"},1));
    expect(result.data.equipamentos[0]).toMatchObject({ativo:false,status:"inativo",motivoInativacao:"Baixa patrimonial",version:2});
    expect(result.data.equipamentos[0].operationalHistory.at(-1)).toMatchObject({type:"EQUIPMENT_DEACTIVATED"});
  });

  it("exclui a locação por cancelamento auditável e libera a quantidade da frota",()=>{
    const initial={...base(),equipamentos:[equipment({version:2,status:"locado",obraAtualId:"obra-a"})],locacoesEquip:[{
      id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-07-01",fim:"",status:"ativa",version:1,quantidade:2,
    }]};
    const result=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CANCELLED,"equipment-rental-cancel-0001",{
      rentalId:"loc-1",reason:"Cadastro duplicado",
    },1));
    expect(result.ok).toBe(true);
    expect(result.data.locacoesEquip[0]).toMatchObject({status:"cancelada",version:2,motivoCancelamento:"Cadastro duplicado"});
    expect(result.data.locacoesEquip[0].operationalHistory.at(-1)).toMatchObject({type:"EQUIPMENT_RENTAL_CANCELLED"});
    expect(result.data.equipamentos[0]).toMatchObject({status:"disponivel",obraAtualId:"",version:3});
  });

  it("permite trocar o equipamento da locação e sincroniza antigo e novo",()=>{
    const initial={...base(),equipamentos:[
      equipment({id:"eq-1",version:2,status:"locado",obraAtualId:"obra-a"}),
      equipment({id:"eq-2",version:1,status:"disponivel",obraAtualId:""}),
    ],locacoesEquip:[{
      id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-07-01",fim:"",status:"ativa",version:1,quantidade:1,
    }]};
    const result=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"equipment-rental-change-0001",{rental:{
      ...initial.locacoesEquip[0],equipamentoId:"eq-2",
    }},1));
    expect(result.ok).toBe(true);
    expect(result.data.locacoesEquip[0]).toMatchObject({equipamentoId:"eq-2",version:2});
    expect(result.data.equipamentos.find(item=>item.id==="eq-1")).toMatchObject({status:"disponivel",obraAtualId:""});
    expect(result.data.equipamentos.find(item=>item.id==="eq-2")).toMatchObject({status:"locado",obraAtualId:"obra-a"});
  });

  it("versiona manutenção, deriva a obra e rejeita custo inválido",()=>{
    const initial={...base(),equipamentos:[equipment({version:1,obraAtualId:"obra-a"})]};
    const invalid=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,"equipment-maintenance-invalid-0001",{maintenance:{
      id:"man-1",equipamentoId:"eq-1",data:"2026-07-28",custo:0,
    }},0));
    expect(invalid).toMatchObject({ok:false});
    const created=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,"equipment-maintenance-0001",{maintenance:{
      id:"man-1",equipamentoId:"eq-1",data:"2026-07-28",custo:450,tipo:"corretiva",
    }},0));
    expect(created.data.manutencoesEquip[0]).toMatchObject({obraId:"obra-a",custo:450,version:1});
    const stale=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,"equipment-maintenance-0002",{maintenance:{
      id:"man-1",equipamentoId:"eq-1",data:"2026-07-28",custo:500,
    }},0));
    expect(stale).toMatchObject({ok:false});
  });

  it("transfere com versão do equipamento e registra origem e destino",()=>{
    const initial={...base(),equipamentos:[equipment({version:3,obraAtualId:"obra-a",status:"locado"})]};
    const result=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,"equipment-transfer-0001",{transfer:{
      id:"trans-1",equipamentoId:"eq-1",paraObraId:"obra-b",data:"2026-07-28",responsavel:"Carlos",
    }},3));
    expect(result.data.transferenciasEquip[0]).toMatchObject({deObraId:"obra-a",paraObraId:"obra-b",version:1});
    expect(result.data.equipamentos[0]).toMatchObject({obraAtualId:"obra-b",version:4});
    const stale=applyOperationalCommand(result.data,command(OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,"equipment-transfer-0002",{transfer:{
      id:"trans-2",equipamentoId:"eq-1",paraObraId:"obra-a",data:"2026-07-28",
    }},3));
    expect(stale).toMatchObject({ok:false});
  });

  it("rejeita datas inexistentes e descontos fora dos limites",()=>{
    const initial={...base(),equipamentos:[equipment({version:1})]};
    const rental={id:"loc-invalid",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-02-30",fim:"2026-03-02",quantidade:1};
    expect(applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"invalid-date",{rental},0)).reason).toMatch(/período válido/);
    const excessivePct={...rental,inicio:"2026-03-01",descontoPct:101};
    expect(applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"invalid-pct",{rental:excessivePct},0)).reason).toMatch(/entre 0% e 100%/);
    const excessiveFixed={...rental,inicio:"2026-03-01",fim:"2026-03-01",descontoValor:101};
    expect(applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"invalid-fixed",{rental:excessiveFixed},0)).reason).toMatch(/não pode superar o saldo/);
  });

  it("congela a tabela, descontos, origem e usuário na criação",()=>{
    const initial={...base(),equipamentos:[equipment({version:7})]};
    const created=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"snapshot-create",{rental:{
      id:"loc-snapshot",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-08-01",fim:"2026-08-02",quantidade:1,
      tarifaNegociada:true,tarifas:{dia:80},descontoPct:10,descontoValor:5,
    }},0));
    expect(created.ok).toBe(true);
    expect(created.data.locacoesEquip[0].commercialSnapshot).toMatchObject({
      tarifas:{dia:80},descontoPct:10,descontoValor:5,regraTarifaria:"menor_combinacao",
      negociadoPorId:"u-1",negociadoPor:"Ana",origemTabela:"negociada",versaoTabela:7,
    });
    const current=created.data.locacoesEquip[0];
    const changedData={...created.data,equipamentos:[{...created.data.equipamentos[0],tarifas:{dia:999}}]};
    const edited=applyOperationalCommand(changedData,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"snapshot-edit",{rental:{...current,obs:"preservado",descontoPct:99}},1));
    expect(edited.ok).toBe(true);
    expect(edited.data.locacoesEquip[0].commercialSnapshot).toEqual(current.commercialSnapshot);
    expect(edited.data.locacoesEquip[0]).toMatchObject({descontoPct:10,descontoValor:5});
  });

  it("informa o motivo e a capacidade quando estado ou manutenção bloqueiam",()=>{
    const blocked={...base(),equipamentos:[equipment({version:1,status:"avariado"})]};
    const rental={id:"loc-blocked",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-08-01",fim:"2026-08-02",quantidade:1};
    const byStatus=applyOperationalCommand(blocked,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"blocked-status",{rental},0));
    expect(byStatus.reason).toMatch(/avariado.*2026-08-01.*2 bloqueada.*0 livre.*1 solicitada/);
    const maintenance={...base(),equipamentos:[equipment({version:1})],manutencoesEquip:[{id:"m1",equipamentoId:"eq-1",inicio:"2026-08-01",fim:"2026-08-03",status:"programada",descricao:"Revisão"}]};
    const byMaintenance=applyOperationalCommand(maintenance,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"blocked-maintenance",{rental:{...rental,quantidade:2}},0));
    expect(byMaintenance.reason).toMatch(/Revisão.*2 em manutenção.*0 livre.*2 solicitada/);
  });

  it("serializa duas reservas disputando a última unidade disponível",()=>{
    const initial={...base(),equipamentos:[equipment({version:1,quantidadeTotal:1})]};
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED,"reservation-concurrency-a",{unavailability:{
      id:"res-1",equipmentId:"eq-1",workId:"obra-a",quantity:1,startDate:"2026-09-01",endDate:"2026-09-03",reason:"Mobilização",
    }},0));
    expect(first.ok).toBe(true);
    const second=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED,"reservation-concurrency-b",{unavailability:{
      id:"res-2",equipmentId:"eq-1",workId:"obra-b",quantity:1,startDate:"2026-09-02",endDate:"2026-09-04",reason:"Outra obra",
    }},0));
    expect(second).toMatchObject({ok:false});
    expect(second.reason).toMatch(/Mobilização.*1 reservada.*0 livre/);
  });

  it("faz locação, reserva e manutenção disputarem a mesma capacidade",()=>{
    const initial={...base(),equipamentos:[equipment({version:1,quantidadeTotal:3})]};
    const reservation=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED,"reservation-shared-engine",{unavailability:{
      id:"res-1",equipmentId:"eq-1",quantity:1,startDate:"2026-10-01",endDate:"2026-10-10",reason:"Reserva comercial",
    }},0));
    const rental=applyOperationalCommand(reservation.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"rental-shared-engine",{rental:{
      id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",quantidade:1,inicio:"2026-10-02",fim:"2026-10-08",
    }},0));
    const maintenance=applyOperationalCommand(rental.data,command(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,"maintenance-shared-engine",{maintenance:{
      id:"man-1",equipamentoId:"eq-1",quantidade:2,inicio:"2026-10-03",fim:"2026-10-04",data:"2026-10-03",custo:100,
    }},0));
    expect(maintenance).toMatchObject({ok:false});
    expect(maintenance.reason).toMatch(/1 locada.*1 reservada.*1 livre.*2 solicitada/);
  });
});
