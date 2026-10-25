import { describe,expect,it } from "vitest";
import {
  ADVANCE_COMMAND,advanceDeductionForPeriod,applyAdvanceCommand,buildAdvanceInstallments,advanceCommandObraId,
} from "./advance-commands.js";
import { registrarPagamentoEConciliar } from "../conciliacao/mutations.js";
import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { RESCISSION_COMMAND,applyRescissionCommand } from "./rescission-commands.js";

function settle(data) {
  const advance=data.advances[0],id=`bank-${advance.id}`;
  const result=registrarPagamentoEConciliar({...data,transacoes:[...(data.transacoes||[]),{id,valor:-advance.amount,data:advance.date,status:"pendente"}]},
    {transacaoId:id,tipo:"tituloFolha",entidadeId:advance.paymentTitleId,operador:{id:"financeiro",role:"financeiro"}});
  expect(result.resumo.ok).toBe(true);
  return result.data;
}

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
    const paid=settle(result.data);
    expect(advanceDeductionForPeriod(paid.advances[0],"2026-07-21","2026-08-05",paid)).toBe(200);
    expect(advanceDeductionForPeriod(paid.advances[0],"2026-08-06","2026-08-20",paid)).toBe(200);
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
  // O fechamento e os títulos são protegidos sem recriar pagamentos.
  const baseData = {
    employees:[{id:"e1",name:"Campo",obra:"o1",active:true}],
    advances:[],
    fechamentosFinanceiros:[],
  };

  it("o adiantamento criado e pago aparece no desconto calculado da folha do período", () => {
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
    const paid=settle(created.data);
    expect(advanceDeductionForPeriod(paid.advances[0],"2026-06-21","2026-07-05",paid)).toBe(300);
  });

  it("bloqueia cancelar adiantamento em período financeiro fechado, preservando o desconto e a rescisão", () => {
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
      ...settle(created.data),
      fechamentosFinanceiros:[
        {competencia:"2026-07",status:"fechado",dataInicio:"2026-07-01",dataFim:"2026-07-31"},
      ],
    };
    expect(isDateInClosedPeriod(dataComPeriodoFechado,"2026-07-05")).toBe(true);

    const cancelled = applyAdvanceCommand(dataComPeriodoFechado, {
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CANCELLED, actorId:"rh", actorName:"RH",
      payload:{advanceId:"a1",reason:"Lançamento incorreto"},expectedVersion:1,
    },"2026-08-01T12:00:00.000Z");
    expect(cancelled.ok).toBe(false);
    expect(cancelled.reason).toMatch(/período financeiro/i);
    expect(advanceDeductionForPeriod(dataComPeriodoFechado.advances[0],"2026-06-21","2026-07-05",dataComPeriodoFechado)).toBe(300);

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

describe('proteção de adiantamentos já encaminhados e períodos fechados',()=>{
  const now='2026-08-01T12:00:00.000Z';
  const creation=(advance={})=>({type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED,actorId:'rh',expectedVersion:0,payload:{advance:{id:'a',empId:'e',date:'2026-07-29',amount:100,firstDueDate:'2026-08-05',...advance}}});
  const cancellation={type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CANCELLED,actorId:'rh',expectedVersion:1,payload:{advanceId:'a',reason:'Correção identificada'}};
  const base=()=>({employees:[{id:'e',name:'QA',obra:'original',active:true}],advances:[],pagamentosFolha:[{id:'real',valor:100}],transacoes:[{id:'real-bank',valor:-100}]});
  const created=()=>applyAdvanceCommand(base(),creation(),now).data;
  it.each(['date','firstDueDate'])('bloqueia criação retroativa pela data %s e preserva pagamentos',field=>{
    const data=base();data.fechamentosFinanceiros=[{status:'fechado',dataInicio:'2026-07-01',dataFim:'2026-07-31'}];
    const before=structuredClone(data),cmd=creation({date:'2026-08-01',firstDueDate:'2026-08-05',[field]:'2026-07-30'});
    expect(applyAdvanceCommand(data,cmd,now).reason).toMatch(/período financeiro/);expect(data).toEqual(before);
  });
  it('bloqueia parcela posterior fechada mesmo com emissão e primeira parcela abertas',()=>{
    const data=base();data.fechamentosFinanceiros=[{status:'fechado',dataInicio:'2026-08-06',dataFim:'2026-08-31'}];
    expect(applyAdvanceCommand(data,creation({installmentCount:2}),now).ok).toBe(false);
  });
  it.each(['daily','clt',undefined])('impede cancelar claim de título %s, inclusive ID normalizado e quitação parcial',kind=>{
    const data=created();data.advances[0].id=123;data.titulosFolha=[{id:'title',employeeId:'e',liquido:900,valorPago:300,liquidacoes:[{id:'real-settlement',valor:300}],snapshotCalculo:{kind,advanceRefs:[{id:'123',date:'2026-08-05',amount:100}]}}];
    const before=structuredClone(data);const result=applyAdvanceCommand(data,{...cancellation,payload:{...cancellation.payload,advanceId:'123'}},now);
    expect(result.ok).toBe(false);expect(result.reason).toContain('título de folha');expect(data).toEqual(before);
  });
  it('protege título legado agregado sem referência nem período, mas ignora obrigação estornada',()=>{
    const data=created();data.titulosFolha=[{id:'legacy',employeeId:'e',adiantamentos:100,liquido:900}];
    expect(applyAdvanceCommand(data,cancellation,now).reason).toContain('legada');
    data.titulosFolha[0].status='estornado';expect(applyAdvanceCommand(data,cancellation,now).ok).toBe(true);
  });
  it('protege folha arquivada mesmo sem fechamento financeiro e sem título',()=>{
    const data=created();data.quinzenasArquivadas={'2026-08-Q1':{fim:'2026-08-20'}};
    expect(applyAdvanceCommand(data,cancellation,now).reason).toContain('arquivada');
    expect(applyAdvanceCommand(data,creation({id:'retroactive',date:'2026-08-01',firstDueDate:'2026-08-20'}),now).ok).toBe(false);
  });
  it('não permite reprogramar vencimento fechado via cancelamento e reuso do ID',()=>{
    const data=created();data.fechamentosFinanceiros=[{status:'fechado',dataInicio:'2026-08-01',dataFim:'2026-08-31'}];
    expect(applyAdvanceCommand(data,cancellation,now).ok).toBe(false);
    expect(applyAdvanceCommand(data,creation({date:'2026-09-01',firstDueDate:'2026-09-05',installments:[{dueDate:'2026-09-05',amount:100}]}),now).reason).toContain('já existe');
    expect(data.advances[0].installments[0].dueDate).toBe('2026-08-05');expect(data.pagamentosFolha[0]).toEqual({id:'real',valor:100});
  });
  it('fixa obra de origem e transferência de lotação não libera cancelamento fechado',()=>{
    const data=base(),result=applyAdvanceCommand(data,creation({obraId:'injected'}),now);expect(result.data.advances[0].obraId).toBe('original');
    result.data.employees[0].obra='new-project';result.data.fechamentosFinanceiros=[{status:'fechado',dataInicio:'2026-08-01',dataFim:'2026-08-31'}];
    expect(advanceCommandObraId(result.data,cancellation)).toBe('original');expect(applyAdvanceCommand(result.data,cancellation,now).ok).toBe(false);
  });
  it('rejeita valores não finitos antes de gerar parcelas',()=>{
    expect(buildAdvanceInstallments({advanceId:'a',amount:Infinity,firstDueDate:'2026-08-05'})).toEqual([]);
    expect(applyAdvanceCommand(base(),creation({amount:Infinity}),now).ok).toBe(false);
  });
});
