import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — evidência bancária no relatório de sombra",()=>{
  const api=readFileSync("api/data.js","utf8");

  it("lê os campos necessários para comparar o extrato legado",()=>{
    expect(api).toContain('listarTabelaFinanceira("bank_transactions","id,booking_date,direction,amount,raw_description,status,metadata")');
  });

  it("compara o snapshot bancário com o canônico e entrega a evidência ao gate",()=>{
    const start=api.indexOf("const relatorioSombraFinanceira");
    const end=api.indexOf("// O ponto arquivado",start);
    const block=api.slice(start,end);
    expect(block).toContain("compareLegacyBankTransactions(snapshot.bankTransactions,banks)");
    expect(block).toContain("bankComparisonVerified:true");
    expect(block).toContain("bankDivergences");
    expect(block).toContain("divergenciasBancoLegado:bankDivergences.length");
    expect(block).toContain("bancoLegadoVerificado:true");
  });
});
