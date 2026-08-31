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
  title?: string;
  groupName?: string;
  lastError?: string;
  errorStatus?: number;
  lastAttemptTimestamp?: number;
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

  // Extract a user-friendly title and group name if available
  let derivedTitle = action.title;
  let derivedGroupName = action.groupName;

  if (!derivedTitle && action.payload) {
    if (action.type === 'CREATE_EXPENSE' || action.type === 'UPDATE_EXPENSE') {
      derivedTitle = action.payload.title ? `Gasto: ${action.payload.title}` : 'Gasto';
    } else if (action.type === 'DELETE_EXPENSE') {
      derivedTitle = `Eliminar gasto (${action.entityId.slice(0, 8)})`;
    } else if (action.type === 'CREATE_SETTLEMENT') {
      derivedTitle = `Liquidación: ${action.payload.amount} ${action.payload.currency || 'EUR'}`;
    } else if (action.type === 'CREATE_GROUP') {
      derivedTitle = `Grupo: ${action.payload.name || 'Nuevo grupo'}`;
    } else if (action.type === 'JOIN_GROUP') {
      derivedTitle = `Unirse con código ${action.payload.inviteCode || ''}`;
    }
  }

  const newAction: SyncAction = {
    ...action,
    id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0,
    title: derivedTitle || 'Registro pendiente',
    groupName: derivedGroupName,
    lastError: typeof navigator !== 'undefined' && !navigator.onLine ? 'Guardado sin conexión' : undefined,
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

export function getPendingSyncActions(): SyncAction[] {
  return getSyncQueue();
}

export async function processSyncQueue(
  supabaseClient: any,
  onItemSynced?: (action: SyncAction) => void
): Promise<{ successCount: number; failureCount: number }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // Tag all items as offline
    const q = getSyncQueue().map((item) => ({
      ...item,
      lastError: 'Dispositivo sin conexión a internet',
      errorStatus: 0,
      lastAttemptTimestamp: Date.now(),
    }));
    saveSyncQueue(q);
    return { successCount: 0, failureCount: q.length };
  }

  const queue = getSyncQueue();
  if (queue.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  let successCount = 0;
  let failureCount = 0;
  const remainingQueue: SyncAction[] = [];

  for (const item of queue) {
    let lastErrorMsg = 'Error desconocido al sincronizar';
    let statusCode = 0;

    try {
      let isSuccess = false;

      // If an item has failed 3+ times, drop it so it never gets stuck permanently
      if (item.retryCount >= 3) {
        console.warn(`Sync item ${item.id} (${item.type}) exceeded max retries. Dropping.`);
        successCount++;
        if (onItemSynced) onItemSynced(item);
        continue;
      }

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
            statusCode = res.status;
            if (res.ok || res.status === 400 || res.status === 404 || res.status === 409 || res.status === 422) {
              isSuccess = true;
            } else {
              const resJson = await res.json().catch(() => ({}));
              lastErrorMsg = resJson.error || `Error en servidor HTTP ${res.status}: ${res.statusText}`;
            }
          } catch (fetchErr: any) {
            lastErrorMsg = fetchErr.message || 'Error de red o conexión al servidor';
          }

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

            if (!expError) {
              isSuccess = true;
            } else {
              lastErrorMsg = expError.message || lastErrorMsg;
            }
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
            statusCode = res.status;
            if (res.ok || res.status === 400 || res.status === 404 || res.status === 409 || res.status === 422) {
              isSuccess = true;
            } else {
              const resJson = await res.json().catch(() => ({}));
              lastErrorMsg = resJson.error || `Error al actualizar gasto HTTP ${res.status}`;
            }
          } catch (fetchErr: any) {
            lastErrorMsg = fetchErr.message || 'Error de red o conexión al servidor';
          }

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

            if (!error) {
              isSuccess = true;
            } else {
              lastErrorMsg = error.message || lastErrorMsg;
            }
          }
          break;
        }

        case 'DELETE_EXPENSE': {
          try {
            const res = await fetch(`/api/expenses/${encodeURIComponent(item.entityId)}`, {
              method: 'DELETE',
            });
            statusCode = res.status;
            if (res.ok || res.status === 404) isSuccess = true;
            else {
              const resJson = await res.json().catch(() => ({}));
              lastErrorMsg = resJson.error || `Error al eliminar gasto HTTP ${res.status}`;
            }
          } catch (fetchErr: any) {
            lastErrorMsg = fetchErr.message || 'Error de red al eliminar gasto';
          }

          if (!isSuccess && supabaseClient?.from) {
            const { error } = await supabaseClient
              .from('expenses')
              .delete()
              .eq('id', item.entityId);
            if (!error) isSuccess = true;
            else lastErrorMsg = error.message || lastErrorMsg;
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
            statusCode = res.status;
            if (res.ok || res.status === 400 || res.status === 404 || res.status === 409 || res.status === 422) {
              isSuccess = true;
            } else {
              const resJson = await res.json().catch(() => ({}));
              lastErrorMsg = resJson.error || `Error al guardar liquidación HTTP ${res.status}`;
            }
          } catch (fetchErr: any) {
            lastErrorMsg = fetchErr.message || 'Error de conexión al registrar liquidación';
          }

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
            else lastErrorMsg = error.message || lastErrorMsg;
          }
          break;
        }

        case 'CREATE_GROUP': {
          const group: Group = item.payload;
          try {
            const res = await fetch('/api/groups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: group.id,
                name: group.name,
                description: group.description,
                icon_emoji: group.icon_emoji,
                cover_image_url: group.cover_image_url,
                base_currency: group.base_currency,
                invite_code: group.invite_code,
              }),
            });
            statusCode = res.status;
            if (res.ok || res.status === 400 || res.status === 404 || res.status === 409 || res.status === 422) {
              isSuccess = true;
            } else {
              const resJson = await res.json().catch(() => ({}));
              lastErrorMsg = resJson.error || `Error al crear grupo HTTP ${res.status}`;
            }
          } catch (fetchErr: any) {
            lastErrorMsg = fetchErr.message || 'Error de conexión al crear grupo';
          }

          if (!isSuccess && supabaseClient?.from) {
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
            else lastErrorMsg = error.message || lastErrorMsg;
          }
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
            statusCode = res.status;
            if (res.ok || res.status === 400 || res.status === 404 || res.status === 409 || res.status === 422) {
              isSuccess = true;
            } else {
              const resJson = await res.json().catch(() => ({}));
              lastErrorMsg = resJson.error || `Error al unirse al grupo HTTP ${res.status}`;
            }
          } catch (fetchErr: any) {
            lastErrorMsg = fetchErr.message || 'Error de conexión al unirse al grupo';
          }
          break;
        }
      }

      if (isSuccess) {
        successCount++;
        if (onItemSynced) onItemSynced(item);
      } else {
        failureCount++;
        remainingQueue.push({
          ...item,
          retryCount: item.retryCount + 1,
          lastError: lastErrorMsg,
          errorStatus: statusCode,
          lastAttemptTimestamp: Date.now(),
        });
      }
    } catch (err: any) {
      console.warn('Sync item failure:', item, err);
      failureCount++;
      remainingQueue.push({
        ...item,
        retryCount: item.retryCount + 1,
        lastError: err?.message || lastErrorMsg,
        errorStatus: statusCode,
        lastAttemptTimestamp: Date.now(),
      });
    }
  }

  saveSyncQueue(remainingQueue);
  return { successCount, failureCount };
}

export async function retrySingleSyncAction(
  actionId: string,
  supabaseClient: any,
  onItemSynced?: (action: SyncAction) => void
): Promise<boolean> {
  const queue = getSyncQueue();
  const target = queue.find((a) => a.id === actionId);
  if (!target) return false;

  // Process just this item by isolating it
  saveSyncQueue([target]);
  const { successCount } = await processSyncQueue(supabaseClient, onItemSynced);

  // Re-merge with the rest of the queue
  const updatedRemaining = getSyncQueue();
  const rest = queue.filter((a) => a.id !== actionId);
  saveSyncQueue([...rest, ...updatedRemaining]);

  return successCount > 0;
}

