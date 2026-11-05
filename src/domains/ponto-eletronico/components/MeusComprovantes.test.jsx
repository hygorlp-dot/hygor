import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MeusComprovantes from "./MeusComprovantes.jsx";
import AcessoComprovantes from "./AcessoComprovantes.jsx";
import { chamarPontoEletronico } from "../../../api";
vi.mock("../../../api",()=>({ chamarPontoEletronico:vi.fn() }));
let root, container;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement("div");document.body.append(container);root=createRoot(container);vi.clearAllMocks();});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals();window.history.replaceState(null,"","/");});
const button=text=>[...container.querySelectorAll("button")].find(b=>b.textContent.trim()===text);
describe("consulta pessoal sem cadastro do ERP",()=>{
  it("remove segredo da URL, não consulta automaticamente e sair limpa o acesso",async()=>{
    window.history.replaceState(null,"","/meu-ponto#"+"a".repeat(43));
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({comprovantes:[]})});vi.stubGlobal("fetch",fetch);
    act(()=>root.render(<MeusComprovantes/>));
    expect(window.location.hash).toBe("");expect(fetch).not.toHaveBeenCalled();
    await act(async()=>button("Consultar meus comprovantes").click());
    const request=fetch.mock.calls[0][1];expect(request.credentials).toBe("omit");
    expect(JSON.parse(request.body)).toEqual({action:"ponto-comprovantes-individuais",operacao:"listar",prova:"a".repeat(43)});
    expect(container.textContent).toContain("Nenhum comprovante assinado disponível");
    act(()=>button("Sair deste acesso").click());expect(container.querySelector("input").value).toBe("");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
  it("exibe erro de acesso sem apresentar acervo de outro titular",async()=>{
    window.history.replaceState(null,"","/meu-ponto#"+"b".repeat(43));
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({error:"Acesso expirado."})}));
    act(()=>root.render(<MeusComprovantes/>));await act(async()=>button("Consultar meus comprovantes").click());
    expect(container.querySelector('[role="alert"]').textContent).toBe("Acesso expirado.");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
  it("RH exige ação explícita mesmo com telefone sugerido",async()=>{
    chamarPontoEletronico.mockResolvedValue({token:"c".repeat(43)});
    act(()=>root.render(<AcessoComprovantes employees={[{id:"e1",name:"Pessoa sintética",phone:"81999999999"}]}/>));
    expect(container.querySelector('input[type="tel"]').value).toBe("");expect(button("Confirmar WhatsApp").disabled).toBe(true);
    act(()=>{const select=container.querySelector("select");select.value="e1";select.dispatchEvent(new Event("change",{bubbles:true}));});
    await act(async()=>button("Criar acesso individual").click());
    expect(chamarPontoEletronico).toHaveBeenCalledExactlyOnceWith("ponto-comprovantes-gestao",{operacao:"acesso",employeeId:"e1"});
    expect(container.querySelector("input[readonly]").value).toContain("/meu-ponto#"+"c".repeat(43));
    expect(container.textContent).toContain("90 dias");
  });
});

describe("telefone sugerido para comprovantes", () => {
  const escolher = id => act(() => {
    const select = container.querySelector("select");
    select.value = id; select.dispatchEvent(new Event("change", {bubbles:true}));
  });
  it("sugere telefone nacional e só confirma por ação do RH", async () => {
    chamarPontoEletronico.mockResolvedValue({confirmado:true});
    act(() => root.render(<AcessoComprovantes employees={[{id:"a",name:"Teste A",phone:"(55) 99999-1234"}]}/>));
    escolher("a");
    expect(container.querySelector('input[type="tel"]').value).toBe("5555999991234");
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
    await act(async () => button("Confirmar WhatsApp").click());
    expect(chamarPontoEletronico).toHaveBeenCalledExactlyOnceWith("ponto-comprovantes-gestao",{operacao:"contato",employeeId:"a",telefone:"5555999991234",confirmado:true});
  });
  it("preserva DDI existente e limpa número e confirmação ao trocar de funcionário", async () => {
    chamarPontoEletronico.mockResolvedValue({confirmado:true});
    act(() => root.render(<AcessoComprovantes employees={[{id:"a",name:"Teste A",phone:"+55 (81) 99999-1234"},{id:"b",name:"Teste B"},{id:"c",name:"Teste C",phone:"123"}]}/>));
    escolher("a"); expect(container.querySelector('input[type="tel"]').value).toBe("5581999991234");
    await act(async () => button("Confirmar WhatsApp").click());
    escolher("b"); expect(container.querySelector('input[type="tel"]').value).toBe("");
    expect(button("Confirmar WhatsApp").disabled).toBe(true);
    expect(container.querySelector('[role="status"]')).toBeNull();
    escolher("c"); expect(button("Confirmar WhatsApp").disabled).toBe(true);
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
  });
});
