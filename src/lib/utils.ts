import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats dates following European standard:
 * Default: 'dd/MM/yyyy' (e.g. 15/08/2026)
 * Medium: 'd MMM yyyy' (e.g. 15 ago 2026)
 * Long: 'd 'de' MMMM 'de' yyyy' (e.g. 15 de agosto de 2026)
 */
export function formatDate(dateString: string, formatStr: string = 'dd/MM/yyyy'): string {
  try {
    const date = parseISO(dateString);
    return format(date, formatStr, { locale: es });
  } catch {
    return dateString;
  }
}

export function formatEuropeanDate(dateString: string): string {
  return formatDate(dateString, 'dd/MM/yyyy');
}

export function formatEuropeanDateTime(dateString: string): string {
  return formatDate(dateString, 'dd/MM/yyyy HH:mm');
}

/**
 * Formats a date string or Date object strictly following the standard European day/month/year (dd/MM/yyyy) convention.
 */
export function formatLocaleDate(
  dateStrOrObj?: string | Date | null,
  _language: string = 'es'
): string {
  if (!dateStrOrObj) return '';
  try {
    const rawStr = typeof dateStrOrObj === 'string' ? dateStrOrObj.trim() : '';
    let date: Date;

    if (dateStrOrObj instanceof Date) {
      date = dateStrOrObj;
    } else if (rawStr.includes('T') || rawStr.includes(' ')) {
      const cleanDatePart = rawStr.split('T')[0].split(' ')[0];
      const parts = cleanDatePart.split('-');
      if (parts.length === 3) {
        date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        date = new Date(rawStr);
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawStr)) {
      const [y, m, d] = rawStr.split('-').map(Number);
      date = new Date(y, m - 1, d);
    } else {
      date = new Date(rawStr);
    }

    if (isNaN(date.getTime())) {
      return String(dateStrOrObj);
    }

    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  } catch {
    return String(dateStrOrObj);
  }
}

/**
 * Returns current local date-time string in ISO format preserving timezone offset (e.g. 2026-08-20T20:44:00+02:00)
 */
export function getCurrentDateTimeISOWithTimezone(date: Date = new Date()): string {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = (num: number) => (num < 10 ? '0' : '') + num;

  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    dif +
    pad(Math.floor(Math.abs(tzo) / 60)) +
    ':' +
    pad(Math.abs(tzo) % 60)
  );
}

/**
 * Converts a date or ISO string into an HTML <input type="datetime-local"> value (YYYY-MM-DDTHH:mm)
 */
export function toDateTimeLocalValue(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

/**
 * Converts a datetime-local input string into ISO format with timezone offset
 */
export function fromDateTimeLocalToISOWithTimezone(localValue: string): string {
  if (!localValue) return getCurrentDateTimeISOWithTimezone();
  const d = new Date(localValue);
  if (isNaN(d.getTime())) return getCurrentDateTimeISOWithTimezone();
  return getCurrentDateTimeISOWithTimezone(d);
}

/**
 * Returns user timezone info label, e.g. "GMT+2 (Europe/Madrid)"
 */
export function getUserTimezoneLabel(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const hours = Math.floor(Math.abs(offsetMin) / 60);
    const mins = Math.abs(offsetMin) % 60;
    const gmt = `GMT${sign}${hours}${mins > 0 ? `:${mins < 10 ? '0' : ''}${mins}` : ''}`;
    return `${gmt} (${timeZone})`;
  } catch {
    return 'Hora local';
  }
}

export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-emerald-500 text-white',
    'bg-blue-500 text-white',
    'bg-indigo-500 text-white',
    'bg-purple-500 text-white',
    'bg-rose-500 text-white',
    'bg-amber-500 text-white',
    'bg-teal-500 text-white',
    'bg-cyan-500 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
