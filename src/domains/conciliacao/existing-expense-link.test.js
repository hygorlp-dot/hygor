import { describe, expect, test } from "vitest";
import { vincularPagamentoExistente, desfazerConciliacao } from "./mutations.js";
import { buildFinancialLedger, selectDRE, selectCashFlow } from "../financeiro/ledger.js";

const actor = { id:"f1", role:"financeiro" };
const link = (data, tipo) => vincularPagamentoExistente(data, { transacaoId:"bank", tipo, entidadeId:"existing", pagamentoId:"existing", operador:actor });

describe("vínculo de despesa ou recebimento já cadastrado", () => {
  test.each(["outrasDesp", "despesasEmpresa", "payments"])("vincula %s e desfaz sem recriar ou apagar o fato", section => {
    const receipt = section === "payments";
    const record = receipt
      ? { id:"existing", amount:120, date:"2026-10-20", description:"Serviço", categoria:"receita_servicos", competencia:"2026-09", efeitoDRE:"receita" }
      : { id:"existing", valor:120, data:"2026-09-10", dataPagamento:"2026-10-20", competencia:"2026-09", categoria:"outros", pago:true };
    const data = { [section]:[record], transacoes:[{ id:"bank", valor:receipt ? 120 : -120, data:"2026-10-28", status:"pendente", gerados:[] }] };
    const before = buildFinancialLedger(data);
    const result = link(data, section);
    expect(result.resumo.ok).toBe(true);
    expect(result.resumo.criados).toEqual([]);
    expect(result.data[section]).toHaveLength(1);
    expect(result.data[section][0]).toMatchObject({ ...record, conciliado:true, transacaoId:"bank" });
    expect(selectDRE(buildFinancialLedger(result.data)).resultCents).toBe(selectDRE(before).resultCents);
    const reversed = desfazerConciliacao(result.data, "bank", actor, "Banco errado");
    expect(reversed.resumo.ok).toBe(true);
    expect(reversed.data[section][0]).toMatchObject({ ...record, conciliado:false, transacaoId:null });
    expect(selectCashFlow(buildFinancialLedger(reversed.data)).balanceCents).toBe(selectCashFlow(before).balanceCents);
  });

  test("recusa despesa em aberto, cancelada ou liquidada pelo caixa/cliente", () => {
    for (const extra of [{ pago:false }, { pago:true, status:"cancelada" }, { pago:true, caixaObraId:"cash" }, { pago:true, origem:"cliente_direto" }, { pago:true, origemPagamento:"cliente_direto" }, { pago:true, pagador:"caixa_obra" }]) {
      const data = { despesasEmpresa:[{ id:"existing", valor:120, competencia:"2026-09", ...extra }], transacoes:[{ id:"bank", valor:-120, data:"2026-10-28", status:"pendente" }] };
      expect(link(data, "despesasEmpresa").resumo.ok).toBe(false);
    }
  });

  test("pagador obra do terceiro não equivale ao caixa físico", () => {
    const data={pagsTerceiros:[{id:"existing",amount:120,date:"2026-10-20",pagador:"obra",obraId:"work",origem:"manual_sem_medicao"}],transacoes:[{id:"bank",valor:-120,data:"2026-10-28",status:"pendente"}]};
    expect(link(data,"pagsTerceiros").resumo.ok).toBe(true);
  });
});
