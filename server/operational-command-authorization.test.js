import { describe, expect, it } from "vitest";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";
import {
  authorizeFinancialCommand, authorizeOperationalCommand,
  FINANCIAL_COMMAND_ROLES, FINANCIAL_COMMANDS, OPERATIONAL_COMMAND_ROLES,
} from "../api/data.js";

// Universo de papéis conhecidos, extraído dos dois mapas de autorização mais
// um papel inexistente ("visitante") para representar um ator totalmente de
// fora do sistema. Qualquer papel fora da lista de permissão de um comando
// precisa ser rejeitado com 403 - é a fronteira 403/perfil que o gate de
// segurança P0 exige (ver docs/MATRIZ_MODULOS_10_10.md).
const ALL_KNOWN_ROLES = [...new Set([
  ...Object.values(OPERATIONAL_COMMAND_ROLES).flat(),
  ...Object.values(FINANCIAL_COMMAND_ROLES).flat(),
  "visitante",
])];

describe("authorizeOperationalCommand - fronteira de papel por comando", () => {
  it("tem uma entrada não-vazia em OPERATIONAL_COMMAND_ROLES para todo comando operacional conhecido", () => {
    // Tripwire: um comando implementado no reducer/enum mas ausente deste
    // mapa falha fechado (400 para todo mundo, inclusive admin) em vez de
    // vazar acesso - mas ainda assim é um bug de disponibilidade que este
    // teste pega antes de chegar em produção. Foi exatamente o caso de
    // EQUIPMENT_RENTAL_CANCELLED/EQUIPMENT_RESERVATION_SAVED/CANCELLED/
    // EQUIPMENT_UNAVAILABILITY_SAVED/CANCELLED, corrigido nesta mesma sessão.
    const semEntrada = Object.values(OPERATIONAL_COMMAND).filter(type => {
      const roles = OPERATIONAL_COMMAND_ROLES[type];
      return !Array.isArray(roles) || roles.length === 0;
    });
    expect(semEntrada).toEqual([]);
  });

  it("rejeita um tipo de comando desconhecido com 400, não 403", () => {
    expect(authorizeOperationalCommand("COMANDO_QUE_NAO_EXISTE", "admin"))
      .toMatchObject({ ok: false, status: 400 });
  });

  // Para cada comando conhecido, todo papel do universo é testado: papéis
  // presentes na lista de permissão devem passar (ok:true), e todo o resto
  // deve ser rejeitado com 403. Isso cobre exaustivamente a fronteira de
  // papel para os ~90 comandos operacionais existentes, não só uma amostra.
  Object.values(OPERATIONAL_COMMAND).forEach(type => {
    const allowedRoles = OPERATIONAL_COMMAND_ROLES[type] || [];
    it(`comando ${type}: permite exatamente ${JSON.stringify(allowedRoles)} e rejeita o resto com 403`, () => {
      ALL_KNOWN_ROLES.forEach(role => {
        const result = authorizeOperationalCommand(type, role);
        if (allowedRoles.includes(role)) {
          expect(result).toMatchObject({ ok: true });
        } else {
          expect(result).toMatchObject({ ok: false, status: 403 });
        }
      });
    });
  });

  it("corrige os 5 comandos de equipamento que ficavam sem entrada (bug de disponibilidade, não de permissão)", () => {
    const antesOrfaos = [
      OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CANCELLED,
      OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED,
      OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_CANCELLED,
      OPERATIONAL_COMMAND.EQUIPMENT_UNAVAILABILITY_SAVED,
      OPERATIONAL_COMMAND.EQUIPMENT_UNAVAILABILITY_CANCELLED,
    ];
    antesOrfaos.forEach(type => {
      expect(authorizeOperationalCommand(type, "admin")).toMatchObject({ ok: true });
      expect(authorizeOperationalCommand(type, "engenheiro")).toMatchObject({ ok: true });
      expect(authorizeOperationalCommand(type, "rh")).toMatchObject({ ok: false, status: 403 });
    });
  });
});

describe("authorizeFinancialCommand - fronteira de papel do motor financeiro canônico", () => {
  it("rejeita um tipo de comando financeiro desconhecido com 400, não 403", () => {
    expect(authorizeFinancialCommand("COMANDO_FINANCEIRO_INEXISTENTE", "admin"))
      .toMatchObject({ ok: false, status: 400 });
  });

  Object.keys(FINANCIAL_COMMAND_ROLES).forEach(type => {
    const allowedRoles = FINANCIAL_COMMAND_ROLES[type];
    it(`comando financeiro ${type}: permite exatamente ${JSON.stringify(allowedRoles)} e rejeita o resto com 403`, () => {
      expect(FINANCIAL_COMMANDS.has(type)).toBe(true);
      ALL_KNOWN_ROLES.forEach(role => {
        const result = authorizeFinancialCommand(type, role);
        if (allowedRoles.includes(role)) {
          expect(result).toMatchObject({ ok: true });
        } else {
          expect(result).toMatchObject({ ok: false, status: 403 });
        }
      });
    });
  });

  it("reserva o fechamento de competência (CLOSE_ACCOUNTING_PERIOD) só ao admin", () => {
    expect(authorizeFinancialCommand("CLOSE_ACCOUNTING_PERIOD", "financeiro")).toMatchObject({ ok: false, status: 403 });
    expect(authorizeFinancialCommand("CLOSE_ACCOUNTING_PERIOD", "admin")).toMatchObject({ ok: true });
  });
});
