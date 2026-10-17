import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@delivery_offline_queue';

export type OfflineActionType = 'MARK_ARRIVED' | 'SUBMIT_POD' | 'FAIL_STOP';

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  stopId: string;
  orderCode?: string;
  payload?: Record<string, any>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
};

/**
 * Get all queued offline actions from AsyncStorage.
 */
export async function getQueue(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineAction[];
  } catch (err) {
    console.warn('[offlineQueue] Error reading queue from storage:', err);
    return [];
  }
}

/**
 * Enqueue a new offline action to AsyncStorage.
 */
export async function enqueue(
  action: Omit<OfflineAction, 'id' | 'createdAt' | 'retryCount'>,
): Promise<OfflineAction> {
  const currentQueue = await getQueue();
  const newAction: OfflineAction = {
    ...action,
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const updated = [...currentQueue, newAction];
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  return newAction;
}

/**
 * Remove an action from the queue by ID after successful synchronization.
 */
export async function dequeue(actionId: string): Promise<void> {
  try {
    const currentQueue = await getQueue();
    const updated = currentQueue.filter((item) => item.id !== actionId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[offlineQueue] Error removing action from queue:', err);
  }
}

/**
 * Increment the retry counter and log last error for a failed item.
 */
export async function updateQueueItemError(actionId: string, errorMsg: string): Promise<void> {
  try {
    const currentQueue = await getQueue();
    const updated = currentQueue.map((item) => {
      if (item.id === actionId) {
        return {
          ...item,
          retryCount: item.retryCount + 1,
          lastError: errorMsg,
        };
      }
      return item;
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[offlineQueue] Error updating item retry in queue:', err);
  }
}

/**
 * Clear the entire offline queue.
 */
export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch (err) {
    console.warn('[offlineQueue] Error clearing queue:', err);
  }
}
