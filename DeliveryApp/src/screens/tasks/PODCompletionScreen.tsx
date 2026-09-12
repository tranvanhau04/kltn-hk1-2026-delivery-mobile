import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CheckCircle2, ArrowLeft } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';

export const PODCompletionScreen = () => {
  const { stops, updateStopStatus } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<TaskStackParamList>>();
  const route = useRoute<RouteProp<TaskStackParamList, 'PODCompletion'>>();
  
  const stopId = route.params.stopId;
  const stop = stops.find(s => s.id === stopId);
  const expectedCod = stop?.order.cod_amount || 0;

  const [collectedAmount, setCollectedAmount] = useState<string>('');

  if (!stop) return null;

  const handleSubmit = () => {
    const amount = parseInt(collectedAmount.replace(/\D/g, ''), 10) || 0;
    updateStopStatus(stop.id, 'COMPLETED', amount);
    navigation.navigate('StopList');
  };

  const isAmountValid = expectedCod === 0 || parseInt(collectedAmount.replace(/\D/g, ''), 10) === expectedCod;

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={TYPOGRAPHY.header}>Bằng chứng giao hàng (POD)</Text>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 100 }}>
          {/* Camera Mockup */}
          <Text style={[TYPOGRAPHY.title, { marginBottom: SIZES.padding_sm }]}>Ảnh kiện hàng</Text>
          <View style={styles.cameraPlaceholder}>
            <Camera color={COLORS.inactive} size={48} />
            <Text style={[TYPOGRAPHY.bodySecondary, { marginTop: 12 }]}>Chạm để chụp ảnh</Text>
          </View>

          {/* COD Collection */}
          {expectedCod > 0 && (
            <View style={[COMMON_STYLES.card, { marginTop: SIZES.padding_lg }]}>
              <Text style={TYPOGRAPHY.title}>Thu tiền COD</Text>
              
              <View style={styles.codSummary}>
                <Text style={TYPOGRAPHY.bodySecondary}>Số tiền cần thu</Text>
                <Text style={[TYPOGRAPHY.header, { color: COLORS.primary }]}>
                  {expectedCod.toLocaleString('vi-VN')} VND
                </Text>
              </View>

              <Text style={[TYPOGRAPHY.body, { marginBottom: 8, marginTop: 16 }]}>Số tiền thực tế đã thu</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Nhập số tiền (VND)"
                value={collectedAmount}
                onChangeText={setCollectedAmount}
              />
              
              {collectedAmount.length > 0 && (
                <View style={styles.validationRow}>
                  {isAmountValid ? (
                    <>
                      <CheckCircle2 color={COLORS.success} size={16} style={{ marginRight: 4 }} />
                      <Text style={{ color: COLORS.success, fontSize: 14 }}>Số tiền khớp với COD yêu cầu</Text>
                    </>
                  ) : (
                    <Text style={{ color: COLORS.danger, fontSize: 14 }}>Số tiền không khớp với COD yêu cầu</Text>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[COMMON_STYLES.primaryButton, (!isAmountValid && expectedCod > 0) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!isAmountValid && expectedCod > 0}
        >
          <Text style={TYPOGRAPHY.buttonText}>GỬI BẰNG CHỨNG & HOÀN THÀNH</Text>
        </TouchableOpacity>
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
  cameraPlaceholder: {
    height: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: SIZES.radius_md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  codSummary: {
    backgroundColor: COLORS.background,
    padding: SIZES.padding_md,
    borderRadius: SIZES.radius_sm,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: SIZES.padding_md,
    fontSize: 18,
    backgroundColor: COLORS.surface,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
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
});
