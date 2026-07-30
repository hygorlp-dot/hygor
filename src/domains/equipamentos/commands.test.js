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
    expect(excess.reason).toMatch(/excede a frota/);
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
});
