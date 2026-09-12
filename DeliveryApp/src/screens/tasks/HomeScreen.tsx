import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Package, CheckCircle, Wallet, ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';
import { RootStackParamList } from '../../navigation/RootNavigator';

import { startDriverShift } from '../../lib/api';
import { Alert } from 'react-native';

export const HomeScreen = () => {
  const { driver, shift, stops, setDriver } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<TaskStackParamList & RootStackParamList>>();

  const isOnline = driver.current_shift_status === 'ONLINE_READY' || driver.current_shift_status === 'BUSY';

  const handleToggleShift = async (value: boolean) => {
    if (!value) {
      // Going offline triggers EndShiftModal
      navigation.navigate('EndShiftModal');
    } else {
      if (!driver?.user_id) return;
      try {
        await startDriverShift(driver.user_id);
        setDriver({ ...driver, current_shift_status: 'ONLINE_READY' });
      } catch {
        Alert.alert('Lỗi', 'Không thể mở ca trên hệ thống. Vui lòng thử lại sau.');
      }
    }
  };

  const assignedStops = stops.length;
  const completedStops = stops.filter(s => s.status === 'COMPLETED').length;
  const totalCod = shift?.cod_collected || 0;

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SIZES.padding_md }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={TYPOGRAPHY.bodySecondary}>Chào buổi sáng,</Text>
            <Text style={TYPOGRAPHY.header}>{driver.name}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <Bell color={COLORS.textPrimary} size={24} />
          </TouchableOpacity>
        </View>

        {/* Shift Status Card */}
        <View style={COMMON_STYLES.card}>
          <View style={styles.shiftCardContent}>
            <View>
              <Text style={TYPOGRAPHY.title}>Trạng thái ca làm</Text>
              <Text style={isOnline ? styles.onlineText : styles.offlineText}>
                {isOnline ? 'TRỰC TUYẾN' : 'NGOẠI TUYẾN'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleShift}
              trackColor={{ false: COLORS.border, true: COLORS.success }}
              thumbColor={COLORS.surface}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>
        </View>

        {/* Summary Cards */}
        <Text style={[TYPOGRAPHY.title, { marginBottom: SIZES.padding_sm, marginTop: SIZES.padding_sm }]}>Tóm tắt hôm nay</Text>
        <View style={styles.summaryGrid}>
          <View style={[COMMON_STYLES.card, styles.summaryCard]}>
            <Package color={COLORS.primary} size={24} />
            <Text style={styles.summaryValue}>{assignedStops}</Text>
            <Text style={TYPOGRAPHY.bodySecondary}>Đã phân công</Text>
          </View>
          <View style={[COMMON_STYLES.card, styles.summaryCard]}>
            <CheckCircle color={COLORS.success} size={24} />
            <Text style={styles.summaryValue}>{completedStops}</Text>
            <Text style={TYPOGRAPHY.bodySecondary}>Đã hoàn thành</Text>
          </View>
        </View>

        <View style={[COMMON_STYLES.card, styles.codCard]}>
          <View style={styles.codRow}>
            <Wallet color={COLORS.primary} size={24} style={{ marginRight: 12 }} />
            <View>
              <Text style={TYPOGRAPHY.bodySecondary}>Tổng tiền mặt COD</Text>
              <Text style={styles.codValue}>{totalCod.toLocaleString('vi-VN')} VND</Text>
            </View>
          </View>
        </View>

        {/* Active Route CTA */}
        {isOnline && (
          <TouchableOpacity
            style={[COMMON_STYLES.primaryButton, { marginTop: SIZES.padding_lg }]}
            onPress={() => navigation.navigate('StopList')}
          >
            <Text style={TYPOGRAPHY.buttonText}>XEM TUYẾN ĐANG CHẠY</Text>
            <ArrowRight color="#FFF" size={20} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.padding_lg,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shiftCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
    marginTop: 4,
  },
  offlineText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.inactive,
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 0.48,
    alignItems: 'flex-start',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginVertical: 8,
  },
  codCard: {
    marginTop: 0,
  },
  codRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
});
