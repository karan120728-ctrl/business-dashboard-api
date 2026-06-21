import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

import { useCurrency } from '../../hooks/useCurrency';
import * as ImagePicker from 'expo-image-picker';
import io from 'socket.io-client';
import { API_URL } from '../../config/config';

const STATUS_COLORS = {
  pending: '#f59e0b', processing: '#6366f1',
  out_for_delivery: '#3b82f6', delivered: '#10b981', cancelled: '#ef4444',
};

export default function CustomerDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { currency, toggleCurrency, formatPrice } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create Order Modal
  const [showCreate, setShowCreate] = useState(false);
  const [prodId, setProdId] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [oRes, pRes] = await Promise.all([
        apiRequest(ENDPOINTS.ORDERS),
        apiRequest(ENDPOINTS.PRODUCTS),
      ]);
      setOrders(oRes.data || oRes.orders || oRes || []);
      setProducts(pRes.data || pRes.products || pRes || []);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();

    // 🔥 SOCKET.IO REAL-TIME UPDATES
    const socketUrl = API_URL.replace('/api', '');
    const socket = io(socketUrl, { transports: ['websocket'] });

    socket.on('connect', () => {
      if (user?.id) {
        socket.emit('join', user.id);
      }
    });

    socket.on('statusUpdate', ({ orderId, status }) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    });

    socket.on('notification', () => {
      // Refresh list if a notification arrives (optional, but good for sync)
      load();
    });

    return () => socket.disconnect();
  }, [load, user?.id]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const createOrder = async () => {
    if (!prodId || !qty) { Alert.alert('Select a product and quantity'); return; }
    setSaving(true);
    try {
      // Find customer ID for this user (they are authenticated as a customer)
      // The backend uses req.user.business_id, but we need to pass the target customer_id
      // In a multi-tenant setup, we should find which 'customer' record matches this user email.
      const res = await apiRequest(ENDPOINTS.CREATE_ORDER, {
        method: 'POST',
        body: {
          customer: user.customerId, // Assuming this is set in user object
          products: [{ product: parseInt(prodId), quantity: parseInt(qty) }]
        }
      });
      setShowCreate(false); setProdId(''); setQty('1');
      load();
      Alert.alert('Success', 'Order placed successfully!');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const approveDelivery = async (orderId) => {
    Alert.alert('Confirm Delivery', 'Is this package delivered to your satisfaction?', [
      { text: 'Not Yet', style: 'cancel' },
      { 
        text: 'Yes, Delivered', 
        onPress: async () => {
          try {
            await apiRequest(ENDPOINTS.UPDATE_ORDER_STATUS(orderId), {
              method: 'PATCH',
              body: { status: 'delivered' }
            });
            load();
            Alert.alert('Verified', 'Delivery confirmed and invoice generated.');
          } catch (e) { Alert.alert('Error', e.message); }
        }
      }
    ]);
  };

  const renderOrder = ({ item }) => {
    const color = STATUS_COLORS[item.status] || '#64748b';
    const isActive = item.status === 'out_for_delivery';
    const isPendingProofApproval = item.status === 'out_for_delivery' && item.proof_image_url;
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Order #{item.id}</Text>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.status?.replace(/_/g, ' ').toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.info}>📦 {item.product_name || '—'} × {item.quantity}</Text>
        <Text style={styles.info}>💰 {formatPrice(item.total_price || 0)}</Text>
        {item.driver_name && <Text style={styles.info}>🚛 Driver: {item.driver_name}</Text>}

        <View style={styles.actionRow}>
          {isPendingProofApproval && (
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => approveDelivery(item.id)}
            >
              <Text style={styles.approveBtnText}>✅ Approve Delivery</Text>
            </TouchableOpacity>
          )}
          {isActive && (
            <TouchableOpacity
              style={styles.trackBtn}
              onPress={() => navigation.navigate('TrackOrder', { orderId: item.id })}
            >
              <Text style={styles.trackBtnText}>📍 Track Live</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.invoiceBtn}
            onPress={() => navigation.navigate('Invoices')}
          >
            <Text style={styles.invoiceBtnText}>🧾 Invoices</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const active = orders.filter(o => o.status === 'out_for_delivery').length;
  const delivered = orders.filter(o => o.status === 'delivered').length;

  return (
    <View style={styles.bg}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.role}>CUSTOMER PORTAL</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.invoicesHeaderBtn} onPress={() => navigation.navigate('Invoices')}>
            <Text style={styles.invoicesHeaderText}>🧾 Invoices</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{orders.length}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#3b82f6' }]}>{active}</Text>
          <Text style={styles.statLabel}>In Transit</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#10b981' }]}>{delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Orders</Text>

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
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No orders yet.</Text>
            </View>
          }
        />
      )}

      {/* Floating Create Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create Order Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>New Order</Text>
          <Text style={styles.label}>Select Product</Text>
          <View style={styles.picker}>
            {products.map(p => (
              <TouchableOpacity 
                key={p.id} 
                style={[styles.pickerItem, prodId === String(p.id) && styles.pickerItemActive]}
                onPress={() => setProdId(String(p.id))}
              >
                <Text style={[styles.pickerText, prodId === String(p.id) && { color: '#fff' }]}>
                  {p.name} — {formatPrice(p.price)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Quantity</Text>
          <TextInput 
            style={styles.input} 
            value={qty} 
            onChangeText={setQty} 
            keyboardType="number-pad" 
            placeholder="How many?"
          />

          <TouchableOpacity style={styles.btnPrimary} onPress={createOrder} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Place Order</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={() => setShowCreate(false)}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#4f46e5', padding: 16 },
  greeting: { fontSize: 17, fontWeight: '700', color: '#fff' },
  role: { fontSize: 11, color: '#c7d2fe', marginTop: 2, fontWeight: '600' },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  invoicesHeaderBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  invoicesHeaderText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsStrip: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#4f46e5' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#e2e8f0' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  info: { fontSize: 13, color: '#475569', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  trackBtn: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' },
  trackBtnText: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  invoiceBtn: { flex: 1, backgroundColor: '#faf5ff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e9d5ff' },
  invoiceBtnText: { fontSize: 13, fontWeight: '700', color: '#7c3aed' },
  approveBtn: { flex: 2, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#bbf7d0' },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#10b981' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#94a3b8' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  fabText: { fontSize: 32, color: '#fff', fontWeight: '300', marginBottom: 2 },
  modalContent: { flex: 1, backgroundColor: '#f8fafc', padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  picker: { gap: 8 },
  pickerItem: { backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  pickerItemActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pickerText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 4 },
  btnPrimary: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 30 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnCancel: { padding: 16, alignItems: 'center', marginTop: 8 },
  btnCancelText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});
