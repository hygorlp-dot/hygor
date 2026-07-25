import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("migration da gravação financeira transacional", () => {
  const sql=fs.readFileSync(path.join(process.cwd(),"migrations","002_financial_transactional_projection.up.sql"),"utf8");
  const closingSql=fs.readFileSync(path.join(process.cwd(),"migrations","003_accounting_period_enforcement.up.sql"),"utf8");

  it("mantém blob, sincronização e auditoria na mesma função PostgreSQL", () => {
    expect(sql).toContain("v_sync := financial_sync_legacy_facts");
    expect(sql).toContain("update company_app_data");
    expect(sql).toContain("insert into audit_events");
    expect(sql).toMatch(/begin;[\s\S]+commit;/);
  });

  it("recusa superliquidação de títulos e transações bancárias", () => {
    expect(sql).toContain("Liquidações excedem o valor");
    expect(sql).toContain("Conciliações excedem o valor");
    expect(sql).toContain("bank_transaction_id = bank.id");
  });

  it("recusa baixa negativa e vínculo ativo para baixa estornada", () => {
    expect(sql).toContain("status = 'active' and amount <= 0");
    expect(sql).toContain("settlement.status <> 'active'");
  });

  it("bloqueia criação, liquidação e estorno dentro de período fechado",()=>{
    expect(closingSql).toContain("CREATE_FINANCIAL_TITLE");
    expect(closingSql).toContain("REGISTER_SETTLEMENT");
    expect(closingSql).toContain("REVERSE_SETTLEMENT");
    expect(closingSql).toContain("v_effective_date between starts_on and ends_on");
    expect(closingSql).toContain("Período contábil fechado");
  });

  it("recusa fechamento sobreposto e mantém a migração reaplicável",()=>{
    expect(closingSql).toContain("daterange(starts_on,ends_on,'[]')");
    expect(closingSql).toContain("financial_execute_command_unchecked");
    expect(closingSql).toMatch(/begin;[\s\S]+commit;/);
  });
});
