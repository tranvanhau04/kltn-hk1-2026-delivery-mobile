import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  FlatList,
  Platform,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  User,
  Phone,
  Mail,
  ChevronRight,
  History,
  MapPin,
  Bell,
  LogOut,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Lock,
  Building2,
  X,
  ShieldCheck,
  RotateCw,
  Navigation,
  Eye,
  EyeOff,
  Headphones,
  PhoneCall,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Activity,
  Sparkles,
  Package,
  Clock,
  Banknote,
} from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAccountSummaryApi,
  fetchShiftHistoryApi,
  changePasswordApi,
  fetchDriverEarningsApi,
  ApiAccountSummaryResponse,
  ApiShiftHistoryItem,
  ApiDriverEarningsResponse,
  ApiEarningsPeriod,
  ApiEarningsOrderBreakdown,
} from '../../lib/api';
import { disconnectSocket } from '../../lib/socketClient';
import { stopTracking } from '../../services/LocationService';

// ─── Storage Keys & Defaults ──────────────────────────────────────────────────
const NOTIFICATION_SETTINGS_KEY = '@driver_notification_settings';

interface NotificationSettings {
  newOrderSound: boolean;
  vibrateOnStop: boolean;
  autoNavOnMove: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  newOrderSound: true,
  vibrateOnStop: true,
  autoNavOnMove: true,
};

// ─── Helper: Format Clean Zones (Strips redundant "Khu vực" prefix) ───────────
const formatCleanZones = (zones: string[]): string => {
  if (!zones || zones.length === 0) return 'Xem bưu cục & tuyến giao';
  const joined = zones.join(' / ');
  const cleaned = joined.replace(/^khu\s*vực\s*[:\s-]*/i, '').trim();
  return cleaned || joined;
};

// ─── Helper: Round Amount to Nearest Thousand VND ────────────────────────────
const roundToThousand = (amount?: number | null): number => {
  if (!amount || isNaN(amount)) return 0;
  return Math.round(amount / 1000) * 1000;
};

// ─── Helper: Dynamic Notification Subtitle ───────────────────────────────────
const getNotificationSubtitle = (s: NotificationSettings): string => {
  if (s.newOrderSound && s.vibrateOnStop) return 'Đang bật âm thanh & rung';
  if (s.newOrderSound && !s.vibrateOnStop) return 'Đang bật âm thanh (tắt rung)';
  if (!s.newOrderSound && s.vibrateOnStop) return 'Chế độ rung (tắt âm thanh)';
  return 'Đã tắt âm thanh & rung';
};

// ─── Helper: Date & Time Formatter ───────────────────────────────────────────
function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

// ─── Shift Status Badge ───────────────────────────────────────────────────────
const ShiftBadge = ({ status, label }: { status?: string; label?: string }) => {
  let bg = '#F1F5F9';
  let text = '#64748B';
  let textLabel = label || 'Chưa mở ca';

  if (status === 'OPEN') {
    bg = '#D1FAE5';
    text = '#059669';
    textLabel = label || 'Đang mở ca';
  } else if (status === 'PENDING_SETTLEMENT') {
    bg = '#FEF3C7';
    text = '#D97706';
    textLabel = label || 'Chờ đối soát';
  } else if (status === 'CLOSED' || status === 'RECONCILED') {
    bg = '#ECFDF5';
    text = '#047857';
    textLabel = label || 'Đã chốt đối soát';
  }

  return (
    <View style={[styles.shiftBadge, { backgroundColor: bg }]}>
      <Text style={[styles.shiftBadgeText, { color: text }]}>{textLabel}</Text>
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
        {subtitle ? (
          <Text style={styles.actionSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
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

// ─── Toast Type ───────────────────────────────────────────────────────────────
interface InAppToast {
  visible: boolean;
  type: 'SUCCESS' | 'ERROR' | 'WARNING';
  title: string;
  message?: string;
}

// ─── Main Screen Component ───────────────────────────────────────────────────
export const AccountScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, driverProfile, refreshDriverProfile, token, logout } = useAuth();
  const { driver, shift, refreshShift } = useAppContext();

  // Summary state
  const [accountData, setAccountData] = useState<ApiAccountSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Earnings state (Day / Week / Month with 15% platform commission)
  const [earningsModalVisible, setEarningsModalVisible] = useState(false);
  const [earningsData, setEarningsData] = useState<ApiDriverEarningsResponse['data'] | null>(null);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day');

  // Modal states
  const [shiftHistoryVisible, setShiftHistoryVisible] = useState(false);
  const [shiftHistory, setShiftHistory] = useState<ApiShiftHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [zonesModalVisible, setZonesModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [focusedField, setFocusedField] = useState<'current' | 'new' | 'confirm' | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // In-App Toast state
  const [toastState, setToastState] = useState<InAppToast>({
    visible: false,
    type: 'SUCCESS',
    title: '',
  });
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (type: 'SUCCESS' | 'ERROR' | 'WARNING', title: string, message?: string) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastState({ visible: true, type, title, message });
      toastTimerRef.current = setTimeout(() => {
        setToastState((prev) => ({ ...prev, visible: false }));
      }, 2800);
    },
    [],
  );

  // ─── Load Notification Settings from AsyncStorage ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
        if (stored) {
          setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) });
        }
      } catch (err) {
        console.warn('[AccountScreen] Error loading notification settings:', err);
      }
    })();
  }, []);

  const handleUpdateNotificationSetting = async (
    key: keyof NotificationSettings,
    val: boolean,
  ) => {
    const updated = { ...notificationSettings, [key]: val };
    setNotificationSettings(updated);

    // Haptic feedback when turning on vibration
    if (key === 'vibrateOnStop' && val) {
      Vibration.vibrate(200);
    }

    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
      showToast('SUCCESS', 'Đã lưu cài đặt', 'Cấu hình thông báo đã được cập nhật.');
    } catch (err) {
      console.warn('[AccountScreen] Error saving notification settings:', err);
      showToast('ERROR', 'Lỗi lưu cài đặt', 'Không thể lưu vào bộ nhớ thiết bị.');
    }
  };

  // ─── Fetch Account Summary ────────────────────────────────────────────────
  const loadAccountData = useCallback(
    async (showLoadingSpinner = true) => {
      if (!token) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      if (showLoadingSpinner) setIsLoading(true);
      try {
        const res = await fetchAccountSummaryApi(token);
        if (res && res.success) {
          setAccountData(res);
        }
      } catch (err) {
        console.warn('[AccountScreen] fetchAccountSummaryApi failed:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  // ─── Fetch Driver Earnings ────────────────────────────────────────────────
  const loadEarningsData = useCallback(
    async (showLoadingSpinner = true) => {
      if (!token) return;
      if (showLoadingSpinner) setIsLoadingEarnings(true);
      try {
        const res = await fetchDriverEarningsApi(token);
        if (res && res.success && res.data) {
          setEarningsData(res.data);
        }
      } catch (err) {
        console.warn('[AccountScreen] fetchDriverEarningsApi failed:', err);
      } finally {
        setIsLoadingEarnings(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadEarningsData(false);
  }, [loadEarningsData]);

  // Auto-open earnings modal when navigating from HomeScreen shortcut
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.openEarningsModal) {
        setEarningsModalVisible(true);
        loadEarningsData(false);
        navigation.setParams({ openEarningsModal: undefined });
      }
    }, [route?.params?.openEarningsModal, loadEarningsData, navigation]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([
      loadAccountData(false),
      loadEarningsData(false),
      refreshShift ? refreshShift() : Promise.resolve(),
      refreshDriverProfile ? refreshDriverProfile() : Promise.resolve(),
    ]).finally(() => {
      setIsRefreshing(false);
    });
  }, [loadAccountData, loadEarningsData, refreshShift, refreshDriverProfile]);

  // ─── Fetch Shift History ──────────────────────────────────────────────────
  const loadShiftHistory = useCallback(async () => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetchShiftHistoryApi(token);
      if (res && res.success) {
        setShiftHistory(res.data || []);
      }
    } catch (err) {
      console.warn('[AccountScreen] fetchShiftHistoryApi failed:', err);
      showToast('ERROR', 'Lỗi tải dữ liệu', 'Không thể tải lịch sử ca làm việc.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token, showToast]);

  const handleOpenShiftHistory = () => {
    setShiftHistoryVisible(true);
    loadShiftHistory();
  };

  // ─── Handle Change Password ───────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      showToast('WARNING', 'Chưa nhập mật khẩu', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6) {
      showToast('WARNING', 'Mật khẩu quá ngắn', 'Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('WARNING', 'Mật khẩu không khớp', 'Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }
    if (!token) return;

    setIsChangingPassword(true);
    try {
      const res = await changePasswordApi(currentPassword, newPassword, token);
      if (res && res.success) {
        showToast('SUCCESS', 'Đổi mật khẩu thành công!', 'Mật khẩu mới đã được cập nhật.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordModalVisible(false);
      } else {
        showToast('ERROR', 'Đổi mật khẩu thất bại', res?.message || 'Không thể đổi mật khẩu.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Mật khẩu hiện tại không chính xác.';
      showToast('ERROR', 'Đổi mật khẩu thất bại', msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ─── Depot Contact & Navigation ───────────────────────────────────────────
  const depotPhone = accountData?.depot?.contactPhone || '02838940338';
  const depotName = accountData?.depot?.name || 'Bưu cục IUH Trung tâm';
  const depotAddress = accountData?.depot?.address || '12 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP.HCM';

  const handleCallDepot = () => {
    Linking.openURL(`tel:${depotPhone}`).catch(() =>
      showToast('ERROR', 'Lỗi cuộc gọi', 'Không thể mở trình gọi điện trên máy.'),
    );
  };

  const handleOpenDepotMap = () => {
    const lat = accountData?.depot?.latitude ?? 10.822205;
    const lng = accountData?.depot?.longitude ?? 106.687498;
    const label = encodeURIComponent(depotName);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  // ─── Logout Flow ──────────────────────────────────────────────────────────
  const executeLogout = async () => {
    setLogoutModalVisible(false);
    try {
      disconnectSocket();
      await stopTracking();
      await logout();
    } catch {
      showToast('ERROR', 'Lỗi đăng xuất', 'Không thể đăng xuất, vui lòng thử lại.');
    }
  };

  // Compute profile values
  const driverName = accountData?.user.fullName || user?.fullName || driver?.name || 'Tài xế IUH';
  const licensePlate =
    accountData?.driver.licensePlate || driverProfile?.licensePlate || 'Chưa gán biển';
  const vehicleTypeFriendly =
    accountData?.driver.vehicleTypeFriendly ||
    driverProfile?.vehicleType ||
    'Xe máy - Giao hàng';
  const phoneText = accountData?.user.phone || user?.phone || 'Chưa cập nhật số ĐT';
  const emailText = accountData?.user.email || user?.email || 'Chưa cập nhật email';
  const zonesList = accountData?.zones || [];

  // Shift & COD summary values (100% unified with HomeScreen)
  const currentShiftStatus =
    accountData?.currentShift?.status || (shift?.status as string) || 'CLOSED';
  const currentShiftLabel = accountData?.currentShift?.statusLabel;
  const codHolding = accountData?.currentShift
    ? accountData.currentShift.codHolding
    : shift?.cod_collected ?? 0;
  const codFormatted = `₫${(codHolding || 0).toLocaleString('vi-VN')}`;
  const startingCashCod = accountData?.currentShift?.startingCashCod ?? 0;

  const monthlyOrders = accountData?.metrics.monthlyDeliveredOrders ?? 0;
  const monthlyRate = accountData?.metrics.monthlySuccessRate ?? 100;

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      {/* ─── Floating In-App Toast Banner ─── */}
      {toastState.visible && (
        <View
          style={[
            styles.floatingToast,
            toastState.type === 'SUCCESS'
              ? styles.toastSuccess
              : toastState.type === 'ERROR'
              ? styles.toastError
              : styles.toastWarning,
          ]}
        >
          <View style={styles.toastIconBox}>
            {toastState.type === 'SUCCESS' && <CheckCircle2 size={22} color="#10B981" />}
            {toastState.type === 'ERROR' && <AlertCircle size={22} color="#EF4444" />}
            {toastState.type === 'WARNING' && <AlertTriangle size={22} color="#F59E0B" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toastTitle}>{toastState.title}</Text>
            {toastState.message ? (
              <Text style={styles.toastMessage}>{toastState.message}</Text>
            ) : null}
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: SIZES.padding_md }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ── Header ── */}
        <Text style={[TYPOGRAPHY.header, { marginBottom: 4 }]}>Tài khoản của tôi</Text>
        <Text style={[TYPOGRAPHY.bodySecondary, { marginBottom: SIZES.padding_md }]}>
          Hồ sơ tài xế & nhật ký ca làm việc
        </Text>

        {/* ── Card 1: Driver Profile Card ── */}
        <View style={[COMMON_STYLES.card, styles.profileCard]}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              <User color={COLORS.surface} size={42} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.employeeId}>
                {licensePlate} • {vehicleTypeFriendly}
              </Text>

              {/* Status & Depot Badge */}
              <View style={styles.statusBadgeRow}>
                <View style={styles.activePill}>
                  <ShieldCheck color="#059669" size={13} style={{ marginRight: 4 }} />
                  <Text style={styles.activePillText}>Đang hoạt động</Text>
                </View>
                <View style={styles.depotPill}>
                  <Building2 color={COLORS.primary} size={13} style={{ marginRight: 4 }} />
                  <Text style={styles.depotPillText} numberOfLines={1}>
                    {depotName}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Contact info */}
          <View style={styles.contactRow}>
            <Phone color={COLORS.textSecondary} size={14} style={{ marginRight: 8 }} />
            <Text style={styles.contactText}>{phoneText}</Text>
          </View>
          <View style={[styles.contactRow, { marginTop: 6 }]}>
            <Mail color={COLORS.textSecondary} size={14} style={{ marginRight: 8 }} />
            <Text style={styles.contactText}>{emailText}</Text>
          </View>
        </View>

        {/* ── Card 2: Shift & COD Snapshot ── */}
        <View style={COMMON_STYLES.card}>
          <View style={styles.snapshotHeader}>
            <Text style={TYPOGRAPHY.title}>Tóm tắt ca làm việc hôm nay</Text>
            <ShiftBadge status={currentShiftStatus} label={currentShiftLabel} />
          </View>

          {/* COD highlight */}
          <View style={styles.codHighlight}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codLabel}>Tiền COD đang giữ</Text>
              <Text style={styles.codValue}>{codFormatted}</Text>
              {startingCashCod > 0 && (
                <Text style={styles.startingCashNote}>
                  Tiền ứng đầu ca: ₫{startingCashCod.toLocaleString('vi-VN')}
                </Text>
              )}
            </View>
            <Wallet color={COLORS.primary} size={28} />
          </View>

          {/* Earnings highlight (Sau chiết khấu 15%) */}
          <TouchableOpacity
            style={styles.earningsHighlight}
            activeOpacity={0.8}
            onPress={() => setEarningsModalVisible(true)}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Text style={styles.earningsHighlightLabel}>Thu nhập thực nhận hôm nay</Text>
                <View style={styles.commissionBadgeSmall}>
                  <Text style={styles.commissionBadgeSmallText}>Sau trừ 15% CK</Text>
                </View>
              </View>
              <Text style={styles.earningsHighlightValue}>
                ₫{roundToThousand(earningsData?.day?.netEarnings ?? 0).toLocaleString('vi-VN')}
              </Text>
              <Text style={styles.earningsHighlightSub}>
                Xem theo Ngày / Tuần / Tháng ›
              </Text>
            </View>
            <View style={styles.earningsHighlightIconWrap}>
              <TrendingUp color="#059669" size={24} />
            </View>
          </TouchableOpacity>

          {/* Metric grid - Real monthly data from DB */}
          <View style={styles.metricsGrid}>
            <MetricCard
              icon={<TrendingUp color={COLORS.success} size={20} />}
              value={`${monthlyOrders}`}
              label="Đơn giao tháng này"
              accent={COLORS.textPrimary}
            />
            <View style={styles.metricDivider} />
            <MetricCard
              icon={<CheckCircle2 color={COLORS.primary} size={20} />}
              value={`${monthlyRate}%`}
              label="Tỷ lệ thành công"
              accent={COLORS.success}
            />
          </View>
        </View>

        {/* ── Card 3: Action List (All Real Features) ── */}
        <View style={COMMON_STYLES.card}>
          <Text style={[TYPOGRAPHY.title, { marginBottom: 12 }]}>Cài đặt & Tiện ích</Text>

          {/* 1. Driver Earnings & Platform Commission Report */}
          <ActionRow
            icon={<TrendingUp color="#059669" size={20} />}
            label="Báo cáo Thu nhập & Chiết khấu"
            subtitle="Thu nhập thực nhận theo Ngày / Tuần / Tháng"
            onPress={() => setEarningsModalVisible(true)}
          />

          {/* 2. Shift History & COD Settlement */}
          <ActionRow
            icon={<History color={COLORS.primary} size={20} />}
            label="Lịch sử ca & Lịch sử COD"
            subtitle="Xem 30 ca gần nhất & đối soát"
            onPress={handleOpenShiftHistory}
          />

          {/* 2. Assigned Zones & Depot */}
          <ActionRow
            icon={<MapPin color={COLORS.success} size={20} />}
            label="Khu vực làm việc phân công"
            subtitle={formatCleanZones(zonesList)}
            onPress={() => setZonesModalVisible(true)}
          />

          {/* 3. Notification & Sound Settings */}
          <ActionRow
            icon={<Bell color="#F59E0B" size={20} />}
            label="Thông báo & Âm thanh"
            subtitle={getNotificationSubtitle(notificationSettings)}
            onPress={() => setNotificationsModalVisible(true)}
          />

          {/* 4. Change Password */}
          <ActionRow
            icon={<Lock color="#6366F1" size={20} />}
            label="Đổi mật khẩu bảo mật"
            subtitle="Cập nhật mật khẩu tài khoản"
            onPress={() => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setShowCurrentPass(false);
              setShowNewPass(false);
              setShowConfirmPass(false);
              setPasswordModalVisible(true);
            }}
          />

          {/* 5. Support & Dispatcher Center */}
          <ActionRow
            icon={<Headphones color="#0284C7" size={20} />}
            label="Trung tâm hỗ trợ & Tổng đài Bưu cục"
            subtitle={`Hotline: ${depotPhone}`}
            onPress={() => setSupportModalVisible(true)}
            isLast
          />
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.appVersion}>IUH Logistics Mobile v1.0.0 (Build 2026)</Text>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setLogoutModalVisible(true)}
            activeOpacity={0.8}
          >
            <LogOut color={COLORS.danger} size={18} style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════
          CUSTOM CONFIRMATION MODAL: LOGOUT
      ═════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <LogOut color="#EF4444" size={28} />
            </View>
            <Text style={styles.confirmTitle}>Đăng xuất tài khoản</Text>
            <Text style={styles.confirmDesc}>
              Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng IUH Logistics không? Phiên làm việc hiện
              tại sẽ kết thúc an toàn.
            </Text>
            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmAcceptBtn}
                onPress={executeLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmAcceptText}>Đăng xuất</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 0: BOTTOM SHEET - DRIVER EARNINGS & PLATFORM COMMISSION (15%)
      ═════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={earningsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEarningsModalVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTouch}
            activeOpacity={1}
            onPress={() => setEarningsModalVisible(false)}
          />
          <View style={[styles.sheetCard, styles.sheetCardLarge]}>
            <View style={styles.dragHandle} />

            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconBadge, { backgroundColor: '#ECFDF5' }]}>
                  <TrendingUp color="#059669" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Thu nhập & Chiết khấu</Text>
                  <Text style={styles.sheetSubtitle}>Đã trừ 15% phí dịch vụ SmartExpress</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={styles.sheetHeaderActionBtn}
                  onPress={() => loadEarningsData(true)}
                  disabled={isLoadingEarnings}
                >
                  <RotateCw color="#059669" size={17} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setEarningsModalVisible(false)}
                >
                  <X color="#64748B" size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Segmented Period Switch: Day | Week | Month */}
            <View style={styles.segmentedContainer}>
              <TouchableOpacity
                style={[
                  styles.segmentedTab,
                  selectedPeriod === 'day' && styles.segmentedTabActive,
                ]}
                onPress={() => setSelectedPeriod('day')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentedTabText,
                    selectedPeriod === 'day' && styles.segmentedTabTextActive,
                  ]}
                >
                  Hôm nay
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentedTab,
                  selectedPeriod === 'week' && styles.segmentedTabActive,
                ]}
                onPress={() => setSelectedPeriod('week')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentedTabText,
                    selectedPeriod === 'week' && styles.segmentedTabTextActive,
                  ]}
                >
                  Theo Tuần
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentedTab,
                  selectedPeriod === 'month' && styles.segmentedTabActive,
                ]}
                onPress={() => setSelectedPeriod('month')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentedTabText,
                    selectedPeriod === 'month' && styles.segmentedTabTextActive,
                  ]}
                >
                  Theo Tháng
                </Text>
              </TouchableOpacity>
            </View>

            {isLoadingEarnings ? (
              <View style={[styles.modalLoadingWrap, { flex: 1 }]}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={styles.modalLoadingText}>Đang tính toán thu nhập & chiết khấu...</Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1, width: '100%' }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, flexGrow: 1 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {(() => {
                  const activePeriod = earningsData ? earningsData[selectedPeriod] : null;
                  const gross = roundToThousand(activePeriod?.grossEarnings ?? 0);
                  const fee = roundToThousand(activePeriod?.platformFee ?? gross * 0.15);
                  const net = gross - fee;
                  const count = activePeriod?.deliveredOrdersCount ?? 0;
                  const orders = activePeriod?.ordersBreakdown ?? [];
                  const periodLabel =
                    selectedPeriod === 'day'
                      ? 'Hôm nay'
                      : selectedPeriod === 'week'
                      ? 'Theo Tuần'
                      : 'Theo Tháng';

                  return (
                    <>
                      {/* Phần 1 – Thẻ Tổng Thu Nhập Thực Nhận (85%) */}
                      <View style={styles.earningsHeroCard}>
                        <View style={styles.earningsHeroTop}>
                          <View style={styles.earningsHeroBadge}>
                            <Sparkles color="#059669" size={13} style={{ marginRight: 4 }} />
                            <Text style={styles.earningsHeroBadgeText}>{periodLabel}</Text>
                          </View>
                          <View style={styles.ordersCountBadge}>
                            <CheckCircle2 color="#047857" size={12} style={{ marginRight: 4 }} />
                            <Text style={styles.ordersCountBadgeText}>{count} đơn đã giao</Text>
                          </View>
                        </View>
                        <Text style={styles.earningsHeroLabel}>
                          Tổng thu nhập thực nhận (85%)
                        </Text>
                        <Text style={styles.earningsHeroAmount}>
                          +{net.toLocaleString('vi-VN')} ₫
                        </Text>
                      </View>

                      {/* Phần 2 – Khung Công thức Bóc tách Chiết khấu */}
                      <View style={styles.transparentBreakdownCard}>
                        <View style={styles.breakdownHeaderRow}>
                          <Text style={styles.breakdownCardTitle}>Bóc tách doanh thu & Chiết khấu</Text>
                          <Text style={styles.breakdownCardRate}>Tỷ lệ 85% / 15%</Text>
                        </View>

                        {/* Dòng 1: Tổng cước vận chuyển (100%) */}
                        <View style={styles.breakdownRow}>
                          <View style={styles.breakdownLabelRow}>
                            <View style={[styles.breakdownDot, { backgroundColor: '#3B82F6' }]} />
                            <Text style={styles.breakdownLabel}>Tổng cước vận chuyển (100%)</Text>
                          </View>
                          <Text style={styles.breakdownValGross}>+{gross.toLocaleString('vi-VN')} ₫</Text>
                        </View>

                        {/* Dòng 2: Trừ chiết khấu nền tảng SmartExpress (15%) */}
                        <View style={styles.breakdownRow}>
                          <View style={styles.breakdownLabelRow}>
                            <View style={[styles.breakdownDot, { backgroundColor: '#EF4444' }]} />
                            <Text style={styles.breakdownLabel}>Trừ chiết khấu nền tảng SmartExpress (15%)</Text>
                          </View>
                          <Text style={styles.breakdownValFee}>-{fee.toLocaleString('vi-VN')} ₫</Text>
                        </View>

                        {/* Dashed line */}
                        <View style={styles.breakdownDivider} />

                        {/* Dòng 3: Thu nhập ròng thực nhận (= Tổng cước - 15% CK) */}
                        <View style={styles.breakdownRow}>
                          <View style={styles.breakdownLabelRow}>
                            <View style={[styles.breakdownDot, { backgroundColor: '#059669' }]} />
                            <Text style={styles.breakdownLabelBold}>Thu nhập ròng thực nhận (= Tổng cước - 15% CK)</Text>
                          </View>
                          <Text style={styles.breakdownValNet}>={net.toLocaleString('vi-VN')} ₫</Text>
                        </View>

                        {/* Ghi chú nhỏ bên dưới: Công thức */}
                        <View style={styles.formulaNoteBox}>
                          <Text style={styles.formulaNoteText}>
                            * Công thức: Thu nhập thực nhận = 85% × Tổng cước phí vận chuyển của các đơn đã giao thành công
                          </Text>
                        </View>
                      </View>

                      {/* Phần 3 – Danh sách chi tiết từng đơn hàng trong kỳ (ordersBreakdown) */}
                      <View style={styles.ordersSectionHeader}>
                        <Text style={styles.ordersSectionTitle}>
                          Danh sách đơn hàng trong kỳ ({orders.length})
                        </Text>
                        <Text style={styles.ordersSectionSubtitle}>Thực nhận = 85% cước phí</Text>
                      </View>

                      {orders.length === 0 ? (
                        <View style={styles.emptyWrap}>
                          <Package color={COLORS.inactive} size={44} style={{ marginBottom: 10 }} />
                          <Text style={styles.emptyTitle}>Chưa có đơn hoàn thành trong kỳ này</Text>
                          <Text style={styles.emptyDesc}>
                            Các đơn hàng giao thành công trong khoảng thời gian này sẽ được liệt kê tại đây.
                          </Text>
                        </View>
                      ) : (
                        orders.map((order) => {
                          const orderGross = roundToThousand(order.grossFee);
                          const orderFee = roundToThousand(order.platformFee ?? orderGross * 0.15);
                          const orderNet = orderGross - orderFee;
                          const codAmount = roundToThousand(order.codAmount);

                          return (
                            <View key={order.id} style={styles.orderBreakdownCard}>
                              {/* Header: Code & Completed Time */}
                              <View style={styles.orderItemHeader}>
                                <View style={styles.orderCodeBadge}>
                                  <Text style={styles.orderCodeText}>{order.code}</Text>
                                </View>
                                <View style={styles.orderTimeWrap}>
                                  <Clock size={12} color="#64748B" style={{ marginRight: 4 }} />
                                  <Text style={styles.orderTimeText}>{formatDateTime(order.completedAt)}</Text>
                                </View>
                              </View>

                              {/* Address */}
                              <View style={styles.orderAddressRow}>
                                <MapPin size={13} color="#64748B" style={{ marginRight: 4, marginTop: 2 }} />
                                <Text style={styles.orderAddressText} numberOfLines={2}>
                                  {order.deliveryAddress}
                                </Text>
                              </View>

                              {/* Meta Tags: Weight & COD */}
                              <View style={styles.orderTagsRow}>
                                <View style={styles.orderTag}>
                                  <Text style={styles.orderTagText}>Khối lượng: {order.weightKg} kg</Text>
                                </View>
                                {codAmount > 0 && (
                                  <View style={[styles.orderTag, styles.orderTagCod]}>
                                    <Banknote size={11} color="#6366F1" style={{ marginRight: 3 }} />
                                    <Text style={styles.orderTagCodText}>
                                      COD: ₫{codAmount.toLocaleString('vi-VN')}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {/* Financial breakdown pill bar */}
                              <View style={styles.orderFinBar}>
                                <View style={styles.orderFinCol}>
                                  <Text style={styles.orderFinLabel}>Cước gốc</Text>
                                  <Text style={styles.orderFinGross}>
                                    +{orderGross.toLocaleString('vi-VN')} ₫
                                  </Text>
                                </View>
                                <Text style={styles.orderFinOperator}>-</Text>
                                <View style={styles.orderFinCol}>
                                  <Text style={styles.orderFinLabel}>Chiết khấu -15%</Text>
                                  <Text style={styles.orderFinFee}>
                                    -{orderFee.toLocaleString('vi-VN')} ₫
                                  </Text>
                                </View>
                                <Text style={styles.orderFinOperator}>=</Text>
                                <View style={styles.orderFinCol}>
                                  <Text style={styles.orderFinLabel}>Thực nhận +85%</Text>
                                  <Text style={styles.orderFinNet}>
                                    +{orderNet.toLocaleString('vi-VN')} ₫
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 1: BOTTOM SHEET - SHIFT HISTORY & COD RECONCILIATION
      ═════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={shiftHistoryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShiftHistoryVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTouch}
            activeOpacity={1}
            onPress={() => setShiftHistoryVisible(false)}
          />
          <View style={[styles.sheetCard, styles.sheetCardLarge]}>
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconBadge, { backgroundColor: '#EEF2FF' }]}>
                  <History color="#4F46E5" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Lịch sử ca & Đối soát COD</Text>
                  <Text style={styles.sheetSubtitle}>30 ca làm việc gần nhất từ hệ thống</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={styles.sheetHeaderActionBtn}
                  onPress={loadShiftHistory}
                  disabled={isLoadingHistory}
                >
                  <RotateCw color={COLORS.primary} size={17} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setShiftHistoryVisible(false)}
                >
                  <X color="#64748B" size={18} />
                </TouchableOpacity>
              </View>
            </View>

            {isLoadingHistory ? (
              <View style={[styles.modalLoadingWrap, { flex: 1 }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.modalLoadingText}>Đang tải lịch sử ca làm việc...</Text>
              </View>
            ) : shiftHistory.length === 0 ? (
              <View style={[styles.emptyWrap, { flex: 1 }]}>
                <History color={COLORS.inactive} size={48} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Chưa có lịch sử ca làm việc</Text>
                <Text style={styles.emptyDesc}>
                  Các ca làm việc bạn đã mở và hoàn thành sẽ xuất hiện tại đây.
                </Text>
              </View>
            ) : (
              <FlatList
                data={shiftHistory}
                keyExtractor={(item) => item.id}
                style={{ flex: 1, width: '100%' }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, flexGrow: 1 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                renderItem={({ item }) => {
                  const isDiff = item.codDifference !== 0;
                  const isClosed = item.status === 'CLOSED' || (item.status as string) === 'RECONCILED';
                  const isPending = item.status === 'PENDING_SETTLEMENT';

                  return (
                    <View
                      style={[
                        styles.financialCard,
                        isClosed
                          ? styles.accentGreen
                          : isPending
                          ? styles.accentAmber
                          : styles.accentBlue,
                      ]}
                    >
                      <View style={styles.finHeaderRow}>
                        <View style={styles.finTimeWrap}>
                          <Calendar size={13} color="#64748B" style={{ marginRight: 5 }} />
                          <Text style={styles.finTimeText}>{formatDateTime(item.startTime)}</Text>
                        </View>
                        <ShiftBadge status={item.status} label={item.statusLabel} />
                      </View>

                      <Text style={styles.finEndTimeText}>
                        Đóng ca: {formatDateTime(item.endTime)}
                      </Text>

                      <View style={styles.finGrid}>
                        <View style={styles.finGridCol}>
                          <Text style={styles.finColLabel}>COD thu trong ca</Text>
                          <Text style={styles.finColValGreen}>
                            ₫{item.codCollected.toLocaleString('vi-VN')}
                          </Text>
                        </View>
                        <View style={styles.finGridDivider} />
                        <View style={styles.finGridCol}>
                          <Text style={styles.finColLabel}>Đã nộp bưu cục</Text>
                          <Text style={styles.finColVal}>
                            ₫{item.codSubmitted.toLocaleString('vi-VN')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.finBottomRow}>
                        <Text style={styles.finStartingCashText}>
                          Ứng đầu ca: ₫{item.startingCashCod.toLocaleString('vi-VN')}
                        </Text>
                        {isDiff && (
                          <Text style={styles.finDiffText}>
                            Chênh lệch: {item.codDifference > 0 ? '+' : ''}₫
                            {item.codDifference.toLocaleString('vi-VN')}
                          </Text>
                        )}
                      </View>

                      {item.reconciledAt && (
                        <View style={styles.finReconciledWrap}>
                          <CheckCircle2 size={12} color="#059669" style={{ marginRight: 4 }} />
                          <Text style={styles.finReconciledText}>
                            Đã đối soát vào {formatDateTime(item.reconciledAt)}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 2: BOTTOM SHEET - ASSIGNED DEPOT & ZONES
      ═════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={zonesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setZonesModalVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTouch}
            activeOpacity={1}
            onPress={() => setZonesModalVisible(false)}
          />
          <View style={[styles.sheetCard, styles.sheetCardMedium]}>
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconBadge, { backgroundColor: '#ECFDF5' }]}>
                  <MapPin color="#059669" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Khu vực làm việc phân công</Text>
                  <Text style={styles.sheetSubtitle}>Thông tin bưu cục & tuyến phụ trách</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setZonesModalVisible(false)}
              >
                <X color="#64748B" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ width: '100%', flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Depot Info Card */}
              <View style={styles.modalInfoCard}>
                <View style={styles.modalCardHeader}>
                  <Building2 color={COLORS.primary} size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.modalCardTitle}>Bưu cục trực thuộc</Text>
                </View>
                <Text style={styles.depotDetailName}>{depotName}</Text>
                <Text style={styles.depotDetailAddress}>{depotAddress}</Text>

                {/* 2 Big Action Buttons */}
                <View style={styles.depotActionRow}>
                  <TouchableOpacity
                    style={styles.depotCallBtn}
                    onPress={handleCallDepot}
                    activeOpacity={0.8}
                  >
                    <Phone color="#FFFFFF" size={16} style={{ marginRight: 6 }} />
                    <Text style={styles.depotCallBtnText}>Gọi điều phối</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.depotMapBtn}
                    onPress={handleOpenDepotMap}
                    activeOpacity={0.8}
                  >
                    <Navigation color="#DC2626" size={16} style={{ marginRight: 6 }} />
                    <Text style={styles.depotMapBtnText}>Chỉ đường tới kho</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Zones Card */}
              <View style={[styles.modalInfoCard, { marginTop: 14 }]}>
                <View style={styles.modalCardHeader}>
                  <MapPin color="#059669" size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.modalCardTitle}>Tuyến / Khu vực phụ trách</Text>
                </View>
                <Text style={styles.modalCardDesc}>
                  Theo quy chuẩn phân vùng vận hành, tài xế chỉ nhận các đơn hàng và lộ trình giao
                  thuộc các khu vực được Dispatcher chỉ định dưới đây:
                </Text>

                {zonesList.length === 0 ? (
                  <Text style={styles.noZonesText}>Chưa có khu vực phân công cụ thể.</Text>
                ) : (
                  <View style={styles.zoneChipWrap}>
                    {zonesList.map((zone, idx) => (
                      <View key={idx} style={styles.zoneChip}>
                        <MapPin color="#DC2626" size={14} style={{ marginRight: 6 }} />
                        <Text style={styles.zoneChipText}>{zone}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 3: BOTTOM SHEET - NOTIFICATIONS & SOUND SETTINGS
      ═════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={notificationsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotificationsModalVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTouch}
            activeOpacity={1}
            onPress={() => setNotificationsModalVisible(false)}
          />
          <View style={[styles.sheetCard, styles.sheetCardMedium]}>
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Bell color="#D97706" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Thông báo & Âm thanh</Text>
                  <Text style={styles.sheetSubtitle}>Cài đặt chuông báo và rung khi tác nghiệp</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setNotificationsModalVisible(false)}
              >
                <X color="#64748B" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ width: '100%', flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Setting 1: New order sound */}
              <View style={styles.settingCard}>
                <View style={[styles.settingIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <Bell color="#D97706" size={18} />
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.settingTitle}>Âm thanh đơn mới</Text>
                  <Text style={styles.settingDesc}>
                    Phát chuông thông báo khi Dispatcher gán thêm đơn hoặc lộ trình mới
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.newOrderSound}
                  onValueChange={(val) => handleUpdateNotificationSetting('newOrderSound', val)}
                  trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
                />
              </View>

              {/* Setting 2: Vibrate on Stop / POD */}
              <View style={styles.settingCard}>
                <View style={[styles.settingIconBox, { backgroundColor: '#F3E8FF' }]}>
                  <Activity color="#9333EA" size={18} />
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.settingTitle}>Rung phản hồi tác nghiệp</Text>
                  <Text style={styles.settingDesc}>
                    Rung thiết bị khi bấm xác nhận giao hàng hoặc cập nhật trạng thái POD
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.vibrateOnStop}
                  onValueChange={(val) => handleUpdateNotificationSetting('vibrateOnStop', val)}
                  trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
                />
              </View>

              {/* Setting 3: Auto Nav on Move */}
              <View style={styles.settingCard}>
                <View style={[styles.settingIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Navigation color="#0284C7" size={18} />
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.settingTitle}>Tự động bật dẫn đường</Text>
                  <Text style={styles.settingDesc}>
                    Tự động mở chỉ đường Google Maps khi bấm "Bắt đầu di chuyển"
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.autoNavOnMove}
                  onValueChange={(val) => handleUpdateNotificationSetting('autoNavOnMove', val)}
                  trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
                />
              </View>

              {/* Haptic Test Button */}
              <TouchableOpacity
                style={styles.testVibrateBtn}
                onPress={() => {
                  Vibration.vibrate([0, 150, 100, 150]);
                  showToast('SUCCESS', 'Đã rung phản hồi', 'Haptic feedback hoạt động bình thường.');
                }}
                activeOpacity={0.8}
              >
                <Sparkles color="#B45309" size={16} style={{ marginRight: 6 }} />
                <Text style={styles.testVibrateText}>Thử rung thiết bị (Haptic Test)</Text>
              </TouchableOpacity>

              <Text style={styles.settingsSaveNote}>
                ✓ Cấu hình được lưu tự động vào bộ nhớ thiết bị.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 4: BOTTOM SHEET - CHANGE PASSWORD
      ═════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTouch}
            activeOpacity={1}
            onPress={() => setPasswordModalVisible(false)}
          />
          <View style={[styles.sheetCard, styles.sheetCardMedium]}>
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconBadge, { backgroundColor: '#F3E8FF' }]}>
                  <Lock color="#9333EA" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Đổi mật khẩu bảo mật</Text>
                  <Text style={styles.sheetSubtitle}>Cập nhật mật khẩu tài khoản tài xế</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setPasswordModalVisible(false)}
              >
                <X color="#64748B" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ width: '100%', flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Current Password */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mật khẩu hiện tại *</Text>
                <View
                  style={[
                    styles.passwordInputWrap,
                    focusedField === 'current' && styles.inputBoxFocused,
                  ]}
                >
                  <Lock color="#94A3B8" size={18} style={{ marginLeft: 14 }} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Nhập mật khẩu hiện tại"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showCurrentPass}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    onFocus={() => setFocusedField('current')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPass(!showCurrentPass)}
                    style={styles.eyeBtn}
                  >
                    {showCurrentPass ? (
                      <EyeOff color="#64748B" size={19} />
                    ) : (
                      <Eye color="#64748B" size={19} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mật khẩu mới (tối thiểu 6 ký tự) *</Text>
                <View
                  style={[
                    styles.passwordInputWrap,
                    focusedField === 'new' && styles.inputBoxFocused,
                  ]}
                >
                  <Lock color="#94A3B8" size={18} style={{ marginLeft: 14 }} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Tối thiểu 6 ký tự"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showNewPass}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => setFocusedField('new')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPass(!showNewPass)}
                    style={styles.eyeBtn}
                  >
                    {showNewPass ? (
                      <EyeOff color="#64748B" size={19} />
                    ) : (
                      <Eye color="#64748B" size={19} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm New Password */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Xác nhận mật khẩu mới *</Text>
                <View
                  style={[
                    styles.passwordInputWrap,
                    focusedField === 'confirm' && styles.inputBoxFocused,
                  ]}
                >
                  <Lock color="#94A3B8" size={18} style={{ marginLeft: 14 }} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Nhập lại mật khẩu mới"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showConfirmPass}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPass(!showConfirmPass)}
                    style={styles.eyeBtn}
                  >
                    {showConfirmPass ? (
                      <EyeOff color="#64748B" size={19} />
                    ) : (
                      <Eye color="#64748B" size={19} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitPasswordBtn, isChangingPassword && { opacity: 0.7 }]}
                onPress={handleChangePassword}
                disabled={isChangingPassword}
                activeOpacity={0.8}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitPasswordText}>Cập nhật mật khẩu</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 5: BOTTOM SHEET - SUPPORT & DISPATCHER CENTER
      ═════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={supportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTouch}
            activeOpacity={1}
            onPress={() => setSupportModalVisible(false)}
          />
          <View style={[styles.sheetCard, styles.sheetCardLarge]}>
            <View style={styles.dragHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconBadge, { backgroundColor: '#E0F2FE' }]}>
                  <Headphones color="#0284C7" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Trung tâm hỗ trợ & Tổng đài</Text>
                  <Text style={styles.sheetSubtitle}>Hỗ trợ kỹ thuật & xử lý sự cố giao hàng</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setSupportModalVisible(false)}
              >
                <X color="#64748B" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1, width: '100%' }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Card 1: Assigned Depot Dispatcher */}
              <View style={styles.modalInfoCard}>
                <View style={styles.modalCardHeader}>
                  <Building2 color={COLORS.primary} size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.modalCardTitle}>Bưu cục trực thuộc</Text>
                </View>
                <Text style={styles.depotDetailName}>{depotName}</Text>
                <Text style={styles.depotDetailAddress}>{depotAddress}</Text>
                <Text style={styles.supportContactNote}>
                  Liên hệ điều phối trạm khi cần điều chỉnh tuyến, hủy đơn gấp hoặc sự cố hàng hóa
                  tại khu vực.
                </Text>

                <TouchableOpacity
                  style={styles.supportCallPrimaryBtn}
                  onPress={handleCallDepot}
                  activeOpacity={0.8}
                >
                  <Phone color="#FFFFFF" size={17} style={{ marginRight: 8 }} />
                  <Text style={styles.supportCallPrimaryText}>Gọi điều phối: {depotPhone}</Text>
                </TouchableOpacity>
              </View>

              {/* Card 2: Central Customer Service */}
              <View style={[styles.modalInfoCard, { marginTop: 14, backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                <View style={styles.modalCardHeader}>
                  <Headphones color="#0284C7" size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.modalCardTitle}>Tổng đài CSKH & Kỹ thuật IUH Logistics</Text>
                </View>
                <Text style={styles.supportScheduleText}>
                  ⏰ Giờ hoạt động: 07:00 - 21:00 (Hàng ngày, kể cả Thứ 7 & CN)
                </Text>
                <Text style={styles.modalCardDesc}>
                  Hỗ trợ các vấn đề lỗi ứng dụng, tài khoản, đối soát COD khi chốt ca và hỗ trợ khẩn
                  cấp.
                </Text>

                <TouchableOpacity
                  style={styles.supportCallSecondaryBtn}
                  onPress={() => Linking.openURL('tel:02838940338')}
                  activeOpacity={0.8}
                >
                  <PhoneCall color="#0284C7" size={17} style={{ marginRight: 8 }} />
                  <Text style={styles.supportCallSecondaryText}>Gọi tổng đài: 02838940338</Text>
                </TouchableOpacity>
              </View>

              {/* Card 3: Quick Guidelines */}
              <View
                style={[
                  styles.modalInfoCard,
                  { marginTop: 14, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                ]}
              >
                <View style={styles.modalCardHeader}>
                  <AlertTriangle color="#D97706" size={19} style={{ marginRight: 8 }} />
                  <Text style={[styles.modalCardTitle, { color: '#B45309' }]}>
                    Quy trình xử lý khẩn cấp
                  </Text>
                </View>
                <Text style={styles.emergencyItem}>
                  • <Text style={{ fontWeight: '700' }}>Sự cố xe cộ / tai nạn:</Text> Dừng xe ở nơi
                  an toàn, gọi ngay hotline điều phối để được hỗ trợ điều xe cứu hộ hoặc phân bổ lại
                  đơn.
                </Text>
                <Text style={[styles.emergencyItem, { marginTop: 6 }]}>
                  • <Text style={{ fontWeight: '700' }}>Khách hẹn lại / không liên lạc được:</Text> Bấm
                  nút "Báo thất bại / Hẹn lại" tại màn hình Chi tiết điểm dừng, chụp ảnh chứng minh
                  cuộc gọi hoặc vị trí trước cửa nhà.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  employeeId: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  depotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 180,
  },
  depotPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
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
  startingCashNote: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 4,
    fontWeight: '600',
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

  // ─── Floating Toast Styles ─────────────────────────────────────────────────
  floatingToast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 99999,
    borderWidth: 1.5,
  },
  toastSuccess: {
    borderColor: '#10B981',
  },
  toastError: {
    borderColor: '#EF4444',
  },
  toastWarning: {
    borderColor: '#F59E0B',
  },
  toastIconBox: {
    marginRight: 12,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  toastMessage: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  // ─── Custom Confirm Dialog Styles ──────────────────────────────────────────
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmAcceptBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmAcceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Bottom Sheet Modal Styles ─────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTouch: {
    flex: 1,
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetCardLarge: {
    height: '82%',
    minHeight: 520,
    maxHeight: '88%',
    width: '100%',
  },
  sheetCardMedium: {
    maxHeight: '85%',
    width: '100%',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  sheetIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sheetHeaderActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingWrap: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyWrap: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ─── Modal 1 Financial Cards ───────────────────────────────────────────────
  financialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  accentGreen: {
    borderLeftColor: '#10B981',
  },
  accentAmber: {
    borderLeftColor: '#F59E0B',
  },
  accentBlue: {
    borderLeftColor: '#3B82F6',
  },
  finHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  finTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  finTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  finEndTimeText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  finGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginVertical: 4,
  },
  finGridCol: {
    flex: 1,
    alignItems: 'center',
  },
  finGridDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  finColLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  finColValGreen: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  finColVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  finBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  finStartingCashText: {
    fontSize: 11,
    color: '#64748B',
  },
  finDiffText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  finReconciledWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  finReconciledText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },

  // ─── Modal 2 Depot & Zones ─────────────────────────────────────────────────
  modalInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalCardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },
  depotDetailName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  depotDetailAddress: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  depotActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  depotCallBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  depotCallBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  depotMapBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.2,
    borderColor: '#FECACA',
    borderRadius: 14,
  },
  depotMapBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  noZonesText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
  },
  zoneChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  zoneChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },

  // ─── Modal 3 Notification Settings ─────────────────────────────────────────
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  testVibrateBtn: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    marginTop: 8,
  },
  testVibrateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  settingsSaveNote: {
    marginTop: 16,
    fontSize: 12,
    color: '#059669',
    textAlign: 'center',
    fontWeight: '600',
  },

  // ─── Modal 4 Change Password ───────────────────────────────────────────────
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  passwordInputWrap: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 14,
  },
  inputBoxFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 12,
  },
  submitPasswordBtn: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitPasswordText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Modal 5 Support & Dispatcher Center ───────────────────────────────────
  supportContactNote: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },
  supportCallPrimaryBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  supportCallPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  supportScheduleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 8,
  },
  supportCallSecondaryBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    marginTop: 6,
  },
  supportCallSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  emergencyItem: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },

  // ── Earnings Snapshot Highlight in Shift Card ──
  earningsHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderRadius: SIZES.radius_md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 14,
    marginTop: 10,
    marginBottom: SIZES.padding_sm,
  },
  earningsHighlightLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    marginRight: 6,
  },
  commissionBadgeSmall: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#6EE7B7',
  },
  commissionBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  earningsHighlightValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#047857',
    marginVertical: 2,
  },
  earningsHighlightSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  earningsHighlightIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Segmented Control in Earnings Modal ──
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 4,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentedTabTextActive: {
    color: '#047857',
    fontWeight: '700',
  },

  // ── Hero Summary Card in Earnings Modal ──
  earningsHeroCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  earningsHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  earningsHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  earningsHeroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  ordersCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ordersCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  earningsHeroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 4,
  },
  earningsHeroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },

  // ── Transparent Revenue Breakdown Card ──
  transparentBreakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  breakdownCardRate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  breakdownLabelBold: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '700',
  },
  breakdownValGross: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  breakdownValFee: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  breakdownDivider: {
    height: 1,
    borderWidth: 0.7,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  breakdownValNet: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  formulaNoteBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  formulaNoteText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // ── Orders Section & Cards in Earnings Modal ──
  ordersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  ordersSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  ordersSectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  orderBreakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  orderItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderCodeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#BFDBFE',
  },
  orderCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  orderTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderTimeText: {
    fontSize: 11,
    color: '#64748B',
  },
  orderAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderAddressText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
    flex: 1,
  },
  orderTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  orderTag: {
    backgroundColor: '#F8FAFC',
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  orderTagText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  orderTagCod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  orderTagCodText: {
    fontSize: 11,
    color: '#4338CA',
    fontWeight: '600',
  },
  orderFinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  orderFinCol: {
    alignItems: 'center',
    flex: 1,
  },
  orderFinLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  orderFinGross: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  orderFinOperator: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    paddingHorizontal: 2,
  },
  orderFinFee: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  orderFinNet: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
});
