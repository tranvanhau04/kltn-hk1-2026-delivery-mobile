import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OSMMapView } from '../../components/OSMMapView';
import * as Location from 'expo-location';
import {
  Navigation,
  Wifi,
  WifiOff,
  CloudUpload,
  MapPin,
  Clock,
  Route as RouteIcon,
  Locate,
  Phone,
} from 'lucide-react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { MainTabParamList } from '../../navigation/MainTabNavigator';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { postDriverLocation } from '../../lib/api';

// Driver ID used for GPS tracking
const ACTIVE_DRIVER_ID = 'u0000000-0000-0000-0000-000000000101';

// How often to push GPS to backend (ms)
const GPS_PUSH_INTERVAL_MS = 10000; // 10 seconds

// ─── GPS Pulsating Dot ───────────────────────────────────────────────────────
const PulsingDot = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] });
  return (
    <Animated.View style={[styles.gpsDot, { opacity, transform: [{ scale }] }]} />
  );
};



// ─── Main Screen ─────────────────────────────────────────────────────────────
export const TrackScreen = () => {
  const { route, stops, polylineCoords } = useAppContext();
  const [cachedPings, setCachedPings] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncSuccess, setLastSyncSuccess] = useState<boolean | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [driverCoord, setDriverCoord] = useState<{ latitude: number; longitude: number; heading?: number | null } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const tabRoute = useRoute<RouteProp<MainTabParamList, 'Track'>>();
  const navParams = tabRoute.params;

  const [isNavigating, setIsNavigating] = useState(false);
  const [navCoords, setNavCoords] = useState<[number, number][]>([]);
  const [navDistanceKm, setNavDistanceKm] = useState<number | null>(null);
  const [navDurationMin, setNavDurationMin] = useState<number | null>(null);

  const fallbackStop = stops.find(s => s.status === 'PENDING' || s.status === 'ARRIVED');
  const activeStop = navParams?.selectedStopId 
    ? stops.find(s => s.id === navParams.selectedStopId) || fallbackStop 
    : fallbackStop;
  
  const isActiveStopSelected = navParams?.selectedStopId != null;

  const completedCount = stops.filter(s => s.status === 'COMPLETED').length;

  const remainingKm = route
    ? (route.total_distance_km - (route.total_distance_km * (completedCount / Math.max(stops.length, 1)))).toFixed(1)
    : '—';

  const remainingMin = route
    ? Math.round(route.total_estimated_time_min * (1 - completedCount / Math.max(stops.length, 1)))
    : null;

  const etaLabel = remainingMin != null
    ? (remainingMin >= 60
      ? `${Math.floor(remainingMin / 60)} giờ ${remainingMin % 60} phút`
      : `${remainingMin} phút`)
    : '—';

  useEffect(() => {
    if (navParams?.destLat && navParams?.destLng && driverCoord) {
      if (navParams?.autoStartNavigation) {
        setIsNavigating(true);
      }
      const fetchRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${driverCoord.longitude},${driverCoord.latitude};${navParams.destLng},${navParams.destLat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const r = data.routes[0];
              const coords = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
              setNavCoords(coords);
              setNavDistanceKm(r.distance / 1000);
              setNavDurationMin(r.duration / 60);
            }
          }
        } catch (e) {
          console.log('Error fetching nav route', e);
        }
      };
      fetchRoute();
    }
  }, [navParams?.autoStartNavigation, navParams?.destLat, navParams?.destLng, driverCoord]);

  // ─── Request GPS permission on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted' ? 'granted' : 'denied');
      if (status !== 'granted') {
        Alert.alert(
          'Cần quyền định vị',
          'Ứng dụng cần quyền truy cập GPS để theo dõi và gửi vị trí tài xế.',
          [{ text: 'OK' }],
        );
      }
    })();
  }, []);

  // ─── Real GPS push every 10 seconds ──────────────────────────────────────
  const sendGpsPing = useCallback(async () => {
    if (locationPermission !== 'granted') return;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude, speed, heading, accuracy } = loc.coords;

      // Update local driver position on the map
      setDriverCoord({ latitude, longitude, heading: heading ?? null });
      setGpsAccuracy(accuracy ? Math.round(accuracy) : null);

      // Push real GPS coordinates to backend
      await postDriverLocation(
        ACTIVE_DRIVER_ID,
        latitude,
        longitude,
        speed ?? undefined,
        heading ?? undefined,
      );
      setCachedPings(0);
      setLastSyncSuccess(true);
    } catch {
      setCachedPings(p => p + 1);
      setLastSyncSuccess(false);
    }
  }, [locationPermission]);

  useEffect(() => {
    if (locationPermission !== 'granted') return;
    // Initial ping immediately
    sendGpsPing();
    const interval = setInterval(sendGpsPing, GPS_PUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [locationPermission, sendGpsPing]);

  const handleNavigate = () => {
    if (!driverCoord) {
      Alert.alert('Chưa có vị trí', 'Vui lòng chờ tín hiệu GPS để bắt đầu di chuyển.');
      return;
    }
    
    setIsNavigating(true);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await sendGpsPing();
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  if (isNavigating) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827' }}>
        <OSMMapView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          latitude={driverCoord?.latitude || Number(activeStop?.order?.lat) || 10.8222}
          longitude={driverCoord?.longitude || Number(activeStop?.order?.lng) || 106.6875}
          driverCoords={driverCoord}
          stops={activeStop ? [{
            id: activeStop.id,
            lat: Number(activeStop.order.lat),
            lng: Number(activeStop.order.lng),
            stopNumber: activeStop.sequence_no,
            status: activeStop.status,
          }] : []}
          routePolyline={[]}
          navPolyline={navCoords}
          zoom={18}
          isNavigating={true}
        />

        <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={['top']}>
          <View style={[styles.navBanner, { margin: SIZES.padding_md, borderRadius: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.navBannerTitle}>
                Đang dẫn đường tới: {activeStop?.order?.receiver_name}
              </Text>
              <Text style={styles.navBannerAddress} numberOfLines={1}>
                {activeStop?.order?.delivery_address}
              </Text>
            </View>
            <View style={styles.navBannerStats}>
              <Text style={styles.navBannerTime}>
                {navDurationMin ? `${Math.round(navDurationMin)} phút` : '--'}
              </Text>
              <Text style={styles.navBannerDist}>
                {navDistanceKm ? `${navDistanceKm.toFixed(1)} km` : '--'}
              </Text>
            </View>
          </View>
        </SafeAreaView>

        <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} edges={['bottom']}>
          <View style={[COMMON_STYLES.card, { margin: SIZES.padding_md, gap: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPOGRAPHY.title}>{activeStop?.order?.receiver_name}</Text>
                <Text style={TYPOGRAPHY.bodySecondary} numberOfLines={1}>{activeStop?.order?.delivery_address}</Text>
              </View>
              <TouchableOpacity style={{ backgroundColor: COLORS.primary, padding: 10, borderRadius: 20 }}>
                <Phone color="#fff" size={20} />
              </TouchableOpacity>
            </View>
            
            {activeStop?.order?.cod_amount ? (
              <Text style={{ fontWeight: '600', color: COLORS.primary }}>
                COD: ₫{activeStop?.order?.cod_amount.toLocaleString('vi-VN')}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <TouchableOpacity
                style={[COMMON_STYLES.primaryButton, { flex: 1, backgroundColor: COLORS.danger }]}
                onPress={() => setIsNavigating(false)}
              >
                <Text style={TYPOGRAPHY.buttonText}>Kết thúc</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[COMMON_STYLES.primaryButton, { flex: 1, backgroundColor: COLORS.success }]}
                onPress={() => {
                  setIsNavigating(false);
                }}
              >
                <Text style={TYPOGRAPHY.buttonText}>Đã đến nơi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>

      <ScrollView contentContainerStyle={{ padding: SIZES.padding_md }}>

        {/* ── Top Navigation Banner (PREVIEW MODE) ── */}
        {isActiveStopSelected && (
          <View style={[styles.navBanner, { borderRadius: 16, marginBottom: SIZES.padding_md }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.navBannerTitle}>
                Tới: {activeStop?.order?.receiver_name}
              </Text>
              <Text style={styles.navBannerAddress} numberOfLines={1}>
                {activeStop?.order?.delivery_address}
              </Text>
            </View>
            <View style={styles.navBannerStats}>
              <Text style={styles.navBannerTime}>
                {navDurationMin ? `${Math.round(navDurationMin)} phút` : '--'}
              </Text>
              <Text style={styles.navBannerDist}>
                {navDistanceKm ? `${navDistanceKm.toFixed(1)} km` : '--'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={TYPOGRAPHY.header}>Theo dõi tuyến đường</Text>
            <Text style={TYPOGRAPHY.bodySecondary}>Dẫn đường giao hàng GPS</Text>
          </View>
          <View style={[styles.locateBadge, { backgroundColor: locationPermission === 'granted' ? '#D1FAE5' : '#FEF3C7' }]}>
            <Locate color={locationPermission === 'granted' ? COLORS.success : '#D97706'} size={14} />
            <Text style={[styles.locateText, { color: locationPermission === 'granted' ? COLORS.success : '#D97706' }]}>
              {locationPermission === 'granted' ? 'LIVE' : 'GPS OFF'}
            </Text>
          </View>
        </View>

        {/* ── GPS Status Card ── */}
        <View style={[COMMON_STYLES.card, styles.gpsCard]}>
          <View style={styles.gpsPill}>
            <PulsingDot />
            <Text style={styles.gpsText}>
              {locationPermission === 'granted' ? 'GPS đang hoạt động' : 'Chưa cấp quyền GPS'}
            </Text>
            {gpsAccuracy != null && (
              <Text style={styles.gpsAccuracy}>(Độ chính xác: ±{gpsAccuracy} m)</Text>
            )}
          </View>
          {driverCoord && (
            <Text style={styles.coordText}>
              📍 {driverCoord.latitude.toFixed(5)}, {driverCoord.longitude.toFixed(5)}
            </Text>
          )}
          <View style={styles.routeStats}>
            <View style={styles.statItem}>
              <RouteIcon color={COLORS.primary} size={16} />
              <Text style={styles.statValue}>{remainingKm} km</Text>
              <Text style={styles.statLabel}>Còn lại</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Clock color={COLORS.success} size={16} />
              <Text style={styles.statValue}>{etaLabel}</Text>
              <Text style={styles.statLabel}>ETA</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MapPin color={COLORS.textSecondary} size={16} />
              <Text style={styles.statValue}>{completedCount}/{stops.length}</Text>
              <Text style={styles.statLabel}>Đã giao</Text>
            </View>
          </View>
        </View>

        {/* ── Real Route Map ── */}
        <View style={COMMON_STYLES.card}>
          <View style={styles.mapHeader}>
            <Text style={[TYPOGRAPHY.title, { flex: 1 }]}>Bản đồ tuyến đường</Text>
            {polylineCoords.length === 0 && (
              <View style={styles.noRouteChip}>
                <Text style={styles.noRouteChipText}>Chưa có tuyến</Text>
              </View>
            )}
          </View>
          <OSMMapView
            style={styles.mapView}
            latitude={driverCoord?.latitude || Number(stops[0]?.order?.lat) || 10.8222}
            longitude={driverCoord?.longitude || Number(stops[0]?.order?.lng) || 106.6875}
            driverCoords={driverCoord}
            stops={stops.map((s) => ({
              id: s.id,
              lat: s.order.lat,
              lng: s.order.lng,
              stopNumber: s.sequence_no,
              status: s.status,
            }))}
            routePolyline={polylineCoords}
            navPolyline={navCoords}
            isNavigating={false}
          />
        </View>

        {/* ── Active Task Card ── */}
        {activeStop ? (
          <View style={[COMMON_STYLES.card, styles.nextStopCard]}>
            <View style={styles.nextStopHeader}>
              <View style={[styles.nextStopBadge, isActiveStopSelected && { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.nextStopBadgeText}>
                  {isActiveStopSelected ? 'NHIỆM VỤ ĐÃ CHỌN' : 'ĐIỂM TIẾP THEO'}
                </Text>
              </View>
              <Text style={styles.nextStopCode}>#{activeStop.sequence_no} · {activeStop.order.code}</Text>
            </View>

            <Text style={styles.nextStopName}>{activeStop.order.receiver_name}</Text>
            <View style={styles.nextStopAddressRow}>
              <MapPin color={COLORS.textSecondary} size={13} style={{ marginRight: 4 }} />
              <Text style={styles.nextStopAddress} numberOfLines={2}>{activeStop.order.delivery_address}</Text>
            </View>

            {activeStop.order.cod_amount > 0 && (
              <View style={styles.codChip}>
                <Text style={styles.codChipText}>
                  COD: ₫{activeStop.order.cod_amount.toLocaleString('vi-VN')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[COMMON_STYLES.primaryButton, { marginTop: 14 }]}
              onPress={handleNavigate}
              activeOpacity={0.8}
            >
              <Navigation color="#fff" size={18} style={{ marginRight: 8 }} />
              <Text style={TYPOGRAPHY.buttonText}>Bắt đầu di chuyển</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[COMMON_STYLES.card, styles.allDoneCard]}>
            <Text style={styles.allDoneText}>🎉 Hoàn thành tất cả điểm giao hôm nay!</Text>
          </View>
        )}

        {/* ── GPS Sync Status ── */}
        <View style={[COMMON_STYLES.card, styles.cacheCard]}>
          <View style={styles.cacheLeft}>
            {isSyncing ? (
              <Wifi color={COLORS.primary} size={20} />
            ) : lastSyncSuccess === false ? (
              <WifiOff color={COLORS.danger} size={20} />
            ) : (
              <Wifi color={COLORS.success} size={20} />
            )}
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.cacheTitle}>
                {lastSyncSuccess === false ? 'Offline – Lưu GPS cục bộ' : 'GPS đồng bộ Backend'}
              </Text>
              <Text style={styles.cacheDetail}>
                {isSyncing
                  ? 'Đang gửi tọa độ...'
                  : lastSyncSuccess === false
                    ? `${cachedPings} ping chờ gửi khi có mạng`
                    : `Tự động gửi mỗi ${GPS_PUSH_INTERVAL_MS / 1000}s · Dashboard đang hiển thị vị trí thực`}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleSync} style={styles.syncBtn} activeOpacity={0.7}>
            <CloudUpload color={COLORS.primary} size={22} />
          </TouchableOpacity>
        </View>

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
  locateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  locateText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  gpsCard: {
    gap: 12,
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  gpsDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  gpsText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  gpsAccuracy: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  coordText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingHorizontal: 4,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  noRouteChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  noRouteChipText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
  mapView: {
    height: 240,
    borderRadius: SIZES.radius_md,
    overflow: 'hidden',
  },
  stopMarker: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  stopMarkerText: {
    color: 'white',
    fontWeight: 'bold',
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarkerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  nextStopCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  nextStopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  nextStopBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nextStopBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nextStopCode: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  nextStopName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  nextStopAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nextStopAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  codChip: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  codChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  allDoneCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  allDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  cacheCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cacheLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cacheTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  cacheDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  syncBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },
  navBanner: {
    flexDirection: 'row',
    backgroundColor: '#1E3A8A',
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 8,
  },
  navBannerTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  navBannerAddress: {
    color: '#BFDBFE',
    fontSize: 12,
    marginTop: 2,
  },
  navBannerStats: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  navBannerTime: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navBannerDist: {
    color: '#93C5FD',
    fontSize: 12,
  },
});
