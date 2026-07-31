import { describe, expect, it } from "vitest";
import { paymentFriday, paymentWeekRange } from "./payment-week";

describe("semana de pagamento de terceirizados", () => {
  it("aponta dias úteis para a sexta-feira da mesma semana", () => {
    expect(paymentFriday(0, new Date(2026, 6, 27, 10))).toBe("2026-07-31");
    expect(paymentFriday(0, new Date(2026, 6, 31, 10))).toBe("2026-07-31");
  });

  it("mantém a sexta anterior durante o fim de semana", () => {
    expect(paymentFriday(0, new Date(2026, 7, 1, 10))).toBe("2026-07-31");
    expect(paymentFriday(0, new Date(2026, 7, 2, 10))).toBe("2026-07-31");
  });

  it("navega semanas e devolve o intervalo de segunda a sexta", () => {
    expect(paymentFriday(1, new Date(2026, 6, 31, 10))).toBe("2026-08-07");
    expect(paymentFriday(-1, new Date(2026, 6, 31, 10))).toBe("2026-07-24");
    expect(paymentWeekRange("2026-07-31")).toEqual({
      start: "2026-07-27",
      end: "2026-07-31",
    });
    expect(paymentWeekRange("invalida")).toBeNull();
  });
});
