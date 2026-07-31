import { describe, expect, it } from "vitest";
import {
  applyExpenseCommand,
  EXPENSE_COMMAND,
  expenseCommandObraId,
} from "./expense-commands.js";

const now="2026-07-28T12:00:00.000Z";
const actor={actorId:"u-1",actorName:"Financeiro"};
const command=(type,payload,expectedVersion)=>({
  type,payload,expectedVersion,...actor,now,
});
const base=()=>({obras:[{id:"obra-1"}],outrasDesp:[],despesasEmpresa:[]});

describe("comandos de despesas",()=>{
  it("cria e cancela despesa da obra com autoria, versão e escopo",()=>{
    const created=applyExpenseCommand(base(),command(
      EXPENSE_COMMAND.PROJECT_EXPENSE_CREATED,
      {expense:{id:"d-1",obraId:"obra-1",competencia:"2026-07",descricao:"Material",categoria:"material",valor:100}},
      0,
    ),now);
    expect(created.data.outrasDesp[0]).toMatchObject({
      id:"d-1",status:"ativo",version:1,createdById:"u-1",
    });
    expect(expenseCommandObraId(created.data,command(
      EXPENSE_COMMAND.PROJECT_EXPENSE_CANCELLED,{expenseId:"d-1"},1,
    ))).toBe("obra-1");
    const cancelled=applyExpenseCommand(created.data,command(
      EXPENSE_COMMAND.PROJECT_EXPENSE_CANCELLED,
      {expenseId:"d-1",reason:"Duplicidade"},1,
    ),now);
    expect(cancelled.data.outrasDesp[0]).toMatchObject({
      status:"cancelado",version:2,motivoCancelamento:"Duplicidade",
    });
  });

  it("recusa obra inexistente, versão obsoleta e despesa conciliada",()=>{
    const missing=applyExpenseCommand(base(),command(
      EXPENSE_COMMAND.PROJECT_EXPENSE_CREATED,
      {expense:{id:"d-1",obraId:"obra-x",competencia:"2026-07",descricao:"Material",valor:100}},
      0,
    ),now);
    expect(missing.reason).toMatch(/obra.*não existe/i);
    const initial={...base(),outrasDesp:[{
      id:"d-1",obraId:"obra-1",competencia:"2026-07",descricao:"Material",
      valor:100,status:"ativo",version:2,transacaoId:"tx-1",
    }]};
    expect(applyExpenseCommand(initial,command(
      EXPENSE_COMMAND.PROJECT_EXPENSE_CANCELLED,{expenseId:"d-1",reason:"Erro"},1,
    ),now).reason).toMatch(/alterada por outra pessoa/);
    expect(applyExpenseCommand(initial,command(
      EXPENSE_COMMAND.PROJECT_EXPENSE_CANCELLED,{expenseId:"d-1",reason:"Erro"},2,
    ),now).reason).toMatch(/Desfaça a conciliação/);
  });

  it("cria, edita e cancela despesa corporativa com concorrência otimista",()=>{
    const created=applyExpenseCommand(base(),command(
      EXPENSE_COMMAND.COMPANY_EXPENSE_SAVED,
      {expense:{
        id:"c-1",competencia:"2026-07",descricao:"Software",categoria:"software",
        valor:90,recorrente:true,fornecedor:"Fornecedor SA",centroCusto:"escritorio",
        vencimento:"2026-07-20",formaPagamento:"cartao_credito",cartao:"Visa final 1234",
        parcelas:2,pago:true,dataPagamento:"2026-07-18",
      }},
      0,
    ),now);
    expect(created.data.despesasEmpresa[0]).toMatchObject({
      version:1,valor:90,fornecedor:"Fornecedor SA",centroCusto:"escritorio",
      formaPagamento:"cartao_credito",cartao:"Visa final 1234",parcelas:2,
      pago:true,dataPagamento:"2026-07-18",
    });
    const edited=applyExpenseCommand(created.data,command(
      EXPENSE_COMMAND.COMPANY_EXPENSE_SAVED,
      {expense:{id:"c-1",competencia:"2026-07",descricao:"Software",categoria:"software",valor:120,recorrente:true}},
      1,
    ),now);
    expect(edited.data.despesasEmpresa[0]).toMatchObject({version:2,valor:120});
    expect(applyExpenseCommand(edited.data,command(
      EXPENSE_COMMAND.COMPANY_EXPENSE_CANCELLED,{expenseId:"c-1",reason:"Encerrado"},1,
    ),now).reason).toMatch(/alterada por outra pessoa/);
    const cancelled=applyExpenseCommand(edited.data,command(
      EXPENSE_COMMAND.COMPANY_EXPENSE_CANCELLED,{expenseId:"c-1",reason:"Encerrado"},2,
    ),now);
    expect(cancelled.data.despesasEmpresa[0]).toMatchObject({status:"cancelada",version:3});
  });

  it("exige data ao marcar paga e preserva conta em aberto sem baixa de caixa",()=>{
    const invalid=applyExpenseCommand(base(),command(
      EXPENSE_COMMAND.COMPANY_EXPENSE_SAVED,
      {expense:{id:"c-1",competencia:"2026-07",descricao:"Internet",categoria:"internet",valor:150,pago:true}},
      0,
    ),now);
    expect(invalid.reason).toMatch(/data.*paga/i);

    const open=applyExpenseCommand(base(),command(
      EXPENSE_COMMAND.COMPANY_EXPENSE_SAVED,
      {expense:{id:"c-2",competencia:"2026-07",descricao:"Internet",categoria:"internet",valor:150,pago:false,vencimento:"2026-07-30"}},
      0,
    ),now);
    expect(open.ok).toBe(true);
    expect(open.data.despesasEmpresa[0]).toMatchObject({
      categoria:"internet",pago:false,vencimento:"2026-07-30",
    });
  });

  it("replica recorrentes sem persistir metadado transitório e sem duplicar",()=>{
    const initial={...base(),despesasEmpresa:[{
      id:"c-1",competencia:"2026-06",descricao:"Software",categoria:"software",
      valor:90,recorrente:true,status:"ativo",version:1,pago:true,
      dataPagamento:"2026-06-10",transacaoId:"tx-1",conciliado:true,
    }]};
    const copied=applyExpenseCommand(initial,command(
      EXPENSE_COMMAND.COMPANY_RECURRING_EXPENSES_REPLICATED,
      {fromCompetence:"2026-06",toCompetence:"2026-07",ids:["c-2"]},
    ),now);
    expect(copied.copied).toBe(1);
    expect(copied.data.copied).toBeUndefined();
    expect(copied.data.despesasEmpresa[1]).toMatchObject({
      id:"c-2",competencia:"2026-07",version:1,origem:"recorrencia_dre_empresa",
      pago:false,dataPagamento:"",transacaoId:"",conciliado:false,
    });
    expect(applyExpenseCommand(initial,command(
      EXPENSE_COMMAND.COMPANY_RECURRING_EXPENSES_REPLICATED,
      {fromCompetence:"2026-06",toCompetence:"2026-07",ids:["c-1"]},
    ),now).reason).toMatch(/já está em uso/);
  });
});
