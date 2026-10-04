/**
 * PermissionScreen — Frame 14
 *
 * Requests real system permissions: Location, Camera, Push Notification.
 * Each toggle checks actual permission status (not just local state).
 * Re-checks permissions on mount so if user revokes in Settings, UI reflects it.
 * "CẤP QUYỀN" button only enabled when all 3 permissions are granted.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Camera as CameraIcon, Bell } from 'lucide-react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';

type PermissionState = {
  location: boolean;
  camera: boolean;
  notifications: boolean;
};

export const PermissionScreen = ({ onAllGranted }: { onAllGranted?: () => void }) => {
  const [perms, setPerms] = useState<PermissionState>({
    location: false,
    camera: false,
    notifications: false,
  });

  const allGranted = perms.location && perms.camera && perms.notifications;

  // ─── Check current permission status on mount & focus ─────────────────────
  const checkPermissions = useCallback(async () => {
    const [locStatus, camStatus, notifStatus] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Camera.getCameraPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);

    setPerms({
      location: locStatus.status === 'granted',
      camera: camStatus.status === 'granted',
      notifications: notifStatus.status === 'granted',
    });
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // ─── Helper: show "go to Settings" alert if permanently denied ────────────
  const showSettingsAlert = (permName: string) => {
    Alert.alert(
      `Quyền ${permName} bị từ chối`,
      `Quyền ${permName} đang bị từ chối vĩnh viễn.\nVui lòng vào Cài đặt để cấp quyền.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
      ],
    );
  };

  // ─── Request individual permissions ───────────────────────────────────────
  const handleLocationToggle = async (value: boolean) => {
    if (value) {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setPerms(p => ({ ...p, location: true }));
      } else if (!canAskAgain) {
        showSettingsAlert('Vị trí');
      }
    }
    // Can't programmatically revoke — user must go to Settings
  };

  const handleCameraToggle = async (value: boolean) => {
    if (value) {
      const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
      if (status === 'granted') {
        setPerms(p => ({ ...p, camera: true }));
      } else if (!canAskAgain) {
        showSettingsAlert('Máy ảnh');
      }
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setPerms(p => ({ ...p, notifications: true }));
      } else if (!canAskAgain) {
        showSettingsAlert('Thông báo');
      }
    }
  };

  const handleContinue = () => {
    if (allGranted && onAllGranted) {
      onAllGranted();
    }
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={[TYPOGRAPHY.header, { fontSize: 28, marginBottom: 12 }]}>Quyền Ứng Dụng</Text>
        <Text style={[TYPOGRAPHY.bodySecondary, { marginBottom: 32 }]}>
          LogisticsPro yêu cầu các quyền sau để hoạt động chính xác trong suốt ca làm việc của bạn.
        </Text>

        <View style={COMMON_STYLES.card}>
          {/* Location */}
          <View style={styles.permissionRow}>
            <View style={[styles.iconContainer, perms.location && styles.iconGranted]}>
              <MapPin color={perms.location ? '#10B981' : COLORS.primary} size={24} />
            </View>
            <View style={styles.textContainer}>
              <Text style={TYPOGRAPHY.title}>Dịch vụ Vị trí</Text>
              <Text style={TYPOGRAPHY.bodySecondary}>Dùng để theo dõi tuyến đường và điều hướng</Text>
            </View>
            <Switch
              value={perms.location}
              onValueChange={handleLocationToggle}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
              disabled={perms.location}
            />
          </View>

          <View style={styles.divider} />

          {/* Camera */}
          <View style={styles.permissionRow}>
            <View style={[styles.iconContainer, perms.camera && styles.iconGranted]}>
              <CameraIcon color={perms.camera ? '#10B981' : COLORS.primary} size={24} />
            </View>
            <View style={styles.textContainer}>
              <Text style={TYPOGRAPHY.title}>Truy cập Máy ảnh</Text>
              <Text style={TYPOGRAPHY.bodySecondary}>Yêu cầu để chụp POD và bằng chứng thất bại</Text>
            </View>
            <Switch
              value={perms.camera}
              onValueChange={handleCameraToggle}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
              disabled={perms.camera}
            />
          </View>

          <View style={styles.divider} />

          {/* Notifications */}
          <View style={styles.permissionRow}>
            <View style={[styles.iconContainer, perms.notifications && styles.iconGranted]}>
              <Bell color={perms.notifications ? '#10B981' : COLORS.primary} size={24} />
            </View>
            <View style={styles.textContainer}>
              <Text style={TYPOGRAPHY.title}>Thông báo Đẩy</Text>
              <Text style={TYPOGRAPHY.bodySecondary}>Cập nhật về các tuyến được giao mới và tin nhắn</Text>
            </View>
            <Switch
              value={perms.notifications}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
              disabled={perms.notifications}
            />
          </View>
        </View>

        {/* Status indicator */}
        {!allGranted && (
          <Text style={styles.statusHint}>
            Vui lòng cấp tất cả quyền để tiếp tục
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[COMMON_STYLES.primaryButton, !allGranted && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!allGranted}
          activeOpacity={0.8}
        >
          <Text style={TYPOGRAPHY.buttonText}>
            {allGranted ? 'TIẾP TỤC' : 'CẤP QUYỀN'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: SIZES.padding_lg,
    justifyContent: 'center',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2', // light red
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconGranted: {
    backgroundColor: '#D1FAE5', // light green
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  statusHint: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 16,
  },
  footer: {
    padding: SIZES.padding_lg,
    paddingBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
