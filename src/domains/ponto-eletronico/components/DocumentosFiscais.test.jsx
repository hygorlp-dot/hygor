import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chamarPontoEletronico } from "../../../api";
import DocumentosFiscais from "./DocumentosFiscais.jsx";

vi.mock("../../../api", () => ({ chamarPontoEletronico: vi.fn() }));
let root, container;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement("div"); document.body.append(container); root = createRoot(container); vi.clearAllMocks(); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = props => act(() => root.render(<DocumentosFiscais estabelecimentoId="estabelecimento" dia="2026-11-05" {...props} />));
const button = text => [...container.querySelectorAll("button")].find(b => b.textContent.trim() === text);
const result = { prontidao: { podePrepararEmissao: false, requisitos: [{ codigo: "INPI", titulo: "Registro INPI", status: "pendente", acao: "Apresentar certificado real." }] } };
describe("pendências fiscais visíveis", () => {
  it("consulta somente por ação do RH e mantém emissão bloqueada", async () => {
    chamarPontoEletronico.mockResolvedValue(result);
    render({ eventId: "evento" });
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
    expect(button("Emitir PDF assinado").disabled).toBe(true);
    await act(async () => button("Verificar requisitos fiscais").click());
    expect(chamarPontoEletronico).toHaveBeenCalledExactlyOnceWith("ponto-fiscal", { tipo: "prontidao", estabelecimentoId: "estabelecimento" });
    expect(container.textContent).toContain("Pendências encontradas: 1");
    expect(button("Emitir PDF assinado").disabled).toBe(true);
  });
  it("não confunde falha de consulta com inexistência de pendência", async () => {
    chamarPontoEletronico.mockResolvedValue({ error: "Acesso restrito." }); render({});
    await act(async () => button("Verificar requisitos fiscais").click());
    expect(container.querySelector('[role="alert"]').textContent).toBe("Acesso restrito.");
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
  it("sem estabelecimento não consulta nem emite", () => {
    render({ estabelecimentoId: null }); expect(button("Verificar requisitos fiscais").disabled).toBe(true);
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
  });
  it("bloqueia clique repetido durante consulta e descarta resposta após sair", async () => {
    let resolver; chamarPontoEletronico.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
    render({});
    act(() => { button("Verificar requisitos fiscais").click(); });
    expect(container.querySelector("button").disabled).toBe(true);
    act(() => root.render(<p>Outra área</p>));
    await act(async () => resolver(result));
    expect(container.textContent).toBe("Outra área"); expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
  });
  it("recusa arquivo retornado sem confirmação de assinatura", async () => {
    chamarPontoEletronico.mockResolvedValueOnce({ prontidao: { podePrepararEmissao: true, requisitos: [{ codigo: "ASSINATURA", titulo: "Assinatura", status: "evidencia_informada" }] } }).mockResolvedValueOnce({ arquivo: { nome: "rascunho.pdf", mime: "application/pdf", manifesto: { status: "rascunho_nao_assinado" } } });
    render({ eventId: "evento" });
    await act(async () => button("Verificar requisitos fiscais").click());
    await act(async () => button("Emitir PDF assinado").click());
    expect(container.querySelector('[role="alert"]').textContent).toContain("não foi liberado");
    expect(chamarPontoEletronico).toHaveBeenLastCalledWith("ponto-fiscal", expect.objectContaining({ eventId: "evento", assinado: true, de: "2026-11-05", ate: "2026-11-05" }));
  });
});
