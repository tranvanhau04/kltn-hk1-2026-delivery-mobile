import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Phone,
  MessageCircle,
  ArrowLeft,
  Package,
  Wallet,
  Navigation,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import { CompositeNavigationProp, useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { OSMMapView } from '../../components/OSMMapView';
import { Platform } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { markStopArrivedApi, fetchStopDetailApi, ApiError } from '../../lib/api';
import { Stop, isNavigationDisabled } from '../../types/mobile';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';
import { MainTabParamList } from '../../navigation/MainTabNavigator';
import { getQueue } from '../../lib/offlineQueue';

type StopDetailNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<TaskStackParamList, 'StopDetail'>,
  BottomTabNavigationProp<MainTabParamList>
>;

export const StopDetailScreen = () => {
  const { stops, markStopArrived, refreshRoute } = useAppContext();
  const { token, logout } = useAuth();
  const navigation = useNavigation<StopDetailNavProp>();
  const route = useRoute<RouteProp<TaskStackParamList, 'StopDetail'>>();
  
  const [isArriving, setIsArriving] = useState(false);
  const [isPendingSync, setIsPendingSync] = useState(false);
  const [detailData, setDetailData] = useState<Stop | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Tự động kiểm tra thời gian thực mỗi 10s để mở khóa các nút tác nghiệp khi đến giờ hẹn
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);
  
  const stopId = route.params.stopId;

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      getQueue().then((queue) => {
        if (!isMounted) return;
        const exists = queue.some((a) => a.stopId === stopId && a.status === 'PENDING');
        setIsPendingSync(exists);
      });

      if (token) {
        fetchStopDetailApi(stopId, token)
          .then((res) => {
            if (!isMounted || !res?.data) return;
            const apiStop = res.data;
            const pod = apiStop.pod;
            const rescheduledDate =
              apiStop.rescheduledDate || apiStop.order?.rescheduledDate || pod?.rescheduledDate || null;
            const failureReason =
              apiStop.failureReason || apiStop.order?.failureReason || pod?.failureReason || null;
            const confirmedAt =
              apiStop.confirmedAt || apiStop.order?.confirmedAt || pod?.confirmedAt || null;

            setDetailData({
              id: apiStop.id,
              route_id: apiStop.routeId,
              order_id: apiStop.orderId,
              sequence_no: apiStop.sequenceNo,
              arrived_at: apiStop.arrivedAt,
              status: apiStop.status as Stop['status'],
              rescheduled_date: rescheduledDate,
              failure_reason: failureReason,
              confirmed_at: confirmedAt,
              pod: pod
                ? {
                    stop_id: pod.stopId || apiStop.id,
                    photo_url: pod.photoUrl || null,
                    cod_collected: Number(pod.codCollected) || 0,
                    failure_reason: pod.failureReason || null,
                    rescheduled_date: pod.rescheduledDate || null,
                    confirmed_at: pod.confirmedAt || '',
                  }
                : null,
              order: {
                id: apiStop.order?.id || apiStop.orderId,
                code: apiStop.order?.code || '',
                receiver_name: apiStop.order?.receiverName || 'Khách hàng',
                receiver_phone: apiStop.order?.receiverPhone || '',
                delivery_address: apiStop.order?.deliveryAddress || '',
                lat: Number(apiStop.order?.lat) || 10.8222,
                lng: Number(apiStop.order?.lng) || 106.6875,
                cod_amount: Number(apiStop.order?.codAmount) || 0,
                status: (apiStop.order?.status === 'DELIVERED'
                  ? 'DELIVERED'
                  : apiStop.order?.status === 'FAILED'
                  ? 'FAILED'
                  : apiStop.order?.status === 'RESCHEDULED'
                  ? 'RESCHEDULED'
                  : rescheduledDate
                  ? 'RESCHEDULED'
                  : 'PENDING') as Stop['order']['status'],
                rescheduled_date: rescheduledDate,
                failure_reason: failureReason,
                confirmed_at: confirmedAt,
              },
            });
          })
          .catch(() => {});
      }

      return () => {
        isMounted = false;
      };
    }, [stopId, token]),
  );

  const contextStop = stops.find((s) => s.id === stopId);
  const stop = detailData || contextStop;

  if (!stop) {
    return (
      <View style={[COMMON_STYLES.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Không tìm thấy điểm dừng</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: COLORS.primary }}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isNavDisabled = isNavigationDisabled(stop, currentTime);
  const isArrived = stop.status === 'ARRIVED';
  const isCompleted = stop.status === 'COMPLETED' || stop.order?.status === 'DELIVERED';
  const isRescheduled =
    !isArrived &&
    (stop.order?.status === 'RESCHEDULED' ||
      !!stop.rescheduled_date ||
      !!stop.order?.rescheduled_date ||
      (stop.status === 'SKIPPED' && !!(stop.failure_reason || stop.order?.failure_reason)));
  const isFailed = !isArrived && (stop.status === 'FAILED' || stop.order?.status === 'FAILED') && !isRescheduled;

  // Khi đơn Hẹn giao lại đã đến hoặc qua giờ hẹn (!isNavDisabled), mở khóa tác nghiệp (không còn terminal)
  const isRescheduledLocked = isRescheduled && isNavDisabled;
  const isTerminal =
    !isArrived &&
    (isCompleted ||
      isFailed ||
      isRescheduledLocked ||
      (stop.status === 'SKIPPED' && !isRescheduled));

  const formatDetailDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = d.getHours();
      const mins = String(d.getMinutes()).padStart(2, '0');
      if (hours === 0 && mins === '00') {
        return `Ngày ${day}/${month}/${year}`;
      }
      return `${String(hours).padStart(2, '0')}:${mins} - Ngày ${day}/${month}/${year}`;
    } catch {
      return String(dateStr);
    }
  };

  const formatRecordedTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${mins} ngày ${day}/${month}/${year}`;
    } catch {
      return String(dateStr);
    }
  };

  const rawRescheduleDate = stop.rescheduled_date || stop.order?.rescheduled_date;
  const rescheduleDateText = formatDetailDate(rawRescheduleDate);
  const rescheduleReason = stop.failure_reason || stop.order?.failure_reason;
  const confirmedAtText = formatRecordedTime(stop.confirmed_at || stop.order?.confirmed_at);

  const handleCall = () => {
    Linking.openURL(`tel:${stop.order.receiver_phone}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở ứng dụng gọi điện');
    });
  };

  const handleSMS = () => {
    Linking.openURL(`sms:${stop.order.receiver_phone}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở ứng dụng nhắn tin');
    });
  };

  const handleMarkArrived = () => {
    if (isArriving) return;

    Alert.alert(
      'Xác nhận đến nơi',
      `Bạn xác nhận đã có mặt tại địa chỉ giao hàng của đơn ${stop.order.code}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            if (!token) {
              Alert.alert('Lỗi xác thực', 'Phiên đăng nhập không tồn tại. Vui lòng đăng nhập lại.');
              return;
            }

            setIsArriving(true);
            try {
              const res = await markStopArrivedApi(stop.id, token);
              if (res.success) {
                markStopArrived(stop.id);
                setDetailData((prev) =>
                  prev ? { ...prev, status: 'ARRIVED', arrived_at: new Date().toISOString() } : null
                );
                await refreshRoute();
              }
            } catch (err: unknown) {
              if (err instanceof ApiError) {
                if (err.status === 401) {
                  Alert.alert('Phiên làm việc hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.', [
                    { text: 'Đồng ý', onPress: () => logout() },
                  ]);
                  return;
                }
                if (err.status === 409) {
                  Alert.alert('Thông báo', 'Điểm dừng này đã được xử lý trước đó.', [
                    { text: 'Làm mới', onPress: () => refreshRoute() },
                  ]);
                  return;
                }
                Alert.alert('Không thể cập nhật', err.message);
              } else {
                Alert.alert('Lỗi kết nối', 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
              }
            } finally {
              setIsArriving(false);
            }
          },
        },
      ]
    );
  };

  /** Navigate to LiveNavigationScreen for In-App Live Navigation 3D */
  const handleDirections = () => {
    if (!stop?.order?.lat || !stop?.order?.lng) {
      Alert.alert('Không có tọa độ GPS', 'Đơn hàng này chưa có tọa độ định vị để chỉ đường.');
      return;
    }
    navigation.navigate('LiveNavigationScreen', {
      destination: {
        latitude: stop.order.lat,
        longitude: stop.order.lng,
      },
      address: stop.order.delivery_address,
      customerName: stop.order.receiver_name,
      customerPhone: stop.order.receiver_phone,
      orderCode: stop.order.code,
      stopId: stop.id,
    });
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={TYPOGRAPHY.header}>{stop.order.code}</Text>
          <View
            style={[
              styles.badge,
              stop.status === 'ARRIVED' && { backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#7DD3FC' },
              stop.status === 'COMPLETED' && { backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC' },
              isFailed && { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' },
              isRescheduled && { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                stop.status === 'ARRIVED' && { color: '#0369A1' },
                stop.status === 'COMPLETED' && { color: '#15803D' },
                isFailed && { color: '#B91C1C' },
                isRescheduled && { color: '#B45309' },
              ]}
            >
              {stop.status === 'ARRIVED'
                ? 'Đã đến nơi'
                : stop.status === 'COMPLETED'
                ? 'Đã giao'
                : isFailed
                ? 'Giao thất bại'
                : isRescheduled
                ? '📅 Hẹn giao lại'
                : `Điểm ${stop.sequence_no}`}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 120 }}>
        {/* Customer Card */}
        <View style={COMMON_STYLES.card}>
          <Text style={TYPOGRAPHY.title}>Thông tin khách hàng</Text>
          <View style={styles.customerInfoRow}>
            <View style={{ flex: 1 }}>
              <Text style={[TYPOGRAPHY.body, { fontWeight: 'bold', marginTop: 8 }]}>
                {stop.order.receiver_name}
              </Text>
              <Text style={TYPOGRAPHY.bodySecondary}>{stop.order.receiver_phone}</Text>
            </View>
            <View style={styles.contactActions}>
              <TouchableOpacity style={[styles.actionCircle, { backgroundColor: '#16A34A', marginRight: 8 }]} onPress={handleCall}>
                <Phone color="#FFF" size={18} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionCircle, { backgroundColor: '#2563EB' }]} onPress={handleSMS}>
                <MessageCircle color="#FFF" size={18} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.addressContainer}>
            <MapPin color={COLORS.primary} size={20} style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={[TYPOGRAPHY.body, { flex: 1 }]}>{stop.order.delivery_address}</Text>
          </View>

          {/* Real Map / Fallback WebView */}
          <View style={{ marginTop: 16, width: '100%', height: 260, borderRadius: 16, overflow: 'hidden' }}>
            {Platform.OS === 'android' ? (
              <OSMMapView 
                latitude={Number(stop.order.lat) || 10.8222} 
                longitude={Number(stop.order.lng) || 106.6875} 
                targetCoord={{ latitude: Number(stop.order.lat), longitude: Number(stop.order.lng) }}
                style={{ flex: 1 }} 
              />
            ) : (
              <MapView
                style={{ flex: 1 }}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: stop.order.lat || 10.8222,
                  longitude: stop.order.lng || 106.6875,
                  latitudeDelta: 0.015,
                  longitudeDelta: 0.015,
                }}
              >
                <Marker coordinate={{ latitude: stop.order.lat, longitude: stop.order.lng }} />
              </MapView>
            )}
            
            <TouchableOpacity 
              style={[
                styles.openMapsBtn,
                { position: 'absolute', bottom: 12, left: '15%', width: '70%', justifyContent: 'center', alignItems: 'center' },
                isNavDisabled && styles.openMapsBtnDisabled,
              ]} 
              onPress={handleDirections}
              disabled={isNavDisabled}
              activeOpacity={0.7}
            >
              <Navigation color={isNavDisabled ? '#E2E8F0' : '#FFF'} size={14} />
              <Text style={[styles.openMapsBtnText, isNavDisabled && styles.openMapsBtnTextDisabled]}>
                {isNavDisabled && isRescheduled
                  ? 'Chưa đến giờ hẹn'
                  : isNavDisabled && isCompleted
                  ? 'Đã hoàn thành'
                  : isNavDisabled && isFailed
                  ? 'Giao thất bại'
                  : 'Bắt đầu di chuyển'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Package & COD Summary */}
        <View style={COMMON_STYLES.card}>
          <Text style={TYPOGRAPHY.title}>Thông tin đơn hàng</Text>
          
          <View style={styles.infoRow}>
            <Package color={COLORS.textSecondary} size={20} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={TYPOGRAPHY.body}>Kiện hàng</Text>
              {(stop.order.weight_kg || stop.order.volume_m3) ? (
                <Text style={TYPOGRAPHY.bodySecondary}>
                  {stop.order.weight_kg ? `${stop.order.weight_kg} kg` : ''}
                  {stop.order.weight_kg && stop.order.volume_m3 ? '  ·  ' : ''}
                  {stop.order.volume_m3 ? `${(stop.order.volume_m3 * 1000).toFixed(1)} L` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 12 }]}>
            <Wallet color={COLORS.primary} size={20} />
            <View style={{ marginLeft: 8 }}>
              <Text style={TYPOGRAPHY.bodySecondary}>
                {stop.order.cod_amount > 0 ? 'Số tiền COD cần thu' : 'Đã thanh toán trước'}
              </Text>
              <Text style={[TYPOGRAPHY.header, { color: stop.order.cod_amount > 0 ? COLORS.primary : COLORS.success }]}>
                {stop.order.cod_amount > 0
                  ? `${stop.order.cod_amount.toLocaleString('vi-VN')} ₫`
                  : '✓ Không cần thu COD'}
              </Text>
            </View>
          </View>
        </View>

        {/* Rescheduled Information Card */}
        {isRescheduled && (
          <View style={[COMMON_STYLES.card, styles.rescheduleCard]}>
            <View style={styles.rescheduleCardHeader}>
              <View style={styles.rescheduleHeaderLeft}>
                <Clock color="#D97706" size={18} style={{ marginRight: 8 }} />
                <Text style={[TYPOGRAPHY.title, { color: '#92400E' }]}>
                  Thông tin hẹn giao lại
                </Text>
              </View>
              <View style={styles.rescheduleBadge}>
                <Text style={styles.rescheduleBadgeText}>Tạm hoãn</Text>
              </View>
            </View>

            <View style={styles.rescheduleInfoRow}>
              <Calendar color="#D97706" size={16} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rescheduleFieldLabel}>Thời gian hẹn giao lại:</Text>
                <Text style={styles.rescheduleFieldValue}>
                  {rescheduleDateText || 'Chưa xác định thời gian cụ thể'}
                </Text>
              </View>
            </View>

            {rescheduleReason ? (
              <View style={[styles.rescheduleInfoRow, { marginTop: 10 }]}>
                <AlertCircle color="#D97706" size={16} style={{ marginRight: 8, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rescheduleFieldLabel}>Lý do / Ghi chú:</Text>
                  <Text style={styles.rescheduleFieldValue}>{rescheduleReason}</Text>
                </View>
              </View>
            ) : null}

            {confirmedAtText ? (
              <View
                style={[
                  styles.rescheduleInfoRow,
                  { marginTop: 10, borderTopWidth: 1, borderTopColor: '#FDE68A', paddingTop: 8 },
                ]}
              >
                <Text style={styles.rescheduleRecordedText}>
                  Thời điểm ghi nhận: {confirmedAtText}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Failed Information Card (if failed and not rescheduled) */}
        {!isRescheduled && isFailed && rescheduleReason && (
          <View style={[COMMON_STYLES.card, styles.failureCard]}>
            <View style={styles.failureCardHeader}>
              <AlertCircle color="#DC2626" size={18} style={{ marginRight: 8 }} />
              <Text style={[TYPOGRAPHY.title, { color: '#991B1B' }]}>
                Thông tin giao thất bại
              </Text>
            </View>

            <View style={[styles.rescheduleInfoRow, { marginTop: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rescheduleFieldLabel, { color: '#991B1B' }]}>
                  Lý do thất bại:
                </Text>
                <Text style={[styles.rescheduleFieldValue, { color: '#7F1D1D' }]}>
                  {rescheduleReason}
                </Text>
              </View>
            </View>

            {confirmedAtText ? (
              <View
                style={[
                  styles.rescheduleInfoRow,
                  { marginTop: 10, borderTopWidth: 1, borderTopColor: '#FECACA', paddingTop: 8 },
                ]}
              >
                <Text style={[styles.rescheduleRecordedText, { color: '#991B1B' }]}>
                  Thời điểm ghi nhận: {confirmedAtText}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons Footer */}
      <View style={styles.footer}>
        {isPendingSync ? (
          <View style={styles.terminalContainer}>
            <View style={[styles.terminalBanner, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
              <RotateCcw color="#D97706" size={18} />
              <Text style={[styles.terminalText, { color: '#B45309' }]}>
                Đơn hàng đang chờ đồng bộ tự động lên máy chủ
              </Text>
            </View>
          </View>
        ) : isArrived ? (
          <View style={styles.arrivedActions}>
            <TouchableOpacity 
              style={[COMMON_STYLES.successButton, { flex: 1, marginRight: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
              onPress={() => navigation.navigate('PODCompletion', { stopId: stop.id })}
            >
              <CheckCircle2 color="#FFF" size={16} />
              <Text style={TYPOGRAPHY.buttonText}>Giao thành công</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[COMMON_STYLES.dangerButton, { flex: 1, marginLeft: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
              onPress={() => navigation.navigate('DeliveryFailure', { stopId: stop.id })}
            >
              <XCircle color={COLORS.danger} size={16} />
              <Text style={COMMON_STYLES.dangerButtonText}>Báo thất bại</Text>
            </TouchableOpacity>
          </View>
        ) : isTerminal ? (
          <View style={styles.terminalContainer}>
            {stop.status === 'COMPLETED' ? (
              <View style={[styles.terminalBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <CheckCircle2 color={COLORS.success} size={18} />
                <Text style={[styles.terminalText, { color: '#065F46' }]}>
                  Đơn hàng đã được giao thành công
                </Text>
              </View>
            ) : stop.status === 'FAILED' && !isRescheduled ? (
              <View style={[styles.terminalBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <XCircle color={COLORS.danger} size={18} />
                <Text style={[styles.terminalText, { color: '#991B1B' }]}>
                  Đơn hàng giao thất bại
                </Text>
              </View>
            ) : isRescheduled ? (
              <View style={[styles.terminalBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Clock color="#D97706" size={18} />
                <Text style={[styles.terminalText, { color: '#B45309' }]}>
                  {rescheduleDateText
                    ? `Đã hẹn giao lại: ${rescheduleDateText} (Chưa đến giờ)`
                    : 'Đơn hàng đã được hẹn giao lại'}
                </Text>
              </View>
            ) : (
              <View style={[styles.terminalBanner, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                <Text style={[styles.terminalText, { color: '#374151' }]}>
                  Đơn hàng đã được bỏ qua
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.footerActions}>
            {/* Chỉ đường button */}
            <TouchableOpacity
              style={[
                COMMON_STYLES.primaryButton,
                styles.directionsButton,
                isNavDisabled && styles.directionsButtonDisabled,
              ]}
              onPress={handleDirections}
              disabled={isArriving || isNavDisabled}
            >
              <Navigation color="#FFF" size={18} style={{ marginRight: 8 }} />
              <Text style={TYPOGRAPHY.buttonText}>Chỉ đường</Text>
            </TouchableOpacity>

            {/* Mark arrived button */}
            <TouchableOpacity
              style={[COMMON_STYLES.primaryButton, styles.arrivedButton, isArriving && { opacity: 0.7 }]}
              onPress={handleMarkArrived}
              disabled={isArriving}
            >
              {isArriving ? (
                <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 8 }} />
              ) : (
                <MapPin color="#FFF" size={18} style={{ marginRight: 8 }} />
              )}
              <Text style={TYPOGRAPHY.buttonText}>{isArriving ? 'ĐANG GỬI...' : 'ĐÃ ĐẾN NƠI'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: SIZES.radius_sm,
  },
  badgeText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: 'bold',
  },
  customerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: SIZES.radius_md,
    marginBottom: 16,
  },
  mapThumbnail: {
    height: 130,
    backgroundColor: '#E5E7EB',
    borderRadius: SIZES.radius_md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  openMapsBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  openMapsBtnDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.94)',
    shadowOpacity: 0.1,
    elevation: 1,
  },
  openMapsBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  openMapsBtnTextDisabled: {
    color: '#F8FAFC',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SIZES.padding_md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 24,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: '#1D4ED8',
  },
  directionsButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  arrivedButton: {
    flex: 1,
  },
  arrivedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  terminalContainer: {
    width: '100%',
  },
  terminalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: SIZES.radius_md,
    borderWidth: 1,
    gap: 8,
  },
  terminalText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rescheduleCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    marginTop: SIZES.padding_md,
  },
  rescheduleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rescheduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rescheduleBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rescheduleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  rescheduleInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rescheduleFieldLabel: {
    fontSize: 12,
    color: '#78350F',
    fontWeight: '500',
    marginBottom: 2,
  },
  rescheduleFieldValue: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '700',
  },
  rescheduleRecordedText: {
    fontSize: 11,
    color: '#B45309',
    fontStyle: 'italic',
  },
  failureCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    marginTop: SIZES.padding_md,
  },
  failureCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
});
