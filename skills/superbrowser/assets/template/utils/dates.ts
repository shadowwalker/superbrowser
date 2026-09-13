export function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a date in YYYY-MM-DD format");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`Invalid calendar date: ${value}`);
  return value;
}

export function todayIn(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function selectDate(all: boolean, date: string | undefined, today: boolean, timeZone: string): string | null {
  if (Number(all) + Number(date !== undefined) + Number(today) > 1) throw new Error("Choose only one of --all, --date, or --today");
  return all ? null : date === undefined ? todayIn(timeZone) : validateDate(date);
}
