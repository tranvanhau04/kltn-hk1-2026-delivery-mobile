import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  CheckCircle2,
  ArrowLeft,
  RotateCcw,
  Image as ImageIcon,
  AlertTriangle,
  Banknote,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { submitStopPodApi, isApiError } from '../../lib/api';
import { TaskStackParamList } from '../../navigation/TaskStackNavigator';

export const PODCompletionScreen = () => {
  const { stops, refreshRoute } = useAppContext();
  const { token, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<TaskStackParamList>>();
  const route = useRoute<RouteProp<TaskStackParamList, 'PODCompletion'>>();

  const stopId = route.params.stopId;
  const stop = stops.find((s) => s.id === stopId);
  const expectedCod = Number(stop?.order.cod_amount) || 0;

  // Form states
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [collectedAmount, setCollectedAmount] = useState<string>(
    expectedCod > 0 ? String(expectedCod) : '0',
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  // ─── Chụp ảnh từ Camera (Ưu tiên chính) ──────────────────────────────────
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập Camera',
          'Vui lòng cấp quyền truy cập Camera trong Cài đặt thiết bị để chụp ảnh kiện hàng làm minh chứng giao hàng.',
          [{ text: 'Đã hiểu' }],
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Lỗi Camera', 'Không thể khởi động camera. Vui lòng thử lại.');
    }
  };

  // ─── Chọn ảnh từ Thư viện (Tùy chọn phụ) ──────────────────────────────────
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập Thư viện',
          'Vui lòng cấp quyền truy cập Thư viện ảnh trong Cài đặt thiết bị.',
          [{ text: 'Đã hiểu' }],
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Lỗi Thư viện', 'Không thể mở thư viện ảnh. Vui lòng thử lại.');
    }
  };

  // ─── Xử lý gửi POD lên máy chủ ───────────────────────────────────────────
  const executeSubmit = async (finalAmount: number) => {
    if (!token) {
      Alert.alert('Lỗi xác thực', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', [
        { text: 'Đồng ý', onPress: () => logout() },
      ]);
      return;
    }

    if (!photoUri) {
      Alert.alert('Thiếu ảnh minh chứng', 'Vui lòng chụp ảnh kiện hàng trước khi hoàn thành.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitStopPodApi(
        stop.id,
        photoUri,
        finalAmount,
        notes,
        token,
      );

      if (res.success) {
        await refreshRoute();
        Alert.alert(
          'Giao hàng thành công! 🎉',
          `Đã ghi nhận minh chứng cho đơn ${stop.order.code}.\nCOD đã thu: ${finalAmount.toLocaleString('vi-VN')} ₫`,
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
            err.message || 'Điểm giao này đã được xử lý hoàn thành trước đó.',
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
        Alert.alert('Lỗi gửi POD', err.message);
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        Alert.alert('Lỗi kết nối', `Không thể gửi dữ liệu lên máy chủ (${errorMsg}). Vui lòng kiểm tra lại mạng.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSubmit = () => {
    if (isSubmitting) return;

    if (!photoUri) {
      Alert.alert('Cần ảnh kiện hàng', 'Vui lòng chụp ảnh kiện hàng thực tế để làm bằng chứng giao hàng.');
      return;
    }

    const numericAmount = expectedCod > 0 ? parseInt(collectedAmount.replace(/\D/g, ''), 10) || 0 : 0;

    if (numericAmount < 0 || numericAmount > expectedCod) {
      Alert.alert(
        'Số tiền không hợp lệ',
        `Số tiền thực thu không được vượt quá số tiền COD yêu cầu (${expectedCod.toLocaleString('vi-VN')} ₫).`,
      );
      return;
    }

    // Cảnh báo nếu thu thiếu COD
    if (expectedCod > 0 && numericAmount < expectedCod) {
      Alert.alert(
        '⚠️ Cảnh báo thu thiếu COD',
        `Số tiền thực thu (${numericAmount.toLocaleString('vi-VN')} ₫) nhỏ hơn số tiền COD cần thu (${expectedCod.toLocaleString('vi-VN')} ₫).\n\nBạn có chắc chắn muốn xác nhận giao hàng và ghi nhận số tiền này?`,
        [
          { text: 'Kiểm tra lại', style: 'cancel' },
          {
            text: 'Xác nhận thu thiếu',
            style: 'destructive',
            onPress: () => showFinalConfirmation(numericAmount),
          },
        ],
      );
      return;
    }

    showFinalConfirmation(numericAmount);
  };

  const showFinalConfirmation = (finalAmount: number) => {
    Alert.alert(
      'Xác nhận hoàn thành giao hàng',
      `Đơn hàng: ${stop.order.code}\nKhách hàng: ${stop.order.receiver_name}\nTiền COD thu: ${finalAmount.toLocaleString('vi-VN')} ₫\n\nBạn xác nhận thông tin trên là chính xác?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận giao',
          onPress: () => executeSubmit(finalAmount),
        },
      ],
    );
  };

  const currentNumericCod = parseInt(collectedAmount.replace(/\D/g, ''), 10) || 0;
  const isMatchExpected = expectedCod === 0 || currentNumericCod === expectedCod;

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
        <View style={styles.headerTextWrapper}>
          <Text style={TYPOGRAPHY.header}>Bằng chứng giao hàng (POD)</Text>
          <Text style={styles.headerSubtitle}>Đơn hàng: {stop.order.code}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: SIZES.padding_md, paddingBottom: 110 }}>
          {/* ─── Vùng Chụp / Xem trước ảnh Kiện hàng ─────────────────────── */}
          <Text style={[TYPOGRAPHY.title, { marginBottom: SIZES.padding_sm }]}>
            Ảnh chụp kiện hàng thực tế <Text style={{ color: COLORS.danger }}>*</Text>
          </Text>

          {photoUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
              <View style={styles.previewOverlay}>
                <TouchableOpacity
                  style={styles.retakeBtn}
                  onPress={handleTakePhoto}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <RotateCcw color="#FFF" size={16} />
                  <Text style={styles.retakeText}>Chụp lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.galleryChangeBtn}
                  onPress={handlePickFromGallery}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <ImageIcon color="#FFF" size={16} />
                  <Text style={styles.retakeText}>Đổi ảnh khác</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <TouchableOpacity
                style={styles.cameraMainAction}
                onPress={handleTakePhoto}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <View style={styles.cameraIconCircle}>
                  <Camera color="#FFF" size={32} />
                </View>
                <Text style={styles.cameraMainText}>Chụp ảnh kiện hàng</Text>
                <Text style={styles.cameraSubText}>
                  Khuyên dùng: Chụp rõ gói hàng tại địa chỉ của khách
                </Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>hoặc</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.galleryAltBtn}
                onPress={handlePickFromGallery}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <ImageIcon color={COLORS.primary} size={18} />
                <Text style={styles.galleryAltText}>Chọn từ thư viện ảnh</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Khối Thu tiền COD ─────────────────────────────────────── */}
          {expectedCod > 0 ? (
            <View style={[COMMON_STYLES.card, { marginTop: SIZES.padding_md }]}>
              <View style={styles.codHeaderRow}>
                <Text style={TYPOGRAPHY.title}>Thu tiền COD</Text>
                <TouchableOpacity
                  style={styles.quickFillBtn}
                  onPress={() => setCollectedAmount(String(expectedCod))}
                  disabled={isSubmitting}
                >
                  <Text style={styles.quickFillText}>✓ Thu đủ COD</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.codSummary}>
                <Text style={TYPOGRAPHY.bodySecondary}>Số tiền COD cần thu theo đơn:</Text>
                <Text style={[TYPOGRAPHY.header, { color: COLORS.primary }]}>
                  {expectedCod.toLocaleString('vi-VN')} ₫
                </Text>
              </View>

              <Text style={[TYPOGRAPHY.body, { marginBottom: 6, marginTop: 14, fontWeight: '600' }]}>
                Số tiền thực tế đã thu:
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Nhập số tiền đã nhận (VNĐ)"
                value={collectedAmount}
                onChangeText={setCollectedAmount}
                editable={!isSubmitting}
              />

              {collectedAmount.length > 0 && (
                <View style={styles.validationRow}>
                  {isMatchExpected ? (
                    <>
                      <CheckCircle2 color={COLORS.success} size={16} style={{ marginRight: 6 }} />
                      <Text style={{ color: COLORS.success, fontSize: 13, fontWeight: '500' }}>
                        Số tiền khớp với COD yêu cầu ({expectedCod.toLocaleString('vi-VN')} ₫)
                      </Text>
                    </>
                  ) : currentNumericCod < expectedCod ? (
                    <>
                      <AlertTriangle color="#D97706" size={16} style={{ marginRight: 6 }} />
                      <Text style={{ color: '#D97706', fontSize: 13, fontWeight: '500' }}>
                        Đang thu thiếu: {(expectedCod - currentNumericCod).toLocaleString('vi-VN')} ₫
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '500' }}>
                      Số tiền vượt quá COD đơn hàng!
                    </Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={[COMMON_STYLES.card, styles.noCodCard, { marginTop: SIZES.padding_md }]}>
              <Banknote color={COLORS.success} size={22} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[TYPOGRAPHY.body, { fontWeight: 'bold', color: COLORS.success }]}>
                  Đơn không thu COD
                </Text>
                <Text style={TYPOGRAPHY.bodySecondary}>Khách hàng đã thanh toán trước toàn bộ.</Text>
              </View>
            </View>
          )}

          {/* ─── Ghi chú giao hàng ───────────────────────────────────────── */}
          <View style={[COMMON_STYLES.card, { marginTop: SIZES.padding_md }]}>
            <Text style={[TYPOGRAPHY.title, { marginBottom: 8 }]}>Ghi chú giao hàng (tùy chọn)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="VD: Gửi lễ tân tầng 1, khách kiểm hàng nguyên vẹn..."
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
              editable={!isSubmitting}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Footer Action Button ───────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            COMMON_STYLES.primaryButton,
            (!photoUri || isSubmitting) && { opacity: 0.5 },
          ]}
          onPress={handleConfirmSubmit}
          disabled={!photoUri || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 8 }} />
              <Text style={TYPOGRAPHY.buttonText}>ĐANG TẢI LÊN MINH CHỨNG...</Text>
            </View>
          ) : (
            <Text style={TYPOGRAPHY.buttonText}>XÁC NHẬN GIAO THÀNH CÔNG</Text>
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
  headerTextWrapper: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cameraBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: SIZES.radius_md,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  cameraMainAction: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  cameraIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  cameraMainText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  cameraSubText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: COLORS.inactive,
  },
  galleryAltBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6,
  },
  galleryAltText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  previewContainer: {
    height: 240,
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
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  galleryChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  retakeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  codHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickFillBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  quickFillText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: 'bold',
  },
  codSummary: {
    backgroundColor: COLORS.background,
    padding: SIZES.padding_sm,
    borderRadius: SIZES.radius_sm,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: SIZES.padding_md,
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: COLORS.surface,
  },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  noCodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: 10,
    fontSize: 14,
    minHeight: 70,
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
