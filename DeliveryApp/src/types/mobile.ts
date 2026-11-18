export type Driver = {
  user_id: string;
  name: string;
  license_plate: string;
  vehicle_type: string;
  max_weight_kg: number;
  max_volume_m3: number;
  current_shift_status: 'OFFLINE' | 'ONLINE_READY' | 'BUSY';
};

export type Shift = {
  id: string;
  driver_id: string;
  start_time: string; // ISO String
  end_time: string | null; // ISO String or null if active
  status: 'OPEN' | 'PENDING_SETTLEMENT' | 'CLOSED';
  cod_collected: number;
  cod_submitted: number;
};

export type Route = {
  id: string;
  driver_id: string;
  route_date: string;
  total_distance_km: number;
  total_estimated_time_min: number;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  polyline: string; // Mocked for now
};

export type Order = {
  id: string;
  code: string;
  receiver_name: string;
  receiver_phone: string;
  delivery_address: string;
  lat: number;
  lng: number;
  cod_amount: number;
  weight_kg?: number;
  volume_m3?: number;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RESCHEDULED' | 'IN_TRANSIT';
  rescheduled_date?: string | null;
  failure_reason?: string | null;
  confirmed_at?: string | null;
};

export type Stop = {
  id: string;
  route_id: string;
  order_id: string;
  sequence_no: number;
  arrived_at: string | null; // ISO String
  status: 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  order: Order; // Populated for convenience in mock state
  rescheduled_date?: string | null;
  failure_reason?: string | null;
  confirmed_at?: string | null;
  pod?: ProofOfDelivery | null;
};

export type ProofOfDelivery = {
  stop_id: string;
  photo_url: string | null;
  cod_collected: number;
  failure_reason: string | null;
  rescheduled_date: string | null;
  confirmed_at: string;
};

/**
 * Kiểm tra điều kiện khóa tính năng dẫn đường (Chỉ đường / Bắt đầu di chuyển).
 *
 * 1. Đã giao thành công (COMPLETED / DELIVERED): LUÔN DISABLE.
 * 2. Giao thất bại và KHÔNG có rescheduledDate (FAILED): LUÔN DISABLE.
 * 3. Hẹn giao lại (RESCHEDULED hoặc có rescheduled_date / SKIPPED):
 *    - CHƯA ĐẾN giờ hẹn (now < rescheduleTime): DISABLE.
 *    - ĐÃ ĐẾN hoặc QUA giờ hẹn (now >= rescheduleTime): MỞ KHÓA LẠI (false).
 * 4. Chờ giao bình thường (PENDING, ARRIVED, v.v.): MỞ KHÓA (false).
 */
export function isNavigationDisabled(
  stop: {
    status?: string;
    rescheduled_date?: string | null;
    failure_reason?: string | null;
    order?: {
      status?: string;
      rescheduled_date?: string | null;
      failure_reason?: string | null;
    } | null;
    pod?: {
      rescheduled_date?: string | null;
    } | null;
  },
  now: number = Date.now(),
): boolean {
  // Điểm đã đến nơi (ARRIVED): Không khóa tác nghiệp
  if (stop.status === 'ARRIVED') {
    return false;
  }

  const rawRescheduleDate =
    stop.rescheduled_date || stop.order?.rescheduled_date || stop.pod?.rescheduled_date;

  const isRescheduled =
    stop.order?.status === 'RESCHEDULED' ||
    Boolean(rawRescheduleDate) ||
    (stop.status === 'SKIPPED' && Boolean(stop.failure_reason || stop.order?.failure_reason));

  // 1. Trạng thái 1 – Đã giao thành công: LUÔN DISABLE
  const isCompleted = stop.status === 'COMPLETED' || stop.order?.status === 'DELIVERED';
  if (isCompleted) {
    return true;
  }

  // 2. Trạng thái 2 – Giao thất bại thực sự (không có lịch hẹn lại): LUÔN DISABLE
  const isFailed = (stop.status === 'FAILED' || stop.order?.status === 'FAILED') && !isRescheduled;
  if (isFailed) {
    return true;
  }

  // 3. Trạng thái 3 – Hẹn giao lại:
  if (isRescheduled) {
    if (rawRescheduleDate) {
      const rescheduleTime = new Date(rawRescheduleDate).getTime();
      if (!isNaN(rescheduleTime)) {
        // Nếu CHƯA ĐẾN giờ hẹn -> DISABLE
        if (now < rescheduleTime) {
          return true;
        }
        // Nếu ĐÃ ĐẾN hoặc QUA giờ hẹn -> MỞ KHÓA LẠI
        return false;
      }
    }
    // Nếu có cờ hẹn lại nhưng chưa có ngày cụ thể, khóa an toàn
    return true;
  }

  // Nếu stop ở trạng thái SKIPPED đơn thuần không có hẹn lại
  if (stop.status === 'SKIPPED') {
    return true;
  }

  // 4. Các trạng thái chờ giao bình thường (PENDING, ARRIVED, ASSIGNED...): MỞ KHÓA
  return false;
}
