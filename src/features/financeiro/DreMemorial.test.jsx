import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,it,expect,vi} from "vitest";
import DreMemorial,{safeDocumentUrl} from "./DreMemorial.jsx";
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();});
const render=props=>{container=document.createElement("div");document.body.append(container);root=createRoot(container);act(()=>root.render(<DreMemorial {...props}/>));};
it("apresenta documentos, datas, pagamentos e navegação para a obra",()=>{
  const onOpenWork=vi.fn();
  render({row:{sources:["faturamentoObras"]},month:{faturamentoObras:100,memorial:{faturamentoObras:[{id:"m",amountCents:10000,description:"Medição 01",obra:"Obra A",obraId:"a",date:"2026-07-12",competence:"2026-07",record:{documentos:[{nome:"Nota fiscal",url:"https://example.com/nf.pdf"}],pagamentos:[{data:"2026-07-15",valor:100}]}}]}},onOpenWork});
  expect(container.textContent).toContain("12/07/2026");
  expect(container.textContent).toContain("15/07/2026");
  expect(container.querySelector("a").href).toBe("https://example.com/nf.pdf");
  expect(container.querySelector("a").rel).toBe("noopener noreferrer");
  act(()=>container.querySelector("button").click());expect(onOpenWork).toHaveBeenCalledWith("a");
});
it("explica snapshots antigos e diferenças sem inventar lançamentos",()=>{
  render({row:{sources:["faturamentoObras"]},month:{faturamentoObras:100}});
  expect(container.textContent).toContain("salvo sem o memorial");
  expect(container.querySelectorAll("details")).toHaveLength(0);
  expect(container.textContent).toContain("Parcela do total sem detalhamento");
});
it("não cria links executáveis ou de arquivos locais",()=>{
  for(const value of ["javascript:alert(1)","data:text/html,hi","file:///C:/secret","//example.com"]){expect(safeDocumentUrl(value)).toBeNull();}
  expect(safeDocumentUrl("https://example.com/nf.pdf")).toBe("https://example.com/nf.pdf");
});
it('usa o arquivo protegido do provedor também nos links do memorial',()=>{
 const url='/api/microsoft/onedrive?action=file&driveId=a&itemId=b&sig=c';
 expect(safeDocumentUrl(url)).toBe(url);
 expect(safeDocumentUrl('https://user:secret@example.com/nota.pdf')).toBeNull();
});
