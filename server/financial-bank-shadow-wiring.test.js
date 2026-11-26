import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — evidência bancária no relatório de sombra",()=>{
  const report=readFileSync("server/financial-shadow-report.js","utf8");

  it("lê os campos necessários para comparar o extrato legado",()=>{
    expect(report).toContain('listarTabelaFinanceira("bank_transactions","id,booking_date,direction,amount,raw_description,status,metadata")');
  });

  it("compara o snapshot bancário com o canônico e entrega a evidência ao gate",()=>{
    expect(report).toContain("compareLegacyBankTransactions(snapshot.bankTransactions,banks)");
    expect(report).toContain("bankComparisonVerified:true");
    expect(report).toContain("bankDivergences");
    expect(report).toContain("divergenciasBancoLegado:bankDivergences.length");
    expect(report).toContain("bancoLegadoVerificado:true");
  });
});
