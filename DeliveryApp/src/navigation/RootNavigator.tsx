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
 *   MainTabs (HomeScreen, Tasks, Track, Account)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { PermissionScreen } from '../screens/auth/PermissionScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { EndShiftModal } from '../screens/modals/EndShiftModal';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/theme';

export type RootStackParamList = {
  Permission: undefined;
  Login: undefined;
  MainTabs: undefined;
  EndShiftModal: undefined;
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

  // ─── Splash screen while loading auth / checking permissions ──────────────
  if (isAuthLoading || hasPermissions === null) {
    return (
      <View style={styles.splash}>
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>V</Text>
        </View>
        <Text style={styles.splashTitle}>LOGISTICS PRO</Text>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 24 }} />
      </View>
    );
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
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '45deg' }],
    marginBottom: 24,
  },
  logoIcon: {
    color: '#FFF',
    fontSize: 40,
    fontWeight: 'bold',
    transform: [{ rotate: '-45deg' }],
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 3,
  },
});
