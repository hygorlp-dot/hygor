import { describe,expect,it } from "vitest";
import {
  ADVANCE_COMMAND,advanceDeductionForPeriod,applyAdvanceCommand,buildAdvanceInstallments,
} from "./advance-commands.js";
import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { RESCISSION_COMMAND,applyRescissionCommand } from "./rescission-commands.js";

describe("adiantamentos parcelados",()=>{
  it("divide os centavos sem perder o total e alterna as quinzenas",()=>{
    const rows=buildAdvanceInstallments({
      advanceId:"a1",amount:1000,installmentCount:3,
      firstDueDate:"2026-08-05",frequency:"quinzenal",
    });
    expect(rows).toEqual([
      {id:"a1:parcela:1",number:1,dueDate:"2026-08-05",amount:333.33,status:"programada"},
      {id:"a1:parcela:2",number:2,dueDate:"2026-08-20",amount:333.33,status:"programada"},
      {id:"a1:parcela:3",number:3,dueDate:"2026-09-05",amount:333.34,status:"programada"},
    ]);
    expect(rows.reduce((sum,item)=>sum+item.amount,0)).toBe(1000);
  });

  it("aceita funcionário administrativo sem obra e desconta só a parcela do período",()=>{
    const command={
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED,
      idempotencyKey:"advance-admin-0001",expectedVersion:0,
      actorId:"rh-1",actorName:"RH",
      payload:{advance:{
        id:"a1",empId:"e1",date:"2026-07-29",amount:600,
        installmentCount:3,firstDueDate:"2026-08-05",frequency:"quinzenal",
      }},
    };
    const result=applyAdvanceCommand({
      employees:[{id:"e1",name:"Administrativo",workArea:"administrativo",obra:"",active:true}],
      advances:[],
    },command,"2026-07-29T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.advances[0]).toMatchObject({
      empId:"e1",amount:600,installmentCount:3,status:"ativo",
    });
    expect(advanceDeductionForPeriod(result.data.advances[0],"2026-07-21","2026-08-05")).toBe(200);
    expect(advanceDeductionForPeriod(result.data.advances[0],"2026-08-06","2026-08-20")).toBe(200);
  });

  it("cancelamento preserva o registro e zera descontos futuros",()=>{
    const created=applyAdvanceCommand({
      employees:[{id:"e1",name:"Campo",obra:"o1",active:true}],advances:[],
    },{
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED,actorId:"rh",actorName:"RH",
      payload:{advance:{id:"a1",empId:"e1",date:"2026-07-29",amount:100,
        installmentCount:1,firstDueDate:"2026-08-05"}},expectedVersion:0,
    },"2026-07-29T12:00:00.000Z");
    const cancelled=applyAdvanceCommand(created.data,{
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CANCELLED,actorId:"rh",actorName:"RH",
      payload:{advanceId:"a1",reason:"Lançamento incorreto"},expectedVersion:1,
    },"2026-07-29T13:00:00.000Z");
    expect(cancelled.data.advances).toMatchObject([{
      id:"a1",status:"cancelado",motivoCancelamento:"Lançamento incorreto",
    }]);
    expect(advanceDeductionForPeriod(cancelled.data.advances[0],"2026-07-21","2026-08-05")).toBe(0);
  });
});

describe("ciclo completo do adiantamento: criação -> desconto na folha -> cancelamento",()=>{
  // Não existe hoje, em nenhum domínio, um passo que grave o adiantamento em
  // `transacoes`/caixa nem em `titulosFolha`: o desconto que a folha (FolhaView)
  // mostra é sempre recalculado na hora, a partir de `data.advances`, via
  // advanceDeductionForPeriod (ver src/domains/ponto/components/FolhaView.jsx:180-182).
  // Este teste cobre por isso o ciclo real que existe - criar, aparecer no
  // cálculo da folha de um período já fechado, e cancelar depois disso -
  // em vez de inventar uma integração com caixa/titulosFolha que o código
  // não tem.
  const baseData = {
    employees:[{id:"e1",name:"Campo",obra:"o1",active:true}],
    advances:[],
    fechamentosFinanceiros:[],
  };

  it("o adiantamento criado aparece no desconto calculado da folha do período", () => {
    const created = applyAdvanceCommand(baseData, {
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED, actorId:"rh", actorName:"RH",
      payload:{advance:{
        id:"a1",empId:"e1",date:"2026-06-29",amount:300,
        installmentCount:1,firstDueDate:"2026-07-05",
      }},expectedVersion:0,
    },"2026-06-29T12:00:00.000Z");
    expect(created.ok).toBe(true);
    // Esta é exatamente a chamada que FolhaView faz para montar a coluna
    // "Adiantamentos" da folha da quinzena que contém 2026-07-05.
    expect(advanceDeductionForPeriod(created.data.advances[0],"2026-06-21","2026-07-05")).toBe(300);
  });

  it("achado: cancelar um adiantamento cujo desconto já caiu num período financeiro FECHADO é aceito sem trava - ao contrário da rescisão, que bloqueia no mesmo cenário", () => {
    const created = applyAdvanceCommand(baseData, {
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED, actorId:"rh", actorName:"RH",
      payload:{advance:{
        id:"a1",empId:"e1",date:"2026-06-29",amount:300,
        installmentCount:1,firstDueDate:"2026-07-05",
      }},expectedVersion:0,
    },"2026-06-29T12:00:00.000Z");
    // A folha da quinzena de 2026-07-05 já rodou e o mês foi fechado no
    // financeiro (mesma estrutura que rescission-commands.js usa para
    // bloquear rescisões em período fechado - ver isDateInClosedPeriod).
    const dataComPeriodoFechado = {
      ...created.data,
      fechamentosFinanceiros:[
        {competencia:"2026-07",status:"fechado",dataInicio:"2026-07-01",dataFim:"2026-07-31"},
      ],
    };
    expect(isDateInClosedPeriod(dataComPeriodoFechado,"2026-07-05")).toBe(true);

    // Comportamento real de hoje: applyAdvanceCommand NÃO consulta
    // fechamentosFinanceiros em nenhum momento (nem para criar, nem para
    // cancelar) - o cancelamento é aceito mesmo com o desconto já
    // computado dentro do período fechado.
    const cancelled = applyAdvanceCommand(dataComPeriodoFechado, {
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CANCELLED, actorId:"rh", actorName:"RH",
      payload:{advanceId:"a1",reason:"Lançamento incorreto"},expectedVersion:1,
    },"2026-08-01T12:00:00.000Z");
    expect(cancelled.ok).toBe(true);

    // E, como a dedução nunca foi congelada em titulosFolha, o mesmo período
    // fechado agora recalcularia desconto ZERO se a folha fosse reaberta -
    // o histórico do que foi efetivamente descontado do funcionário muda
    // silenciosamente depois do cancelamento.
    expect(advanceDeductionForPeriod(cancelled.data.advances[0],"2026-06-21","2026-07-05")).toBe(0);

    // Contraste: a mesma tentativa de cancelar uma RESCISÃO cujo desligamento
    // caiu num período fechado É bloqueada pelo código existente.
    const rescissionData = {
      ...dataComPeriodoFechado,
      rescisoes:[{
        id:"r1",empId:"e1",empName:"Campo",obraId:"o1",demissao:"2026-07-10",
        status:"ativa",version:1,
      }],
    };
    const rescissionCancel = applyRescissionCommand(rescissionData, {
      type:RESCISSION_COMMAND.PAYROLL_RESCISSION_CANCELLED, actorId:"rh", actorName:"RH",
      payload:{rescissionId:"r1",reason:"Lançamento incorreto"},expectedVersion:1,
    },"2026-08-01T12:00:00.000Z");
    expect(rescissionCancel.ok).toBe(false);
    expect(rescissionCancel.reason).toMatch(/período financeiro/i);
  });
});
