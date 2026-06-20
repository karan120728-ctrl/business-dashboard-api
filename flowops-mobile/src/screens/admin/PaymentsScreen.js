import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';
import { useCurrency } from '../../hooks/useCurrency';

const STATUS_COLORS = { paid: '#10b981', unpaid: '#f59e0b', overdue: '#ef4444' };

const CurrencyToggle = ({ currency, onToggle }) => (
  <TouchableOpacity style={styles.currencyToggle} onPress={onToggle} activeOpacity={0.8}>
    <Text style={[styles.currencyOption, currency === 'INR' && styles.currencyActive]}>₹ INR</Text>
    <Text style={styles.currencySep}>|</Text>
    <Text style={[styles.currencyOption, currency === 'USD' && styles.currencyActive]}>$ USD</Text>
  </TouchableOpacity>
);

export default function PaymentsScreen() {
  const { currency, toggleCurrency, formatPrice } = useCurrency();

  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(ENDPOINTS.INVOICES);
      setPayments(res.data || res.invoices || res || []);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = payments.filter(p =>
    !search ||
    p.id?.toString().includes(search) ||
    p.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.status?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const outstanding = payments
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const renderItem = ({ item }) => {
    const color = STATUS_COLORS[item.status] || '#64748b';
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.invoiceId}>INV-{item.id}</Text>
          <Text style={styles.customer}>👤 {item.customer_name || '—'}</Text>
          <Text style={styles.order}>Order #{item.order_id}</Text>
          {item.due_date && (
            <Text style={styles.date}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
          )}
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.amount}>{formatPrice(item.amount || 0)}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status?.toUpperCase()}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.bg}>
      {/* Summary Bar */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>💰 Collected</Text>
          <Text style={[styles.summaryValue, { color: '#10b981' }]}>{formatPrice(totalRevenue)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>⏳ Outstanding</Text>
          <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{formatPrice(outstanding)}</Text>
        </View>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search invoices..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        <CurrencyToggle currency={currency} onToggle={toggleCurrency} />
      </View>

      {loading ? <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#4f46e5"
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>No invoices found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  summaryRow: { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 0 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  toolbar: { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 8, alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 11, fontSize: 13, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  currencyToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  currencyOption: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  currencyActive: { color: '#4f46e5', fontWeight: '800' },
  currencySep: { color: '#cbd5e1', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  invoiceId: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  customer: { fontSize: 12, color: '#475569' },
  order: { fontSize: 12, color: '#475569' },
  date: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  amount: { fontSize: 17, fontWeight: '800', color: '#4f46e5' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
});
