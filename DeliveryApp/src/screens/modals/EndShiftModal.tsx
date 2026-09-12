import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { endDriverShift } from '../../lib/api';
import { Alert } from 'react-native';

export const EndShiftModal = () => {
  const { shift, stops, setDriver, setShift, driver } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [codSubmitted, setCodSubmitted] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assigned = stops.length;
  const delivered = stops.filter(s => s.status === 'COMPLETED').length;
  const failed = stops.filter(s => s.status === 'FAILED').length;
  const systemCod = shift?.cod_collected || 0;

  const handleConfirm = async () => {
    if (!driver?.user_id) return;
    
    setIsSubmitting(true);
    const submittedAmount = parseInt(codSubmitted.replace(/\D/g, ''), 10) || 0;
    
    try {
      await endDriverShift(driver.user_id, submittedAmount, notes);
      
      // Update local state only after successful API call
      setDriver({ ...driver, current_shift_status: 'OFFLINE' });
      if (shift) {
        setShift({
          ...shift,
          status: 'PENDING_SETTLEMENT',
          cod_submitted: submittedAmount,
          end_time: new Date().toISOString()
        });
      }

      navigation.goBack();
    } catch {
      Alert.alert('Lỗi', 'Không thể đóng ca trên hệ thống. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[COMMON_STYLES.container, { backgroundColor: '#F3F4F6' }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={TYPOGRAPHY.header}>Chốt ca làm việc</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 120 }}>
          
          <View style={COMMON_STYLES.card}>
            <Text style={TYPOGRAPHY.title}>Hiệu suất ca làm</Text>
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

          <View style={COMMON_STYLES.card}>
            <Text style={TYPOGRAPHY.title}>Chốt tiền COD</Text>
            <View style={styles.codRow}>
              <Text style={TYPOGRAPHY.bodySecondary}>Tiền mặt hệ thống ghi nhận</Text>
              <Text style={TYPOGRAPHY.title}>{systemCod.toLocaleString('vi-VN')} VND</Text>
            </View>

            <Text style={[TYPOGRAPHY.body, { marginTop: 16, marginBottom: 8 }]}>Tiền mặt thực tế nộp</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="Nhập số tiền (VND)"
              value={codSubmitted}
              onChangeText={setCodSubmitted}
            />

            <Text style={[TYPOGRAPHY.body, { marginTop: 16, marginBottom: 8 }]}>Ghi chú (Nếu có chênh lệch)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Giải thích sự chênh lệch tại đây..."
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.warningBanner}>
            <AlertTriangle color="#B45309" size={24} style={{ marginRight: 12 }} />
            <Text style={styles.warningText}>
              Sau khi kết thúc ca, bạn không thể giao hàng cho đến khi mở ca mới.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} disabled={isSubmitting}>
          <Text style={styles.backButtonText}>QUAY LẠI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[COMMON_STYLES.primaryButton, { flex: 2, opacity: isSubmitting ? 0.7 : 1 }]} onPress={handleConfirm} disabled={isSubmitting}>
          <Text style={TYPOGRAPHY.buttonText}>{isSubmitting ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN & ĐÓNG CA'}</Text>
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
    backgroundColor: COLORS.background,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: SIZES.padding_md,
    backgroundColor: COLORS.background,
    minHeight: 80,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: SIZES.padding_md,
    borderRadius: SIZES.radius_sm,
    alignItems: 'center',
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 14,
    fontWeight: '500',
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
    paddingBottom: 24,
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
