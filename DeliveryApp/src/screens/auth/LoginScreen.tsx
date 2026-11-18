import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Fingerprint, ArrowRight } from 'lucide-react-native';
import { COLORS, SIZES, COMMON_STYLES } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/BrandLogo';

export const LoginScreen = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập email và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      await login(trimmedEmail, password);
      // Navigation is handled automatically by RootNavigator
      // when isAuthenticated becomes true
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('401')) {
        Alert.alert('Đăng nhập thất bại', 'Email hoặc mật khẩu không đúng.\n\nGợi ý: Mật khẩu mặc định là 123456');
      } else if (msg.includes('abort')) {
        Alert.alert('Lỗi kết nối', 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.');
      } else {
        Alert.alert('Lỗi', `Đăng nhập thất bại: ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[COMMON_STYLES.container, { backgroundColor: '#FFFFFF' }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          {/* Brand Logo */}
          <View style={styles.logoContainer}>
            <BrandLogo size="medium" variant="light" showSlogan showPills={false} />
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập email tài khoản"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu (mặc định: 123456)"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff color={COLORS.textSecondary} size={20} />
                  ) : (
                    <Eye color={COLORS.textSecondary} size={20} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotPassword}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Hỗ trợ', 'Vui lòng liên hệ Quản lý đội xe / Điều phối viên để đặt lại mật khẩu.')}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>ĐĂNG NHẬP</Text>
                  <ArrowRight color="#FFFFFF" size={20} style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.biometricButton}
              disabled={isLoading}
              activeOpacity={0.75}
              onPress={() => Alert.alert('Sinh trắc học', 'Tính năng FaceID/Vân tay sẵn sàng sau khi đăng nhập thành công lần đầu.')}
            >
              <Fingerprint color="#EF4444" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.biometricButtonText}>DÙNG SINH TRẮC HỌC</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: SIZES.padding_lg,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeIcon: {
    padding: 14,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#EF4444',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  biometricButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginTop: 14,
    backgroundColor: '#F8FAFC',
  },
  biometricButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
