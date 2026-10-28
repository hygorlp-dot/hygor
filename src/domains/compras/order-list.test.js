import { describe, expect, it } from "vitest";
import {
  acoesDoPedido, contarPedidosPorStatus, FILTROS_PEDIDOS_VAZIOS, filtrarPedidos, filtrosPedidosAtivos,
} from "./order-list.js";

const item = (qtd, qtdRecebida = 0) => ({ id: `i-${qtd}-${qtdRecebida}`, materialId: "m", qtd, qtdRecebida });
const pedido = (id, status, extra = {}) => ({ id, numero: `PC-${id}`, obraId: "a", fornecedorId: "f1", status, itens: [item(10)], ...extra });
const parcial = pedido("par", "enviado", { itens: [item(10, 4)] });
const recebido = pedido("rec", "enviado", { itens: [item(10, 10)] });
const todos = [
  pedido("rasc", "rascunho"), pedido("env", "enviado", { fornecedorId: "f2", obraId: "b" }), parcial, recebido, pedido("canc", "cancelado"),
];

const ids = lista => lista.map(p => p.id);
const contexto = { podeEnviar: true, podeExcluir: true, temTelefone: true };

describe("ação principal do cartão de pedido (R4)", () => {
  it("rascunho revisa, enviado e parcial recebem, recebido e cancelado não têm ação principal", () => {
    expect(acoesDoPedido({ pedido: pedido("1", "rascunho"), ...contexto }).principal.id).toBe("revisar");
    expect(acoesDoPedido({ pedido: pedido("2", "enviado"), ...contexto }).principal.id).toBe("receber");
    expect(acoesDoPedido({ pedido: parcial, ...contexto }).principal.id).toBe("receber");
    expect(acoesDoPedido({ pedido: recebido, ...contexto }).principal).toBeNull();
    expect(acoesDoPedido({ pedido: pedido("3", "cancelado"), ...contexto }).principal).toBeNull();
  });

  it("pedido já enviado não oferece 'Enviar' como se fosse a primeira vez", () => {
    const novo = acoesDoPedido({ pedido: pedido("1", "enviado"), ...contexto });
    expect(novo.comuns.find(a => a.id === "enviar").label).toBe("Enviar ao fornecedor");
    const jaEnviado = acoesDoPedido({ pedido: pedido("2", "enviado", { envios: [{ id: "e1", canal: "whatsapp" }] }), ...contexto });
    expect(jaEnviado.comuns.find(a => a.id === "enviar").label).toBe("Reenviar ao fornecedor");
    expect(novo.principal.id).toBe("receber");
    expect(jaEnviado.principal.id).toBe("receber");
  });

  it("cancelar e excluir ficam só no grupo destrutivo, nunca na ação principal nem nas comuns", () => {
    const acoes = acoesDoPedido({ pedido: pedido("1", "enviado"), ...contexto });
    expect(acoes.destrutivas.map(a => a.id)).toEqual(["cancelar", "excluir"]);
    expect([acoes.principal, ...acoes.comuns].map(a => a.id)).not.toContain("cancelar");
    expect([acoes.principal, ...acoes.comuns].map(a => a.id)).not.toContain("excluir");
  });

  it("os papéis continuam valendo: sem permissão não aparece enviar, aceite nem excluir", () => {
    const acoes = acoesDoPedido({ pedido: pedido("1", "enviado"), podeEnviar: false, podeExcluir: false, temTelefone: true });
    const idsAcoes = [...acoes.comuns, ...acoes.destrutivas].map(a => a.id);
    expect(idsAcoes).not.toContain("enviar");
    expect(idsAcoes).not.toContain("aceite");
    expect(idsAcoes).not.toContain("excluir");
    expect(idsAcoes).toContain("cancelar");
  });

  it("pedido cancelado ou recebido só oferece exclusão (a quem pode), sem cancelar nem editar", () => {
    const cancelado = acoesDoPedido({ pedido: pedido("1", "cancelado"), ...contexto });
    expect(cancelado.comuns).toEqual([]);
    expect(cancelado.destrutivas.map(a => a.id)).toEqual(["excluir"]);
    const semPermissao = acoesDoPedido({ pedido: recebido, ...contexto, podeExcluir: false });
    expect(semPermissao.destrutivas).toEqual([]);
  });

  it("cobrar entrega só com atraso e telefone; aceite some depois de registrado; saldo só sem pagamento", () => {
    const base = { pedido: pedido("1", "enviado"), ...contexto };
    expect(acoesDoPedido(base).comuns.map(a => a.id)).not.toContain("cobrar");
    expect(acoesDoPedido({ ...base, atrasado: true }).comuns.map(a => a.id)).toContain("cobrar");
    expect(acoesDoPedido({ ...base, atrasado: true, temTelefone: false }).comuns.map(a => a.id)).not.toContain("cobrar");
    expect(acoesDoPedido(base).comuns.map(a => a.id)).toContain("aceite");
    const aceito = pedido("2", "enviado", { aceiteFornecedor: { nome: "Ana", data: "2026-10-20" } });
    expect(acoesDoPedido({ ...base, pedido: aceito }).comuns.map(a => a.id)).not.toContain("aceite");
    expect(acoesDoPedido(base).comuns.map(a => a.id)).not.toContain("saldo");
    expect(acoesDoPedido({ ...base, liberadoParaReceber: false }).comuns.map(a => a.id)).toContain("saldo");
  });
});

describe("filtros da lista de pedidos (R4)", () => {
  it("sem filtro devolve tudo; 'a receber' junta enviado e parcial (recebido por quantidade fica fora)", () => {
    expect(filtrarPedidos(todos)).toHaveLength(5);
    expect(ids(filtrarPedidos(todos, { ...FILTROS_PEDIDOS_VAZIOS, status: "a_receber" }))).toEqual(["env", "par"]);
    expect(ids(filtrarPedidos(todos, { ...FILTROS_PEDIDOS_VAZIOS, status: "recebido" }))).toEqual(["rec"]);
    expect(ids(filtrarPedidos(todos, { ...FILTROS_PEDIDOS_VAZIOS, status: "parcial" }))).toEqual(["par"]);
    expect(ids(filtrarPedidos(todos, { ...FILTROS_PEDIDOS_VAZIOS, status: "cancelado" }))).toEqual(["canc"]);
  });

  it("fornecedor, obra e atraso se combinam", () => {
    expect(ids(filtrarPedidos(todos, { ...FILTROS_PEDIDOS_VAZIOS, fornecedorId: "f2" }))).toEqual(["env"]);
    expect(ids(filtrarPedidos(todos, { ...FILTROS_PEDIDOS_VAZIOS, obraId: "b" }))).toEqual(["env"]);
    const atrasados = new Set(["par", "env"]);
    expect(ids(filtrarPedidos(todos, { ...FILTROS_PEDIDOS_VAZIOS, atrasados: true }, atrasados))).toEqual(["env", "par"]);
    expect(ids(filtrarPedidos(todos, { status: "a_receber", fornecedorId: "f1", obraId: "", atrasados: true }, atrasados))).toEqual(["par"]);
    expect(filtrarPedidos(todos, { ...FILTROS_PEDIDOS_VAZIOS, atrasados: true })).toEqual([]);
  });

  it("conta por status para os rótulos e reconhece quando há filtro ativo", () => {
    expect(contarPedidosPorStatus(todos)).toEqual({ todos: 5, a_receber: 2, rascunho: 1, enviado: 1, parcial: 1, recebido: 1, cancelado: 1 });
    expect(filtrosPedidosAtivos(FILTROS_PEDIDOS_VAZIOS)).toBe(false);
    expect(filtrosPedidosAtivos({ ...FILTROS_PEDIDOS_VAZIOS, atrasados: true })).toBe(true);
    expect(filtrosPedidosAtivos({ ...FILTROS_PEDIDOS_VAZIOS, status: "recebido" })).toBe(true);
  });
});
