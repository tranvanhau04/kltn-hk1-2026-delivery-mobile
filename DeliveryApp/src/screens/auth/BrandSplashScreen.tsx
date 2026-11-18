import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../../components/BrandLogo';

export const BrandSplashScreen: React.FC = () => {
  // Animated progress bar (0% -> 100%)
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in whole screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [fadeAnim, progressAnim]);

  const progressInterpolation = progressAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: ['15%', '75%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" {...({ backgroundColor: '#0F172A' } as any)} />

      {/* ─── Ambient Glow Circles (Deep Lighting) ─── */}
      <View style={styles.ambientGlowTop} pointerEvents="none" />
      <View style={styles.ambientGlowBottom} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.centerContent, { opacity: fadeAnim }]}>
          {/* Main Layered Brand Logo */}
          <BrandLogo
            size="large"
            variant="dark"
            animated={true}
            showSlogan={true}
            showPills={true}
          />
        </Animated.View>

        {/* ─── Bottom Loading & System Info ─── */}
        <View style={styles.bottomSection}>
          {/* Animated Progress Bar */}
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressInterpolation,
                },
              ]}
            />
          </View>

          <Text style={styles.syncStatusText}>Đang đồng bộ dữ liệu hệ thống...</Text>
          <Text style={styles.copyrightText}>IUH Logistics Technology • v1.0.0</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 20 : 16,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 24,
  },
  progressBarTrack: {
    width: 200,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  syncStatusText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 12,
    letterSpacing: 0.3,
  },
  copyrightText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 18,
  },
});
