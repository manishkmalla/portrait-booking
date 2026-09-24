// Local-time YYYY-MM-DD key, so a slot groups under the calendar day the
// viewer would actually see it on (toISOString() is UTC and would shift
// slots near midnight into the wrong day in most timezones).
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Inverse of toDateKey. Only ever called on strings toDateKey produced, so
// no validation of the split/parse — there's no untrusted input here.
export function fromDateKey(dateKey: string): Date {
  const parts = dateKey.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
