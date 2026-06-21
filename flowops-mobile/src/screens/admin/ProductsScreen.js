import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';
import { useCurrency, USD_TO_INR } from '../../hooks/useCurrency';
import { useAuth } from '../../context/AuthContext';

const CurrencyToggle = ({ currency, onToggle }) => (
  <TouchableOpacity style={styles.currencyToggle} onPress={onToggle} activeOpacity={0.8}>
    <Text style={[styles.currencyOption, currency === 'INR' && styles.currencyActive]}>₹ INR</Text>
    <Text style={styles.currencySep}>|</Text>
    <Text style={[styles.currencyOption, currency === 'USD' && styles.currencyActive]}>$ USD</Text>
  </TouchableOpacity>
);

export default function ProductsScreen() {
  const { currency, toggleCurrency, formatPrice } = useCurrency();

  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [name, setName]           = useState('');
  const [price, setPrice]         = useState('');
  const [desc, setDesc]           = useState('');
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');

  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!user?.business_id) return;
    
    setLoading(true);
    try {
      const res = await apiRequest(ENDPOINTS.PRODUCTS);
      setProducts(res.data || res.products || res || []);
    } catch (e) { 
      console.error('[Products Load Error]', e);
      if (products.length === 0) Alert.alert('Error', e.message); 
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.business_id]);

  useEffect(() => {
    if (user?.business_id) {
       load();
    }
  }, [load, user?.business_id]);

  const addProduct = async () => {
    if (!name.trim() || !price) { Alert.alert('Required', 'Name and price are required.'); return; }
    const rawPrice = parseFloat(price);
    if (isNaN(rawPrice) || rawPrice <= 0) { Alert.alert('Invalid', 'Enter a valid price.'); return; }
    setSaving(true);
    
    // Always store in USD internally - convert if INR was entered
    const priceInUSD = currency === 'INR' ? rawPrice / USD_TO_INR : rawPrice;
    
    try {
      await apiRequest(ENDPOINTS.CREATE_PRODUCT, {
        method: 'POST',
        body: { 
          name: name.trim(), 
          price: parseFloat(priceInUSD.toFixed(4)), 
          description: desc.trim() || undefined 
        },
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
      <Text style={styles.price}>{formatPrice(item.price)}</Text>
    </View>
  );

  return (
    <View style={styles.bg}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        <CurrencyToggle currency={currency} onToggle={toggleCurrency} />
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
          <Text style={styles.label}>Price ({currency}) *</Text>
          <TextInput style={styles.input} placeholder={currency === 'INR' ? "e.g. 1999" : "e.g. 19.99"} placeholderTextColor="#94a3b8" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Short description..."
            placeholderTextColor="#94a3b8"
            value={desc}
            onChangeText={setDesc}
            multiline
          />
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
  toolbar: { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 8, alignItems: 'center' },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 11, fontSize: 13, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  currencyToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  currencyOption: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  currencyActive: { color: '#4f46e5', fontWeight: '800' },
  currencySep: { color: '#cbd5e1', fontSize: 12 },
  addBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
