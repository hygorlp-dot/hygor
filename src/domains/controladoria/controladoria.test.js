import { describe, expect, it } from "vitest";
import { contractBalances, projectCashflow } from "./calculations.js";

describe("controladoria", () => {
  it("projeta caixa sem transformar previsão em realizado", () => {
    const result = projectCashflow([
      {date:"2026-07-01",direction:"saida",amountCents:150},
    ], {openingBalanceCents:100});
    expect(result.capitalNeedCents).toBe(50);
  });

  it("separa saldo não faturado, a receber e recebido", () => {
    const result = contractBalances(
      {id:"c",valueCents:1000},
      [{contractId:"c",valueCents:600}],
      [{contractId:"c",amountCents:200}],
    );
    expect(result.unbilledCents).toBe(400);
    expect(result.openReceivableCents).toBe(400);
  });

  it("preserva arquivados e elimina todas as variantes sem efeito econômico", () => {
    const result = contractBalances(
      {id:"c",valueCents:2000},
      [
        {contractId:"c",valueCents:900,status:"arquivada"},
        {contractId:"c",valueCents:500,status:"CANCELADA"},
      ],
      [
        {contractId:"c",amountCents:350,status:"arquivado"},
        {contractId:"c",amountCents:100,status:"ESTORNADA"},
      ],
    );
    expect(result).toMatchObject({
      billedCents:900,receivedCents:350,openReceivableCents:550,unbilledCents:1100,
    });
  });
});
