import {
  paraCentavos, deCentavos, igualCentavos,
  chaveTransacao, parseOFX, somaRateios, diasEntre,
  aplicarRecebimentoMedicao, removerRecebimentoMedicao, totalRecebidoMedicao, statusRecebimentoMedicao,
} from "./calculations";

describe("domínio de conciliação - centavos", () => {
  test("converte e compara valores evitando erro de ponto flutuante", () => {
    expect(paraCentavos(1234.56)).toBe(123456);
    expect(deCentavos(123456)).toBe(1234.56);
    expect(igualCentavos(0.1 + 0.2, 0.3)).toBe(true);
    expect(igualCentavos(10, 10.02, 1)).toBe(false);
  });
});

describe("domínio de conciliação - importação", () => {
  test("chaveTransacao usa FITID quando existe, senão um hash da linha", () => {
    expect(chaveTransacao({ fitid: "ABC123", data: "2026-01-01", valor: 10, descricao: "x" })).toBe("fit:ABC123");
    expect(chaveTransacao({ data: "2026-01-01", valor: 10, descricao: "PIX Fulano" }))
      .toBe("h:2026-01-01|10.00|pix fulano");
  });

  test("parseOFX extrai transações com FITID do bloco STMTTRN", () => {
    const ofx = `
      <ORG>Banco Teste</ORG>
      <ACCTID>12345</ACCTID>
      <STMTTRN>
        <DTPOSTED>20260110120000</DTPOSTED>
        <TRNAMT>-150.00</TRNAMT>
        <FITID>FIT001</FITID>
        <MEMO>Pagamento fornecedor</MEMO>
      </STMTTRN>
    `;
    const { banco, conta, trans } = parseOFX(ofx);
    expect(banco).toBe("Banco Teste");
    expect(conta).toBe("12345");
    expect(trans).toHaveLength(1);
    expect(trans[0]).toMatchObject({ data: "2026-01-10", valor: -150, fitid: "FIT001", descricao: "Pagamento fornecedor" });
  });

  test("somaRateios fecha com a soma simples dos valores", () => {
    expect(somaRateios([{ valor: 30 }, { valor: 70 }])).toBe(100);
  });

  test("diasEntre calcula distância absoluta em dias", () => {
    expect(diasEntre("2026-01-01", "2026-01-05")).toBe(4);
    expect(diasEntre("2026-01-05", "2026-01-01")).toBe(4);
    expect(diasEntre("", "2026-01-01")).toBe(999);
  });
});

describe("domínio de conciliação - recebimento parcial de medição (correção do bug legado)", () => {
  const medicaoBase = { id: "m1", valorPrevisto: 1000, recebimentos: [] };

  test("um recebimento parcial não marca a medição como recebida", () => {
    const atualizada = aplicarRecebimentoMedicao(medicaoBase, { valor: 400, data: "2026-01-10", origem: "banco" });
    expect(atualizada.recebido).toBe(false);
    expect(atualizada.valorRecebido).toBe(400);
    expect(statusRecebimentoMedicao(atualizada)).toBe("parcial");
  });

  test("dois recebimentos parciais que somam o previsto fecham como recebida", () => {
    let m = aplicarRecebimentoMedicao(medicaoBase, { valor: 400, data: "2026-01-10", origem: "banco" });
    m = aplicarRecebimentoMedicao(m, { valor: 600, data: "2026-02-10", origem: "banco" });
    expect(m.recebido).toBe(true);
    expect(m.valorRecebido).toBe(1000);
    expect(totalRecebidoMedicao(m)).toBe(1000);
    expect(statusRecebimentoMedicao(m)).toBe("recebida");
  });

  test("um recebimento com valor igual ao previsto fecha em uma única vez (compatibilidade com o fluxo antigo)", () => {
    const m = aplicarRecebimentoMedicao(medicaoBase, { valor: 1000, data: "2026-01-10", origem: "manual" });
    expect(m.recebido).toBe(true);
  });

  test("removerRecebimentoMedicao reverte só o recebimento indicado, preservando os demais", () => {
    let m = aplicarRecebimentoMedicao(medicaoBase, { id: "r1", valor: 400, data: "2026-01-10" });
    m = aplicarRecebimentoMedicao(m, { id: "r2", valor: 600, data: "2026-02-10" });
    expect(m.recebido).toBe(true);
    const revertida = removerRecebimentoMedicao(m, "r2");
    expect(revertida.recebido).toBe(false);
    expect(revertida.valorRecebido).toBe(400);
    expect(revertida.recebimentos).toHaveLength(2);
    expect(revertida.recebimentos[0].id).toBe("r1");
    expect(revertida.recebimentos[1].status).toBe("estornado");
  });

  test("medição sem valorPrevisto (0) some como recebida assim que entra qualquer valor", () => {
    const m = aplicarRecebimentoMedicao({ id: "m2", valorPrevisto: 0, recebimentos: [] }, { valor: 50, data: "2026-01-01" });
    expect(m.recebido).toBe(true);
  });
});
