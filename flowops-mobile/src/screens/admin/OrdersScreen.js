import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput,
  Modal, ScrollView, Platform,
} from 'react-native';
import { apiRequest, apiUpload } from '../../api/client';
import { ENDPOINTS } from '../../config/config';
import { useCurrency } from '../../hooks/useCurrency';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// ─── Constants ───────────────────────────────────────────────────────────────
const ALL_STATUSES = [
  { key: 'pending',          label: 'Pending',          color: '#f59e0b', icon: '🕐' },
  { key: 'processing',       label: 'Processing',       color: '#6366f1', icon: '⚙️' },
  { key: 'out_for_delivery', label: 'Out for Delivery', color: '#3b82f6', icon: '🚛' },
  { key: 'delivered',        label: 'Delivered',        color: '#10b981', icon: '✅' },
  { key: 'cancelled',        label: 'Cancelled',        color: '#ef4444', icon: '❌' },
];

const STATUS_COLORS = {
  pending: '#f59e0b', processing: '#6366f1', out_for_delivery: '#3b82f6',
  delivered: '#10b981', cancelled: '#ef4444',
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Badge = ({ status }) => (
  <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[status] || '#64748b') + '25' }]}>
    <Text style={[styles.badgeText, { color: STATUS_COLORS[status] || '#64748b' }]}>
      {status?.replace(/_/g, ' ').toUpperCase()}
    </Text>
  </View>
);

const CurrencyToggle = ({ currency, onToggle }) => (
  <TouchableOpacity style={styles.currencyToggle} onPress={onToggle} activeOpacity={0.8}>
    <Text style={[styles.currencyOption, currency === 'INR' && styles.currencyActive]}>₹ INR</Text>
    <Text style={styles.currencySep}>|</Text>
    <Text style={[styles.currencyOption, currency === 'USD' && styles.currencyActive]}>$ USD</Text>
  </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrdersScreen({ navigation }) {
  const { currency, toggleCurrency, formatPrice } = useCurrency();

  const [orders, setOrders]       = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState('');

  // Create order modal
  const [showCreate, setShowCreate] = useState(false);
  const [custId, setCustId]         = useState('');
  const [prodId, setProdId]         = useState('');
  const [qty, setQty]               = useState('1');
  const [saving, setSaving]         = useState(false);

  // Status change modal
  const [statusModal, setStatusModal]   = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────────
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
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Create order ─────────────────────────────────────────────────────────────
  const createOrder = async () => {
    if (!custId || !prodId || !qty) { Alert.alert('Required', 'Fill all fields.'); return; }
    setSaving(true);
    try {
      await apiRequest(ENDPOINTS.CREATE_ORDER, {
        method: 'POST',
        body: {
          customer: parseInt(custId),
          products: [{ product: parseInt(prodId), quantity: parseInt(qty) }],
        },
      });
      setShowCreate(false); setCustId(''); setProdId(''); setQty('1');
      load();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Change status ─────────────────────────────────────────────────────────────
  const openStatusModal = (order) => {
    setSelectedOrder(order);
    setStatusModal(true);
  };

  const handleDeliveredOverride = async (order) => {
    setUpdatingStatus(true);
    try {
      await apiRequest(ENDPOINTS.UPDATE_ORDER_STATUS(order.id), {
        method: 'PATCH',
        body: { status: 'delivered' },
      });
      setStatusModal(false);
      setSelectedOrder(null);
      load();
      Alert.alert('Success', 'Order marked as Delivered (Admin override).');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeliveredWithPhoto = async (order) => {
    try {
      // 1. Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture proof.');
        return;
      }

      // 2. Open camera (no gallery allowed, live capture only)
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setUpdatingStatus(true);

      // 3. Compress and resize the image
      const asset = result.assets[0];
      let compressedUri = asset.uri;
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        compressedUri = manipResult.uri;
      } catch (error) {
        console.warn('Image manipulation failed, using original:', error.message);
      }

      // 4. Construct form data and upload
      const formData = new FormData();
      formData.append('proof_image', {
        uri: compressedUri,
        type: 'image/jpeg',
        name: `pod_order_${order.id}.jpg`
      });

      await apiUpload(ENDPOINTS.SUBMIT_POD(order.id), formData);

      setStatusModal(false);
      setSelectedOrder(null);
      load();
      Alert.alert('Success', 'Proof uploaded and delivery confirmed successfully!');
    } catch (e) {
      Alert.alert('Upload Failed', e.message || 'Could not upload proof. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const applyStatus = async (newStatus) => {
    if (!selectedOrder) return;

    if (newStatus === 'delivered') {
      Alert.alert(
        'Confirm Delivery',
        'How would you like to mark this order as Delivered?',
        [
          {
            text: '📷 Take Proof Photo',
            onPress: () => handleDeliveredWithPhoto(selectedOrder),
          },
          {
            text: '⚡ Mark without Photo (Override)',
            onPress: () => handleDeliveredOverride(selectedOrder),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
      return;
    }

    setUpdatingStatus(true);
    try {
      await apiRequest(ENDPOINTS.UPDATE_ORDER_STATUS(selectedOrder.id), {
        method: 'PATCH',
        body: { status: newStatus },
      });
      setStatusModal(false);
      setSelectedOrder(null);
      load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────────
  const filtered = orders.filter(o =>
    !search ||
    o.id?.toString().includes(search) ||
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render order card ─────────────────────────────────────────────────────────
  const renderOrder = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orderId}>Order #{item.id}</Text>
        <Badge status={item.status} />
      </View>
      <Text style={styles.cardText}>👤 {item.customer_name || '—'}</Text>
      <Text style={styles.cardText}>📦 {item.product_name || '—'} × {item.quantity}</Text>
      <Text style={styles.cardText}>💰 {formatPrice(item.total_price || 0)}</Text>
      {item.driver_name && <Text style={styles.cardText}>🚛 {item.driver_name}</Text>}
      {/* Status change button */}
      <TouchableOpacity
        style={[styles.statusBtn, { borderColor: STATUS_COLORS[item.status] || '#6366f1' }]}
        onPress={() => openStatusModal(item)}
        activeOpacity={0.75}
      >
        <Text style={[styles.statusBtnText, { color: STATUS_COLORS[item.status] || '#6366f1' }]}>
          🔄  Change Status
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.bg}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search orders..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        <CurrencyToggle currency={currency} onToggle={toggleCurrency} />
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#4f46e5"
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>No orders found.</Text>}
        />
      )}

      {/* ── STATUS CHANGE MODAL ─────────────────────────────────────────────── */}
      <Modal
        visible={statusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setStatusModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !updatingStatus && setStatusModal(false)}
        >
          <View style={styles.statusSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              Change Status — Order #{selectedOrder?.id}
            </Text>
            <Text style={styles.sheetSub}>
              Current:{' '}
              <Text style={{ fontWeight: '700', color: STATUS_COLORS[selectedOrder?.status] || '#64748b' }}>
                {selectedOrder?.status?.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </Text>

            {updatingStatus ? (
              <ActivityIndicator color="#4f46e5" size="large" style={{ marginVertical: 24 }} />
            ) : (
              <View style={styles.statusOptions}>
                {ALL_STATUSES.map(s => {
                  const isCurrent = s.key === selectedOrder?.status;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[
                        styles.statusOption,
                        { borderColor: s.color + '50' },
                        isCurrent && { backgroundColor: s.color + '15', borderColor: s.color },
                      ]}
                      onPress={() => !isCurrent && applyStatus(s.key)}
                      disabled={isCurrent}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.statusOptionIcon}>{s.icon}</Text>
                      <Text style={[styles.statusOptionLabel, { color: isCurrent ? s.color : '#0f172a' }]}>
                        {s.label}
                      </Text>
                      {isCurrent && (
                        <View style={[styles.currentBadge, { backgroundColor: s.color }]}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setStatusModal(false)}
              disabled={updatingStatus}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── CREATE ORDER MODAL ──────────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.createModal} contentContainerStyle={{ padding: 24 }}>
          <Text style={styles.modalTitle}>Create Order</Text>

          <Text style={styles.label}>Customer</Text>
          <View style={styles.pickerWrap}>
            {customers.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.pickItem, custId === String(c.id) && styles.pickItemActive]}
                onPress={() => setCustId(String(c.id))}
              >
                <Text style={[styles.pickText, custId === String(c.id) && { color: '#fff' }]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Product</Text>
          <View style={styles.pickerWrap}>
            {products.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.pickItem, prodId === String(p.id) && styles.pickItemActive]}
                onPress={() => setProdId(String(p.id))}
              >
                <Text style={[styles.pickText, prodId === String(p.id) && { color: '#fff' }]}>
                  {p.name} — {formatPrice(p.price)}
                </Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },

  // Toolbar
  toolbar: { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 8, alignItems: 'center' },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 11,
    fontSize: 13, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0',
  },
  currencyToggle: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 8, paddingVertical: 8, gap: 4,
  },
  currencyOption: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  currencyActive: { color: '#4f46e5', fontWeight: '800' },
  currencySep: { color: '#cbd5e1', fontSize: 12 },
  addBtn: {
    backgroundColor: '#4f46e5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Order card
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardText: { fontSize: 13, color: '#475569', marginTop: 3 },
  statusBtn: {
    marginTop: 12, borderRadius: 8, borderWidth: 1.5,
    paddingVertical: 8, alignItems: 'center',
  },
  statusBtnText: { fontSize: 13, fontWeight: '700' },

  // Status modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  statusSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  sheetSub: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  statusOptions: { gap: 10 },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, borderWidth: 1.5,
  },
  statusOptionIcon: { fontSize: 20 },
  statusOptionLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  currentBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cancelBtn: {
    marginTop: 16, borderRadius: 12, padding: 15, alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },

  // Create modal
  createModal: { flex: 1, backgroundColor: '#f8fafc' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#fff', borderRadius: 10, padding: 13,
    fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0',
  },
  pickerWrap: { gap: 6 },
  pickItem: { backgroundColor: '#fff', borderRadius: 8, padding: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  pickItemActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pickText: { fontSize: 13, color: '#0f172a' },
  btnPrimary: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnCancel: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  btnCancelText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
});
