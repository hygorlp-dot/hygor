import { describe, expect, it } from "vitest";
import { divergenciaComGrade, proporGradeDoREP, situacaoPelaJornada } from "./ponte-grade.js";

// Horário de Recife = UTC-3.
const b = (eventId, hora, obraId = "o1", employeeId = "e1", data = "2026-10-05") =>
  ({ eventId, employeeId, tipoRegistro:"ponto", obraId, obraCapturaId:obraId, marcadoEm:`${data}T${hora}:00-03:00` });

describe("ponte REP-P -> grade de presença", () => {
  it("dia completo com almoço vira presente, com horários e hora extra", () => {
    const [dia] = proporGradeDoREP({ marcacoes:[b("1","07:00"), b("2","11:00"), b("3","12:00"), b("4","17:30")] });
    expect(dia).toMatchObject({
      employeeId:"e1", date:"2026-10-05", origem:"batidas", status:"P", obraId:"o1",
      entrada:"07:00", intervaloSaida:"11:00", intervaloRetorno:"12:00", saida:"17:30",
      workedMinutes:570, ot:1.5, avisos:[],
    });
  });

  it("meio expediente vira meio dia; batida sem saída vira aviso, não situação", () => {
    expect(proporGradeDoREP({ marcacoes:[b("1","07:00"), b("2","11:00")] })[0].status).toBe("M");
    const [sozinha] = proporGradeDoREP({ marcacoes:[b("1","07:00")] });
    expect(sozinha.status).toBeNull();
    expect(sozinha.avisos).toEqual(["Batida sem saída às 07:00"]);
  });

  it("apropriação confirmada vence as batidas; a grade fica com a obra de mais horas", () => {
    const [dia] = proporGradeDoREP({
      marcacoes:[b("1","07:00"), b("2","17:00")],
      apropriacoes:[
        { employeeId:"e1", data:"2026-10-05", inicio:"2026-10-05T07:00:00-03:00", fim:"2026-10-05T09:00:00-03:00", obraApropriadaId:"o1", status:"ativa" },
        { employeeId:"e1", data:"2026-10-05", inicio:"2026-10-05T09:30:00-03:00", fim:"2026-10-05T16:00:00-03:00", obraApropriadaId:"o2", status:"ativa" },
        { employeeId:"e1", data:"2026-10-05", inicio:"2026-10-05T16:00:00-03:00", fim:"2026-10-05T23:00:00-03:00", obraApropriadaId:"o3", status:"cancelada" },
      ],
    });
    expect(dia).toMatchObject({ origem:"apropriacao", obraId:"o2", status:"P", workedMinutes:510 });
    expect(dia.avisos[0]).toMatch(/2 obras/);
  });

  it("batida perto da meia-noite UTC cai no dia local de Recife", () => {
    const [dia] = proporGradeDoREP({ marcacoes:[
      { eventId:"1", employeeId:"e1", tipoRegistro:"ponto", obraId:"o1", marcadoEm:"2026-10-06T00:30:00Z" },
    ] });
    expect(dia.date).toBe("2026-10-05");
  });

  it("acesso de terceiro não entra; situação segue a jornada", () => {
    expect(proporGradeDoREP({ marcacoes:[{ ...b("1","07:00"), tipoRegistro:"acesso_terceiro" }] })).toEqual([]);
    expect(situacaoPelaJornada(0)).toBeNull();
    expect(situacaoPelaJornada(360)).toBe("P");
    expect(situacaoPelaJornada(359)).toBe("M");
  });

  it("compara com o que já está na grade", () => {
    const proposta = { status:"P", obraId:"o1" };
    expect(divergenciaComGrade(proposta, null)).toBe("novo");
    expect(divergenciaComGrade(proposta, { status:"P", obraId:"o1" })).toBe("igual");
    expect(divergenciaComGrade(proposta, { status:"F", obraId:"o1" })).toBe("diferente");
  });
});
