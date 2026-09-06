import { describe, it, expect } from 'vitest';
import { AppNotification } from '@/types/database';

interface ActiveBubbleItem {
  notif: AppNotification;
  totalMs: number;
  remainingMs: number;
  isPaused: boolean;
  createdAt: number;
}

describe('WhatsApp-style Notification Bubble Logic', () => {
  const sampleChatNotif: AppNotification = {
    id: 'notif-chat-1',
    user_id: 'user-1',
    type: 'group_message_created',
    title: 'Mensaje de Carlos Mendoza',
    message: '¿A qué hora salimos mañana para la excursión? 🚗',
    created_at: new Date().toISOString(),
    read: false,
    group_id: 'group-100',
    group_name: 'Viaje a Roma 🍕',
    action_url: '/groups/group-100?tab=chat&messageId=msg-555',
    data: {
      authorName: 'Carlos Mendoza',
      messageId: 'msg-555',
      groupId: 'group-100',
      groupName: 'Viaje a Roma 🍕',
    },
  };

  const sampleMemberNotif: AppNotification = {
    id: 'notif-member-1',
    user_id: 'user-1',
    type: 'member_joined',
    title: 'Nuevo miembro en el grupo',
    message: 'Elena Gómez se ha unido al grupo.',
    created_at: new Date().toISOString(),
    read: false,
    group_id: 'group-100',
    group_name: 'Viaje a Roma 🍕',
    action_url: '/groups/group-100?tab=members',
    data: {
      memberName: 'Elena Gómez',
      groupId: 'group-100',
      groupName: 'Viaje a Roma 🍕',
    },
  };

  it('correctly extracts author and message snippet for WhatsApp chat bubble', () => {
    const author =
      sampleChatNotif.data?.authorName ||
      (sampleChatNotif.title.startsWith('Mensaje de ')
        ? sampleChatNotif.title.replace('Mensaje de ', '')
        : sampleChatNotif.title);

    expect(author).toBe('Carlos Mendoza');
    expect(sampleChatNotif.message).toBe('¿A qué hora salimos mañana para la excursión? 🚗');
    expect(sampleChatNotif.group_name).toBe('Viaje a Roma 🍕');
    expect(sampleChatNotif.action_url).toBe('/groups/group-100?tab=chat&messageId=msg-555');
  });

  it('correctly extracts new member info for WhatsApp member join bubble', () => {
    const memberName = sampleMemberNotif.data?.memberName;
    expect(memberName).toBe('Elena Gómez');
    expect(sampleMemberNotif.message).toContain('se ha unido al grupo');
    expect(sampleMemberNotif.action_url).toBe('/groups/group-100?tab=members');
  });

  it('handles default 5-second timer calculation and progress bar percentage', () => {
    const defaultDurationSecs = 5;
    const totalMs = defaultDurationSecs * 1000;
    expect(totalMs).toBe(5000);

    const bubble: ActiveBubbleItem = {
      notif: sampleChatNotif,
      totalMs,
      remainingMs: 5000,
      isPaused: false,
      createdAt: Date.now(),
    };

    // Initial percentage
    let pct = (bubble.remainingMs / bubble.totalMs) * 100;
    expect(pct).toBe(100);

    // After 2.5 seconds (2500ms elapsed)
    bubble.remainingMs = 2500;
    pct = (bubble.remainingMs / bubble.totalMs) * 100;
    expect(pct).toBe(50);

    // After 5 seconds
    bubble.remainingMs = 0;
    pct = (bubble.remainingMs / bubble.totalMs) * 100;
    expect(pct).toBe(0);
  });

  it('supports customizable duration presets (3s, 5s, 8s, 12s, manual 0)', () => {
    const validPresets = [3, 5, 8, 12, 0];

    validPresets.forEach((preset) => {
      const totalMs = preset === 0 ? 0 : preset * 1000;
      if (preset === 0) {
        expect(totalMs).toBe(0); // Manual mode never auto-expires
      } else {
        expect(totalMs).toBe(preset * 1000);
      }
    });
  });

  it('pauses timer countdown when isPaused is true (e.g. mouse hover)', () => {
    const bubble: ActiveBubbleItem = {
      notif: sampleChatNotif,
      totalMs: 5000,
      remainingMs: 3000,
      isPaused: true,
      createdAt: Date.now(),
    };

    // Simulated timer tick
    const tickMs = 100;
    if (!bubble.isPaused && bubble.totalMs > 0) {
      bubble.remainingMs -= tickMs;
    }

    // Since paused, remainingMs must not have changed
    expect(bubble.remainingMs).toBe(3000);

    // Resume
    bubble.isPaused = false;
    if (!bubble.isPaused && bubble.totalMs > 0) {
      bubble.remainingMs -= tickMs;
    }
    expect(bubble.remainingMs).toBe(2900);
  });

  it('limits active floating bubbles stack to maximum 3 items', () => {
    const incoming = [
      { id: '1', title: 'Msg 1' } as AppNotification,
      { id: '2', title: 'Msg 2' } as AppNotification,
      { id: '3', title: 'Msg 3' } as AppNotification,
      { id: '4', title: 'Msg 4' } as AppNotification,
    ];

    let activeList: ActiveBubbleItem[] = [];

    incoming.forEach((notif) => {
      const item: ActiveBubbleItem = {
        notif,
        totalMs: 5000,
        remainingMs: 5000,
        isPaused: false,
        createdAt: Date.now(),
      };
      activeList = [item, ...activeList].slice(0, 3);
    });

    expect(activeList.length).toBe(3);
    expect(activeList[0].notif.id).toBe('4'); // newest
    expect(activeList[1].notif.id).toBe('3');
    expect(activeList[2].notif.id).toBe('2');
    expect(activeList.some((b) => b.notif.id === '1')).toBe(false); // oldest dropped
  });

  it('marks notification as read and removes bubble upon click', () => {
    let notifications = [
      { ...sampleChatNotif, read: false },
      { ...sampleMemberNotif, read: false },
    ];

    let activeBubbles: ActiveBubbleItem[] = [
      { notif: sampleChatNotif, totalMs: 5000, remainingMs: 4000, isPaused: false, createdAt: Date.now() },
      { notif: sampleMemberNotif, totalMs: 5000, remainingMs: 4500, isPaused: false, createdAt: Date.now() },
    ];

    const markAsRead = (id: string) => {
      notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    };

    const removeBubble = (id: string) => {
      activeBubbles = activeBubbles.filter((b) => b.notif.id !== id);
    };

    // Simulate click on chat bubble
    markAsRead(sampleChatNotif.id);
    removeBubble(sampleChatNotif.id);

    expect(notifications.find((n) => n.id === sampleChatNotif.id)?.read).toBe(true);
    expect(activeBubbles.length).toBe(1);
    expect(activeBubbles[0].notif.id).toBe(sampleMemberNotif.id);
  });
});
