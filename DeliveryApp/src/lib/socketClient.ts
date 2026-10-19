/**
 * socketClient.ts — Task 9.2: Realtime Tracking — Socket.io Client Manager
 *
 * Singleton object quản lý kết nối Socket.io tới backend gateway.
 *
 * API:
 *   connectSocket(token)             — Kết nối và xác thực bằng JWT token.
 *   disconnectSocket()               — Ngắt kết nối và dọn dẹp.
 *   emitLocation(payload)            — Gửi sự kiện 'update_location' tới server.
 *   isConnected()                    — Kiểm tra trạng thái kết nối hiện tại.
 *   onConnectionError(callback)      — Đăng ký callback khi server từ chối kết nối.
 *
 * Sự kiện server → client:
 *   'connected'          — Xác nhận kết nối thành công (server gửi về).
 *   'connection_error'   — Server từ chối (token sai / hết hạn).
 *
 * Luồng sử dụng:
 *   1. Tài xế mở ca (shift OPEN) → connectSocket(accessToken)
 *   2. expo-location watchPositionAsync → emitLocation(...)  [mỗi 15s / 15m]
 *   3. Tài xế đóng ca hoặc app unmount → disconnectSocket()
 */

import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

// ─── Resolve backend host (giống api.ts) ──────────────────────────────────────
const OVERRIDE_SOCKET_HOST: string | null = null;
const SOCKET_PORT = 3001;

function resolveSocketUrl(): string {
  if (OVERRIDE_SOCKET_HOST) {
    return `http://${OVERRIDE_SOCKET_HOST}:${SOCKET_PORT}`;
  }

  const expoHostUri: string | undefined =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (expoHostUri) {
    const host = expoHostUri.split(':')[0];
    return `http://${host}:${SOCKET_PORT}`;
  }

  // Android Emulator fallback
  return `http://10.0.2.2:${SOCKET_PORT}`;
}

export const SOCKET_URL = resolveSocketUrl();

// ─── Payload types ────────────────────────────────────────────────────────────

export interface EmitLocationPayload {
  shiftId?: string | null;
  latitude: number;
  longitude: number;
  batteryLevel?: number;
}

// ─── Singleton socket instance ────────────────────────────────────────────────

let socket: Socket | null = null;

/**
 * Kết nối Socket.io tới backend.
 * Truyền JWT token vào `auth.token` để backend xác thực.
 * Gọi lại khi token được làm mới hoặc đã gọi disconnectSocket() trước đó.
 */
export function connectSocket(token: string): void {
  if (socket?.connected) {
    console.log('[SocketClient] Already connected, skipping connect.');
    return;
  }

  // Đảm bảo dọn dẹp socket cũ nếu tồn tại nhưng không connected
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  console.log(`[SocketClient] Connecting to ${SOCKET_URL}...`);

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],  // Bỏ long-polling để tránh CORS phức tạp
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    timeout: 8000,
  });

  socket.on('connect', () => {
    console.log(`[SocketClient] Transport connected (socketId: ${socket?.id})`);
  });

  socket.on('connected', (data: { message: string; userId: string; role: string; rooms: string[] }) => {
    console.log(`[SocketClient] ✅ Auth confirmed by server — userId: ${data.userId}, role: ${data.role}`);
  });

  socket.on('connection_error', (err: { message: string }) => {
    console.warn(`[SocketClient] ❌ Server rejected connection: ${err.message}`);
  });

  socket.on('disconnect', (reason: string) => {
    console.log(`[SocketClient] Disconnected: ${reason}`);
  });

  socket.on('connect_error', (err: Error) => {
    console.warn(`[SocketClient] connect_error: ${err.message}`);
  });
}

/**
 * Ngắt kết nối và dọn dẹp toàn bộ listener.
 * Gọi khi: tài xế đóng ca, logout, hoặc component unmount.
 */
export function disconnectSocket(): void {
  if (!socket) return;
  console.log('[SocketClient] Disconnecting...');
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

/**
 * Gửi tọa độ GPS hiện tại lên server.
 * Server sẽ:
 *   1. Lưu vào bảng tracking_logs.
 *   2. Broadcast 'driver_location_updated' tới room 'dispatchers'.
 *
 * @returns true nếu emit thành công, false nếu socket chưa kết nối.
 */
export function emitLocation(payload: EmitLocationPayload): boolean {
  if (!socket?.connected) {
    console.warn('[SocketClient] Cannot emit location — socket not connected.');
    return false;
  }

  socket.emit(
    'update_location',
    {
      shiftId: payload.shiftId ?? undefined,
      latitude: payload.latitude,
      longitude: payload.longitude,
      batteryLevel: payload.batteryLevel,
    },
    (ack: { success: boolean; message?: string }) => {
      if (ack?.success) {
        console.debug(
          `[SocketClient] Location ACK ✓ lat=${payload.latitude}, lng=${payload.longitude}`,
        );
      } else {
        console.warn('[SocketClient] Location emit not acknowledged:', ack);
      }
    },
  );

  return true;
}

/**
 * Kiểm tra trạng thái kết nối hiện tại.
 */
export function isSocketConnected(): boolean {
  return socket?.connected === true;
}

/**
 * Đăng ký callback khi server từ chối kết nối (token hết hạn / không hợp lệ).
 * Nên gọi ngay sau connectSocket() để catch lỗi sớm.
 */
export function onConnectionError(callback: (message: string) => void): void {
  socket?.on('connection_error', (err: { message: string }) => {
    callback(err.message);
  });
}
