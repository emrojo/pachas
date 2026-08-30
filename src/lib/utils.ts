import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats dates strictly following European standard (day first):
 * Default: 'dd/MM/yyyy' (e.g. 30/08/2026)
 * With time: 'dd/MM/yyyy HH:mm' (e.g. 30/08/2026 14:35)
 * Medium: 'd MMM' (e.g. 30 ago) or 'd MMM, HH:mm' (e.g. 30 ago, 14:35)
 * NOTE: Month-first format (MM/DD/YYYY) is strictly prohibited.
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  formatStr: string = 'dd/MM/yyyy'
): string {
  if (!dateString) return '';
  try {
    // Strictly prevent any month-first format pattern
    let safeFormat = formatStr
      .replace(/MM\/dd/g, 'dd/MM')
      .replace(/MM-dd/g, 'dd-MM')
      .replace(/MM\.dd/g, 'dd.MM');

    if (dateString instanceof Date) {
      if (isNaN(dateString.getTime())) return '';
      return format(dateString, safeFormat, { locale: es });
    }

    const str = String(dateString).trim();

    // 1. Pure date "YYYY-MM-DD"
    const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const y = Number(dateOnly[1]);
      const m = Number(dateOnly[2]) - 1;
      const d = Number(dateOnly[3]);
      const dateObj = new Date(y, m, d);
      return format(dateObj, safeFormat, { locale: es });
    }

    // 2. Date and time without timezone skew "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm:ss"
    const matchNoZ = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (matchNoZ) {
      const y = Number(matchNoZ[1]);
      const m = Number(matchNoZ[2]) - 1;
      const d = Number(matchNoZ[3]);
      const h = Number(matchNoZ[4]);
      const min = Number(matchNoZ[5]);
      const s = matchNoZ[6] ? Number(matchNoZ[6]) : 0;
      const dateObj = new Date(y, m, d, h, min, s);
      return format(dateObj, safeFormat, { locale: es });
    }

    // 3. Fallback ISO parser
    const date = parseISO(str);
    if (!isNaN(date.getTime())) {
      return format(date, safeFormat, { locale: es });
    }

    return str;
  } catch {
    return String(dateString);
  }
}

export function formatEuropeanDate(dateString: string | Date | null | undefined): string {
  return formatDate(dateString, 'dd/MM/yyyy');
}

export function formatEuropeanDateTime(dateString: string | Date | null | undefined): string {
  return formatDate(dateString, 'dd/MM/yyyy HH:mm');
}

/**
 * Checks whether an expense date string contains a real, non-midnight specific time
 */
export function hasSpecificTime(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const str = String(dateStr).trim();
  const match = str.match(/[T\s](\d{2}):(\d{2})/);
  if (!match) return false;
  // If hours and minutes are non-zero, it has a specific time
  const h = Number(match[1]);
  const m = Number(match[2]);
  return !(h === 0 && m === 0);
}

/**
 * Formats an expense date for cards and feeds (e.g. "30 ago, 14:35" or "30 ago")
 */
export function formatExpenseDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  if (hasSpecificTime(dateStr)) {
    return formatDate(dateStr, 'd MMM, HH:mm');
  }
  return formatDate(dateStr, 'd MMM');
}

/**
 * Formats a date string or Date object strictly following the standard European day/month/year (dd/MM/yyyy) convention.
 */
export function formatLocaleDate(
  dateStrOrObj?: string | Date | null,
  _language: string = 'es'
): string {
  if (!dateStrOrObj) return '';
  return formatDate(dateStrOrObj, 'dd/MM/yyyy');
}

/**
 * Returns current local date-time string in ISO format preserving timezone offset (e.g. 2026-08-30T20:44:00+02:00)
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
 * Completely immune to timezone skew.
 */
export function toDateTimeLocalValue(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const clean = String(isoString).trim();

    // 1. If format contains date and time "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm"
    const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
    }

    // 2. If only date "YYYY-MM-DD"
    const dateOnlyMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const now = new Date();
      const pad = (n: number) => (n < 10 ? '0' : '') + n;
      return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    // 3. European format "DD/MM/YYYY HH:mm" or "DD/MM/YYYY"
    const euMatch = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})(?:[T\s](\d{2}):(\d{2}))?/);
    if (euMatch) {
      const d = euMatch[1].padStart(2, '0');
      const m = euMatch[2].padStart(2, '0');
      const y = euMatch[3];
      const h = euMatch[4] || '12';
      const min = euMatch[5] || '00';
      return `${y}-${m}-${d}T${h}:${min}`;
    }

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
  const clean = localValue.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    const h = Number(match[4]);
    const min = Number(match[5]);
    const dateObj = new Date(y, m, d, h, min, 0);
    return getCurrentDateTimeISOWithTimezone(dateObj);
  }
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
