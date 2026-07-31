import { describe,expect,it,vi } from "vitest";
import { executeReconciliationWithRetry } from "./reconciliation-execution.js";

describe("persistência concorrente da conciliação",()=>{
  it("reexecuta sobre a versão atual e salva sem duplicar",async()=>{
    let version=1;
    const execute=vi.fn(payload=>({data:{...payload,done:true},resumo:{ok:true}}));
    const persist=vi.fn(async()=>({applied:++version>=4,updatedAt:`v${version}`}));
    const reload=vi.fn(async()=>({payload:{version},updatedAt:`v${version}`}));
    const result=await executeReconciliationWithRetry({
      initial:{payload:{version:1},updatedAt:"v1"},execute,persist,reload,
    });
    expect(result.kind).toBe("saved");
    expect(result.attempts).toBe(3);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("encerra como idempotente se a primeira tentativa foi gravada por outra resposta",async()=>{
    const result=await executeReconciliationWithRetry({
      initial:{payload:{},updatedAt:"v1"},
      execute:payload=>payload.saved?{idempotent:true,data:payload,resumo:{ok:true}}:{data:{saved:true},resumo:{ok:true}},
      persist:async()=>({applied:false}),
      reload:async()=>({payload:{saved:true},updatedAt:"v2"}),
    });
    expect(result.kind).toBe("idempotent");
    expect(result.attempts).toBe(2);
  });

  it("retorna ocupado somente depois do limite",async()=>{
    const result=await executeReconciliationWithRetry({
      initial:{payload:{},updatedAt:"v1"},execute:()=>({data:{},resumo:{ok:true}}),
      persist:async()=>({applied:false}),reload:async()=>({payload:{},updatedAt:"v2"}),maxAttempts:3,
    });
    expect(result).toMatchObject({kind:"busy",attempts:3});
  });
});
