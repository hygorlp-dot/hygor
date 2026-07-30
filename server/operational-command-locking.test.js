import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const api=readFileSync(resolve(process.cwd(),"api/data.js"),"utf8");

describe("serialização dos comandos financeiros operacionais",()=>{
  it("bloqueia e relê a linha antes de aplicar a despesa",()=>{
    const start=api.indexOf("const executarComandoOperacionalFinanceiroBloqueado=");
    const end=api.indexOf("// Confere o PIN",start);
    const implementation=api.slice(start,end);
    expect(start).toBeGreaterThan(0);
    expect(implementation).toContain("for update");
    expect(implementation.indexOf("for update")).toBeLessThan(
      implementation.indexOf("applyOperationalCommand(current"),
    );
    expect(implementation).toContain("financial_save_with_sync(");
    expect(implementation).toContain("buildLegacyFinancialFacts(executed.data)");
  });

  it("desvia o comando para a transação bloqueada antes do retry por snapshot",()=>{
    const route=api.slice(api.indexOf('if(action==="operational-command")'));
    expect(route.indexOf("if(lockedFinancial)")).toBeLessThan(
      route.indexOf("const persistir=async"),
    );
    expect(route).toContain("requiresLockedFinancialOperationalPersistence(");
  });
});
