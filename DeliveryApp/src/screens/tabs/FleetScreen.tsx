import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  Bike,
  Truck,
  MapPin,
  Phone,
  Navigation,
  Weight,
  Package,
  Wifi,
  WifiOff,
  Activity,
  Radio,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { fetchFleetInfo, ApiFleetInfoResponse } from '../../lib/api';
import { getQueue } from '../../lib/offlineQueue';
import { isSocketConnected } from '../../lib/socketClient';
import { isTracking } from '../../services/LocationService';

// ─── Capacity Progress Bar ───────────────────────────────────────────────────
type CapacityBarProps = {
  label: string;
  current: number;
  max: number;
  unit: string;
  subDetail?: string;
  icon: React.ReactNode;
  warningThreshold?: number;
  dangerThreshold?: number;
  colorOverride?: string;
};

const CapacityBar = ({
  label,
  current,
  max,
  unit,
  subDetail,
  icon,
  warningThreshold = 80,
  dangerThreshold = 95,
  colorOverride,
}: CapacityBarProps) => {
  const safeMax = max > 0 ? max : 1;
  const rawRatio = max > 0 ? current / safeMax : 0;
  const pct = Math.min(Math.round(rawRatio * 100), 100);

  let barColor = COLORS.success;
  let badgeBg = '#D1FAE5';
  let badgeText = '#065F46';

  if (colorOverride) {
    barColor = colorOverride;
    badgeBg = '#EFF6FF';
    badgeText = colorOverride;
  } else if (pct >= dangerThreshold) {
    barColor = '#EF4444';
    badgeBg = '#FEE2E2';
    badgeText = '#991B1B';
  } else if (pct >= warningThreshold) {
    barColor = '#F59E0B';
    badgeBg = '#FEF3C7';
    badgeText = '#92400E';
  }

  return (
    <View style={styles.capBlock}>
      <View style={styles.capLabelRow}>
        <View style={styles.capTitleLeft}>
          {icon}
          <Text style={styles.capLabel}>{label}</Text>
        </View>
        <View style={[styles.capBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.capBadgeText, { color: badgeText }]}>{pct}%</Text>
        </View>
      </View>
      <View style={styles.capTrack}>
        <View style={[styles.capFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.capDetailRow}>
        <Text style={styles.capDetail}>
          {current} / {max} {unit}
        </Text>
        {subDetail ? <Text style={styles.capSubDetail}>{subDetail}</Text> : null}
      </View>
    </View>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function renderVehicleIcon(vehicleType?: string) {
  const vt = (vehicleType || '').toUpperCase();
  if (vt.includes('TRUCK') || vt.includes('TẢI') || vt.includes('VAN')) {
    return <Truck color={COLORS.primary} size={36} />;
  }
  return <Bike color={COLORS.primary} size={36} />;
}

function getVehicleLabel(vehicleType?: string) {
  const vt = (vehicleType || '').toUpperCase();
  if (vt.includes('VAN')) return 'Xe Van – Vận chuyển';
  if (vt.includes('TRUCK') || vt.includes('TẢI')) return 'Xe Tải – Vận chuyển';
  return 'Xe máy – Giao hàng chặng cuối';
}

function renderShiftBadge(shiftStatus?: string, totalAssignedOrders = 0) {
  const isOnline =
    shiftStatus === 'ONLINE_READY' || shiftStatus === 'BUSY' || shiftStatus === 'ON_DUTY';
  if (isOnline) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
        <Radio color="#059669" size={13} />
        <Text style={[styles.statusBadgeText, { color: '#059669' }]}>Đang trong ca</Text>
      </View>
    );
  }
  if (totalAssignedOrders > 0) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#DBEAFE' }]}>
        <Truck color="#2563EB" size={13} />
        <Text style={[styles.statusBadgeText, { color: '#2563EB' }]}>Đã phân công</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, { backgroundColor: '#F3F4F6' }]}>
      <Text style={[styles.statusBadgeText, { color: '#6B7280' }]}>Chưa mở ca</Text>
    </View>
  );
}

/**
 * Format danh sách zone đảm bảo không bị lặp chữ "Khu vực"
 * VD DB: "Khu vực Gò Vấp / Bình Thạnh" -> "Khu vực: Gò Vấp / Bình Thạnh"
 */
function formatZoneSubtitle(zones: string[]): string {
  if (!zones || zones.length === 0) {
    return 'Khu vực: Nội đô / Linh hoạt theo VRP';
  }
  const cleaned = zones
    .map((z) => z.replace(/^Khu\s*vực[:\s\-]*/i, '').trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return 'Khu vực: Nội đô / Linh hoạt theo VRP';
  }
  return `Khu vực: ${cleaned.join(' • ')}`;
}

// ─── Main FleetScreen Component ──────────────────────────────────────────────
export const FleetScreen = () => {
  const { token, user, driverProfile } = useAuth();
  const { driver: contextDriver } = useAppContext();

  const [fleetData, setFleetData] = useState<ApiFleetInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Connection & Offline Queue status
  const [gpsStatus, setGpsStatus] = useState<'ACTIVE' | 'READY' | 'INACTIVE'>('INACTIVE');
  const [isSocketLive, setIsSocketLive] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  const checkSystemStatus = useCallback(async () => {
    setIsSocketLive(isSocketConnected());

    // 1. Kiểm tra trạng thái GPS thực tế từ hệ thống thiết bị và quyền của App
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const perm = await Location.getForegroundPermissionsAsync();
      const isPermGranted = perm.status === 'granted';

      if (servicesEnabled && isPermGranted) {
        // Kiểm tra xem ca làm việc có đang mở hoặc GPS tracking có đang chạy
        const isTrackingActive = isTracking();
        const isShiftOnline =
          fleetData?.driver?.currentShiftStatus === 'ONLINE_READY' ||
          fleetData?.driver?.currentShiftStatus === 'BUSY' ||
          fleetData?.driver?.currentShiftStatus === 'ON_DUTY' ||
          fleetData?.activeShift?.status === 'OPEN' ||
          driverProfile?.currentShiftStatus === 'ONLINE_READY' ||
          driverProfile?.currentShiftStatus === 'BUSY' ||
          driverProfile?.currentShiftStatus === 'ON_DUTY';

        if (isTrackingActive || isShiftOnline) {
          setGpsStatus('ACTIVE');
        } else {
          setGpsStatus('READY');
        }
      } else {
        setGpsStatus('INACTIVE');
      }
    } catch (err) {
      console.warn('[FleetScreen] Error checking location services:', err);
      setGpsStatus(isTracking() ? 'ACTIVE' : 'INACTIVE');
    }

    // 2. Kiểm tra số lượng tác vụ trong hàng đợi ngoại tuyến
    try {
      const queue = await getQueue();
      const pending = queue.filter((q) => q.status === 'PENDING').length;
      setPendingQueueCount(pending);
    } catch {
      setPendingQueueCount(0);
    }
  }, [
    fleetData?.driver?.currentShiftStatus,
    fleetData?.activeShift?.status,
    driverProfile?.currentShiftStatus,
  ]);

  const loadData = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetchFleetInfo(token, user?.id);
      if (res && res.success) {
        setFleetData(res);
      }
    } catch (err) {
      console.warn('[FleetScreen] Failed to load fleet info from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    checkSystemStatus();
  }, [checkSystemStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    await checkSystemStatus();
    setRefreshing(false);
  }, [loadData, checkSystemStatus]);

  // Derived properties with safe fallbacks
  const licensePlate =
    fleetData?.driver?.licensePlate ||
    driverProfile?.licensePlate ||
    contextDriver?.license_plate ||
    'Chưa đăng ký';

  const vehicleType =
    fleetData?.driver?.vehicleType ||
    driverProfile?.vehicleType ||
    contextDriver?.vehicle_type ||
    'MOTORBIKE';

  const maxWeightKg =
    fleetData?.driver?.maxWeightKg ??
    driverProfile?.maxWeightKg ??
    contextDriver?.max_weight_kg ??
    50;

  const currentWeightKg = fleetData?.metrics?.currentWeightKg ?? 0;
  const totalShiftWeightKg = fleetData?.metrics?.totalShiftWeightKg ?? 0;
  const totalAssignedOrders = fleetData?.metrics?.totalAssignedOrders ?? 0;
  const deliveredOrders = fleetData?.metrics?.deliveredOrders ?? 0;
  const remainingOrders = fleetData?.metrics?.remainingOrders ?? 0;

  const currentShiftStatus =
    fleetData?.driver?.currentShiftStatus ||
    driverProfile?.currentShiftStatus ||
    'OFFLINE';

  const depot = fleetData?.depot ?? null;
  const zones = fleetData?.zones ?? [];

  // Actions
  const handleCallHub = () => {
    if (depot?.contactPhone && depot.contactPhone.trim().length > 0) {
      Linking.openURL(`tel:${depot.contactPhone.trim()}`).catch(() =>
        Alert.alert('Lỗi', 'Không thể khởi chạy ứng dụng gọi điện trên thiết bị.')
      );
    } else {
      Alert.alert('Thông báo', 'Bưu cục chưa cập nhật số điện thoại liên hệ.');
    }
  };

  const handleDirections = () => {
    if (depot?.latitude && depot?.longitude) {
      const lat = depot.latitude;
      const lng = depot.longitude;
      const label = encodeURIComponent(depot.name || 'Bưu cục');
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      });
      Linking.openURL(url!).catch(() => {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() =>
          Alert.alert('Lỗi', 'Không thể mở ứng dụng bản đồ dẫn đường.')
        );
      });
    } else {
      Alert.alert('Thông báo', 'Bưu cục chưa có thông tin tọa độ vị trí.');
    }
  };

  const handleGpsPress = async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          'Dịch vụ định vị đang tắt',
          'Vui lòng bật tính năng Định vị (GPS) trong Cài đặt thiết bị để ứng dụng có thể truyền tọa độ phát hàng.',
          [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Mở Cài đặt',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
                    Linking.openSettings();
                  });
                }
              },
            },
          ],
        );
        return;
      }

      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status === 'granted') {
          await checkSystemStatus();
          Alert.alert('Thành công', 'Đã cấp quyền định vị GPS cho ứng dụng.');
        } else {
          Alert.alert(
            'Quyền định vị bị từ chối',
            'Vui lòng cấp quyền truy cập Vị trí cho ứng dụng trong Cài đặt thiết bị để tiếp tục tác nghiệp.',
            [
              { text: 'Đóng', style: 'cancel' },
              { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
            ],
          );
        }
        return;
      }

      await checkSystemStatus();
      if (gpsStatus === 'ACTIVE') {
        Alert.alert(
          'Định vị GPS Realtime',
          'Định vị GPS đang hoạt động bình thường và sẵn sàng truyền tọa độ theo thời gian thực.',
        );
      } else {
        Alert.alert(
          'Định vị GPS Realtime',
          'Dịch vụ định vị GPS đã sẵn sàng. Hệ thống sẽ tự động đồng bộ vị trí khi bạn bắt đầu ca làm việc.',
        );
      }
    } catch (err) {
      console.warn('[FleetScreen] handleGpsPress error:', err);
      Alert.alert('Lỗi', 'Không thể kiểm tra cài đặt vị trí.');
    }
  };

  const renderGpsBadge = () => {
    if (gpsStatus === 'ACTIVE') {
      return (
        <View style={[styles.syncBadge, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.syncBadgeText, { color: '#059669' }]}>Đang hoạt động</Text>
        </View>
      );
    }
    if (gpsStatus === 'READY') {
      return (
        <View style={[styles.syncBadge, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.syncBadgeText, { color: '#059669' }]}>Đã sẵn sàng</Text>
        </View>
      );
    }
    return (
      <View style={[styles.syncBadge, { backgroundColor: '#FEE2E2' }]}>
        <Text style={[styles.syncBadgeText, { color: '#DC2626' }]}>Chưa kích hoạt</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SIZES.padding_md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={TYPOGRAPHY.header}>Thông tin xe & Đội xe</Text>
            <Text style={TYPOGRAPHY.bodySecondary}>Phương tiện đăng ký & Bưu cục trực thuộc</Text>
          </View>
          {renderShiftBadge(currentShiftStatus, totalAssignedOrders)}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải thông tin đội xe...</Text>
          </View>
        ) : (
          <>
            {/* ── Thẻ 1: Phương tiện đăng ký & Năng lực tải (Chuẩn VRP) ── */}
            <View style={COMMON_STYLES.card}>
              <View style={styles.vehicleTop}>
                <View style={styles.vehicleIconWrap}>
                  {renderVehicleIcon(vehicleType)}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.plateTag}>
                    <Text style={styles.plateText}>{licensePlate}</Text>
                  </View>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{getVehicleLabel(vehicleType)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Progress 1: Tải trọng hàng hóa (kg) */}
              <CapacityBar
                label="Tải trọng thực tế đang chở"
                current={currentWeightKg}
                max={maxWeightKg}
                unit="kg"
                subDetail={`Tổng ca: ${totalShiftWeightKg} kg`}
                icon={<Weight color={COLORS.textSecondary} size={16} style={{ marginRight: 6 }} />}
              />

              <View style={{ height: 16 }} />

              {/* Progress 2: Tiến độ giao đơn trong ca */}
              <CapacityBar
                label="Tiến độ phát hàng trong ca"
                current={deliveredOrders}
                max={totalAssignedOrders}
                unit="đơn"
                subDetail={`Còn ${remainingOrders} đơn cần giao`}
                icon={<Package color={COLORS.textSecondary} size={16} style={{ marginRight: 6 }} />}
                colorOverride="#2563EB"
              />
            </View>

            {/* ── Thẻ 2: Bưu cục trực thuộc & Tuyến phụ trách ── */}
            <View style={COMMON_STYLES.card}>
              <View style={styles.depotHeader}>
                <View style={styles.depotIconWrap}>
                  <MapPin color={COLORS.primary} size={20} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={TYPOGRAPHY.title}>Bưu cục / Kho trực thuộc (Depot)</Text>
                  <Text style={styles.zoneSubtitle}>
                    {formatZoneSubtitle(zones)}
                  </Text>
                </View>
              </View>

              <Text style={styles.depotName}>
                {depot?.name || 'Chưa gán bưu cục trực thuộc'}
              </Text>

              <View style={styles.depotAddressRow}>
                <MapPin color={COLORS.textSecondary} size={14} style={{ marginRight: 6, marginTop: 2 }} />
                <Text style={styles.depotAddress}>
                  {depot?.address || 'Vui lòng liên hệ điều phối viên để được phân bổ bưu cục hoạt động'}
                </Text>
              </View>

              {depot?.contactPhone ? (
                <View style={styles.depotPhoneRow}>
                  <Phone color={COLORS.textSecondary} size={14} style={{ marginRight: 6 }} />
                  <Text style={styles.depotPhoneText}>Hotline kho: {depot.contactPhone}</Text>
                </View>
              ) : null}

              <View style={styles.depotActions}>
                <TouchableOpacity
                  style={[
                    styles.depotBtn,
                    { backgroundColor: depot?.contactPhone ? COLORS.success : '#9CA3AF' },
                  ]}
                  onPress={handleCallHub}
                  activeOpacity={0.8}
                >
                  <Phone color="#fff" size={16} />
                  <Text style={styles.depotBtnText}>Gọi bưu cục</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.depotBtn,
                    {
                      backgroundColor:
                        depot?.latitude && depot?.longitude ? COLORS.primary : '#9CA3AF',
                    },
                  ]}
                  onPress={handleDirections}
                  activeOpacity={0.8}
                >
                  <Navigation color="#fff" size={16} />
                  <Text style={styles.depotBtnText}>Chỉ đường về kho</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Thẻ 3: Trạng thái Kết nối & Đồng bộ tác nghiệp (100% Real) ── */}
            <View style={COMMON_STYLES.card}>
              <View style={styles.syncHeader}>
                <Activity color={COLORS.primary} size={18} />
                <Text style={[TYPOGRAPHY.title, { marginLeft: 8 }]}>
                  Trạng thái Kết nối & Tác nghiệp
                </Text>
              </View>

              {/* Dòng GPS - Cho phép tap để xem trạng thái hoặc xin quyền / bật định vị */}
              <TouchableOpacity
                style={styles.syncRow}
                onPress={handleGpsPress}
                activeOpacity={0.7}
              >
                <View style={styles.syncLeft}>
                  <Navigation
                    color={gpsStatus === 'INACTIVE' ? '#EF4444' : COLORS.success}
                    size={16}
                    style={{ marginRight: 8 }}
                  />
                  <View>
                    <Text style={styles.syncLabel}>Định vị GPS Realtime</Text>
                    {gpsStatus === 'INACTIVE' ? (
                      <Text style={styles.syncHint}>Chạm để bật GPS / Cấp quyền</Text>
                    ) : null}
                  </View>
                </View>
                {renderGpsBadge()}
              </TouchableOpacity>

              <View style={styles.rowDivider} />

              <View style={styles.syncRow}>
                <View style={styles.syncLeft}>
                  {isSocketLive ? (
                    <Wifi color={COLORS.success} size={16} style={{ marginRight: 8 }} />
                  ) : (
                    <WifiOff color={COLORS.textSecondary} size={16} style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.syncLabel}>Máy chủ Gateway (Socket)</Text>
                </View>
                <View
                  style={[
                    styles.syncBadge,
                    { backgroundColor: isSocketLive ? '#D1FAE5' : '#FEF3C7' },
                  ]}
                >
                  <Text
                    style={[
                      styles.syncBadgeText,
                      { color: isSocketLive ? '#059669' : '#D97706' },
                    ]}
                  >
                    {isSocketLive ? 'Trực tuyến' : 'Ngoại tuyến'}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.syncRow}>
                <View style={styles.syncLeft}>
                  <Package
                    color={pendingQueueCount > 0 ? '#F59E0B' : COLORS.textSecondary}
                    size={16}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.syncLabel}>Hàng đợi đồng bộ Offline</Text>
                </View>
                <View
                  style={[
                    styles.syncBadge,
                    { backgroundColor: pendingQueueCount > 0 ? '#FEF3C7' : '#D1FAE5' },
                  ]}
                >
                  <Text
                    style={[
                      styles.syncBadgeText,
                      { color: pendingQueueCount > 0 ? '#D97706' : '#059669' },
                    ]}
                  >
                    {pendingQueueCount === 0
                      ? '0 tác vụ (Đã đồng bộ)'
                      : `${pendingQueueCount} tác vụ chờ`}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.padding_md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  vehicleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plateTag: {
    backgroundColor: '#1A1D1F',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  plateText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1.2,
  },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  capBlock: {
    gap: 6,
  },
  capLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  capTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  capLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  capBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  capBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  capTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  capFill: {
    height: '100%',
    borderRadius: 4,
  },
  capDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  capDetail: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  capSubDetail: {
    fontSize: 12,
    color: '#6B7280',
  },
  depotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  depotIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneSubtitle: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  depotName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  depotAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  depotAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  depotPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  depotPhoneText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  depotActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  depotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: SIZES.radius_md,
    gap: 6,
  },
  depotBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  syncLabel: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  syncHint: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
  },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
});
