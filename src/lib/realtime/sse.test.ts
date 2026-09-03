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
});
