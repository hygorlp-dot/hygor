import { describe, expect, it } from "vitest";
import {
  applyCompanyConfigCommand,
  COMPANY_CONFIG_COMMAND,
} from "./company-config-commands.js";

const base = () => ({
  config:{
    companyName:"ARCD",
    productName:"Obras",
    paymentHolidays:[],
    aliquotaISS:0,
    version:2,
  },
});
const command = (config, expectedVersion = 2) => ({
  type:COMPANY_CONFIG_COMMAND.COMPANY_CONFIG_SAVED,
  idempotencyKey:"company-config-save-0001",
  expectedVersion,
  actorId:"admin-1",
  actorName:"Administrador",
  payload:{ config },
});

describe("comando transacional de configuração da empresa", () => {
  it("normaliza alíquotas, e-mails, feriados e autoria", () => {
    const result = applyCompanyConfigCommand(
      base(),
      command({
        ...base().config,
        hrEmail:" RH@ARCD.COM ",
        approverEmail:"GESTOR@ARCD.COM",
        aliquotaISS:"5",
        aliquotaPIS:"0.65",
        paymentHolidays:["2026-12-25", "2026-12-25"],
      }),
      "2026-07-29T12:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    expect(result.data.config).toMatchObject({
      companyName:"ARCD",
      hrEmail:"rh@arcd.com",
      approverEmail:"gestor@arcd.com",
      aliquotaISS:5,
      aliquotaPIS:0.65,
      paymentHolidays:["2026-12-25"],
      version:3,
      updatedById:"admin-1",
    });
  });

  it("recusa versão vencida, e-mail inválido e alíquota fora da faixa", () => {
    expect(applyCompanyConfigCommand(
      base(),
      command({ ...base().config }, 1),
    ).reason).toMatch(/alteradas por outra pessoa/i);
    expect(applyCompanyConfigCommand(
      base(),
      command({ ...base().config, hrEmail:"invalido" }),
    ).reason).toMatch(/e-mail válidos/i);
    expect(applyCompanyConfigCommand(
      base(),
      command({ ...base().config, aliquotaISS:101 }),
    ).reason).toMatch(/entre 0% e 100%/i);
  });

  it("preserva campos existentes não exibidos no formulário", () => {
    const data = {
      config:{
        ...base().config,
        oneDriveRootUrl:"https://example.test/drive",
        payrollWorkStart:"07:00",
      },
    };
    const result = applyCompanyConfigCommand(
      data,
      command({ companyName:"ARCD Atualizada", productName:"Obras" }),
    );
    expect(result.data.config).toMatchObject({
      companyName:"ARCD Atualizada",
      oneDriveRootUrl:"https://example.test/drive",
      payrollWorkStart:"07:00",
    });
  });
});
