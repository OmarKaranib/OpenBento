const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function zonedScheduleParts(
  date: Date,
  timeZone: string,
): { dayOfWeek: number; minuteOfDay: number } {
  const parts = formatterFor(timeZone).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return {
    dayOfWeek: WEEKDAYS[weekday] ?? 0,
    minuteOfDay: hour * 60 + minute,
  };
}

export function scheduleMatches(
  date: Date,
  dayOfWeek: number,
  minuteOfDay: number,
  timeZone: string,
): boolean {
  const local = zonedScheduleParts(date, timeZone);
  return local.dayOfWeek === dayOfWeek && local.minuteOfDay === minuteOfDay;
}

export function minutesUntilSchedule(
  now: Date,
  dayOfWeek: number,
  minuteOfDay: number,
  timeZone: string,
): number {
  const candidate = new Date(now);
  candidate.setUTCSeconds(0, 0);
  for (let delta = 1; delta <= 7 * 24 * 60; delta++) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
    if (scheduleMatches(candidate, dayOfWeek, minuteOfDay, timeZone)) return delta;
  }
  return 7 * 24 * 60;
}
