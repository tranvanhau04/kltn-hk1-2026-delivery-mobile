/**
 * RootNavigator — Controls the auth flow:
 *
 *   App opens
 *     │
 *     ▼
 *   AuthContext.isLoading? → SplashScreen
 *     │
 *     ▼
 *   Kiểm tra permissions (Location, Camera, Notification)
 *     │
 *     ├─ Chưa đủ → PermissionScreen
 *     │
 *     ▼
 *   isAuthenticated?
 *     │
 *     ├─ No → LoginScreen
 *     │
 *     ▼
 *   MainTabs (HomeScreen, Fleet, Tasks, Account)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { PermissionScreen } from '../screens/auth/PermissionScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { BrandSplashScreen } from '../screens/auth/BrandSplashScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { EndShiftModal } from '../screens/modals/EndShiftModal';
import { ShiftHistoryScreen } from '../screens/tasks/ShiftHistoryScreen';
import { LiveNavigationScreen, LiveNavigationParams } from '../screens/LiveNavigationScreen';
import { useAuth } from '../context/AuthContext';

export type RootStackParamList = {
  Permission: undefined;
  Login: undefined;
  MainTabs: undefined;
  EndShiftModal: undefined;
  ShiftHistoryScreen: undefined;
  LiveNavigationScreen: LiveNavigationParams;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null); // null = checking

  // ─── Check real permission status ─────────────────────────────────────────
  const checkPermissions = useCallback(async () => {
    try {
      const [locStatus, camStatus, notifStatus] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Camera.getCameraPermissionsAsync(),
        Notifications.getPermissionsAsync(),
      ]);

      const allGranted =
        locStatus.status === 'granted' &&
        camStatus.status === 'granted' &&
        notifStatus.status === 'granted';

      setHasPermissions(allGranted);
    } catch {
      // If permission check fails, assume not granted
      setHasPermissions(false);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // ─── Modern Splash Screen while loading auth / checking permissions ──────────
  if (isAuthLoading || hasPermissions === null) {
    return <BrandSplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!hasPermissions ? (
        <Stack.Screen name="Permission">
          {() => (
            <PermissionScreen
              onAllGranted={() => setHasPermissions(true)}
            />
          )}
        </Stack.Screen>
      ) : !isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen
            name="EndShiftModal"
            component={EndShiftModal}
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="ShiftHistoryScreen"
            component={ShiftHistoryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="LiveNavigationScreen"
            component={LiveNavigationScreen}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

