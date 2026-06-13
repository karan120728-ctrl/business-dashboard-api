import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

export default function TrackingScreen({ route }) {
  const { orderId } = route.params;
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const [sendCount, setSendCount] = useState(0);
  const [status, setStatus] = useState('inactive'); // inactive | active | error
  const intervalRef = useRef(null);
  const retryIntervalRef = useRef(null);
  const locationSub = useRef(null);
  const offlineQueue = useRef([]);

  useEffect(() => {
    loadOfflineQueueFromDisk();
    return () => {
      stopTracking();
    };
  }, []);

  const saveOfflineQueueToDisk = async () => {
    try {
      await SecureStore.setItemAsync(`offline_gps_${orderId}`, JSON.stringify(offlineQueue.current));
    } catch (err) {
      console.warn('Failed to save offline GPS queue:', err.message);
    }
  };

  const loadOfflineQueueFromDisk = async () => {
    try {
      const raw = await SecureStore.getItemAsync(`offline_gps_${orderId}`);
      if (raw) {
        offlineQueue.current = JSON.parse(raw);
        console.log(`Loaded offline queue for Order #${orderId}: ${offlineQueue.current.length} items`);
      }
    } catch (err) {
      console.warn('Failed to load offline GPS queue:', err.message);
    }
  };

  const processOfflineQueue = async () => {
    if (offlineQueue.current.length === 0) return;
    console.log(`[Offline Sync] Retrying ${offlineQueue.current.length} queued updates...`);
    const items = [...offlineQueue.current];

    for (const item of items) {
      try {
        await apiRequest(ENDPOINTS.UPDATE_LOCATION(orderId), {
          method: 'POST',
          body: { lat: item.lat, lng: item.lng },
        });
        // Remove from local queue
        offlineQueue.current = offlineQueue.current.filter(x => x.timestamp !== item.timestamp);
        await saveOfflineQueueToDisk();
        setSendCount(c => c + 1);
        setLastSent(`Synced offline @ ${new Date().toLocaleTimeString()}`);
      } catch (err) {
        console.warn('[Offline Sync] Failed to send item, still offline:', err.message);
        break; // Stop loop, retry on next cycle
      }
    }
  };

  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to broadcast your position.');
      return false;
    }
    return true;
  };

  const sendLocation = async (latitude, longitude) => {
    const timestamp = Date.now();
    try {
      await apiRequest(ENDPOINTS.UPDATE_LOCATION(orderId), {
        method: 'POST',
        body: { lat: latitude, lng: longitude },
      });
      setLastSent(new Date().toLocaleTimeString());
      setSendCount(c => c + 1);

      // Try syncing any backlog since we have connection now
      if (offlineQueue.current.length > 0) {
        await processOfflineQueue();
      }
    } catch (e) {
      console.warn('Location send failed, saving for offline sync:', e.message);
      offlineQueue.current.push({ lat: latitude, lng: longitude, timestamp });
      await saveOfflineQueueToDisk();
    }
  };

  const startTracking = async () => {
    const permitted = await requestPermission();
    if (!permitted) return;

    setStatus('active');
    setTracking(true);

    // Get immediate location
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, accuracy: acc } = loc.coords;
      setCoords({ latitude, longitude });
      setAccuracy(acc?.toFixed(0));
      await sendLocation(latitude, longitude);
    } catch (e) {
      Alert.alert('GPS Error', 'Could not get your location. Try again.');
      setStatus('error');
      setTracking(false);
      return;
    }

    // Watch position
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      (loc) => {
        const { latitude, longitude, accuracy: acc } = loc.coords;
        setCoords({ latitude, longitude });
        setAccuracy(acc?.toFixed(0));
      }
    );

    // Broadcast location every 15 seconds
    intervalRef.current = setInterval(async () => {
      if (locationSub.current) {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await sendLocation(loc.coords.latitude, loc.coords.longitude);
        } catch (e) {
          console.warn('Could not read current GPS coordinates:', e.message);
        }
      }
    }, 15000);

    // Try processing offline queue every 30 seconds
    retryIntervalRef.current = setInterval(async () => {
      await processOfflineQueue();
    }, 30000);
  };

  const stopTracking = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (retryIntervalRef.current) { clearInterval(retryIntervalRef.current); retryIntervalRef.current = null; }
    if (locationSub.current) { locationSub.current.remove(); locationSub.current = null; }
    setTracking(false);
    setStatus('inactive');
  };

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.scroll}>
      {/* Status Card */}
      <View style={[styles.statusCard, { borderColor: status === 'active' ? '#10b981' : status === 'error' ? '#ef4444' : '#e2e8f0' }]}>
        <View style={[styles.statusDot, { backgroundColor: status === 'active' ? '#10b981' : status === 'error' ? '#ef4444' : '#94a3b8' }]} />
        <Text style={[styles.statusText, { color: status === 'active' ? '#10b981' : status === 'error' ? '#ef4444' : '#94a3b8' }]}>
          {status === 'active' ? 'GPS BROADCASTING' : status === 'error' ? 'GPS ERROR' : 'GPS INACTIVE'}
        </Text>
      </View>

      <Text style={styles.orderLabel}>Order #{orderId}</Text>

      {/* Coords */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📍 Current Coordinates</Text>
        {coords ? (
          <>
            <Text style={styles.coordText}>Lat: {coords.latitude.toFixed(6)}</Text>
            <Text style={styles.coordText}>Lon: {coords.longitude.toFixed(6)}</Text>
            {accuracy && <Text style={styles.coordSub}>Accuracy: ±{accuracy}m</Text>}
          </>
        ) : (
          <Text style={styles.coordSub}>Waiting for GPS signal...</Text>
        )}
      </View>

      {/* Stats */}
      {tracking && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{sendCount}</Text>
            <Text style={styles.statLabel}>Updates Sent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{lastSent || '—'}</Text>
            <Text style={styles.statLabel}>Last Sent</Text>
          </View>
        </View>
      )}

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoBoxText}>
          📡 Your location is automatically sent to the backend every 15 seconds while tracking is active. The admin and customer can see your live position on the map.
        </Text>
      </View>

      {/* Controls */}
      {!tracking ? (
        <TouchableOpacity style={styles.btnStart} onPress={startTracking}>
          <Text style={styles.btnText}>▶ Start Sending Location</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.btnStop} onPress={stopTracking}>
          <Text style={styles.btnText}>⬛ Stop Broadcasting</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, paddingBottom: 40 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1.5, marginBottom: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  orderLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 14 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  coordText: { fontSize: 15, fontWeight: '700', color: '#0f172a', fontFamily: 'monospace', marginBottom: 2 },
  coordSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statNum: { fontSize: 18, fontWeight: '800', color: '#4f46e5' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  infoBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 20 },
  infoBoxText: { fontSize: 13, color: '#3b82f6', lineHeight: 20 },
  btnStart: { backgroundColor: '#10b981', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnStop: { backgroundColor: '#ef4444', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
