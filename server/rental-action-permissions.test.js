import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import { RENTAL_ACTION_ROLES } from "../src/domains/equipamentos/rental-operations.js";
import { OPERATIONAL_COMMAND_ROLES } from "../api/data.js";

// A tela da Central de locações só oferece os botões que o servidor aceitaria
// (RENTAL_ACTION_ROLES é um ESPELHO de OPERATIONAL_COMMAND_ROLES). Este teste
// impede que os dois divirjam em silêncio: se alguém mudar o papel de um
// comando de locação no servidor, a tela precisa acompanhar.
const sorted = roles => [...roles].sort();

describe("RENTAL_ACTION_ROLES espelha OPERATIONAL_COMMAND_ROLES", () => {
  const contrato = [
    OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED, OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,
    OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CANCELLED, OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,
    OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED, OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,
    OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_UNIT_REPLACED,
  ];
  const cobranca = [
    OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED, OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED,
    OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_ISSUED, OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_RECEIPT_LINKED,
  ];

  contrato.forEach(type => it(`contrato · ${type}`, () => {
    expect(sorted(OPERATIONAL_COMMAND_ROLES[type])).toEqual(sorted(RENTAL_ACTION_ROLES.contrato));
  }));
  cobranca.forEach(type => it(`cobrança · ${type}`, () => {
    expect(sorted(OPERATIONAL_COMMAND_ROLES[type])).toEqual(sorted(RENTAL_ACTION_ROLES.cobranca));
  }));
});
