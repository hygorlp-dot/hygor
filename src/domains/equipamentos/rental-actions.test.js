import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../sync/operational-commands.js";
import {
  canRunRentalCommand, isReadOnlyFor, primaryRowAction, rentalCycleNote, rentalRowActions, rentalTimeline,
} from "./rental-actions.js";
import { applyRentalFilters, buildRentalRows, DEFAULT_FILTERS } from "./rental-operations.js";
import { buildRentalData, HOJE } from "./rental-operations.fixture.js";
import { resolveRentalPeriod } from "./rental-period.js";

const SETEMBRO = { preset: "mes", ym: "2026-09" };
const context = (data, periodState = SETEMBRO, filters = DEFAULT_FILTERS) => {
  const periodo = resolveRentalPeriod(periodState, { hoje: HOJE, rentals: data.locacoesEquip });
  const rows = buildRentalRows(data, { periodo, hoje: HOJE });
  return { periodo, rows, filtered: applyRentalFilters(rows, filters, periodo) };
};
const admin = { id: "u1", role: "admin" };
const financeiro = { id: "u2", role: "financeiro" };

describe("ações da linha e permissões", () => {
  const rowOf = (id, data = buildRentalData()) => context(data, { preset: "tudo" }).rows.find(row => row.id === id);
  const labels = (row, user) => rentalRowActions(row, user).map(action => action.label);

  it("administrador vê todas as ações aplicáveis; a ação principal é 'Medir competência'", () => {
    const actions = rentalRowActions(rowOf("L1"), admin);
    expect(actions.map(action => action.id)).toEqual(expect.arrayContaining(["avancar:pickup_requested", "medir", "cobranca", "faturar", "aditivo", "editar", "excluir"]));
    expect(primaryRowAction(actions)?.id).toBe("medir");
    expect(actions.find(action => action.id === "excluir")).toMatchObject({ danger: true, group: "admin" });
    expect(actions.filter(action => action.danger)).toHaveLength(1);
  });

  it("locação cancelada não oferece ação alguma de alteração", () => {
    expect(rentalRowActions(rowOf("L5"), admin)).toEqual([]);
  });

  it("locação encerrada só mantém cobrança (medir/cobrança) e vínculo de recebimento", () => {
    const encerrada = labels(rowOf("L2"), admin);
    expect(encerrada).toEqual(expect.arrayContaining(["Medir competência", "Adicionar cobrança", "Editar locação", "Excluir locação"]));
    expect(encerrada).not.toContain("Prorrogar / renovar");
  });

  it("lista 'vincular recebimento' para cada fatura com saldo", () => {
    expect(labels(rowOf("L6"), financeiro)).toContain("Vincular recebimento · FAT-202609-002");
    expect(labels(rowOf("L2"), financeiro).some(label => label.startsWith("Vincular recebimento"))).toBe(false);
  });

  it("financeiro altera cobrança e contrato; engenheiro só contrato; outros perfis só consultam", () => {
    const eng = { id: "u3", role: "engenheiro" };
    expect(labels(rowOf("L1"), eng)).toEqual(expect.arrayContaining(["Editar locação", "Excluir locação"]));
    expect(labels(rowOf("L1"), eng)).not.toContain("Medir competência");
    expect(labels(rowOf("L1"), { role: "rh" })).toEqual([]);
    expect(labels(rowOf("L1"), null)).toEqual([]);
    expect(isReadOnlyFor(rowOf("L1"), { role: "rh" })).toBe(true);
    expect(isReadOnlyFor(rowOf("L1"), eng)).toBe(false);
  });

  it("perfil vinculado a uma obra só age nas locações da própria obra", () => {
    const daObraA = { id: "u4", role: "financeiro", obraId: "ob-a" };
    expect(canRunRentalCommand(daObraA, rowOf("L1").rental, OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED)).toBe(true);
    expect(canRunRentalCommand(daObraA, rowOf("L6").rental, OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED)).toBe(false);
    expect(labels(rowOf("L6"), daObraA)).toEqual([]);
  });

  it("não oferece o que o ciclo de vida não permite (condições idênticas às da lista antiga)", () => {
    const data = buildRentalData();
    data.locacoesEquip[0].lifecycleState = "ready_for_dispatch";
    data.locacoesEquip[0].quantidade = 3;
    expect(labels(rowOf("L1", data), admin)).toEqual(expect.arrayContaining(["Checklist: Expedição", "Expedição parcial"]));
    expect(labels(rowOf("L1", data), admin)).not.toContain("Prorrogar / renovar");
    expect(labels(rowOf("L1", data), admin)).not.toContain("Encerrar");
  });

  it("registro legado (sem ciclo de vida) em aberto pode ser encerrado", () => {
    expect(labels(rowOf("L7"), admin)).toContain("Encerrar");
  });
});

describe("linha do tempo do detalhe", () => {
  it("junta início, ciclo, checklists, aditivos e encerramento em ordem cronológica", () => {
    const data = buildRentalData();
    Object.assign(data.locacoesEquip[0], {
      lifecycleHistory: [{ at: "2026-09-02T10:00:00Z", to: "delivered", actorName: "Ana" }],
      rentalCheckpoints: [{ type: "delivery", status: "recorded", date: "2026-09-02", responsible: "Ana", quantity: 1 }],
      rentalAmendments: [{ type: "extension", newEndDate: "2026-09-18", reason: "Obra atrasou", createdAt: "2026-09-10T09:00:00Z" }],
    });
    const row = context(data).rows.find(item => item.id === "L1");
    const labels = rentalTimeline(row).map(item => item.label);
    expect(labels).toEqual(["Início da locação", "Ciclo: Entregue", "Checklist: Entrega", "Prorrogação"]);
    expect(rentalTimeline(context(data).rows.find(item => item.id === "L5")).at(-1)).toMatchObject({ label: "Locação excluída", detail: "Pedido duplicado" });
  });
});

describe("em andamento sem ação de ciclo: o motivo é explicado, a regra legada não muda", () => {
  const withScheduledEnd = () => {
    const data = buildRentalData();
    // término já programado (fim futuro): a data diz "em andamento", a regra legada de ciclo não.
    Object.assign(data.locacoesEquip[0], { fim: "2026-09-30", plannedEndDate: "" });
    return data;
  };
  const rowOf = (id, data) => context(data, { preset: "tudo" }).rows.find(row => row.id === id);

  it("aparece 'Em andamento' mas sem ações de ciclo, com a nota de término programado", () => {
    const row = rowOf("L1", withScheduledEnd());
    expect(row.situacao).toBe("em_andamento");
    expect(row.emAberto).toBe(false);
    expect(rentalCycleNote(row, admin)).toBe("Ciclo indisponível — término programado em 30/09/2026");
    const ids = rentalRowActions(row, admin).map(action => action.id);
    expect(ids).not.toEqual(expect.arrayContaining(["aditivo"]));
    expect(ids.some(id => id.startsWith("avancar:"))).toBe(false);
    expect(ids).not.toContain("encerrar");
    // a cobrança continua disponível: a nota não esconde o que a regra permite
    expect(ids).toEqual(expect.arrayContaining(["medir", "cobranca", "editar"]));
  });

  it("não inventa a nota onde ela não se aplica", () => {
    const data = withScheduledEnd();
    expect(rentalCycleNote(rowOf("L7", data), admin)).toBe(""); // sem fim: o ciclo existe
    expect(rentalCycleNote(rowOf("L2", data), admin)).toBe(""); // encerrada
    expect(rentalCycleNote(rowOf("L5", data), admin)).toBe(""); // cancelada
    expect(rentalCycleNote(rowOf("L1", data), { role: "rh" })).toBe(""); // quem não opera o contrato não tinha essas ações
  });
});

describe("cada ação carrega o comando que dispara", () => {
  it("toda ação visível aponta para um comando com papéis definidos", () => {
    const row = context(buildRentalData(), { preset: "tudo" }).rows.find(item => item.id === "L1");
    rentalRowActions(row, admin).forEach(action => {
      expect(action.command, action.id).toBeTruthy();
      expect(canRunRentalCommand(admin, row.rental, action.command)).toBe(true);
    });
  });
});
