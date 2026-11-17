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
import * as FileSystem from 'expo-file-system/legacy';

// ─── ⚙️ Override (set to null for auto-detection) ─────────────────────────────
const OVERRIDE_API_HOST: string | null = null;
// Leave null for auto-detection or set to your machine Wi-Fi IP (e.g. '192.168.1.125')

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

export interface ApiPodInfo {
  id: string;
  stopId?: string;
  failureReason?: string | null;
  rescheduledDate?: string | null;
  confirmedAt?: string | null;
  photoUrl?: string | null;
  codCollected?: number;
}

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
  rescheduledDate?: string | null;
  failureReason?: string | null;
  confirmedAt?: string | null;
}

export interface ApiRouteStop {
  id: string;
  routeId: string;
  orderId: string;
  sequenceNo: number;
  status: ApiStopStatus;
  arrivedAt: string | null;
  order: ApiRouteOrder | null;
  rescheduledDate?: string | null;
  failureReason?: string | null;
  confirmedAt?: string | null;
  pod?: ApiPodInfo | null;
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
  public readonly isApiError = true;

  constructor(
    public status: number,
    public message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(err: unknown): err is ApiError {
  if (!err || typeof err !== 'object') return false;
  return (
    err instanceof ApiError ||
    (err as any).isApiError === true ||
    (typeof (err as any).status === 'number' && typeof (err as any).message === 'string')
  );
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

export interface ApiDepotInfo {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
}

export interface ApiFleetDriver {
  userId: string;
  licensePlate: string;
  vehicleType: string;
  maxWeightKg: number;
  maxVolumeM3: number;
  currentShiftStatus: string;
}

export interface ApiFleetMetrics {
  currentWeightKg: number;
  totalShiftWeightKg: number;
  totalAssignedOrders: number;
  deliveredOrders: number;
  remainingOrders: number;
}

export interface ApiFleetInfoResponse {
  success: boolean;
  driver: ApiFleetDriver;
  metrics: ApiFleetMetrics;
  depot: ApiDepotInfo | null;
  zones: string[];
  activeShift: {
    id: string;
    startTime: string;
    status: string;
  } | null;
  message?: string;
}

/**
 * GET /api/drivers/me/fleet-info
 * Fetch driver's vehicle specs, assigned depot, zones, and shift load metrics.
 */
export async function fetchFleetInfo(token: string, userId?: string): Promise<ApiFleetInfoResponse> {
  const path = userId ? `/drivers/${userId}/fleet-info` : '/drivers/me/fleet-info';
  return apiFetchAuth<ApiFleetInfoResponse>(path, token);
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
export async function fetchDriverRoute(
  driverId: string,
  token?: string,
): Promise<ApiDriverRouteResponse> {
  try {
    if (token) {
      return await apiFetchAuth<ApiDriverRouteResponse>(`/driver/${driverId}/route`, token);
    }
    return await apiFetch<ApiDriverRouteResponse>(`/driver/${driverId}/route`);
  } catch {
    try {
      if (token) {
        return await apiFetchAuth<ApiDriverRouteResponse>(`/tracking/driver/${driverId}/route-today`, token);
      }
      return await apiFetch<ApiDriverRouteResponse>(`/tracking/driver/${driverId}/route-today`);
    } catch {
      if (token) {
        return await apiFetchAuth<ApiDriverRouteResponse>(`/routes/driver/${driverId}`, token);
      }
      return await apiFetch<ApiDriverRouteResponse>(`/routes/driver/${driverId}`);
    }
  }
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
 * End the driver's shift on the backend (Legacy endpoint).
 */
export async function endDriverShift(driverId: string, codSubmitted: number, notes: string): Promise<void> {
  await apiFetch<unknown>(`/driver/${driverId}/shift/end`, {
    method: 'POST',
    body: JSON.stringify({ codSubmitted, notes }),
  });
}

// ─── Task 9.1 & KLTN-130: Shift Lifecycle & Reconciliation APIs ─────────────────

export interface ApiOpenShiftResponse {
  success: boolean;
  message: string;
  shift: {
    id: string;
    driverId: string;
    startTime: string;
    endTime: string | null;
    status: string;
    startingCashCod: number;
    codCollected: number;
    codSubmitted: number;
  };
}

/**
 * POST /api/shifts/open
 * Opens or resumes an active shift for the authenticated driver.
 * Creates a record in the shifts table and sets driver status to ONLINE_READY.
 */
export async function openShiftApi(
  options: { startingCash?: number; latitude?: number; longitude?: number } = {},
  token: string,
): Promise<ApiOpenShiftResponse> {
  return apiFetchAuth<ApiOpenShiftResponse>('/shifts/open', token, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export interface ApiCloseShiftResponse {
  success: boolean;
  message: string;
  shift: {
    id: string;
    driverId: string;
    startTime: string;
    endTime: string | null;
    status: string;
    startingCashCod: number;
    codCollected: number;
    codSubmitted: number;
  };
  summary: {
    codCollected: number;
    codSubmitted: number;
    codDifference: number;
    pendingStopsWarning: string | null;
  };
}

/**
 * POST /api/shifts/:shiftId/close (hoặc fallback POST /api/shifts/close)
 * Close shift with COD declaration and optional GPS coordinates. Requires authentication.
 */
export async function closeShiftApi(
  shiftId: string | undefined | null,
  codSubmitted: number,
  notes: string | undefined,
  token: string,
  coords?: { latitude?: number; longitude?: number },
): Promise<ApiCloseShiftResponse> {
  const endpoint = shiftId ? `/shifts/${shiftId}/close` : '/shifts/close';
  return apiFetchAuth<ApiCloseShiftResponse>(endpoint, token, {
    method: 'POST',
    body: JSON.stringify({
      codSubmitted,
      notes: notes || undefined,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    }),
  });
}

export interface ApiShiftSummaryResponse {
  shiftStatus: string;
  activeShift: {
    id: string;
    driverId: string;
    startTime: string;
    endTime: string | null;
    status: string;
    startingCashCod: number;
    codCollected: number;
    codSubmitted: number;
  } | null;
  assignedOrdersCount: number;
  deliveredOrdersCount: number;
  failedOrdersCount: number;
  pendingCodAmount: number;
}

/**
 * GET /api/driver/shift/summary
 * Fetch shift summary: order counts, COD balance. Requires auth.
 */
export async function fetchShiftSummaryApi(
  token: string,
): Promise<ApiShiftSummaryResponse> {
  return apiFetchAuth<ApiShiftSummaryResponse>('/driver/shift/summary', token);
}

export interface ApiShiftHistoryItem {
  id: string;
  driverId?: string;
  startTime: string;
  endTime: string | null;
  status: 'OPEN' | 'PENDING_SETTLEMENT' | 'CLOSED' | 'RECONCILED' | string;
  statusLabel?: string;
  startingCashCod: number;
  codCollected: number;
  codSubmitted: number;
  codDifference: number;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  reconciledBy?: string | null;
  reconciledByName?: string | null;
  reconciledAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ApiShiftHistoryResponse {
  success: boolean;
  items?: ApiShiftHistoryItem[];
  data?: ApiShiftHistoryItem[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  message?: string;
}

/**
 * GET /api/driver/shifts/history (Task KLTN-130) & /api/drivers/me/shift-history
 * Fetch shift reconciliation history for authenticated driver.
 */
export async function fetchShiftHistoryApi(
  token: string,
  pageOrUserId?: number | string,
  limit = 20,
): Promise<ApiShiftHistoryResponse> {
  if (typeof pageOrUserId === 'string') {
    return apiFetchAuth<ApiShiftHistoryResponse>(
      `/drivers/${pageOrUserId}/shift-history`,
      token,
    );
  }
  const page = typeof pageOrUserId === 'number' ? pageOrUserId : 1;
  const res = await apiFetchAuth<ApiShiftHistoryResponse>(
    `/driver/shifts/history?page=${page}&limit=${limit}`,
    token,
  );
  if (res && res.items && !res.data) {
    res.data = res.items;
  }
  return res;
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
 * Helper to upload a multipart request with a real image file using Expo's native uploadAsync.
 * Bypasses JavaScript/WinterCG FormData quirks, streaming raw file bytes directly to the backend.
 */
async function uploadMultipartWithNativeFile<T>(
  path: string,
  token: string,
  fileUri: string,
  parameters: Record<string, string>,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const filename = fileUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const response = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType,
    parameters,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status < 200 || response.status >= 300) {
    let errorMsg = `Tải lên thất bại (${response.status})`;
    let errorData: any = null;
    try {
      errorData = JSON.parse(response.body);
      if (Array.isArray(errorData?.message)) {
        errorMsg = errorData.message.join('\n');
      } else if (typeof errorData?.message === 'string') {
        errorMsg = errorData.message;
      }
    } catch {
      if (response.body) errorMsg = response.body;
    }
    throw new ApiError(response.status, errorMsg, errorData);
  }

  try {
    return JSON.parse(response.body) as T;
  } catch {
    return response.body as unknown as T;
  }
}

/**
 * Helper to append a local file (from Camera/ImagePicker) to FormData as fallback.
 * Uses ArrayBuffer to preserve real binary bytes instead of stringifying to "[object Object]".
 */
async function appendFileToFormData(
  formData: FormData,
  fieldName: string,
  uri: string,
  defaultFilename: string,
): Promise<void> {
  const filename = uri.split('/').pop() || defaultFilename;
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  try {
    const res = await fetch(uri);
    const arrayBuffer = await res.arrayBuffer();

    if (arrayBuffer && arrayBuffer.byteLength > 0) {
      if (typeof File !== 'undefined') {
        try {
          const file = new File([arrayBuffer as any], filename, { type: mimeType });
          (formData as any).append(fieldName, file, filename);
          return;
        } catch {
          // Fallback
        }
      }

      if (typeof Blob !== 'undefined') {
        try {
          const blob = new Blob([arrayBuffer as any], { type: mimeType, lastModified: Date.now() } as any);
          (formData as any).append(fieldName, blob, filename);
          return;
        } catch {
          // Fallback
        }
      }
    }
  } catch (err) {
    console.warn('[api] Failed to read URI as ArrayBuffer, falling back to legacy object:', err);
  }

  formData.append(fieldName, {
    uri,
    name: filename,
    type: mimeType,
  } as any);
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
  const params: Record<string, string> = {};
  if (codCollected !== undefined && codCollected !== null) {
    params.codCollected = String(codCollected);
  }
  if (notes && notes.trim().length > 0) {
    params.notes = notes.trim();
  }

  // 1. Preferred: native FileSystem.uploadAsync (streams real binary bytes directly without memory bloat)
  if (photoUri && typeof FileSystem.uploadAsync === 'function') {
    try {
      return await uploadMultipartWithNativeFile<ApiSubmitPodResponse>(
        `/stops/${stopId}/pod`,
        token,
        photoUri,
        params,
      );
    } catch (err) {
      if (isApiError(err)) throw err;
      console.warn('[api] Native upload failed, trying fetch fallback:', err);
    }
  }

  // 2. Fallback: standard multipart fetch
  const formData = new FormData();
  await appendFileToFormData(formData, 'file', photoUri, 'pod_photo.jpg');

  if (params.codCollected) {
    formData.append('codCollected', params.codCollected);
  }
  if (params.notes) {
    formData.append('notes', params.notes);
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
  const params: Record<string, string> = {
    action: payload.action,
    failureReason: payload.failureReason.trim(),
  };

  if (payload.action === 'RESCHEDULED' && payload.rescheduledDate) {
    params.rescheduledDate = payload.rescheduledDate;
  }

  // 1. Preferred: native FileSystem.uploadAsync if photo attached
  if (payload.photoUri && typeof FileSystem.uploadAsync === 'function') {
    try {
      return await uploadMultipartWithNativeFile<ApiFailStopResponse>(
        `/stops/${stopId}/fail`,
        token,
        payload.photoUri,
        params,
      );
    } catch (err) {
      if (isApiError(err)) throw err;
      console.warn('[api] Native upload failed, trying fetch fallback:', err);
    }
  }

  // 2. Fallback or no photo: standard multipart fetch
  const formData = new FormData();
  formData.append('action', payload.action);
  formData.append('failureReason', payload.failureReason.trim());

  if (payload.action === 'RESCHEDULED' && payload.rescheduledDate) {
    formData.append('rescheduledDate', payload.rescheduledDate);
  }

  if (payload.photoUri) {
    await appendFileToFormData(formData, 'file', payload.photoUri, 'fail_photo.jpg');
  }

  return apiFetchMultipart<ApiFailStopResponse>(`/stops/${stopId}/fail`, token, formData);
}

export interface ApiStopDetailResponse {
  success: boolean;
  data: ApiRouteStop;
}

/**
 * GET /api/stops/:id
 * Fetch detailed information for a single stop, including order and POD (if exists).
 */
export async function fetchStopDetailApi(
  stopId: string,
  token: string,
): Promise<ApiStopDetailResponse> {
  return apiFetchAuth<ApiStopDetailResponse>(`/stops/${stopId}`, token);
}

// ─── Driver Account & Shift History API ────────────────────────────────────────

export interface ApiAccountSummaryUser {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  status: string;
}

export interface ApiAccountSummaryDriver {
  userId: string;
  licensePlate: string;
  vehicleType: string;
  vehicleTypeFriendly: string;
  currentShiftStatus: string;
}

export interface ApiAccountSummaryDepot {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  latitude: number;
  longitude: number;
}

export interface ApiAccountSummaryCurrentShift {
  id: string | null;
  status: string;
  statusLabel: string;
  startTime: string | null;
  codHolding: number;
  codCollected: number;
  startingCashCod: number;
  codSubmitted: number;
}

export interface ApiAccountSummaryMetrics {
  monthlyDeliveredOrders: number;
  monthlyCompletedRoutes: number;
  monthlySuccessRate: number;
  totalProcessed: number;
}

export interface ApiAccountSummaryResponse {
  success: boolean;
  user: ApiAccountSummaryUser;
  driver: ApiAccountSummaryDriver;
  depot: ApiAccountSummaryDepot | null;
  zones: string[];
  currentShift: ApiAccountSummaryCurrentShift;
  metrics: ApiAccountSummaryMetrics;
  message?: string;
}

export interface ApiChangePasswordResponse {
  success: boolean;
  message: string;
}

export interface ApiEarningsOrderBreakdown {
  id: string;
  code: string;
  completedAt: string;
  weightKg: number;
  codAmount: number;
  deliveryAddress: string;
  grossFee: number;
  commissionRate: number;
  platformFee: number;
  netIncome: number;
}

export interface ApiEarningsPeriod {
  deliveredOrdersCount: number;
  grossEarnings: number;
  commissionRate: number;
  platformFee: number;
  netEarnings: number;
  ordersBreakdown: ApiEarningsOrderBreakdown[];
}

export interface ApiDriverEarningsResponse {
  success: boolean;
  data: {
    day: ApiEarningsPeriod;
    week: ApiEarningsPeriod;
    month: ApiEarningsPeriod;
  };
  message?: string;
}

/**
 * GET /api/drivers/me/account-summary
 * Fetches driver account details, active shift COD, assigned zones & monthly metrics.
 */
export async function fetchAccountSummaryApi(
  token: string,
  userId?: string,
): Promise<ApiAccountSummaryResponse> {
  const path = userId ? `/drivers/${userId}/account-summary` : '/drivers/me/account-summary';
  return apiFetchAuth<ApiAccountSummaryResponse>(path, token);
}

/**
 * PATCH /api/auth/change-password
 * Updates the user's password after validating current password.
 */
export async function changePasswordApi(
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<ApiChangePasswordResponse> {
  return apiFetchAuth<ApiChangePasswordResponse>('/auth/change-password', token, {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/**
 * GET /api/drivers/me/earnings
 * Fetches driver earnings breakdown (gross, 15% platform commission, net) by day, week, month.
 */
export async function fetchDriverEarningsApi(
  token: string,
  userId?: string,
): Promise<ApiDriverEarningsResponse> {
  const path = userId ? `/drivers/${userId}/earnings` : '/drivers/me/earnings';
  return apiFetchAuth<ApiDriverEarningsResponse>(path, token);
}




