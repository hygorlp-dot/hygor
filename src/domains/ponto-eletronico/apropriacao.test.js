// @vitest-environment node
import { describe, expect, it } from "vitest";
import { proporApropriacoes, validarApropriacao } from "./apropriacao.js";
import { resumoDoDia } from "./painel.js";

const b = (eventId, hora, obraCapturaId) => ({ eventId, marcadoEm: `2026-10-01T${hora}:00.000Z`, obraCapturaId });

describe("proposta de apropriação por obra", () => {
  it("troca de obra sem bater saída: 07:00 A, 11:30 B, 17:00 B → A até a chegada em B, depois B", () => {
    const r = proporApropriacoes([b("1", "10:00", "A"), b("3", "20:00", "B"), b("2", "14:30", "B")]);   // fora de ordem de propósito
    expect(r.intervalos.map(i => [i.inicio.slice(11, 16), i.fim.slice(11, 16), i.obraApropriadaId, i.mudouDeObra])).toEqual([["10:00", "14:30", "A", true], ["14:30", "20:00", "B", false]]);
    expect(r.avisos).toEqual([]);
  });

  it("almoço na mesma obra: entrada, saída, volta e saída viram dois intervalos (o almoço não é apropriado)", () => {
    const r = proporApropriacoes([b("1", "10:00", "A"), b("2", "15:00", "A"), b("3", "16:00", "A"), b("4", "20:00", "A")]);
    expect(r.intervalos.map(i => [i.inicio.slice(11, 16), i.fim.slice(11, 16), i.obraApropriadaId])).toEqual([["10:00", "15:00", "A"], ["16:00", "20:00", "A"]]);
  });

  it("saiu da A, depois entrou e saiu na B: dois intervalos sem juntar o deslocamento", () => {
    const r = proporApropriacoes([b("1", "10:00", "A"), b("2", "14:00", "A"), b("3", "14:30", "B"), b("4", "20:00", "B")]);
    expect(r.intervalos.map(i => [i.inicio.slice(11, 16), i.fim.slice(11, 16), i.obraApropriadaId])).toEqual([["10:00", "14:00", "A"], ["14:30", "20:00", "B"]]);
  });

  it("batida que sobra no fim do dia vira aviso de 'sem saída', não intervalo inventado", () => {
    const r = proporApropriacoes([b("1", "10:00", "A"), b("2", "14:00", "A"), b("3", "15:00", "B")]);
    expect(r.intervalos).toHaveLength(1);
    expect(r.avisos).toEqual([{ tipo: "sem_saida", eventId: "3", marcadoEm: "2026-10-01T15:00:00.000Z", obraCapturaId: "B" }]);
    expect(proporApropriacoes([])).toEqual({ intervalos: [], avisos: [] });
  });

  it("validação do intervalo antes do banco", () => {
    const ok = { employeeId: "e1", data: "2026-10-01", inicio: "2026-10-01T10:00:00Z", fim: "2026-10-01T12:00:00Z", obraApropriadaId: "A" };
    expect(validarApropriacao(ok)).toEqual({ ok: true, erros: [] });
    expect(validarApropriacao({ ...ok, fim: "2026-10-01T09:00:00Z" }).erros).toContain("o fim precisa ser depois do início");
    expect(validarApropriacao({ ...ok, fim: "2026-10-03T09:00:00Z" }).erros).toContain("intervalo maior que 24 horas");
    expect(validarApropriacao({ ...ok, id: "x" }).erros).toContain("informe o motivo da alteração");
    expect(validarApropriacao({ ...ok, obraApropriadaId: "" }).erros).toContain("informe a obra apropriada");
  });
});

describe("resumo do dia com funcionário global", () => {
  it("quem é lotado em outra obra e bateu aqui aparece com o NOME, marcado como de outra obra", () => {
    const m = { tipoRegistro: "ponto", employeeId: "e9", marcadoEm: "2026-10-01T10:00:00Z", horaConfiavel: true };
    const r = resumoDoDia([m], [{ id: "e1", nome: "Ana" }], [{ id: "e9", nome: "João Armador", funcao: "Armador" }]);
    expect(r.find(l => l.employeeId === "e9")).toMatchObject({ nome: "João Armador", funcao: "Armador", foraDaObra: true, situacao: "em_jornada" });
  });
});
