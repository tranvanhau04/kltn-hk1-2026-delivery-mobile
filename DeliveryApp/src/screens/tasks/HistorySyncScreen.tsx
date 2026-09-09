import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';

export const HistorySyncScreen = () => {
  const { stops } = useAppContext();
  const navigation = useNavigation();

  const completedStops = stops.filter(s => s.status === 'COMPLETED' || s.status === 'FAILED');
  const offlineQueueCount = 2; // Mock offline sync queue

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={TYPOGRAPHY.header}>Sync History</Text>
      </View>

      {/* Offline Banner */}
      <View style={styles.syncBanner}>
        <View style={styles.syncInfo}>
          <RefreshCw color="#D97706" size={20} />
          <Text style={styles.syncText}>{offlineQueueCount} stops queued for offline sync</Text>
        </View>
        <TouchableOpacity style={styles.syncButton}>
          <Text style={styles.syncButtonText}>Sync Now</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={completedStops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SIZES.padding_md }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={TYPOGRAPHY.bodySecondary}>No completed deliveries today</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={COMMON_STYLES.card}>
            <View style={styles.itemHeader}>
              <Text style={TYPOGRAPHY.title}>{item.order.code}</Text>
              {item.status === 'COMPLETED' ? (
                <View style={styles.statusBadgeSuccess}>
                  <CheckCircle2 color={COLORS.success} size={14} style={{ marginRight: 4 }} />
                  <Text style={styles.statusTextSuccess}>DELIVERED</Text>
                </View>
              ) : (
                <View style={styles.statusBadgeFailed}>
                  <XCircle color={COLORS.danger} size={14} style={{ marginRight: 4 }} />
                  <Text style={styles.statusTextFailed}>FAILED</Text>
                </View>
              )}
            </View>
            <Text style={[TYPOGRAPHY.bodySecondary, { marginTop: 8 }]}>{item.order.delivery_address}</Text>
          </View>
        )}
      />
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
  syncBanner: {
    backgroundColor: '#FEF3C7',
    padding: SIZES.padding_md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncText: {
    color: '#B45309',
    fontWeight: '500',
    marginLeft: 8,
  },
  syncButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: SIZES.radius_sm,
  },
  syncButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextSuccess: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadgeFailed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextFailed: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  }
});
