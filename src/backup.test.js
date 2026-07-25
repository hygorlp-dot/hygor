import { backupKeyFromEnv, createBackupBundle, verifyBackupBundle } from "../server/backup.js";

const key = backupKeyFromEnv(Buffer.alloc(32, 7).toString("base64"));
const rows = [{ key:"principal", updated_at:"2026-07-25T00:00:00Z", value:{ obras:[{ id:"o1", name:"Obra" }], valor:10 } }];

describe("backup criptografado", () => {
  test("preserva e valida inventário sem expor o JSON no arquivo", () => {
    const backup=createBackupBundle({companyId:"arcd",rows,now:"2026-07-25T00:00:00Z",key});
    expect(backup.body.includes(Buffer.from("Obra"))).toBe(false);
    expect(verifyBackupBundle({body:backup.body,key,manifest:backup.manifest})).toMatchObject({ok:true,recordCount:1});
  });
  test("rejeita chave inválida e alteração no arquivo", () => {
    expect(()=>backupKeyFromEnv("invalida")).toThrow("32 bytes");
    const backup=createBackupBundle({companyId:"arcd",rows,key}); backup.body[backup.body.length-1]^=1;
    expect(()=>verifyBackupBundle({body:backup.body,key,manifest:backup.manifest})).toThrow();
  });
});
