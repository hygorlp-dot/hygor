import { describe, expect, it } from "vitest";
import { rentalCommercialOverrideStatus } from "./rental-commercial.js";

describe("rentalCommercialOverrideStatus", () => {
  const base = {
    rentalChargeItems: [],
    rentalInvoices: [],
    rentalInvoiceReceipts: [],
  };

  it("permite substituir antes de existir efeito financeiro", () => {
    expect(rentalCommercialOverrideStatus(base, "L1").allowed).toBe(true);
  });

  it("bloqueia quando existe medição ou linha de cobrança ativa", () => {
    const data = { ...base, rentalChargeItems: [{ id: "c1", rentalId: "L1", status: "open" }] };
    const r = rentalCommercialOverrideStatus(data, "L1");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/medição|linha de cobrança/i);
  });

  it("ignora linha de cobrança cancelada", () => {
    const data = { ...base, rentalChargeItems: [{ id: "c1", rentalId: "L1", status: "cancelled" }] };
    expect(rentalCommercialOverrideStatus(data, "L1").allowed).toBe(true);
  });

  it("bloqueia quando existe fatura ativa", () => {
    const data = { ...base, rentalInvoices: [{ id: "f1", rentalId: "L1", status: "issued" }] };
    expect(rentalCommercialOverrideStatus(data, "L1").reason).toMatch(/fatura/i);
  });

  it("bloqueia quando existe recebimento vinculado", () => {
    const data = {
      ...base,
      rentalInvoices: [{ id: "f1", rentalId: "L1", status: "paid" }],
      rentalInvoiceReceipts: [{ id: "r1", invoiceId: "f1" }],
    };
    expect(rentalCommercialOverrideStatus(data, "L1").reason).toMatch(/recebimento/i);
  });
});
