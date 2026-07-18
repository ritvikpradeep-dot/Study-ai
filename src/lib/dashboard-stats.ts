function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function computeStreak(activityDates: Date[]): number {
  const days = new Set(activityDates.map(dayKey));
  let streak = 0;
  const cursor = startOfTodayUTC();

  // If nothing happened today yet, the streak still counts through yesterday.
  if (!days.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export function computeActivityByDay(
  activityDates: Date[],
  numDays = 7
): { date: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of activityDates) {
    const key = dayKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result: { date: string; label: string; count: number }[] = [];
  const cursor = startOfTodayUTC();
  cursor.setUTCDate(cursor.getUTCDate() - (numDays - 1));

  for (let i = 0; i < numDays; i++) {
    const key = dayKey(cursor);
    result.push({
      date: key,
      label: cursor.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }),
      count: counts.get(key) ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

export function isWithinLastDays(date: Date, days: number): boolean {
  return date >= daysAgo(days);
}

export function daysAgo(days: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}
