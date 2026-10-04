/**
 * API Client for IUH Logistics Driver Mobile App
 *
 * ─── How to configure BASE_URL ────────────────────────────────────────────────
 *
 * The app auto-detects the backend host from Expo's `hostUri` (the IP address
 * of the Expo dev server). This works transparently on:
 *   - Android Emulator  (Expo tunnels through 10.0.2.2)
 *   - iOS Simulator     (Expo tunnels through localhost)
 *   - Physical device   (Expo reports your real Wi-Fi LAN IP automatically)
 *
 * If you need to override (e.g., running the app in production standalone mode),
 * set OVERRIDE_API_HOST below to your server's IP or domain:
 *
 *   const OVERRIDE_API_HOST = '192.168.1.100'; // your dev machine Wi-Fi IP
 *
 * Leave OVERRIDE_API_HOST as null to use auto-detection (recommended).
 */

import Constants from 'expo-constants';

// ─── ⚙️ Override (set to null for auto-detection) ─────────────────────────────
const OVERRIDE_API_HOST: string | null = null;
// Example:  const OVERRIDE_API_HOST = '192.168.1.15';

// ─── Backend port ──────────────────────────────────────────────────────────────
const API_PORT = 3001;

// ─── Auto-detection logic ──────────────────────────────────────────────────────
function resolveApiBase(): string {
  if (OVERRIDE_API_HOST) {
    return `http://${OVERRIDE_API_HOST}:${API_PORT}/api`;
  }

  // Expo injects the dev-server host (e.g. "192.168.1.15:8081") into Constants.
  // Strip the port and use just the IP for the backend.
  const expoHostUri: string | undefined =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (expoHostUri) {
    const host = expoHostUri.split(':')[0]; // e.g. "192.168.1.15"
    return `http://${host}:${API_PORT}/api`;
  }

  // Final fallback: Android Emulator alias. Works in emulator builds without Expo Go.
  return `http://10.0.2.2:${API_PORT}/api`;
}

export const API_BASE = resolveApiBase();

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiStopStatus = 'PENDING' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface ApiRouteOrder {
  id: string;
  code: string;
  receiverName: string;
  receiverPhone: string;
  deliveryAddress: string;
  lat: number;
  lng: number;
  codAmount: number;
  status: string;
}

export interface ApiRouteStop {
  id: string;
  routeId: string;
  orderId: string;
  sequenceNo: number;
  status: ApiStopStatus;
  arrivedAt: string | null;
  order: ApiRouteOrder | null;
}

export interface ApiRoute {
  id: string;
  driverId: string;
  routeDate: string;
  totalDistanceKm: number;
  totalEstimatedTimeMin: number;
  status: string;
  polyline: [number, number][];
}

export interface ApiDriverRouteResponse {
  success: boolean;
  route: ApiRoute | null;
  stops: ApiRouteStop[];
  message?: string;
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface ApiLoginUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

export interface ApiLoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  user: ApiLoginUser;
}

export interface ApiDriverProfile {
  userId: string;
  licensePlate: string;
  vehicleType: string;
  maxWeightKg: number;
  maxVolumeM3: number;
  currentShiftStatus: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    status: string;
  } | null;
}

// ─── Helper (unauthenticated) ─────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${path} failed: ${res.status} ${body}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Authenticated fetch — attaches Bearer token from AuthContext.
 * Token is passed explicitly rather than read from storage,
 * so AuthContext remains the single source of truth.
 */
async function apiFetchAuth<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      let errorMsg = `Yêu cầu thất bại (${res.status})`;
      let errorData: any = null;
      try {
        errorData = await res.json();
        if (Array.isArray(errorData?.message)) {
          errorMsg = errorData.message.join('\n');
        } else if (typeof errorData?.message === 'string') {
          errorMsg = errorData.message;
        }
      } catch {
        const text = await res.text().catch(() => '');
        if (text) errorMsg = text;
      }
      throw new ApiError(res.status, errorMsg, errorData);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Authenticated multipart/form-data fetch — uploads files (photo) with Bearer token.
 * Note: Do NOT set Content-Type header manually; fetch handles multipart boundary.
 */
async function apiFetchMultipart<T>(path: string, token: string, formData: FormData): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout for image uploads
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) {
      let errorMsg = `Tải lên thất bại (${res.status})`;
      let errorData: any = null;
      try {
        errorData = await res.json();
        if (Array.isArray(errorData?.message)) {
          errorMsg = errorData.message.join('\n');
        } else if (typeof errorData?.message === 'string') {
          errorMsg = errorData.message;
        }
      } catch {
        const text = await res.text().catch(() => '');
        if (text) errorMsg = text;
      }
      throw new ApiError(res.status, errorMsg, errorData);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Authenticate driver with email + password.
 */
export async function loginApi(email: string, password: string): Promise<ApiLoginResponse> {
  return apiFetch<ApiLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * GET /api/drivers/:userId
 * Fetch driver profile (vehicle info, shift status).
 * Requires authentication.
 */
export async function fetchDriverProfile(userId: string, token: string): Promise<ApiDriverProfile> {
  return apiFetchAuth<ApiDriverProfile>(`/drivers/${userId}`, token);
}

/**
 * PATCH /api/drivers/:userId/shift-status
 * Update driver shift status (OFFLINE ↔ ONLINE_READY).
 * Requires authentication.
 */
export async function updateShiftStatusApi(
  userId: string,
  newStatus: string,
  token: string,
): Promise<unknown> {
  return apiFetchAuth<unknown>(`/drivers/${userId}/shift-status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ currentShiftStatus: newStatus }),
  });
}

// ─── Route & Location API ─────────────────────────────────────────────────────

/**
 * Fetch the assigned route and stops for a specific driver.
 * Returns { success: false, route: null, stops: [] } when no route exists today.
 */
export async function fetchDriverRoute(driverId: string): Promise<ApiDriverRouteResponse> {
  return apiFetch<ApiDriverRouteResponse>(`/driver/${driverId}/route`);
}

/**
 * Post the driver's real GPS coordinates to the backend.
 * Called by TrackScreen every 10 seconds using expo-location.
 */
export async function postDriverLocation(
  driverId: string,
  lat: number,
  lng: number,
  speed?: number,
  heading?: number,
): Promise<void> {
  await apiFetch<unknown>('/driver/location', {
    method: 'POST',
    body: JSON.stringify({ driverId, lat, lng, speed, heading }),
  });
}

/**
 * End the driver's shift on the backend.
 */
export async function endDriverShift(driverId: string, codSubmitted: number, notes: string): Promise<void> {
  await apiFetch<unknown>(`/driver/${driverId}/shift/end`, {
    method: 'POST',
    body: JSON.stringify({ codSubmitted, notes }),
  });
}

/**
 * Start the driver's shift on the backend (sets to ONLINE_READY).
 */
export async function startDriverShift(driverId: string): Promise<void> {
  await apiFetch<unknown>(`/driver/${driverId}/shift/start`, {
    method: 'POST',
  });
}

// ─── Task 8.1 & 8.2: Stop POD & Delivery Execution APIs ───────────────────────

export interface ApiArrivedResponse {
  success: boolean;
  data: {
    stopId: string;
    status: ApiStopStatus;
    arrivedAt: string;
  };
}

export interface ApiSubmitPodResponse {
  success: boolean;
  data: {
    stopId: string;
    stopStatus: ApiStopStatus;
    orderStatus: string;
    codCollected: number;
    shiftCodCollected: number;
    photoUrl: string;
  };
}

export interface ApiFailStopResponse {
  success: boolean;
  data: {
    stopId: string;
    stopStatus: ApiStopStatus;
    orderStatus: string;
    action: 'FAILED' | 'RESCHEDULED';
    failureReason: string;
    rescheduledDate: string | null;
    photoUrl: string | null;
  };
}

/**
 * PATCH /api/stops/:id/arrived
 * Records arrived_at timestamp when driver is present at the customer's location.
 */
export async function markStopArrivedApi(
  stopId: string,
  token: string,
): Promise<ApiArrivedResponse> {
  return apiFetchAuth<ApiArrivedResponse>(`/stops/${stopId}/arrived`, token, {
    method: 'PATCH',
  });
}

/**
 * POST /api/stops/:id/pod
 * Submits proof of delivery with required package photo and COD collected amount.
 */
export async function submitStopPodApi(
  stopId: string,
  photoUri: string,
  codCollected: number | undefined,
  notes: string | undefined,
  token: string,
): Promise<ApiSubmitPodResponse> {
  const formData = new FormData();

  // Extract file extension or default to .jpg
  const filename = photoUri.split('/').pop() || 'pod_photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  formData.append('file', {
    uri: photoUri,
    name: filename,
    type: mimeType,
  } as any);

  if (codCollected !== undefined && codCollected !== null) {
    formData.append('codCollected', String(codCollected));
  }

  if (notes && notes.trim().length > 0) {
    formData.append('notes', notes.trim());
  }

  return apiFetchMultipart<ApiSubmitPodResponse>(`/stops/${stopId}/pod`, token, formData);
}

/**
 * POST /api/stops/:id/fail
 * Records delivery failure or customer rescheduling with optional evidence photo.
 */
export async function failStopApi(
  stopId: string,
  payload: {
    action: 'FAILED' | 'RESCHEDULED';
    failureReason: string;
    rescheduledDate?: string;
    photoUri?: string;
  },
  token: string,
): Promise<ApiFailStopResponse> {
  const formData = new FormData();

  formData.append('action', payload.action);
  formData.append('failureReason', payload.failureReason.trim());

  if (payload.action === 'RESCHEDULED' && payload.rescheduledDate) {
    formData.append('rescheduledDate', payload.rescheduledDate);
  }

  if (payload.photoUri) {
    const filename = payload.photoUri.split('/').pop() || 'fail_photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    formData.append('file', {
      uri: payload.photoUri,
      name: filename,
      type: mimeType,
    } as any);
  }

  return apiFetchMultipart<ApiFailStopResponse>(`/stops/${stopId}/fail`, token, formData);
}

