import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(ENDPOINTS.PRODUCTS);
      setProducts(res.data || res.products || res || []);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addProduct = async () => {
    if (!name.trim() || !price) { Alert.alert('Required', 'Name and price are required.'); return; }
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) { Alert.alert('Invalid', 'Enter a valid price.'); return; }
    setSaving(true);
    try {
      await apiRequest(ENDPOINTS.CREATE_PRODUCT, {
        method: 'POST',
        body: { name: name.trim(), price: parseFloat(price), description: desc.trim() || undefined },
      });
      setShowAdd(false); setName(''); setPrice(''); setDesc('');
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.iconWrap}><Text style={styles.icon}>📦</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
      </View>
      <Text style={styles.price}>${parseFloat(item.price || 0).toFixed(2)}</Text>
    </View>
  );

  return (
    <View style={styles.bg}>
      <View style={styles.toolbar}>
        <TextInput style={styles.searchInput} placeholder="Search products..." placeholderTextColor="#94a3b8" value={search} onChangeText={setSearch} />
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f46e5" />}
          ListEmptyComponent={<Text style={styles.empty}>No products found.</Text>}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: 24 }}>
          <Text style={styles.modalTitle}>Add Product</Text>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Pro Plan" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} />
          <Text style={styles.label}>Price (USD) *</Text>
          <TextInput style={styles.input} placeholder="e.g. 99.99" placeholderTextColor="#94a3b8" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Short description..." placeholderTextColor="#94a3b8" value={desc} onChangeText={setDesc} multiline />
          <TouchableOpacity style={styles.btnPrimary} onPress={addProduct} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Save Product</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={() => setShowAdd(false)}>
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  name: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  desc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '800', color: '#4f46e5' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 13, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  btnPrimary: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnCancel: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  btnCancelText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
});
