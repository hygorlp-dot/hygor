import { describe, expect, it } from "vitest";
import { criarIndicesFinanceiros } from "./selectors.js";
import { gerarCandidatosConciliacao } from "./matching.js";
import { analisarMovimentoConciliacao, comandoConciliacaoAutomatica } from "./engine.js";
import { applyReconciliationCommand } from "../../../server/reconciliation-command.js";
import { buildFinancialLedger, selectDRE } from "../financeiro/ledger.js";

const bank = (patch = {}) => ({ id: "bank-1", status: "pendente", valor: -600, data: "2026-10-20", descricao: "PIX CASA DO CIMENTO", ...patch });
const supplier = { id: "supplier-1", nome: "Casa do Cimento", cnpj: "12345678000199", chavePix: "cimento@example.test" };
const note = (patch = {}) => ({ id: "note-1", numero: "NF-100", fornecedorId: supplier.id, fornecedorNome: supplier.nome, documentoFornecedor: supplier.cnpj, obraId: "work-1", valorBruto: 1000, valorLiquido: 1000, vencimento: "2026-10-20", status: "aprovada", pagamentos: [], ...patch });
const order = (patch = {}) => ({ id: "order-1", numero: "PC-100", fornecedorId: supplier.id, obraId: "work-1", status: "enviado", previsao: "2026-10-20", itens: [{ qtd: 10, precoUnit: 100 }], pagamentos: [], ...patch });
const candidates = (data, transaction = bank()) => gerarCandidatosConciliacao(transaction, data, criarIndicesFinanceiros(data));
const actor = { id: "finance-1", role: "admin" };

describe("conciliação encontra fatos existentes pelas evidências bancárias", () => {
  it("localiza compra parcial pelo nome dentro da descrição e resolve o fornecedor do cadastro", () => {
    const data = { fornecedores: [supplier], pedidos: [order()] };
    const candidate = candidates(data).find(item => item.tipo === "pedido");
    expect(candidate).toMatchObject({ entidadeId: "order-1", contraparte: supplier.nome, documento: supplier.cnpj, saldoCentavos: 100000, podeRegistrarPagamento: true });
    expect(candidate.motivos).toContain("Nome da contraparte semelhante");
    expect(candidate.preSelecionavel).toBe(false);
  });

  it("não compara o número do pedido ao CNPJ bancário e usa PIX do fornecedor", () => {
    const data = { fornecedores: [supplier], pedidos: [order()] };
    const candidate = candidates(data, bank({ valor: -1000, chavePix: supplier.chavePix, contraparteDocumento: supplier.cnpj, contraparteNome: supplier.nome })).find(item => item.tipo === "pedido");
    expect(candidate).toMatchObject({ documento: supplier.cnpj, podeRegistrarPagamento: true });
    expect(candidate.bloqueios).toEqual([]);
    expect(candidate.motivos).toContain("Chave PIX exata e exclusiva");
  });

  it("mostra valor próximo para revisão sem confirmar sozinho nem tolerar excesso de saldo", () => {
    const data = { notasFiscais: [note()] };
    const candidate = candidates(data, bank({ valor: -1000.5, descricao: "Débito bancário" })).find(item => item.tipo === "nota");
    expect(candidate).toBeDefined();
    expect(candidate.bloqueios).toContain("Valor do movimento é maior que o saldo em aberto");
    expect(candidate.preSelecionavel).toBe(false);
  });

  it("considera somente pagamentos ativos no saldo e preserva uma segunda baixa parcial", () => {
    const data = {
      notasFiscais: [note({ pagamentos: [{ id: "paid-1", valor: 400, transacaoId: "bank-old" }, { id: "reversed-1", valor: 300, status: "ESTORNADO" }] })],
      transacoes: [{ id: "bank-old", status: "conciliado", valor: -400, vinculo: { tipo: "nota", id: "note-1" }, gerados: [{ tipo: "pagamentoNota", id: "paid-1", entidadeId: "note-1" }] }],
    };
    const candidate = candidates(data).find(item => item.tipo === "nota");
    expect(candidate).toMatchObject({ saldoCentavos: 60000, podeRegistrarPagamento: true });
    expect(candidates(data).some(item => item.pagamentoId === "reversed-1")).toBe(false);
  });

  it("não libera um fato legado só por possuir um ID de pagamento sem registro comprovável", () => {
    const data = { notasFiscais: [note()], transacoes: [{ id: "bank-old", status: "conciliado", vinculo: { tipo: "nota", id: "note-1" }, gerados: [{ tipo: "pagamentoNota", id: "missing" }] }] };
    expect(candidates(data, bank({ valor: -1000 })).some(item => item.tipo === "nota")).toBe(false);
  });

  it("não oferece documentos cancelados, excluídos ou rascunhos", () => {
    const data = { notasFiscais: [note({ status: "CANCELADA" }), note({ id: "deleted", deletedAt: "2026-10-01" }), note({ id: "draft", status: "rascunho" })] };
    expect(candidates(data, bank({ valor: -1000 }))).toEqual([]);
  });

  it.each([{ archived:true }, { arquivado:true }, { status:"arquivado" }, { status:"archived" }])("arquivamento %j preserva a obrigação e o vínculo ao pagamento, sem reativar", archive => {
    const transaction=bank({valor:-1000});
    const open={pedidos:[order(archive)]};
    expect(candidates(open,transaction).find(item=>item.tipo==="pedido")).toMatchObject({saldoCentavos:100000,podeRegistrarPagamento:true});
    const payment={id:"archived-payment",valor:1000,data:transaction.data,...archive};
    const data={transacoes:[transaction],pedidos:[order({...archive,pagamentos:[payment]})]};
    const candidate=candidates(data,transaction).find(item=>item.tipo==="pagamentoPedido");
    expect(candidate).toMatchObject({podeVincular:true,pagamentoId:payment.id,bloqueios:[]});
    const result=applyReconciliationCommand(data,{type:"LINK_EXISTING_PAYMENT",payload:{transactionId:transaction.id,targetType:candidate.tipo,targetId:candidate.entidadeId,paymentId:candidate.pagamentoId}},actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject(archive);
    expect(result.data.pedidos[0].pagamentos[0]).toMatchObject({...payment,conciliado:true,transacaoId:transaction.id});
  });
});

describe("pagamento existente mantém valor, data e identidade de origem", () => {
  it("não inventa igualdade de valor ao buscar um pagamento pela contraparte", () => {
    const data = { notasFiscais: [note({ pagamentos: [{ id: "paid-1", valor: 1000, data: "2026-10-19" }] })] };
    const candidate = candidates(data, bank({ contraparteNome: supplier.nome })).find(item => item.tipo === "pagamentoNota");
    expect(candidate).toMatchObject({ pagamentoId: "paid-1", saldoCentavos: 100000, dataPrevista: "2026-10-19", podeVincular: false });
    expect(candidate.motivos).not.toContain("Valor exato");
    expect(candidate.bloqueios.join(" ")).toMatch(/valor.*pagamento/i);
  });

  it("prioriza o pagamento espelhado da nota sem repetir a candidata do pedido", () => {
    const payment = { id: "paid-1", valor: 1000, data: "2026-10-20", status: "ativo" };
    const data = { notasFiscais: [note({ pedidoId: "order-1", pagamentos: [payment] })], pedidos: [order({ pagamentos: [{ ...payment, notaFiscalId: "note-1" }] })] };
    const links = candidates(data, bank({ valor: -1000 })).filter(item => item.pagamentoId === "paid-1");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ tipo: "pagamentoNota", podeVincular: true });
  });

  it("exclui pagamento feito pelo cliente ou caixa, liquidado em outro extrato e alocação parcial", () => {
    const payments = [
      { id: "client", valor: 1000, origem: "cliente_direto" },
      { id: "cash", valor: 1000, origem: "caixa_obra" },
      { id: "banked", valor: 1000, transacaoId: "bank-old" },
      { id: "allocated", valor: 1000 },
    ];
    const data = { notasFiscais: payments.map((payment, i) => note({ id: `note-${i}`, pagamentos: [payment] })), reconciliationLinks: [{ id: "link-1", kind: "existing_cash_allocation", status: "active", sourceSubId: "allocated", amountCents: 10000 }] };
    expect(candidates(data, bank({ valor: -1000 })).filter(item => item.podeVincular)).toHaveLength(0);
  });

  it.each(["origem", "origemPagamento", "pagador"])("a origem externa em %s exclui a candidata e é recusada também pelo servidor", field => {
    for(const origem of ["cliente_direto","caixa_obra"]){
      const transaction=bank({valor:-1000});
      const payment={id:"external",valor:1000,data:transaction.data,[field]:origem};
      const data={transacoes:[transaction],notasFiscais:[note({pagamentos:[payment]})]};
      expect(candidates(data,transaction).some(item=>item.pagamentoId===payment.id)).toBe(false);
      const result=applyReconciliationCommand(data,{type:"LINK_EXISTING_PAYMENT",payload:{transactionId:transaction.id,targetType:"pagamentoNota",targetId:"note-1",paymentId:payment.id}},actor);
      expect(result.resumo.ok).toBe(false);
      expect(result.resumo.motivo).toMatch(/cliente ou pelo caixa/);
    }
  });

  it.each(["cliente_direto","caixa_obra"])("herda origem %s do pedido legado, mas respeita a origem real empresa quando informada", origemPagamento => {
    const transaction=bank({valor:-1000});
    const payment={id:"legacy",valor:1000,data:transaction.data};
    const data={transacoes:[transaction],pedidos:[order({origemPagamento,pagamentos:[payment]})]};
    expect(candidates(data,transaction).some(item=>item.pagamentoId===payment.id)).toBe(false);
    const command={type:"LINK_EXISTING_PAYMENT",payload:{transactionId:transaction.id,targetType:"pagamentoPedido",targetId:"order-1",paymentId:payment.id}};
    expect(applyReconciliationCommand(data,command,actor).resumo.ok).toBe(false);
    const paidByCompany={...data,pedidos:[order({origemPagamento,pagamentos:[{...payment,origem:"empresa"}]})]};
    expect(candidates(paidByCompany,transaction).find(item=>item.pagamentoId===payment.id)).toMatchObject({podeVincular:true});
    expect(applyReconciliationCommand(paidByCompany,command,actor).resumo.ok).toBe(true);
  });

  it("vincula pagamento identificado sem criar outra compra ou alterar o DRE", () => {
    const transaction = bank({ valor: -1000 });
    const data = { transacoes: [transaction], notasFiscais: [note({ pagamentos: [{ id: "paid-1", valor: 1000, data: transaction.data }] })] };
    const before = selectDRE(buildFinancialLedger(data));
    const candidate = candidates(data, transaction).find(item => item.tipo === "pagamentoNota");
    const result = applyReconciliationCommand(data, { type: "LINK_EXISTING_PAYMENT", payload: { transactionId: transaction.id, targetType: candidate.tipo, targetId: candidate.entidadeId, paymentId: candidate.pagamentoId } }, actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.notasFiscais[0].pagamentos).toHaveLength(1);
    expect(selectDRE(buildFinancialLedger(result.data)).costCents).toBe(before.costCents);
  });
});

describe("folha e recebimentos já liquidados geram vínculo, sem nova liquidação", () => {
  const employee = { id: "employee-1", name: "Ana Souza", pixKey: "ana@example.test", cpf: "12345678900", obra: "work-1" };
  const payroll = { id: "payroll-1", employeeId: employee.id, liquido: 600, competencia: "2026-10", vencimento: "2026-10-20", status: "pago", rateiosPorObra: [{ obraId: "work-1", valor: 600 }], liquidacoes: [{ id: "settlement-1", valor: 600, data: "2026-10-20" }] };

  it("encontra a liquidação de folha mesmo com o título pago e recomenda apenas vincular", () => {
    const transaction = bank({ chavePix: employee.pixKey, contraparteNome: employee.name, contraparteDocumento: employee.cpf });
    const data = { employees: [employee], titulosFolha: [payroll], transacoes: [transaction] };
    const analysis = analisarMovimentoConciliacao(transaction, data);
    expect(analysis.melhorCandidata).toMatchObject({ tipo: "tituloFolha", entidadeId: payroll.id, pagamentoId: "settlement-1", podeVincular: true, podeRegistrarPagamento: false });
    expect(analysis.acaoRecomendada).toBe("VINCULAR_PAGAMENTO_EXISTENTE");
    const command = comandoConciliacaoAutomatica(analysis);
    expect(command).toMatchObject({ type: "LINK_EXISTING_PAYMENT", payload: { targetType: "tituloFolha", paymentId: "settlement-1" } });
    const result = applyReconciliationCommand(data, command, actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.titulosFolha[0].liquidacoes).toHaveLength(1);
    expect(result.data.outrasDesp).toBeUndefined();
    expect(result.data.despesasEmpresa).toBeUndefined();
  });

  it("preserva o saldo do título após pagamento parcial e não reapresenta a liquidação vinculada", () => {
    const data = { employees: [employee], titulosFolha: [{ ...payroll, liquido: 1000, status: "parcial", liquidacoes: [{ id: "settlement-1", valor: 400, transacaoId: "bank-old" }] }], transacoes: [{ id: "bank-old", status: "conciliado", vinculo: { tipo: "tituloFolha", id: payroll.id }, gerados: [{ id: "settlement-1", tipo: "liquidacaoFolha" }] }] };
    const result = candidates(data, bank({ chavePix: employee.pixKey }));
    expect(result.some(item => item.pagamentoId === "settlement-1")).toBe(false);
    expect(result.find(item => item.tipo === "tituloFolha")).toMatchObject({ saldoCentavos: 60000, podeRegistrarPagamento: true });
  });

  it("identidade exata sem título não autoriza confirmação em lote por si só", () => {
    const transaction = bank({ chavePix: employee.pixKey, contraparteDocumento: employee.cpf, contraparteNome: employee.name });
    const analysis = analisarMovimentoConciliacao(transaction, { employees: [employee] });
    expect(analysis.melhorCandidata.tipo).toBe("funcionario");
    expect(analysis.elegivelLote).toBe(false);
    expect(analysis.melhorCandidata.preSelecionavel).toBe(false);
  });

  it("encontra recebimento da parcela quitada e não registra a mesma receita novamente", () => {
    const transaction = bank({ valor: 600, descricao: "Parcela cliente" });
    const data = { transacoes: [transaction], medicoes: [{ id: "measurement-1", obraId: "work-1", valorPrevisto: 600, competencia: "2026-10", recebimentos: [{ id: "receipt-1", valor: 600, data: transaction.data }] }] };
    const analysis = analisarMovimentoConciliacao(transaction, data);
    expect(analysis.melhorCandidata).toMatchObject({ tipo: "medicao", entidadeId: "measurement-1", pagamentoId: "receipt-1", podeVincular: true, podeRegistrarPagamento: false });
    expect(analysis.acaoRecomendada).toBe("VINCULAR_PAGAMENTO_EXISTENTE");
    const before = selectDRE(buildFinancialLedger(data));
    const result = applyReconciliationCommand(data, comandoConciliacaoAutomatica(analysis), actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.medicoes[0].recebimentos).toHaveLength(1);
    expect(selectDRE(buildFinancialLedger(result.data)).revenueCents).toBe(before.revenueCents);
  });
});

describe("despesas e receitas registradas são sugestões de vínculo", () => {
  it("oferece despesas pagas e exclui obrigações ainda em aberto", () => {
    const data = { despesasEmpresa: [{ id: "paid", categoria: "internet", descricao: "Internet sede", valor: 600, pago: true, dataPagamento: "2026-10-20" }, { id: "open", categoria: "internet", valor: 600, pago: false }], outrasDesp: [{ id: "work", categoria: "material", valor: 600, pago: true, dataPagamento: "2026-10-20", obraId: "work-1" }] };
    const result = candidates(data);
    expect(result.filter(item => ["despesasEmpresa", "outrasDesp"].includes(item.tipo)).map(item => item.entidadeId).sort()).toEqual(["paid", "work"]);
    expect(result.filter(item => item.podeVincular)).toHaveLength(2);
  });

  it("oferece recebimentos somente para entradas", () => {
    const data = { payments: [{ id: "receipt-1", amount: 600, date: "2026-10-20", description: "Recebimento administração", obraId: "work-1" }] };
    expect(candidates(data, bank({ valor: 600 })).find(item => item.tipo === "payments")).toMatchObject({ entidadeId: "receipt-1", pagamentoId: "receipt-1", podeVincular: true });
    expect(candidates(data, bank({ valor: -600 })).some(item => item.tipo === "payments")).toBe(false);
  });
});
