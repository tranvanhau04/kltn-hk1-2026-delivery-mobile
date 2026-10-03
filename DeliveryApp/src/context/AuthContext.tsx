/**
 * AuthContext — Manages authentication state, secure token storage,
 * and driver profile for the mobile app.
 *
 * Flow:
 *   App opens → checkStoredToken() → isAuthenticated?
 *     Yes → fetch driver profile → HomeScreen
 *     No  → LoginScreen
 *
 * Token storage uses expo-secure-store (encrypted on device).
 */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginApi, fetchDriverProfile, updateShiftStatusApi, ApiLoginResponse, ApiDriverProfile } from '../lib/api';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const STORE_KEY_ACCESS = 'auth_access_token';
const STORE_KEY_REFRESH = 'auth_refresh_token';
const STORE_KEY_USER = 'auth_user';

// ─── Types ────────────────────────────────────────────────────────────────────
export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
};

export type DriverProfile = {
  userId: string;
  licensePlate: string;
  vehicleType: string;
  maxWeightKg: number;
  maxVolumeM3: number;
  currentShiftStatus: 'OFFLINE' | 'ONLINE_READY' | 'BUSY' | 'ON_DUTY';
};

type AuthContextType = {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  accessToken: string | null;

  // Driver profile
  driverProfile: DriverProfile | null;
  isLoadingDriver: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshDriverProfile: () => Promise<void>;
  toggleShiftStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoadingDriver, setIsLoadingDriver] = useState(false);

  const isAuthenticated = !!accessToken && !!user;

  // ─── Boot: check stored token ────────────────────────────────────────────────
  useEffect(() => {
    checkStoredToken();
  }, []);

  async function checkStoredToken() {
    try {
      const storedToken = await SecureStore.getItemAsync(STORE_KEY_ACCESS);
      const storedUser = await SecureStore.getItemAsync(STORE_KEY_USER);

      if (storedToken && storedUser) {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        setAccessToken(storedToken);
        setUser(parsedUser);

        // If this user is a driver, fetch their driver profile
        if (parsedUser.role === 'DRIVER') {
          await loadDriverProfile(parsedUser.id, storedToken);
        }
      }
    } catch (err) {
      // Token corrupt or expired — force re-login
      console.warn('[AuthContext] Failed to restore session:', err);
      await clearStorage();
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Load driver profile from backend ────────────────────────────────────────
  async function loadDriverProfile(userId: string, token: string) {
    setIsLoadingDriver(true);
    try {
      const profile = await fetchDriverProfile(userId, token);
      setDriverProfile({
        userId: profile.userId,
        licensePlate: profile.licensePlate,
        vehicleType: profile.vehicleType,
        maxWeightKg: profile.maxWeightKg,
        maxVolumeM3: profile.maxVolumeM3,
        currentShiftStatus: profile.currentShiftStatus as DriverProfile['currentShiftStatus'],
      });
    } catch (err) {
      console.warn('[AuthContext] Failed to load driver profile:', err);
    } finally {
      setIsLoadingDriver(false);
    }
  }

  // ─── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const response: ApiLoginResponse = await loginApi(email, password);

    // Save tokens + user to SecureStore
    await SecureStore.setItemAsync(STORE_KEY_ACCESS, response.accessToken);
    await SecureStore.setItemAsync(STORE_KEY_REFRESH, response.refreshToken);
    await SecureStore.setItemAsync(STORE_KEY_USER, JSON.stringify(response.user));

    setAccessToken(response.accessToken);
    setUser(response.user);

    // If driver, fetch profile (vehicle info, shift status)
    if (response.user.role === 'DRIVER') {
      await loadDriverProfile(response.user.id, response.accessToken);
    }
  }, []);

  // ─── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await clearStorage();
    setAccessToken(null);
    setUser(null);
    setDriverProfile(null);
  }, []);

  // ─── Refresh driver profile ──────────────────────────────────────────────────
  const refreshDriverProfile = useCallback(async () => {
    if (user && accessToken) {
      await loadDriverProfile(user.id, accessToken);
    }
  }, [user, accessToken]);

  // ─── Toggle Shift Status (OFFLINE ↔ ONLINE_READY) ───────────────────────────
  const toggleShiftStatus = useCallback(async () => {
    if (!user || !accessToken || !driverProfile) return;

    const currentStatus = driverProfile.currentShiftStatus;
    const newStatus = currentStatus === 'ONLINE_READY' ? 'OFFLINE' : 'ONLINE_READY';

    // Optimistic UI update
    setDriverProfile(prev => prev ? { ...prev, currentShiftStatus: newStatus } : null);

    try {
      await updateShiftStatusApi(user.id, newStatus, accessToken);
    } catch (err) {
      // Rollback on failure
      setDriverProfile(prev => prev ? { ...prev, currentShiftStatus: currentStatus } : null);
      throw err; // Re-throw so UI can show Alert
    }
  }, [user, accessToken, driverProfile]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  async function clearStorage() {
    await SecureStore.deleteItemAsync(STORE_KEY_ACCESS);
    await SecureStore.deleteItemAsync(STORE_KEY_REFRESH);
    await SecureStore.deleteItemAsync(STORE_KEY_USER);
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        accessToken,
        driverProfile,
        isLoadingDriver,
        login,
        logout,
        refreshDriverProfile,
        toggleShiftStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
