import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SEC-002 — limite de tentativas compartilhado", () => {
  const sql=fs.readFileSync(path.join(process.cwd(),"migrations","20260726_auth_rate_limit.sql"),"utf8");
  const successSql=fs.readFileSync(path.join(process.cwd(),"migrations","20260727_auth_rate_limit_success.sql"),"utf8");
  const api=fs.readFileSync(path.join(process.cwd(),"api","data.js"),"utf8");
  const productionMigration=fs.readFileSync(path.join(process.cwd(),"scripts","apply-financial-shadow.mjs"),"utf8");

  it("persiste somente um hash do sujeito e aplica bloqueio atômico",()=>{
    expect(sql).toContain("subject_hash text not null");
    expect(sql).toContain("primary key (company_id, subject_hash)");
    expect(sql).toContain("on conflict(company_id,subject_hash) do update");
    expect(sql).toContain("auth_rate_limit_failure");
    expect(sql).toContain("p_limit integer default 8");
    expect(sql).toContain("blocked_until-now()");
  });

  it("não expõe as RPCs SECURITY DEFINER ao navegador",()=>{
    expect(sql).toContain("revoke all on function public.auth_rate_limit_status(text,text) from public, anon, authenticated");
    expect(sql).toContain("revoke all on function public.auth_rate_limit_failure(text,text,integer,integer) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.auth_rate_limit_status(text,text) to service_role");
    expect(sql).toContain("grant execute on function public.auth_rate_limit_failure(text,text,integer,integer) to service_role");
    expect(successSql).toContain("revoke all on function public.auth_rate_limit_success(text,text)");
    expect(successSql).toContain("grant execute on function public.auth_rate_limit_success(text,text)");
  });

  it("limita PIN e e-mail, mas não bloqueia sessão JWT válida pelo IP",()=>{
    expect(api).toContain('rateLimitCentral(ip,"status")');
    expect(api).toContain('await rateLimitCentral(ip,"failure")');
    expect(api).toContain('const usaPin=!accessToken');
    expect(api).toContain('rateLimitCentral(authSubject,"status")');
    expect(api).toContain('rateLimitCentral(authSubject,"failure")');
    expect(api).toContain('rateLimitCentral(authSubject,"success")');
    expect(api).toContain('crypto.createHash("sha256")');
  });

  it("aplica as RPCs idempotentes no gate de produção",()=>{
    expect(productionMigration).toContain("../migrations/20260726_auth_rate_limit.sql");
    expect(productionMigration).toContain("../migrations/20260727_auth_rate_limit_success.sql");
  });
});
