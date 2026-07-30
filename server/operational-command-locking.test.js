import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const api=readFileSync(resolve(process.cwd(),"api/data.js"),"utf8");

describe("serialização sistêmica das mutações da empresa",()=>{
  it("bloqueia e relê a linha antes de calcular qualquer mutação",()=>{
    const start=api.indexOf("const executarMutacaoEmpresaBloqueada=");
    const end=api.indexOf("// Confere o PIN",start);
    const implementation=api.slice(start,end);
    expect(start).toBeGreaterThan(0);
    expect(implementation).toContain("for update");
    expect(implementation.indexOf("for update")).toBeLessThan(
      implementation.indexOf("await mutate("),
    );
    expect(api).toContain("financial_save_with_sync(");
    expect(api).toContain("insert into audit_events(");
  });

  it("mantém a precisão integral do updated_at dentro do PostgreSQL",()=>{
    const start=api.indexOf("const gravarMutacaoNaTransacao=");
    const end=api.indexOf("// Todos os escritores",start);
    const implementation=api.slice(start,end);
    expect(implementation).toContain("select updated_at");
    expect(implementation).toContain("where company_id=${COMPANY} and key=${KEY}");
    expect(implementation).not.toContain("${locked.updated_at}");
  });

  it("desvia todos os comandos operacionais para a fila do banco antes do fallback CAS",()=>{
    const route=api.slice(api.indexOf('if(action==="operational-command")'));
    expect(route.indexOf("if(process.env.POSTGRES_URL_NON_POOLING)")).toBeLessThan(
      route.indexOf("const persistir=async"),
    );
    expect(route).toContain("executarComandoOperacionalBloqueado({");
    expect(route).toContain("projectChangedSectionsPatch(");
    expect(route).toContain("outcome.basePayload,outcome.data");
  });

  it("aplica a mesma serialização ao ponto, conciliação e cadastros legados",()=>{
    const attendance=api.slice(api.indexOf("if(ATTENDANCE_COMMANDS.has(action))"));
    const reconciliation=api.slice(api.indexOf('if(action==="reconciliation-command")'));
    const sections=api.slice(api.indexOf('if (action === "save-sections")'));
    expect(attendance).toContain("executarMutacaoEmpresaBloqueada({");
    expect(reconciliation).toContain("executarMutacaoEmpresaBloqueada({");
    expect(sections).toContain("executarMutacaoEmpresaBloqueada({");
  });
});
