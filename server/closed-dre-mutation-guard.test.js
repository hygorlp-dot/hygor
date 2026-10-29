import {describe,expect,it} from "vitest";
import {buildRequestedDreProjectionRows} from "./dre-projection.js";
import {normalizeArchivedCosts,summarizeArchivedCosts} from "./archived-costs.js";
import {createMonthlyClosingSnapshot} from "../src/domains/financeiro/workflows.js";
import {buildFinancialLedger} from "../src/domains/financeiro/ledger.js";
import {
  closedCompetenceForDate,
  validateClosedCompanyDreMutation,
  validateClosedRepresentationPreservation,
} from "./closed-dre-mutation-guard.js";

const closeMonth=(data,competencia)=>{
  const [year,month]=competencia.split("-").map(Number);
  const dre=buildRequestedDreProjectionRows(data,[{
    year,month:month-1,period:"mes",scope:"company_dre",
  }])[0];
  const result=createMonthlyClosingSnapshot(data,{
    competencia,
    actor:{id:"admin",nome:"Administrador"},
    closedAt:new Date(Date.UTC(year,month,1,9)).toISOString(),
    canonicalDreSnapshot:{
      sourceId:dre.sourceId,
      canonicalRevision:"rev-1",
      sourceRevision:"src-1",
      projectionVersion:"v1",
      payload:dre.payload,
    },
  });
  if(!result.ok)throw new Error(result.error);
  return{...data,fechamentosFinanceiros:[...(data.fechamentosFinanceiros||[]),result.closing]};
};
const closeJuly=data=>closeMonth(data,"2026-07");

const rawBase=()=>({
  obras:[{
    id:"o1",name:"Obra 1",status:"active",contractValue:10000,
    contractType:"fixed",cliente:"Cliente",
  }],
  medicoes:[{
    id:"m1",obraId:"o1",competencia:"2026-07",valorPrevisto:1000,
    dataEmissao:"2026-07-05",dataVencimento:"2026-07-15",
  }],
  config:{aliquotaISS:2,aliquotaPIS:0,aliquotaCOFINS:0,companyName:"Empresa A"},
  employees:[],attendance:{},archivedLaborCosts:{},
  pagsTerceiros:[],outrasDesp:[],despesasEmpresa:[],pedidos:[],
  rescisoes:[],equipamentos:[],locacoesEquip:[],manutencoesEquip:[],
  payments:[],notasFiscais:[],medicoesTerc:[],transacoes:[],
  titulosFolha:[],pagamentosFolha:[],caixaObra:[],
});

const baseData=()=>closeJuly(rawBase());

const settlementCases=[
  {name:"recebimento de medição",collection:"medicoes",field:"recebimentos",effects:["cash_in","receivable_decrease"]},
  ...["empresa","cliente_direto"].map(origem=>({
    name:`pagamento de NF por ${origem}`,collection:"notasFiscais",field:"pagamentos",origem,
    row:{id:"nf-1",obraId:"o1",competencia:"2026-07",dataEmissao:"2026-07-05",valorBruto:1000,status:"conferida"},
    effects:[origem==="cliente_direto"?"third_party_payment":"cash_out","payable_decrease"],
  })),
  {
    name:"pagamento de medição de terceiro",collection:"medicoesTerc",field:"pagamentos",
    row:{id:"mt-1",obraId:"o1",competencia:"2026-07",data:"2026-07-05",total:1000,status:"aprovada"},
    effects:["cash_out","payable_decrease"],
  },
  {
    name:"liquidação de folha",collection:"titulosFolha",field:"liquidacoes",
    row:{id:"folha-1",employeeId:"e1",competencia:"2026-07",periodoFim:"2026-07-31",vencimento:"2026-08-05",liquido:1000,rateiosPorObra:[{obraId:"o1",valor:1000}]},
    effects:["cash_out","payable_decrease"],
  },
];

const withSettlement=(data,spec,date="2026-08-10",valor=400)=>{
  const after=structuredClone(data);
  after[spec.collection][0][spec.field]=[{
    id:"settlement-test",data:date,valor,origem:spec.origem||"empresa",
  }];
  return after;
};

describe("FIN 9.6 — competência fechada congela fatos, não cadastros",()=>{
  it("permite alterar parâmetros mestres depois do fechamento",()=>{
    const before=baseData();
    const after={
      ...before,
      config:{...before.config,aliquotaISS:5,companyName:"Empresa Renomeada"},
      obras:before.obras.map(obra=>({...obra,contractValue:15000,cliente:"Cliente Novo"})),
      employees:[{id:"e1",name:"Novo funcionário",salary:3000,payMode:"clt"}],
    };
    expect(validateClosedCompanyDreMutation({before,after})).toEqual({
      ok:true,changes:[],
    });
  });

  it("bloqueia remoção ou alteração da própria evidência de fechamento",()=>{
    const before=baseData();
    const removed={...before,fechamentosFinanceiros:[]};
    expect(validateClosedCompanyDreMutation({before,after:removed})).toMatchObject({
      ok:false,changes:[{competence:"2026-07",code:"closed_snapshot_modified"}],
    });

    const changed=structuredClone(before);
    changed.fechamentosFinanceiros[0].snapshot.cashBalanceCents+=1;
    expect(validateClosedCompanyDreMutation({before,after:changed})).toMatchObject({
      ok:false,changes:[{competence:"2026-07",code:"closed_snapshot_modified"}],
    });
  });

  it("bloqueia recebimento retroativo que altera fato financeiro de julho",()=>{
    const before=baseData();
    const after=structuredClone(before);
    after.medicoes[0].recebimentos=[{
      id:"r1",valor:400,data:"2026-07-10",
    }];
    const result=validateClosedCompanyDreMutation({before,after});
    expect(result.ok).toBe(false);
    expect(result.changes.some(item=>
      item.competence==="2026-07"
      &&item.code==="closed_financial_event_changed"
    )).toBe(true);
  });

  it.each(settlementCases)("permite $name em agosto e conserva o reconhecimento de julho",spec=>{
    const raw=rawBase();
    if(spec.row)raw[spec.collection]=[spec.row];
    const before=closeJuly(raw);
    const after=withSettlement(before,spec);
    const events=buildFinancialLedger(after).events
      .filter(event=>event.sourceSubId.startsWith("settlement-test"));
    expect(events.map(event=>event.effect).sort()).toEqual([...spec.effects].sort());
    expect(events.every(event=>event.competence==="2026-07"&&event.date==="2026-08-10")).toBe(true);
    expect(validateClosedCompanyDreMutation({before,after})).toEqual({ok:true,changes:[]});
    expect(after.fechamentosFinanceiros).toEqual(before.fechamentosFinanceiros);

    // A correção/remoção da baixa continua permitida enquanto agosto está aberto.
    expect(validateClosedCompanyDreMutation({before:after,after:withSettlement(after,spec,"2026-08-11",450)}))
      .toEqual({ok:true,changes:[]});
    expect(validateClosedCompanyDreMutation({before:after,after:before})).toEqual({ok:true,changes:[]});
    // A mesma liquidação não pode ser deslocada para julho já encerrado.
    const retroactive=validateClosedCompanyDreMutation({before:after,after:withSettlement(after,spec,"2026-07-20")});
    expect(retroactive.ok).toBe(false);
    expect(retroactive.changes).toHaveLength(spec.effects.length);
    expect(retroactive.changes.every(change=>change.competence==="2026-07")).toBe(true);
  });

  it.each(settlementCases)("congela $name quando a própria data da baixa é encerrada",spec=>{
    const raw=rawBase();
    if(spec.row)raw[spec.collection]=[spec.row];
    const before=closeMonth(withSettlement(closeJuly(raw),spec),"2026-08");
    const after=structuredClone(before);
    after[spec.collection][0][spec.field]=[];
    const result=validateClosedCompanyDreMutation({before,after});
    expect(result.ok).toBe(false);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.every(change=>change.competence==="2026-08")).toBe(true);
  });

  it("permite fato financeiro novo em competência aberta",()=>{
    const before=baseData();
    const after={
      ...before,
      payments:[{
        id:"aug-receipt",obraId:"o1",date:"2026-08-05",
        amount:100,description:"Recebimento agosto",
      }],
    };
    expect(validateClosedCompanyDreMutation({before,after})).toEqual({
      ok:true,changes:[],
    });
  });

  it("bloqueia mudança de vencimento que toca competência fechada",()=>{
    const before=baseData();
    const after=structuredClone(before);
    after.medicoes[0].dataVencimento="2026-08-15";
    const result=validateClosedCompanyDreMutation({before,after});
    expect(result.ok).toBe(false);
    expect(result.changes.some(item=>
      item.code==="closed_financial_event_changed"
      &&item.competence==="2026-07"
    )).toBe(true);
  });

  it("congela o movimento bancário bruto do mês encerrado",()=>{
    const raw={
      ...rawBase(),
      transacoes:[{
        id:"tx-jul",data:"2026-07-20",valor:-100,status:"pendente",
        descricao:"Movimento bancário",obraId:"o1",extratoId:"ext-1",
      }],
    };
    const before=closeJuly(raw);
    const changed=structuredClone(before);
    changed.transacoes[0].status="ignorado";
    const result=validateClosedCompanyDreMutation({before,after:changed});
    expect(result.ok).toBe(false);
    expect(result.changes[0]).toMatchObject({
      competence:"2026-07",
      code:"closed_bank_transaction_changed",
      transactionId:"tx-jul",
    });

    const openMonth={
      ...before,
      transacoes:[...before.transacoes,{
        id:"tx-ago",data:"2026-08-02",valor:50,status:"pendente",
      }],
    };
    expect(validateClosedCompanyDreMutation({before,after:openMonth})).toEqual({
      ok:true,changes:[],
    });
  });

  it("bloqueia locação que cria ou altera efeito em mês fechado",()=>{
    const before=baseData();
    const after={
      ...before,
      locacoesEquip:[{
        id:"rent-jul",equipamentoId:"eq-1",obraId:"o1",
        inicio:"2026-07-10",fim:"2026-07-20",status:"ativa",
        quantidade:1,valorDiaria:100,tarifas:{dia:100},
      }],
    };
    const result=validateClosedCompanyDreMutation({before,after});
    expect(result).toMatchObject({
      ok:false,
      changes:[{competence:"2026-07",code:"closed_equipment_rental_changed",rentalId:"rent-jul"}],
    });

    const august={...before,locacoesEquip:[{
      id:"rent-ago",equipamentoId:"eq-1",obraId:"o1",
      inicio:"2026-08-10",fim:"2026-08-20",status:"ativa",
      quantidade:1,valorDiaria:100,tarifas:{dia:100},
    }]};
    expect(validateClosedCompanyDreMutation({before,after:august})).toEqual({
      ok:true,changes:[],
    });
  });

  it("permite encerrar em agosto uma locação aberta que já atravessou julho fechado",()=>{
    const raw={
      ...rawBase(),
      equipamentos:[{id:"eq-1",nome:"Betoneira",tarifas:{dia:100}}],
      locacoesEquip:[{
        id:"rent-cross",equipamentoId:"eq-1",obraId:"o1",
        inicio:"2026-07-20",fim:"",status:"ativa",quantidade:1,
        commercialSnapshot:{tarifas:{dia:100},descontoPct:0,descontoValor:0},
      }],
    };
    const before=closeJuly(raw);
    const after=structuredClone(before);
    after.locacoesEquip[0].fim="2026-08-10";
    after.locacoesEquip[0].status="encerrada";
    after.locacoesEquip[0].lifecycleState="closed";

    expect(validateClosedCompanyDreMutation({before,after})).toEqual({
      ok:true,changes:[],
    });
  });

  it("bloqueia cancelamento retroativo de locação que gerou efeito em julho fechado",()=>{
    const raw={
      ...rawBase(),
      equipamentos:[{id:"eq-1",nome:"Betoneira",tarifas:{dia:100}}],
      locacoesEquip:[{
        id:"rent-jul",equipamentoId:"eq-1",obraId:"o1",
        inicio:"2026-07-10",fim:"2026-07-20",status:"ativa",quantidade:1,
        commercialSnapshot:{tarifas:{dia:100},descontoPct:0,descontoValor:0},
      }],
    };
    const before=closeJuly(raw);
    const after=structuredClone(before);
    after.locacoesEquip[0].status="cancelada";
    after.locacoesEquip[0].lifecycleState="cancelled";

    expect(validateClosedCompanyDreMutation({before,after})).toMatchObject({
      ok:false,
      changes:[{competence:"2026-07",code:"closed_equipment_rental_changed",rentalId:"rent-jul"}],
    });
  });

  it("bloqueia override comercial que recalcularia julho fechado",()=>{
    const raw={
      ...rawBase(),
      equipamentos:[{id:"eq-1",nome:"Betoneira",tarifas:{dia:100}}],
      locacoesEquip:[{
        id:"rent-price",equipamentoId:"eq-1",obraId:"o1",
        inicio:"2026-07-10",fim:"2026-08-10",status:"ativa",quantidade:1,
        commercialSnapshot:{tarifas:{dia:100},descontoPct:0,descontoValor:0},
      }],
    };
    const before=closeJuly(raw);
    const after=structuredClone(before);
    after.locacoesEquip[0].commercialSnapshot={
      ...after.locacoesEquip[0].commercialSnapshot,
      tarifas:{dia:120},
    };

    expect(validateClosedCompanyDreMutation({before,after})).toMatchObject({
      ok:false,
      changes:[{competence:"2026-07",code:"closed_equipment_rental_changed",rentalId:"rent-price"}],
    });
  });

  it("bloqueia manutenção financeira datada no mês fechado",()=>{
    const before=baseData();
    const after={...before,manutencoesEquip:[{
      id:"maint-jul",equipamentoId:"eq-1",obraId:"o1",
      data:"2026-07-12",custo:250,pagoPor:"empresa",
    }]};
    expect(validateClosedCompanyDreMutation({before,after})).toMatchObject({
      ok:false,
      changes:[{competence:"2026-07",code:"closed_equipment_maintenance_changed",maintenanceId:"maint-jul"}],
    });
  });

  it("bloqueia cancelamento de manutenção que pertence ao mês fechado",()=>{
    const before=closeJuly({
      ...rawBase(),
      equipamentos:[{id:"eq-1",nome:"Betoneira"}],
      manutencoesEquip:[{
        id:"maint-jul",equipamentoId:"eq-1",obraId:"o1",
        data:"2026-07-12",custo:250,pagoPor:"empresa",status:"concluida",
      }],
    });
    const after=structuredClone(before);
    after.manutencoesEquip[0].status="cancelada";

    expect(validateClosedCompanyDreMutation({before,after})).toMatchObject({
      ok:false,
      changes:[{competence:"2026-07",code:"closed_equipment_maintenance_changed",maintenanceId:"maint-jul"}],
    });
  });

  it("alteração meramente descritiva de cadastro de equipamento continua permitida",()=>{
    const before={
      ...baseData(),
      equipamentos:[{id:"eq-1",nome:"Betoneira",tarifas:{dia:100}}],
    };
    const after={
      ...before,
      equipamentos:[{...before.equipamentos[0],nome:"Betoneira 400 L",tarifas:{dia:120}}],
    };
    // Cadastro mestre pode evoluir; locações encerradas têm snapshot comercial
    // e o DRE fechado é lido da fotografia de fechamento.
    expect(validateClosedCompanyDreMutation({before,after})).toEqual({
      ok:true,changes:[],
    });
  });

  it("arquivar ponto é permitido quando a representação preserva o resultado derivado",()=>{
    const raw={
      ...rawBase(),
      employees:[{
        id:"e1",name:"Operário",obra:"o1",dailyRate:100,vtDaily:10,
        workdayHours:8,startDate:"2026-01-01",
      }],
      attendance:{e1:{"2026-07-10":{status:"P",obraId:"o1"}}},
      archivedLaborCosts:{},
    };
    const before=closeJuly(raw);
    const employeesSnapshot=raw.employees.map(employee=>({...employee}));
    const archived=normalizeArchivedCosts(summarizeArchivedCosts({
      attendance:raw.attendance,employeesSnapshot,
    },raw.config));
    const after={
      ...before,
      attendance:{},
      archivedLaborCosts:{q1:archived},
    };

    expect(validateClosedRepresentationPreservation({before,after})).toEqual({
      ok:true,changes:[],
    });
  });

  it("arquivo histórico adulterado em um centavo falha na prova de equivalência",()=>{
    const raw={
      ...rawBase(),
      employees:[{
        id:"e1",name:"Operário",obra:"o1",dailyRate:100,vtDaily:10,
        workdayHours:8,startDate:"2026-01-01",
      }],
      attendance:{e1:{"2026-07-10":{status:"P",obraId:"o1"}}},
      archivedLaborCosts:{},
    };
    const before=closeJuly(raw);
    const archived=normalizeArchivedCosts(summarizeArchivedCosts({
      attendance:raw.attendance,employeesSnapshot:raw.employees,
    },raw.config));
    archived.byDate["2026-07-10"].o1.laborCost+=0.01;
    const after={...before,attendance:{},archivedLaborCosts:{q1:archived}};
    const result=validateClosedRepresentationPreservation({before,after});
    expect(result.ok).toBe(false);
    expect(result.changes[0]).toMatchObject({
      competence:"2026-07",code:"closed_representation_changed",
    });
  });

  it("prova de representação tolera mudança posterior de parâmetro mestre igual nos dois lados",()=>{
    const before=baseData();
    const withNewTax={
      ...before,
      config:{...before.config,aliquotaISS:7},
    };
    const after=structuredClone(withNewTax);
    // Nenhum fato muda; ambos os lados são recalculados sob a mesma configuração.
    expect(validateClosedRepresentationPreservation({
      before:withNewTax,after,
    })).toEqual({ok:true,changes:[]});
  });

  it("identifica datas pertencentes a competência fechada",()=>{
    const data=baseData();
    expect(closedCompetenceForDate(data,"2026-07-01")?.competencia).toBe("2026-07");
    expect(closedCompetenceForDate(data,"2026-07-31")?.competencia).toBe("2026-07");
    expect(closedCompetenceForDate(data,"2026-08-01")).toBeNull();
    expect(closedCompetenceForDate(data,"")).toBeNull();
  });
});
