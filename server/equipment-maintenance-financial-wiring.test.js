import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {OPERATIONAL_COMMAND} from "../src/domains/sync/operational-commands.js";
import {FINANCIAL_OPERATIONAL_COMMANDS,requiresFinancialOperationalPersistence} from "./operational-command-persistence.js";

describe("FIN 9.6 — cancelamento de manutenção e DRE",()=>{
  const calculations=readFileSync("src/domains/equipamentos/calculations.js","utf8");
  const commands=[
    OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,
    OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_CANCELLED,
    OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_COMMERCIAL_OVERRIDDEN,
    OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CANCELLED,
  ];

  it("o comando de cancelamento participa do conjunto financeiro protegido",()=>{
    for(const command of commands)expect(FINANCIAL_OPERATIONAL_COMMANDS.has(command)).toBe(true);
  });

  it("continua audit-only porque não cria título nem movimenta banco",()=>{
    for(const command of commands){
      expect(requiresFinancialOperationalPersistence(command,FINANCIAL_OPERATIONAL_COMMANDS)).toBe(false);
    }
  });

  it("o cálculo financeiro exclui registros cancelados",()=>{
    expect(calculations).toContain('m.status!=="cancelada"');
  });
});
