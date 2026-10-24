/**
 * LocationService.ts — Task 12.1: Realtime Tracking — Background GPS Service
 *
 * Module quản lý vòng đời theo dõi GPS bằng expo-location và expo-task-manager,
 * tối ưu hóa tiết kiệm pin (battery optimization) và ổn định kết nối.
 *
 * Cấu hình tracking chuẩn:
 *   - accuracy: Location.Accuracy.Balanced
 *   - distanceInterval: 15 (mét)
 *   - deferredUpdatesInterval: 15000 (15 giây)
 *   - showsBackgroundLocationIndicator: true (xử lý trên iOS)
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { emitLocation } from '../lib/socketClient';

export const BACKGROUND_LOCATION_TASK = 'SMARTEXPRESS_BACKGROUND_LOCATION_TASK';

// ─── Internal state ───────────────────────────────────────────────────────────

let locationSubscription: Location.LocationSubscription | null = null;
let activeShiftId: string | null = null;
let isBackgroundRunning = false;

// ─── Define Background Task ───────────────────────────────────────────────────

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: { data?: any; error?: any }) => {
    if (error) {
      console.error('[LocationService] Background location task error:', error);
      return;
    }

    if (data) {
      const { locations } = data as { locations?: Location.LocationObject[] };
      if (locations && locations.length > 0) {
        const latest = locations[locations.length - 1];
        const { latitude, longitude } = latest.coords;

        console.debug(
          `[LocationService] Background position: lat=${latitude.toFixed(6)}, lng=${longitude.toFixed(6)}`,
        );

        emitLocation({
          shiftId: activeShiftId,
          latitude,
          longitude,
        });
      }
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Bắt đầu theo dõi GPS (foreground & background) và emit tọa độ qua Socket.io.
 *
 * @param shiftId — ID ca làm việc đang mở (nullable: server sẽ tự tìm ca mở nếu không truyền)
 * @returns 'ok' nếu thành công, 'permission_denied' nếu người dùng từ chối quyền,
 *          'already_tracking' nếu đã đang chạy.
 */
export async function startTracking(
  shiftId?: string | null,
): Promise<'ok' | 'permission_denied' | 'already_tracking'> {
  if (locationSubscription || isBackgroundRunning) {
    console.log('[LocationService] Already tracking, skipping start.');
    return 'already_tracking';
  }

  // 1. Xin quyền truy cập vị trí (foreground)
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    console.warn('[LocationService] Foreground location permission denied.');
    return 'permission_denied';
  }

  activeShiftId = shiftId ?? null;

  // 2. Xin quyền vị trí chạy ngầm (background)
  let bgGranted = false;
  try {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    bgGranted = bgStatus === 'granted';
    if (!bgGranted) {
      console.warn('[LocationService] Background location permission not granted, will run foreground only.');
    }
  } catch (err) {
    console.warn('[LocationService] Could not request background permissions:', err);
  }

  console.log(
    `[LocationService] Starting GPS watch — shiftId=${activeShiftId}, accuracy=Balanced, distance=15m, deferredUpdatesInterval=15000ms`,
  );

  // 3. Khởi động background location updates nếu quyền background được cấp
  if (bgGranted) {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 15,
          deferredUpdatesInterval: 15000,
          showsBackgroundLocationIndicator: true, // Xử lý chỉ báo background trên iOS
          pausesUpdatesAutomatically: false,
          foregroundService: {
            notificationTitle: 'SmartExpress Delivery',
            notificationBody: 'Đang theo dõi vị trí giao hàng trực tuyến',
            notificationColor: '#FA7070',
          },
        });
        isBackgroundRunning = true;
        console.log('[LocationService] ✅ Background location updates started.');
      }
    } catch (err) {
      console.warn('[LocationService] Failed to start background location updates:', err);
    }
  }

  // 4. Khởi động foreground watcher cho phản hồi mượt mà khi app đang mở
  try {
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 15,
        timeInterval: 15000,
      },
      (location) => {
        const { latitude, longitude } = location.coords;

        console.debug(
          `[LocationService] Foreground position: lat=${latitude.toFixed(6)}, lng=${longitude.toFixed(6)}`,
        );

        emitLocation({
          shiftId: activeShiftId,
          latitude,
          longitude,
        });
      },
    );
    console.log('[LocationService] ✅ Foreground GPS watch started.');
  } catch (err) {
    console.warn('[LocationService] Failed to start foreground watchPosition:', err);
  }

  return 'ok';
}

/**
 * Dừng theo dõi GPS và dọn dẹp subscription / background task.
 * Gọi khi tài xế đóng ca, logout, hoặc component unmount.
 */
export async function stopTracking(): Promise<void> {
  console.log('[LocationService] Stopping GPS watch.');

  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }

  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[LocationService] Background location updates stopped.');
    }
  } catch (err) {
    console.warn('[LocationService] Error stopping background updates:', err);
  }

  isBackgroundRunning = false;
  activeShiftId = null;
}

/**
 * Kiểm tra xem GPS tracking có đang chạy không (cả foreground lẫn background).
 */
export function isTracking(): boolean {
  return locationSubscription !== null || isBackgroundRunning;
}
