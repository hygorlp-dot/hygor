import {
  paraCentavos, deCentavos, igualCentavos,
  chaveTransacao, parseOFX, somaRateios, diasEntre,
  calcConciliacao, extrairContraparteDescricaoPix,
  aplicarRecebimentoMedicao, estornarRecebimentosMedicao, removerRecebimentoMedicao, totalRecebidoMedicao, statusRecebimentoMedicao,
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

  // Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): até
  // esta mudança havia DUAS implementações de parseOFX - esta (nunca
  // usada de verdade) e uma cópia mais rica em LegacyApp.jsx (a que o app
  // de fato usava ao importar). Consolidadas aqui - esta é agora a única.
  test("parseOFX extrai identificadores e contraparte quando o extrato traz as tags estruturadas", () => {
    const ofx = `
      <STMTTRN>
        <DTPOSTED>20260110120000</DTPOSTED>
        <TRNAMT>-150.00</TRNAMT>
        <FITID>FIT001</FITID>
        <TRNTYPE>PAYMENT</TRNTYPE>
        <NAME>Fornecedor Estruturado LTDA</NAME>
        <CNPJ>12345678000199</CNPJ>
        <PIXKEY>fornecedor@pix.com</PIXKEY>
        <ENDTOENDID>E12345678202601101200abc</ENDTOENDID>
        <MEMO>Pix enviado: "irrelevante quando NAME já existe"</MEMO>
      </STMTTRN>
    `;
    const { trans } = parseOFX(ofx);
    expect(trans[0]).toMatchObject({
      tipoOperacao: "PAYMENT", contraparteNome: "Fornecedor Estruturado LTDA",
      contraparteDocumento: "12345678000199", chavePix: "fornecedor@pix.com",
      endToEndId: "E12345678202601101200abc",
    });
  });

  test("parseOFX cai para extrair o nome da descrição do PIX quando não há tag NAME (Banco Inter)", () => {
    const ofx = `
      <STMTTRN>
        <DTPOSTED>20260110120000</DTPOSTED>
        <TRNAMT>-90.00</TRNAMT>
        <FITID>FIT002</FITID>
        <MEMO>Pix enviado: "Cp :18236120-JOAO DA SILVA"</MEMO>
      </STMTTRN>
    `;
    const { trans } = parseOFX(ofx);
    expect(trans[0]).toMatchObject({ contraparteNome: "JOAO DA SILVA", contraparteDocumento: "", chavePix: "" });
  });

  test("extrairContraparteDescricaoPix reconhece os dois formatos confirmados do Banco Inter", () => {
    expect(extrairContraparteDescricaoPix('Pix enviado: "Cp :18236120-JOAO DA SILVA"')).toBe("JOAO DA SILVA");
    expect(extrairContraparteDescricaoPix('Pix recebido: "Cp :10573521-ACM EMPREENDIMENTOS"')).toBe("ACM EMPREENDIMENTOS");
    expect(extrairContraparteDescricaoPix('Pix enviado: "00019 247280631 JOAO SOUSA"')).toBe("JOAO SOUSA");
  });

  test("extrairContraparteDescricaoPix nunca inventa um nome a partir de texto sem esse formato", () => {
    expect(extrairContraparteDescricaoPix("")).toBe("");
    expect(extrairContraparteDescricaoPix("Tarifa de manutenção de conta")).toBe("");
    expect(extrairContraparteDescricaoPix('Pix enviado: "Cp :18236120-"')).toBe("");
    expect(extrairContraparteDescricaoPix('Pix enviado: "Cp :18236120-JOAO"')).toBe(""); // só uma palavra
    expect(extrairContraparteDescricaoPix('Pix enviado: "12345678901"')).toBe(""); // só dígitos
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

describe("domínio de conciliação - posição da fila", () => {
  test("ignora transações de extratos arquivados e resume apenas a fila ativa", () => {
    const result = calcConciliacao({
      extratos:[
        { id:"ativo", status:"importado" },
        { id:"antigo", status:"arquivado" },
      ],
      transacoes:[
        { id:"t1", extratoId:"ativo", status:"pendente", valor:-100 },
        { id:"t2", extratoId:"ativo", status:"conciliado", valor:250 },
        { id:"t3", extratoId:"ativo", status:"ignorado", valor:-25 },
        { id:"t4", extratoId:"antigo", status:"pendente", valor:-999 },
      ],
    });
    expect(result).toEqual({
      total:3,
      pendentes:1,
      conciliadas:1,
      ignoradas:1,
      valorPendente:100,
      entradas:250,
      saidas:0,
      pct:expect.closeTo(66.666666, 5),
    });
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

  test("ignora variações de estorno ao somar e permite novo recebimento", () => {
    const medicao={...medicaoBase,recebimentos:[
      {id:"r0",valor:400,data:"2026-01-09",status:"ESTORNADA"},
      {id:"r1",valor:200,data:"2026-01-10"},
    ]};
    expect(totalRecebidoMedicao(medicao)).toBe(200);
    const atualizada=aplicarRecebimentoMedicao(medicao,{id:"r2",valor:300,data:"2026-01-11"});
    expect(atualizada.valorRecebido).toBe(500);
    expect(atualizada.recebido).toBe(false);
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

  test("estorna todos os recebimentos manuais com motivo e autoria sem apagar a evidência", () => {
    let m=aplicarRecebimentoMedicao(medicaoBase,{id:"r1",valor:1000,data:"2026-01-10",origem:"manual"});
    m=estornarRecebimentosMedicao(m,{actor:{id:"u1",nome:"Financeiro"},reason:"Duplicidade",now:"2026-01-11T10:00:00.000Z"});
    expect(m).toMatchObject({recebido:false,valorRecebido:0,dataPagamento:""});
    expect(m.recebimentos[0]).toMatchObject({id:"r1",status:"estornado",motivoEstorno:"Duplicidade",estornadoPorId:"u1"});
  });

  test("não estorna pelo atalho um recebimento vinculado ao extrato", () => {
    const m=aplicarRecebimentoMedicao(medicaoBase,{id:"r1",valor:1000,data:"2026-01-10",transacaoId:"tx-1"});
    expect(()=>estornarRecebimentosMedicao(m,{actor:{id:"u1"},reason:"x"})).toThrow("Desfaça a conciliação bancária");
  });

  test("preserva o valor espelho legado como evidência estornada", () => {
    const m=estornarRecebimentosMedicao({id:"m-legado",valorPrevisto:1000,valorRecebido:300,dataPagamento:"2026-01-10"},{actor:{id:"u1"},reason:"Ajuste",now:"2026-01-11T10:00:00.000Z"});
    expect(m.recebimentos[0]).toMatchObject({valor:300,legacy:true,status:"estornado",motivoEstorno:"Ajuste"});
  });

  test("medição sem valorPrevisto (0) some como recebida assim que entra qualquer valor", () => {
    const m = aplicarRecebimentoMedicao({ id: "m2", valorPrevisto: 0, recebimentos: [] }, { valor: 50, data: "2026-01-01" });
    expect(m.recebido).toBe(true);
  });
});
