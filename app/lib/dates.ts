/**
 * League-standard date formatting: everything user-facing renders in the
 * league's timezone (America/New_York) regardless of the viewer's locale.
 */
const NY = 'America/New_York';

export type NYFormat = 'ymd' | 'date-long' | 'date-short' | 'time' | 'time-bare';

/** Milliseconds the given timezone is ahead of UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour % 24,
    +parts.minute,
    +parts.second
  );
  return asUtc - date.getTime();
}

/**
 * Parses an America/New_York wall time string into a UTC Date instant.
 *
 * Accepts:
 * - "YYYY-MM-DDTHH:MM" (standard HTML datetime-local input)
 * - "YYYY-MM-DDTHH:MM:SS"
 * - "YYYY-MM-DD HH:MM:SS" (spreadsheets / database seed format)
 * - "YYYY-MM-DD HH:MM"
 *
 * Uses a two-pass relaxation so the DST offset (EDT UTC-4 vs. EST UTC-5)
 * is derived from the instant itself, not from the system clock or local timezone.
 */
export function parseEastern(dateStr: string): Date {
  const trimmed = dateStr.trim();
  if (!trimmed) {
    return new Date(NaN);
  }
  const [d, t = '00:00:00'] = trimmed.replace('T', ' ').split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const timeParts = t.split(':').map(Number);
  const hh = timeParts[0] ?? 0;
  const mm = timeParts[1] ?? 0;
  const ss = timeParts[2] ?? 0;

  const wallUtc = Date.UTC(y, m - 1, day, hh, mm, ss);
  if (Number.isNaN(wallUtc)) {
    return new Date(NaN);
  }

  const w = new Date(wallUtc);
  if (
    w.getUTCFullYear() !== y ||
    w.getUTCMonth() !== m - 1 ||
    w.getUTCDate() !== day ||
    w.getUTCHours() !== hh ||
    w.getUTCMinutes() !== mm ||
    w.getUTCSeconds() !== ss
  ) {
    return new Date(NaN);
  }

  let instant = wallUtc;
  for (let i = 0; i < 2; i++) {
    instant = wallUtc - tzOffsetMs(new Date(instant), NY);
  }

  if (instant + tzOffsetMs(new Date(instant), NY) !== wallUtc) {
    return new Date(NaN);
  }

  return new Date(instant);
}

/** Format a date in the league timezone. */
export function formatNY(date: Date, format: NYFormat): string {
  switch (format) {
    case 'ymd': {
      // YYYY-MM-DD in NY time (calendar-grid keys)
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: NY,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const get = (type: string) => parts.find((p) => p.type === type)?.value;
      return `${get('year')}-${get('month')}-${get('day')}`;
    }
    case 'date-long':
      return date.toLocaleDateString('en-US', {
        timeZone: NY,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    case 'date-short':
      return date.toLocaleDateString('en-US', {
        timeZone: NY,
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    case 'time': {
      const timeStr = date.toLocaleTimeString('en-US', {
        timeZone: NY,
        hour: 'numeric',
        minute: '2-digit',
      });
      return `${timeStr} ET`;
    }
    case 'time-bare':
      return date.toLocaleTimeString('en-US', {
        timeZone: NY,
        hour: 'numeric',
        minute: '2-digit',
      });
  }
}
