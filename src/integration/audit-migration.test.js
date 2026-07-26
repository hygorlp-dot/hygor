import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("DATA-001 — auditoria append-only",()=>{
  const sql=fs.readFileSync(path.join(process.cwd(),"migrations","20260725_append_only_audit.sql"),"utf8");
  const api=fs.readFileSync(path.join(process.cwd(),"api","data.js"),"utf8");

  it("grava blob e evento na mesma função transacional",()=>{
    expect(sql).toContain("update company_app_data set value=p_value");
    expect(sql).toContain("insert into audit_events");
    expect(sql).toContain("for update");
    expect(api).toContain('db.rpc("company_save_with_audit"');
  });

  it("impede alteração posterior e reserva a RPC à API",()=>{
    expect(sql).toContain("audit_events_no_update");
    expect(sql).toContain("audit_events_no_delete");
    expect(sql).toContain("revoke all on function public.company_save_with_audit(text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.company_save_with_audit(text,text,timestamptz,jsonb,text,text,uuid,text,jsonb,jsonb) to service_role");
  });
});
