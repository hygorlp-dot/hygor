const toLocalISODate = value => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Durante o fim de semana a referência continua sendo a sexta que acabou de
// passar; nos dias úteis aponta para a sexta da própria semana.
export function paymentFriday(weekOffset = 0, now = new Date()) {
  const date = new Date(now);
  const weekDay = date.getDay();
  const untilFriday = (5 - weekDay + 7) % 7;
  const currentWeekAdjustment = weekDay === 0 || weekDay === 6
    ? untilFriday - 7
    : untilFriday;
  date.setDate(date.getDate() + currentWeekAdjustment + weekOffset * 7);
  return toLocalISODate(date);
}

export function paymentWeekRange(fridayIso) {
  const friday = new Date(`${fridayIso}T12:00:00`);
  if (Number.isNaN(friday.getTime())) return null;
  const monday = new Date(friday);
  monday.setDate(friday.getDate() - 4);
  return { start: toLocalISODate(monday), end: fridayIso };
}
