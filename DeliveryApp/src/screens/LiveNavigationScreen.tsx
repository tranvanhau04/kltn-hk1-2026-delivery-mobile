import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import {
  ArrowLeft,
  Navigation,
  MapPin,
  User,
  Locate,
  Clock,
  CheckCircle2,
  Layers,
  Phone,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../theme/theme';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { markStopArrivedApi } from '../lib/api';

export interface LiveNavigationParams {
  destination: {
    latitude: number;
    longitude: number;
  };
  address: string;
  customerName: string;
  customerPhone?: string;
  orderCode?: string;
  stopId?: string;
}

type LiveNavigationRouteProp = RouteProp<
  { LiveNavigationScreen: LiveNavigationParams },
  'LiveNavigationScreen'
>;

export const LiveNavigationScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<LiveNavigationRouteProp>();
  const { markStopArrived, refreshRoute } = useAppContext();
  const { token } = useAuth();
  const toast = useToast();

  // Extract params safely
  const params = route.params || {};
  const destination = params.destination || {
    latitude: 10.8222,
    longitude: 106.6875,
  };
  const address = params.address || 'Địa chỉ đang tải...';
  const customerName = params.customerName || 'Khách hàng';
  const customerPhone = params.customerPhone;
  const orderCode = params.orderCode;
  const stopId = params.stopId;

  // ─── Map Ref & Camera Mode State ───────────────────────────────────────────
  const mapRef = useRef<MapView>(null);

  // 3D Driving perspective vs 2D Overview perspective
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const is3DModeRef = useRef<boolean>(true);
  const followsUserRef = useRef<boolean>(true);
  const prevLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    heading: number;
  } | null>(null);

  const [polylineCoords, setPolylineCoords] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [distanceKm, setDistanceKm] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);
  const [followsUser, setFollowsUser] = useState<boolean>(true);
  const [isArriving, setIsArriving] = useState<boolean>(false);

  // ─── Calculate Bearing / Heading Fallback ──────────────────────────────────
  const calculateHeading = (
    prev: { latitude: number; longitude: number } | null,
    curr: { latitude: number; longitude: number },
    rawHeading?: number | null
  ): number => {
    if (rawHeading !== undefined && rawHeading !== null && rawHeading >= 0) {
      return rawHeading;
    }
    if (prev && (prev.latitude !== curr.latitude || prev.longitude !== curr.longitude)) {
      const lat1 = (prev.latitude * Math.PI) / 180;
      const lat2 = (curr.latitude * Math.PI) / 180;
      const dLon = ((curr.longitude - prev.longitude) * Math.PI) / 180;
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      const brng = (Math.atan2(y, x) * 180) / Math.PI;
      return (brng + 360) % 360;
    }
    return 0;
  };

  // ─── 1. Fetch OSRM Road Route ───────────────────────────────────────────────
  const fetchRoute = useCallback(
    async (
      origin: { latitude: number; longitude: number },
      dest: { latitude: number; longitude: number }
    ) => {
      setIsLoadingRoute(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const r = data.routes[0];
            const coordinates = r.geometry.coordinates.map(
              (c: [number, number]) => ({
                latitude: c[1],
                longitude: c[0],
              })
            );
            setPolylineCoords(coordinates);
            setDistanceKm((r.distance / 1000).toFixed(1));
            setDurationMin(Math.round(r.duration / 60));
            return;
          }
        }
      } catch (err) {
        console.warn('[LiveNavigation] OSRM route fetch failed, using straight line fallback:', err);
      } finally {
        setIsLoadingRoute(false);
      }

      // Fallback: Straight line
      setPolylineCoords([
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: dest.latitude, longitude: dest.longitude },
      ]);
    },
    []
  );

  // ─── 2. Setup GPS Tracking & 3D Navigation Camera ──────────────────────────
  useEffect(() => {
    let watcher: Location.LocationSubscription | null = null;
    let isMounted = true;

    const setupLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Quyền truy cập vị trí',
            'Ứng dụng cần quyền định vị GPS để theo dõi và chỉ đường 3D trực tiếp.'
          );
          return;
        }

        // Get initial location
        const initialPos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (!isMounted) return;

        const rawHeading = initialPos.coords.heading;
        const initialHeading =
          rawHeading !== null && rawHeading !== undefined && rawHeading >= 0
            ? rawHeading
            : 0;

        const origin = {
          latitude: initialPos.coords.latitude,
          longitude: initialPos.coords.longitude,
          heading: initialHeading,
        };
        prevLocationRef.current = origin;
        setCurrentLocation(origin);

        // Fetch route from current pos to destination
        await fetchRoute(origin, destination);

        // Initial 3D camera setup
        if (mapRef.current && is3DModeRef.current) {
          mapRef.current.animateCamera(
            {
              center: {
                latitude: origin.latitude,
                longitude: origin.longitude,
              },
              pitch: 60,
              heading: origin.heading,
              zoom: 18,
              altitude: 100,
            },
            { duration: 1000 }
          );
        }

        // Start continuous watcher for real-time 3D camera updates
        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 2000,
          },
          (newPos) => {
            if (!isMounted) return;
            const { latitude, longitude } = newPos.coords;
            const userHeading = calculateHeading(
              prevLocationRef.current,
              { latitude, longitude },
              newPos.coords.heading
            );

            const updated = {
              latitude,
              longitude,
              heading: userHeading,
            };
            prevLocationRef.current = updated;
            setCurrentLocation(updated);

            // STEP 2: 3D Navigation Camera update on every location tick
            if (followsUserRef.current && mapRef.current) {
              if (is3DModeRef.current) {
                mapRef.current.animateCamera(
                  {
                    center: { latitude, longitude },
                    pitch: 60,
                    heading: userHeading,
                    zoom: 18,
                    altitude: 100,
                  },
                  { duration: 800 }
                );
              } else {
                mapRef.current.animateCamera(
                  {
                    center: { latitude, longitude },
                    pitch: 0,
                    heading: 0,
                    zoom: 16,
                  },
                  { duration: 800 }
                );
              }
            }
          }
        );
      } catch (error) {
        console.warn('[LiveNavigation] Location tracking error:', error);
      }
    };

    setupLocationTracking();

    return () => {
      isMounted = false;
      if (watcher) {
        watcher.remove();
      }
    };
  }, [destination, fetchRoute]);

  // ─── 3. Toggle Button: 3D Navigation Camera ↔ 2D Overview ─────────────────
  const toggleCameraMode = () => {
    const nextMode = !is3DMode;
    setIs3DMode(nextMode);
    is3DModeRef.current = nextMode;
    setFollowsUser(true);
    followsUserRef.current = true;

    if (!mapRef.current) return;

    if (nextMode) {
      // Switch to 3D Navigation Camera: Tilted driving view
      if (currentLocation) {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            },
            pitch: 60,
            heading: currentLocation.heading ?? 0,
            zoom: 18,
            altitude: 100,
          },
          { duration: 800 }
        );
      }
    } else {
      // Switch to 2D Overview: Fit route between driver & destination
      if (currentLocation && destination) {
        mapRef.current.fitToCoordinates([currentLocation, destination], {
          edgePadding: {
            top: insets.top + 80,
            right: 50,
            bottom: insets.bottom + 240,
            left: 50,
          },
          animated: true,
        });
      } else if (currentLocation) {
        mapRef.current.animateCamera(
          {
            center: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            },
            pitch: 0,
            heading: 0,
            zoom: 16,
          },
          { duration: 800 }
        );
      }
    }
  };

  // ─── 4. Recenter Handler ───────────────────────────────────────────────────
  const handleRecenter = () => {
    if (!mapRef.current) return;
    setFollowsUser(true);
    followsUserRef.current = true;

    if (is3DMode && currentLocation) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
          pitch: 60,
          heading: currentLocation.heading ?? 0,
          zoom: 18,
          altitude: 100,
        },
        { duration: 800 }
      );
    } else if (currentLocation && destination) {
      mapRef.current.fitToCoordinates([currentLocation, destination], {
        edgePadding: {
          top: insets.top + 80,
          right: 50,
          bottom: insets.bottom + 240,
          left: 50,
        },
        animated: true,
      });
    } else if (currentLocation) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
          pitch: 0,
          heading: 0,
          zoom: 16,
        },
        { duration: 800 }
      );
    }
  };

  // ─── 5. Handle Call Customer ───────────────────────────────────────────────
  const handleCallCustomer = async () => {
    if (!customerPhone) return;
    const cleanPhone = customerPhone.replace(/[^0-9+]/g, '');
    const telUrl = `tel:${cleanPhone}`;
    try {
      const canOpen = await Linking.canOpenURL(telUrl);
      if (canOpen) {
        await Linking.openURL(telUrl);
      } else {
        Alert.alert('Thông báo', `Không thể quay số trực tiếp đến ${cleanPhone}.`);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi chạy ứng dụng gọi điện thoại.');
    }
  };

  // ─── 6. STEP 3: Handle "ĐÃ ĐẾN NƠI" (Arrived) Flow ──────────────────────────
  const handleArrived = () => {
    Alert.alert(
      'Xác nhận đến nơi',
      `Bạn xác nhận đã có mặt tại địa chỉ giao hàng của "${customerName}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'ĐÃ ĐẾN NƠI',
          onPress: async () => {
            if (!stopId) {
              Alert.alert('Thành công', 'Đã đến điểm giao hàng.');
              navigation.goBack();
              return;
            }

            setIsArriving(true);
            try {
              if (token) {
                await markStopArrivedApi(stopId, token);
              }
              markStopArrived(stopId);
              await refreshRoute();
              toast.success('Đã đến nơi', 'Cập nhật trạng thái điểm dừng thành công.');
            } catch (err: any) {
              console.warn('[LiveNavigation] markStopArrived error:', err);
              markStopArrived(stopId);
              toast.info('Đã ghi nhận', 'Đã cập nhật trạng thái đến nơi (ngoại tuyến).');
            } finally {
              setIsArriving(false);
              // Route driver directly to StopDetail screen to complete POD and COD
              navigation.navigate('StopDetail', { stopId });
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* 3D MAP VIEW */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={false}
        showsBuildings={true}
        pitchEnabled={true}
        rotateEnabled={true}
        initialCamera={{
          center: destination,
          pitch: 60,
          heading: 0,
          zoom: 18,
          altitude: 100,
        }}
        onPanDrag={() => {
          setFollowsUser(false);
          followsUserRef.current = false;
        }}
      >
        {/* Destination Marker */}
        <Marker
          coordinate={destination}
          title={customerName}
          description={address}
          pinColor="#EF4444"
        />

        {/* Navigation Polyline Route */}
        {polylineCoords.length > 0 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#2563EB"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      {/* FLOATING TOP BAR CONTROLS */}
      <View style={[styles.topBar, { top: insets.top + 12 }]} pointerEvents="box-none">
        {/* Back Button */}
        <TouchableOpacity
          style={styles.floatingRoundButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <ArrowLeft color="#1F2937" size={22} />
        </TouchableOpacity>

        {/* Right Action Group: 3D/2D Toggle + Recenter */}
        <View style={styles.topRightControls}>
          {/* 3D / 2D Mode Toggle Button */}
          <TouchableOpacity
            style={[
              styles.modeTogglePill,
              is3DMode ? styles.modeToggle3D : styles.modeToggle2D,
            ]}
            onPress={toggleCameraMode}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={is3DMode ? 'Chuyển sang Chế độ 2D' : 'Chuyển sang Chế độ 3D'}
          >
            <Layers color={is3DMode ? '#FFFFFF' : '#1F2937'} size={16} style={{ marginRight: 6 }} />
            <Text
              style={[
                styles.modeToggleText,
                is3DMode ? styles.modeToggleText3D : styles.modeToggleText2D,
              ]}
            >
              {is3DMode ? 'Chế độ 3D' : 'Chế độ 2D'}
            </Text>
          </TouchableOpacity>

          {/* Recenter Button */}
          <TouchableOpacity
            style={styles.floatingRoundButton}
            onPress={handleRecenter}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Căn giữa bản đồ"
          >
            <Locate color={followsUser ? '#2563EB' : '#4B5563'} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {/* FLOATING BOTTOM CARD (ENTERPRISE MASTER-DETAIL / GRAB STYLE) */}
      <View style={[styles.floatingCard, { bottom: insets.bottom + 16 }]}>
        {/* Header: Live Badge + ETA */}
        <View style={styles.cardHeader}>
          <View style={[styles.badgeLive, is3DMode && styles.badgeLive3D]}>
            <View style={[styles.pulsingDot, is3DMode && styles.pulsingDot3D]} />
            <Text style={[styles.badgeLiveText, is3DMode && styles.badgeLiveText3D]}>
              {is3DMode ? 'ĐANG DẪN ĐƯỜNG 3D' : 'TỔNG QUAN LỘ TRÌNH 2D'}
            </Text>
          </View>

          {isLoadingRoute ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : distanceKm && durationMin ? (
            <View style={styles.etaContainer}>
              <Clock color="#2563EB" size={14} style={{ marginRight: 4 }} />
              <Text style={styles.etaText}>
                {durationMin} phút ({distanceKm} km)
              </Text>
            </View>
          ) : null}
        </View>

        {/* Customer Information & Order Code */}
        <View style={styles.customerRow}>
          <View style={styles.iconCircle}>
            <User color="#4F46E5" size={18} />
          </View>
          <View style={styles.textColumn}>
            <View style={styles.nameAndCodeRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {customerName}
              </Text>
              {orderCode ? (
                <View style={styles.orderCodeBadge}>
                  <Text style={styles.orderCodeText}>{orderCode}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.customerSubtitle}>Khách hàng nhận đơn</Text>
          </View>

          {customerPhone ? (
            <TouchableOpacity
              style={styles.callButtonCircle}
              onPress={handleCallCustomer}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Gọi cho khách hàng"
            >
              <Phone color="#059669" size={18} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Address Information */}
        <View style={styles.addressRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
            <MapPin color="#EF4444" size={18} />
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.addressText} numberOfLines={2}>
              {address}
            </Text>
          </View>
        </View>

        {/* Prominent "ĐÃ ĐẾN NƠI" Button */}
        <TouchableOpacity
          style={styles.arrivedButton}
          onPress={handleArrived}
          disabled={isArriving}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Đã đến nơi"
        >
          {isArriving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <CheckCircle2 color="#FFFFFF" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.arrivedButtonText}>ĐÃ ĐẾN NƠI</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  floatingRoundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modeTogglePill: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modeToggle3D: {
    backgroundColor: '#2563EB',
  },
  modeToggle2D: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modeToggleText3D: {
    color: '#FFFFFF',
  },
  modeToggleText2D: {
    color: '#1F2937',
  },
  floatingCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: SIZES.radius_lg || 16,
    padding: SIZES.padding_md || 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeLive3D: {
    backgroundColor: '#EFF6FF',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  pulsingDot3D: {
    backgroundColor: '#2563EB',
  },
  badgeLiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.5,
  },
  badgeLiveText3D: {
    color: '#2563EB',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textColumn: {
    flex: 1,
  },
  nameAndCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginRight: 8,
  },
  orderCodeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orderCodeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  customerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  callButtonCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  addressText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  arrivedButton: {
    backgroundColor: '#10B981',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  arrivedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
