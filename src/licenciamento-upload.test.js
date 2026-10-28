import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {
  LICENSING_UPLOAD_MAX_BYTES,
  LICENSING_UPLOAD_MAX_MB,
  ONEDRIVE_DIRECT_UPLOAD_MAX_BYTES,
  ONEDRIVE_UPLOAD_CHUNK_BYTES,
  ONEDRIVE_UPLOAD_GRANULARITY_BYTES,
} from "./onedrive-upload-policy.js";

describe("Licenciamento — upload OneDrive até 20 MB",()=>{
  it("mantém o limite funcional em 20 MB",()=>{
    expect(LICENSING_UPLOAD_MAX_MB).toBe(20);
    expect(LICENSING_UPLOAD_MAX_BYTES).toBe(20*1024*1024);
    expect(ONEDRIVE_DIRECT_UPLOAD_MAX_BYTES).toBeLessThan(4.5*1024*1024);
  });

  it("usa fragmentos múltiplos de 320 KiB e o base64 cabe na Vercel",()=>{
    expect(ONEDRIVE_UPLOAD_CHUNK_BYTES%ONEDRIVE_UPLOAD_GRANULARITY_BYTES).toBe(0);
    const base64Bytes=Math.ceil(ONEDRIVE_UPLOAD_CHUNK_BYTES/3)*4;
    expect(base64Bytes).toBeLessThan(4.5*1024*1024);
  });

  it("a tela usa o envio em partes e não conserva o antigo limite de 6 MB",()=>{
    const view=readFileSync("src/domains/licenciamento/components/LicenciamentoView.jsx","utf8");
    expect(view).toMatch(/enviarArquivoOneDriveEmPartes/);
    expect(view).toMatch(/LICENSING_UPLOAD_MAX_BYTES/);
    expect(view).not.toMatch(/file\.size>6\*1024\*1024/);
    expect(view).not.toMatch(/no máximo 6 MB/);
  });

  it("o cliente divide o File sem enviar o arquivo grande inteiro à Function",()=>{
    const api=readFileSync("src/api.js","utf8");
    expect(api).toMatch(/ONEDRIVE_UPLOAD_CHUNK_BYTES/);
    expect(api).toMatch(/file\.slice\(offset,end\)/);
    expect(api).toMatch(/upload-start/);
    expect(api).toMatch(/upload-chunk/);
  });

  it("o servidor cria sessão resumível e envia ranges sem Authorization no uploadUrl",()=>{
    const route=readFileSync("api/microsoft/onedrive.js","utf8");
    expect(route).toMatch(/action==="upload-start"/);
    expect(route).toMatch(/createUploadSession/);
    expect(route).toMatch(/LICENSING_UPLOAD_MAX_BYTES/);
    expect(route).toMatch(/action==="upload-chunk"/);
    expect(route).toMatch(/content-range/);
    const chunk=route.slice(route.indexOf('if(action==="upload-chunk")'),route.indexOf('if(action==="upload")'));
    expect(chunk).not.toMatch(/authorization/i);
    expect(chunk).toMatch(/ONEDRIVE_UPLOAD_GRANULARITY_BYTES/);
  });
});
