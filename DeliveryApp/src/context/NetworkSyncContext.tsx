import React, { createContext, useContext, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from './AuthContext';
import { useAppContext } from './AppContext';
import { useToast } from './ToastContext';
import {
  getQueue,
  dequeue,
  updateQueueItemError,
  markPermanentlyFailed,
  deleteOfflinePhoto,
  MAX_RETRIES,
  type OfflineAction,
} from '../lib/offlineQueue';
import {
  markStopArrivedApi,
  submitStopPodApi,
  failStopApi,
  isApiError,
} from '../lib/api';

type NetworkSyncContextType = {
  syncNow: () => Promise<void>;
};

const NetworkSyncContext = createContext<NetworkSyncContextType>({
  syncNow: async () => {},
});

export const useNetworkSync = () => useContext(NetworkSyncContext);

export function NetworkSyncProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { refreshRoute } = useAppContext();
  const toast = useToast();
  const isSyncing = useRef(false);
  const wasDisconnected = useRef(false);

  const syncQueue = async () => {
    if (isSyncing.current || !token) return;
    isSyncing.current = true;

    try {
      const queue = await getQueue();
      // Chỉ sync các item PENDING và chưa vượt MAX_RETRIES
      const pendingItems = queue.filter(
        (a) => a.status === 'PENDING' && a.retryCount < MAX_RETRIES,
      );

      if (pendingItems.length === 0) {
        return;
      }

      let success = 0;
      let fail = 0;

      for (const action of pendingItems) {
        try {
          await dispatchAction(action, token);

          // Sync thành công -> xóa khỏi queue và xóa ảnh lưu trữ offline
          await dequeue(action.id);
          if (action.payload?.photoUri) {
            await deleteOfflinePhoto(action.payload.photoUri);
          }
          success++;
        } catch (err) {
          // Phân loại lỗi theo kiến trúc v2:
          if (isApiError(err)) {
            // Lỗi 409 (đơn đã giao trước đó), 400 (dữ liệu không hợp lệ), 404 (không tìm thấy)
            // -> Lỗi logic nghiệp vụ, retry cũng sẽ thất bại -> Dequeue và xóa ảnh
            if (err.status === 409 || err.status === 400 || err.status === 404) {
              await dequeue(action.id);
              if (action.payload?.photoUri) {
                await deleteOfflinePhoto(action.payload.photoUri);
              }
              success++; // Đánh dấu đã xử lý
              continue;
            }
          }

          // Lỗi mạng hoặc 5xx -> giữ trong queue, tăng retryCount
          fail++;
          const errorMsg = isApiError(err) ? err.message : 'Lỗi kết nối';
          await updateQueueItemError(action.id, errorMsg);

          if (action.retryCount + 1 >= MAX_RETRIES) {
            await markPermanentlyFailed(action.id);
          }
        }
      }

      if (success > 0 || fail > 0) {
        const msg = success > 0 ? `Đã đồng bộ ${success} tác vụ.` : '';
        const failMsg = fail > 0 ? ` ${fail} mục thử lại sau.` : '';
        toast.info('Đồng bộ tự động', `${msg}${failMsg}`.trim());
        try {
          await refreshRoute();
        } catch {
          // Ignored
        }
      }
    } finally {
      isSyncing.current = false;
    }
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);

      if (!isOnline) {
        wasDisconnected.current = true;
        return;
      }

      // Khi chuyển từ offline -> online
      if (wasDisconnected.current && isOnline) {
        wasDisconnected.current = false;
        // Chờ 2s để đường truyền ổn định
        setTimeout(() => {
          void syncQueue();
        }, 2000);
      }
    });

    // Thử sync 1 lần khi app khởi động nếu có hàng chờ cũ
    const timer = setTimeout(() => {
      void syncQueue();
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [token]);

  return (
    <NetworkSyncContext.Provider value={{ syncNow: syncQueue }}>
      {children}
    </NetworkSyncContext.Provider>
  );
}

/** Dispatch action tới API tương ứng */
async function dispatchAction(action: OfflineAction, token: string): Promise<void> {
  switch (action.type) {
    case 'MARK_ARRIVED':
      await markStopArrivedApi(action.stopId, token);
      break;

    case 'SUBMIT_POD': {
      const payload = action.payload || {};
      await submitStopPodApi(
        action.stopId,
        payload.photoUri || '',
        payload.codCollected !== undefined ? Number(payload.codCollected) : undefined,
        payload.notes,
        token,
      );
      break;
    }

    case 'FAIL_STOP': {
      const payload = action.payload || {};
      await failStopApi(
        action.stopId,
        {
          action: payload.action || 'FAILED',
          failureReason: payload.failureReason || 'Không giao được hàng',
          rescheduledDate: payload.rescheduledDate,
          photoUri: payload.photoUri,
        },
        token,
      );
      break;
    }

    default:
      console.warn('[NetworkSync] Unknown action type:', action.type);
  }
}
