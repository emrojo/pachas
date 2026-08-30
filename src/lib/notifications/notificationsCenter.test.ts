import { describe, it, expect } from 'vitest';
import { AppNotification, NotificationType } from '@/types/database';
import { formatDate } from '@/lib/utils';

describe('Unified Notification Center Logic', () => {
  const sampleNotifications: AppNotification[] = [
    {
      id: 'notif-1',
      user_id: 'user-1',
      type: 'receipt_pending',
      title: '🧾 Ticket listo para validar',
      message: 'Se ha procesado "Restaurante El Faro" (48,50 €). Valídalo para añadirlo.',
      created_at: '2026-08-30T14:30:00Z',
      read: false,
      group_id: 'group-1',
      group_name: 'Vacaciones Playa',
      action_url: '/groups/group-1',
      data: { scanId: 'scan-1' },
    },
    {
      id: 'notif-2',
      user_id: 'user-1',
      type: 'comment_created',
      title: '💬 Nuevo comentario',
      message: 'Lucía: "¡Menuda paella más rica!"',
      created_at: '2026-08-30T15:00:00Z',
      read: false,
      group_id: 'group-1',
      group_name: 'Vacaciones Playa',
      action_url: '/groups/group-1',
    },
    {
      id: 'notif-3',
      user_id: 'user-1',
      type: 'expense_created',
      title: '💸 Nuevo gasto añadido',
      message: 'Carlos ha añadido "Gasolina coche" (65,00 €).',
      created_at: '2026-08-29T10:00:00Z',
      read: true,
      group_id: 'group-1',
      group_name: 'Vacaciones Playa',
      action_url: '/groups/group-1',
    },
    {
      id: 'notif-4',
      user_id: 'user-1',
      type: 'group_role_updated',
      title: '🛡️ Cambio de rol en el grupo',
      message: 'Ahora eres administrador del grupo "Vacaciones Playa".',
      created_at: '2026-08-28T09:00:00Z',
      read: true,
      group_id: 'group-1',
      group_name: 'Vacaciones Playa',
    },
  ];

  it('calculates unread notifications count correctly', () => {
    const unreadCount = sampleNotifications.filter((n) => !n.read).length;
    expect(unreadCount).toBe(2);
  });

  it('filters notifications by category (payments, comments, groups)', () => {
    const payments = sampleNotifications.filter((n) =>
      ['receipt_pending', 'settlement_created', 'expense_created'].includes(n.type)
    );
    expect(payments.length).toBe(2);
    expect(payments.map((p) => p.id)).toEqual(['notif-1', 'notif-3']);

    const comments = sampleNotifications.filter((n) =>
      ['comment_created', 'comment_reaction'].includes(n.type)
    );
    expect(comments.length).toBe(1);
    expect(comments[0].id).toBe('notif-2');

    const groups = sampleNotifications.filter((n) =>
      ['group_role_updated', 'member_joined', 'expense_updated', 'expense_deleted'].includes(n.type)
    );
    expect(groups.length).toBe(1);
    expect(groups[0].id).toBe('notif-4');
  });

  it('marks individual notification as read', () => {
    const markAsRead = (list: AppNotification[], id: string) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n));

    const updated = markAsRead(sampleNotifications, 'notif-1');
    expect(updated.find((n) => n.id === 'notif-1')?.read).toBe(true);
    expect(updated.filter((n) => !n.read).length).toBe(1);
  });

  it('marks all notifications as read', () => {
    const markAllRead = (list: AppNotification[]) => list.map((n) => ({ ...n, read: true }));
    const allRead = markAllRead(sampleNotifications);
    expect(allRead.every((n) => n.read)).toBe(true);
    expect(allRead.filter((n) => !n.read).length).toBe(0);
  });

  it('formats dates strictly in DD/MM/YYYY HH:mm without MM/DD/YYYY', () => {
    const formatted = formatDate('2026-08-30T14:30:00Z', 'dd/MM/yyyy HH:mm');
    expect(formatted).toMatch(/^30\/08\/2026/);
    expect(formatted).not.toContain('08/30/2026');
  });
});
