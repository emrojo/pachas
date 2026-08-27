import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueSyncAction,
  getSyncQueue,
  removeSyncAction,
  clearSyncQueue,
  processSyncQueue,
} from './syncManager';

describe('Offline Sync Manager', () => {
  beforeEach(() => {
    clearSyncQueue();
  });

  it('enqueues an action and retrieves it from queue', () => {
    expect(getSyncQueue().length).toBe(0);

    const action = enqueueSyncAction({
      type: 'CREATE_EXPENSE',
      entityId: 'exp-test-1',
      groupId: 'grp-test',
      payload: { id: 'exp-test-1', title: 'Cena offline', amount: 45 },
    });

    expect(action.id).toBeDefined();
    expect(action.type).toBe('CREATE_EXPENSE');
    expect(action.entityId).toBe('exp-test-1');

    const queue = getSyncQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].entityId).toBe('exp-test-1');
  });

  it('removes an action by id', () => {
    const a1 = enqueueSyncAction({
      type: 'CREATE_EXPENSE',
      entityId: 'exp-1',
      payload: { id: 'exp-1' },
    });
    const a2 = enqueueSyncAction({
      type: 'CREATE_EXPENSE',
      entityId: 'exp-2',
      payload: { id: 'exp-2' },
    });

    expect(getSyncQueue().length).toBe(2);

    removeSyncAction(a1.id);
    const queue = getSyncQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(a2.id);
  });

  it('processes queue and calls client upsert/delete', async () => {
    enqueueSyncAction({
      type: 'DELETE_EXPENSE',
      entityId: 'exp-to-del',
      groupId: 'grp-1',
      payload: null,
    });

    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        delete: mockDelete,
      }),
    };

    const syncedItems: any[] = [];
    const res = await processSyncQueue(mockSupabase, (item) => {
      syncedItems.push(item);
    });

    expect(res.successCount).toBe(1);
    expect(res.failureCount).toBe(0);
    expect(syncedItems.length).toBe(1);
    expect(syncedItems[0].entityId).toBe('exp-to-del');
    expect(getSyncQueue().length).toBe(0);
  });
});
