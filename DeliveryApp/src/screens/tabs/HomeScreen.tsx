/**
 * HomeScreen — Frame 16: Home / Shift Status Screen
 *
 * Features:
 * - Driver greeting + vehicle info (from AuthContext driverProfile)
 * - Big toggle switch: ONLINE_READY ↔ OFFLINE (synced with backend)
 * - 3 summary cards: Đơn gán, Đã giao, COD đang giữ
 * - Route summary: total distance & estimated time
 *
 * Shift toggle uses optimistic update with rollback on API failure.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Package,
  CheckCircle2,
  Banknote,
  Route,
  Clock,
  Truck,
  Power,
  ChevronRight,
  LogOut,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';

// ─── Summary Card Component ────────────────────────────────────────────────────
type SummaryCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bgColor: string;
};

const SummaryCard = ({ icon, label, value, color, bgColor }: SummaryCardProps) => (
  <View style={[styles.summaryCard, { borderLeftColor: color }]}>
    <View style={[styles.summaryIcon, { backgroundColor: bgColor }]}>{icon}</View>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
  </View>
);

// ─── Main HomeScreen ───────────────────────────────────────────────────────────
export const HomeScreen = () => {
  const { user, driverProfile, isLoadingDriver, toggleShiftStatus, logout } = useAuth();
  const { route, stops, isLoadingRoute } = useAppContext();

  const isOnline = driverProfile?.currentShiftStatus === 'ONLINE_READY';
  const isBusy = driverProfile?.currentShiftStatus === 'BUSY' || driverProfile?.currentShiftStatus === 'ON_DUTY';

  // ─── Compute summary stats from real stops data ───────────────────────────
  const stats = useMemo(() => {
    const assigned = stops.filter(s => s.status === 'PENDING' || s.status === 'ARRIVED').length;
    const delivered = stops.filter(s => s.status === 'COMPLETED').length;
    const codHeld = stops
      .filter(s => s.status === 'COMPLETED')
      .reduce((sum, s) => sum + (s.order?.cod_amount ?? 0), 0);
    return { assigned, delivered, codHeld };
  }, [stops]);

  // ─── Handle shift toggle ─────────────────────────────────────────────────
  const handleToggleShift = async () => {
    if (isBusy) {
      Alert.alert('Không thể tắt ca', 'Bạn đang có đơn hàng đang xử lý. Hoàn thành trước khi tắt ca.');
      return;
    }

    try {
      await toggleShiftStatus();
    } catch (err: any) {
      Alert.alert(
        'Lỗi',
        `Không thể thay đổi trạng thái ca.\n${err?.message || 'Vui lòng thử lại.'}`,
      );
    }
  };

  // ─── Handle logout ────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất tài khoản',
      'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch {
              Alert.alert('Lỗi', 'Không thể đăng xuất, vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  // ─── Format COD amount ────────────────────────────────────────────────────
  const formatCod = (amount: number) => {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
    return amount.toLocaleString('vi-VN');
  };

  // ─── Format time ──────────────────────────────────────────────────────────
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}p` : `${m} phút`;
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header: Greeting ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.greeting}>Xin chào 👋</Text>
            <Text style={styles.driverName}>{user?.fullName ?? 'Tài xế'}</Text>
            {driverProfile && (
              <View style={styles.vehicleInfo}>
                <Truck color={COLORS.textSecondary} size={14} />
                <Text style={styles.vehicleText}>
                  {driverProfile.licensePlate} • {driverProfile.vehicleType}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusBadge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
              <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
              <Text style={[styles.statusText, isOnline ? styles.textOnline : styles.textOffline]}>
                {isOnline ? 'Trực tuyến' : isBusy ? 'Đang bận' : 'Ngoại tuyến'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.headerLogoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut color={COLORS.danger} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Shift Toggle Card ──────────────────────────────────────────── */}
        <View style={[styles.shiftCard, isOnline ? styles.shiftCardOnline : styles.shiftCardOffline]}>
          <View style={styles.shiftCardContent}>
            <View style={styles.shiftInfo}>
              <Power
                color={isOnline ? '#10B981' : COLORS.textSecondary}
                size={28}
              />
              <View style={styles.shiftTextContainer}>
                <Text style={[styles.shiftTitle, isOnline && styles.shiftTitleOnline]}>
                  {isOnline ? 'CA ĐANG MỞ' : 'CA ĐANG TẮT'}
                </Text>
                <Text style={styles.shiftSubtitle}>
                  {isOnline ? 'Sẵn sàng nhận đơn hàng' : 'Gạt để bắt đầu ca làm việc'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.toggleButton, isOnline ? styles.toggleOn : styles.toggleOff]}
              onPress={handleToggleShift}
              activeOpacity={0.8}
              disabled={isLoadingDriver}
            >
              {isLoadingDriver ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <View style={[styles.toggleKnob, isOnline ? styles.knobOn : styles.knobOff]} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Summary Cards ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Tổng quan hôm nay</Text>
        <View style={styles.summaryRow}>
          <SummaryCard
            icon={<Package color="#F59E0B" size={20} />}
            label="Đơn gán"
            value={`${stats.assigned}`}
            color="#F59E0B"
            bgColor="#FFFBEB"
          />
          <SummaryCard
            icon={<CheckCircle2 color="#10B981" size={20} />}
            label="Đã giao"
            value={`${stats.delivered}`}
            color="#10B981"
            bgColor="#D1FAE5"
          />
          <SummaryCard
            icon={<Banknote color="#6366F1" size={20} />}
            label="COD giữ"
            value={formatCod(stats.codHeld)}
            color="#6366F1"
            bgColor="#EEF2FF"
          />
        </View>

        {/* ── Route Summary ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Tuyến đường hôm nay</Text>
        {isLoadingRoute ? (
          <View style={[COMMON_STYLES.card, styles.routeCard]}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={[TYPOGRAPHY.bodySecondary, { marginTop: 8 }]}>Đang tải tuyến...</Text>
          </View>
        ) : route ? (
          <View style={[COMMON_STYLES.card, styles.routeCard]}>
            <View style={styles.routeRow}>
              <View style={styles.routeStat}>
                <Route color={COLORS.primary} size={20} />
                <Text style={styles.routeValue}>
                  {Number(route.total_distance_km).toFixed(1)} km
                </Text>
                <Text style={styles.routeLabel}>Tổng cự ly</Text>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.routeStat}>
                <Clock color={COLORS.primary} size={20} />
                <Text style={styles.routeValue}>
                  {formatTime(Number(route.total_estimated_time_min))}
                </Text>
                <Text style={styles.routeLabel}>Thời gian ước tính</Text>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.routeStat}>
                <Package color={COLORS.primary} size={20} />
                <Text style={styles.routeValue}>{stops.length}</Text>
                <Text style={styles.routeLabel}>Điểm giao</Text>
              </View>
            </View>

            <View style={styles.routeStatus}>
              <View
                style={[
                  styles.routeStatusBadge,
                  route.status === 'IN_PROGRESS' ? styles.badgeInProgress :
                  route.status === 'COMPLETED' ? styles.badgeCompleted :
                  styles.badgeAssigned,
                ]}
              >
                <Text style={styles.routeStatusText}>
                  {route.status === 'IN_PROGRESS' ? '🚚 Đang giao' :
                   route.status === 'COMPLETED' ? '✅ Hoàn thành' :
                   '📋 Đã phân công'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[COMMON_STYLES.card, styles.emptyRoute]}>
            <Route color={COLORS.inactive} size={32} />
            <Text style={[TYPOGRAPHY.title, { marginTop: 12 }]}>Chưa có tuyến</Text>
            <Text style={[TYPOGRAPHY.bodySecondary, { textAlign: 'center', marginTop: 4 }]}>
              Bật ca và chờ bộ phận điều phối gán tuyến cho bạn
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SIZES.padding_md,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  driverName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  vehicleText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  headerLogoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeOnline: {
    backgroundColor: '#D1FAE5',
  },
  badgeOffline: {
    backgroundColor: '#F3F4F6',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10B981',
  },
  dotOffline: {
    backgroundColor: '#9CA3AF',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textOnline: {
    color: '#065F46',
  },
  textOffline: {
    color: '#6B7280',
  },

  // Shift Card
  shiftCard: {
    borderRadius: SIZES.radius_lg,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
  },
  shiftCardOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  shiftCardOffline: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  shiftCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shiftTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  shiftTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  shiftTitleOnline: {
    color: '#065F46',
  },
  shiftSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Custom Toggle Button
  toggleButton: {
    width: 60,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: '#10B981',
  },
  toggleOff: {
    backgroundColor: '#D1D5DB',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
  knobOff: {
    alignSelf: 'flex-start',
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },

  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius_md,
    padding: 14,
    alignItems: 'center',
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Route Card
  routeCard: {
    alignItems: 'center',
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 8,
  },
  routeStat: {
    alignItems: 'center',
    flex: 1,
  },
  routeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  routeLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  routeDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  routeStatus: {
    marginTop: 12,
    alignItems: 'center',
  },
  routeStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeInProgress: {
    backgroundColor: '#FEF3C7',
  },
  badgeCompleted: {
    backgroundColor: '#D1FAE5',
  },
  badgeAssigned: {
    backgroundColor: '#DBEAFE',
  },
  routeStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Empty Route
  emptyRoute: {
    alignItems: 'center',
    paddingVertical: 32,
  },
});
