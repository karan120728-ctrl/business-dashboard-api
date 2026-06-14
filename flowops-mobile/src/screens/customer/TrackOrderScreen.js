import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import io from 'socket.io-client';
import { apiRequest } from '../../api/client';
import { ENDPOINTS, API_URL } from '../../config/config';

const buildMapHTML = (lat, lng, driverName) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${lat}, ${lng}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    var truckIcon = L.divIcon({
      html: '<div style="background:#4f46e5;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.3);">🚛</div>',
      className: '',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    var marker = L.marker([${lat}, ${lng}], { icon: truckIcon })
      .addTo(map)
      .bindPopup('<b>${driverName || 'Driver'}</b><br>Live Location')
      .openPopup();

    // Listen for location updates from React Native
    document.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.lat && data.lng) {
          marker.setLatLng([data.lat, data.lng]);
          map.setView([data.lat, data.lng], 15, { animate: true });
        }
      } catch(err) {}
    });
  </script>
</body>
</html>
`;

const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;

export default function TrackOrderScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverInfo, setDriverInfo] = useState({ name: 'Awaiting Driver', vehicle: 'N/A', address: 'Pending dispatch...' });
  const [socketConnected, setSocketConnected] = useState(false);
  const webviewRef = useRef(null);

  const applyLocation = (lat, lng, address, driverName, vehicleNum) => {
    if (isNaN(lat) || isNaN(lng)) return;

    setDriverLocation({ lat, lng });
    setDriverInfo(prev => ({
      name: driverName || prev.name || 'Driver',
      vehicle: vehicleNum || prev.vehicle || 'N/A',
      address: address || prev.address || 'In transit',
    }));

    // Push update into WebView map
    if (webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({ lat, lng }));
    }
  };

  const parseLocationStr = (locationStr, address, driverName, vehicleNum) => {
    if (!locationStr) return;
    const [latStr, lngStr] = locationStr.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    applyLocation(lat, lng, address, driverName, vehicleNum);
  };

  // 1. Socket.io Live Sync
  useEffect(() => {
    const socketUrl = API_URL.replace('/api', '');
    const socket = io(socketUrl, { transports: ['websocket'], forceNew: true });

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('joinOrder', orderId);
    });

    socket.on('locationUpdate', (data) => {
      if (data.delivery_location) {
        parseLocationStr(data.delivery_location, data.current_address);
      }
    });

    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));

    return () => socket.disconnect();
  }, [orderId]);

  // 2. HTTP Polling Fallback
  useEffect(() => {
    let pollInterval = null;

    const fetchLocation = async () => {
      try {
        const res = await apiRequest(ENDPOINTS.GET_LOCATION(orderId));
        if (res) {
          parseLocationStr(res.delivery_location, res.current_address, res.driver_name, res.vehicle_number);
        }
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    fetchLocation();

    if (!socketConnected) {
      pollInterval = setInterval(fetchLocation, 5000);
    }

    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [orderId, socketConnected]);

  const lat = driverLocation?.lat ?? DEFAULT_LAT;
  const lng = driverLocation?.lng ?? DEFAULT_LNG;

  return (
    <SafeAreaView style={styles.bg}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: socketConnected ? '#10b981' : '#f59e0b' }]}>
        <Text style={styles.statusText}>
          {socketConnected ? '📡  Live Real-time Tracking Active' : '⏱️  Polling GPS Fallback'}
        </Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.loadingText}>Connecting to GPS satellite...</Text>
          </View>
        ) : (
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html: buildMapHTML(lat, lng, driverInfo.name) }}
            style={styles.map}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingArea}>
                <ActivityIndicator size="large" color="#4f46e5" />
              </View>
            )}
          />
        )}
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.orderTitle}>Order #{orderId}</Text>
            <Text style={styles.driverLabel}>ASSIGNED COURIER</Text>
          </View>
          <View style={styles.driverAvatar}>
            <Text style={styles.avatarText}>{driverInfo.name?.[0]?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Courier Name</Text>
          <Text style={styles.value}>{driverInfo.name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Vehicle Number</Text>
          <Text style={styles.value}>{driverInfo.vehicle || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Last Known Address</Text>
          <Text style={styles.value} numberOfLines={2}>{driverInfo.address || 'Waiting for first signal...'}</Text>
        </View>

        <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
          <Text style={styles.btnBackText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  statusBar: { paddingVertical: 6, alignItems: 'center' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  mapContainer: { flex: 1, backgroundColor: '#e2e8f0' },
  map: { flex: 1 },
  loadingArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  orderTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  driverLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, marginTop: 2 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#4f46e5' },
  infoRow: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 14, fontWeight: '700', color: '#334155' },
  btnBack: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 14 },
  btnBackText: { color: '#475569', fontSize: 14, fontWeight: '700' },
});
