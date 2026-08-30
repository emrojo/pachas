import { Group, Profile, GroupMember, Expense, Settlement, AppNotification } from '@/types/database';

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

export const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-demo-1',
    user_id: 'user-edu',
    type: 'receipt_pending',
    title: '🧾 Ticket listo para validar',
    message: 'Se ha procesado "Restaurante El Faro" (48,50 €) mediante IA. Valídalo para añadirlo al grupo.',
    created_at: '2026-08-30T17:30:00Z',
    read: false,
    group_name: 'Vacaciones Playa',
    action_url: '/notifications',
    data: { scanId: 'scan-demo-1' },
  },
  {
    id: 'notif-demo-2',
    user_id: 'user-edu',
    type: 'comment_created',
    title: '💬 Nuevo comentario en gasto',
    message: 'Lucía Gómez: "¡Qué buena paella comimos ayer! Ya he revisado las cuentas 🥘"',
    created_at: '2026-08-30T16:15:00Z',
    read: false,
    group_name: 'Vacaciones Playa',
    action_url: '/notifications',
  },
  {
    id: 'notif-demo-3',
    user_id: 'user-edu',
    type: 'expense_created',
    title: '💸 Nuevo gasto añadido',
    message: 'Carlos Ruiz ha añadido "Gasolina coche de alquiler" por importe de 35,00 €.',
    created_at: '2026-08-30T14:00:00Z',
    read: true,
    group_name: 'Vacaciones Playa',
    action_url: '/notifications',
  },
  {
    id: 'notif-demo-4',
    user_id: 'user-edu',
    type: 'group_role_updated',
    title: '🛡️ Cambio de rol en el grupo',
    message: 'Ahora eres administrador del grupo. Tienes permisos para editar el nombre, divisa y gestionar miembros.',
    created_at: '2026-08-29T19:00:00Z',
    read: true,
    group_name: 'Vacaciones Playa',
    action_url: '/notifications',
  },
  {
    id: 'notif-demo-5',
    user_id: 'user-edu',
    type: 'settlement_created',
    title: '🤝 Pago / Liquidación recibida',
    message: 'Marta Soler ha registrado un pago de 22,50 € a tu favor.',
    created_at: '2026-08-29T11:20:00Z',
    read: true,
    group_name: 'Vacaciones Playa',
    action_url: '/notifications',
  },
];

