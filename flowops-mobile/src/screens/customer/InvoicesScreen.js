import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';
import { API_URL } from '../../config/config';

const STATUS_COLORS = { paid: '#10b981', unpaid: '#f59e0b', overdue: '#ef4444' };

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(ENDPOINTS.INVOICES);
      setInvoices(res.data || res.invoices || res || []);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPayment = async (invoice) => {
    if (invoice.status === 'paid') {
      Alert.alert('Already Paid', 'This invoice has already been paid.');
      return;
    }
    try {
      // Get the payment URL from backend
      const res = await apiRequest(ENDPOINTS.PAY_INVOICE(invoice.payment_token || invoice.id), {
        method: 'POST',
      });
      if (res.url) {
        await Linking.openURL(res.url);
      } else {
        Alert.alert('Payment', 'Payment link unavailable. Contact your admin.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not open payment link.');
    }
  };

  const renderItem = ({ item }) => {
    const color = STATUS_COLORS[item.status] || '#64748b';
    const isPaid = item.status === 'paid';
    const isOverdue = item.status === 'overdue';

    return (
      <View style={[styles.card, isOverdue && styles.cardOverdue]}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.invoiceId}>INV-{item.id}</Text>
            <Text style={styles.orderRef}>Order #{item.order_id}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Total Due</Text>
          <Text style={styles.amountValue}>${parseFloat(item.amount || 0).toFixed(2)}</Text>
        </View>

        {item.due_date && (
          <Text style={styles.dueDate}>
            {isOverdue ? '⚠️ ' : '📅 '}Due: {new Date(item.due_date).toLocaleDateString()}
          </Text>
        )}

        {!isPaid && (
          <TouchableOpacity
            style={[styles.payBtn, isOverdue && styles.payBtnOverdue]}
            onPress={() => openPayment(item)}
          >
            <Text style={styles.payBtnText}>
              🔒 {isOverdue ? 'Pay Overdue Amount' : 'Pay Now'}
            </Text>
          </TouchableOpacity>
        )}

        {isPaid && item.used_at && (
          <Text style={styles.paidOn}>✅ Paid on {new Date(item.used_at).toLocaleDateString()}</Text>
        )}
      </View>
    );
  };

  const totalDue = invoices
    .filter(i => i.status !== 'paid')
    .reduce((s, i) => s + parseFloat(i.amount || 0), 0);

  return (
    <View style={styles.bg}>
      {totalDue > 0 && (
        <View style={styles.dueBanner}>
          <Text style={styles.dueBannerText}>⏳ Outstanding Balance: ${totalDue.toFixed(2)}</Text>
        </View>
      )}

      {loading ? <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={invoices}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f46e5" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyText}>No invoices yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  dueBanner: { backgroundColor: '#fef3c7', padding: 12, borderBottomWidth: 1, borderBottomColor: '#fde68a', alignItems: 'center' },
  dueBannerText: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardOverdue: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  invoiceId: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  orderRef: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f1f5f9', marginBottom: 10 },
  amountLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  amountValue: { fontSize: 22, fontWeight: '800', color: '#4f46e5' },
  dueDate: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  payBtn: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 12, alignItems: 'center' },
  payBtnOverdue: { backgroundColor: '#ef4444' },
  payBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  paidOn: { fontSize: 12, color: '#10b981', fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#94a3b8' },
});
