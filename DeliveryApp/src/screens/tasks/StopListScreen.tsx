/**
 * StopListScreen — Frame 17: Stop List Screen (KLTN-78, KLTN-79)
 *
 * Features:
 * - Danh sách card đơn hàng xếp theo thứ tự sequenceNo 1 -> N (sort bản sao, không mutate)
 * - Trạng thái trực quan: Icon + Text + Màu sắc (🟢 Đã giao, 🟠 Chờ giao, 🔵 Đã đến nơi, 🔴 Giao thất bại, ⚪ Bỏ qua)
 * - Tích hợp nút Gọi điện nhanh cho khách (Linking tel:) với validate số & fallback
 * - Tích hợp nút Chỉ đường mở Google Maps ngoài (URL encoded an toàn, native intent + browser fallback)
 * - Thẻ tóm tắt tiến độ giao (Tổng, Chờ giao, Đã xong)
 * - Kéo xuống để làm mới (Pull-to-refresh) & Trạng thái trống (Empty State)
 * - Chuyển sang StopDetail (Task 7.4) khi chạm vào card
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Phone,
  Navigation,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Banknote,
  Package,
  RotateCcw,
  RefreshCw,
} from 'lucide-react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { Stop } from '../../types/mobile';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';
import { MainTabParamList } from '../../navigation/MainTabNavigator';

type StopListNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<TaskStackParamList, 'StopList'>,
  BottomTabNavigationProp<MainTabParamList>
>;

export const StopListScreen = () => {
  const { stops, route, isLoadingRoute, refreshRoute } = useAppContext();
  const navigation = useNavigation<StopListNavProp>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── 1. Sắp xếp bản sao dữ liệu theo sequence_no tăng dần (1 -> N) ───────────
  const sortedStops = useMemo(() => {
    return [...stops].sort((a, b) => a.sequence_no - b.sequence_no);
  }, [stops]);

  // Thống kê nhanh tiến độ
  const stats = useMemo(() => {
    const total = sortedStops.length;
    const completed = sortedStops.filter((s) => s.status === 'COMPLETED').length;
    const failed = sortedStops.filter((s) => s.status === 'FAILED').length;
    const pending = total - completed - failed;
    return { total, completed, failed, pending };
  }, [sortedStops]);

  // ─── 2. Kéo để làm mới dữ liệu ──────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshRoute();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshRoute]);

  // ─── 3. Gọi điện nhanh cho khách hàng (KLTN-79) ─────────────────────────────
  const handleCallCustomer = async (phone?: string | null, receiverName?: string) => {
    if (!phone || !phone.trim()) {
      Alert.alert(
        'Không có số điện thoại',
        `Đơn hàng của khách "${receiverName || 'này'}" không có số điện thoại liên lạc.`,
        [{ text: 'Đã hiểu' }]
      );
      return;
    }

    // Làm sạch số điện thoại (chỉ giữ số và dấu +)
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone) {
      Alert.alert(
        'Số điện thoại không hợp lệ',
        `Số điện thoại "${phone}" không thể thực hiện cuộc gọi.`,
        [{ text: 'Đóng' }]
      );
      return;
    }

    const telUrl = `tel:${cleanPhone}`;

    try {
      const canOpen = await Linking.canOpenURL(telUrl);
      if (canOpen) {
        await Linking.openURL(telUrl);
      } else {
        Alert.alert(
          'Không thể gọi điện',
          `Thiết bị này không hỗ trợ gọi trực tiếp đến số ${cleanPhone}. Bạn có thể gọi thủ công.`,
          [{ text: 'Đóng' }]
        );
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi chạy ứng dụng gọi điện trên thiết bị.');
    }
  };

  // ─── 4. Mở Google Maps ngoài chỉ đường từ vị trí hiện tại (KLTN-79) ─────────
  const handleOpenGoogleMaps = async (
    lat?: number | null,
    lng?: number | null,
    address?: string
  ) => {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      Alert.alert(
        'Không có tọa độ GPS',
        `Địa chỉ "${address || 'này'}" chưa có tọa độ định vị chính xác để chỉ đường.`,
        [{ text: 'Đã hiểu' }]
      );
      return;
    }

    const destination = encodeURIComponent(`${lat},${lng}`);
    // Native intent cho Android app
    const nativeGoogleMapsUrl = `google.navigation:q=${destination}`;
    // Universal URL chuẩn Google Maps (hoạt động cả iOS, Android, Web browser)
    const webGoogleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    try {
      const canOpenNative = await Linking.canOpenURL(nativeGoogleMapsUrl);
      if (canOpenNative) {
        await Linking.openURL(nativeGoogleMapsUrl);
        return;
      }
    } catch {
      // Bỏ qua lỗi check native để chạy tiếp fallback
    }

    try {
      const canOpenWeb = await Linking.canOpenURL(webGoogleMapsUrl);
      if (canOpenWeb) {
        await Linking.openURL(webGoogleMapsUrl);
      } else {
        Alert.alert('Lỗi', 'Không thể tìm thấy ứng dụng Bản đồ hoặc trình duyệt phù hợp.');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở liên kết chỉ đường Google Maps.');
    }
  };

  // ─── 5. Cấu hình hiển thị trạng thái (Màu sắc + Icon + Nhãn rõ ràng) ───────
  const getStatusBadge = (status: Stop['status']) => {
    switch (status) {
      case 'COMPLETED':
        return {
          label: 'Đã giao',
          color: '#15803D',
          bgColor: '#DCFCE7',
          borderColor: '#86EFAC',
          icon: <CheckCircle2 color="#15803D" size={13} />,
        };
      case 'ARRIVED':
        return {
          label: 'Đã đến nơi',
          color: '#1D4ED8',
          bgColor: '#DBEAFE',
          borderColor: '#93C5FD',
          icon: <MapPin color="#1D4ED8" size={13} />,
        };
      case 'PENDING':
        return {
          label: 'Chờ giao',
          color: '#B45309',
          bgColor: '#FEF3C7',
          borderColor: '#FDE68A',
          icon: <Clock color="#B45309" size={13} />,
        };
      case 'FAILED':
        return {
          label: 'Giao thất bại',
          color: '#B91C1C',
          bgColor: '#FEE2E2',
          borderColor: '#FCA5A5',
          icon: <AlertCircle color="#B91C1C" size={13} />,
        };
      case 'SKIPPED':
        return {
          label: 'Đã bỏ qua',
          color: '#4B5563',
          bgColor: '#F3F4F6',
          borderColor: '#E5E7EB',
          icon: <RotateCcw color="#4B5563" size={13} />,
        };
      default:
        return {
          label: 'Chờ giao',
          color: '#B45309',
          bgColor: '#FEF3C7',
          borderColor: '#FDE68A',
          icon: <Clock color="#B45309" size={13} />,
        };
    }
  };

  // ─── 6. Định dạng tiền tệ VNĐ ──────────────────────────────────────────────
  const formatCod = (amount?: number) => {
    if (!amount || amount <= 0) return '0 ₫';
    return `${amount.toLocaleString('vi-VN')} ₫`;
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={TYPOGRAPHY.header}>Danh sách điểm dừng</Text>
            <Text style={styles.headerSubtitle}>
              {route?.route_date ? `Tuyến ngày: ${route.route_date}` : 'Lộ trình giao hàng hôm nay'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={handleRefresh}
            disabled={isRefreshing || isLoadingRoute}
            activeOpacity={0.7}
          >
            <RefreshCw
              color={COLORS.primary}
              size={20}
              style={isRefreshing ? { transform: [{ rotate: '45deg' }] } : undefined}
            />
          </TouchableOpacity>
        </View>

        {/* ─── Stats Overview Bar ─────────────────────────────────────────── */}
        <View style={styles.statsBar}>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Tổng điểm:</Text>
            <Text style={styles.statPillValue}>{stats.total}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statPillLabel, { color: '#B45309' }]}>Chờ giao:</Text>
            <Text style={[styles.statPillValue, { color: '#B45309' }]}>{stats.pending}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.statPillLabel, { color: '#15803D' }]}>Đã xong:</Text>
            <Text style={[styles.statPillValue, { color: '#15803D' }]}>{stats.completed}</Text>
          </View>
        </View>
      </View>

      {/* ─── Stop List Content ─────────────────────────────────────────────── */}
      {isLoadingRoute && sortedStops.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[TYPOGRAPHY.bodySecondary, { marginTop: 12 }]}>
            Đang tải danh sách điểm dừng...
          </Text>
        </View>
      ) : sortedStops.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Package color={COLORS.inactive} size={40} />
          </View>
          <Text style={[TYPOGRAPHY.title, { marginTop: 16 }]}>Chưa có điểm dừng nào</Text>
          <Text style={[TYPOGRAPHY.bodySecondary, styles.emptyText]}>
            Hiện tại bạn chưa được phân công chuyến hàng nào hôm nay hoặc tuyến chưa bắt đầu.
          </Text>
          <TouchableOpacity style={styles.reloadButton} onPress={handleRefresh}>
            <RefreshCw color="#FFF" size={16} />
            <Text style={styles.reloadButtonText}>Làm mới tuyến</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedStops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => {
            const isCompleted = item.status === 'COMPLETED';
            const isFailed = item.status === 'FAILED';
            const isDone = isCompleted || isFailed;
            const badge = getStatusBadge(item.status);
            const hasCod = item.order.cod_amount > 0;

            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  isDone && styles.cardCompleted,
                ]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('StopDetail', { stopId: item.id })}
              >
                {/* ── Card Top: Sequence + Code + Status Badge ── */}
                <View style={styles.cardHeaderRow}>
                  {/* Sequence Badge (1 -> N) */}
                  <View
                    style={[
                      styles.sequenceBadge,
                      isCompleted && styles.sequenceBadgeSuccess,
                      isFailed && styles.sequenceBadgeFailed,
                    ]}
                  >
                    <Text style={styles.sequenceText}>#{item.sequence_no}</Text>
                  </View>

                  {/* Order Code */}
                  <View style={styles.orderCodeWrapper}>
                    <Text style={styles.orderCodeText} numberOfLines={1}>
                      {item.order.code || `Đơn hàng #${item.sequence_no}`}
                    </Text>
                  </View>

                  {/* Status Badge (Icon + Text) */}
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: badge.bgColor,
                        borderColor: badge.borderColor,
                      },
                    ]}
                  >
                    {badge.icon}
                    <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* ── Customer Info ── */}
                <View style={styles.cardBody}>
                  <View style={styles.customerRow}>
                    <Text style={styles.receiverName} numberOfLines={1}>
                      {item.order.receiver_name || 'Khách hàng'}
                    </Text>
                    {item.order.receiver_phone ? (
                      <Text style={styles.receiverPhone}>{item.order.receiver_phone}</Text>
                    ) : null}
                  </View>

                  {/* Address */}
                  <View style={styles.addressRow}>
                    <MapPin color={COLORS.textSecondary} size={15} style={styles.addressIcon} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {item.order.delivery_address || 'Địa chỉ chưa cập nhật'}
                    </Text>
                  </View>

                  {/* COD Tag */}
                  <View style={styles.metaRow}>
                    {hasCod ? (
                      <View style={styles.codBadge}>
                        <Banknote color="#E11D48" size={14} />
                        <Text style={styles.codBadgeText}>
                          Thu COD: {formatCod(item.order.cod_amount)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.noCodBadge}>
                        <Text style={styles.noCodBadgeText}>Không thu tiền (0 ₫)</Text>
                      </View>
                    )}

                    <View style={styles.viewDetailIndicator}>
                      <Text style={styles.viewDetailText}>Chi tiết</Text>
                      <ChevronRight color={COLORS.inactive} size={16} />
                    </View>
                  </View>
                </View>

                {/* ── Quick Actions Footer (KLTN-79) ── */}
                <View style={styles.actionFooter}>
                  {/* Nút Gọi điện nhanh */}
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      handleCallCustomer(item.order.receiver_phone, item.order.receiver_name)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: '#EEF2FF' }]}>
                      <Phone color="#4F46E5" size={16} />
                    </View>
                    <Text style={[styles.actionBtnText, { color: '#4F46E5' }]}>Gọi khách</Text>
                  </TouchableOpacity>

                  <View style={styles.actionDivider} />

                  {/* Nút Chỉ đường Google Maps */}
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() =>
                      handleOpenGoogleMaps(
                        item.order.lat,
                        item.order.lng,
                        item.order.delivery_address
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: '#ECFDF5' }]}>
                      <Navigation color="#059669" size={16} />
                    </View>
                    <Text style={[styles.actionBtnText, { color: '#059669' }]}>Chỉ đường</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.padding_md,
    paddingTop: SIZES.padding_md,
    paddingBottom: SIZES.padding_sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: SIZES.radius_sm,
  },
  statPillLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  statPillValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  listContent: {
    padding: SIZES.padding_md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius_lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.padding_md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompleted: {
    opacity: 0.85,
    backgroundColor: '#FDFDFD',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding_md,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sequenceBadge: {
    backgroundColor: COLORS.primary,
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sequenceBadgeSuccess: {
    backgroundColor: '#10B981',
  },
  sequenceBadgeFailed: {
    backgroundColor: '#EF4444',
  },
  sequenceText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  orderCodeWrapper: {
    flex: 1,
  },
  orderCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    padding: SIZES.padding_md,
    paddingTop: 10,
    paddingBottom: 10,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  receiverName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  receiverPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addressIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  codBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  codBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E11D48',
  },
  noCodBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  noCodBadgeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  viewDetailIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailText: {
    fontSize: 12,
    color: COLORS.inactive,
  },
  actionFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#FAFAFA',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  actionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: SIZES.radius_md,
    marginTop: 20,
  },
  reloadButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
