import { describe, it, expect, vi } from 'vitest';
import { realtimeHub, RealtimeEvent, SSEClient } from './sse';

describe('SSE Realtime Hub', () => {
  it('registers and unregisters SSE clients', () => {
    const mockSend = vi.fn();
    const mockClose = vi.fn();

    const client: SSEClient = {
      id: 'test-client-1',
      userId: 'user-123',
      groupId: 'group-456',
      send: mockSend,
      close: mockClose,
    };

    const unregister = realtimeHub.registerClient(client);
    expect(realtimeHub.getClientCount()).toBeGreaterThanOrEqual(1);

    unregister();
    // After unregister, the count should have decreased
    realtimeHub.unregisterClient(client);
  });

  it('broadcasts group events to matching clients and formats SSE correctly', async () => {
    const received1: string[] = [];
    const received2: string[] = [];

    const clientGroupA: SSEClient = {
      id: 'client-group-a',
      userId: 'user-1',
      groupId: 'group-a',
      send: (data) => received1.push(data),
      close: () => {},
    };

    const clientGroupB: SSEClient = {
      id: 'client-group-b',
      userId: 'user-2',
      groupId: 'group-b',
      send: (data) => received2.push(data),
      close: () => {},
    };

    const unreg1 = realtimeHub.registerClient(clientGroupA);
    const unreg2 = realtimeHub.registerClient(clientGroupB);

    try {
      await realtimeHub.broadcast(
        {
          type: 'group_message_created',
          groupId: 'group-a',
          userId: 'user-1',
          payload: { message: 'Hola grupo A' },
        },
        true // fromRemote=true avoids hitting Postgres in unit tests
      );

      // Client in Group A should receive the event
      expect(received1.length).toBe(1);
      expect(received1[0]).toContain('event: message');
      expect(received1[0]).toContain('group_message_created');
      expect(received1[0]).toContain('Hola grupo A');

      // Client in Group B should NOT receive the event targeted at Group A
      expect(received2.length).toBe(0);
    } finally {
      unreg1();
      unreg2();
    }
  });

  it('broadcasts global notifications to all connected clients', async () => {
    const received: string[] = [];

    const client: SSEClient = {
      id: 'client-all',
      userId: 'user-x',
      send: (data) => received.push(data),
      close: () => {},
    };

    const unreg = realtimeHub.registerClient(client);

    try {
      await realtimeHub.broadcast(
        {
          type: 'notification_created',
          payload: { title: 'Aviso global', body: 'Alerta para todos' },
        },
        true
      );

      expect(received.length).toBe(1);
      expect(received[0]).toContain('notification_created');
      expect(received[0]).toContain('Aviso global');
    } finally {
      unreg();
    }
  });

  it('broadcasts expense_created and settlement_created events in real time', async () => {
    const received: string[] = [];
    const client: SSEClient = {
      id: 'client-group-exp',
      groupId: 'group-realtime-1',
      send: (data) => received.push(data),
      close: () => {},
    };

    const unreg = realtimeHub.registerClient(client);

    try {
      await realtimeHub.broadcast(
        {
          type: 'expense_created',
          groupId: 'group-realtime-1',
          payload: { id: 'exp-1', title: 'Cena en Menorca', amount: 45.5 },
        },
        true
      );

      await realtimeHub.broadcast(
        {
          type: 'settlement_created',
          groupId: 'group-realtime-1',
          payload: { id: 'stl-1', amount: 20 },
        },
        true
      );

      expect(received.length).toBe(2);
      expect(received[0]).toContain('expense_created');
      expect(received[0]).toContain('Cena en Menorca');
      expect(received[1]).toContain('settlement_created');
      expect(received[1]).toContain('"amount":20');
    } finally {
      unreg();
    }
  });

  it('broadcasts member_joined and group_updated events in real time', async () => {
    const received: string[] = [];
    const client: SSEClient = {
      id: 'client-group-meta',
      groupId: 'group-meta-1',
      send: (data) => received.push(data),
      close: () => {},
    };

    const unreg = realtimeHub.registerClient(client);

    try {
      await realtimeHub.broadcast(
        {
          type: 'member_joined',
          groupId: 'group-meta-1',
          payload: { member: { id: 'gm-new', role: 'member' } },
        },
        true
      );

      await realtimeHub.broadcast(
        {
          type: 'group_updated',
          groupId: 'group-meta-1',
          payload: { id: 'group-meta-1', name: 'Viaje a Japón 2026', cover_image_url: 'https://images.unsplash.com/...' },
        },
        true
      );

      await realtimeHub.broadcast(
        {
          type: 'expense_comment_created',
          groupId: 'group-meta-1',
          payload: { id: 'comm-1', comment: '¡Qué buen plan!' },
        },
        true
      );

      expect(received.length).toBe(3);
      expect(received[0]).toContain('member_joined');
      expect(received[0]).toContain('gm-new');
      expect(received[1]).toContain('group_updated');
      expect(received[1]).toContain('Viaje a Japón 2026');
      expect(received[2]).toContain('expense_comment_created');
      expect(received[2]).toContain('¡Qué buen plan!');
    } finally {
      unreg();
    }
  });
});
