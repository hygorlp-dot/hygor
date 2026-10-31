import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { OriginalDocument } from "../financeiro/InvoiceConference.jsx";
let root, container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();});
async function render(resolveFile){
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(<OriginalDocument document={{nome:"Comprovante.png",url:"/api/microsoft/onedrive?action=file&driveId=drive&itemId=file"}} resolveFile={resolveFile}/>));
}
it("renova a autorização do anexo protegido antes de mostrar o comprovante",async()=>{
  const resolve=vi.fn().mockResolvedValue({ok:true,url:"https://example.test/comprovante.png"});await render(resolve);
  expect(resolve).toHaveBeenCalledWith({driveId:"drive",itemId:"file"});
  expect(container.querySelector("img").getAttribute("src")).toBe("https://example.test/comprovante.png");
});
it("mantém recuperação por tentativa e não exibe original protegido quando o acesso é recusado",async()=>{
  await render(vi.fn().mockResolvedValue({ok:false,status:403}));
  expect(container.querySelector("img")).toBeNull();expect(container.textContent).toContain("Não foi possível visualizar este arquivo aqui");
  expect(container.textContent).toContain("Tentar novamente");
});
