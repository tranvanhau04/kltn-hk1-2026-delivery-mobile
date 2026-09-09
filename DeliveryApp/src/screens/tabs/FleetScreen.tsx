import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Truck,
  MapPin,
  Phone,
  Navigation,
  Fuel,
  ShieldCheck,
  Wrench,
  CircleCheck,
  AlertCircle,
  Weight,
  Box,
  CalendarClock,
} from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY, COMMON_STYLES } from '../../theme/theme';
import { useAppContext } from '../../context/AppContext';

// ─── Mock data for fleet-specific fields ────────────────────────────────────
const DEPOT = {
  name: 'IUH Logistics Hub 1 – Go Vap Depot',
  address: '12 Nguyễn Văn Bảo, Phường 4, Gò Vấp, Hồ Chí Minh',
  phone: '02838951234',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=12+Nguyen+Van+Bao+Go+Vap+HCMC',
};

const CURRENT_WEIGHT_KG = 28.5;
const CURRENT_VOLUME_M3 = 0.18;
const FUEL_PERCENT = 85;
const MAINTENANCE_DATE = '2026-10-15';

// ─── Capacity Progress Bar ───────────────────────────────────────────────────
type CapacityBarProps = {
  label: string;
  current: number;
  max: number;
  unit: string;
  icon: React.ReactNode;
};

const CapacityBar = ({ label, current, max, unit, icon }: CapacityBarProps) => {
  const ratio = Math.min(current / max, 1);
  const pct = Math.round(ratio * 100);
  const isWarning = pct > 85;
  const barColor = isWarning ? COLORS.primary : COLORS.success;

  return (
    <View style={styles.capBlock}>
      <View style={styles.capLabelRow}>
        {icon}
        <Text style={styles.capLabel}>{label}</Text>
        <View style={[styles.capBadge, { backgroundColor: isWarning ? '#FEE2E2' : '#D1FAE5' }]}>
          <Text style={[styles.capBadgeText, { color: barColor }]}>{pct}%</Text>
        </View>
      </View>
      <View style={styles.capTrack}>
        <View style={[styles.capFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.capDetail}>
        {current} {unit} / {max} {unit}
      </Text>
    </View>
  );
};

// ─── Checklist Row ───────────────────────────────────────────────────────────
type CheckRowProps = {
  icon: React.ReactNode;
  label: string;
  value: string | boolean;
  togglable?: boolean;
  onToggle?: (v: boolean) => void;
};

const CheckRow = ({ icon, label, value, togglable = false, onToggle }: CheckRowProps) => (
  <View style={styles.checkRow}>
    <View style={styles.checkLeft}>
      {icon}
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
    {togglable ? (
      <Switch
        value={value as boolean}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.border, true: COLORS.success }}
        thumbColor={COLORS.surface}
      />
    ) : (
      <Text style={styles.checkValue}>{value as string}</Text>
    )}
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const FleetScreen = () => {
  const { driver } = useAppContext();

  const [tireOk, setTireOk] = useState(true);
  const [helmetOk, setHelmetOk] = useState(true);

  const handleCallHub = () => {
    Linking.openURL(`tel:${DEPOT.phone}`).catch(() =>
      Alert.alert('Error', 'Unable to open phone dialer.')
    );
  };

  const handleDirections = () => {
    Linking.openURL(DEPOT.mapsUrl).catch(() =>
      Alert.alert('Error', 'Unable to open Maps.')
    );
  };

  const vehicleLabel =
    driver.vehicle_type === 'Xe máy' ? 'Motorbike – 150cc' : 'Light Van – 500kg';

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SIZES.padding_md }}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={TYPOGRAPHY.header}>Vehicle & Fleet Specs</Text>
            <Text style={TYPOGRAPHY.bodySecondary}>Manage your vehicle and base depot</Text>
          </View>
          <View style={styles.assignedBadge}>
            <Truck color={COLORS.primary} size={14} />
            <Text style={styles.assignedText}>Assigned</Text>
          </View>
        </View>

        {/* ── Vehicle Profile Card ── */}
        <View style={COMMON_STYLES.card}>
          {/* Top: icon + plate */}
          <View style={styles.vehicleTop}>
            <View style={styles.vehicleIconWrap}>
              <Truck color={COLORS.primary} size={36} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.plateTag}>
                <Text style={styles.plateText}>{driver.license_plate}</Text>
              </View>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{vehicleLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Capacity bars */}
          <Text style={[TYPOGRAPHY.title, { marginBottom: 12 }]}>Payload Capacity</Text>
          <CapacityBar
            label="Weight Load"
            current={CURRENT_WEIGHT_KG}
            max={driver.max_weight_kg}
            unit="kg"
            icon={<Weight color={COLORS.textSecondary} size={16} style={{ marginRight: 6 }} />}
          />
          <View style={{ height: 12 }} />
          <CapacityBar
            label="Volume Load"
            current={CURRENT_VOLUME_M3}
            max={driver.max_volume_m3}
            unit="m³"
            icon={<Box color={COLORS.textSecondary} size={16} style={{ marginRight: 6 }} />}
          />
        </View>

        {/* ── Depot Info Card ── */}
        <View style={COMMON_STYLES.card}>
          <View style={styles.depotHeader}>
            <View style={styles.depotIconWrap}>
              <MapPin color={COLORS.primary} size={20} />
            </View>
            <Text style={[TYPOGRAPHY.title, { flex: 1, marginLeft: 10 }]}>Base Depot / Hub</Text>
          </View>

          <Text style={styles.depotName}>{DEPOT.name}</Text>
          <View style={styles.depotAddressRow}>
            <MapPin color={COLORS.textSecondary} size={13} style={{ marginRight: 4 }} />
            <Text style={styles.depotAddress}>{DEPOT.address}</Text>
          </View>

          <View style={styles.depotActions}>
            <TouchableOpacity
              style={[styles.depotBtn, { backgroundColor: COLORS.success }]}
              onPress={handleCallHub}
              activeOpacity={0.8}
            >
              <Phone color="#fff" size={16} />
              <Text style={styles.depotBtnText}>Call Hub Manager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.depotBtn, { backgroundColor: COLORS.primary }]}
              onPress={handleDirections}
              activeOpacity={0.8}
            >
              <Navigation color="#fff" size={16} />
              <Text style={styles.depotBtnText}>Directions to Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Maintenance & Safety Checklist ── */}
        <View style={COMMON_STYLES.card}>
          <View style={styles.checklistHeader}>
            <ShieldCheck color={COLORS.success} size={20} />
            <Text style={[TYPOGRAPHY.title, { marginLeft: 8 }]}>Maintenance & Safety</Text>
          </View>

          <CheckRow
            icon={<Fuel color={COLORS.textSecondary} size={18} style={{ marginRight: 10 }} />}
            label="Fuel / Battery"
            value={`${FUEL_PERCENT}% – Good`}
          />
          <View style={styles.rowDivider} />
          <CheckRow
            icon={<CircleCheck color={COLORS.textSecondary} size={18} style={{ marginRight: 10 }} />}
            label="Tire Pressure OK"
            value={tireOk}
            togglable
            onToggle={setTireOk}
          />
          <View style={styles.rowDivider} />
          <CheckRow
            icon={<ShieldCheck color={COLORS.textSecondary} size={18} style={{ marginRight: 10 }} />}
            label="Helmet Check OK"
            value={helmetOk}
            togglable
            onToggle={setHelmetOk}
          />
          <View style={styles.rowDivider} />
          <View style={styles.checkRow}>
            <View style={styles.checkLeft}>
              <CalendarClock color={COLORS.textSecondary} size={18} style={{ marginRight: 10 }} />
              <Text style={styles.checkLabel}>Scheduled Maintenance</Text>
            </View>
            <View style={styles.maintenanceBadge}>
              <AlertCircle color={COLORS.primary} size={13} />
              <Text style={styles.maintenanceBadgeText}>{MAINTENANCE_DATE}</Text>
            </View>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.checkRow}>
            <View style={styles.checkLeft}>
              <Wrench color={COLORS.textSecondary} size={18} style={{ marginRight: 10 }} />
              <Text style={styles.checkLabel}>Next Service Due</Text>
            </View>
            <Text style={styles.checkValue}>15,000 km</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.padding_md,
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  assignedText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  vehicleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plateTag: {
    backgroundColor: '#1A1D1F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  plateText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1.5,
  },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  capBlock: {
    gap: 6,
  },
  capLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  capBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  capBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  capTrack: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  capFill: {
    height: '100%',
    borderRadius: 5,
  },
  capDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  depotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  depotIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  depotName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  depotAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  depotAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  depotActions: {
    flexDirection: 'row',
    gap: 10,
  },
  depotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: SIZES.radius_md,
    gap: 6,
  },
  depotBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  checkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  checkValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  maintenanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  maintenanceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
