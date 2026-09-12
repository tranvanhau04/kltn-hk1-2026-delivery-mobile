import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Phone, ArrowLeft, Package, Wallet, Navigation } from 'lucide-react-native';
import { CompositeNavigationProp, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { OSMMapView } from '../../components/OSMMapView';
import { Platform } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';
import { MainTabParamList } from '../../navigation/MainTabNavigator';

type StopDetailNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<TaskStackParamList, 'StopDetail'>,
  BottomTabNavigationProp<MainTabParamList>
>;

export const StopDetailScreen = () => {
  const { stops, markStopArrived } = useAppContext();
  const navigation = useNavigation<StopDetailNavProp>();
  const route = useRoute<RouteProp<TaskStackParamList, 'StopDetail'>>();
  
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

  const handleCall = () => {
    Linking.openURL(`tel:${stop.order.receiver_phone}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở ứng dụng gọi điện');
    });
  };

  const handleMarkArrived = () => {
    markStopArrived(stop.id);
  };

  /** Navigate to TrackScreen for In-App Navigation */
  const handleDirections = () => {
    navigation.navigate('Track', {
      selectedStopId: stop.id,
      destLat: stop.order.lat,
      destLng: stop.order.lng,
      address: stop.order.delivery_address,
      customerName: stop.order.receiver_name,
      autoStartNavigation: true,
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
            <TouchableOpacity style={styles.callCircle} onPress={handleCall}>
              <Phone color="#FFF" size={20} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.addressContainer}>
            <MapPin color={COLORS.primary} size={20} style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={[TYPOGRAPHY.body, { flex: 1 }]}>{stop.order.delivery_address}</Text>
          </View>

          {/* Real Map / Fallback WebView */}
          <View style={{ marginTop: 16, width: '100%', height: 260, borderRadius: 16, overflow: 'hidden' }}>
            {Platform.OS === 'android' ? (
              <OSMMapView 
                latitude={stop.order.lat || 10.8222} 
                longitude={stop.order.lng || 106.6875} 
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
            <Text style={[TYPOGRAPHY.body, { marginLeft: 8, flex: 1 }]}>Kiện hàng tiêu chuẩn</Text>
          </View>

          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 12 }]}>
            <Wallet color={COLORS.primary} size={20} />
            <View style={{ marginLeft: 8 }}>
              <Text style={TYPOGRAPHY.bodySecondary}>
                {stop.order.cod_amount > 0 ? 'Số tiền COD cần thu' : 'Đã thanh toán trước'}
              </Text>
              <Text style={[TYPOGRAPHY.header, { color: stop.order.cod_amount > 0 ? COLORS.primary : COLORS.success }]}>
                {stop.order.cod_amount > 0
                  ? `${stop.order.cod_amount.toLocaleString('vi-VN')} VND`
                  : '✓ Không cần thu COD'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons Footer */}
      <View style={styles.footer}>
        {!isArrived ? (
          <View style={styles.footerActions}>
            {/* Chỉ đường button */}
            <TouchableOpacity
              style={[COMMON_STYLES.primaryButton, styles.directionsButton]}
              onPress={handleDirections}
            >
              <Navigation color="#FFF" size={18} style={{ marginRight: 8 }} />
              <Text style={TYPOGRAPHY.buttonText}>Chỉ đường</Text>
            </TouchableOpacity>

            {/* Mark arrived button */}
            <TouchableOpacity
              style={[COMMON_STYLES.primaryButton, styles.arrivedButton]}
              onPress={handleMarkArrived}
            >
              <MapPin color="#FFF" size={18} style={{ marginRight: 8 }} />
              <Text style={TYPOGRAPHY.buttonText}>Đã đến nơi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.arrivedActions}>
            <TouchableOpacity 
              style={[COMMON_STYLES.successButton, { flex: 1, marginRight: 8 }]}
              onPress={() => navigation.navigate('PODCompletion', { stopId: stop.id })}
            >
              <Text style={TYPOGRAPHY.buttonText}>GIAO THÀNH CÔNG</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[COMMON_STYLES.dangerButton, { flex: 1, marginLeft: 8 }]}
              onPress={() => navigation.navigate('DeliveryFailure', { stopId: stop.id })}
            >
              <Text style={COMMON_STYLES.dangerButtonText}>GIAO THẤT BẠI</Text>
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
  callCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.success,
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
});
