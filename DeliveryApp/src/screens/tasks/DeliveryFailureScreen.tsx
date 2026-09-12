import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ArrowLeft, ChevronDown } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';

const FAILURE_REASONS = [
  'Khách không nghe máy (Gọi 3 cuộc không nghe máy)',
  'Khách hẹn ngày khác',
  'Từ chối nhận hàng (Boom hàng - Chuyển hoàn)'
];

export const DeliveryFailureScreen = () => {
  const { stops, updateStopStatus } = useAppContext();
  const navigation = useNavigation<NativeStackNavigationProp<TaskStackParamList>>();
  const route = useRoute<RouteProp<TaskStackParamList, 'DeliveryFailure'>>();
  
  const stopId = route.params.stopId;
  const stop = stops.find(s => s.id === stopId);

  const [selectedReason, setSelectedReason] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [notes, setNotes] = useState('');

  if (!stop) return null;

  const handleSubmit = () => {
    updateStopStatus(stop.id, 'FAILED');
    navigation.navigate('StopList');
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={TYPOGRAPHY.header}>Báo cáo thất bại</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 100 }}>
          
          <Text style={[TYPOGRAPHY.title, { marginBottom: 8 }]}>Lý do giao thất bại</Text>
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => setShowDropdown(!showDropdown)}
          >
            <Text style={[TYPOGRAPHY.body, !selectedReason && { color: COLORS.inactive }]}>
              {selectedReason || 'Chọn lý do...'}
            </Text>
            <ChevronDown color={COLORS.inactive} size={20} />
          </TouchableOpacity>

          {showDropdown && (
            <View style={styles.dropdownMenu}>
              {FAILURE_REASONS.map((reason, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedReason(reason);
                    setShowDropdown(false);
                  }}
                >
                  <Text style={TYPOGRAPHY.body}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[TYPOGRAPHY.title, { marginTop: 24, marginBottom: 8 }]}>Ảnh bằng chứng</Text>
          <View style={styles.cameraPlaceholder}>
            <Camera color={COLORS.inactive} size={48} />
            <Text style={[TYPOGRAPHY.bodySecondary, { marginTop: 12 }]}>Chụp ảnh địa điểm/cửa</Text>
          </View>

          <Text style={[TYPOGRAPHY.title, { marginTop: 24, marginBottom: 8 }]}>Ghi chú thêm</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Nhập chi tiết bổ sung tại đây..."
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[COMMON_STYLES.dangerButton, { backgroundColor: COLORS.danger }, !selectedReason && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!selectedReason}
        >
          <Text style={[TYPOGRAPHY.buttonText, { color: '#FFF' }]}>XÁC NHẬN THẤT BẠI</Text>
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
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: SIZES.padding_md,
    backgroundColor: COLORS.surface,
  },
  dropdownMenu: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    marginTop: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 3 },
    })
  },
  dropdownItem: {
    padding: SIZES.padding_md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cameraPlaceholder: {
    height: 150,
    backgroundColor: '#E5E7EB',
    borderRadius: SIZES.radius_md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: SIZES.padding_md,
    backgroundColor: COLORS.surface,
    minHeight: 100,
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
