import { describe, expect, it } from "vitest";
import { STOCK_COMMAND, applyStockCommand } from "./commands.js";

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
