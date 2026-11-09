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

  // 3. STEP 1: Listen for 'new_route_assigned' & 'server:new_route_assigned'
  useEffect(() => {
    const unsubscribe = onNewRouteAssigned(async (payload: NewRouteAssignedPayload) => {
      try {
        console.log('[SocketNotificationHandler] 🔔 Received new route assignment event:', payload);

        if (!payload) {
          console.warn('[SocketNotificationHandler] Received empty payload, skipping');
          return;
        }

        // 1. Silent data refresh in AppContext and AuthContext (refetches route-today and driver profile)
        // Wrapped in 1500ms setTimeout to avoid race condition while backend database commits VRP transactions
        setTimeout(async () => {
          try {
            console.log('[SocketNotificationHandler] ⏳ Fetching latest route & profile after delay...');
            await Promise.allSettled([
              refreshRoute(payload.driverId || user?.id),
              refreshDriverProfile(),
            ]);
            console.log('[SocketNotificationHandler] ✅ Route & profile updated.');
          } catch (refreshErr) {
            console.warn('[SocketNotificationHandler] Route/profile refresh error:', refreshErr);
          }
        }, 1500);

        // 2. Physical haptic feedback (vibration pattern: [0, 500, 200, 500])
        try {
          Vibration.vibrate([0, 500, 200, 500]);
        } catch (vibErr) {
          console.warn('[SocketNotificationHandler] Vibration failed:', vibErr);
        }

        // 3. In-app Toast message (always safe)
        try {
          const alertMessage = payload.message || 'Bạn vừa được phân công một tuyến đường mới.';
          toast.success('Đơn hàng mới!', alertMessage, 5000);
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
                vibrationPattern: [0, 500, 200, 500],
                lightColor: '#2563EB',
              });
            }

            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Đơn hàng mới!',
                body: payload.message || 'Bạn vừa được phân công một tuyến đường mới.',
                data: { routeId: payload.routeId, orderId: payload.orderId },
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
            'Đơn hàng mới!',
            payload.message || 'Bạn vừa được phân công một tuyến đường mới.',
            [
              { text: 'Đóng', style: 'cancel' },
              {
                text: 'Xem chi tiết',
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
  }, [refreshRoute, refreshDriverProfile, toast, user?.id]);

  return null;
};
