import { TIMEZONE } from '../config/constants';

function zonedDate(date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const hour = get('hour') === '24' ? '00' : get('hour');
  return new Date(
    `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`
  );
}

export function getDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return getDateKey(date);
}

export function isConsecutiveDay(previous: string, current: string): boolean {
  if (!previous) return false;
  const expected = addDaysToDateKey(previous, 1);
  return expected === current;
}

export function isSameDay(previous: string, current: string): boolean {
  return previous === current;
}

export function zonedNow(): Date {
  return zonedDate();
}
