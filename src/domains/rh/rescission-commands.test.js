import { describe, expect, it } from "vitest";
import {
  applyRescissionCommand,
  RESCISSION_COMMAND,
  rescissionCommandObraId,
} from "./rescission-commands.js";

const base = () => ({
  employees:[{ id:"emp-1", name:"José", obra:"obra-1" }],
  obras:[{ id:"obra-1", name:"Obra A" }],
  rescisoes:[],
  fechamentosFinanceiros:[],
});
const raw = overrides => ({
  id:"resc-1", empId:"emp-1", empName:"José", admissao:"2026-01-01",
  demissao:"2026-07-28", valorMensal:3000, diasNoMes:10,
  tipo:"sem_justa_causa", incluirSaldo:true, incluir13:true,
  incluirFerias:true, incluirAviso:false, descAdiantamento:0,
  descOutros:0, ...overrides,
});
const command = (type, payload, expectedVersion) => ({
  type, payload, expectedVersion,
  idempotencyKey:`rescission-command-${type}`,
  actorId:"rh-1", actorName:"RH",
});

describe("comandos de rescisão trabalhista", () => {
  it("recalcula e vincula a obra pelo funcionário no servidor", () => {
    const cmd = command(RESCISSION_COMMAND.PAYROLL_RESCISSION_CREATED, {
      rescission:raw({ totalLiquido:999999, obraId:"obra-inventada" }),
    });
    const result = applyRescissionCommand(base(), cmd, "2026-07-28T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.rescisoes[0]).toMatchObject({
      id:"resc-1", obraId:"obra-1", status:"ativa", version:1,
      createdById:"rh-1",
    });
    expect(result.data.rescisoes[0].totalLiquido).toBeCloseTo(5083.33, 2);
    expect(rescissionCommandObraId(base(), cmd)).toBe("obra-1");
  });

  it("bloqueia valores inválidos e períodos financeiros fechados", () => {
    const negative = applyRescissionCommand(base(), command(
      RESCISSION_COMMAND.PAYROLL_RESCISSION_CREATED,
      { rescission:raw({ valorMensal:-1 }) },
    ));
    expect(negative.reason).toMatch(/não podem ser negativos/i);

    const closed = {
      ...base(),
      fechamentosFinanceiros:[{
        status:"fechado", dataInicio:"2026-07-01", dataFim:"2026-07-31",
      }],
    };
    const result = applyRescissionCommand(closed, command(
      RESCISSION_COMMAND.PAYROLL_RESCISSION_CREATED,
      { rescission:raw() },
    ));
    expect(result.reason).toMatch(/período financeiro/i);
  });

  it("cancela sem apagar e exige a versão vigente", () => {
    const created = applyRescissionCommand(base(), command(
      RESCISSION_COMMAND.PAYROLL_RESCISSION_CREATED,
      { rescission:raw() },
    ), "2026-07-28T12:00:00.000Z");
    const stale = applyRescissionCommand(created.data, command(
      RESCISSION_COMMAND.PAYROLL_RESCISSION_CANCELLED,
      { rescissionId:"resc-1", reason:"Cadastro duplicado" },
      0,
    ));
    expect(stale.reason).toMatch(/alterada por outra pessoa/i);

    const cancelled = applyRescissionCommand(created.data, command(
      RESCISSION_COMMAND.PAYROLL_RESCISSION_CANCELLED,
      { rescissionId:"resc-1", reason:"Cadastro duplicado" },
      1,
    ), "2026-07-28T13:00:00.000Z");
    expect(cancelled.ok).toBe(true);
    expect(cancelled.data.rescisoes).toHaveLength(1);
    expect(cancelled.data.rescisoes[0]).toMatchObject({
      status:"cancelada", version:2, motivoCancelamento:"Cadastro duplicado",
      canceladoPorId:"rh-1",
    });
  });

  it("impede cancelamento conciliado", () => {
    const data = {
      ...base(),
      rescisoes:[{ ...raw(), obraId:"obra-1", status:"ativa", version:1, transacaoId:"pix-1" }],
    };
    const result = applyRescissionCommand(data, command(
      RESCISSION_COMMAND.PAYROLL_RESCISSION_CANCELLED,
      { rescissionId:"resc-1", reason:"Correção" },
      1,
    ));
    expect(result.reason).toMatch(/desfaça a conciliação/i);
  });
});
