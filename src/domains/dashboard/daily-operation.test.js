import { describe, expect, it } from 'vitest';
import { previousOperationDay, summarizeDiaryChallenge, summarizeOperationDay } from './daily-operation.js';

const day = '2026-11-01';

describe('resumo diário da Dashboard', () => {
  it('usa o dia de calendário anterior na virada do mês', () => {
    expect(previousOperationDay(day)).toBe('2026-10-31');
  });

  it('conta presença parcial e falta lançada no recorte da obra', () => {
    const data = {
      employees: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, obra: '1' })),
      attendance: {
        a: { [day]: 'M' },
        b: { [day]: 'F' },
        c: { [day]: { status: 'P', obraId: '2' } },
        d: { [day]: 'AT' },
      },
    };
    expect(summarizeOperationDay(data, day, { workId: '1', showAttendance: true }).attendance)
      .toEqual({ present: 1, absent: 1 });
    expect(summarizeOperationDay(data, day, { showAttendance: true }).attendance)
      .toEqual({ present: 2, absent: 1 });
    expect(summarizeOperationDay(data, day, { showAttendance: true }).attendanceByWork)
      .toEqual(new Map([['1', { present: 1, absent: 1 }], ['2', { present: 1, absent: 0 }]]));
  });

  it('conta um diário por obra no dia e respeita as fontes disponíveis', () => {
    const data = { rdos: [
      { obraId: 1, data: day, status: 'concluido' },
      { obraId: '1', data: day, status: 'rascunho' },
      { obraId: '2', data: day, status: 'rascunho' },
      { obraId: '3', data: day, status: 'cancelado' },
      { obraId: '3', data: previousOperationDay(day), status: 'concluido' },
      { obraId: '4', data: day, status: 'concluido' },
    ] };
    const summary = summarizeOperationDay(data, day, { diaryWorks: new Set(['1', '2', '3']) });
    expect(summary.diaries).toEqual({ started: 2, completed: 1, total: 3 });
    expect(summary.diaryByWork.get('1').status).toBe('concluido');
    expect(summary.diaryByWork.get('3').status).toBe('cancelado');
    expect(summarizeOperationDay(data, day, {})).toEqual({ attendance: null, diaries: null, attendanceByWork: null, diaryByWork: null });
  });

  it('conta um dia por obra na janela de sete dias, sem rascunhos, futuros e obras fora do acesso', () => {
    const diary = (data, obraId = '1', status = 'concluido') => ({ data, obraId, status });
    const data = { rdos: [diary(day), diary(day), diary('2026-10-26'), diary('2026-10-25'), diary('2026-11-02'),
      diary('2026-10-30', '1', 'preparacao'), diary(day, '3')] };
    expect(summarizeDiaryChallenge(data, day, new Set(['1', '2']))).toEqual(new Map([['1', 2], ['2', 0]]));
  });
});
