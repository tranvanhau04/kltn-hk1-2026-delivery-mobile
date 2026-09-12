const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'DeliveryApp', 'src', 'screens', 'tabs', 'TrackScreen.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/const \[\_isNavigating, setIsNavigating\] = useState\(false\);/, 'const [isNavigating, setIsNavigating] = useState(false);');

content = content.replace(/Locate,/, 'Locate,\n  Phone,');

content = content.replace(
  /const nextStop = stops\.find\(s => s\.status === 'PENDING' \|\| s\.status === 'ARRIVED'\);/,
  `const fallbackStop = stops.find(s => s.status === 'PENDING' || s.status === 'ARRIVED');
  const activeStop = navParams?.selectedStopId 
    ? stops.find(s => s.id === navParams.selectedStopId) || fallbackStop 
    : fallbackStop;
  
  const isActiveStopSelected = navParams?.selectedStopId != null;`
);

content = content.replace(
  /\{\/\* ── Next Stop Card ── \*\/\}\s*\{nextStop \? \([\s\S]*?\) : \(/,
  `{/* ── Active Task Card ── */}
        {activeStop ? (
          <View style={[COMMON_STYLES.card, styles.nextStopCard]}>
            <View style={styles.nextStopHeader}>
              <View style={[styles.nextStopBadge, isActiveStopSelected && { backgroundColor: COLORS.warning }]}>
                <Text style={styles.nextStopBadgeText}>
                  {isActiveStopSelected ? 'NHIỆM VỤ ĐANG CHỌN' : 'ĐIỂM TIẾP THEO'}
                </Text>
              </View>
              <Text style={styles.nextStopCode}>#{activeStop.sequence_no} · {activeStop.order.code}</Text>
            </View>

            <Text style={styles.nextStopName}>{activeStop.order.receiver_name}</Text>
            <View style={styles.nextStopAddressRow}>
              <MapPin color={COLORS.textSecondary} size={13} style={{ marginRight: 4 }} />
              <Text style={styles.nextStopAddress} numberOfLines={2}>{activeStop.order.delivery_address}</Text>
            </View>

            {activeStop.order.cod_amount > 0 && (
              <View style={styles.codChip}>
                <Text style={styles.codChipText}>
                  COD: ₫{activeStop.order.cod_amount.toLocaleString('vi-VN')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[COMMON_STYLES.primaryButton, { marginTop: 14 }]}
              onPress={handleNavigate}
              activeOpacity={0.8}
            >
              <Navigation color="#fff" size={18} style={{ marginRight: 8 }} />
              <Text style={TYPOGRAPHY.buttonText}>Bắt đầu di chuyển</Text>
            </TouchableOpacity>
          </View>
        ) : (`
);

content = content.replace(
  /return \(\s*<SafeAreaView style=\{COMMON_STYLES.container\} edges=\{\['top'\]\}>/,
  `if (isNavigating) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827' }}>
        <OSMMapView
          style={{ ...StyleSheet.absoluteFillObject }}
          latitude={driverCoord?.latitude || Number(activeStop?.order?.lat) || 10.8222}
          longitude={driverCoord?.longitude || Number(activeStop?.order?.lng) || 106.6875}
          driverCoords={driverCoord}
          stops={activeStop ? [{
            id: activeStop.id,
            lat: Number(activeStop.order.lat),
            lng: Number(activeStop.order.lng),
            stopNumber: activeStop.sequence_no,
            status: activeStop.status,
          }] : []}
          routePolyline={[]}
          navPolyline={navCoords}
          zoom={18}
        />

        <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={['top']}>
          <View style={[styles.navBanner, { margin: SIZES.padding_md, borderRadius: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.navBannerTitle}>
                Đang dẫn đường tới: {activeStop?.order?.receiver_name}
              </Text>
              <Text style={styles.navBannerAddress} numberOfLines={1}>
                {activeStop?.order?.delivery_address}
              </Text>
            </View>
            <View style={styles.navBannerStats}>
              <Text style={styles.navBannerTime}>
                {navDurationMin ? \`\${Math.round(navDurationMin)} phút\` : '--'}
              </Text>
              <Text style={styles.navBannerDist}>
                {navDistanceKm ? \`\${navDistanceKm.toFixed(1)} km\` : '--'}
              </Text>
            </View>
          </View>
        </SafeAreaView>

        <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} edges={['bottom']}>
          <View style={[COMMON_STYLES.card, { margin: SIZES.padding_md, gap: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPOGRAPHY.title}>{activeStop?.order?.receiver_name}</Text>
                <Text style={TYPOGRAPHY.bodySecondary} numberOfLines={1}>{activeStop?.order?.delivery_address}</Text>
              </View>
              <TouchableOpacity style={{ backgroundColor: COLORS.primary, padding: 10, borderRadius: 20 }}>
                <Phone color="#fff" size={20} />
              </TouchableOpacity>
            </View>
            
            {activeStop?.order?.cod_amount ? (
              <Text style={{ fontWeight: '600', color: COLORS.primary }}>
                COD: ₫{activeStop.order.cod_amount.toLocaleString('vi-VN')}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <TouchableOpacity
                style={[COMMON_STYLES.primaryButton, { flex: 1, backgroundColor: COLORS.danger }]}
                onPress={() => setIsNavigating(false)}
              >
                <Text style={TYPOGRAPHY.buttonText}>Kết thúc</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[COMMON_STYLES.primaryButton, { flex: 1, backgroundColor: COLORS.success }]}
                onPress={() => {
                  setIsNavigating(false);
                  if (activeStop) {
                    // Navigate to StopDetail if they press "Đã đến nơi"
                    // (Requires useNavigation, but we can just end navigation for now)
                  }
                }}
              >
                <Text style={TYPOGRAPHY.buttonText}>Đã đến nơi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={COMMON_STYLES.container} edges={['top']}>`
);

content = content.replace(
  /\{navParams\?\.autoStartNavigation && navCoords\.length > 0 && \([\s\S]*?\}\)/,
  ''
);

fs.writeFileSync(filePath, content);
console.log('Patched TrackScreen.tsx');
