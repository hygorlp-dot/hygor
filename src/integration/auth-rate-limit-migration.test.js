import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SEC-002 — limite de tentativas compartilhado", () => {
  const sql=fs.readFileSync(path.join(process.cwd(),"migrations","20260726_auth_rate_limit.sql"),"utf8");
  const api=fs.readFileSync(path.join(process.cwd(),"api","data.js"),"utf8");

  it("persiste somente um hash do sujeito e aplica bloqueio atômico",()=>{
    expect(sql).toContain("subject_hash text not null");
    expect(sql).toContain("primary key (company_id, subject_hash)");
    expect(sql).toContain("on conflict(company_id,subject_hash) do update");
    expect(sql).toContain("auth_rate_limit_failure");
    expect(sql).toContain("p_limit integer default 8");
  });

  it("não expõe as RPCs SECURITY DEFINER ao navegador",()=>{
    expect(sql).toContain("revoke all on function public.auth_rate_limit_status(text,text) from public, anon, authenticated");
    expect(sql).toContain("revoke all on function public.auth_rate_limit_failure(text,text,integer,integer) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.auth_rate_limit_status(text,text) to service_role");
    expect(sql).toContain("grant execute on function public.auth_rate_limit_failure(text,text,integer,integer) to service_role");
  });

  it("faz a verificação antes da autenticação e registra apenas falhas",()=>{
    expect(api).toContain('rateLimitCentral(ip,"status")');
    expect(api).toContain('await rateLimitCentral(ip,"failure")');
    expect(api).toContain('crypto.createHash("sha256")');
  });
});
