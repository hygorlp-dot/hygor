const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const toDate = value => ISO_DATE.test(String(value || "")) ? new Date(`${value}T12:00:00Z`) : null;
const format = date => date.toISOString().slice(0, 10);
const offset = (date, days) => { const copy=new Date(date); copy.setUTCDate(copy.getUTCDate()+days); return copy; };

export function createWorkCalendar(input = {}) {
  return {
    id: String(input.id || "default"), timezone: String(input.timezone || "America/Recife"),
    workingDays: Array.isArray(input.workingDays) && input.workingDays.length ? input.workingDays.map(Number) : [1,2,3,4,5],
    holidays: Array.isArray(input.holidays) ? input.holidays.map(String) : [],
    exceptions: Array.isArray(input.exceptions) ? input.exceptions.map(item => ({ date:String(item.date || ""), working:item.working === true })) : [],
  };
}

function isWorkingDay(value, calendarInput = {}) {
  const date = toDate(value); if (!date) return false;
  const calendar = createWorkCalendar(calendarInput);
  const dateText = format(date); const exception = calendar.exceptions.find(item => item.date === dateText);
  if (exception) return exception.working;
  return calendar.workingDays.includes(date.getUTCDay()) && !calendar.holidays.includes(dateText);
}

export function nextWorkingDate(value, calendar, direction = 1) {
  let date = toDate(value); if (!date) throw new Error("Data de calendário inválida.");
  while (!isWorkingDay(format(date), calendar)) date = offset(date, direction);
  return format(date);
}

export function addWorkingDays(value, amount, calendar) {
  let date = toDate(value); if (!date) throw new Error("Data de calendário inválida.");
  const direction = Number(amount) < 0 ? -1 : 1; let remaining = Math.abs(Math.trunc(Number(amount) || 0));
  date = toDate(nextWorkingDate(format(date), calendar, direction));
  while (remaining > 0) { date = offset(date, direction); if (isWorkingDay(format(date), calendar)) remaining -= 1; }
  return format(date);
}

export function workingDaysBetween(start, finish, calendar) {
  let cursor = toDate(start); const end = toDate(finish); if (!cursor || !end || cursor > end) return 0;
  let total=0; while (cursor <= end) { if (isWorkingDay(format(cursor), calendar)) total += 1; cursor=offset(cursor,1); } return total;
}
