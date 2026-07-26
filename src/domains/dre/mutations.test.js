import { describe, expect, it } from "vitest";
import { buildFinancialLedger, selectDRE } from "../financeiro/ledger";
import { cancelDreExpense, createDreExpense } from "./mutations";

describe("cancelamento auditável de despesa no DRE", () => {
  const data={ outrasDesp:[{ id:"desp-1", obraId:"obra-1", valor:1250, descricao:"Argamassa", status:"ativo" }] };
  const actor={ id:"u-1", nome:"Controladora" };

  it("preserva o fato financeiro e registra motivo, autor e instante", () => {
    const result=cancelDreExpense({ data, expenseId:"desp-1", reason:"Lançamento duplicado", actor, now:"2026-07-25T12:00:00.000Z" });
    expect(result.outrasDesp).toHaveLength(1);
    expect(result.outrasDesp[0]).toMatchObject({ id:"desp-1", valor:1250, status:"cancelado", motivoCancelamento:"Lançamento duplicado", canceladoPorId:"u-1", canceladoPor:"Controladora", canceladoEm:"2026-07-25T12:00:00.000Z" });
  });

  it("recusa cancelamento sem sessão, motivo ou duplicado", () => {
    expect(() => cancelDreExpense({ data, expenseId:"desp-1", reason:"x", actor:null })).toThrow("Sessão do usuário indisponível");
    expect(() => cancelDreExpense({ data, expenseId:"desp-1", reason:"", actor })).toThrow("Informe o motivo");
    expect(() => cancelDreExpense({ data:{ outrasDesp:[{ ...data.outrasDesp[0], status:"cancelado" }] }, expenseId:"desp-1", reason:"x", actor })).toThrow("já está cancelada");
  });

  it("cria despesa auditável e a reconhece uma única vez no DRE da competência", () => {
    const result=createDreExpense({ data:{ outrasDesp:[] }, expense:{ obraId:"obra-1", competencia:"2026-07", categoria:"material", descricao:"Argamassa", valor:"1250.50" }, actor, id:"desp-2", now:"2026-07-03T10:00:00.000Z" });
    expect(result.outrasDesp[0]).toMatchObject({ id:"desp-2", status:"ativo", origem:"dre_obra", createdById:"u-1", valor:1250.5 });
    const dre=selectDRE(buildFinancialLedger(result),{ obraId:"obra-1", competence:"2026-07" });
    expect(dre.costs).toBe(1250.5);
    expect(dre.events.filter(event=>event.sourceId==="desp-2" && event.effect==="cost")).toHaveLength(1);
  });

  it("recusa inclusão sem autor, competência, descrição ou valor válido", () => {
    const input={ data:{}, expense:{ obraId:"obra-1", competencia:"2026-07", descricao:"Cimento", valor:1 }, actor, id:"x" };
    expect(() => createDreExpense({ ...input, actor:null })).toThrow("Sessão do usuário indisponível");
    expect(() => createDreExpense({ ...input, expense:{ ...input.expense, competencia:"julho" } })).toThrow("competência válida");
    expect(() => createDreExpense({ ...input, expense:{ ...input.expense, descricao:"" } })).toThrow("descrição");
    expect(() => createDreExpense({ ...input, expense:{ ...input.expense, valor:0 } })).toThrow("valor positivo");
  });
});
