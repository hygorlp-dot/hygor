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

  it("recusa material sem custo e datas futuras", () => {
    const semCusto = { ...comEstoque(), materiais: [{ id: "cim", precoMedio: 0 }], movEstoque: [{ id: "a1", obraId: "alameda", materialId: "cim", tipo: "ajuste", qtd: 20 }] };
    expect(enviar(semCusto, { id: "t1", qtd: 5 }).reason).toMatch(/não tem custo médio/);
    expect(enviar(comEstoque(), { id: "t1", qtd: 5, data: "2026-10-21" }).reason).toMatch(/envio não pode ser futura/);
    const enviado = enviar(comEstoque(), { id: "t1", qtd: 10 });
    expect(receber(enviado.data, "t1", { data: "2026-11-04" }).reason).toMatch(/chegada não pode ser futura/);
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

describe("inventário com ajuste (E1.2)", () => {
  const base = () => ({
    obras: [{ id: "alameda", name: "Alameda" }], composicoes: [],
    materiais: [{ id: "cim", precoMedio: 30 }, { id: "aco", precoMedio: 10 }],
    movEstoque: [
      { id: "e1", obraId: "alameda", materialId: "cim", tipo: "entrada", qtd: 100, valorUnit: 32.5, data: "2026-10-01" },
      { id: "e2", obraId: "alameda", materialId: "aco", tipo: "entrada", qtd: 50, valorUnit: 10, data: "2026-10-01" },
    ],
  });
  const contar = (data, contagens, extra = {}) => applyStockCommand(data, {
    type: STOCK_COMMAND.INVENTORY_SUBMITTED, idempotencyKey: `inventario-${extra.id || "i1"}`,
    actorId: "u1", actorName: "Engenheiro QA", actorRole: extra.role || "engenheiro",
    payload: { inventory: { id: extra.id || "i1", obraId: "alameda", data: "2026-11-04", motivo: extra.motivo ?? "Contagem mensal", contagens } },
  }, "2026-11-05T12:00:00.000Z");
  const decidir = (data, aprovar, motivo = "", role = "admin") => applyStockCommand(data, {
    type: STOCK_COMMAND.INVENTORY_DECIDED, idempotencyKey: "inventario-decisao", actorId: "adm", actorName: "Admin QA", actorRole: role,
    payload: { inventarioId: "i1", aprovar, motivo },
  }, "2026-11-05T13:00:00.000Z");
  const saldo = (data, materialId) => calcSaldos(data.movEstoque)[`alameda|${materialId}`] || 0;

  it("contagem com falta pequena aplica na hora: saldo bate com a contagem e o valor é o custo médio", () => {
    const r = contar(base(), [{ materialId: "cim", contado: 96 }, { materialId: "aco", contado: 52 }]);
    expect(r.ok).toBe(true);
    const inv = r.data.inventarios[0];
    expect(inv).toMatchObject({ status: "aplicado", itensComDiferenca: 2, valorFaltas: 130, valorSobras: 20, valorDiferencas: 150, criadoPor: "Engenheiro QA" });
    expect(inv.linhas[0]).toEqual({ materialId: "cim", saldoSistema: 100, contado: 96, diferenca: -4, valorUnit: 32.5 });
    expect(saldo(r.data, "cim")).toBe(96);
    expect(saldo(r.data, "aco")).toBe(52);
    expect(r.data.movEstoque.filter(m => m.inventarioId === "i1").map(m => [m.tipo, m.qtd])).toEqual([["ajuste_saida", 4], ["ajuste", 2]]);
  });

  it("diferença de R$ 3.250 está dentro da alçada de R$ 5.000 e aplica direto", () => {
    const r = contar(base(), [{ materialId: "cim", contado: 0 }]);
    expect(r.data.inventarios[0]).toMatchObject({ status: "aplicado", valorDiferencas: 3250 });
  });

  it("acima da alçada: fica pendente, bloqueia nova contagem e só o Administrador decide", () => {
    const grande = { ...base(), movEstoque: [...base().movEstoque, { id: "e3", obraId: "alameda", materialId: "cim", tipo: "entrada", qtd: 100, valorUnit: 32.5, data: "2026-10-02" }] };
    const r = contar(grande, [{ materialId: "cim", contado: 0 }]);
    expect(r.data.inventarios[0]).toMatchObject({ status: "aguardando_aprovacao", valorDiferencas: 6500 });
    expect(saldo(r.data, "cim")).toBe(200);
    expect(contar(r.data, [{ materialId: "aco", contado: 50 }], { id: "i2" }).reason).toMatch(/aguardando o Administrador/);
    expect(decidir(r.data, true, "", "engenheiro").reason).toMatch(/Somente o Administrador/);
    expect(decidir(r.data, false).reason).toMatch(/motivo da recusa/);
    const recusado = decidir(r.data, false, "Recontar o depósito");
    expect(recusado.data.inventarios[0]).toMatchObject({ status: "rejeitado", motivoDecisao: "Recontar o depósito", decididoPor: "Admin QA" });
    expect(saldo(recusado.data, "cim")).toBe(200);
    const aprovado = decidir(r.data, true);
    expect(aprovado.data.inventarios[0].status).toBe("aplicado");
    expect(saldo(aprovado.data, "cim")).toBe(0);
    // O Administrador aplica direto, sem fila.
    expect(contar(grande, [{ materialId: "cim", contado: 0 }], { role: "admin" }).data.inventarios[0].status).toBe("aplicado");
  });

  it("aprovação recusada se o estoque mudou e a falta não cabe mais", () => {
    const grande = { ...base(), movEstoque: [...base().movEstoque, { id: "e3", obraId: "alameda", materialId: "cim", tipo: "entrada", qtd: 100, valorUnit: 32.5, data: "2026-10-02" }] };
    const r = contar(grande, [{ materialId: "cim", contado: 0 }]);
    const consumido = { ...r.data, movEstoque: [...r.data.movEstoque, { id: "c1", obraId: "alameda", materialId: "cim", tipo: "consumo", qtd: 50 }] };
    expect(decidir(consumido, true).reason).toMatch(/mudou desde a contagem/);
  });

  it("valida a contagem: motivo nas diferenças, material, quantidade, data e duplicidade", () => {
    expect(contar(base(), [{ materialId: "cim", contado: 90 }], { motivo: "" }).reason).toMatch(/motivo das diferenças/);
    expect(contar(base(), [{ materialId: "cim", contado: 100 }], { motivo: "" }).data.inventarios[0]).toMatchObject({ status: "aplicado", itensComDiferenca: 0 });
    expect(contar(base(), [{ materialId: "xx", contado: 1 }]).reason).toMatch(/não existe no cadastro/);
    expect(contar(base(), [{ materialId: "cim", contado: -1 }]).reason).toMatch(/zero ou mais/);
    expect(contar(base(), [{ materialId: "cim", contado: 1 }, { materialId: "cim", contado: 2 }]).reason).toMatch(/duas vezes/);
    expect(contar(base(), []).reason).toMatch(/ao menos um material/);
  });

  it("ajuste de inventário não se estorna sozinho", () => {
    const r = contar(base(), [{ materialId: "cim", contado: 96 }]);
    const estorno = applyStockCommand(r.data, { type: STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED, idempotencyKey: "estorno-ajuste-inv",
      payload: { movementId: "i1-cim", reason: "errei" } });
    expect(estorno.reason).toMatch(/nova contagem/);
  });
});
