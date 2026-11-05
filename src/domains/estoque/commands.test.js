import { describe, expect, it } from "vitest";
import { STOCK_COMMAND, applyStockCommand, stockCommandObraId } from "./commands.js";
import { calcSaldos, transferenciasEmTransito } from "./calculations.js";

const BASE = {
  obras: [{ id: "obra1", name: "Obra 1" }],
  movEstoque: [],
  composicoes: [],
};

describe("comandos de estoque", () => {
  it("ignora comandos de outro domínio", () => {
    expect(applyStockCommand(BASE, { type: "OUTRO_COMANDO" })).toBeNull();
  });

  describe("MATERIAL_MOVEMENT_RECORDED", () => {
    it("registra uma entrada sem exigir saldo prévio", () => {
      const command = {
        type: STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED,
        idempotencyKey: "mov-0001",
        payload: { movement: { id: "mov1", obraId: "obra1", materialId: "cimento", tipo: "entrada", qtd: 100 } },
      };
      const result = applyStockCommand(BASE, command);
      expect(result.ok).toBe(true);
      expect(result.data.movEstoque).toEqual([
        expect.objectContaining({ id: "mov1", obraId: "obra1", materialId: "cimento", tipo: "entrada", qtd: 100 }),
      ]);
    });

    it("recusa uma saída maior que o saldo disponível", () => {
      const withStock = { ...BASE, movEstoque: [{ id: "mov0", obraId: "obra1", materialId: "cimento", tipo: "entrada", qtd: 10 }] };
      const command = {
        type: STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED,
        idempotencyKey: "mov-0002",
        payload: { movement: { id: "mov1", obraId: "obra1", materialId: "cimento", tipo: "consumo", qtd: 50 } },
      };
      const result = applyStockCommand(withStock, command);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Saldo insuficiente/);
    });

    it("rejeita obra inexistente", () => {
      const command = {
        type: STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED,
        idempotencyKey: "mov-0003",
        payload: { movement: { id: "mov1", obraId: "obra-fantasma", materialId: "cimento", tipo: "entrada", qtd: 10 } },
      };
      expect(applyStockCommand(BASE, command).ok).toBe(false);
    });
  });

  describe("MATERIAL_MOVEMENT_REVERSED", () => {
    it("estorna um movimento existente", () => {
      const withMov = { ...BASE, movEstoque: [{ id: "mov1", obraId: "obra1", materialId: "cimento", tipo: "entrada", qtd: 10 }] };
      const command = {
        type: STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED,
        idempotencyKey: "estorno-0001",
        payload: { movementId: "mov1", reason: "Lançamento duplicado" },
      };
      const result = applyStockCommand(withMov, command, "2026-08-25T12:00:00.000Z");
      expect(result.ok).toBe(true);
      expect(result.data.movEstoque[0]).toMatchObject({ status: "estornado", motivoEstorno: "Lançamento duplicado" });
    });

    it("recusa estornar duas vezes", () => {
      const withMov = { ...BASE, movEstoque: [{ id: "mov1", obraId: "obra1", materialId: "cimento", tipo: "entrada", qtd: 10, status: "estornado" }] };
      const command = { type: STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED, idempotencyKey: "estorno-0002", payload: { movementId: "mov1", reason: "x" } };
      expect(applyStockCommand(withMov, command).ok).toBe(false);
    });
  });

  describe("SERVICE_EXECUTION_RECORDED", () => {
    const comp = { id: "comp1", nome: "Alvenaria", unidade: "m2", itens: [{ materialId: "bloco", coef: 10 }, { materialId: "cimento", coef: 2 }] };
    const withComp = { ...BASE, composicoes: [comp], movEstoque: [
      { id: "e1", obraId: "obra1", materialId: "bloco", tipo: "entrada", qtd: 1000 },
      { id: "e2", obraId: "obra1", materialId: "cimento", tipo: "entrada", qtd: 100 },
    ] };

    it("baixa todos os insumos da composição de uma vez quando há saldo", () => {
      const command = {
        type: STOCK_COMMAND.SERVICE_EXECUTION_RECORDED,
        idempotencyKey: "exec-0001",
        payload: {
          compositionId: "comp1", obraId: "obra1", qtdExecutada: 10,
          entries: [
            { id: "c1", materialId: "bloco", qtd: 100 },
            { id: "c2", materialId: "cimento", qtd: 20 },
          ],
        },
      };
      const result = applyStockCommand(withComp, command);
      expect(result.ok).toBe(true);
      expect(result.data.movEstoque).toHaveLength(4);
      expect(result.data.movEstoque.slice(2)).toEqual([
        expect.objectContaining({ id: "c1", materialId: "bloco", qtd: 100, tipo: "consumo", servicoId: "comp1" }),
        expect.objectContaining({ id: "c2", materialId: "cimento", qtd: 20, tipo: "consumo", servicoId: "comp1" }),
      ]);
    });

    it("recusa quando o saldo não cobre TODOS os insumos, sem baixar nenhum", () => {
      const command = {
        type: STOCK_COMMAND.SERVICE_EXECUTION_RECORDED,
        idempotencyKey: "exec-0002",
        payload: {
          compositionId: "comp1", obraId: "obra1", qtdExecutada: 200,
          entries: [
            { id: "c1", materialId: "bloco", qtd: 2000 },
            { id: "c2", materialId: "cimento", qtd: 400 },
          ],
        },
      };
      const result = applyStockCommand(withComp, command);
      expect(result.ok).toBe(false);
      expect(result.data).toBeUndefined();
    });

    it("recusa quando as entradas enviadas pelo cliente não batem com a composição atual (proteção contra dado stale/adulterado)", () => {
      const command = {
        type: STOCK_COMMAND.SERVICE_EXECUTION_RECORDED,
        idempotencyKey: "exec-0003",
        payload: {
          compositionId: "comp1", obraId: "obra1", qtdExecutada: 10,
          entries: [{ id: "c1", materialId: "bloco", qtd: 999 }, { id: "c2", materialId: "cimento", qtd: 20 }],
        },
      };
      const result = applyStockCommand(withComp, command);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/composição foi alterada/);
    });
  });

  describe("COMPOSITION_SAVED", () => {
    it("cria uma composição na versão 0", () => {
      const command = {
        type: STOCK_COMMAND.COMPOSITION_SAVED,
        idempotencyKey: "comp-0001", expectedVersion: 0,
        payload: { composition: { id: "comp1", nome: "Alvenaria", unidade: "m2", itens: [{ materialId: "bloco", coef: 10 }] } },
      };
      const result = applyStockCommand(BASE, command);
      expect(result.ok).toBe(true);
      expect(result.data.composicoes[0]).toMatchObject({ id: "comp1", nome: "Alvenaria", version: 1 });
    });

    it("rejeita composição sem itens válidos", () => {
      const command = {
        type: STOCK_COMMAND.COMPOSITION_SAVED,
        idempotencyKey: "comp-0002", expectedVersion: 0,
        payload: { composition: { id: "comp1", nome: "Vazia", itens: [] } },
      };
      expect(applyStockCommand(BASE, command).ok).toBe(false);
    });

    it("recusa edição com versão desatualizada (concorrência)", () => {
      const withComp = { ...BASE, composicoes: [{ id: "comp1", nome: "Alvenaria", version: 3, itens: [{ materialId: "bloco", coef: 10 }] }] };
      const command = {
        type: STOCK_COMMAND.COMPOSITION_SAVED,
        idempotencyKey: "comp-0003", expectedVersion: 1,
        payload: { composition: { id: "comp1", nome: "Alvenaria reforçada", itens: [{ materialId: "bloco", coef: 12 }] } },
      };
      const result = applyStockCommand(withComp, command);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/alterada por outra pessoa/);
    });
  });

  describe("COMPOSITION_DELETED", () => {
    it("remove a composição quando a versão bate", () => {
      const withComp = { ...BASE, composicoes: [{ id: "comp1", nome: "Alvenaria", version: 1 }] };
      const command = { type: STOCK_COMMAND.COMPOSITION_DELETED, idempotencyKey: "del-0001", expectedVersion: 1, payload: { compositionId: "comp1" } };
      const result = applyStockCommand(withComp, command);
      expect(result.ok).toBe(true);
      expect(result.data.composicoes).toEqual([]);
    });

    it("recusa excluir composição inexistente", () => {
      const command = { type: STOCK_COMMAND.COMPOSITION_DELETED, idempotencyKey: "del-0002", expectedVersion: 0, payload: { compositionId: "fantasma" } };
      expect(applyStockCommand(BASE, command).ok).toBe(false);
    });
  });
});

describe("transferência entre obras (E1.1)", () => {
  const OBRAS = { obras: [{ id: "alameda", name: "Alameda" }, { id: "horizonte", name: "Horizonte" }], materiais: [{ id: "cim", precoMedio: 1 }] };
  const comEstoque = () => ({ ...OBRAS, composicoes: [], movEstoque: [
    { id: "e1", obraId: "alameda", materialId: "cim", tipo: "entrada", qtd: 20, valorUnit: 30 },
    { id: "e2", obraId: "horizonte", materialId: "cim", tipo: "entrada", qtd: 20, valorUnit: 35 },
  ] });
  const enviar = (data, transfer, now = "2026-10-20T12:00:00.000Z") => applyStockCommand(data, {
    type: STOCK_COMMAND.TRANSFER_SENT, idempotencyKey: `transf-${transfer.id}-envio`, actorId: "u1", actorName: "Compras QA",
    payload: { transfer: { obraOrigemId: "alameda", obraDestinoId: "horizonte", materialId: "cim", data: "2026-10-20", ...transfer } },
  }, now);
  const receber = (data, saidaId, extra = {}) => applyStockCommand(data, {
    type: STOCK_COMMAND.TRANSFER_RECEIVED, idempotencyKey: `transf-${saidaId}-chegada`, actorId: "u2", actorName: "Obra QA",
    payload: { saidaId, entradaId: `${saidaId}-chegada`, data: "2026-11-03", ...extra },
  }, "2026-11-03T12:00:00.000Z");
  const saldo = (data, obraId) => calcSaldos(data.movEstoque)[`${obraId}|cim`] || 0;

  it("envio baixa a origem na hora, pelo custo médio calculado no servidor, e fica em trânsito", () => {
    const enviado = enviar(comEstoque(), { id: "t1", qtd: 10, valorUnit: 999 });
    expect(enviado.ok).toBe(true);
    const saida = enviado.data.movEstoque.find(m => m.id === "t1");
    expect(saida).toMatchObject({ tipo: "transferencia_saida", obraId: "alameda", obraDestinoId: "horizonte", qtd: 10, valorUnit: 32.5, enviadoPor: "Compras QA" });
    expect(saldo(enviado.data, "alameda")).toBe(10);
    expect(saldo(enviado.data, "horizonte")).toBe(20);
    expect(transferenciasEmTransito(enviado.data.movEstoque, "horizonte").map(m => m.id)).toEqual(["t1"]);
  });

  it("chegada confirmada pelo destino entra no saldo dele e encerra o trânsito", () => {
    const enviado = enviar(comEstoque(), { id: "t1", qtd: 10 });
    const recebido = receber(enviado.data, "t1");
    expect(recebido.ok).toBe(true);
    expect(recebido.data.movEstoque.at(-1)).toMatchObject({ tipo: "transferencia_entrada", obraId: "horizonte", obraOrigemId: "alameda",
      transferenciaSaidaId: "t1", qtd: 10, valorUnit: 32.5, data: "2026-11-03", recebidoPor: "Obra QA" });
    expect(saldo(recebido.data, "horizonte")).toBe(30);
    expect(transferenciasEmTransito(recebido.data.movEstoque)).toEqual([]);
    expect(receber(recebido.data, "t1", { entradaId: "outra" }).reason).toMatch(/já foi confirmada/);
  });

  it("recusa mesma obra, saldo insuficiente, chegada antes do envio e período fechado", () => {
    expect(enviar(comEstoque(), { id: "t1", qtd: 10, obraDestinoId: "alameda" }).reason).toMatch(/diferente da origem/);
    expect(enviar(comEstoque(), { id: "t1", qtd: 21 }).reason).toMatch(/Saldo insuficiente na obra de origem/);
    const enviado = enviar(comEstoque(), { id: "t1", qtd: 10 });
    expect(receber(enviado.data, "t1", { data: "2026-10-19" }).reason).toMatch(/antes do envio/);
    const fechado = { ...enviado.data, fechamentosFinanceiros: [{ status: "fechado", dataInicio: "2026-11-01", dataFim: "2026-11-30" }] };
    expect(receber(fechado, "t1").reason).toMatch(/período financeiro fechado/);
  });

  it("movimento avulso não cria transferência", () => {
    const result = applyStockCommand(comEstoque(), { type: STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED, idempotencyKey: "mov-transf-avulsa",
      payload: { movement: { id: "x", obraId: "alameda", materialId: "cim", tipo: "transferencia_entrada", qtd: 5 } } });
    expect(result.reason).toMatch(/Transferência entre obras tem fluxo próprio/);
  });

  it("estorno: envio em trânsito devolve à origem; depois da chegada, só estornando a chegada primeiro", () => {
    const estornar = (data, movementId) => applyStockCommand(data, { type: STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED,
      idempotencyKey: `estorno-${movementId}`, payload: { movementId, reason: "Enviado por engano" } }, "2026-11-04T12:00:00.000Z");
    const enviado = enviar(comEstoque(), { id: "t1", qtd: 10 });
    const cancelado = estornar(enviado.data, "t1");
    expect(cancelado.ok).toBe(true);
    expect(saldo(cancelado.data, "alameda")).toBe(20);
    const recebido = receber(enviado.data, "t1");
    expect(estornar(recebido.data, "t1").reason).toMatch(/Estorne primeiro a chegada/);
    const semChegada = estornar(recebido.data, "t1-chegada");
    expect(semChegada.ok).toBe(true);
    expect(transferenciasEmTransito(semChegada.data.movEstoque).map(m => m.id)).toEqual(["t1"]);
    // Destino já usou o material: não dá para desfazer a chegada.
    const usado = { ...recebido.data, movEstoque: [...recebido.data.movEstoque, { id: "c1", obraId: "horizonte", materialId: "cim", tipo: "consumo", qtd: 25 }] };
    expect(estornar(usado, "t1-chegada").reason).toMatch(/já foi usada na obra de destino/);
  });

  it("quem envia responde pela origem e quem confirma, pelo destino", () => {
    const enviado = enviar(comEstoque(), { id: "t1", qtd: 10 });
    expect(stockCommandObraId(comEstoque(), { type: STOCK_COMMAND.TRANSFER_SENT, payload: { transfer: { obraOrigemId: "alameda" } } })).toBe("alameda");
    expect(stockCommandObraId(enviado.data, { type: STOCK_COMMAND.TRANSFER_RECEIVED, payload: { saidaId: "t1" } })).toBe("horizonte");
  });
});
