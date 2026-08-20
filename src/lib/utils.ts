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
