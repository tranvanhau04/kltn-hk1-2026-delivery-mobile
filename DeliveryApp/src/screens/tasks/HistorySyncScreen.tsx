import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  DollarSign,
  MapPin,
  Clock,
  Check,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  getQueue,
  dequeue,
  updateQueueItemError,
  OfflineAction,
} from '../../lib/offlineQueue';
import {
  markStopArrivedApi,
  submitStopPodApi,
  failStopApi,
  isApiError,
} from '../../lib/api';

export const HistorySyncScreen = () => {
  const { stops, refreshRoute } = useAppContext();
  const { token } = useAuth();
  const navigation = useNavigation();

  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Load offline queue from AsyncStorage
  const loadQueue = useCallback(async () => {
    try {
      const items = await getQueue();
      setOfflineQueue(items);
    } catch (err) {
      console.warn('[HistorySyncScreen] Error loading queue:', err);
    }
  }, []);

  // Reload queue whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      void loadQueue();
    }, [loadQueue]),
  );

  const completedStops = stops.filter(
    (s) => s.status === 'COMPLETED' || s.status === 'FAILED',
  );

  // Pull-to-refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadQueue(), refreshRoute()]);
    } catch (err) {
      console.warn('[HistorySyncScreen] Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sync offline actions with backend
  const handleSyncAll = async () => {
    if (!token) {
      Alert.alert('Chưa đăng nhập', 'Vui lòng đăng nhập lại để đồng bộ dữ liệu lên máy chủ.');
      return;
    }

    if (offlineQueue.length === 0) {
      Alert.alert('Thông báo', 'Hàng chờ ngoại tuyến trống.');
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    let failureCount = 0;

    const currentItems = [...offlineQueue];

    for (const action of currentItems) {
      try {
        switch (action.type) {
          case 'MARK_ARRIVED':
            await markStopArrivedApi(action.stopId, token);
            break;

          case 'SUBMIT_POD': {
            const payload = action.payload || {};
            await submitStopPodApi(
              action.stopId,
              payload.photoUri || '',
              payload.codCollected !== undefined ? Number(payload.codCollected) : undefined,
              payload.notes,
              token,
            );
            break;
          }

          case 'FAIL_STOP': {
            const payload = action.payload || {};
            await failStopApi(
              action.stopId,
              {
                action: payload.action || 'FAILED',
                failureReason: payload.failureReason || 'Không giao được hàng',
                rescheduledDate: payload.rescheduledDate,
                photoUri: payload.photoUri,
              },
              token,
            );
            break;
          }

          default:
            console.warn('[HistorySyncScreen] Unknown offline action type:', action.type);
        }

        // Successfully synced -> remove from queue
        await dequeue(action.id);
        successCount++;
      } catch (err) {
        failureCount++;
        const errorMsg = isApiError(err) ? err.message : 'Lỗi kết nối';
        await updateQueueItemError(action.id, errorMsg);
        console.warn(`[HistorySyncScreen] Failed syncing action ${action.id}:`, err);
      }
    }

    // Refresh state
    await loadQueue();
    try {
      await refreshRoute();
    } catch {
      // Ignored
    }

    setIsSyncing(false);

    if (failureCount === 0) {
      Alert.alert('Đồng bộ hoàn tất', `Đã đồng bộ thành công ${successCount} mục lên máy chủ.`);
    } else {
      Alert.alert(
        'Kết quả đồng bộ',
        `Đã đồng bộ thành công: ${successCount} mục.\nThất bại: ${failureCount} mục (vẫn được lưu trong hàng chờ ngoại tuyến để thử lại sau).`,
      );
    }
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={TYPOGRAPHY.header}>Lịch sử & Đồng bộ</Text>
      </View>

      {/* Offline Sync Banner */}
      {offlineQueue.length > 0 ? (
        <View style={styles.syncBanner}>
          <View style={styles.syncInfo}>
            <RefreshCw color="#D97706" size={20} style={{ marginRight: 8 }} />
            <View>
              <Text style={styles.syncText}>
                {offlineQueue.length} tác vụ đang chờ đồng bộ ngoại tuyến
              </Text>
              <Text style={styles.syncSubText}>Dữ liệu POD/Điểm dừng lưu cục bộ</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && { opacity: 0.7 }]}
            onPress={handleSyncAll}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.syncButtonText}>Đồng bộ ngay</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.syncedBanner}>
          <Check color={COLORS.success} size={18} style={{ marginRight: 8 }} />
          <Text style={styles.syncedText}>Tất cả dữ liệu đã được đồng bộ trực tuyến</Text>
        </View>
      )}

      {/* List of Delivered & Failed Stops */}
      <FlatList
        data={completedStops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          completedStops.length > 0 ? (
            <Text style={[TYPOGRAPHY.bodySecondary, { marginBottom: 12, fontWeight: '600' }]}>
              DANH SÁCH ĐƠN HÀNG TRONG NGÀY ({completedStops.length})
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <CheckCircle2 color={COLORS.textSecondary} size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
            <Text style={TYPOGRAPHY.title}>Chưa có đơn hoàn thành</Text>
            <Text style={[TYPOGRAPHY.bodySecondary, { textAlign: 'center', marginTop: 4 }]}>
              Các đơn hàng sau khi giao hoặc báo thất bại sẽ hiển thị tại đây.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSuccess = item.status === 'COMPLETED';
          const codAmount = item.order.cod_amount || 0;

          return (
            <View style={[COMMON_STYLES.card, styles.stopCard]}>
              <View style={styles.itemHeader}>
                <View style={styles.orderCodeBadge}>
                  <Text style={styles.seqText}>#{item.sequence_no}</Text>
                  <Text style={styles.orderCode}>{item.order.code}</Text>
                </View>

                {isSuccess ? (
                  <View style={styles.statusBadgeSuccess}>
                    <CheckCircle2 color={COLORS.success} size={14} style={{ marginRight: 4 }} />
                    <Text style={styles.statusTextSuccess}>ĐÃ GIAO</Text>
                  </View>
                ) : (
                  <View style={styles.statusBadgeFailed}>
                    <XCircle color={COLORS.danger} size={14} style={{ marginRight: 4 }} />
                    <Text style={styles.statusTextFailed}>THẤT BẠI</Text>
                  </View>
                )}
              </View>

              {/* Customer info */}
              {item.order.receiver_name ? (
                <Text style={[TYPOGRAPHY.body, { fontWeight: '600', marginTop: 8 }]}>
                  {item.order.receiver_name} {item.order.receiver_phone ? `• ${item.order.receiver_phone}` : ''}
                </Text>
              ) : null}

              {/* Address */}
              <View style={styles.addressRow}>
                <MapPin color={COLORS.textSecondary} size={15} style={{ marginRight: 6, marginTop: 2 }} />
                <Text style={[TYPOGRAPHY.bodySecondary, { flex: 1 }]}>
                  {item.order.delivery_address}
                </Text>
              </View>

              {/* COD & Arrived info footer */}
              <View style={styles.itemFooter}>
                <View style={styles.codBadge}>
                  <DollarSign color={isSuccess && codAmount > 0 ? '#047857' : COLORS.textSecondary} size={14} />
                  <Text
                    style={[
                      styles.codAmountText,
                      { color: isSuccess && codAmount > 0 ? '#047857' : COLORS.textSecondary },
                    ]}
                  >
                    COD: {codAmount.toLocaleString('vi-VN')} VND
                  </Text>
                </View>

                {item.arrived_at && (
                  <View style={styles.timeBadge}>
                    <Clock color={COLORS.textSecondary} size={13} style={{ marginRight: 4 }} />
                    <Text style={styles.timeText}>
                      {new Date(item.arrived_at).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.padding_md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: 16,
  },
  syncBanner: {
    backgroundColor: '#FEF3C7',
    padding: SIZES.padding_md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  syncText: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 13,
  },
  syncSubText: {
    color: '#B45309',
    fontSize: 11,
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SIZES.radius_sm,
    marginLeft: 8,
  },
  syncButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  syncedBanner: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: SIZES.padding_md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  syncedText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '500',
  },
  stopCard: {
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seqText: {
    fontWeight: 'bold',
    color: COLORS.primary,
    marginRight: 6,
    fontSize: 14,
  },
  orderCode: {
    fontWeight: '700',
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  statusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextSuccess: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusBadgeFailed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextFailed: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: 'bold',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  codBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codAmountText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginTop: 40,
  },
});
