import {describe,expect,it} from "vitest";
import {decryptAiSecret,encryptAiSecret} from "./ai-secret.js";

describe("criptografia independente da IA",()=>{
  it("abre a configuração com a chave dedicada após trocar a service role",()=>{
    const value=encryptAiSecret("gemini-secret",{
      secret:"ai-key",company:"arcd",keyVersion:"ai-v1",
    });
    expect(decryptAiSecret(value,{
      primarySecret:"ai-key",legacySecret:"service-role-nova",company:"arcd",
    })).toEqual({plainText:"gemini-secret",source:"ai-v1"});
  });

  it("mantém leitura do formato legado para permitir migração",()=>{
    const value=encryptAiSecret("legado",{
      secret:"service-role-antiga",company:"arcd",keyVersion:undefined,
    });
    expect(decryptAiSecret(value,{
      primarySecret:"ai-key",legacySecret:"service-role-antiga",company:"arcd",
    })).toEqual({plainText:"legado",source:"legacy-service-role"});
  });
});
