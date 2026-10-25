import { describe, expect, it } from "vitest";
import { calculateTimekeeping, formatMinutes, delayAfterClockTolerance } from "./timekeeping";

describe("jornada do ponto", () => {
  it("calcula entrada, intervalo e saída em minutos", () => {
    expect(calculateTimekeeping({
      entrada:"07:00",
      intervaloSaida:"12:00",
      intervaloRetorno:"13:00",
      saida:"17:00",
    })).toMatchObject({
      valid:true,
      workedMinutes:540,
      breakMinutes:60,
      delayMinutes:0,
    });
    expect(formatMinutes(540)).toBe("9h00");
  });

  it("calcula jornada sem intervalo e minutos de atraso", () => {
    expect(calculateTimekeeping({
      entrada:"07:15",
      saida:"16:45",
      jornadaInicio:"07:00",
    })).toMatchObject({
      valid:true,
      workedMinutes:570,
      breakMinutes:0,
      delayMinutes:15,
    });
  });

  it("aceita uma jornada que atravessa a meia-noite", () => {
    expect(calculateTimekeeping({
      entrada:"22:00",
      intervaloSaida:"01:00",
      intervaloRetorno:"01:30",
      saida:"06:00",
      jornadaInicio:"22:00",
    })).toMatchObject({
      valid:true,
      workedMinutes:450,
      breakMinutes:30,
    });
  });

  it.each([
    [{ entrada:"07:00", saida:"07:00" }, "não podem ser iguais"],
    [{ entrada:"07:00", intervaloSaida:"12:00", saida:"17:00" }, "saída e o retorno"],
    [{ entrada:"07:00", intervaloSaida:"13:00", intervaloRetorno:"12:00", saida:"17:00" }, "em ordem"],
    [{ entrada:"25:00", saida:"17:00" }, "horários válidos"],
  ])("rejeita horários inconsistentes", (input, message) => {
    const result = calculateTimekeeping(input);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(message);
  });

  it("mantém o registro vazio como estado válido sem horas", () => {
    expect(calculateTimekeeping({})).toEqual({
      valid:true,
      empty:true,
      workedMinutes:0,
      breakMinutes:0,
      delayMinutes:0,
    });
  });
});

describe('tolerância de marcação CLT sem alterar as batidas',()=>{
  it.each([[0,0],[1,0],[5,0],[6,6],[15,15]])('atraso bruto %i → minutos descontáveis %i',(delay,expected)=>{
    expect(delayAfterClockTolerance(delay).deductibleDelayMinutes).toBe(expected);
  });
  it('cinco minutos por marcação e dez no dia, sem transformar dez em franquia',()=>{
    const base={entrada:'07:05',intervaloSaida:'12:05',intervaloRetorno:'13:00',saida:'17:00',jornadaInicio:'07:00',jornadaFim:'17:00',intervaloPrevistoSaida:'12:00',intervaloPrevistoRetorno:'13:00'};
    expect(calculateTimekeeping(base)).toMatchObject({delayMinutes:5,deductibleDelayMinutes:0,delayToleranceApplied:true,delayReviewRequired:false});
    // 5 + 5 + 1 = 11: ultrapassa o limite diário, atraso integral = 5.
    expect(calculateTimekeeping({...base,intervaloRetorno:'13:01'})).toMatchObject({delayMinutes:5,deductibleDelayMinutes:5,delayToleranceApplied:false});
    // Uma única marcação excede 5, embora o total do dia seja apenas 6.
    expect(calculateTimekeeping({...base,entrada:'07:06',intervaloSaida:'12:00'})).toMatchObject({deductibleDelayMinutes:6});
  });
  it('sinaliza revisão da jornada incompleta, sem descontar pequena variação por presunção',()=>{
    const input={entrada:'07:05',saida:'17:00',jornadaInicio:'07:00'};
    expect(calculateTimekeeping(input)).toMatchObject({delayMinutes:5,deductibleDelayMinutes:0,delayReviewRequired:true});
    expect(input.entrada).toBe('07:05');
  });
});
