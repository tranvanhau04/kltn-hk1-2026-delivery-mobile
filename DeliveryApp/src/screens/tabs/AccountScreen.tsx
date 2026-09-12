import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Star,
  Phone,
  Mail,
  ChevronRight,
  History,
  Map,
  Bell,
  HelpCircle,
  LogOut,
  Camera,
  TrendingUp,
  Wallet,
  CheckCircle2,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';

// ─── Driver constants (extends mock data) ────────────────────────────────────
const DRIVER_EXTENDED = {
  employee_id: 'DRV-2026-088',
  email: 'tai.ngo@iuhlogistics.vn',
  rating: 4.95,
  review_count: 342,
  total_trips_month: 128,
  on_time_rate: 98.2,
  zones: ['Go Vap', 'Binh Thanh'],
  dispatcher_hotline: '19006868',
};

// ─── Shift Status Badge ───────────────────────────────────────────────────────
type ShiftStatus = 'OPEN' | 'PENDING_SETTLEMENT' | 'CLOSED';
const shiftColors: Record<ShiftStatus, { bg: string; text: string; label: string }> = {
  OPEN: { bg: '#D1FAE5', text: COLORS.success, label: 'OPEN' },
  PENDING_SETTLEMENT: { bg: '#FEF3C7', text: '#D97706', label: 'PENDING SETTLEMENT' },
  CLOSED: { bg: '#F3F4F6', text: COLORS.textSecondary, label: 'CLOSED' },
};

const ShiftBadge = ({ status }: { status: ShiftStatus }) => {
  const cfg = shiftColors[status] ?? shiftColors.CLOSED;
  return (
    <View style={[styles.shiftBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.shiftBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── Action Row ───────────────────────────────────────────────────────────────
type ActionRowProps = {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onPress: () => void;
  isLast?: boolean;
};

const ActionRow = ({ icon, label, subtitle, onPress, isLast = false }: ActionRowProps) => (
  <>
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.actionIconWrap}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight color={COLORS.inactive} size={18} />
    </TouchableOpacity>
    {!isLast && <View style={styles.rowDivider} />}
  </>
);

// ─── Metric Card ─────────────────────────────────────────────────────────────
type MetricCardProps = { icon: React.ReactNode; value: string; label: string; accent?: string };
const MetricCard = ({ icon, value, label, accent }: MetricCardProps) => (
  <View style={styles.metricCard}>
    {icon}
    <Text style={[styles.metricValue, accent ? { color: accent } : {}]}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const AccountScreen = () => {
  const { driver, shift } = useAppContext();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of IUH Logistics Mobile?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: () => Alert.alert('Đã đăng xuất') },
      ]
    );
  };

  const handleCallDispatcher = () => {
    Linking.openURL(`tel:${DRIVER_EXTENDED.dispatcher_hotline}`).catch(() =>
      Alert.alert('Lỗi', 'Không thể mở trình gọi điện.')
    );
  };

  const shiftStatus: ShiftStatus = (shift?.status as ShiftStatus) ?? 'CLOSED';
  const codFormatted = `₫${(shift?.cod_collected ?? 0).toLocaleString('vi-VN')}`;

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SIZES.padding_md }}>

        {/* ── Header ── */}
        <Text style={[TYPOGRAPHY.header, { marginBottom: 4 }]}>Tài khoản của tôi</Text>
        <Text style={[TYPOGRAPHY.bodySecondary, { marginBottom: SIZES.padding_md }]}>Hồ sơ tài xế & nhật ký ca làm việc</Text>

        {/* ── Driver Profile Card ── */}
        <View style={[COMMON_STYLES.card, styles.profileCard]}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              <User color={COLORS.surface} size={42} />
              <View style={styles.cameraBadge}>
                <Camera color={COLORS.surface} size={10} />
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.employeeId}>{DRIVER_EXTENDED.employee_id}</Text>

              {/* Rating */}
              <View style={styles.ratingRow}>
                <Star color="#F59E0B" size={14} fill="#F59E0B" />
                <Text style={styles.ratingText}>
                  {DRIVER_EXTENDED.rating.toFixed(2)} / 5.0
                </Text>
                <Text style={styles.ratingReviews}>
                  ({DRIVER_EXTENDED.review_count} đánh giá)
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Contact info */}
          <View style={styles.contactRow}>
            <Phone color={COLORS.textSecondary} size={14} style={{ marginRight: 8 }} />
            <Text style={styles.contactText}>
              {/* Phone not in mock but displayed from context */}
              +84 90 123 4567
            </Text>
          </View>
          <View style={[styles.contactRow, { marginTop: 6 }]}>
            <Mail color={COLORS.textSecondary} size={14} style={{ marginRight: 8 }} />
            <Text style={styles.contactText}>{DRIVER_EXTENDED.email}</Text>
          </View>
        </View>

        {/* ── Shift & Financial Snapshot ── */}
        <View style={COMMON_STYLES.card}>
          <View style={styles.snapshotHeader}>
            <Text style={TYPOGRAPHY.title}>Tóm tắt ca làm việc hôm nay</Text>
            <ShiftBadge status={shiftStatus} />
          </View>

          {/* COD highlight */}
          <View style={styles.codHighlight}>
            <View>
              <Text style={styles.codLabel}>Tiền COD đang giữ</Text>
              <Text style={styles.codValue}>{codFormatted}</Text>
            </View>
            <Wallet color={COLORS.primary} size={28} />
          </View>

          {/* Metric grid */}
          <View style={styles.metricsGrid}>
            <MetricCard
              icon={<TrendingUp color={COLORS.success} size={20} />}
              value={`${DRIVER_EXTENDED.total_trips_month}`}
              label="Chuyến đi tháng này"
              accent={COLORS.textPrimary}
            />
            <View style={styles.metricDivider} />
            <MetricCard
              icon={<CheckCircle2 color={COLORS.primary} size={20} />}
              value={`${DRIVER_EXTENDED.on_time_rate}%`}
              label="Tỷ lệ đúng giờ"
              accent={COLORS.success}
            />
          </View>
        </View>

        {/* ── Action List ── */}
        <View style={COMMON_STYLES.card}>
          <Text style={[TYPOGRAPHY.title, { marginBottom: 12 }]}>Cài đặt & Khác</Text>

          <ActionRow
            icon={<History color={COLORS.primary} size={20} />}
            label="Lịch sử ca & Lịch sử COD"
            subtitle="Xem chi tiết đối soát"
            onPress={() => Alert.alert('Lịch sử', 'Chuyển đến màn hình chi tiết ca')}
          />
          <ActionRow
            icon={<Map color={COLORS.success} size={20} />}
            label="Khu vực làm việc ưu tiên"
            subtitle={`Khu vực: ${DRIVER_EXTENDED.zones.join(', ')}`}
            onPress={() => Alert.alert('Khu vực', DRIVER_EXTENDED.zones.join(', '))}
          />
          <ActionRow
            icon={<Bell color="#F59E0B" size={20} />}
            label="Thông báo & Âm thanh"
            subtitle="Bật/tắt thông báo dẫn đường"
            onPress={() => Alert.alert('Thông báo', 'Cài đặt thông báo')}
          />
          <ActionRow
            icon={<HelpCircle color={COLORS.textSecondary} size={20} />}
            label="Trung tâm hỗ trợ & Tổng đài"
            subtitle={`Hotline: ${DRIVER_EXTENDED.dispatcher_hotline}`}
            onPress={handleCallDispatcher}
            isLast
          />
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.appVersion}>IUH Logistics Mobile v1.0.0 (Build 2026)</Text>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <LogOut color={COLORS.danger} size={18} style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  profileCard: {
    paddingBottom: 14,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1D1F',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  employeeId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
  },
  ratingReviews: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  snapshotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  shiftBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  shiftBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 14,
    borderRadius: SIZES.radius_md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  codLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  codValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1D1F',
    letterSpacing: -0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 1,
  },
  actionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SIZES.padding_md,
    gap: 12,
  },
  appVersion: {
    fontSize: 12,
    color: COLORS.inactive,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: SIZES.radius_md,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.danger,
  },
});
