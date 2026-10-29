import { describe, expect, it } from "vitest";
import { criarFilaAutomatica } from "./automation.js";
import { applyReconciliationCommand } from "../../../server/reconciliation-command.js";
import { authorizeReconciliationCommand } from "../../../server/reconciliation-policy.js";

const actor = { id: "financeiro", role: "financeiro", nome: "Financeiro" };
const command = { type: "AUTO_MATCH", payload: { transactionId: "t1", targetId: "forjado", valor: 1 } };
const fixture = () => ({
  transacoes: [{ id: "t1", status: "pendente", data: "2026-10-20", valor: -300, chavePix: "loja@pix", fitid: "bank-1", extratoId: "ex1" }],
  fornecedores: [{ id: "f1", nome: "Loja", chavePix: "loja@pix", cnpj: "12345678000199" }],
  notasFiscais: [{ id: "n1", fornecedorId: "f1", status: "aprovada", valorLiquido: 300, vencimento: "2026-10-20", pagamentos: [] }],
  historicoConc: [], obras: [], employees: [], medicoes: [], pedidos: [],
});

describe("conciliação autônoma", () => {
  it("cruza fornecedor pelo vínculo, executa no servidor e grava evidências", () => {
    const data = fixture();
    expect(criarFilaAutomatica(data)[0]).toMatchObject({ automatica: true, identificada: true });
    const result = applyReconciliationCommand(data, command, actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.notasFiscais[0].pagamentos).toHaveLength(1);
    expect(result.data.notasFiscais[0].pagamentos[0].valor).toBe(300);
    expect(result.data.transacoes[0]).toMatchObject({ status: "conciliado", automacaoConciliacao: { regra: "pix-identidade-valor-referencia-v1" } });
    expect(applyReconciliationCommand(result.data, command, actor).resumo.ok).toBe(false);
  });

  it("recalcula no servidor quando saldo muda depois da sugestão", () => {
    const data = fixture();
    expect(criarFilaAutomatica(data)[0].automatica).toBe(true);
    data.notasFiscais[0].pagamentos.push({ id: "pg", valor: 100 });
    expect(applyReconciliationCommand(data, command, actor).resumo.ok).toBe(false);
  });

  it.each([
    ["nota sem aprovação", data => { data.notasFiscais[0].status = "pendente"; }],
    ["vínculo parcial", data => { data.reconciliationLinks = [{kind:"existing_cash_allocation",status:"active",transactionId:"t1"}]; }],
    ["nome/valor isolados", data => { delete data.transacoes[0].chavePix; data.transacoes[0].contraparteNome = "Loja"; }],
    ["sem identificador bancário", data => { delete data.transacoes[0].fitid; }],
    ["valor parcial", data => { data.transacoes[0].valor = -150; }],
    ["data distante", data => { data.transacoes[0].data = "2026-10-28"; }],
    ["Pix divergente", data => { data.transacoes[0].chavePix = "outro@pix"; data.transacoes[0].contraparteDocumento = "12345678000199"; }],
    ["CPF divergente", data => { data.transacoes[0].contraparteDocumento = "98765432100"; }],
    ["cadastro duplicado", data => { data.fornecedores.push({ id: "f2", nome: "Outro", chavePix: "loja@pix" }); }],
    ["duas obrigações", data => { data.notasFiscais.push({ ...data.notasFiscais[0], id: "n2" }); }],
    ["mesmo identificador", data => { data.transacoes.push({ ...data.transacoes[0], id: "t2" }); }],
    ["dois movimentos disputam obrigação", data => { data.transacoes.push({ ...data.transacoes[0], id: "t2", fitid: "bank-2" }); }],
    ["sugestão rejeitada", data => { data.rejeicoesConc = [{ transacaoId: "t1", candidatoTipo: "nota", candidatoId: "n1" }]; }],
    ["conciliação desfeita", data => { data.historicoConc = [{ transacaoId: "t1", acao: "desfeito" }]; }],
    ["período fechado", data => { data.fechamentosBancarios = [{ status: "fechado", dataInicio: "2026-10-01", dataFim: "2026-10-31" }]; }],
  ])("deixa para revisão: %s", (_name, change) => {
    const data = fixture(); change(data);
    expect(criarFilaAutomatica(data)[0].automatica).toBe(false);
    const result = applyReconciliationCommand(data, command, actor);
    expect(result.resumo.ok).toBe(false);
    expect(result.data).toBe(data);
  });

  it("não executa extratos arquivados nem permite RH disparar automação financeira", () => {
    const data = fixture(); data.extratos = [{ id: "ex1", status: "arquivado" }];
    expect(criarFilaAutomatica(data)).toHaveLength(0);
    expect(applyReconciliationCommand(data, command, actor).resumo.ok).toBe(false);
    expect(authorizeReconciliationCommand(fixture(), command, { role: "rh" }).ok).toBe(false);
    expect(applyReconciliationCommand(fixture(), command, { role: "rh" }).resumo.ok).toBe(false);
  });

  it("cruza recebimento com cliente da obra sem duplicar lead convertido", () => {
    const data = fixture(); data.notasFiscais = []; data.fornecedores = [];
    data.comercial = { clientes: [{ id: "cl1", leadId: "l1", nome: "Cliente", documento: "12345678901", chavePix: "cliente@pix" }], leads: [{ id: "l1", nome: "Cliente", documento: "12345678901" }], contratos: [{ id: "c1", clienteId: "cl1", leadId: "l1", contratante: "Cliente" }] };
    data.obras = [{ id: "o1", clienteId: "cl1" }];
    data.medicoes = [{ id: "m1", obraId: "o1", valorPrevisto: 300, dataVencimento: "2026-10-20", recebimentos: [] }];
    data.transacoes[0] = { ...data.transacoes[0], valor: 300, chavePix: "cliente@pix", contraparteNome: "Cliente", contraparteDocumento: "12345678901" };
    expect(criarFilaAutomatica(data)[0].automatica).toBe(true);
    const result = applyReconciliationCommand(data, command, actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.medicoes[0].recebimentos[0].valor).toBe(300);
  });

  it("liquida título existente da folha sem criar despesa duplicada", () => {
    const data = fixture(); data.notasFiscais = []; data.fornecedores = [];
    data.employees = [{ id: "e1", name: "Ana", pixKey: "loja@pix", obra: "o1" }];
    data.titulosFolha = [{ id: "tf1", employeeId: "e1", liquido: 300, vencimento: "2026-10-20", status: "em_aberto", liquidacoes: [], rateiosPorObra: [{ obraId: "o1", valor: 300 }] }];
    const result = applyReconciliationCommand(data, command, actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.titulosFolha[0].liquidacoes).toHaveLength(1);
    expect(result.data.despesasEmpresa || []).toHaveLength(0);
  });

  it("vincula pagamento já registrado sem criar outro pagamento", () => {
    const data = fixture();
    data.notasFiscais[0].pagamentos = [{ id: "pg1", valor: 300, data: "2026-10-20", fitid: "bank-1" }];
    const result = applyReconciliationCommand(data, command, actor);
    expect(result.resumo.ok).toBe(true);
    expect(result.data.notasFiscais[0].pagamentos).toHaveLength(1);
  });
});
