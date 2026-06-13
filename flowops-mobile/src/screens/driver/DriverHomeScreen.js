import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

const STATUS_COLORS = {
  pending: '#f59e0b', processing: '#6366f1',
  out_for_delivery: '#3b82f6', delivered: '#10b981', cancelled: '#ef4444',
};

export default function DriverHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(ENDPOINTS.ORDERS);
      const all = res.data || res.orders || res || [];
      // Show only orders assigned to this driver
      const mine = all.filter(o =>
        o.driver_id === user?.id || o.driver_email === user?.email || o.status === 'out_for_delivery'
      );
      setOrders(mine.length ? mine : all.filter(o => o.status === 'out_for_delivery'));
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const renderOrder = ({ item }) => {
    const color = STATUS_COLORS[item.status] || '#64748b';
    const isActive = item.status === 'out_for_delivery';
    return (
      <View style={[styles.card, isActive && styles.cardActive]}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Order #{item.id}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status?.replace(/_/g, ' ').toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.info}>👤 {item.customer_name || '—'}</Text>
        <Text style={styles.info}>📦 {item.product_name || '—'} × {item.quantity}</Text>
        {item.vehicle_number && <Text style={styles.info}>🚗 {item.vehicle_number}</Text>}

        {isActive && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.trackBtn}
              onPress={() => navigation.navigate('Tracking', { orderId: item.id })}
            >
              <Text style={styles.trackBtnText}>📡 Send Location</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.podBtn}
              onPress={() => navigation.navigate('Proof', { orderId: item.id })}
            >
              <Text style={styles.podBtnText}>📷 Submit POD</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.bg}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.role}>DRIVER · {user?.businessName || 'FlowOps'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{orders.filter(o => o.status === 'out_for_delivery').length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{orders.filter(o => o.status === 'delivered').length}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{orders.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Deliveries</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={i => String(i.id)}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f46e5" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🚛</Text>
              <Text style={styles.emptyText}>No deliveries assigned yet.</Text>
              <Text style={styles.emptySub}>Pull to refresh when your admin assigns an order.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#4f46e5', padding: 16, paddingTop: 16 },
  greeting: { fontSize: 17, fontWeight: '700', color: '#fff' },
  role: { fontSize: 11, color: '#c7d2fe', marginTop: 2, fontWeight: '600' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsStrip: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#4f46e5' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#e2e8f0' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardActive: { borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  info: { fontSize: 13, color: '#475569', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  trackBtn: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' },
  trackBtnText: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  podBtn: { flex: 1, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#bbf7d0' },
  podBtnText: { fontSize: 13, fontWeight: '700', color: '#10b981' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 30 },
});
