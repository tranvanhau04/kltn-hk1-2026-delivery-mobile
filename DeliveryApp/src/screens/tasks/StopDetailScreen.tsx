import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Phone, ArrowLeft, Package, Wallet } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';

export const StopDetailScreen = () => {
  const { stops, markStopArrived } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<TaskStackParamList>>();
  const route = useRoute<RouteProp<TaskStackParamList, 'StopDetail'>>();
  
  const stopId = route.params.stopId;
  const stop = stops.find(s => s.id === stopId);

  if (!stop) {
    return (
      <View style={[COMMON_STYLES.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Stop not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: COLORS.primary }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isArrived = stop.status === 'ARRIVED';

  const handleCall = () => {
    Linking.openURL(`tel:${stop.order.receiver_phone}`).catch(() => {
      Alert.alert('Error', 'Unable to open dialer');
    });
  };

  const handleMarkArrived = () => {
    markStopArrived(stop.id);
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
            <Text style={styles.badgeText}>Next Stop</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 100 }}>
        {/* Customer Card */}
        <View style={COMMON_STYLES.card}>
          <Text style={TYPOGRAPHY.title}>Customer Details</Text>
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

          {/* Map Thumbnail Placeholder */}
          <View style={styles.mapThumbnail}>
            <MapPin color={COLORS.textSecondary} size={32} />
            <Text style={TYPOGRAPHY.bodySecondary}>Map Preview</Text>
          </View>
        </View>

        {/* Package & COD Summary */}
        <View style={COMMON_STYLES.card}>
          <Text style={TYPOGRAPHY.title}>Package Info</Text>
          
          <View style={styles.infoRow}>
            <Package color={COLORS.textSecondary} size={20} />
            <Text style={[TYPOGRAPHY.body, { marginLeft: 8, flex: 1 }]}>Standard Delivery Box</Text>
          </View>

          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 12 }]}>
            <Wallet color={COLORS.primary} size={20} />
            <View style={{ marginLeft: 8 }}>
              <Text style={TYPOGRAPHY.bodySecondary}>COD Amount to Collect</Text>
              <Text style={[TYPOGRAPHY.header, { color: COLORS.primary }]}>
                {stop.order.cod_amount.toLocaleString('vi-VN')} VND
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons Footer */}
      <View style={styles.footer}>
        {!isArrived ? (
          <TouchableOpacity style={COMMON_STYLES.primaryButton} onPress={handleMarkArrived}>
            <MapPin color="#FFF" size={20} style={{ marginRight: 8 }} />
            <Text style={TYPOGRAPHY.buttonText}>MARK AS ARRIVED</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.arrivedActions}>
            <TouchableOpacity 
              style={[COMMON_STYLES.successButton, { flex: 1, marginRight: 8 }]}
              onPress={() => navigation.navigate('PODCompletion', { stopId: stop.id })}
            >
              <Text style={TYPOGRAPHY.buttonText}>DELIVER SUCCESS</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[COMMON_STYLES.dangerButton, { flex: 1, marginLeft: 8 }]}
              onPress={() => navigation.navigate('DeliveryFailure', { stopId: stop.id })}
            >
              <Text style={COMMON_STYLES.dangerButtonText}>DELIVER FAILED</Text>
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
    backgroundColor: '#FEF3C7', // amber-100
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: SIZES.radius_sm,
  },
  badgeText: {
    color: '#D97706', // amber-600
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
    height: 120,
    backgroundColor: '#E5E7EB',
    borderRadius: SIZES.radius_md,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: 24, // extra padding for bottom area
  },
  arrivedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
