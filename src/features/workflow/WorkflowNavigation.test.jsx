import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,expect,it,vi} from "vitest";
import {DreIntegration,FlowTabs,WorkflowContext} from "./WorkflowNavigation.jsx";
import {consultarDreCanonico,consultarDreEmpresaCanonico} from "../../api.js";
vi.mock("../../api.js",()=>({consultarDreCanonico:vi.fn(),consultarDreEmpresaCanonico:vi.fn()}));
let root,container;
afterEach(()=>{if(root)act(()=>root.unmount());container?.remove();root=null;container=null;vi.resetAllMocks();});
function render(element){if(!root){container=document.createElement("div");document.body.append(container);root=createRoot(container);}act(()=>root.render(element));}
function button(text){return [...container.querySelectorAll("button")].find(b=>b.textContent===text);}
const admin={role:"admin",id:"a"};
const projection=value=>({status:200,source:"canonical_ledger",current:{comprasCost:value}});
it("mostra ferramentas selecionadas e mantém a etapa principal acessível",()=>{
  const select=vi.fn();render(<FlowTabs label="Fluxo" steps={[{id:"a",label:"Trabalho"}]} tools={[{id:"b",label:"Configuração"}]} active="b" onChange={select}/>);
  expect(container.querySelector("details").open).toBe(true);
  expect(button("Configuração").getAttribute("aria-current")).toBe("page");
  act(()=>button("Trabalho").click());expect(select).toHaveBeenCalledWith("a");
});
it("não consulta valores nem apresenta atalhos financeiros para RH",()=>{
  render(<DreIntegration kind="payroll" currentUser={{id:"rh",role:"rh"}} year={2026} month={8}/>);
  expect(container.querySelectorAll("button")).toHaveLength(0);expect(consultarDreCanonico).not.toHaveBeenCalled();
});
it("consulta o razão sob demanda e navega com obra e competência",async()=>{
  consultarDreCanonico.mockResolvedValue(projection(0));const navigate=vi.fn();
  render(<WorkflowContext.Provider value={{navigate}}><DreIntegration kind="purchases" currentUser={admin} obraId="b2" year={2026} month={8}/></WorkflowContext.Provider>);
  expect(consultarDreCanonico).not.toHaveBeenCalled();
  await act(async()=>button("Consultar valores no DRE").click());
  expect(consultarDreCanonico).toHaveBeenCalledWith({obraId:"b2",year:2026,month:8,period:"mes"});
  expect(container.textContent).toMatch(/R\$\s*0,00/);
  act(()=>button("Abrir DRE neste recorte").click());expect(navigate).toHaveBeenCalledWith("dre",{obraId:"b2",year:2026,month:8,period:"mes"});
});
it("resultado atrasado não substitui a competência atual e ausência não vira zero",async()=>{
  let resolve;consultarDreCanonico.mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValueOnce(projection(200));
  const page=month=><DreIntegration kind="purchases" currentUser={admin} year={2026} month={month}/>;
  render(page(7));await act(async()=>button("Consultar valores no DRE").click());
  render(page(8));await act(async()=>{});await act(async()=>resolve(projection(100)));
  expect(container.textContent).toMatch(/200,00/);expect(container.textContent).not.toMatch(/100,00/);
  consultarDreCanonico.mockResolvedValue({status:200,source:"canonical_ledger",current:null});render(page(9));await act(async()=>{});
  expect(container.textContent).toContain("Projeção ainda indisponível");expect(container.textContent).not.toMatch(/R\$/);
});
it("permite apenas a API empresarial quando esse é o único acesso",async()=>{
  consultarDreEmpresaCanonico.mockResolvedValue(projection(10));
  render(<DreIntegration kind="purchases" currentUser={{role:"compras",id:"custom",accessTabs:["dre_emp"]}} year={2026} month={8}/>);
  await act(async()=>button("Consultar valores no DRE").click());expect(consultarDreEmpresaCanonico).toHaveBeenCalled();expect(consultarDreCanonico).not.toHaveBeenCalled();
});
it("mostra falha de consulta sem apresentar valor financeiro confirmado",async()=>{
  consultarDreCanonico.mockRejectedValue(new Error("offline"));render(<DreIntegration kind="purchases" currentUser={admin} year={2026} month={8}/>);
  await act(async()=>button("Consultar valores no DRE").click());expect(container.querySelector('[role="alert"]').textContent).toContain("Não foi possível");expect(container.textContent).not.toMatch(/R\$/);
});
