import { describe, expect, it } from "vitest";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../sync/operational-commands.js";
import { buildEquipmentRegistry } from "./registry.js";
import { rentalAvailability } from "./availability.js";

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

  it("resolve classificação ambígua sem apagar o equipamento legado",()=>{
    const migrated=applyOperationalCommand({...base(),equipamentos:[equipment({quantidadeTotal:2,patrimonio:"P-GERAL"})]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_MIGRATED,"equipment-registry-review-setup",{},0,
    ));
    const result=applyOperationalCommand(migrated.data,command(OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED,"equipment-registry-review-units",{
      equipmentId:"eq-1",kind:"unit",units:[{id:"u1",assetTag:"P-1"},{id:"u2",assetTag:"P-2"}],
    },0));
    expect(result.ok).toBe(true);
    expect(result.data.equipamentos).toEqual(migrated.data.equipamentos);
    expect(buildEquipmentRegistry(result.data)).toMatchObject({units:[{assetTag:"P-1"},{assetTag:"P-2"}],lots:[],report:{ambiguous:[]}});
    expect(result.data.equipmentRegistryHistory.at(-1)).toMatchObject({type:"EQUIPMENT_REGISTRY_CLASSIFIED",kind:"unit"});
  });

  it("transiciona o ciclo da locação com versão e auditoria",()=>{
    const initial={...base(),locacoesEquip:[{id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",status:"ativa",version:3}]};
    const result=applyOperationalCommand(initial,command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,"rental-transition-pickup-0001",
      {rentalId:"loc-1",nextState:"pickup_requested"},3,
    ));
    expect(result.ok).toBe(true);
    expect(result.data.locacoesEquip[0]).toMatchObject({lifecycleState:"pickup_requested",status:"ativa",version:4});
    expect(result.data.locacoesEquip[0].lifecycleHistory.at(-1)).toMatchObject({from:"active",to:"pickup_requested",actorId:"u-1"});
    expect(result.data.locacoesEquip[0].operationalHistory.at(-1)).toMatchObject({type:"EQUIPMENT_RENTAL_TRANSITIONED"});
    const stale=applyOperationalCommand(result.data,command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,"rental-transition-stale-0001",
      {rentalId:"loc-1",nextState:"returned"},3,
    ));
    expect(stale.reason).toMatch(/alterad[oa] por outra pessoa/);
  });

  it("recusa transição inválida e cancelamento faturado",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",lifecycleState:"contracted",version:1};
    const invalid=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,"rental-transition-invalid-0001",
      {rentalId:"loc-1",nextState:"delivered"},1,
    ));
    expect(invalid.reason).toMatch(/não permitida/);
    const billed=applyOperationalCommand({...base(),locacoesEquip:[{...rental,lifecycleState:"quoted"}],rentalChargeItems:[{id:"charge-1",rentalId:"loc-1",status:"open"}]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,"rental-transition-billed-0001",
      {rentalId:"loc-1",nextState:"cancelled",reason:"Cliente desistiu"},1,
    ));
    expect(billed.reason).toMatch(/estorno/);
  });

  it("registra checklist antes do marco logístico",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",quantidade:2,lifecycleState:"separating",version:1};
    const blocked=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,"rental-ready-blocked-0001",
      {rentalId:"loc-1",nextState:"ready_for_dispatch"},1,
    ));
    expect(blocked.reason).toMatch(/checklist de separation/);
    const checked=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,"rental-separation-checkpoint-0001",
      {rentalId:"loc-1",checkpoint:{type:"separation",date:"2026-08-04",quantity:2,accessories:["cabo"]}},1,
    ));
    expect(checked.ok).toBe(true);
    expect(checked.data.locacoesEquip[0].rentalCheckpoints[0]).toMatchObject({type:"separation",quantity:2,createdById:"u-1"});
    const advanced=applyOperationalCommand(checked.data,command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,"rental-ready-after-checklist-0001",
      {rentalId:"loc-1",nextState:"ready_for_dispatch"},2,
    ));
    expect(advanced.data.locacoesEquip[0]).toMatchObject({lifecycleState:"ready_for_dispatch",version:3});
  });

  it("mantém a locação aberta após devolução parcial",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",quantidade:3,
      equipmentUnitIds:["u1","u2","u3"],lifecycleState:"pickup_requested",status:"ativa",version:1};
    const partial=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,"rental-partial-return-0001",
      {rentalId:"loc-1",checkpoint:{type:"partial_return",date:"2026-08-10",quantity:1,equipmentUnitIds:["u1"],responsible:"Carlos"}},1,
    ));
    expect(partial.data.locacoesEquip[0]).toMatchObject({lifecycleState:"pickup_requested",status:"ativa",version:2});
    const premature=applyOperationalCommand(partial.data,command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,"rental-partial-premature-0001",
      {rentalId:"loc-1",nextState:"returned"},2,
    ));
    expect(premature.reason).toMatch(/checklist de return/);
  });

  it("mantém o estágio até concluir a expedição parcial",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",quantidade:3,
      equipmentUnitIds:["u1","u2","u3"],lifecycleState:"ready_for_dispatch",status:"ativa",version:1};
    const partial=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,"rental-partial-dispatch-0001",
      {rentalId:"loc-1",checkpoint:{type:"partial_dispatch",date:"2026-08-10",quantity:1,equipmentUnitIds:["u1"],responsible:"Carlos"}},1,
    ));
    expect(partial.data.locacoesEquip[0]).toMatchObject({lifecycleState:"ready_for_dispatch",version:2});
    const premature=applyOperationalCommand(partial.data,command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,"rental-dispatch-premature-0001",
      {rentalId:"loc-1",nextState:"in_transport"},2,
    ));
    expect(premature.reason).toMatch(/checklist de dispatch/);
    expect(partial.data.locacoesEquip[0].operationalHistory.at(-1)).toMatchObject({type:"EQUIPMENT_RENTAL_CHECKPOINT_RECORDED"});
  });

  it("exige checklist de ajuste antes do encerramento",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-08-01",quantidade:1,
      lifecycleState:"awaiting_adjustment",status:"ativa",version:1,rentalCheckpoints:[{type:"inspection",needsAdjustment:true}]};
    const blocked=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,"rental-adjustment-close-blocked-0001",{rentalId:"loc-1",endDate:"2026-08-12"},1,
    ));
    expect(blocked.reason).toMatch(/conclusão do ajuste/);
    const checked=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,"rental-adjustment-checkpoint-0001",
      {rentalId:"loc-1",checkpoint:{type:"adjustment",date:"2026-08-12",quantity:1,responsible:"Ana",notes:"Reparo concluído"}},1,
    ));
    expect(checked.ok).toBe(true);
    expect(checked.data.locacoesEquip[0].rentalCheckpoints.at(-1)).toMatchObject({type:"adjustment",createdById:"u-1"});
  });

  it("prorroga a previsão sem alterar encerramento ou snapshot comercial",()=>{
    const snapshot={tarifas:{dia:100},descontoPct:5,negociadoEm:"2026-08-01T10:00:00.000Z"};
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-08-01",fim:"",
      plannedEndDate:"2026-08-31",lifecycleState:"active",status:"ativa",commercialSnapshot:snapshot,version:2};
    const result=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,"rental-extension-0001",
      {rentalId:"loc-1",amendment:{type:"extension",newEndDate:"2026-09-15",reason:"Cronograma revisado"}},2,
    ));
    expect(result.ok).toBe(true);
    expect(result.data.locacoesEquip[0]).toMatchObject({plannedEndDate:"2026-09-15",fim:"",version:3,commercialSnapshot:snapshot});
    expect(result.data.locacoesEquip[0].rentalAmendments[0]).toMatchObject({
      type:"extension",newEndDate:"2026-09-15",createdById:"u-1",commercialSnapshot:snapshot,
    });
    expect(result.data.locacoesEquip[0].operationalHistory.at(-1)).toMatchObject({type:"EQUIPMENT_RENTAL_AMENDED"});
    const stale=applyOperationalCommand(result.data,command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,"rental-extension-stale-0001",
      {rentalId:"loc-1",amendment:{type:"extension",newEndDate:"2026-09-30"}},2,
    ));
    expect(stale.reason).toMatch(/alterad[oa] por outra pessoa/);
  });

  it("renova a locação em período não sobreposto",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-08-01",
      plannedEndDate:"2026-08-31",lifecycleState:"delivered",status:"ativa",version:1};
    const result=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,"rental-renewal-0001",
      {rentalId:"loc-1",amendment:{type:"renewal",startDate:"2026-09-01",endDate:"2026-09-30",reason:"Novo período"}},1,
    ));
    expect(result.ok).toBe(true);
    expect(result.data.locacoesEquip[0]).toMatchObject({
      plannedEndDate:"2026-09-30",renewalPeriods:[{startDate:"2026-09-01",endDate:"2026-09-30"}],version:2,
    });
  });

  it("substitui unidade física sem alterar o contrato",()=>{
    const snapshot={tarifas:{dia:100}};
    const initial={...base(),equipamentos:[equipment()],equipmentModels:[{id:"m1",legacySourceId:"eq-1"}],
      equipmentUnits:[{id:"u1",modelId:"m1",assetTag:"A"},{id:"u2",modelId:"m1",assetTag:"B"}],
      locacoesEquip:[{id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-08-01",quantidade:1,
        equipmentUnitIds:["u1"],equipmentUnitId:"u1",lifecycleState:"active",status:"ativa",commercialSnapshot:snapshot,version:1}]};
    const result=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_UNIT_REPLACED,"rental-replace-unit-0001",{
      rentalId:"loc-1",replacement:{outgoingUnitId:"u1",incomingUnitId:"u2",date:"2026-08-04",reason:"Avaria"},
    },1));
    expect(result.ok).toBe(true);
    expect(result.data.locacoesEquip[0]).toMatchObject({equipmentUnitIds:["u2"],equipmentUnitId:"u2",commercialSnapshot:snapshot,version:2});
    expect(result.data.locacoesEquip[0].rentalReplacements[0]).toMatchObject({outgoingUnitId:"u1",incomingUnitId:"u2",createdById:"u-1"});
  });

  it("grava linha de cobrança em centavos com versão e auditoria",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",status:"ativa",version:1};
    const result=applyOperationalCommand({...base(),locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED,"rental-charge-item-0001",{chargeItem:{
        id:"charge-1",rentalId:"loc-1",workId:"obra-a",type:"freight",description:"Frete de entrega",
        quantityMilli:1000,unit:"un",unitPriceCents:12550,discountAmountCents:550,taxAmountCents:0,competence:"2026-08",
      }},0,
    ));
    expect(result.ok).toBe(true);
    expect(result.data.rentalChargeItems[0]).toMatchObject({grossAmountCents:12550,netAmountCents:12000,version:1,createdById:"u-1"});
    expect(result.data.rentalChargeItems[0].operationalHistory.at(-1)).toMatchObject({type:"EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED"});
    const stale=applyOperationalCommand(result.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED,"rental-charge-item-stale-0001",{
      chargeItem:{...result.data.rentalChargeItems[0],unitPriceCents:13000},
    },0));
    expect(stale.reason).toMatch(/alterad[oa] por outra pessoa/);
  });

  it("mede uma única cobrança contratual por competência",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",status:"ativa",quantidade:2,version:3,
      commercialSnapshot:{regraTarifaria:"calendar_day",tarifas:{dia:100},descontoPct:10}};
    const result=applyOperationalCommand({...base(),equipamentos:[equipment()],locacoesEquip:[rental]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED,"rental-charge-measure-0001",
      {rentalId:"loc-1",competence:"2026-08",utilizationStart:"2026-08-01",utilizationEnd:"2026-08-03"},3,
    ));
    expect(result.ok).toBe(true);
    expect(result.data.rentalChargeItems[0]).toMatchObject({id:"charge:rental:loc-1:2026-08",status:"measured",grossAmountCents:60000,netAmountCents:54000});
    const duplicate=applyOperationalCommand(result.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED,"rental-charge-measure-0002",
      {rentalId:"loc-1",competence:"2026-08",utilizationStart:"2026-08-01",utilizationEnd:"2026-08-03"},3));
    expect(duplicate.reason).toMatch(/já foi medida/);
  });

  it("emite fatura e imutabiliza as linhas selecionadas",()=>{
    const rental={id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",status:"ativa",version:1};
    const line={id:"charge-1",rentalId:"loc-1",workId:"obra-a",competence:"2026-08",status:"measured",grossAmountCents:10000,discountAmountCents:1000,taxAmountCents:0,netAmountCents:9000,version:1};
    const result=applyOperationalCommand({...base(),locacoesEquip:[rental],rentalChargeItems:[line]},command(
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_ISSUED,"rental-invoice-issue-0001",{invoice:{
        id:"invoice-1",rentalId:"loc-1",workId:"obra-a",competence:"2026-08",number:"FAT-2026-001",
        issueDate:"2026-08-31",dueDate:"2026-09-10",chargeItemIds:["charge-1"],
      }},0,
    ));
    expect(result.ok).toBe(true);
    expect(result.data.rentalInvoices[0]).toMatchObject({status:"issued",netAmountCents:9000,openAmountCents:9000,version:1});
    expect(result.data.rentalChargeItems[0]).toMatchObject({status:"billed",invoiceId:"invoice-1",version:2});
    const edit=applyOperationalCommand(result.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED,"rental-charge-billed-edit-0001",{chargeItem:result.data.rentalChargeItems[0]},2));
    expect(edit.reason).toMatch(/não pode ser alterada/);
  });

  it("apropria recebimentos bancários parciais e integrais",()=>{
    const invoice={id:"invoice-1",rentalId:"loc-1",workId:"obra-a",status:"issued",netAmountCents:10000,receivedAmountCents:0,openAmountCents:10000,version:1};
    const initial={...base(),rentalInvoices:[invoice],transacoes:[{id:"tx-1",data:"2026-09-10",valor:60},{id:"tx-2",data:"2026-09-11",valor:40}]};
    const partial=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED,"rental-receipt-partial-0001",{
      invoiceId:"invoice-1",receipt:{transactionId:"tx-1",amountCents:6000},
    },1));
    expect(partial.data.rentalInvoices[0]).toMatchObject({status:"partially_paid",receivedAmountCents:6000,openAmountCents:4000,version:2});
    const paid=applyOperationalCommand(partial.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED,"rental-receipt-final-0001",{
      invoiceId:"invoice-1",receipt:{transactionId:"tx-2",amountCents:4000},
    },2));
    expect(paid.data.rentalInvoices[0]).toMatchObject({status:"paid",receivedAmountCents:10000,openAmountCents:0,paidAt:"2026-09-11",version:3});
    expect(paid.data.rentalInvoiceReceipts).toHaveLength(2);
  });

  it("exige unidade física e impede locar a mesma identidade duas vezes",()=>{
    const initial={...base(),equipamentos:[equipment({version:1,quantidadeTotal:2})],
      equipmentRegistryMigration:{version:1},
      equipmentModels:[{id:"model-1",legacySourceId:"eq-1"}],
      equipmentUnits:[
        {id:"unit-1",modelId:"model-1",assetTag:"EQ-1A",legacySourceId:"eq-1"},
        {id:"unit-2",modelId:"model-1",assetTag:"EQ-1B",legacySourceId:"eq-1"},
      ]};
    const missing=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"physical-rental-missing-0001",{rental:{
      id:"r0",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-08-01",fim:"2026-08-10",quantidade:1,
    }},0));
    expect(missing.reason).toMatch(/Selecione a unidade física/);
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"physical-rental-first-0001",{rental:{
      id:"r1",equipamentoId:"eq-1",equipmentUnitIds:["unit-1"],obraId:"obra-a",inicio:"2026-08-01",fim:"2026-08-10",quantidade:1,
    }},0));
    expect(first.ok).toBe(true);
    expect(first.data.locacoesEquip[0]).toMatchObject({equipmentUnitId:"unit-1",equipmentUnitIds:["unit-1"]});
    const conflict=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"physical-rental-conflict-0001",{rental:{
      id:"r2",equipamentoId:"eq-1",equipmentUnitIds:["unit-1"],obraId:"obra-b",inicio:"2026-08-05",fim:"2026-08-12",quantidade:1,
    }},0));
    expect(conflict.reason).toMatch(/unidade física selecionada já está indisponível/);
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

  it("cria, versiona e impede sobrescrita de proprietário de equipamento",()=>{
    const created=applyOperationalCommand(base(),command(OPERATIONAL_COMMAND.EQUIPMENT_OWNER_SAVED,"owner-save-0001",{owner:{
      id:"dono-1",nome:"Locadora Terra Firme",documento:"12.345.678/0001-90",telefone:"11999990000",
    }},0));
    expect(created.ok).toBe(true);
    expect(created.data.proprietariosEquip[0]).toMatchObject({id:"dono-1",nome:"Locadora Terra Firme",tipo:"terceiro",ativo:true,version:1});
    expect(created.data.proprietariosEquip[0].operationalHistory.at(-1)).toMatchObject({type:"EQUIPMENT_OWNER_CREATED",actorId:"u-1"});

    const updated=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.EQUIPMENT_OWNER_SAVED,"owner-save-0002",{owner:{
      id:"dono-1",nome:"Locadora Terra Firme Ltda",telefone:"11999990000",
    }},1));
    expect(updated.data.proprietariosEquip[0]).toMatchObject({nome:"Locadora Terra Firme Ltda",version:2});
    expect(updated.data.proprietariosEquip[0].operationalHistory.at(-1)).toMatchObject({type:"EQUIPMENT_OWNER_UPDATED"});

    const stale=applyOperationalCommand(updated.data,command(OPERATIONAL_COMMAND.EQUIPMENT_OWNER_SAVED,"owner-save-0003",{owner:{
      id:"dono-1",nome:"Valor perdido",
    }},1));
    expect(stale).toMatchObject({ok:false});
    expect(stale.reason).toMatch(/alterado por outra pessoa/);
  });

  it("recusa proprietário de equipamento sem nome",()=>{
    const result=applyOperationalCommand(base(),command(OPERATIONAL_COMMAND.EQUIPMENT_OWNER_SAVED,"owner-save-invalid-0001",{owner:{
      id:"dono-1",nome:"",
    }},0));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/nome do proprietário/);
  });

  it("controla a capacidade por período e libera a frota ao encerrar",()=>{
    const initial={...base(),equipamentos:[equipment({version:1,obraAtualId:""})]};
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"equipment-rental-0001",{rental:{
      id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-07-01",fim:"",quantidade:1,
    }},0));
    expect(first.data.locacoesEquip[0]).toMatchObject({status:"ativa",version:1});
    expect(first.data.equipamentos[0]).toMatchObject({status:"locado",obraAtualId:"obra-a",version:2});
    expect(first.data.locacoesEquip[0]).toMatchObject({status:"ativa",lifecycleState:"active"});
    const second=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"equipment-rental-0002",{rental:{
      id:"loc-2",equipamentoId:"eq-1",obraId:"obra-b",inicio:"2026-07-10",fim:"",quantidade:1,
    }},0));
    expect(second.ok).toBe(true);
    const excess=applyOperationalCommand(second.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"equipment-rental-0003",{rental:{
      id:"loc-3",equipamentoId:"eq-1",obraId:"obra-b",inicio:"2026-07-15",fim:"",quantidade:1,
    }},0));
    expect(excess).toMatchObject({ok:false});
    expect(excess.reason).toMatch(/indisponível.*2026-07-15.*2 locada.*0 livre.*1 solicitada/);
    const prematureClose=applyOperationalCommand(second.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,"equipment-rental-premature-close-0001",{rentalId:"loc-1",endDate:"2026-07-20"},1));
    expect(prematureClose.reason).toMatch(/após devolução e inspeção/);
    const closable={...second.data,locacoesEquip:second.data.locacoesEquip.map(item=>({...item,lifecycleState:"under_inspection",rentalCheckpoints:[{type:"inspection",needsAdjustment:false}]}))};
    const closeOne=applyOperationalCommand(closable,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,"equipment-rental-close-0001",{rentalId:"loc-1",endDate:"2026-07-20"},1));
    expect(closeOne.data.equipamentos[0].status).toBe("locado");
    const closeTwo=applyOperationalCommand(closeOne.data,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,"equipment-rental-close-0002",{rentalId:"loc-2",endDate:"2026-07-20"},1));
    expect(closeTwo.data.locacoesEquip.find(item=>item.id==="loc-2")).toMatchObject({status:"encerrada",lifecycleState:"closed"});
    expect(closeTwo.data.equipamentos[0]).toMatchObject({status:"disponivel",obraAtualId:""});
  });

  // Bug real relatado pelo usuário (31/08/2026): locou 10 andaimes numa
  // obra, mas a disponibilidade vista de outra obra só caiu 1 unidade.
  // Causa: `next=upsertUnavailability(next,{...,quantity,...})` usava a
  // forma curta de propriedade `quantity` - que, neste arquivo, é o NOME
  // da função normalizadora de módulo (`const quantity=value=>...`,
  // linha ~29), não a variável `quantidade` calculada da locação. O
  // registro salvo ficava com `quantity` apontando pra uma função, que o
  // JSON.stringify descarta ao persistir - e a leitura de volta caía no
  // fallback `quantity(undefined)` = 1 dentro de `normalizedEvent`
  // (availability.js), mascarando silenciosamente qualquer quantidade
  // real > 1.
  it("grava a quantidade real da locação/manutenção no registro de indisponibilidade (não sempre 1)",()=>{
    const initial={...base(),equipamentos:[equipment({id:"eq-1",quantidadeTotal:60,version:1,obraAtualId:""})]};
    const rented=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,"equipment-rental-qty-0001",{rental:{
      id:"loc-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-08-01",fim:"2026-08-30",quantidade:10,
    }},0));
    expect(rented.ok).toBe(true);
    expect(rented.data.equipmentUnavailability.find(item=>item.rentalId==="loc-1")).toMatchObject({quantity:10});
    // Consequência observável pelo usuário: consultar disponibilidade do
    // mesmo equipamento (outra obra, mesmo período) tem que refletir as
    // 10 unidades ocupadas, não 1.
    const availability=rentalAvailability({data:rented.data,equipment:rented.data.equipamentos[0],
      rental:{inicio:"2026-08-01",fim:"2026-08-30",quantidade:1}});
    expect(availability).toMatchObject({total:60,rented:10,free:50});

    const maintained=applyOperationalCommand(rented.data,command(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,"equipment-maintenance-qty-0001",{maintenance:{
      id:"manut-1",equipamentoId:"eq-1",obraId:"obra-a",inicio:"2026-09-01",fim:"2026-09-05",quantidade:5,custo:100,
    }},0));
    expect(maintained.ok).toBe(true);
    expect(maintained.data.equipmentUnavailability.find(item=>item.maintenanceId==="manut-1")).toMatchObject({quantity:5});
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

  it("vincula manutenção à unidade física e bloqueia identidade já locada",()=>{
    const initial={...base(),equipamentos:[equipment({version:1,quantidadeTotal:2})],equipmentRegistryMigration:{version:1},
      equipmentModels:[{id:"model-1",legacySourceId:"eq-1"}],equipmentUnits:[
        {id:"unit-1",modelId:"model-1",legacySourceId:"eq-1",assetTag:"EQ-1A"},
        {id:"unit-2",modelId:"model-1",legacySourceId:"eq-1",assetTag:"EQ-1B"},
      ],equipmentUnavailability:[{id:"u-rental",equipmentId:"eq-1",equipmentUnitId:"unit-1",equipmentUnitIds:["unit-1"],quantity:1,type:"rental",startDate:"2026-08-01",endDate:"2026-08-10",status:"ativa"}]};
    const conflict=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,"physical-maintenance-conflict-0001",{maintenance:{
      id:"m1",equipamentoId:"eq-1",equipmentUnitIds:["unit-1"],inicio:"2026-08-05",fim:"2026-08-06",quantidade:1,custo:100,
    }},0));
    expect(conflict.reason).toMatch(/unidade física selecionada já está indisponível/);
    const valid=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,"physical-maintenance-valid-0001",{maintenance:{
      id:"m2",equipamentoId:"eq-1",equipmentUnitIds:["unit-2"],inicio:"2026-08-05",fim:"2026-08-06",quantidade:1,custo:100,
    }},0));
    expect(valid.ok).toBe(true);
    expect(valid.data.manutencoesEquip[0]).toMatchObject({equipmentUnitId:"unit-2",equipmentUnitIds:["unit-2"]});
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

  it("transfere patrimônio físico e preserva sua identidade no movimento",()=>{
    const initial={...base(),equipamentos:[equipment({version:1,quantidadeTotal:1,patrimonio:"EQ-1"})],equipmentRegistryMigration:{version:1},
      equipmentModels:[{id:"model-1",legacySourceId:"eq-1"}],equipmentUnits:[{id:"unit-1",modelId:"model-1",legacySourceId:"eq-1",assetTag:"EQ-1"}]};
    const result=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,"physical-transfer-unit-0001",{transfer:{
      id:"t1",equipamentoId:"eq-1",equipmentUnitIds:["unit-1"],quantidade:1,deLocationId:"depot",paraObraId:"obra-b",data:"2026-08-04",
    }},1));
    expect(result.ok).toBe(true);
    expect(result.data.transferenciasEquip[0]).toMatchObject({equipmentUnitId:"unit-1",equipmentUnitIds:["unit-1"],deLocationId:"depot",paraObraId:"obra-b",physicalRegistryMovement:true});
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
      tarifas:{dia:80},descontoPct:10,descontoValor:5,regraTarifaria:"best_combination",
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
