import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { ENDPOINTS, DEBUG_MODE } from '../../config/config';
import { useCurrency } from '../../hooks/useCurrency';

const CurrencyToggle = ({ currency, onToggle }) => (
  <TouchableOpacity style={styles.currencyToggle} onPress={onToggle} activeOpacity={0.8}>
    <Text style={[styles.currencyOption, currency === 'INR' && styles.currencyActive]}>₹ INR</Text>
    <Text style={styles.currencySep}>|</Text>
    <Text style={[styles.currencyOption, currency === 'USD' && styles.currencyActive]}>$ USD</Text>
  </TouchableOpacity>
);

const StatCard = ({ icon, label, value, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  </View>
);

const NavCard = ({ icon, label, desc, onPress }) => (
  <TouchableOpacity style={styles.navCard} onPress={onPress} activeOpacity={0.75}>
    <Text style={styles.navIcon}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.navLabel}>{label}</Text>
      <Text style={styles.navDesc}>{desc}</Text>
    </View>
    <Text style={styles.navArrow}>›</Text>
  </TouchableOpacity>
);

export default function AdminDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { currency, toggleCurrency, formatPrice } = useCurrency();

  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiRequest(ENDPOINTS.DASHBOARD_STATS);
      setStats(data.data || data);
    } catch (e) {
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const onRefresh = () => { setRefreshing(true); loadStats(); };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.role}>{user?.role?.toUpperCase()} · {user?.businessName || 'FlowOps'}</Text>
        </View>
        <View style={styles.headerRight}>
          <CurrencyToggle currency={currency} onToggle={toggleCurrency} />
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard icon="📦" label="Total Orders"   value={stats?.totalOrders ?? '—'}    color="#4f46e5" />
          <StatCard icon="👥" label="Customers"      value={stats?.totalCustomers ?? '—'} color="#10b981" />
          <StatCard
            icon="💰"
            label="Revenue"
            value={stats?.totalRevenue ? formatPrice(stats.totalRevenue) : '—'}
            color="#f59e0b"
          />
          <StatCard icon="🚛" label="Active Drivers" value={stats?.activeDrivers ?? '—'} color="#6366f1" />
        </View>
      )}

      {/* Navigation Cards */}
      <Text style={styles.sectionTitle}>Management</Text>
      <NavCard icon="🛒" label="Orders"    desc="Create orders, assign drivers, track deliveries" onPress={() => navigation.navigate('Orders')} />
      <NavCard icon="👥" label="Customers" desc="Manage your customer directory"                  onPress={() => navigation.navigate('Customers')} />
      <NavCard icon="📦" label="Products"  desc="Add and manage products & pricing"               onPress={() => navigation.navigate('Products')} />
      <NavCard icon="💳" label="Payments"  desc="View invoices and payment status"                onPress={() => navigation.navigate('Payments')} />
      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <NavCard icon="🛡️" label="Users" desc="Manage staff roles and access" onPress={() => navigation.navigate('Users')} />
      )}
      {DEBUG_MODE && (
        <NavCard icon="🐛" label="App Debug Logs" desc="View local errors, network requests, and crash logs" onPress={() => navigation.navigate('DebugLogs')} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, backgroundColor: '#4f46e5', borderRadius: 14, padding: 16,
    flexWrap: 'wrap', gap: 10,
  },
  greeting: { fontSize: 17, fontWeight: '700', color: '#fff' },
  role: { fontSize: 11, color: '#c7d2fe', marginTop: 2, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Currency toggle (white version for dark header)
  currencyToggle: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5, gap: 4,
  },
  currencyOption: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  currencyActive: { color: '#fff', fontWeight: '800' },
  currencySep: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '47%', borderLeftWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  statIcon: { fontSize: 22 },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 1 },

  // Nav cards
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  navCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  navIcon: { fontSize: 24, width: 36, textAlign: 'center' },
  navLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  navDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  navArrow: { fontSize: 22, color: '#cbd5e1' },
});
