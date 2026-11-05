import { describe, expect, it, vi } from "vitest";
import { autorizarAutomacao, comprovantesIndividuais } from "./acesso.js";
import { criarTratadorPonto } from "../handler.js";

describe("escopo individual e automação fiscal", () => {
  it("não aceita papel, PIN ou segredo ausente como credencial de automação", () => {
    expect(autorizarAutomacao({ authorization: "Bearer undefined" })).toBe(false);
    expect(autorizarAutomacao({ authorization: "Bearer abc" },"abc")).toBe(false);
    const key="x".repeat(32);
    expect(autorizarAutomacao({ authorization:"Bearer "+key },key)).toBe(true);
    expect(autorizarAutomacao({ authorization:"Bearer "+"y".repeat(32) },key)).toBe(false);
  });
  it("CPF não autoriza acesso e corpo não pode trocar empresa ou titular", async () => {
    const recibos=vi.fn().mockResolvedValue({ comprovantes:[] });
    expect((await comprovantesIndividuais({ companyId:"fixa",body:{ operacao:"listar",prova:"52998224725" },servicos:{ recibos } })).status).toBe(403);
    expect(recibos).not.toHaveBeenCalled();
    await comprovantesIndividuais({ companyId:"fixa",body:{ operacao:"listar",prova:"a".repeat(43),companyId:"outra",employeeId:"outra-pessoa",eventId:"nao-incluir" },servicos:{ recibos } });
    expect(recibos).toHaveBeenCalledExactlyOnceWith("consultar",{ companyId:"fixa",prova:"a".repeat(43) });
  });
  it("rotas individuais e automação sem autorização não leem o ERP nem gravam", async () => {
    const db={ from:vi.fn(),rpc:vi.fn() },lerDados=vi.fn();
    const tratar=criarTratadorPonto({ db,company:"fixa",lerDados,lerDadosPainel:lerDados,autenticarUsuario:vi.fn() });
    expect((await tratar({ action:"ponto-fiscal-automacao",body:{ role:"admin",operacao:"listar" } })).status).toBe(403);
    expect((await tratar({ action:"ponto-comprovantes-individuais",body:{ operacao:"listar",prova:"a".repeat(43) } })).status).toBe(403);
    expect(db.from).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled();expect(lerDados).not.toHaveBeenCalled();
  });
  it("falha no cofre não revela resposta do serviço privado", async () => {
    const response=await comprovantesIndividuais({ companyId:"fixa",body:{ operacao:"baixar",prova:"a".repeat(43),eventId:"e" },servicos:{ recibos:async()=>{throw Error("segredo privado");} } });
    expect(response.status).toBe(403);expect(JSON.stringify(response)).not.toContain("segredo privado");
  });
});
