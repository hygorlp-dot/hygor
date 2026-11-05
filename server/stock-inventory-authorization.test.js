import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { authorizeOperationalCommand } from "../api/data.js";
import { validateOperationalCommandScope } from "./operational-command-policy.js";
import { projectDataForUser } from "./data-projection.js";

// E1.2: inventário com ajuste. Quem mexe no estoque conta; acima da alçada,
// só o Administrador decide. Cada obra só vê e conta o próprio estoque.
describe("inventário: perfil e obra no servidor", () => {
  const data = {
    obras: [{ id: "obra-a" }, { id: "obra-b" }],
    inventarios: [{ id: "i1", obraId: "obra-a", status: "aguardando_aprovacao" }, { id: "i2", obraId: "obra-b", status: "aplicado" }],
  };
  const contar = { type: OPERATIONAL_COMMAND.INVENTORY_SUBMITTED, payload: { inventory: { id: "n", obraId: "obra-a" } } };
  const decidir = { type: OPERATIONAL_COMMAND.INVENTORY_DECIDED, payload: { inventarioId: "i1", aprovar: true } };

  it("financeiro, RH e mestre recebem 403 ao contar; só o admin decide", () => {
    for (const role of ["financeiro", "rh", "mestre", "visualizador"]) expect(authorizeOperationalCommand(contar.type, role)).toMatchObject({ ok: false, status: 403 });
    for (const role of ["admin", "compras", "engenheiro", "engenheiro_auditor"]) expect(authorizeOperationalCommand(contar.type, role)).toEqual({ ok: true });
    for (const role of ["compras", "engenheiro", "engenheiro_auditor", "financeiro"]) expect(authorizeOperationalCommand(decidir.type, role)).toMatchObject({ ok: false, status: 403 });
    expect(authorizeOperationalCommand(decidir.type, "admin")).toEqual({ ok: true });
  });

  it("engenheiro só conta a própria obra e só recebe os inventários dela", () => {
    expect(validateOperationalCommandScope({ user: { id: "u", role: "engenheiro", obraId: "obra-a" }, data, command: contar })).toMatchObject({ ok: true });
    expect(validateOperationalCommandScope({ user: { id: "u", role: "engenheiro", obraId: "obra-b" }, data, command: contar })).toMatchObject({ ok: false });
    expect(projectDataForUser(data, { id: "u", role: "engenheiro", obraId: "obra-a" }).inventarios.map(i => i.id)).toEqual(["i1"]);
    expect(projectDataForUser(data, { id: "f", role: "financeiro" }).inventarios).toBeUndefined();
  });
});
