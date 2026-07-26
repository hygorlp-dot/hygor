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
    const withoutWorkers=applyOperationalCommand({...initial,jobRiskAnalyses:[{activityId:"a-1",status:"aprovada"}],workPermits:[{activityId:"a-1",status:"liberada"}]},command(OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,"progress-safety-0003",{record:{...payload.record,workerIds:[]}},0));
    expect(withoutWorkers.ok).toBe(false);expect(withoutWorkers.reason).toMatch(/equipe identificada/);
  });

  it("aplica a segurança a compromisso crítico mesmo sem atividade no novo cadastro",()=>{
    const initial={progressRecords:[],employees:[{id:"u-1"}],jobRiskAnalyses:[],workPermits:[]};
    const payload={record:{id:"p-1",obraId:"o-1",activityId:"legado-1",criticalActivity:true,data:"2026-07-25",quantity:5,workerIds:[]}};
    const withoutWorkers=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,"progress-legacy-safety-0001",payload,0));
    expect(withoutWorkers.ok).toBe(false);expect(withoutWorkers.reason).toMatch(/equipe identificada/);
    const released=applyOperationalCommand({...initial,jobRiskAnalyses:[{activityId:"legado-1",status:"aprovada"}],workPermits:[{activityId:"legado-1",status:"liberada"}]},command(OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,"progress-legacy-safety-0002",{record:{...payload.record,workerIds:["u-1"]}},0));
    expect(released.ok).toBe(true);
  });

  it("versiona APR, exige controles para aprová-la e libera PT somente após a APR",()=>{
    const initial={jobRiskAnalyses:[],workPermits:[]};
    const invalidApr=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED,"safety-apr-invalid-0001",{analysis:{id:"apr-1",obraId:"o-1",activityId:"a-1",status:"aprovada",risks:[],controls:[]}},0));
    expect(invalidApr.ok).toBe(false);
    const draft=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED,"safety-apr-draft-0001",{analysis:{id:"apr-1",obraId:"o-1",activityId:"a-1",status:"rascunho",risks:["queda"],controls:["linha de vida"]}},0));
    const prematurePermit=applyOperationalCommand(draft.data,command(OPERATIONAL_COMMAND.SAFETY_WORK_PERMIT_SAVED,"safety-permit-blocked-0001",{permit:{id:"pt-1",obraId:"o-1",activityId:"a-1",status:"liberada",validFrom:"2026-07-25",validUntil:"2026-07-26"}},0));
    expect(prematurePermit.ok).toBe(false);expect(prematurePermit.reason).toMatch(/APR aprovada/);
    const approved=applyOperationalCommand(draft.data,command(OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED,"safety-apr-approved-0001",{analysis:{...draft.data.jobRiskAnalyses[0],status:"aprovada"}},1));
    const released=applyOperationalCommand(approved.data,command(OPERATIONAL_COMMAND.SAFETY_WORK_PERMIT_SAVED,"safety-permit-released-0001",{permit:{id:"pt-1",obraId:"o-1",activityId:"a-1",status:"liberada",validFrom:"2026-07-25",validUntil:"2026-07-26"}},0));
    expect(approved.data.jobRiskAnalyses[0]).toMatchObject({status:"aprovada",version:2});
    expect(released.data.workPermits[0]).toMatchObject({status:"liberada",version:1});
    const stale=applyOperationalCommand(released.data,command(OPERATIONAL_COMMAND.SAFETY_WORK_PERMIT_SAVED,"safety-permit-stale-0001",{permit:{...released.data.workPermits[0],status:"suspensa"}},0));
    expect(stale.ok).toBe(false);expect(stale.reason).toMatch(/alterad/);
  });

  it("versiona restrição de Lookahead e exige evidência antes da liberação",()=>{
    const initial={lookaheadWindows:[]};
    const created=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.LOOKAHEAD_CREATED,"lookahead-create-0001",{lookahead:{id:"la-1",obraId:"o-1",semanaInicio:"2026-07-27",semanaFim:"2026-08-21",horizonteSemanas:4,pacotes:[{id:"pac-1",descricao:"Concretagem"}]}},0));
    const restricted=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED,"lookahead-constraint-0001",{lookaheadId:"la-1",constraint:{id:"res-1",obraId:"o-1",pacoteId:"pac-1",categoria:"seguranca",descricao:"APR",bloqueante:true,dataIdentificacao:"2026-07-25",dataNecessidade:"2026-07-27"}},1));
    const noEvidence=applyOperationalCommand(restricted.data,command(OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED,"lookahead-release-0001",{lookaheadId:"la-1",constraintId:"res-1",evidenceIds:[]},2));
    expect(noEvidence.ok).toBe(false);
    const released=applyOperationalCommand(restricted.data,command(OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED,"lookahead-release-0002",{lookaheadId:"la-1",constraintId:"res-1",evidenceIds:["doc-1"]},2));
    const committed=applyOperationalCommand(released.data,command(OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED,"lookahead-commit-0001",{lookaheadId:"la-1",packageId:"pac-1"},3));
    expect(released.data.lookaheadWindows[0]).toMatchObject({version:3});
    expect(committed.data.lookaheadWindows[0].pacotes[0]).toMatchObject({status:"comprometido",comprometido:true});
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

  it("cria compromisso semanal de forma idempotente",()=>{
    const initial={weeklyCommitments:[]};const payload={commitment:{id:"c-1",obraId:"o-1",activityId:"a-1",descricao:"Alvenaria",quantidadePrometida:10}};
    const created=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED,"weekly-create-0001",payload));
    const repeated=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED,"weekly-create-0001",payload));
    expect(created.data.weeklyCommitments[0]).toMatchObject({status:"aberto",version:1});expect(repeated.idempotent).toBe(true);
  });

  it("mantém restrição auditável e bloqueia avanço até a liberação",()=>{
    const initial={weeklyCommitments:[],progressRecords:[]};
    const created=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED,"weekly-blocked-create-0001",{commitment:{id:"c-1",obraId:"o-1",activityId:"a-1",descricao:"Alvenaria",quantidadePrometida:10,blockingReason:"Aguardando material"}}));
    expect(created.data.weeklyCommitments[0]).toMatchObject({status:"bloqueado",blockingReason:"Aguardando material",version:1});
    const blocked=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,"weekly-blocked-progress-0001",{record:{id:"p-1",obraId:"o-1",activityId:"a-1",commitmentId:"c-1",data:"2026-07-25",quantity:5}},0));
    expect(blocked.ok).toBe(false);expect(blocked.reason).toMatch(/bloqueado/);
    const released=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_RELEASED,"weekly-blocked-release-0001",{commitmentId:"c-1",reason:"Material entregue"},1));
    expect(released.data.weeklyCommitments[0]).toMatchObject({status:"aberto",blockingReason:"",restrictionResolution:"Material entregue",version:2});
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

  it("bloqueia a medição quando a FVS legada está reprovada",()=>{
    const initial={medicoesObra:[],qualidadeRegistros:[{
      id:"q-1",obraId:"o-1",status:"reprovada",
      itens:[{id:"qi-1",status:"nao_conforme"}],
      naoConformidade:{status:"aberta"},
    }]};
    const result=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,"measurement-quality-legacy-0001",{measurement:{id:"m-1",obraId:"o-1",data:"2026-07-25",itens:[{tarefaId:"t-1",pctConfirmado:10}]}}));
    expect(result.ok).toBe(false);expect(result.reason).toMatch(/não conformidade impeditiva/);
  });

  it("gera fichas de qualidade sem duplicar o plano da obra",()=>{
    const initial={qualidadeRegistros:[]};
    const payload={records:[{id:"q-1",obraId:"o-1",tipo:"fvs",etapaId:"e-1",titulo:"Alvenaria",itens:[]}]};
    const created=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.QUALITY_PLAN_GENERATED,"quality-plan-0001",payload));
    const repeated=applyOperationalCommand(created.data,command(OPERATIONAL_COMMAND.QUALITY_PLAN_GENERATED,"quality-plan-0001",payload));
    expect(created.data.qualidadeRegistros[0]).toMatchObject({id:"q-1",status:"planejada",version:1});
    expect(repeated.idempotent).toBe(true);expect(repeated.data.qualidadeRegistros).toHaveLength(1);
  });

  it("preserva NC, exige eficácia e só libera a ficha após reinspeção",()=>{
    const initial={qualidadeRegistros:[{id:"q-1",obraId:"o-1",version:1,status:"em_inspecao",itens:[{id:"i-1",status:"pendente"}]}]};
    const rejected=applyOperationalCommand(initial,command(OPERATIONAL_COMMAND.QUALITY_ITEM_INSPECTED,"quality-item-0001",{recordId:"q-1",itemId:"i-1",result:"nao_conforme"},1));
    expect(rejected.data.qualidadeRegistros[0]).toMatchObject({status:"reprovada",version:2});
    const blocked=applyOperationalCommand(rejected.data,command(OPERATIONAL_COMMAND.QUALITY_RECORD_RELEASED,"quality-release-0001",{recordId:"q-1"},2));
    expect(blocked.ok).toBe(false);
    const incomplete=applyOperationalCommand(rejected.data,command(OPERATIONAL_COMMAND.QUALITY_NONCONFORMITY_RESOLVED,"quality-nc-0001",{recordId:"q-1",correctiveAction:"Corrigir"},2));
    expect(incomplete.ok).toBe(false);
    const resolved=applyOperationalCommand(rejected.data,command(OPERATIONAL_COMMAND.QUALITY_NONCONFORMITY_RESOLVED,"quality-nc-0002",{recordId:"q-1",correctiveAction:"Corrigir",effectiveness:"Reinspeção aprovada"},2));
    const fichaReinspecionada=resolved.data.qualidadeRegistros[0];
    expect(fichaReinspecionada.itens[0].historicoInspecoes).toMatchObject([
      {resultado:"nao_conforme",tipo:"inspecao"},{resultado:"conforme",tipo:"reinspecao",resultadoAnterior:"nao_conforme"},
    ]);
    expect(fichaReinspecionada.historicoReinspecoes).toMatchObject([{acaoCorretiva:"Corrigir",verificacaoEficacia:"Reinspeção aprovada",itens:[{itemId:"i-1",resultadoAnterior:"nao_conforme"}]}]);
    const released=applyOperationalCommand(resolved.data,command(OPERATIONAL_COMMAND.QUALITY_RECORD_RELEASED,"quality-release-0002",{recordId:"q-1"},3));
    expect(released.data.qualidadeRegistros[0]).toMatchObject({status:"aprovada",version:4});
  });
});
