import { describe, expect, it, vi } from "vitest";
import { criarGerenciadorSql, ehErroDeConexao, OCIOSO_PARA_VALIDAR_MS } from "./pg-conexao.js";

// Cliente falso no formato do driver: é chamável (template `select 1`) e tem end().
const clienteFalso = ({ ping = async () => [{ "?column?": 1 }] } = {}) => {
  const cliente = vi.fn(ping);
  cliente.end = vi.fn(async () => {});
  return cliente;
};

const montar = (extra = {}) => {
  const relogio = { agora: 1_000 };
  const clientes = [];
  const factory = vi.fn(() => { const c = clienteFalso(extra.cliente); clientes.push(c); return c; });
  const gerenciador = criarGerenciadorSql({
    factory, url: () => extra.url ?? "postgres://a", reutilizar: () => extra.reutilizar ?? true,
    agora: () => relogio.agora, opcoes: { max: 2 },
  });
  return { relogio, clientes, factory, ...gerenciador };
};

describe("conexão Postgres reaproveitada", () => {
  it("abre um único cliente para chamadas seguidas", async () => {
    const { comSql, factory, clientes } = montar();
    await comSql(async () => "a");
    await comSql(async () => "b");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(clientes[0].end).not.toHaveBeenCalled();
  });

  it("não valida a conexão enquanto ela está em uso recente", async () => {
    const { comSql, relogio, clientes } = montar();
    await comSql(async () => {});
    relogio.agora += OCIOSO_PARA_VALIDAR_MS - 1;
    await comSql(async () => {});
    expect(clientes[0]).not.toHaveBeenCalled();
  });

  it("valida com select 1 depois de ociosa e mantém o cliente se responde", async () => {
    const { comSql, relogio, clientes, factory } = montar();
    await comSql(async () => {});
    relogio.agora += OCIOSO_PARA_VALIDAR_MS + 1;
    await comSql(async () => {});
    expect(clientes[0]).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("recria o cliente quando a validação falha, antes de rodar o trabalho", async () => {
    const { comSql, relogio, clientes, factory } = montar({
      cliente: { ping: async () => { throw Object.assign(new Error("reset"), { code: "ECONNRESET" }); } },
    });
    await comSql(async () => {});
    relogio.agora += OCIOSO_PARA_VALIDAR_MS + 1;
    const trabalho = vi.fn(async sql => sql);
    const usado = await comSql(trabalho);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(clientes[0].end).toHaveBeenCalledTimes(1);
    expect(usado).toBe(clientes[1]);
    expect(trabalho).toHaveBeenCalledTimes(1);
  });

  it("descarta o cliente quando o trabalho falha por erro de conexão e propaga o erro", async () => {
    const { comSql, factory, clientes } = montar();
    const queda = Object.assign(new Error("closed"), { code: "CONNECTION_CLOSED" });
    await expect(comSql(async () => { throw queda; })).rejects.toBe(queda);
    expect(clientes[0].end).toHaveBeenCalledTimes(1);
    await comSql(async () => {});
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("mantém o cliente quando o erro é de regra de negócio ou SQL", async () => {
    const { comSql, factory } = montar();
    const erro = Object.assign(new Error("unique"), { code: "23505" });
    await expect(comSql(async () => { throw erro; })).rejects.toBe(erro);
    await comSql(async () => {});
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("troca o cliente quando a URL de conexão muda", async () => {
    let url = "postgres://a";
    const factory = vi.fn(() => clienteFalso());
    const { comSql } = criarGerenciadorSql({ factory, url: () => url, reutilizar: () => true, agora: () => 1 });
    await comSql(async () => {});
    url = "postgres://b";
    await comSql(async () => {});
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("com PG_REUSE_CONNECTION=0 abre e encerra um cliente por chamada", async () => {
    const { comSql, factory, clientes } = montar({ reutilizar: false });
    await comSql(async () => {});
    await comSql(async () => {});
    expect(factory).toHaveBeenCalledTimes(2);
    clientes.forEach(c => expect(c.end).toHaveBeenCalledWith({ timeout: 2 }));
  });

  it("com reaproveitamento desligado ainda encerra o cliente quando o trabalho falha", async () => {
    const { comSql, clientes } = montar({ reutilizar: false });
    await expect(comSql(async () => { throw new Error("falhou"); })).rejects.toThrow("falhou");
    expect(clientes[0].end).toHaveBeenCalledTimes(1);
  });

  it("reconhece erros de conexão também quando vêm aninhados em cause", () => {
    expect(ehErroDeConexao({ code: "CONNECT_TIMEOUT" })).toBe(true);
    expect(ehErroDeConexao({ cause: { code: "ECONNRESET" } })).toBe(true);
    expect(ehErroDeConexao({ code: "23505" })).toBe(false);
    expect(ehErroDeConexao(undefined)).toBe(false);
  });
});
