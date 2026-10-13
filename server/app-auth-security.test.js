import {describe,expect,it} from "vitest";
import {APP_PIN_PREFIX,applyPersistentAuthRateLimit,authRateLimitSubject,hashAppPin,hashLegacyAppPin,verifyAppPin} from "./app-auth-security.js";

describe("segurança das credenciais operacionais",()=>{
  it("gera scrypt com salt individual e comparação segura",()=>{
    const first=hashAppPin("123456"),second=hashAppPin("123456");
    expect(first).toMatch(new RegExp(`^${APP_PIN_PREFIX}\\$`));
    expect(first).not.toBe(second);
    expect(verifyAppPin("123456",first)).toEqual({ok:true,needsUpgrade:false});
    expect(verifyAppPin("654321",first).ok).toBe(false);
  });

  it("aceita SHA-256 legado somente para sinalizar migração",()=>{
    const legacy=hashLegacyAppPin("2468");
    expect(verifyAppPin("2468",legacy)).toEqual({ok:true,needsUpgrade:true});
    expect(verifyAppPin("0000",legacy)).toEqual({ok:false,needsUpgrade:false});
  });

  it("não envia o identificador original à RPC de rate limiting",async()=>{
    const calls=[];
    const db={rpc:async(name,args)=>{calls.push([name,args]);return {data:[{blocked:true,retry_after_seconds:42}],error:null};}};
    await expect(applyPersistentAuthRateLimit(db,{company:"arcd",subject:"api:user-1",action:"status"}))
      .resolves.toEqual({blocked:true,retryAfter:42});
    expect(calls[0][1].p_subject_hash).toBe(authRateLimitSubject("arcd","api:user-1"));
    expect(calls[0][1].p_subject_hash).not.toContain("user-1");
  });

  it("limite e janela próprios só vão na falha; sem eles, a chamada é a de sempre",async()=>{
    const calls=[];
    const db={rpc:async(name,args)=>{calls.push([name,args]);return {data:[{blocked:false,retry_after_seconds:0}],error:null};}};
    await applyPersistentAuthRateLimit(db,{company:"arcd",subject:"s",action:"failure",limit:5,windowSeconds:900});
    await applyPersistentAuthRateLimit(db,{company:"arcd",subject:"s",action:"status",limit:5,windowSeconds:900});
    await applyPersistentAuthRateLimit(db,{company:"arcd",subject:"s",action:"failure"});
    expect(calls[0]).toEqual(["auth_rate_limit_failure",expect.objectContaining({p_limit:5,p_window_seconds:900})]);
    expect(Object.keys(calls[1][1])).toEqual(["p_company_id","p_subject_hash"]);
    expect(Object.keys(calls[2][1])).toEqual(["p_company_id","p_subject_hash"]);
  });
});
