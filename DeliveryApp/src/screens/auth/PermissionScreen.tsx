import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Camera, Bell } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';

export const PermissionScreen = () => {
  const [location, setLocation] = useState(false);
  const [camera, setCamera] = useState(false);
  const [notifications, setNotifications] = useState(false);

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={[TYPOGRAPHY.header, { fontSize: 28, marginBottom: 12 }]}>App Permissions</Text>
        <Text style={[TYPOGRAPHY.bodySecondary, { marginBottom: 32 }]}>
          LogisticsPro requires the following permissions to function correctly during your shifts.
        </Text>

        <View style={COMMON_STYLES.card}>
          <View style={styles.permissionRow}>
            <View style={styles.iconContainer}>
              <MapPin color={COLORS.primary} size={24} />
            </View>
            <View style={styles.textContainer}>
              <Text style={TYPOGRAPHY.title}>Location Services</Text>
              <Text style={TYPOGRAPHY.bodySecondary}>Used for route tracking and map navigation</Text>
            </View>
            <Switch
              value={location}
              onValueChange={setLocation}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.permissionRow}>
            <View style={styles.iconContainer}>
              <Camera color={COLORS.primary} size={24} />
            </View>
            <View style={styles.textContainer}>
              <Text style={TYPOGRAPHY.title}>Camera Access</Text>
              <Text style={TYPOGRAPHY.bodySecondary}>Required for capturing POD and failure evidence</Text>
            </View>
            <Switch
              value={camera}
              onValueChange={setCamera}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.permissionRow}>
            <View style={styles.iconContainer}>
              <Bell color={COLORS.primary} size={24} />
            </View>
            <View style={styles.textContainer}>
              <Text style={TYPOGRAPHY.title}>Push Notifications</Text>
              <Text style={TYPOGRAPHY.bodySecondary}>Updates about new assigned routes and messages</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
            />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={COMMON_STYLES.primaryButton}>
          <Text style={TYPOGRAPHY.buttonText}>GRANT PERMISSIONS</Text>
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
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  footer: {
    padding: SIZES.padding_lg,
    paddingBottom: 32,
  },
});
