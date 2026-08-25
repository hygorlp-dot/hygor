import { criarIndicesFinanceiros } from "./selectors";
import { gerarCandidatosConciliacao, faixaDoScore, FAIXA_CONFIANCA } from "./matching";

describe("motor de candidatos - nunca decide sozinho, só pontua", () => {
  const data = {
    notasFiscais: [
      { id: "n1", numero: "100", valorLiquido: 1500, fornecedorNome: "Construtora Silva", documentoFornecedor: "12345678000199", vencimento: "2026-01-15", pagamentos: [] },
    ],
    pedidos: [], medicoes: [], medicoesTerc: [], terceirizados: [], employees: [], caixaObra: [],
    transacoes: [],
  };

  test("valor + CNPJ + data batendo gera uma candidata forte, mas nunca decide automaticamente", () => {
    const indices = criarIndicesFinanceiros(data);
    const transacao = {
      id: "t1", valor: -1500, data: "2026-01-16",
      contraparteNome: "Construtora Silva Ltda", contraparteDocumento: "12.345.678/0001-99",
    };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    expect(candidatas.length).toBeGreaterThan(0);
    const top = candidatas[0];
    expect(top.tipo).toBe("nota");
    expect(top.entidadeId).toBe("n1");
    expect(top.score).toBeGreaterThanOrEqual(60);
    expect(top.podeRegistrarPagamento).toBe(true);
  });

  test("valor muito acima do saldo em aberto gera bloqueio (não deixa vincular)", () => {
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t2", valor: -9000, data: "2026-01-16", contraparteNome: "Construtora Silva" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const nota = candidatas.find(c => c.entidadeId === "n1");
    expect(nota.bloqueios.length).toBeGreaterThan(0);
    expect(nota.podeRegistrarPagamento).toBe(false);
  });

  test("CNPJ divergente gera alerta em vez de reduzir a candidata ao silêncio", () => {
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t3", valor: -1500, data: "2026-01-16", contraparteDocumento: "99999999000199" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const nota = candidatas.find(c => c.entidadeId === "n1");
    expect(nota.alertas.some(a => a.includes("CPF/CNPJ"))).toBe(true);
    expect(nota.bloqueios.some(a => a.includes("CPF/CNPJ"))).toBe(true);
  });

  test("identificador bancário único recebe evidência forte sem dispensar a confirmação", () => {
    const dataComId={...data,notasFiscais:[{...data.notasFiscais[0],fitid:"fit-unico"}]};
    const nota=gerarCandidatosConciliacao({id:"t-id",valor:-1500,data:"2026-01-16",fitid:"fit-unico"},dataComId,criarIndicesFinanceiros(dataComId)).find(item=>item.entidadeId==="n1");
    expect(nota.score).toBeGreaterThanOrEqual(90);
    expect(nota.motivos.some(item=>item.includes("Identificador bancário"))).toBe(true);
  });

  // Achado de 25/08/2026: era o único tipo indexado sem obraId (ver
  // selectors.js), apesar do cadastro de terceirizados já exigir obra -
  // um pagamento direto a terceiro sem medição caía como custo da empresa
  // em vez da obra certa no DRE.
  test("candidata de pagamento direto a terceiro carrega a obra do cadastro do terceirizado", () => {
    const comTerceiro = { ...data, terceirizados: [{ id: "tc1", nome: "João Eletricista", documento: "11122233344", pixKey: "joao@pix.com", obraId: "obra-77" }] };
    const indices = criarIndicesFinanceiros(comTerceiro);
    const transacao = { id: "t-terc", valor: -800, data: "2026-01-16", chavePix: "joao@pix.com" };
    const candidata = gerarCandidatosConciliacao(transacao, comTerceiro, indices).find(c => c.tipo === "terceiro");
    expect(candidata).toBeTruthy();
    expect(candidata.obraId).toBe("obra-77");
  });

  test("período bancário fechado bloqueia a confirmação", () => {
    const fechado={...data,fechamentosBancarios:[{status:"fechado",dataInicio:"2026-01-01",dataFim:"2026-01-31"}]};
    const nota=gerarCandidatosConciliacao({id:"t-fechado",valor:-1500,data:"2026-01-16"},fechado,criarIndicesFinanceiros(fechado)).find(item=>item.entidadeId==="n1");
    expect(nota.bloqueios.some(item=>item.includes("período financeiro fechado"))).toBe(true);
  });

  test("transação já consumida por outro vínculo não é sugerida de novo", () => {
    const dataComVinculo = {
      ...data,
      transacoes: [{ id: "t0", valor: -1500, status: "conciliado", vinculo: { tipo: "nota", id: "n1" } }],
    };
    const indices = criarIndicesFinanceiros(dataComVinculo);
    const transacao = { id: "t4", valor: -1500, data: "2026-01-16", contraparteNome: "Construtora Silva" };
    const candidatas = gerarCandidatosConciliacao(transacao, dataComVinculo, indices);
    expect(candidatas.find(c => c.entidadeId === "n1")).toBeUndefined();
  });
});

describe("motor de candidatos - pagamento já registrado (modo A - vincular)", () => {
  test("um pagamento de nota já criado mas sem transação vira candidata de vínculo, não de novo pagamento", () => {
    const data = {
      notasFiscais: [{
        id: "n1", numero: "100", valorLiquido: 500, fornecedorNome: "Fornecedor X",
        pagamentos: [{ id: "pg1", valor: 500, conciliado: false, transacaoId: "" }],
      }],
      pedidos: [], medicoes: [], medicoesTerc: [], terceirizados: [], employees: [], caixaObra: [],
      transacoes: [],
    };
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t1", valor: -500, data: "2026-01-10", contraparteNome: "Fornecedor X" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const candidata = candidatas.find(c => c.tipo === "pagamentoNota");
    expect(candidata).toBeDefined();
    expect(candidata.pagamentoId).toBe("pg1");
    expect(candidata.podeVincular).toBe(true);
    expect(candidata.podeRegistrarPagamento).toBe(false);
  });
});

describe("entradas - caixa da obra respeita a direção (aporte x despesa)", () => {
  const data = {
    notasFiscais: [], pedidos: [], medicoes: [], medicoesTerc: [], terceirizados: [], employees: [],
    caixaObra: [
      { id: "c1", obraId: "o1", tipo: "aporte", valor: 1000, conciliado: false },
      { id: "c2", obraId: "o1", tipo: "despesa", valor: 1000, conciliado: false },
    ],
    transacoes: [],
  };

  test("uma ENTRADA bancária só sugere o aporte, nunca a despesa do caixa", () => {
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t1", valor: 1000, data: "2026-01-10" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const caixa = candidatas.filter(c => c.tipo === "caixaObra");
    expect(caixa).toHaveLength(1);
    expect(caixa[0].entidadeId).toBe("c1");
    expect(caixa[0].titulo).toMatch(/Aporte/);
  });

  test("uma SAÍDA bancária só sugere a despesa, nunca o aporte do caixa", () => {
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t2", valor: -1000, data: "2026-01-10" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const caixa = candidatas.filter(c => c.tipo === "caixaObra");
    expect(caixa).toHaveLength(1);
    expect(caixa[0].entidadeId).toBe("c2");
    expect(caixa[0].titulo).toMatch(/Despesa/);
  });
});

describe("entradas - parcela do contrato vs. medição técnica", () => {
  test("medição com tipo mensal_fixo/livre rotula como 'Parcela do contrato'", () => {
    const data = {
      notasFiscais: [], pedidos: [], medicoesTerc: [], terceirizados: [], employees: [], caixaObra: [],
      medicoes: [{ id: "m1", obraId: "o1", tipo: "mensal_fixo", competencia: "2026-01", valorPrevisto: 5000, recebimentos: [] }],
      transacoes: [],
    };
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t1", valor: 5000, data: "2026-01-10" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const m = candidatas.find(c => c.tipo === "medicao");
    expect(m.titulo).toMatch(/^Parcela do contrato/);
  });

  test("medição com tipo percentual rotula como 'Medição'", () => {
    const data = {
      notasFiscais: [], pedidos: [], medicoesTerc: [], terceirizados: [], employees: [], caixaObra: [],
      medicoes: [{ id: "m1", obraId: "o1", tipo: "percentual", competencia: "2026-01", valorPrevisto: 5000, recebimentos: [] }],
      transacoes: [],
    };
    const indices = criarIndicesFinanceiros(data);
    const transacao = { id: "t1", valor: 5000, data: "2026-01-10" };
    const candidatas = gerarCandidatosConciliacao(transacao, data, indices);
    const m = candidatas.find(c => c.tipo === "medicao");
    expect(m.titulo).toMatch(/^Medição/);
  });
});

describe("entradas - contrato comercial antes da criação da obra", () => {
  test("oferece a entrada de contrato como candidata e preserva o saldo parcial", () => {
    const data = {
      notasFiscais: [], pedidos: [], medicoes: [], medicoesTerc: [], terceirizados: [], employees: [], caixaObra: [], transacoes: [],
      comercial: { contratos: [{ id: "ct1", numero: "CONT-1", contratante: "Cliente Teste", entrada: 1000, recebimentosEntrada: [{ id: "r1", valor: 400 }] }] },
    };
    const indices = criarIndicesFinanceiros(data);
    const candidatas = gerarCandidatosConciliacao({ id: "t1", valor: 600, data: "2026-01-10", contraparteNome: "Cliente Teste" }, data, indices);
    const contrato = candidatas.find(c => c.tipo === "entradaContrato");
    expect(contrato).toBeDefined();
    expect(contrato.titulo).toMatch(/Entrada do contrato CONT-1/);
    expect(contrato.podeRegistrarPagamento).toBe(true);
  });
});

describe("busca automática de PIX cadastrado (empresa/funcionário/terceiro/fornecedor)", () => {
  const baseData = {
    notasFiscais: [], pedidos: [], medicoes: [], medicoesTerc: [], terceirizados: [], caixaObra: [],
    transacoes: [],
    contasBancarias: [{ id: "cb1", nome: "Conta Principal", pixKey: "empresa@arcd.com.br" }],
    employees: [{ id: "f1", name: "João Silva", pixKey: "12345678900", active: true }],
  };

  test("chave PIX de conta da própria empresa gera candidata de transferência interna com alta prioridade", () => {
    const indices = criarIndicesFinanceiros(baseData);
    const transacao = { id: "t1", valor: 300, data: "2026-01-10", chave: "empresa@arcd.com.br" };
    const candidatas = gerarCandidatosConciliacao(transacao, baseData, indices);
    const pix = candidatas.find(c => c.tipo === "pixRegistrado");
    expect(pix).toBeDefined();
    expect(pix.motivos[0]).toMatch(/própria empresa/);
    expect(pix.podeVincular).toBe(false);
    expect(pix.podeRegistrarPagamento).toBe(false);
  });

  test("chave PIX de funcionário cadastrado aparece como candidata informativa", () => {
    const indices = criarIndicesFinanceiros(baseData);
    const transacao = { id: "t2", valor: 150, data: "2026-01-10", chave: "12345678900" };
    const candidatas = gerarCandidatosConciliacao(transacao, baseData, indices);
    const pix = candidatas.find(c => c.tipo === "pixRegistrado");
    expect(pix).toBeDefined();
    expect(pix.motivos[0]).toMatch(/funcionário/);
    expect(pix.contraparte).toBe("João Silva");
  });

  test("chave PIX desconhecida não gera candidata pixRegistrado", () => {
    const indices = criarIndicesFinanceiros(baseData);
    const transacao = { id: "t3", valor: 150, data: "2026-01-10", chave: "chave-nunca-vista" };
    const candidatas = gerarCandidatosConciliacao(transacao, baseData, indices);
    expect(candidatas.find(c => c.tipo === "pixRegistrado")).toBeUndefined();
  });
});

describe("faixas de confiança", () => {
  test("score alto sem alerta é 'forte'; com alerta cai para confirmação manual", () => {
    expect(faixaDoScore(97, false)).toBe(FAIXA_CONFIANCA.FORTE);
    expect(faixaDoScore(97, true)).toBe(FAIXA_CONFIANCA.CONFIRMAR);
    expect(faixaDoScore(70, false)).toBe(FAIXA_CONFIANCA.LISTA);
    expect(faixaDoScore(40, false)).toBe(FAIXA_CONFIANCA.FRACA);
  });
});
