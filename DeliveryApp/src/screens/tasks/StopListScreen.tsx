import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navigation, Phone, ChevronRight, CheckCircle2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';

export const StopListScreen = () => {
  const { stops } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<TaskStackParamList>>();

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to open dialer');
    });
  };

  const activeStops = stops.filter(s => s.status !== 'COMPLETED' && s.status !== 'FAILED');

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={TYPOGRAPHY.header}>Active Route</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>In Progress</Text>
          </View>
        </View>
        <Text style={TYPOGRAPHY.bodySecondary}>{activeStops.length} stops remaining</Text>
      </View>

      <FlatList
        data={stops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SIZES.padding_md }}
        renderItem={({ item }) => {
          const isDone = item.status === 'COMPLETED' || item.status === 'FAILED';
          const isPending = item.status === 'PENDING';
          const isArrived = item.status === 'ARRIVED';

          return (
            <TouchableOpacity
              style={[COMMON_STYLES.card, isDone && { opacity: 0.6 }]}
              onPress={() => navigation.navigate('StopDetail', { stopId: item.id })}
              disabled={isDone}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.sequenceBadge}>
                  <Text style={styles.sequenceText}>{item.sequence_no}</Text>
                </View>
                <View style={styles.cardTitleContainer}>
                  <Text style={TYPOGRAPHY.title}>{item.order.code}</Text>
                  {isDone ? (
                    <Text style={[TYPOGRAPHY.bodySecondary, { color: item.status === 'COMPLETED' ? COLORS.success : COLORS.danger }]}>
                      {item.status}
                    </Text>
                  ) : (
                    <Text style={TYPOGRAPHY.bodySecondary}>{isArrived ? 'Arrived' : 'Pending'}</Text>
                  )}
                </View>
                {isDone ? (
                  <CheckCircle2 color={item.status === 'COMPLETED' ? COLORS.success : COLORS.danger} size={24} />
                ) : (
                  <ChevronRight color={COLORS.inactive} size={24} />
                )}
              </View>

              <Text style={[TYPOGRAPHY.body, styles.address]} numberOfLines={2}>
                {item.order.delivery_address}
              </Text>

              {!isDone && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
                    <Navigation color={COLORS.primary} size={20} />
                    <Text style={styles.actionButtonText}>Navigate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleCall(item.order.receiver_phone)}>
                    <Phone color={COLORS.primary} size={20} />
                    <Text style={styles.actionButtonText}>Call</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: SIZES.padding_md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#E0F2FE', // Light blue
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: SIZES.radius_sm,
  },
  badgeText: {
    color: '#0284C7', // Dark blue
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sequenceBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sequenceText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardTitleContainer: {
    flex: 1,
  },
  address: {
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    marginLeft: 8,
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
