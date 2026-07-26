import { describe, expect, it } from "vitest";
import { cancelDreExpense } from "./mutations";

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
});
