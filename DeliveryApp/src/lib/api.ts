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

// ─── Helper ───────────────────────────────────────────────────────────────────

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
      throw new Error(`API ${path} failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── API Functions ────────────────────────────────────────────────────────────

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
