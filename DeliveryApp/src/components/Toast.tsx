import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import type { ToastItem, ToastType } from '../context/ToastContext';

// Color & config mapping matching Web design tokens
const TOAST_THEMES: Record<
  ToastType,
  {
    iconColor: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    accentBarColor: string;
    icon: (color: string) => React.ReactNode;
  }
> = {
  success: {
    iconColor: '#10B981',
    bgColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    textColor: '#14532D',
    accentBarColor: '#22C55E',
    icon: (color) => <CheckCircle2 size={20} color={color} />,
  },
  error: {
    iconColor: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
    textColor: '#7F1D1D',
    accentBarColor: '#EF4444',
    icon: (color) => <XCircle size={20} color={color} />,
  },
  warning: {
    iconColor: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    textColor: '#78350F',
    accentBarColor: '#F59E0B',
    icon: (color) => <AlertTriangle size={20} color={color} />,
  },
  info: {
    iconColor: '#3B82F6',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    textColor: '#1E3A8A',
    accentBarColor: '#3B82F6',
    icon: (color) => <Info size={20} color={color} />,
  },
};

interface ToastItemProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const theme = TOAST_THEMES[toast.type] || TOAST_THEMES.info;
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide-down + Fade-in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -40,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  return (
    <Animated.View
      style={[
        styles.toastCard,
        {
          backgroundColor: '#FFFFFF',
          borderColor: theme.borderColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      {/* Accent left indicator */}
      <View style={[styles.accentBar, { backgroundColor: theme.accentBarColor }]} />

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleDismiss}
        style={styles.cardContent}
      >
        <View style={[styles.iconContainer, { backgroundColor: theme.bgColor }]}>
          {theme.icon(theme.iconColor)}
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.textColor }]} numberOfLines={1}>
            {toast.title}
          </Text>
          {toast.message ? (
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtn}
        >
          <X size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { top: insets.top + (Platform.OS === 'android' ? 12 : 6) },
      ]}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
    gap: 8,
  },
  toastCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingLeft: 16,
    minHeight: 56,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
    borderRadius: 6,
  },
});
