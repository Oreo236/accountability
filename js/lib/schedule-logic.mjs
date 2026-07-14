// Shared between the browser frontend and the Node scripts run by GitHub Actions.
// Pure functions only — no fetch, no Redis, no DOM. Import as an ES module from either side.

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Minutes since midnight for a "HH:MM" 24h string. */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Wall-clock "now" in a given IANA timezone, computed via Intl so it stays
 * correct across DST without manual offset math. Works the same whether the
 * runtime's own TZ is UTC (GitHub Actions) or local (a browser).
 */
export function zonedNow(timezone, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayShort = get('weekday');
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = Number(get('hour'));
  const minute = Number(get('minute'));
  if (hour === 24) hour = 0; // some locales format midnight as 24:xx

  return {
    dateStr: `${year}-${month}-${day}`,
    weekday: WEEKDAY_INDEX[weekdayShort],
    minutes: hour * 60 + minute,
  };
}

/** Pick whichever profile's activeFrom is the most recent one on or before dateStr. */
export function pickActiveProfile(profiles, dateStr) {
  const eligible = profiles
    .filter((p) => p.activeFrom <= dateStr)
    .sort((a, b) => (a.activeFrom < b.activeFrom ? 1 : -1));
  return eligible[0] ?? null;
}

/** Tasks for a given weekday (0=Sun..6=Sat), with start/end minutes attached. */
export function tasksForWeekday(profile, weekday) {
  const tasks = profile?.days?.[String(weekday)] ?? [];
  return tasks.map((t) => ({
    ...t,
    startMin: toMinutes(t.start),
    endMin: toMinutes(t.end),
  }));
}

/** upcoming | active | overdue | done */
export function classifyTask(task, nowMinutes, isDone) {
  if (isDone) return 'done';
  if (nowMinutes < task.startMin) return 'upcoming';
  if (nowMinutes <= task.endMin) return 'active';
  return 'overdue';
}

// Reminder windows are deliberately wide (wider than the 15-minute Action
// cron interval) to absorb GitHub Actions scheduling jitter, while the
// sent:* idempotency keys (see scripts/notify.js) stop duplicate pushes.
export function isStartReminderDue(task, nowMinutes) {
  return nowMinutes >= task.startMin - 5 && nowMinutes <= task.startMin + 20;
}

export function isFollowupDue(task, nowMinutes) {
  return nowMinutes >= task.endMin + 25 && nowMinutes <= task.endMin + 50;
}
