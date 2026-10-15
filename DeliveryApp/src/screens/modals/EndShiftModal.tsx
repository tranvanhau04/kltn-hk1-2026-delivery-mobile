import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, AlertCircle, Info } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';
import {
  closeShiftApi,
  fetchShiftSummaryApi,
  isApiError,
  ApiShiftSummaryResponse,
} from '../../lib/api';

export const EndShiftModal = () => {
  const { shift, stops, setDriver, setShift } = useAppContext();
  const { token } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [codSubmittedText, setCodSubmittedText] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [summary, setSummary] = useState<ApiShiftSummaryResponse | null>(null);

  // Load live shift summary from backend on mount
  useEffect(() => {
    let isMounted = true;
    if (token) {
      setIsLoadingSummary(true);
      fetchShiftSummaryApi(token)
        .then((data) => {
          if (isMounted) {
            setSummary(data);
          }
        })
        .catch((err) => {
          console.warn('[EndShiftModal] Error fetching shift summary:', err);
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingSummary(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Order performance metrics
  const assigned = summary?.assignedOrdersCount ?? stops.length;
  const delivered = summary?.deliveredOrdersCount ?? stops.filter((s) => s.status === 'COMPLETED').length;
  const failed = summary?.failedOrdersCount ?? stops.filter((s) => s.status === 'FAILED').length;
  const pendingStops = stops.filter((s) => s.status === 'PENDING' || s.status === 'ARRIVED').length;

  // Expected system COD
  const systemCod = summary?.pendingCodAmount ?? shift?.cod_collected ?? 0;

  // Real-time parsed submitted COD & discrepancy
  const numericSubmitted = useMemo(() => {
    const cleaned = codSubmittedText.replace(/\D/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  }, [codSubmittedText]);

  const hasEnteredCod = codSubmittedText.trim().length > 0;
  const codDifference = systemCod - numericSubmitted; // > 0: thiếu, < 0: dư, 0: khớp

  // Format currency display helper
  const formatVnd = (amount: number) => {
    return `${Math.abs(amount).toLocaleString('vi-VN')} VND`;
  };

  const handleCodInputChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '');
    if (!digitsOnly) {
      setCodSubmittedText('');
      return;
    }
    const num = parseInt(digitsOnly, 10);
    setCodSubmittedText(num.toLocaleString('vi-VN'));
  };

  const executeCloseShift = async () => {
    const targetShiftId = shift?.id || summary?.activeShift?.id;
    if (!targetShiftId) {
      Alert.alert('Lỗi', 'Không tìm thấy ID ca làm việc cần đóng.');
      return;
    }

    if (!token) {
      Alert.alert('Lỗi phiên đăng nhập', 'Không tìm thấy token xác thực. Vui lòng đăng nhập lại.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await closeShiftApi(targetShiftId, numericSubmitted, notes, token);

      // Cập nhật trạng thái tài xế sang OFFLINE
      setDriver((prev) => ({
        ...prev,
        current_shift_status: 'OFFLINE',
      }));

      // Cập nhật trạng thái ca làm việc sang PENDING_SETTLEMENT
      if (shift) {
        setShift({
          ...shift,
          status: 'PENDING_SETTLEMENT',
          cod_submitted: numericSubmitted,
          end_time: result.shift?.endTime || new Date().toISOString(),
        });
      }

      Alert.alert(
        'Đóng ca thành công',
        result.message || 'Ca làm việc đã chuyển sang trạng thái chờ đối soát thủ quỹ.',
        [
          {
            text: 'Đồng ý',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (err) {
      const msg = isApiError(err) ? err.message : 'Không thể đóng ca trên hệ thống. Vui lòng thử lại sau.';
      Alert.alert('Đóng ca thất bại', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = () => {
    if (!hasEnteredCod) {
      Alert.alert('Chưa nhập số tiền', 'Vui lòng nhập số tiền COD thực tế bạn nộp về két thủ quỹ.');
      return;
    }

    if (codDifference !== 0) {
      const diffType = codDifference > 0 ? 'THIẾU' : 'DƯ';
      Alert.alert(
        'Xác nhận chênh lệch COD',
        `Số tiền thực nộp đang ${diffType} ${formatVnd(codDifference)} so với tiền hệ thống ghi nhận (${formatVnd(systemCod)}).\n\nBạn có chắc chắn muốn xác nhận đóng ca với số tiền này không?`,
        [
          { text: 'Kiểm tra lại', style: 'cancel' },
          {
            text: 'Xác nhận nộp',
            style: 'destructive',
            onPress: () => {
              void executeCloseShift();
            },
          },
        ],
      );
    } else {
      void executeCloseShift();
    }
  };

  return (
    <SafeAreaView style={[COMMON_STYLES.container, { backgroundColor: '#F3F4F6' }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={TYPOGRAPHY.header}>Chốt ca làm việc</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 130 }}>
          {/* Card 1: Performance Summary */}
          <View style={COMMON_STYLES.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={TYPOGRAPHY.title}>Hiệu suất ca làm</Text>
              {isLoadingSummary && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={TYPOGRAPHY.header}>{assigned}</Text>
                <Text style={TYPOGRAPHY.bodySecondary}>Đã phân công</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[TYPOGRAPHY.header, { color: COLORS.success }]}>{delivered}</Text>
                <Text style={TYPOGRAPHY.bodySecondary}>Đã giao</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[TYPOGRAPHY.header, { color: COLORS.danger }]}>{failed}</Text>
                <Text style={TYPOGRAPHY.bodySecondary}>Thất bại</Text>
              </View>
            </View>
          </View>

          {/* Card 2: COD Reconciliation */}
          <View style={COMMON_STYLES.card}>
            <Text style={TYPOGRAPHY.title}>Đối soát COD Cuối ca</Text>

            <View style={styles.codRow}>
              <Text style={TYPOGRAPHY.bodySecondary}>Tiền mặt hệ thống ghi nhận</Text>
              <Text style={[TYPOGRAPHY.title, { color: COLORS.textPrimary }]}>
                {systemCod.toLocaleString('vi-VN')} VND
              </Text>
            </View>

            <Text style={[TYPOGRAPHY.body, { marginTop: 16, marginBottom: 8, fontWeight: '600' }]}>
              Tiền mặt thực tế nộp về két thủ quỹ <Text style={{ color: COLORS.danger }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="Nhập số tiền thực nộp (VND)"
              placeholderTextColor={COLORS.textSecondary}
              value={codSubmittedText}
              onChangeText={handleCodInputChange}
            />

            {/* Realtime Difference Indicator */}
            {hasEnteredCod && (
              <View
                style={[
                  styles.diffBadge,
                  codDifference === 0
                    ? styles.diffMatch
                    : codDifference > 0
                    ? styles.diffMissing
                    : styles.diffSurplus,
                ]}
              >
                {codDifference === 0 ? (
                  <>
                    <CheckCircle2 color={COLORS.success} size={18} style={{ marginRight: 8 }} />
                    <Text style={[styles.diffText, { color: COLORS.success }]}>
                      Khớp hoàn toàn với hệ thống (0 VND)
                    </Text>
                  </>
                ) : codDifference > 0 ? (
                  <>
                    <AlertCircle color={COLORS.danger} size={18} style={{ marginRight: 8 }} />
                    <Text style={[styles.diffText, { color: COLORS.danger }]}>
                      Thiếu {formatVnd(codDifference)} so với hệ thống
                    </Text>
                  </>
                ) : (
                  <>
                    <Info color="#2563EB" size={18} style={{ marginRight: 8 }} />
                    <Text style={[styles.diffText, { color: '#2563EB' }]}>
                      Dư {formatVnd(codDifference)} so với hệ thống
                    </Text>
                  </>
                )}
              </View>
            )}

            <Text style={[TYPOGRAPHY.body, { marginTop: 16, marginBottom: 8 }]}>
              Ghi chú giải trình {codDifference !== 0 && <Text style={{ color: COLORS.danger }}>(Khuyên dùng khi có chênh lệch)</Text>}
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Giải thích lý do chênh lệch hoặc ghi chú bàn giao..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />
          </View>

          {/* Pending stops warning */}
          {pendingStops > 0 && (
            <View style={[styles.warningBanner, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <AlertTriangle color={COLORS.danger} size={22} style={{ marginRight: 12 }} />
              <Text style={[styles.warningText, { color: '#991B1B' }]}>
                Cảnh báo: Bạn còn {pendingStops} điểm dừng chưa hoàn thành. Các đơn chưa giao sẽ được chuyển trạng thái xử lý sau.
              </Text>
            </View>
          )}

          {/* Shift Close Info Banner */}
          <View style={styles.warningBanner}>
            <AlertTriangle color="#B45309" size={22} style={{ marginRight: 12 }} />
            <Text style={styles.warningText}>
              Sau khi xác nhận đóng ca, trạng thái chuyển sang PENDING_SETTLEMENT (Chờ thủ quỹ đối soát). Bạn sẽ chuyển sang trạng thái OFFLINE.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isSubmitting}
        >
          <Text style={styles.backButtonText}>QUAY LẠI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            COMMON_STYLES.primaryButton,
            { flex: 2, opacity: isSubmitting || !hasEnteredCod ? 0.7 : 1 },
          ]}
          onPress={handleConfirm}
          disabled={isSubmitting || !hasEnteredCod}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={TYPOGRAPHY.buttonText}>XÁC NHẬN & ĐÓNG CA</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: SIZES.padding_md,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  codRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: SIZES.padding_md,
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: COLORS.background,
    color: COLORS.textPrimary,
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: SIZES.radius_sm,
    marginTop: 10,
    borderWidth: 1,
  },
  diffMatch: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  diffMissing: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  diffSurplus: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  diffText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: SIZES.padding_md,
    backgroundColor: COLORS.background,
    minHeight: 80,
    color: COLORS.textPrimary,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: SIZES.padding_md,
    borderRadius: SIZES.radius_sm,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: SIZES.padding_md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  backButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_md,
    height: SIZES.button_height,
  },
  backButtonText: {
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
});
