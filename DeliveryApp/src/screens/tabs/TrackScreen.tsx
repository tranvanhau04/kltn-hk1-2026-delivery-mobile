import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Linking,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  Navigation,
  Wifi,
  WifiOff,
  CloudUpload,
  MapPin,
  Clock,
  Route,
  Locate,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';

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

// ─── Simulated Vector Map ────────────────────────────────────────────────────
type MapStop = { x: number; y: number; label: number; status: 'done' | 'next' | 'upcoming' };

const MAP_STOPS: MapStop[] = [
  { x: 40, y: 180, label: 0, status: 'done' },   // Depot (start)
  { x: 90, y: 130, label: 1, status: 'done' },
  { x: 160, y: 100, label: 2, status: 'next' },
  { x: 220, y: 150, label: 3, status: 'upcoming' },
  { x: 290, y: 120, label: 4, status: 'upcoming' },
  { x: 340, y: 70, label: 5, status: 'upcoming' },
];

const DRIVER_POS = { x: 160, y: 100 };

const stopColor = (status: string) => {
  if (status === 'done') return COLORS.success;
  if (status === 'next') return COLORS.primary;
  return '#9CA3AF';
};

const SimulatedMap = () => (
  <View style={styles.mapContainer}>
    <Svg width="100%" height="100%" viewBox="0 0 380 220">
      {/* Street grid lines */}
      {[40, 80, 120, 160, 200].map(y => (
        <Line key={`h${y}`} x1="0" y1={y} x2="380" y2={y} stroke="#E5E7EB" strokeWidth="1" />
      ))}
      {[60, 120, 180, 240, 300, 360].map(x => (
        <Line key={`v${x}`} x1={x} y1="0" x2={x} y2="220" stroke="#E5E7EB" strokeWidth="1" />
      ))}

      {/* Polyline route path */}
      <Path
        d={MAP_STOPS.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`).join(' ')}
        stroke={COLORS.primary}
        strokeWidth="2.5"
        strokeDasharray="6,4"
        fill="none"
        opacity={0.7}
      />

      {/* Completed segment (solid) */}
      <Path
        d={MAP_STOPS.filter(s => s.status !== 'upcoming').map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`).join(' ')}
        stroke={COLORS.success}
        strokeWidth="3"
        fill="none"
      />

      {/* Stop markers */}
      {MAP_STOPS.slice(1).map((stop) => (
        <React.Fragment key={stop.label}>
          <Circle
            cx={stop.x}
            cy={stop.y}
            r={stop.status === 'next' ? 14 : 11}
            fill={stopColor(stop.status)}
            opacity={0.15}
          />
          <Circle
            cx={stop.x}
            cy={stop.y}
            r={stop.status === 'next' ? 9 : 7}
            fill={stopColor(stop.status)}
          />
          <SvgText
            x={stop.x}
            y={stop.y + 4}
            textAnchor="middle"
            fill="white"
            fontSize={9}
            fontWeight="bold"
          >
            {stop.label}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Depot marker */}
      <Rect x={MAP_STOPS[0].x - 10} y={MAP_STOPS[0].y - 10} width={20} height={20} rx={4} fill="#1A1D1F" />
      <SvgText x={MAP_STOPS[0].x} y={MAP_STOPS[0].y + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">HUB</SvgText>

      {/* Driver location pulsing circle */}
      <Circle cx={DRIVER_POS.x} cy={DRIVER_POS.y} r={18} fill={COLORS.primary} opacity={0.2} />
      <Circle cx={DRIVER_POS.x} cy={DRIVER_POS.y} r={10} fill={COLORS.primary} />
      <SvgText x={DRIVER_POS.x} y={DRIVER_POS.y + 3} textAnchor="middle" fill="white" fontSize={8}>▲</SvgText>
    </Svg>

    {/* Legend */}
    <View style={styles.mapLegend}>
      <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.success }]} /><Text style={styles.legendText}>Done</Text></View>
      <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} /><Text style={styles.legendText}>Next</Text></View>
      <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} /><Text style={styles.legendText}>Upcoming</Text></View>
    </View>
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const TrackScreen = () => {
  const { route, stops } = useAppContext();
  const [cachedPings] = useState(14);
  const [isSyncing, setIsSyncing] = useState(false);

  const nextStop = stops.find(s => s.status === 'PENDING');
  const completedCount = stops.filter(s => s.status === 'COMPLETED').length;

  const remainingKm = route
    ? (route.total_distance_km - (route.total_distance_km * (completedCount / stops.length))).toFixed(1)
    : '8.4';

  const remainingMin = route
    ? Math.round(route.total_estimated_time_min * (1 - completedCount / stops.length))
    : 80;

  const etaHr = Math.floor(remainingMin / 60);
  const etaMin = remainingMin % 60;
  const etaLabel = etaHr > 0 ? `${etaHr} hr ${etaMin} min` : `${etaMin} min`;

  const handleNavigate = () => {
    if (!nextStop) return;
    const { lat, lng } = nextStop.order;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open Maps.'));
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1500);
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SIZES.padding_md }}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={TYPOGRAPHY.header}>Live Route Track</Text>
            <Text style={TYPOGRAPHY.bodySecondary}>GPS-guided delivery navigation</Text>
          </View>
          <View style={styles.locateBadge}>
            <Locate color={COLORS.success} size={14} />
            <Text style={styles.locateText}>LIVE</Text>
          </View>
        </View>

        {/* ── GPS Status Card ── */}
        <View style={[COMMON_STYLES.card, styles.gpsCard]}>
          <View style={styles.gpsPill}>
            <PulsingDot />
            <Text style={styles.gpsText}>GPS Active</Text>
            <Text style={styles.gpsAccuracy}>(Accuracy: ±5 m)</Text>
          </View>
          <View style={styles.routeStats}>
            <View style={styles.statItem}>
              <Route color={COLORS.primary} size={16} />
              <Text style={styles.statValue}>{remainingKm} km</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Clock color={COLORS.success} size={16} />
              <Text style={styles.statValue}>{etaLabel}</Text>
              <Text style={styles.statLabel}>Est. ETA</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MapPin color={COLORS.textSecondary} size={16} />
              <Text style={styles.statValue}>{completedCount}/{stops.length}</Text>
              <Text style={styles.statLabel}>Stops Done</Text>
            </View>
          </View>
        </View>

        {/* ── Simulated Map ── */}
        <View style={COMMON_STYLES.card}>
          <Text style={[TYPOGRAPHY.title, { marginBottom: 10 }]}>Route Map</Text>
          <SimulatedMap />
        </View>

        {/* ── Next Stop Card ── */}
        {nextStop ? (
          <View style={[COMMON_STYLES.card, styles.nextStopCard]}>
            <View style={styles.nextStopHeader}>
              <View style={styles.nextStopBadge}>
                <Text style={styles.nextStopBadgeText}>NEXT STOP</Text>
              </View>
              <Text style={styles.nextStopCode}>#{nextStop.order.code}</Text>
            </View>

            <Text style={styles.nextStopName}>{nextStop.order.receiver_name}</Text>
            <View style={styles.nextStopAddressRow}>
              <MapPin color={COLORS.textSecondary} size={13} style={{ marginRight: 4 }} />
              <Text style={styles.nextStopAddress} numberOfLines={2}>{nextStop.order.delivery_address}</Text>
            </View>

            {nextStop.order.cod_amount > 0 && (
              <View style={styles.codChip}>
                <Text style={styles.codChipText}>
                  COD: ₫{nextStop.order.cod_amount.toLocaleString('vi-VN')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[COMMON_STYLES.primaryButton, { marginTop: 14 }]}
              onPress={handleNavigate}
              activeOpacity={0.8}
            >
              <Navigation color="#fff" size={18} style={{ marginRight: 8 }} />
              <Text style={TYPOGRAPHY.buttonText}>Navigate Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[COMMON_STYLES.card, styles.allDoneCard]}>
            <Text style={styles.allDoneText}>🎉 All stops completed for today!</Text>
          </View>
        )}

        {/* ── Offline GPS Cache ── */}
        <View style={[COMMON_STYLES.card, styles.cacheCard]}>
          <View style={styles.cacheLeft}>
            {isSyncing ? (
              <WifiOff color={COLORS.primary} size={20} />
            ) : (
              <Wifi color={COLORS.success} size={20} />
            )}
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.cacheTitle}>Offline GPS Cache</Text>
              <Text style={styles.cacheDetail}>
                {isSyncing
                  ? 'Syncing to cloud…'
                  : `Cached coordinates: ${cachedPings} pings queued for cloud sync`}
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
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  locateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
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
  mapContainer: {
    height: 220,
    backgroundColor: '#F9FAFB',
    borderRadius: SIZES.radius_md,
    overflow: 'hidden',
    position: 'relative',
  },
  mapLegend: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textSecondary,
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
});
