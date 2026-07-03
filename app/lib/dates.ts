/**
 * League-standard date formatting: everything user-facing renders in the
 * league's timezone (America/New_York) regardless of the viewer's locale.
 */
const NY = 'America/New_York';

export type NYFormat = 'ymd' | 'date-long' | 'date-short' | 'time';

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
    case 'time':
      return date.toLocaleTimeString('en-US', {
        timeZone: NY,
        hour: 'numeric',
        minute: '2-digit',
      });
  }
}
