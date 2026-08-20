import { describe, expect, it } from "vitest";
import { employeeComplianceStatus } from "./compliance";

describe("employeeComplianceStatus", () => {
  it("lista ASO vencido pelo nome", () => {
    expect(employeeComplianceStatus({ examExpiresAt: "2026-01-01" }, "2026-08-20").expired)
      .toEqual(["Exame ocupacional (ASO)"]);
  });

  it("lista treinamento NR vencido pelo label do catálogo", () => {
    const employee = { trainings: { nr35: { expiresAt: "2026-01-01" } } };
    expect(employeeComplianceStatus(employee, "2026-08-20").expired)
      .toEqual(["NR-35 · Trabalho em altura"]);
  });

  it("não lista nada quando tudo está dentro da validade", () => {
    const employee = { examExpiresAt: "2027-01-01", trainings: { nr35: { expiresAt: "2027-01-01" } } };
    expect(employeeComplianceStatus(employee, "2026-08-20").expired).toEqual([]);
  });

  it("ignora datas vazias (documento nunca preenchido não é 'vencido')", () => {
    expect(employeeComplianceStatus({}, "2026-08-20").expired).toEqual([]);
  });
});
