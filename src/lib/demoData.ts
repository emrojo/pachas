import { Group, Profile, GroupMember, Expense, Settlement } from '@/types/database';

export const DEMO_USERS: Profile[] = [
  {
    id: 'user-edu',
    email: 'edu@example.com',
    full_name: 'Eduardo Martín',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    bizum_phone: '+34 600 123 456',
    role: 'admin',
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'user-lucia',
    email: 'lucia@example.com',
    full_name: 'Lucía Gómez',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    bizum_phone: '+34 611 222 333',
    role: 'member',
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'user-carlos',
    email: 'carlos@example.com',
    full_name: 'Carlos Ruiz',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    bizum_phone: '+34 622 333 444',
    role: 'member',
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'user-marta',
    email: 'marta@example.com',
    full_name: 'Marta Soler',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    bizum_phone: '+34 633 444 555',
    role: 'member',
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'user-javi',
    email: 'javi@example.com',
    full_name: 'Javier Ortiz',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    bizum_phone: '+34 644 555 666',
    role: 'member',
    created_at: '2026-06-01T10:00:00Z',
  },
];

export const DEMO_CURRENT_USER = DEMO_USERS[0]; // Eduardo

export const DEMO_GROUPS: Group[] = [];

export const DEMO_MEMBERS: Record<string, GroupMember[]> = {};

export const DEMO_EXPENSES: Record<string, Expense[]> = {};

export const DEMO_SETTLEMENTS: Record<string, Settlement[]> = {};

