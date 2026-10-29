import { describe, expect, it } from "vitest";
import { montarEquipeObras, filtrarEquipeObras } from "./equipe-obras";
import { calcularHashLocal, validarEvento } from "./evento";
const agora = Date.parse("2026-10-28T20:00:00Z");
const employees = [{ id: "e1", name: "José Silva", obra: "a", active: true }];
const obras = [{ id: "a", name: "Alameda" }, { id: "b", name: "Galpão" }];
const evento = (tipoEvento, hora, obraId = "a") => ({ eventId: `${tipoEvento}-${hora}`, employeeId: "e1", tipoRegistro: "ponto", tipoEvento, marcadoEm: `2026-10-28T${hora}:00Z`, obraId, horaConfiavel: true });
const montar = (marcacoes = [], extra = {}) => montarEquipeObras({ employees, obras, marcacoes, agora, ...extra });
describe("Equipe nas Obras: projeção da jornada", () => {
  it("entrada, intervalo, retorno e saída deslocam uma única representação", () => {
    const eventos = [evento("entrada", "10:00"), evento("intervalo", "15:00"), evento("retorno", "16:00"), evento("saida", "19:00")];
    expect(montar(eventos.slice(0, 1))[0]).toMatchObject({ situacao: "atividade", obraId: "a" });
    expect(montar(eventos.slice(0, 2))[0]).toMatchObject({ situacao: "intervalo", obraId: "a" });
    expect(montar(eventos.slice(0, 3))[0].situacao).toBe("atividade");
    expect(montar(eventos)[0]).toMatchObject({ situacao: "encerrada", obraId: "" });
  });
  it("transferência e sincronização atrasada respeitam a hora efetiva e deduplicam", () => {
    const primeira = evento("entrada", "10:00");
    const segunda = evento("entrada", "16:00", "b");
    expect(montar([segunda, primeira, primeira])).toHaveLength(1);
    expect(montar([segunda, primeira, primeira])[0]).toMatchObject({ obraId: "b", situacao: "atividade" });
  });
  it("não transforma ausência de batida nem horário previsto em falta", () => {
    expect(montar()[0].situacao).toBe("sem_registro");
    expect(montar([], { attendance: { e1: { "2026-10-28": { status: "F" } } } })[0].situacao).toBe("falta");
    expect(montar([], { employees: [{ ...employees[0], workStart: "19:00" }] })[0].situacao).toBe("aguardando");
  });
  it("não infere tipos de batidas antigas e detecta sequência inválida", () => {
    expect(montar([evento(null, "10:00")])[0].situacao).toBe("conferir");
    expect(montar([evento("retorno", "10:00")])[0].situacao).toBe("conferir");
    expect(montar([evento("entrada", "10:00"), evento("retorno", "11:00")])[0].situacao).toBe("conferir");
  });
  it("mantém jornada noturna e sinaliza jornada velha sem encerrá-la", () => {
    const noturna = { ...evento("entrada", "10:00"), marcadoEm: "2026-10-28T02:00:00Z" };
    expect(montar([noturna], { agora: Date.parse("2026-10-28T06:00:00Z") })[0].situacao).toBe("atividade");
    expect(montar([noturna], { agora: Date.parse("2026-10-29T06:00:00Z") })[0].situacao).toBe("conferir");
  });
  it("obra desconhecida, relógio inseguro, eventos cancelados e empates ficam seguros", () => {
    expect(montar([evento("entrada", "10:00", "x")])[0].situacao).toBe("sem_obra");
    expect(montar([{ ...evento("entrada", "10:00"), horaConfiavel: false }])[0].situacao).toBe("conferir");
    expect(montar([{ ...evento("entrada", "10:00"), cancelado: true }])[0].situacao).toBe("sem_registro");
    expect(montar([evento("entrada", "10:00"), evento("saida", "10:00")])[0].situacao).toBe("conferir");
  });
  it("filtros combinam pessoa, obra e situação sem retirar obras vazias", () => {
    const pessoas = montar([evento("entrada", "10:00")]);
    expect(filtrarEquipeObras(pessoas, obras).obras).toHaveLength(2);
    expect(filtrarEquipeObras(pessoas, obras, { busca: "jose", situacao: "atividade" }).pessoas).toHaveLength(1);
    expect(filtrarEquipeObras(pessoas, obras, { obraId: "b" }).pessoas).toHaveLength(0);
  });
  it("tipo de evento integra o hash; não pode ser removido ou adulterado", async () => {
    const e = { ...evento("entrada", "10:00"), versaoJornada: 1 };
    const identity = async text => text;
    expect(await calcularHashLocal(e, identity)).not.toBe(await calcularHashLocal({ ...e, tipoEvento: "saida" }, identity));
    expect(await calcularHashLocal(e, identity)).not.toBe(await calcularHashLocal({ ...e, versaoJornada: undefined }, identity));
    expect(validarEvento({ ...e, versaoJornada: undefined }).erros).toContain("tipoEvento inválido ou sem versão de jornada");
  });
});
