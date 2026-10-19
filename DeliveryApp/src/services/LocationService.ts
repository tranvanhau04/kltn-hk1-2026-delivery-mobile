/**
 * LocationService.ts — Task 9.2: Realtime Tracking — GPS Watcher
 *
 * Module thuần (không phải React component) quản lý vòng đời theo dõi GPS
 * bằng expo-location và gửi tọa độ qua Socket.io.
 *
 * API:
 *   startTracking(shiftId?)   — Xin quyền, bắt đầu watchPositionAsync, emit qua socket.
 *   stopTracking()            — Dừng watch, dọn dẹp subscription.
 *   isTracking()              — Trả về trạng thái hiện tại.
 *
 * Cấu hình tracking:
 *   - accuracy: Balanced (tiết kiệm pin hơn High, vẫn đủ chính xác ~10-15m)
 *   - timeInterval: 15 000ms (15 giây — cân bằng giữa realtime và pin)
 *   - distanceInterval: 15m (chỉ cập nhật khi di chuyển đủ 15m — loại bỏ noise đứng yên)
 *
 * Luồng:
 *   startTracking(shiftId)
 *     → requestForegroundPermissionsAsync()    [yêu cầu quyền]
 *     → watchPositionAsync(config, callback)   [bắt đầu theo dõi]
 *        └─ emitLocation({ shiftId, lat, lng, batteryLevel })  [gửi qua socket]
 *   stopTracking()
 *     → subscription.remove()                  [dọn dẹp]
 */

import * as Location from 'expo-location';
import { emitLocation } from '../lib/socketClient';

// ─── Cấu hình tracking ────────────────────────────────────────────────────────

/** Thời gian tối thiểu giữa 2 cập nhật vị trí (ms) */
const TIME_INTERVAL_MS = 15_000; // 15 giây

/** Khoảng cách tối thiểu để tạo cập nhật mới (mét) */
const DISTANCE_INTERVAL_M = 15; // 15 mét

// ─── Internal state ───────────────────────────────────────────────────────────

let locationSubscription: Location.LocationSubscription | null = null;
let activeShiftId: string | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Bắt đầu theo dõi GPS và emit tọa độ qua Socket.io.
 *
 * @param shiftId — ID ca làm việc đang mở (nullable: server sẽ tự tìm ca mở nếu không truyền)
 * @returns 'ok' nếu thành công, 'permission_denied' nếu người dùng từ chối quyền,
 *          'already_tracking' nếu đã đang chạy.
 */
export async function startTracking(
  shiftId?: string | null,
): Promise<'ok' | 'permission_denied' | 'already_tracking'> {
  if (locationSubscription) {
    console.log('[LocationService] Already tracking, skipping start.');
    return 'already_tracking';
  }

  // 1. Xin quyền truy cập vị trí (foreground)
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    console.warn('[LocationService] Location permission denied.');
    return 'permission_denied';
  }

  activeShiftId = shiftId ?? null;

  console.log(
    `[LocationService] Starting GPS watch — shiftId=${activeShiftId}, interval=${TIME_INTERVAL_MS}ms, distance=${DISTANCE_INTERVAL_M}m`,
  );

  // 2. Bắt đầu theo dõi vị trí
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: TIME_INTERVAL_MS,
      distanceInterval: DISTANCE_INTERVAL_M,
    },
    (location) => {
      const { latitude, longitude } = location.coords;

      console.debug(
        `[LocationService] New position: lat=${latitude.toFixed(6)}, lng=${longitude.toFixed(6)}`,
      );

      // 3. Emit tọa độ qua Socket.io tới backend
      emitLocation({
        shiftId: activeShiftId,
        latitude,
        longitude,
        // batteryLevel: có thể bổ sung expo-battery sau nếu cần
      });
    },
  );

  console.log('[LocationService] ✅ GPS watch started.');
  return 'ok';
}

/**
 * Dừng theo dõi GPS và dọn dẹp subscription.
 * Gọi khi tài xế đóng ca, logout, hoặc component unmount.
 */
export function stopTracking(): void {
  if (!locationSubscription) {
    return;
  }

  console.log('[LocationService] Stopping GPS watch.');
  locationSubscription.remove();
  locationSubscription = null;
  activeShiftId = null;
}

/**
 * Kiểm tra xem GPS tracking có đang chạy không.
 */
export function isTracking(): boolean {
  return locationSubscription !== null;
}
