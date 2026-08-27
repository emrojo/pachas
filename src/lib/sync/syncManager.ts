import { Expense, Settlement, Group } from '@/types/database';

export type SyncActionType =
  | 'CREATE_EXPENSE'
  | 'UPDATE_EXPENSE'
  | 'DELETE_EXPENSE'
  | 'CREATE_SETTLEMENT'
  | 'CREATE_GROUP'
  | 'JOIN_GROUP';

export interface SyncAction {
  id: string;
  type: SyncActionType;
  entityId: string;
  groupId?: string;
  payload: any;
  timestamp: number;
  retryCount: number;
}

const SYNC_QUEUE_STORAGE_KEY = 'pachas_sync_queue_v1';
let memoryQueueStore: SyncAction[] = [];

export function getSyncQueue(): SyncAction[] {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading sync queue from localStorage:', e);
      return memoryQueueStore;
    }
  }
  return memoryQueueStore;
}

export function saveSyncQueue(queue: SyncAction[]): void {
  memoryQueueStore = [...queue];
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Error saving sync queue to localStorage:', e);
    }
  }
}

export function enqueueSyncAction(action: Omit<SyncAction, 'id' | 'timestamp' | 'retryCount'>): SyncAction {
  const queue = getSyncQueue();
  const newAction: SyncAction = {
    ...action,
    id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0,
  };

  // Remove existing pending action for same entity if overwriting
  const filtered = queue.filter(
    (item) => !(item.type === action.type && item.entityId === action.entityId)
  );

  filtered.push(newAction);
  saveSyncQueue(filtered);
  return newAction;
}

export function removeSyncAction(id: string): void {
  const queue = getSyncQueue();
  const updated = queue.filter((item) => item.id !== id);
  saveSyncQueue(updated);
}

export function clearSyncQueue(): void {
  memoryQueueStore = [];
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(SYNC_QUEUE_STORAGE_KEY);
    } catch (e) {}
  }
}

export async function processSyncQueue(
  supabaseClient: any,
  onItemSynced?: (action: SyncAction) => void
): Promise<{ successCount: number; failureCount: number }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { successCount: 0, failureCount: 0 };
  }



  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;
  const remainingQueue: SyncAction[] = [];

  for (const item of queue) {
    try {
      let isSuccess = false;

      switch (item.type) {
        case 'CREATE_EXPENSE': {
          const expense: Expense = item.payload;
          try {
            const res = await fetch('/api/expenses', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: expense.id,
                groupId: expense.group_id,
                title: expense.title,
                amount: expense.amount,
                currency: expense.currency,
                exchangeRate: expense.exchange_rate,
                convertedAmount: expense.converted_amount,
                category: expense.category,
                expenseDate: expense.expense_date,
                receiptUrl: expense.receipt_url,
                notes: expense.notes,
                splitType: expense.split_type,
                latitude: expense.latitude,
                longitude: expense.longitude,
                locationName: expense.location_name,
                payers: expense.payers,
                participants: expense.participants,
              }),
            });
            if (res.ok) isSuccess = true;
          } catch {}

          if (!isSuccess && supabaseClient?.from) {
            const { error: expError } = await supabaseClient.from('expenses').upsert({
              id: expense.id,
              group_id: expense.group_id,
              created_by: expense.created_by,
              title: expense.title,
              amount: expense.amount,
              currency: expense.currency,
              exchange_rate: expense.exchange_rate,
              converted_amount: expense.converted_amount,
              category: expense.category,
              expense_date: expense.expense_date,
              receipt_url: expense.receipt_url,
              notes: expense.notes,
              split_type: expense.split_type,
              latitude: expense.latitude,
              longitude: expense.longitude,
              location_name: expense.location_name,
            });

            if (!expError) isSuccess = true;
          }
          break;
        }

        case 'UPDATE_EXPENSE': {
          const expense: Expense = item.payload;
          try {
            const res = await fetch(`/api/expenses/${encodeURIComponent(expense.id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: expense.title,
                amount: expense.amount,
                currency: expense.currency,
                exchangeRate: expense.exchange_rate,
                convertedAmount: expense.converted_amount,
                category: expense.category,
                expenseDate: expense.expense_date,
                receiptUrl: expense.receipt_url,
                notes: expense.notes,
                splitType: expense.split_type,
                latitude: expense.latitude,
                longitude: expense.longitude,
                locationName: expense.location_name,
                payers: expense.payers,
                participants: expense.participants,
              }),
            });
            if (res.ok) isSuccess = true;
          } catch {}

          if (!isSuccess && supabaseClient?.from) {
            const { error } = await supabaseClient
              .from('expenses')
              .update({
                title: expense.title,
                amount: expense.amount,
                currency: expense.currency,
                exchange_rate: expense.exchange_rate,
                converted_amount: expense.converted_amount,
                category: expense.category,
                expense_date: expense.expense_date,
                receipt_url: expense.receipt_url,
                notes: expense.notes,
                split_type: expense.split_type,
                latitude: expense.latitude,
                longitude: expense.longitude,
                location_name: expense.location_name,
                updated_at: new Date().toISOString(),
              })
              .eq('id', expense.id);

            if (!error) isSuccess = true;
          }
          break;
        }

        case 'DELETE_EXPENSE': {
          try {
            const res = await fetch(`/api/expenses/${encodeURIComponent(item.entityId)}`, {
              method: 'DELETE',
            });
            if (res.ok) isSuccess = true;
          } catch {}

          if (!isSuccess && supabaseClient?.from) {
            const { error } = await supabaseClient
              .from('expenses')
              .delete()
              .eq('id', item.entityId);
            if (!error) isSuccess = true;
          }
          break;
        }

        case 'CREATE_SETTLEMENT': {
          const settlement: Settlement = item.payload;
          try {
            const res = await fetch('/api/settlements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: settlement.id,
                groupId: settlement.group_id,
                fromUserId: settlement.from_user_id,
                toUserId: settlement.to_user_id,
                amount: settlement.amount,
                currency: settlement.currency,
                paymentMethod: settlement.payment_method,
                notes: settlement.notes,
                settledAt: settlement.settled_at,
              }),
            });
            if (res.ok) isSuccess = true;
          } catch {}

          if (!isSuccess && supabaseClient?.from) {
            const { error } = await supabaseClient.from('settlements').upsert({
              id: settlement.id,
              group_id: settlement.group_id,
              from_user_id: settlement.from_user_id,
              to_user_id: settlement.to_user_id,
              amount: settlement.amount,
              currency: settlement.currency,
              payment_method: settlement.payment_method,
              notes: settlement.notes,
              settled_at: settlement.settled_at,
            });
            if (!error) isSuccess = true;
          }
          break;
        }


        case 'CREATE_GROUP': {
          const group: Group = item.payload;
          const { error } = await supabaseClient.from('groups').upsert({
            id: group.id,
            name: group.name,
            description: group.description,
            icon_emoji: group.icon_emoji,
            cover_image_url: group.cover_image_url,
            base_currency: group.base_currency,
            invite_code: group.invite_code,
            created_by: group.created_by,
          });
          if (!error) isSuccess = true;
          break;
        }

        case 'JOIN_GROUP': {
          const { inviteCode } = item.payload;
          try {
            const res = await fetch('/api/groups/join', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inviteCode }),
            });
            if (res.ok) isSuccess = true;
          } catch {}
          break;
        }
      }

      if (isSuccess) {
        successCount++;
        if (onItemSynced) onItemSynced(item);
      } else {
        failureCount++;
        remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
      }
    } catch (err) {
      console.warn('Sync item failure:', item, err);
      failureCount++;
      remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
    }
  }

  saveSyncQueue(remainingQueue);
  return { successCount, failureCount };
}
