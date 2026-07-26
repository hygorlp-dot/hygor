import { describe, expect, it } from "vitest";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "./operational-commands";

const now="2026-07-25T12:00:00.000Z";
const command=(type,idempotencyKey,payload,expectedVersion)=>({type,idempotencyKey,payload,expectedVersion,now,actorId:"u-1",actorName:"Ana"});

describe("comandos operacionais versionados",()=>{
  it("preserva duas criações rápidas em coleções diferentes",()=>{
    const initial={medicoesObra:[],rdos:[]};
    const one=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,"measurement-0001",{measurement:{id:"m-1",obraId:"o-1",data:"2026-07-25",itens:[{tarefaId:"t-1",pctConfirmado:10}]}}));
    const two=applyOperationalCommand(one.data,command(OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED,"field-report-0001",{report:{id:"r-1",obraId:"o-1",data:"2026-07-25"}},0));
    expect(two.data.medicoesObra).toHaveLength(1);expect(two.data.rdos).toHaveLength(1);
  });

  it("aplica a mesma entidade em ordem e recusa versão antiga",()=>{
    const initial={rdos:[{id:"r-1",obraId:"o-1",data:"2026-07-25",version:1,descricao:"antes"}]};
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED,"field-report-0002",{report:{id:"r-1",descricao:"depois"}},1));
    const stale=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED,"field-report-0003",{report:{id:"r-1",descricao:"perdido"}},1));
    expect(first.data.rdos[0]).toMatchObject({descricao:"depois",version:2});expect(stale).toMatchObject({ok:false});expect(stale.reason).toMatch(/alterado/);
  });

  it("trata uma repetição idempotente sem duplicar a medição",()=>{
    const initial={medicoesObra:[]};
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,"measurement-0002",{measurement:{id:"m-1",obraId:"o-1",data:"2026-07-25",itens:[{tarefaId:"t-1",pctConfirmado:10}]}}));
    const repeated=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,"measurement-0002",{measurement:{id:"m-1",obraId:"o-1",data:"2026-07-25",itens:[{tarefaId:"t-1",pctConfirmado:10}]}}));
    expect(repeated.ok).toBe(true);expect(repeated.idempotent).toBe(true);expect(repeated.data.medicoesObra).toHaveLength(1);
  });

  it("cancela o RDO sem apagá-lo e impede versão antiga",()=>{
    const initial={rdos:[{id:"r-1",version:2,status:"concluido"}]};
    const noReason=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED,"field-report-cancel-0000",{reportId:"r-1"},2));
    expect(noReason.ok).toBe(false);
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED,"field-report-cancel-0001",{reportId:"r-1",reason:"Lançamento duplicado"},2));
    const stale=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED,"field-report-cancel-0002",{reportId:"r-1",reason:"Outro"},2));
    expect(first.data.rdos[0]).toMatchObject({status:"cancelado",motivoCancelamento:"Lançamento duplicado",version:3});expect(first.data.rdos[0].operationalHistory).toHaveLength(1);
    expect(stale).toMatchObject({ok:false});
  });

  it("recusa diário sem obra ou data antes de persistir",()=>{
    const invalid=applyOperationalCommand({rdos:[]},command(OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED,"field-report-invalid-0001",{report:{id:"r-1",obraId:"o-1"}},0));
    expect(invalid.ok).toBe(false);expect(invalid.reason).toMatch(/obra e data/);
  });

  it("registra avanço físico de forma idempotente e permite apenas estorno motivado",()=>{
    const initial={progressRecords:[]};
    const payload={record:{id:"p-1",obraId:"o-1",activityId:"a-1",data:"2026-07-25",quantity:5}};
    const created=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,"progress-record-0001",payload,0));
    expect(created.ok).toBe(true);expect(created.data.progressRecords[0]).toMatchObject({status:"confirmado",version:1});
    const repeated=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,"progress-record-0001",payload,0));
    expect(repeated.idempotent).toBe(true);
    const missingReason=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED,"progress-record-cancel-0001",{recordId:"p-1"},1));
    expect(missingReason.ok).toBe(false);
    const cancelled=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED,"progress-record-cancel-0002",{recordId:"p-1",reason:"Registro duplicado"},1));
    expect(cancelled.data.progressRecords[0]).toMatchObject({status:"cancelado",version:2,motivoCancelamento:"Registro duplicado"});
  });

  it("bloqueia avanço de atividade crítica sem APR e permissão liberada",()=>{
    const initial={progressRecords:[],scheduleActivities:[{id:"a-1",criticalActivity:true}],employees:[{id:"u-1"}],jobRiskAnalyses:[],workPermits:[]};
    const payload={record:{id:"p-1",obraId:"o-1",activityId:"a-1",data:"2026-07-25",quantity:5,workerIds:["u-1"]}};
    const blocked=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,"progress-safety-0001",payload,0));
    expect(blocked.ok).toBe(false);expect(blocked.reason).toMatch(/APR aprovada/);
    const released=applyOperationalCommand({...initial,jobRiskAnalyses:[{activityId:"a-1",status:"aprovada"}],workPermits:[{activityId:"a-1",status:"liberada"}]},command(OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,"progress-safety-0002",payload,0));
    expect(released.ok).toBe(true);
  });

  it("conclui compromisso semanal somente com produção ou motivo",()=>{
    const initial={weeklyCommitments:[{id:"c-1",obraId:"o-1",activityId:"a-1",quantidadePrometida:10,version:1,status:"aberto"}],progressRecords:[]};
    const blocked=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED,"weekly-commitment-0001",{commitmentId:"c-1"},1));
    expect(blocked.ok).toBe(false);
    const justified=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED,"weekly-commitment-0002",{commitmentId:"c-1",reason:"Material não entregue"},1));
    expect(justified.data.weeklyCommitments[0]).toMatchObject({status:"nao_concluido",version:2,motivoNaoCumprimento:"Material não entregue"});
    const fulfilled=applyOperationalCommand({...initial,progressRecords:[{id:"p-1",commitmentId:"c-1",quantity:10,status:"confirmado"}]},command(OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED,"weekly-commitment-0003",{commitmentId:"c-1"},1));
    expect(fulfilled.data.weeklyCommitments[0]).toMatchObject({status:"concluido",version:2,quantidadeRealizada:10});
  });

  it("não duplica entrada física ao repetir um recebimento de pedido",()=>{
    const initial={pedidos:[{id:"p-1",obraId:"o-1",version:3,itens:[{id:"i-1",materialId:"mat-1",qtd:2,qtdRecebida:0,precoUnit:10}]}],movEstoque:[],materiais:[]};
    const payload={pedidoId:"p-1",receivedQuantities:{"i-1":2},stockEntries:[{id:"stock-1",pedidoItemId:"i-1",pedidoId:"p-1",obraId:"o-1",materialId:"mat-1",qtd:2}]};
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED,"purchase-receipt-0001",payload,3));
    const repeated=applyOperationalCommand(first.data,command(OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED,"purchase-receipt-0001",payload,3));
    expect(first.data.movEstoque).toHaveLength(1);expect(first.data.pedidos[0].version).toBe(4);expect(repeated.data.movEstoque).toHaveLength(1);
  });

  it("calcula o recebimento no servidor e rejeita quantidade acima do pedido",()=>{
    const initial={pedidos:[{id:"p-1",obraId:"o-1",version:1,itens:[{id:"i-1",materialId:"mat-1",qtd:3,qtdRecebida:1,precoUnit:12}]}],movEstoque:[],materiais:[{id:"mat-1",precoMedio:10}]};
    const payload={pedidoId:"p-1",receivedQuantities:{"i-1":2},stockEntries:[{id:"stock-1",receiptId:"receipt-1",pedidoItemId:"i-1",pedidoId:"p-1",obraId:"o-1",materialId:"mat-1",qtd:2,data:"2026-07-25"}]};
    const first=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED,"purchase-receipt-0002",payload,1));
    expect(first.data.pedidos[0].itens[0].qtdRecebida).toBe(3);
    expect(first.data.materiais[0].precoMedio).toBe(12);
    const excess=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED,"purchase-receipt-0003",{...payload,receivedQuantities:{"i-1":3},stockEntries:[{...payload.stockEntries[0],id:"stock-2",qtd:3}]},1));
    expect(excess).toMatchObject({ok:false});
  });

  it("recompõe o plano e preserva trilha quando uma medição é cancelada",()=>{
    const initial={
      medicoesObra:[],medicoes:[],
      planos:[{id:"plan-1",obraId:"o-1",tarefas:[{id:"t-1",progresso:0}]}],
    };
    const created=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,"measurement-0004",{measurement:{id:"m-1",obraId:"o-1",data:"2026-07-25",itens:[{tarefaId:"t-1",pctConfirmado:60}]}}));
    expect(created.ok).toBe(true);
    expect(created.data.planos[0].tarefas[0].progresso).toBe(60);
    expect(created.data.technicalMeasurementAuditEvents).toHaveLength(1);
    const cancelled=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED,"measurement-cancel-0004",{measurementId:"m-1",reason:"Medição duplicada"},1));
    expect(cancelled.ok).toBe(true);
    expect(cancelled.data.medicoesObra[0]).toMatchObject({status:"cancelada",version:2,motivoCancelamento:"Medição duplicada"});
    expect(cancelled.data.technicalMeasurementAuditEvents).toHaveLength(2);
    expect(cancelled.data.technicalMeasurementProgress["o-1"].items).toEqual([]);
    expect(cancelled.data.planos[0].tarefas[0]).toMatchObject({progresso:0,progressoOrigem:"sem_medicao_tecnica",medicaoTecnicaId:""});
  });

  it("não cancela a fonte técnica enquanto houver faturamento vigente",()=>{
    const initial={
      medicoesObra:[{id:"m-1",obraId:"o-1",version:1,status:"aprovada",data:"2026-07-25",itens:[{tarefaId:"t-1",pctConfirmado:60}]}],
      medicoes:[{id:"fat-1",medicaoTecnicaId:"m-1",status:"emitida"}],
    };
    const result=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED,"measurement-cancel-0005",{measurementId:"m-1",reason:"Correção"},1));
    expect(result).toMatchObject({ok:false});
    expect(result.reason).toMatch(/faturamento/);
  });

  it("bloqueia a medição técnica aprovada com inspeção não conforme",()=>{
    const initial={medicoesObra:[],inspections:[{id:"i-1",obraId:"o-1",serviceId:"t-1",resultado:"nao_conforme"}]};
    const result=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,"measurement-quality-0001",{measurement:{id:"m-1",obraId:"o-1",data:"2026-07-25",itens:[{tarefaId:"t-1",pctConfirmado:10}]}}));
    expect(result.ok).toBe(false);expect(result.reason).toMatch(/não pode ser medida/);
  });
});
