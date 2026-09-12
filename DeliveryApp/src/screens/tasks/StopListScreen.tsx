import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, Phone, ChevronRight, CheckCircle2 } from 'lucide-react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';
import { MainTabParamList } from '../../navigation/MainTabNavigator';

type StopListNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<TaskStackParamList, 'StopList'>,
  BottomTabNavigationProp<MainTabParamList>
>;

export const StopListScreen = () => {
  const { stops, isLoadingRoute } = useAppContext();
  const navigation = useNavigation<StopListNavProp>();

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở ứng dụng gọi điện');
    });
  };

  const handleNavigate = (stopId: string, lat: number, lng: number, receiverName: string, address: string) => {
    navigation.navigate('Track', {
      selectedStopId: stopId,
      destLat: lat,
      destLng: lng,
      address: address,
      customerName: receiverName,
      autoStartNavigation: true,
    });
  };

  const activeStops = stops.filter(s => s.status !== 'COMPLETED' && s.status !== 'FAILED');

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={TYPOGRAPHY.header}>Tuyến đường hôm nay</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Đang giao</Text>
          </View>
        </View>
        <Text style={TYPOGRAPHY.bodySecondary}>
          {isLoadingRoute ? 'Đang tải...' : `${activeStops.length} điểm còn lại`}
        </Text>
      </View>

      <FlatList
        data={stops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SIZES.padding_md }}
        renderItem={({ item }) => {
          const isDone = item.status === 'COMPLETED' || item.status === 'FAILED';
          const isPending = item.status === 'PENDING';
          const isArrived = item.status === 'ARRIVED';

          return (
            <TouchableOpacity
              style={[COMMON_STYLES.card, isDone && { opacity: 0.6 }]}
              onPress={() => navigation.navigate('StopDetail', { stopId: item.id })}
              disabled={isDone}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.sequenceBadge, isDone && { backgroundColor: COLORS.inactive }]}>
                  <Text style={styles.sequenceText}>{item.sequence_no}</Text>
                </View>
                <View style={styles.cardTitleContainer}>
                  <Text style={TYPOGRAPHY.title}>{item.order.code}</Text>
                  {isDone ? (
                    <Text style={[TYPOGRAPHY.bodySecondary, { color: item.status === 'COMPLETED' ? COLORS.success : COLORS.danger }]}>
                      {item.status === 'COMPLETED' ? 'Đã giao' : 'Thất bại'}
                    </Text>
                  ) : (
                    <Text style={TYPOGRAPHY.bodySecondary}>{isArrived ? 'Đã đến nơi' : 'Chờ giao'}</Text>
                  )}
                </View>
                {isDone ? (
                  <CheckCircle2 color={item.status === 'COMPLETED' ? COLORS.success : COLORS.danger} size={24} />
                ) : (
                  <ChevronRight color={COLORS.inactive} size={24} />
                )}
              </View>

              {/* Receiver name */}
              <Text style={[TYPOGRAPHY.body, { fontWeight: '600', marginBottom: 4 }]}>
                {item.order.receiver_name}
              </Text>

              <Text style={[TYPOGRAPHY.body, styles.address]} numberOfLines={2}>
                {item.order.delivery_address}
              </Text>

              {/* COD badge */}
              {item.order.cod_amount > 0 && (
                <View style={styles.codBadge}>
                  <Text style={styles.codBadgeText}>
                    COD: {item.order.cod_amount.toLocaleString('vi-VN')}₫
                  </Text>
                </View>
              )}

              {!isDone && (
                <View style={styles.actionRow}>
                  {/* Chỉ đường button → opens In-App Navigation */}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleNavigate(
                      item.id,
                      item.order.lat,
                      item.order.lng,
                      item.order.receiver_name,
                      item.order.delivery_address
                    )}
                  >
                    <Navigation color={COLORS.primary} size={20} />
                    <Text style={styles.actionButtonText}>Chỉ đường</Text>
                  </TouchableOpacity>

                  {/* Call button */}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleCall(item.order.receiver_phone)}
                  >
                    <Phone color={COLORS.primary} size={20} />
                    <Text style={styles.actionButtonText}>Gọi điện</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: SIZES.padding_md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: SIZES.radius_sm,
  },
  badgeText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sequenceBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sequenceText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardTitleContainer: {
    flex: 1,
  },
  address: {
    marginBottom: 8,
    color: COLORS.textSecondary,
  },
  codBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 12,
  },
  codBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
