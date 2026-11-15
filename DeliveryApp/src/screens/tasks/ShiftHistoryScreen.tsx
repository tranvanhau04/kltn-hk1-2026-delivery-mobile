import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Wallet,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { fetchShiftHistoryApi, ApiShiftHistoryItem } from '../../lib/api';

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  OPEN: {
    label: 'Đang hoạt động',
    bg: '#ECFDF5',
    text: '#059669',
    icon: <Clock3 size={13} color="#059669" />,
  },
  PENDING_SETTLEMENT: {
    label: 'Chờ thủ quỹ duyệt',
    bg: '#FFFBEB',
    text: '#D97706',
    icon: <AlertCircle size={13} color="#D97706" />,
  },
  CLOSED: {
    label: 'Đã đối soát xong',
    bg: '#EFF6FF',
    text: '#2563EB',
    icon: <CheckCircle2 size={13} color="#2563EB" />,
  },
};

export const ShiftHistoryScreen = () => {
  const navigation = useNavigation();
  const { token } = useAuth();

  const [shifts, setShifts] = useState<ApiShiftHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const loadHistory = useCallback(
    async (targetPage = 1, refreshing = false) => {
      if (!token) return;
      if (refreshing) setIsRefreshing(true);
      else if (targetPage === 1) setIsLoading(true);

      try {
        const res = await fetchShiftHistoryApi(token, targetPage, 20);
        if (res && res.success) {
          setShifts(res.items);
          setTotal(res.total);
          setPage(res.page);
        }
      } catch (err) {
        console.warn('[ShiftHistoryScreen] Load history error:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  const onRefresh = () => {
    loadHistory(1, true);
  };

  const formatVnd = (amount: number) => {
    return `${Number(amount || 0).toLocaleString('vi-VN')} đ`;
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '–';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  const formatTimeOnly = (dateStr?: string | null) => {
    if (!dateStr) return '–';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return '–';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const renderShiftItem = ({ item }: { item: ApiShiftHistoryItem }) => {
    const cfg = statusConfig[item.status] || statusConfig.CLOSED;
    const diff = item.codDifference;
    const isMatched = diff === 0;
    const isDeficit = diff > 0; // thu nhiều hơn nộp -> nộp thiếu
    const isSurplus = diff < 0; // nộp nhiều hơn thu -> nộp dư

    return (
      <View style={styles.card}>
        {/* Header: Date + Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.dateBlock}>
            <Calendar size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.dateText}>{formatDateOnly(item.startTime)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            {cfg.icon}
            <Text style={[styles.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Shift Time Frame */}
        <View style={styles.timeRow}>
          <Clock size={13} color={COLORS.textSecondary} style={{ marginRight: 5 }} />
          <Text style={styles.timeText}>
            Thời gian: {formatTimeOnly(item.startTime)} – {item.endTime ? formatTimeOnly(item.endTime) : 'Đang mở'}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* COD Financial Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>COD Đã thu</Text>
            <Text style={styles.metricValue}>{formatVnd(item.codCollected)}</Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>COD Thực nộp</Text>
            <Text style={[styles.metricValue, { color: COLORS.textPrimary }]}>
              {formatVnd(item.codSubmitted)}
            </Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Chênh lệch</Text>
            <Text
              style={[
                styles.metricValue,
                isMatched
                  ? { color: COLORS.success }
                  : isDeficit
                  ? { color: COLORS.danger }
                  : { color: '#2563EB' },
              ]}
            >
              {isMatched ? '0 đ (Khớp)' : isDeficit ? `-${formatVnd(diff)}` : `+${formatVnd(Math.abs(diff))}`}
            </Text>
          </View>
        </View>

        {/* Settlement Info (When reconciled) */}
        {item.reconciledAt && (
          <View style={styles.reconciledBanner}>
            <ShieldCheck size={14} color="#059669" style={{ marginRight: 6 }} />
            <Text style={styles.reconciledText}>
              Đã duyệt bởi {item.reconciledByName || 'Thủ quỹ'} • {formatDateTime(item.reconciledAt)}
            </Text>
          </View>
        )}

        {/* Discrepancy Alert */}
        {item.status === 'PENDING_SETTLEMENT' && isDeficit && (
          <View style={styles.discrepancyAlert}>
            <TrendingDown size={14} color={COLORS.danger} style={{ marginRight: 6 }} />
            <Text style={styles.discrepancyText}>
              Nộp thiếu {formatVnd(diff)}. Đang chờ thủ quỹ xác nhận giải trình.
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[COMMON_STYLES.container, { backgroundColor: '#F9FAFB' }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử Ca & Đối soát COD</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Subheader info */}
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>
          Tổng số ca đã ghi nhận: <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{total}</Text>
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải lịch sử ca làm việc...</Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          renderItem={renderShiftItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Wallet size={48} color={COLORS.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Chưa có lịch sử ca làm việc</Text>
              <Text style={styles.emptySubtitle}>
                Các ca làm việc sau khi bạn bấm chốt ca sẽ được lưu và hiển thị tại đây.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding_md,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  subHeader: {
    paddingHorizontal: SIZES.padding_md,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
  },
  subHeaderText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: SIZES.padding_md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius_md,
    padding: SIZES.padding_md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  reconciledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  reconciledText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '500',
  },
  discrepancyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  discrepancyText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 18,
  },
});
