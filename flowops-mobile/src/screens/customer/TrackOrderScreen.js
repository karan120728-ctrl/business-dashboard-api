import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, Platform,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import io from 'socket.io-client';
import { apiRequest } from '../../api/client';
import { ENDPOINTS, API_URL } from '../../config/config';

export default function TrackOrderScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null); // { latitude, longitude }
  const [driverInfo, setDriverInfo] = useState({ name: 'Awaiting Driver', vehicle: 'N/A', address: 'Pending dispatch...' });
  const [socketConnected, setSocketConnected] = useState(false);
  const mapRef = useRef(null);

  // Helper to parse "lat,lng" string from backend
  const parseAndSetLocation = (locationStr, address = null, driverName = null, vehicleNum = null) => {
    if (!locationStr) return;
    const [latStr, lngStr] = locationStr.split(',');
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lngStr);

    if (!isNaN(latitude) && !isNaN(longitude)) {
      const newCoords = { latitude, longitude };
      setDriverLocation(newCoords);
      
      // Update info
      setDriverInfo(prev => ({
        name: driverName || prev.name || 'Driver',
        vehicle: vehicleNum || prev.vehicle || 'N/A',
        address: address || prev.address || 'In transit'
      }));

      // Animate map to new location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...newCoords,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }, 1000);
      }
    }
  };

  // 1. Socket.io Live Sync
  useEffect(() => {
    // Determine socket server root by removing '/api' from the backend URL
    const socketUrl = API_URL.replace('/api', '');
    console.log(`[Socket] Connecting to: ${socketUrl}`);
    
    const socket = io(socketUrl, {
      transports: ['websocket'],
      forceNew: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected. Joining room for Order #' + orderId);
      setSocketConnected(true);
      socket.emit('joinOrder', orderId);
    });

    socket.on('locationUpdate', (data) => {
      console.log('[Socket] Live location update received:', data);
      if (data.delivery_location) {
        parseAndSetLocation(data.delivery_location, data.current_address);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected.');
      setSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setSocketConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [orderId]);

  // 2. Polling Fallback (Activated only when Socket.io is disconnected)
  useEffect(() => {
    let pollInterval = null;

    const fetchLocation = async () => {
      try {
        const res = await apiRequest(ENDPOINTS.GET_LOCATION(orderId));
        if (res) {
          parseAndSetLocation(
            res.delivery_location,
            res.current_address,
            res.driver_name,
            res.vehicle_number
          );
        }
        setLoading(false);
      } catch (err) {
        console.warn('[Polling] Failed fetching location:', err.message);
        setLoading(false);
      }
    };

    // Initial fetch
    fetchLocation();

    // Set up polling fallback loop if socket is offline
    if (!socketConnected) {
      console.log('[Tracking] Activating HTTP polling fallback (5s)...');
      pollInterval = setInterval(fetchLocation, 5000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [orderId, socketConnected]);

  // Default region center: New Delhi
  const defaultRegion = {
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <SafeAreaView style={styles.bg}>
      {/* Connection Indicator Bar */}
      <View style={[styles.statusIndicator, { backgroundColor: socketConnected ? '#10b981' : '#f59e0b' }]}>
        <Text style={styles.statusText}>
          {socketConnected ? '📡  Live Real-time Tracking Active' : '⏱️  Offline (Polling GPS Fallback)'}
        </Text>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.loadingText}>Connecting to GPS satellite...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={driverLocation ? { ...driverLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 } : defaultRegion}
          >
            {driverLocation && (
              <Marker
                coordinate={driverLocation}
                title={driverInfo.name}
                description={driverInfo.vehicle}
              >
                <View style={styles.markerContainer}>
                  <Text style={styles.markerEmoji}>🚛</Text>
                </View>
              </Marker>
            )}
          </MapView>
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
  statusIndicator: { paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  mapContainer: { flex: 1, backgroundColor: '#e2e8f0' },
  map: { ...StyleSheet.absoluteFillObject },
  loadingArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  markerContainer: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  markerEmoji: { fontSize: 20 },
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
