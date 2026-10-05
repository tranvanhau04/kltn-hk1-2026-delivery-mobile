import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Phone, MessageCircle, ArrowLeft, Package, Wallet, Navigation, CheckCircle2, XCircle } from 'lucide-react-native';
import { CompositeNavigationProp, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { OSMMapView } from '../../components/OSMMapView';
import { Platform } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { markStopArrivedApi, ApiError } from '../../lib/api';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';
import { MainTabParamList } from '../../navigation/MainTabNavigator';

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
  
  const stopId = route.params.stopId;
  const stop = stops.find(s => s.id === stopId);

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

  const isArrived = stop.status === 'ARRIVED';
  const isTerminal = ['COMPLETED', 'FAILED', 'SKIPPED'].includes(stop.status);

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

  /** Navigate to TrackScreen for In-App Navigation */
  const handleDirections = () => {
    navigation.navigate('Track', {
      selectedStopId: stop.id,
      destLat: stop.order.lat,
      destLng: stop.order.lng,
      address: stop.order.delivery_address,
      customerName: stop.order.receiver_name,
      autoStartNavigation: false,
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
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {stop.status === 'ARRIVED' ? 'Đã đến nơi' : `Điểm ${stop.sequence_no}`}
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
              style={[styles.openMapsBtn, { position: 'absolute', bottom: 12, left: '25%', width: '50%' }]} 
              onPress={handleDirections}
            >
              <Navigation color="#FFF" size={14} />
              <Text style={styles.openMapsBtnText}>Bắt đầu di chuyển</Text>
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
      </ScrollView>

      {/* Action Buttons Footer */}
      <View style={styles.footer}>
        {isTerminal ? (
          <View style={styles.terminalContainer}>
            {stop.status === 'COMPLETED' ? (
              <View style={[styles.terminalBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <CheckCircle2 color={COLORS.success} size={18} />
                <Text style={[styles.terminalText, { color: '#065F46' }]}>
                  Đơn hàng đã được giao thành công
                </Text>
              </View>
            ) : stop.status === 'FAILED' ? (
              <View style={[styles.terminalBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <XCircle color={COLORS.danger} size={18} />
                <Text style={[styles.terminalText, { color: '#991B1B' }]}>
                  Đơn hàng giao thất bại
                </Text>
              </View>
            ) : (
              <View style={[styles.terminalBanner, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                <Text style={[styles.terminalText, { color: '#374151' }]}>
                  Đơn hàng đã được hẹn lại / bỏ qua
                </Text>
              </View>
            )}
          </View>
        ) : !isArrived ? (
          <View style={styles.footerActions}>
            {/* Chỉ đường button */}
            <TouchableOpacity
              style={[COMMON_STYLES.primaryButton, styles.directionsButton]}
              onPress={handleDirections}
              disabled={isArriving}
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
        ) : (
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
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginTop: 4,
  },
  openMapsBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
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
});
