import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface OSMMapViewProps {
  latitude?: number; // Initial fallback lat
  longitude?: number; // Initial fallback lng
  zoom?: number;
  style?: any;
  driverCoords?: { latitude: number; longitude: number } | null;
  stops?: Array<{ id: string; lat: number; lng: number; stopNumber: number; status: string }>;
  routePolyline?: Array<[number, number]>;
  navPolyline?: Array<[number, number]>;
  targetCoord?: { latitude: number; longitude: number };
}

export const OSMMapView: React.FC<OSMMapViewProps> = ({ 
  latitude = 10.8222, 
  longitude = 106.6875, 
  zoom = 15, 
  style,
  driverCoords,
  stops,
  routePolyline,
  navPolyline,
  targetCoord
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);

  // We only generate the HTML shell ONCE to avoid flashing.
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; }
        html, body, #map { height: 100%; width: 100vw; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${latitude}, ${longitude}], ${zoom});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        var driverMarker = null;
        var stopsLayer = L.layerGroup().addTo(map);
        var routeLayer = null;
        var navLayer = null;

        function updateMap(data) {
          try {
            // Update Stops
            if (data.stops) {
              stopsLayer.clearLayers();
              data.stops.forEach(function(stop) {
                var color = stop.status === 'COMPLETED' ? '#10B981' : (stop.status === 'PENDING' ? '#F59E0B' : '#6B7280');
                if (stop.status === 'ARRIVED') color = '#3B82F6'; // Blue for next stop
                
                var iconHtml = '<div style="background:' + color + ';color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-family:sans-serif;font-weight:bold;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);">' + stop.stopNumber + '</div>';
                
                var icon = L.divIcon({ html: iconHtml, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
                L.marker([stop.lat, stop.lng], { icon: icon }).addTo(stopsLayer);
              });
            }

            // Update Route Polyline (Background)
            if (data.routePolyline && data.routePolyline.length > 0) {
              if (routeLayer) map.removeLayer(routeLayer);
              routeLayer = L.polyline(data.routePolyline, { color: '#9CA3AF', weight: 4, dashArray: '8, 8' }).addTo(map);
            } else if (routeLayer) {
              map.removeLayer(routeLayer);
              routeLayer = null;
            }

            // Update Nav Polyline (Active)
            if (data.navPolyline && data.navPolyline.length > 0) {
              if (navLayer) map.removeLayer(navLayer);
              navLayer = L.polyline(data.navPolyline, { color: '#2563EB', weight: 6 }).addTo(map);
            } else if (navLayer) {
              map.removeLayer(navLayer);
              navLayer = null;
            }

            // Update Driver Location & Center Map
            if (data.driverCoords && data.driverCoords.latitude && data.driverCoords.longitude) {
              if (!driverMarker) {
                var dIcon = L.divIcon({ html: '<div style="background:#EF4444;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>', className: '', iconSize: [18, 18], iconAnchor: [9, 9] });
                driverMarker = L.marker([data.driverCoords.latitude, data.driverCoords.longitude], { icon: dIcon }).addTo(map);
              } else {
                driverMarker.setLatLng([data.driverCoords.latitude, data.driverCoords.longitude]);
              }
            }

            // Target Pin (e.g. Stop Detail)
            if (data.targetCoord && data.targetCoord.latitude && data.targetCoord.longitude) {
              var tIcon = L.divIcon({
                className: 'custom-destination-pin',
                html: '<div style="background-color: #2563EB; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });
              L.marker([data.targetCoord.latitude, data.targetCoord.longitude], { icon: tIcon }).addTo(map);
            }
          } catch(e) {
            window.ReactNativeWebView.postMessage("Error: " + e.message);
          }
        }

        // Signal React Native that we are ready
        window.ReactNativeWebView.postMessage("READY");
      </script>
    </body>
    </html>
  `;

  useEffect(() => {
    if (isReady && webViewRef.current) {
      const data = { driverCoords, stops, routePolyline, navPolyline, targetCoord };
      const script = `updateMap(${JSON.stringify(data)});`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [driverCoords, stops, routePolyline, navPolyline, targetCoord, isReady]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'READY') {
            setIsReady(true);
          } else {
            console.log("OSM WebView:", event.nativeEvent.data);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
