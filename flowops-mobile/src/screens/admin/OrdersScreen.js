import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

const STATUS_COLORS = {
  pending: '#f59e0b', processing: '#6366f1', out_for_delivery: '#3b82f6',
  delivered: '#10b981', cancelled: '#ef4444',
};

const Badge = ({ status }) => (
  <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[status] || '#64748b') + '20' }]}>
    <Text style={[styles.badgeText, { color: STATUS_COLORS[status] || '#64748b' }]}>
      {status?.replace(/_/g, ' ').toUpperCase()}
    </Text>
  </View>
);

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [custId, setCustId] = useState('');
  const [prodId, setProdId] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const [oRes, cRes, pRes] = await Promise.all([
        apiRequest(ENDPOINTS.ORDERS),
        apiRequest(ENDPOINTS.CUSTOMERS),
        apiRequest(ENDPOINTS.PRODUCTS),
      ]);
      setOrders(oRes.data || oRes.orders || oRes || []);
      setCustomers(cRes.data || cRes.customers || cRes || []);
      setProducts(pRes.data || pRes.products || pRes || []);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createOrder = async () => {
    if (!custId || !prodId || !qty) { Alert.alert('Required', 'Fill all fields.'); return; }
    setSaving(true);
    try {
      await apiRequest(ENDPOINTS.CREATE_ORDER, {
        method: 'POST',
        body: { 
          customer: parseInt(custId), 
          products: [{ product: parseInt(prodId), quantity: parseInt(qty) }] 
        },
      });
      setShowCreate(false); setCustId(''); setProdId(''); setQty('1');
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const filtered = orders.filter(o =>
    !search || o.id?.toString().includes(search) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const renderOrder = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orderId}>Order #{item.id}</Text>
        <Badge status={item.status} />
      </View>
      <Text style={styles.cardText}>👤 {item.customer_name || '—'}</Text>
      <Text style={styles.cardText}>📦 {item.product_name || '—'} × {item.quantity}</Text>
      <Text style={styles.cardText}>💰 ${parseFloat(item.total_price || 0).toFixed(2)}</Text>
      {item.driver_name && <Text style={styles.cardText}>🚛 {item.driver_name}</Text>}
    </View>
  );

  return (
    <View style={styles.bg}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search orders..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f46e5" />}
          ListEmptyComponent={<Text style={styles.empty}>No orders found.</Text>}
        />
      )}

      {/* Create Order Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: 24 }}>
          <Text style={styles.modalTitle}>Create Order</Text>

          <Text style={styles.label}>Customer</Text>
          <View style={styles.pickerWrap}>
            {customers.map(c => (
              <TouchableOpacity key={c.id} style={[styles.pickItem, custId === String(c.id) && styles.pickItemActive]} onPress={() => setCustId(String(c.id))}>
                <Text style={[styles.pickText, custId === String(c.id) && { color: '#fff' }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Product</Text>
          <View style={styles.pickerWrap}>
            {products.map(p => (
              <TouchableOpacity key={p.id} style={[styles.pickItem, prodId === String(p.id) && styles.pickItemActive]} onPress={() => setProdId(String(p.id))}>
                <Text style={[styles.pickText, prodId === String(p.id) && { color: '#fff' }]}>{p.name} — ${p.price}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Quantity</Text>
          <TextInput style={styles.input} value={qty} onChangeText={setQty} keyboardType="number-pad" />

          <TouchableOpacity style={styles.btnPrimary} onPress={createOrder} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create Order</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={() => setShowCreate(false)}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  toolbar: { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 8 },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 11, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  addBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardText: { fontSize: 13, color: '#475569', marginTop: 2 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 13, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  pickerWrap: { gap: 6 },
  pickItem: { backgroundColor: '#fff', borderRadius: 8, padding: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  pickItemActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pickText: { fontSize: 13, color: '#0f172a' },
  btnPrimary: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnCancel: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  btnCancelText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
});
