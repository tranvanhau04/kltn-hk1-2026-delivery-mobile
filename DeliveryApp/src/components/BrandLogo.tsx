import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Truck, Zap, MapPin, Package } from 'lucide-react-native';

export interface BrandLogoProps {
  size?: 'large' | 'medium' | 'small';
  variant?: 'dark' | 'light';
  animated?: boolean;
  showBadgeOnly?: boolean;
  showSlogan?: boolean;
  showPills?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'medium',
  variant = 'dark',
  animated = false,
  showBadgeOnly = false,
  showSlogan = true,
  showPills = false,
}) => {
  const isDark = variant === 'dark';

  // Dimensions based on size prop
  let badgeSize = 76;
  let borderRadius = 22;
  let truckSize = 38;
  let zapSize = 12;
  let miniBadgeSize = 22;
  let titleFontSize = 24;
  let sloganFontSize = 12;

  if (size === 'large') {
    badgeSize = 96;
    borderRadius = 28;
    truckSize = 48;
    zapSize = 14;
    miniBadgeSize = 26;
    titleFontSize = 28;
    sloganFontSize = 13;
  } else if (size === 'small') {
    badgeSize = 52;
    borderRadius = 16;
    truckSize = 26;
    zapSize = 9;
    miniBadgeSize = 18;
    titleFontSize = 18;
    sloganFontSize = 10;
  }

  // Animation values for pulse ring (60fps native driver)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!animated) return;

    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.45,
            duration: 1600,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    pulse.start();

    return () => pulse.stop();
  }, [animated, pulseAnim, pulseOpacity]);

  return (
    <View style={styles.container}>
      {/* ─── Layer 1: Pulse Ring (Outer Halo) ─── */}
      <View style={styles.badgeWrapper}>
        {animated && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                width: badgeSize + 28,
                height: badgeSize + 28,
                borderRadius: (badgeSize + 28) / 2,
                transform: [{ scale: pulseAnim }],
                opacity: pulseOpacity,
              },
            ]}
          />
        )}

        {/* ─── Layer 2: Main Squircle Badge (3D Coral / Red) ─── */}
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius,
            },
          ]}
        >
          {/* Top Glassmorphism Highlight / Sheen */}
          <View
            style={[
              styles.glassSheen,
              {
                borderTopLeftRadius: borderRadius - 2,
                borderTopRightRadius: borderRadius - 2,
              },
            ]}
          />

          {/* Central Truck Vector */}
          <View style={styles.truckIconWrap}>
            <Truck color="#FFFFFF" size={truckSize} strokeWidth={2.2} />
          </View>

          {/* Top-Right Mini Badge (Instant Zap Emblem) */}
          <View
            style={[
              styles.miniBadge,
              {
                width: miniBadgeSize,
                height: miniBadgeSize,
                borderRadius: miniBadgeSize / 2,
              },
            ]}
          >
            <Zap color="#FEF08A" size={zapSize} />
          </View>
        </View>
      </View>

      {/* ─── Layer 3: Typography & Brand Slogan ─── */}
      {!showBadgeOnly && (
        <View style={styles.typographyContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.titleSmart,
                { fontSize: titleFontSize },
                isDark ? styles.textWhite : styles.textDark,
              ]}
            >
              SMART
            </Text>
            <Text style={[styles.titleExpress, { fontSize: titleFontSize }]}>EXPRESS</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          </View>

          {showSlogan && (
            <Text
              style={[
                styles.sloganText,
                { fontSize: sloganFontSize },
                !isDark && { color: '#64748B' },
              ]}
            >
              Nền tảng Điều phối & Giao vận Thông minh
            </Text>
          )}

          {/* Feature Pills */}
          {showPills && (
            <View style={styles.pillsRow}>
              <View style={styles.pillItem}>
                <Zap size={11} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={styles.pillText}>Định tuyến VRP</Text>
              </View>
              <View style={styles.pillDot} />
              <View style={styles.pillItem}>
                <MapPin size={11} color="#3B82F6" style={{ marginRight: 4 }} />
                <Text style={styles.pillText}>Live GPS</Text>
              </View>
              <View style={styles.pillDot} />
              <View style={styles.pillItem}>
                <Package size={11} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={styles.pillText}>e-POD</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: '#EF4444',
  },
  badge: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
    position: 'relative',
    overflow: 'visible',
  },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  truckIconWrap: {
    transform: [{ rotate: '-3deg' }],
  },
  miniBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#B91C1C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  typographyContainer: {
    alignItems: 'center',
    marginTop: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSmart: {
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  textWhite: {
    color: '#F8FAFC',
  },
  textDark: {
    color: '#0F172A',
  },
  titleExpress: {
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 1.8,
    marginLeft: 4,
  },
  proBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
    alignSelf: 'center',
  },
  proText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sloganText: {
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pillItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  pillDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#64748B',
    marginHorizontal: 8,
  },
});
