import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { RENTAL_COMMAND_ROLES } from "../src/domains/equipamentos/rental-command-roles.js";
import { canRunRentalCommand, RENTAL_ACTION_COMMAND, rentalRowActions } from "../src/domains/equipamentos/rental-actions.js";
import { buildRentalRows } from "../src/domains/equipamentos/rental-operations.js";
import { resolveRentalPeriod } from "../src/domains/equipamentos/rental-period.js";
import { buildRentalData, HOJE } from "../src/domains/equipamentos/rental-operations.fixture.js";
import { authorizeOperationalCommand, OPERATIONAL_COMMAND_ROLES } from "../api/data.js";
import { validateOperationalCommandScope } from "./operational-command-policy.js";

// A Central de locações só oferece o que o servidor aceitaria, pelas MESMAS
// regras: papéis de rental-command-roles.js (fonte única, usada também por
// api/data.js) e escopo de obra de validateOperationalCommandScope. Aqui a
// tela e o servidor são comparados ação por ação, papel por papel, obra por obra.
const ROLES = ["admin", "financeiro", "engenheiro", "engenheiro_auditor", "compras", "rh", "visitante"];
const USER_OBRAS = ["", "ob-a", "ob-b"];

const payloadFor = (type, rental) => {
  if (type === OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED) return { rental: { id: rental.id, obraId: rental.obraId } };
  if (type === OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED) return { chargeItem: { rentalId: rental.id } };
  if (type === OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_ISSUED) return { invoice: { rentalId: rental.id } };
  if (type === OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED) return { invoiceId: `inv-${rental.id}` };
  return { rentalId: rental.id };
};

const serverAccepts = (data, user, rental, type) => {
  const authorization = authorizeOperationalCommand(type, user.role);
  if (!authorization.ok) return false;
  return validateOperationalCommandScope({ user, data, command: { type, payload: payloadFor(type, rental) } }).ok;
};

const dataWithInvoices = () => {
  const data = buildRentalData();
  data.rentalInvoices = [...data.locacoesEquip.map(rental => ({ id: `inv-${rental.id}`, rentalId: rental.id, workId: rental.obraId, status: "issued" }))];
  return data;
};

describe("papéis dos comandos de locação: uma única fonte", () => {
  Object.entries(RENTAL_COMMAND_ROLES).forEach(([type, roles]) => {
    it(`${type} no servidor usa exatamente a tabela compartilhada`, () => {
      expect([...OPERATIONAL_COMMAND_ROLES[type]].sort()).toEqual([...roles].sort());
    });
  });
  it("toda ação da tela aponta para um comando coberto pela tabela", () => {
    Object.values(RENTAL_ACTION_COMMAND).forEach(type => expect(RENTAL_COMMAND_ROLES[type], type).toBeTruthy());
  });
});

describe("tela x servidor: mesma resposta para cada ação, papel e obra", () => {
  const data = dataWithInvoices();
  const rentals = data.locacoesEquip.filter(rental => rental.obraId);

  Object.entries(RENTAL_ACTION_COMMAND).forEach(([kind, type]) => {
    it(`ação "${kind}" (${type})`, () => {
      ROLES.forEach(role => USER_OBRAS.forEach(obraId => rentals.forEach(rental => {
        const user = { id: "u", role, obraId };
        expect(canRunRentalCommand(user, rental, type), `${role}/${obraId || "sem obra"}/${rental.id}`).toBe(serverAccepts(data, user, rental, type));
      })));
    });
  });

  it("toda ação VISÍVEL na tela é aceita pelo servidor (o menu ⋯ e o detalhe não abrem caminho extra)", () => {
    const periodo = resolveRentalPeriod({ preset: "tudo" }, { hoje: HOJE, rentals: data.locacoesEquip });
    const rows = buildRentalRows(data, { periodo, hoje: HOJE });
    let visible = 0;
    ROLES.forEach(role => USER_OBRAS.forEach(obraId => rows.forEach(row => {
      const user = { id: "u", role, obraId };
      rentalRowActions(row, user).forEach(action => {
        visible += 1;
        expect(serverAccepts(data, user, row.rental, action.command), `${role}/${obraId || "sem obra"}/${row.id}/${action.id}`).toBe(true);
      });
    })));
    expect(visible).toBeGreaterThan(50);
  });

  it("perfis sem permissão não veem nenhuma ação", () => {
    const periodo = resolveRentalPeriod({ preset: "tudo" }, { hoje: HOJE, rentals: data.locacoesEquip });
    buildRentalRows(data, { periodo, hoje: HOJE }).forEach(row => {
      ["rh", "compras", "visitante"].forEach(role => expect(rentalRowActions(row, { id: "u", role }), `${role}/${row.id}`).toEqual([]));
    });
  });
});
