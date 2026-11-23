import { getAtt, toLocalISODate } from '../ponto/attendance-engine.js';
import { resolveEmployeeAttendanceObraId } from '../ponto/permissions.js';

function shiftOperationDay(day, delta) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return toLocalISODate(date);
}

export const previousOperationDay = day => shiftOperationDay(day, -1);
export const DIARY_MILESTONES = [1, 3, 5];
export const DIARY_GOAL = DIARY_MILESTONES.at(-1);
const diaryRank = report => report?.status === 'concluido' ? 3 : report?.status === 'cancelado' ? 1 : report ? 2 : 0;

export function summarizeOperationDay(data, day, { workId, diaryWorks, showAttendance }) {
  const attendance = showAttendance && data.attendance ? { present: 0, absent: 0 } : null;
  const attendanceByWork = attendance && new Map();
  if (attendance) {
    for (const employee of data.employees || []) {
      const record = getAtt(data, employee.id, day);
      if (!['P', 'M', 'F'].includes(record?.status)) continue;
      const id = String(resolveEmployeeAttendanceObraId({ data, employee, date: day, record }) || '');
      if (workId && id !== String(workId)) continue;
      const key = record.status === 'F' ? 'absent' : 'present';
      attendance[key]++;
      if (!id) continue;
      if (!attendanceByWork.has(id)) attendanceByWork.set(id, { present: 0, absent: 0 });
      attendanceByWork.get(id)[key]++;
    }
  }

  const diaries = diaryWorks && Array.isArray(data.rdos) ? new Map() : null;
  if (diaries) {
    for (const diary of data.rdos) {
      const id = String(diary.obraId);
      if (diary.data !== day || !diaryWorks.has(id)) continue;
      if (diaryRank(diary) > diaryRank(diaries.get(id))) diaries.set(id, diary);
    }
  }
  const dailyReports = diaries && [...diaries.values()];
  return {
    attendance,
    attendanceByWork,
    diaryByWork: diaries,
    diaries: diaries && {
      completed: dailyReports.filter(report => report.status === 'concluido').length,
      started: dailyReports.filter(report => report.status !== 'cancelado').length,
      total: diaryWorks.size,
    },
  };
}

export function summarizeDiaryChallenge(data, day, workIds) {
  if (!Array.isArray(data.rdos)) return null;
  const start = shiftOperationDay(day, -6);
  const daysByWork = new Map();
  for (const diary of data.rdos) {
    const id = String(diary.obraId);
    if (!workIds.has(id) || diary.status !== 'concluido' || !diary.data || diary.data < start || diary.data > day) continue;
    if (!daysByWork.has(id)) daysByWork.set(id, new Set());
    daysByWork.get(id).add(diary.data);
  }
  return new Map([...workIds].map(id => [id, daysByWork.get(id)?.size || 0]));
}
