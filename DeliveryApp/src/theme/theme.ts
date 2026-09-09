import { StyleSheet } from 'react-native';

export const COLORS = {
  primary: '#FA7070', // Coral / Warm Rose
  success: '#10B981', // Forest Green
  danger: '#EF4444', // Soft Red
  background: '#F8F9FA', // Warm Gray Canvas
  surface: '#FFFFFF', // Solid White
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  inactive: '#9CA3AF',
};

export const SIZES = {
  radius_sm: 8,
  radius_md: 12, // rounded-xl for action buttons
  radius_lg: 16, // rounded-2xl for surface cards
  padding_sm: 8,
  padding_md: 16, // Surface card padding
  padding_lg: 24,
  button_height: 56, // h-14 large touch-friendly target height
};

export const TYPOGRAPHY = StyleSheet.create({
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  body: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  bodySecondary: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});

export const COMMON_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius_lg,
    padding: SIZES.padding_md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: SIZES.padding_md,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: SIZES.button_height,
    borderRadius: SIZES.radius_md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  successButton: {
    backgroundColor: COLORS.success,
    height: SIZES.button_height,
    borderRadius: SIZES.radius_md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  dangerButton: {
    backgroundColor: 'transparent',
    height: SIZES.button_height,
    borderRadius: SIZES.radius_md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
    flexDirection: 'row',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.danger,
    textTransform: 'uppercase',
  },
});
