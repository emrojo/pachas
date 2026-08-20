import { ExpenseCategory } from '@/types/database';

export interface CategoryInfo {
  id: ExpenseCategory;
  label: string;
  emoji: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const CATEGORIES: Record<ExpenseCategory, CategoryInfo> = {
  food: {
    id: 'food',
    label: 'Comida & Restaurantes',
    emoji: '🍽️',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-500/30',
  },
  accommodation: {
    id: 'accommodation',
    label: 'Alojamiento & Hoteles',
    emoji: '🏨',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-500/30',
  },
  transport: {
    id: 'transport',
    label: 'Transporte & Gasolina',
    emoji: '🚗',
    bgColor: 'bg-purple-500/10 dark:bg-purple-500/20',
    textColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-500/30',
  },
  activities: {
    id: 'activities',
    label: 'Ocio & Actividades',
    emoji: '🎟️',
    bgColor: 'bg-rose-500/10 dark:bg-rose-500/20',
    textColor: 'text-rose-600 dark:text-rose-400',
    borderColor: 'border-rose-500/30',
  },
  shopping: {
    id: 'shopping',
    label: 'Supermercado & Compras',
    emoji: '🛒',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
  other: {
    id: 'other',
    label: 'Otros gastos',
    emoji: '💡',
    bgColor: 'bg-gray-500/10 dark:bg-gray-500/20',
    textColor: 'text-gray-600 dark:text-gray-400',
    borderColor: 'border-gray-500/30',
  },
};

export function getCategoryInfo(category: ExpenseCategory): CategoryInfo {
  return CATEGORIES[category] || CATEGORIES.other;
}
