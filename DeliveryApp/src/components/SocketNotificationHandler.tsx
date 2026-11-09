import React, { useEffect } from 'react';
import { Alert, Vibration, Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  onNewRouteAssigned,
  NewRouteAssignedPayload,
} from '../lib/socketClient';
import { navigationRef } from '../navigation/navigationRef';

const ANDROID_CHANNEL_ID = 'delivery_alerts_channel';

// Setup notification presentation options
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn('[SocketNotificationHandler] Could not configure notification handler:', e);
}

/**
 * SocketNotificationHandler:
 * - Manages the lifecycle of the Socket.io connection for authenticated drivers.
 * - Listens for 'server:new_route_assigned' events from the backend gateway with defensive try-catch.
 * - Manages connection status based on AppState (background / active) to eliminate ghost sockets.
 * - Triggers multi-channel UI feedback:
 *   1. Silent AppContext route and AuthContext profile refresh
 *   2. Haptic vibration feedback
 *   3. In-app Toast banner
 *   4. Safe Local Notification (checks permission first, creates channel on Android)
 *   5. Native Alert modal with direct navigation shortcut to Tasks tab
 */
export const SocketNotificationHandler: React.FC = () => {
  const { isAuthenticated, accessToken, user, refreshDriverProfile } = useAuth();
  const { refreshRoute } = useAppContext();
  const toast = useToast();

  // 1. Manage socket connection lifecycle upon auth change
  useEffect(() => {
    if (isAuthenticated && accessToken && user?.role === 'DRIVER') {
      console.log(`[SocketNotificationHandler] Connecting socket for driver ${user.id}...`);
      connectSocket(accessToken);
    } else if (!isAuthenticated) {
      console.log('[SocketNotificationHandler] Unauthenticated — disconnecting socket.');
      disconnectSocket();
    }
  }, [isAuthenticated, accessToken, user?.role, user?.id]);

  // 2. STEP 4: Manage socket lifecycle on AppState change (background / active)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(`[SocketNotificationHandler] AppState changed to: ${nextAppState}`);
      const socket = getSocket();

      if (nextAppState === 'background') {
        console.log('[SocketNotificationHandler] App went to background → disconnecting socket');
        socket?.disconnect();
      } else if (nextAppState === 'active') {
        console.log('[SocketNotificationHandler] App became active → reconnecting socket');
        if (isAuthenticated && accessToken && user?.role === 'DRIVER') {
          if (socket && !socket.connected) {
            socket.connect();
          } else if (!socket) {
            connectSocket(accessToken);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, accessToken, user?.role]);

  // 3. STEP 1: Listen for 'server:new_route_assigned' with robust defensive handling
  useEffect(() => {
    const unsubscribe = onNewRouteAssigned(async (payload: NewRouteAssignedPayload) => {
      try {
        console.log('[SocketNotificationHandler] 🔔 Received server:new_route_assigned:', payload);

        if (!payload || !payload.routeId) {
          console.warn('[SocketNotificationHandler] Received invalid payload, skipping');
          return;
        }

        // 1. Silent data refresh in AppContext and AuthContext
        try {
          await Promise.allSettled([
            refreshRoute(payload.driverId),
            refreshDriverProfile(),
          ]);
        } catch (refreshErr) {
          console.warn('[SocketNotificationHandler] Route/profile refresh error:', refreshErr);
        }

        // 2. Physical haptic feedback
        try {
          Vibration.vibrate([0, 300, 150, 300]);
        } catch (vibErr) {
          console.warn('[SocketNotificationHandler] Vibration failed:', vibErr);
        }

        // 3. In-app Toast message (always safe)
        try {
          toast.success(
            '🚀 Chuyến Đi Mới!',
            payload.message || `Tuyến ${payload.routeCode || ''} (${payload.stopCount || 0} điểm dừng) đã được gán.`,
            5000,
          );
        } catch (toastErr) {
          console.warn('[SocketNotificationHandler] Toast failed:', toastErr);
        }

        // 4. Local Push Notification (verify permissions & channel before firing to prevent Android crash)
        try {
          const permission = await Notifications.getPermissionsAsync();
          if (permission && permission.status === 'granted') {
            if (Platform.OS === 'android') {
              await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
                name: 'Điều Phối Tuyến Mới',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#2563EB',
              });
            }

            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🚀 Bạn có chuyến đi mới!',
                body: `Tuyến ${payload.routeCode || ''} (${payload.stopCount || 0} điểm dừng) đã sẵn sàng.`,
                data: { routeId: payload.routeId },
                ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
              } as any,
              trigger: null,
            });
          } else {
            console.log('[SocketNotificationHandler] Push permission not granted — bypassed local push notification.');
          }
        } catch (notifErr) {
          // Gracefully catch any notification error so the app never crashes!
          console.warn('[SocketNotificationHandler] Local notification bypassed safely:', notifErr);
        }

        // 5. Native Alert modal
        try {
          Alert.alert(
            '🚀 Bạn Có Chuyến Đi Mới!',
            `Điều phối viên vừa gán tuyến ${payload.routeCode || ''} (${payload.stopCount || 0} điểm dừng).\n\nBạn có muốn mở danh sách nhiệm vụ ngay không?`,
            [
              { text: 'Để sau', style: 'cancel' },
              {
                text: 'Xem ngay',
                onPress: () => {
                  try {
                    if (navigationRef.isReady()) {
                      navigationRef.navigate('MainTabs', { screen: 'Tasks' });
                    }
                  } catch (navErr) {
                    console.warn('[SocketNotificationHandler] Navigation error:', navErr);
                  }
                },
              },
            ],
            { cancelable: true },
          );
        } catch (alertErr) {
          console.warn('[SocketNotificationHandler] Alert modal failed:', alertErr);
        }
      } catch (fatalErr) {
        console.error('[SocketNotificationHandler] Master error in route assignment handler:', fatalErr);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshRoute, refreshDriverProfile, toast]);

  return null;
};
