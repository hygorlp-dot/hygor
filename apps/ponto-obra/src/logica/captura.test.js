import { describe, expect, it, vi } from "vitest";
import { verificarModoCaptura } from "./captura.js";
import { registrarBatida } from "./terminal.js";
import { criarArmazemMemoria } from "./armazem-memoria.js";
import { calcularHashLocal } from "../../../../src/domains/ponto-eletronico/evento.js";
import { createHash, randomUUID } from "node:crypto";
const config = { dispositivoId: "aparelho-teste", gerarId: () => "desafio-teste" };
describe("modo no instante da captura", () => {
  it("online exige resposta autenticada ao desafio do próprio aparelho", async () => {
    const api = vi.fn().mockResolvedValue({ ok: true, conectado: true, desafio: "desafio-teste", dispositivoId: "aparelho-teste" });
    expect(await verificarModoCaptura({ ...config, api })).toEqual({ versaoCaptura: 1, offline: false });
    expect(api).toHaveBeenCalledWith("ponto-coletor-conectividade", { desafio: "desafio-teste" }, { tempoLimiteMs: 1200 });
  });
  it.each([null, { ok:false }, { ok:true,conectado:true,desafio:"antigo",dispositivoId:"aparelho-teste" }, { ok:true,conectado:true,desafio:"desafio-teste",dispositivoId:"outro" }])("não infere conexão de resposta incompleta ou de outro aparelho", async response => {
    expect((await verificarModoCaptura({ ...config, api:async()=>response })).offline).toBe(true);
  });
  it("erro de rede não impede o registro offline", async () => {
    expect(await verificarModoCaptura({ ...config, api:async()=>{throw Error("sem rede");} })).toEqual({ versaoCaptura:1,offline:true });
  });
  it("conexão travada tem espera limitada e não inventa estado online", async () => {
    vi.useFakeTimers();
    try {
      const result = verificarModoCaptura({ ...config, api:()=>new Promise(()=>{}), limiteMs:100 });
      await vi.advanceTimersByTimeAsync(101);expect((await result).offline).toBe(true);
    } finally { vi.useRealTimers(); }
  });
  it.each([true,false])("sela o indicador %s no hash e preserva o instante anterior à sondagem", async offline => {
    const hora = { marcadoEmMs: Date.parse("2026-11-05T10:00:00.000Z"), relogioParedeMs: Date.parse("2026-11-05T10:00:00.000Z"), horaConfiavel:true };
    const sha256 = v => createHash("sha256").update(v).digest("hex");
    const relogio = { agora:vi.fn(()=>{throw Error("não deslocar horário pela espera de rede");}) };
    const evento = await registrarBatida({ armazem:criarArmazemMemoria(),relogio,sha256,gerarId:randomUUID,dispositivoId:randomUUID(),
      pessoa:{tipo:"funcionario",id:"sintetico",cpf:"52998224725"},identificacao:{metodo:"encarregado",encarregadoId:"teste"},horaCaptura:hora,modoCaptura:{versaoCaptura:1,offline} });
    expect(evento.marcadoEm).toBe("2026-11-05T10:00:00.000Z");
    expect(evento).toMatchObject({versaoCaptura:1,offline});expect(relogio.agora).not.toHaveBeenCalled();
    expect(await calcularHashLocal({...evento,offline:!offline},sha256)).not.toBe(evento.localHash);
    expect(evento).not.toHaveProperty("nsr");
  });
});
