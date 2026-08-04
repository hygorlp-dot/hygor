import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { validateOperationalCommandScope } from "./operational-command-policy.js";

describe("escopo servidor de comandos operacionais",()=>{
  const data={
    medicoesObra:[{id:"m-a",obraId:"obra-a"}],rdos:[{id:"r-a",obraId:"obra-a"}],pedidos:[{id:"p-a",obraId:"obra-a"}],progressRecords:[{id:"av-a",obraId:"obra-a"}],weeklyCommitments:[{id:"c-a",obraId:"obra-a"}],qualidadeRegistros:[{id:"q-a",obraId:"obra-a"}],lookaheadWindows:[{id:"la-a",obraId:"obra-a"}],
    payments:[{id:"rec-a",obraId:"obra-a"}],medicoes:[{id:"med-a",obraId:"obra-a"}],
    caixaObra:[{id:"cx-a",obraId:"obra-a",version:1}],
    equipamentos:[{id:"eq-a",obraAtualId:"obra-a"},{id:"eq-b",obraAtualId:"obra-b"}],
    locacoesEquip:[{id:"loc-a",obraId:"obra-a",equipamentoId:"eq-a"}],
    equipmentUnavailability:[{id:"res-a",equipmentId:"eq-a",workId:"obra-a",type:"reservation"}],
    terceirizados:[{id:"terc-a",obraId:"obra-a"},{id:"terc-b",obraId:"obra-b"}],
    medicoesTerc:[{id:"mt-a",tercId:"terc-a",obraId:"obra-a",version:1}],
    pagsTerceiros:[{id:"pt-a",tercId:"terc-a",obraId:"obra-a",version:1}],
    notasFiscais:[{id:"nf-a",obraId:"obra-a",version:1}],
    employees:[{id:"emp-a",obra:"obra-a"},{id:"emp-admin",obra:"",workArea:"administrativo"}],
    advances:[{id:"adv-a",empId:"emp-a",version:1}],
    rescisoes:[{id:"resc-a",obraId:"obra-a",version:1}],
  };
  const user={id:"u-1",role:"engenheiro",obraId:"obra-a"};
  it("reserva a migração do cadastro físico de equipamentos ao administrador",()=>{
    const command={type:OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_MIGRATED,payload:{}};
    expect(validateOperationalCommandScope({user:{role:"admin"},data,command})).toMatchObject({ok:true,scope:"company"});
    expect(validateOperationalCommandScope({user,data,command})).toMatchObject({ok:false});
    const classification={type:OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED,payload:{equipmentId:"eq-a",kind:"lot"}};
    expect(validateOperationalCommandScope({user:{role:"admin"},data,command:classification})).toMatchObject({ok:true,scope:"company"});
    expect(validateOperationalCommandScope({user:{role:"financeiro"},data,command:classification})).toMatchObject({ok:false});
  });

  it("aceita somente a obra atribuída em criação e cancelamento de medição",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,payload:{measurement:{obraId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,payload:{measurement:{obraId:"obra-b"}}}})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED,payload:{measurementId:"m-a"}}})).toMatchObject({ok:true});
  });
  it("não deixa usar identificador de outra obra para RDO ou recebimento",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED,payload:{reportId:"r-a"}}})).toMatchObject({ok:true});
    expect(validateOperationalCommandScope({user,data:{...data,pedidos:[{id:"p-b",obraId:"obra-b"}]},command:{type:OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED,payload:{pedidoId:"p-b"}}})).toMatchObject({ok:false});
  });
  it("protege criação e cancelamento de reservas pelo escopo da obra",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED,payload:{unavailability:{id:"res-new",equipmentId:"eq-a",workId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED,payload:{unavailability:{id:"res-new",equipmentId:"eq-b",workId:"obra-b"}}}})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_CANCELLED,payload:{unavailabilityId:"res-a"}}})).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("protege criação e estorno de recebimento manual pelo escopo da obra",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED,payload:{receipt:{obraId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED,payload:{receipt:{obraId:"obra-b"}}}})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.MANUAL_RECEIPT_REVERSED,payload:{receiptId:"rec-a"}}})).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("protege todos os comandos de medição financeira pelo escopo da obra",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_SAVED,payload:{measurement:{obraId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENTS_GENERATED,payload:{obraId:"obra-b"}}})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_CANCELLED,payload:{measurementId:"med-a"}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,payload:{changes:[{measurementId:"med-a"}]}}})).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("vincula a ativação comercial à obra informada no comando",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED,payload:{obraId:"obra-a"}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED,payload:{obraId:"obra-b"}}})).toMatchObject({ok:false});
  });
  it("protege despesas por obra e reserva despesas corporativas ao financeiro",()=>{
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.PROJECT_EXPENSE_CREATED,
      payload:{expense:{obraId:"obra-a"}},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.PROJECT_EXPENSE_CREATED,
      payload:{expense:{obraId:"obra-b"}},
    }})).toMatchObject({ok:false});
    const companyCommand={
      type:OPERATIONAL_COMMAND.COMPANY_EXPENSE_SAVED,
      payload:{expense:{id:"c-1"}},
    };
    expect(validateOperationalCommandScope({user,data,command:companyCommand})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({
      user:{id:"fin",role:"financeiro"},data,command:companyCommand,
    })).toMatchObject({ok:true,scope:"company"});
  });
  it("mantém criação e cancelamento do caixa dentro da obra atribuída",()=>{
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CREATED,
      payload:{movement:{obraId:"obra-a"}},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CREATED,
      payload:{movement:{obraId:"obra-b"}},
    }})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CANCELLED,
      payload:{movementId:"cx-a"},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("protege pagamentos de obrigações pelo vínculo autoritativo da obra",()=>{
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_RECORDED,
      payload:{targetType:"pedido",targetId:"p-a"},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data:{...data,pedidos:[{id:"p-b",obraId:"obra-b"}]},command:{
      type:OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED,
      payload:{targetType:"pedido",targetId:"p-b",paymentId:"pg-1"},
    }})).toMatchObject({ok:false});
  });
  it("protege o cancelamento integral da compra pelo pedido autoritativo",()=>{
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.PURCHASE_CANCELLED,payload:{orderId:"p-a"},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({
      user,data:{...data,pedidos:[{id:"p-b",obraId:"obra-b"}]},
      command:{type:OPERATIONAL_COMMAND.PURCHASE_CANCELLED,payload:{orderId:"p-b"}},
    })).toMatchObject({ok:false});
  });
  it("reserva os comandos de transações bancárias ao financeiro corporativo",()=>{
    const command={
      type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IGNORED,
      payload:{targets:[{id:"tx-1",expectedVersion:0}]},
    };
    expect(validateOperationalCommandScope({user,data,command}))
      .toMatchObject({ok:false});
    expect(validateOperationalCommandScope({
      user:{id:"fin",role:"financeiro",obraId:"obra-a"},data,command,
    })).toMatchObject({ok:true,scope:"company",obraId:""});
    expect(validateOperationalCommandScope({
      user:{id:"admin",role:"admin"},data,
      command:{type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IMPORTED,payload:{}},
    })).toMatchObject({ok:true,scope:"company"});
  });
  it("protege medições e pagamentos de terceiros pela obra autoritativa",()=>{
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED,
      payload:{measurement:{tercId:"terc-a"}},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED,
      payload:{measurement:{tercId:"terc-b"}},
    }})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED,
      payload:{measurementId:"mt-a"},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_REVERSED,
      payload:{paymentId:"pt-a"},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("protege criação, edição e aprovação fiscal pela obra autoritativa",()=>{
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.INVOICE_SAVED,
      payload:{invoice:{id:"nf-new",obraId:"obra-a"}},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.INVOICE_SAVED,
      payload:{invoice:{id:"nf-new",obraId:"obra-b"}},
    }})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{
      type:OPERATIONAL_COMMAND.INVOICE_APPROVED,
      payload:{invoiceId:"nf-a"},
    }})).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("protege rescisões pela obra do funcionário e permite lançamento manual ao RH",()=>{
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,
      command:{
        type:OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED,
        payload:{rescission:{empId:"emp-a"}},
      },
    })).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,
      command:{
        type:OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED,
        payload:{rescission:{empName:"Cadastro manual"}},
      },
    })).toMatchObject({ok:true,scope:"company"});
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,
      command:{
        type:OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CANCELLED,
        payload:{rescissionId:"resc-a"},
      },
    })).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("reserva cadastro e movimentação de funcionários ao RH e administrador",()=>{
    const command={
      type:OPERATIONAL_COMMAND.EMPLOYEE_SAVED,
      payload:{employee:{id:"emp-a",obra:"obra-a"}},
    };
    expect(validateOperationalCommandScope({user,data,command}))
      .toMatchObject({ok:false});
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,command,
    })).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({
      user:{id:"admin",role:"admin"},data,
      command:{...command,payload:{employee:{id:"emp-novo",obra:""}}},
    })).toMatchObject({ok:true,scope:"company"});
  });
  it("permite ao RH adiantamento de campo e administrativo, mas bloqueia outros perfis",()=>{
    const fieldCommand={
      type:OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CREATED,
      payload:{advance:{id:"adv-new",empId:"emp-a"}},
    };
    const adminCommand={
      type:OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CREATED,
      payload:{advance:{id:"adv-admin",empId:"emp-admin"}},
    };
    expect(validateOperationalCommandScope({user,data,command:fieldCommand})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,command:fieldCommand,
    })).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,command:adminCommand,
    })).toMatchObject({ok:true,scope:"company",obraId:""});
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,
      command:{type:OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CANCELLED,payload:{advanceId:"adv-a"}},
    })).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("reserva configurações corporativas ao administrador",()=>{
    const command={
      type:OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED,
      payload:{config:{companyName:"ARCD"}},
    };
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,command,
    })).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({
      user:{id:"admin",role:"admin"},data,command,
    })).toMatchObject({ok:true,scope:"company",obraId:""});
  });
  it("reserva cadastro e exclusão de obras ao administrador",()=>{
    const save={
      type:OPERATIONAL_COMMAND.PROJECT_SAVED,
      payload:{project:{id:"obra-a",name:"B2-04"}},
    };
    const remove={
      type:OPERATIONAL_COMMAND.PROJECT_DELETED,
      payload:{projectId:"obra-a"},
    };
    expect(validateOperationalCommandScope({
      user:{id:"rh",role:"rh"},data,command:save,
    })).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({
      user:{id:"admin",role:"admin"},data,command:save,
    })).toMatchObject({ok:true,scope:"company",obraId:"obra-a"});
    expect(validateOperationalCommandScope({
      user:{id:"admin",role:"admin"},data,command:remove,
    })).toMatchObject({ok:true,scope:"company",obraId:"obra-a"});
  });
  it("mantém o avanço físico dentro da obra atribuída",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,payload:{record:{obraId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,payload:{record:{obraId:"obra-b"}}}})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED,payload:{recordId:"av-a"}}})).toMatchObject({ok:true});
  });
  it("mantém a conclusão do compromisso dentro da obra atribuída",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED,payload:{commitmentId:"c-a"}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED,payload:{commitment:{obraId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
  });
  it("não permite inspecionar ou gerar ficha fora da obra atribuída",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.QUALITY_ITEM_INSPECTED,payload:{recordId:"q-a"}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data:{...data,qualidadeRegistros:[{id:"q-b",obraId:"obra-b"}]},command:{type:OPERATIONAL_COMMAND.QUALITY_RECORD_RELEASED,payload:{recordId:"q-b"}}})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.QUALITY_PLAN_GENERATED,payload:{records:[{obraId:"obra-b"}]}}})).toMatchObject({ok:false});
  });
  it("mantém APR e permissão de trabalho no escopo da obra",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED,payload:{analysis:{obraId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.SAFETY_WORK_PERMIT_SAVED,payload:{permit:{obraId:"obra-b"}}}})).toMatchObject({ok:false});
  });
  it("não deixa alterar o Lookahead de outra obra",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.LOOKAHEAD_CREATED,payload:{lookahead:{obraId:"obra-a"}}}})).toMatchObject({ok:true});
    expect(validateOperationalCommandScope({user,data:{...data,lookaheadWindows:[{id:"la-b",obraId:"obra-b"}]},command:{type:OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED,payload:{lookaheadId:"la-b"}}})).toMatchObject({ok:false});
  });
  it("protege locação, manutenção e transferência pelo escopo da obra",()=>{
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,payload:{rental:{obraId:"obra-a"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,payload:{rentalId:"loc-a"}}})).toMatchObject({ok:true});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,payload:{rentalId:"loc-a",nextState:"pickup_requested"}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,payload:{rentalId:"loc-a",checkpoint:{type:"separation"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,payload:{rentalId:"loc-a",amendment:{type:"extension"}}}})).toMatchObject({ok:true,obraId:"obra-a"});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,payload:{maintenance:{equipamentoId:"eq-a"}}}})).toMatchObject({ok:true});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_SAVED,payload:{equipment:{obraAtualId:"obra-b"}}}})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data,command:{type:OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,payload:{transfer:{equipamentoId:"eq-b",paraObraId:"obra-a"}}}})).toMatchObject({ok:false});
  });
  it("permite cadastro corporativo apenas para perfil sem restrição de obra",()=>{
    const companyCommand={type:OPERATIONAL_COMMAND.EQUIPMENT_SAVED,payload:{equipment:{obraAtualId:""}}};
    expect(validateOperationalCommandScope({user,data,command:companyCommand})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user:{id:"admin",role:"admin"},data,command:companyCommand})).toMatchObject({ok:true,scope:"company"});
    expect(validateOperationalCommandScope({user:{id:"fin",role:"financeiro"},data,command:companyCommand})).toMatchObject({ok:true,scope:"company"});
  });
});
