import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  ArrowLeft,
  ChevronDown,
  Calendar,
  Clock,
  RotateCcw,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { failStopApi, isApiError } from '../../lib/api';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';

interface FailureOption {
  label: string;
  action: 'FAILED' | 'RESCHEDULED';
}

const FAILURE_OPTIONS: FailureOption[] = [
  { label: 'Khách hẹn ngày khác', action: 'RESCHEDULED' },
  { label: 'Khách không nghe máy (đã gọi 3 cuộc)', action: 'FAILED' },
  { label: 'Khách từ chối nhận hàng (Boom hàng - Chuyển hoàn)', action: 'FAILED' },
  { label: 'Sai địa chỉ / Không tìm thấy nhà', action: 'FAILED' },
  { label: 'Kiện hàng có vấn đề / Khách không đồng kiểm', action: 'FAILED' },
  { label: 'Khu vực cách ly / Không thể tiếp cận', action: 'FAILED' },
  { label: 'Lý do khác', action: 'FAILED' },
];

export const DeliveryFailureScreen = () => {
  const { stops, refreshRoute } = useAppContext();
  const { token, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<TaskStackParamList>>();
  const route = useRoute<RouteProp<TaskStackParamList, 'DeliveryFailure'>>();

  const stopId = route.params.stopId;
  const stop = stops.find((s) => s.id === stopId);

  const [selectedOption, setSelectedOption] = useState<FailureOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [rescheduledDate, setRescheduledDate] = useState<string>('');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Danh sách các mốc thời gian hẹn lại tiện lợi (presets)
  const getReschedulePresets = () => {
    const now = new Date();
    const presets: { label: string; date: Date }[] = [];

    // Chiều nay lúc 16h (nếu bây giờ chưa tới 15h)
    if (now.getHours() < 15) {
      const todayAfternoon = new Date();
      todayAfternoon.setHours(16, 0, 0, 0);
      presets.push({ label: 'Chiều nay (16:00)', date: todayAfternoon });
    }

    // Sáng mai 09h00
    const tomorrowMorning = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrowMorning.setHours(9, 0, 0, 0);
    presets.push({ label: 'Sáng mai (09:00)', date: tomorrowMorning });

    // Chiều mai 15h00
    const tomorrowAfternoon = new Date(Date.now() + 24 * 3600 * 1000);
    tomorrowAfternoon.setHours(15, 0, 0, 0);
    presets.push({ label: 'Chiều mai (15:00)', date: tomorrowAfternoon });

    // Ngày mốt 09h00
    const dayAfter = new Date(Date.now() + 48 * 3600 * 1000);
    dayAfter.setHours(9, 0, 0, 0);
    presets.push({ label: 'Ngày mốt (09:00)', date: dayAfter });

    return presets;
  };

  const presets = getReschedulePresets();

  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index);
    setRescheduledDate(presets[index].date.toISOString());
  };

  // Chụp ảnh bằng chứng
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần cấp quyền Camera', 'Vui lòng cho phép ứng dụng truy cập camera.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể khởi động camera.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần cấp quyền Thư viện', 'Vui lòng cho phép truy cập thư viện ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở thư viện ảnh.');
    }
  };

  // Xác nhận và gửi API
  const handleConfirmSubmit = () => {
    if (isSubmitting) return;

    if (!selectedOption) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn lý do giao thất bại.');
      return;
    }

    if (selectedOption.action === 'RESCHEDULED' && !rescheduledDate) {
      Alert.alert('Thiếu thời gian hẹn', 'Vui lòng chọn thời gian hẹn giao lại hàng.');
      return;
    }

    const isReschedule = selectedOption.action === 'RESCHEDULED';
    const title = isReschedule ? 'Xác nhận hẹn giao lại' : 'Xác nhận báo giao thất bại';
    const reasonText = notes.trim()
      ? `${selectedOption.label} - ${notes.trim()}`
      : selectedOption.label;

    const message = isReschedule
      ? `Đơn hàng: ${stop.order.code}\nLý do: ${selectedOption.label}\nThời gian hẹn: ${new Date(rescheduledDate).toLocaleString('vi-VN')}\n\nBạn xác nhận hẹn giao lại đơn hàng này?`
      : `Đơn hàng: ${stop.order.code}\nLý do: ${selectedOption.label}\n\nBạn xác nhận đơn hàng này giao không thành công?`;

    Alert.alert(title, message, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xác nhận',
        style: isReschedule ? 'default' : 'destructive',
        onPress: () => executeSubmit(reasonText),
      },
    ]);
  };

  const executeSubmit = async (reasonText: string) => {
    if (!token) {
      Alert.alert('Hết phiên', 'Vui lòng đăng nhập lại.', [
        { text: 'Đồng ý', onPress: () => logout() },
      ]);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await failStopApi(
        stop.id,
        {
          action: selectedOption!.action,
          failureReason: reasonText,
          rescheduledDate: selectedOption!.action === 'RESCHEDULED' ? rescheduledDate : undefined,
          photoUri: photoUri || undefined,
        },
        token,
      );

      if (res.success) {
        await refreshRoute();
        const actionLabel = selectedOption!.action === 'RESCHEDULED' ? 'hẹn giao lại' : 'thất bại';
        Alert.alert(
          'Đã ghi nhận kết quả',
          `Đơn hàng ${stop.order.code} đã được đánh dấu ${actionLabel}.`,
          [
            {
              text: 'Xong',
              onPress: () => navigation.navigate('StopList'),
            },
          ],
        );
      }
    } catch (err: unknown) {
      if (isApiError(err)) {
        if (err.status === 401) {
          Alert.alert('Phiên làm việc hết hạn', 'Vui lòng đăng nhập lại.', [
            { text: 'Đồng ý', onPress: () => logout() },
          ]);
          return;
        }
        if (err.status === 409) {
          Alert.alert(
            'Đơn hàng đã được xử lý',
            err.message || 'Điểm dừng này đã được xử lý trước đó trong hệ thống.',
            [
              {
                text: 'Quay lại',
                onPress: async () => {
                  await refreshRoute();
                  navigation.navigate('StopList');
                },
              },
            ],
          );
          return;
        }
        Alert.alert('Lỗi gửi báo cáo', err.message);
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        Alert.alert('Lỗi kết nối', `Không thể kết nối đến máy chủ (${errorMsg}). Vui lòng kiểm tra lại mạng.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          disabled={isSubmitting}
        >
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={TYPOGRAPHY.header}>Báo cáo giao không thành công</Text>
          <Text style={styles.headerSubtitle}>Đơn hàng: {stop.order.code}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 110 }}>
          {/* Chọn lý do thất bại */}
          <Text style={[TYPOGRAPHY.title, { marginBottom: 8 }]}>
            Lý do giao không thành công <Text style={{ color: COLORS.danger }}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowDropdown(!showDropdown)}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text style={[TYPOGRAPHY.body, !selectedOption && { color: COLORS.inactive }]}>
              {selectedOption ? selectedOption.label : 'Chọn lý do cụ thể...'}
            </Text>
            <ChevronDown color={COLORS.inactive} size={20} />
          </TouchableOpacity>

          {showDropdown && (
            <View style={styles.dropdownMenu}>
              {FAILURE_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownItem,
                    selectedOption?.label === option.label && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedOption(option);
                    setShowDropdown(false);
                    if (option.action !== 'RESCHEDULED') {
                      setRescheduledDate('');
                      setSelectedPresetIndex(null);
                    }
                  }}
                >
                  <Text
                    style={[
                      TYPOGRAPHY.body,
                      selectedOption?.label === option.label && {
                        color: COLORS.primary,
                        fontWeight: 'bold',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.action === 'RESCHEDULED' && (
                    <View style={styles.rescheduleBadge}>
                      <Text style={styles.rescheduleBadgeText}>Hẹn lại</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Nếu chọn RESCHEDULED: Khối chọn ngày giờ hẹn lại */}
          {selectedOption?.action === 'RESCHEDULED' && (
            <View style={[COMMON_STYLES.card, styles.rescheduleCard]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Calendar color={COLORS.primary} size={20} style={{ marginRight: 8 }} />
                <Text style={[TYPOGRAPHY.title, { color: COLORS.primary }]}>
                  Chọn thời gian hẹn giao lại <Text style={{ color: COLORS.danger }}>*</Text>
                </Text>
              </View>

              <Text style={[TYPOGRAPHY.bodySecondary, { marginBottom: 10 }]}>
                Vui lòng chọn mốc thời gian khách hàng yêu cầu giao lại:
              </Text>

              <View style={styles.presetsGrid}>
                {presets.map((p, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.presetChip,
                      selectedPresetIndex === idx && styles.presetChipActive,
                    ]}
                    onPress={() => handleSelectPreset(idx)}
                    disabled={isSubmitting}
                  >
                    <Clock
                      color={selectedPresetIndex === idx ? '#FFF' : COLORS.textSecondary}
                      size={14}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.presetChipText,
                        selectedPresetIndex === idx && styles.presetChipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {rescheduledDate ? (
                <View style={styles.selectedDateNotice}>
                  <CheckCircle2 color={COLORS.success} size={16} style={{ marginRight: 6 }} />
                  <Text style={styles.selectedDateText}>
                    Đã hẹn: {new Date(rescheduledDate).toLocaleString('vi-VN')}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Ảnh bằng chứng hiện trường (tùy chọn) */}
          <Text style={[TYPOGRAPHY.title, { marginTop: 20, marginBottom: 8 }]}>
            Ảnh minh chứng hiện trường (tùy chọn)
          </Text>

          {photoUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
              <View style={styles.previewOverlay}>
                <TouchableOpacity
                  style={styles.retakeBtn}
                  onPress={handleTakePhoto}
                  disabled={isSubmitting}
                >
                  <RotateCcw color="#FFF" size={16} />
                  <Text style={styles.retakeText}>Chụp lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.retakeBtn}
                  onPress={() => setPhotoUri(null)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.retakeText}>Xóa ảnh</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <TouchableOpacity
                style={styles.cameraBtn}
                onPress={handleTakePhoto}
                disabled={isSubmitting}
              >
                <Camera color={COLORS.primary} size={28} />
                <Text style={styles.cameraBtnText}>Chụp ảnh cửa đóng / số nhà</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gallerySmallBtn}
                onPress={handlePickFromGallery}
                disabled={isSubmitting}
              >
                <ImageIcon color={COLORS.inactive} size={16} />
                <Text style={styles.gallerySmallText}>Chọn từ thư viện</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ghi chú chi tiết */}
          <Text style={[TYPOGRAPHY.title, { marginTop: 20, marginBottom: 8 }]}>
            Ghi chú chi tiết
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Mô tả cụ thể tình huống: gọi 3 cuộc lúc 10h15 không nghe máy, cửa khóa ngoài..."
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            selectedOption?.action === 'RESCHEDULED'
              ? COMMON_STYLES.primaryButton
              : COMMON_STYLES.dangerButton,
            (!selectedOption ||
              (selectedOption.action === 'RESCHEDULED' && !rescheduledDate) ||
              isSubmitting) && { opacity: 0.5 },
          ]}
          onPress={handleConfirmSubmit}
          disabled={
            !selectedOption ||
            (selectedOption.action === 'RESCHEDULED' && !rescheduledDate) ||
            isSubmitting
          }
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 8 }} />
              <Text style={TYPOGRAPHY.buttonText}>ĐANG GỬI BÁO CÁO...</Text>
            </View>
          ) : (
            <Text
              style={
                selectedOption?.action === 'RESCHEDULED'
                  ? TYPOGRAPHY.buttonText
                  : COMMON_STYLES.dangerButtonText
              }
            >
              {selectedOption?.action === 'RESCHEDULED'
                ? 'XÁC NHẬN HẸN GIAO LẠI'
                : 'BÁO CÁO GIAO THẤT BẠI'}
            </Text>
          )}
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
    marginRight: 14,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SIZES.padding_md,
    borderRadius: SIZES.radius_sm,
  },
  dropdownMenu: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    marginTop: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  rescheduleBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rescheduleBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rescheduleCard: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  presetChipTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  selectedDateNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
  },
  selectedDateText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '600',
  },
  cameraBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: SIZES.radius_md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  cameraBtnText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  gallerySmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  gallerySmallText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  previewContainer: {
    height: 180,
    borderRadius: SIZES.radius_md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111827',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  retakeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    backgroundColor: COLORS.surface,
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
