import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,expect,it,vi} from "vitest";
import SupplierResponseQueue from "./SupplierResponseQueue.jsx";

let root,container;
const data={fornecedores:[{id:"supplier",nome:"Fornecedor local"}],obras:[{id:"work",name:"Obra local"}]};
const quote={id:"quote",numero:"COT-1",obraId:"work",status:"aberta",materialId:"material",qtd:10,propostas:[{id:"proposal",fornecedorId:"supplier",precoUnit:25}]};
function render(quotes,onOpen=vi.fn()){
 if(!root){container=document.createElement("div");document.body.append(container);root=createRoot(container);}
 act(()=>root.render(<SupplierResponseQueue quotes={quotes} data={data} onOpen={onOpen}/>));
}
afterEach(()=>{act(()=>root?.unmount());container?.remove();root=null;container=null;});

it("mantém consultas disponíveis sem ocupar a lista quando não há retornos pendentes",()=>{
 render([quote]);expect(container.querySelector("details").open).toBe(false);
 const filter=container.querySelector("select");act(()=>{filter.value="all";filter.dispatchEvent(new Event("change",{bubbles:true}));});
 container.querySelector("details").open=true;
 expect(container.textContent).toContain("Fornecedor local");expect(filter.value).toBe("all");
});
it("destaca automaticamente uma resposta nova e abre a cotação correta",()=>{
 const open=vi.fn();render([quote],open);
 render([{...quote,respostasFornecedor:[{id:"reply",proposalId:"proposal",fornecedorId:"supplier",status:"pendente",recebidaEm:"2026-10-30T15:00:00Z"}]}],open);
 expect(container.querySelector("details").open).toBe(true);
 const button=[...container.querySelectorAll("button")].find(b=>b.textContent==="Abrir cotação COT-1");
 act(()=>button.click());expect(open).toHaveBeenCalledWith("quote");
});
it("mantém fornecedores ainda não contatados visíveis como pendência",()=>{
 render([{...quote,propostas:[{id:"proposal",fornecedorId:"supplier"}]}]);
 expect(container.querySelector("details").open).toBe(true);expect(container.textContent).toContain("Envio não registrado");
});
