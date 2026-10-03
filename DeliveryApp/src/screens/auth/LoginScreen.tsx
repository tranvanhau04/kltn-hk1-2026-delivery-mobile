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
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';

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
    <SafeAreaView style={[COMMON_STYLES.container, { backgroundColor: '#FFF' }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>V</Text>
            </View>
            <Text style={styles.brandTitle}>LOGISTICS PRO</Text>
            <Text style={TYPOGRAPHY.bodySecondary}>VELOCITY DELIVERY NETWORK</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập email tài khoản"
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
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  {showPassword ? (
                    <EyeOff color={COLORS.textSecondary} size={20} />
                  ) : (
                    <Eye color={COLORS.textSecondary} size={20} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                COMMON_STYLES.primaryButton,
                { marginTop: 24 },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Text style={TYPOGRAPHY.buttonText}>ĐĂNG NHẬP</Text>
                  <ArrowRight color="#FFF" size={20} style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.biometricButton} disabled={isLoading}>
              <Fingerprint color={COLORS.primary} size={20} style={{ marginRight: 8 }} />
              <Text style={[TYPOGRAPHY.buttonText, { color: COLORS.primary }]}>DÙNG SINH TRẮC HỌC</Text>
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
    marginBottom: 48,
  },
  logoBox: {
    width: 64,
    height: 64,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    transform: [{ rotate: '45deg' }]
  },
  logoIcon: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    transform: [{ rotate: '-45deg' }]
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
    padding: 16,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius_sm,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: SIZES.button_height,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radius_md,
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
