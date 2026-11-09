import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const QUEUE_KEY = '@delivery_offline_queue';
const OFFLINE_POD_DIR = `${FileSystem.documentDirectory}offline_pods/`;
export const MAX_RETRIES = 5;

export type OfflineActionType = 'MARK_ARRIVED' | 'SUBMIT_POD' | 'FAIL_STOP';
export type OfflineActionStatus = 'PENDING' | 'FAILED_PERMANENTLY';

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  stopId: string;
  orderCode?: string;
  payload?: Record<string, any>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  status: OfflineActionStatus;
};

/**
 * Copy ảnh từ thư mục Cache tạm thời sang thư mục lưu trữ bền vững (documentDirectory).
 * Đảm bảo hệ điều hành không tự động xóa ảnh trong thời gian thiết bị offline.
 */
export async function persistPhotoForOffline(cacheUri: string): Promise<string> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(OFFLINE_POD_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(OFFLINE_POD_DIR, { intermediates: true });
    }

    const filename = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const persistentUri = `${OFFLINE_POD_DIR}${filename}`;
    await FileSystem.copyAsync({ from: cacheUri, to: persistentUri });
    return persistentUri;
  } catch (err) {
    console.warn('[offlineQueue] Lỗi khi lưu ảnh bền vững cho offline:', err);
    return cacheUri; // Fallback về URI gốc nếu copy thất bại
  }
}

/**
 * Dọn dẹp file ảnh offline sau khi action đã được đồng bộ thành công hoặc xóa khỏi queue.
 */
export async function deleteOfflinePhoto(uri?: string): Promise<void> {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri);
    }
  } catch (err) {
    console.warn('[offlineQueue] Lỗi xóa file ảnh offline:', err);
  }
}

/**
 * Lấy toàn bộ hàng chờ ngoại tuyến từ AsyncStorage.
 */
export async function getQueue(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineAction[];
    // Đảm bảo các item cũ chưa có field status mặc định là 'PENDING'
    return parsed.map((item) => ({
      ...item,
      status: item.status || 'PENDING',
    }));
  } catch (err) {
    console.warn('[offlineQueue] Error reading queue from storage:', err);
    return [];
  }
}

/**
 * Đưa một action mới vào hàng chờ ngoại tuyến.
 */
export async function enqueue(
  action: Omit<OfflineAction, 'id' | 'createdAt' | 'retryCount' | 'status'>,
): Promise<OfflineAction> {
  const currentQueue = await getQueue();
  const newAction: OfflineAction = {
    ...action,
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'PENDING',
  };
  const updated = [...currentQueue, newAction];
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  return newAction;
}

/**
 * Xóa một action khỏi queue theo ID sau khi đồng bộ thành công.
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
 * Đánh dấu action là thất bại vĩnh viễn (khi retry >= MAX_RETRIES) để không tự động retry nữa.
 */
export async function markPermanentlyFailed(actionId: string): Promise<void> {
  try {
    const queue = await getQueue();
    const updated = queue.map((item) =>
      item.id === actionId ? { ...item, status: 'FAILED_PERMANENTLY' as const } : item,
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[offlineQueue] Error marking permanently failed in queue:', err);
  }
}

/**
 * Tăng số lần thử (retryCount) và ghi log lỗi cho item khi đồng bộ thất bại.
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
 * Xóa toàn bộ hàng chờ ngoại tuyến và dọn dẹp các ảnh đã lưu.
 */
export async function clearQueue(): Promise<void> {
  try {
    const currentQueue = await getQueue();
    for (const item of currentQueue) {
      if (item.payload?.photoUri) {
        await deleteOfflinePhoto(item.payload.photoUri);
      }
    }
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch (err) {
    console.warn('[offlineQueue] Error clearing queue:', err);
  }
}
