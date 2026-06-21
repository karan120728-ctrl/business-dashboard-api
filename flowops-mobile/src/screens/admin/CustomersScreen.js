import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';
import { useAuth } from '../../context/AuthContext';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!user?.business_id) return;
    
    setLoading(true);
    try {
      const res = await apiRequest(ENDPOINTS.CUSTOMERS);
      setCustomers(res.data || res.customers || res || []);
    } catch (e) { 
      console.error('[Customers Load Error]', e);
      if (customers.length === 0) Alert.alert('Error', e.message); 
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.business_id]);

  useEffect(() => {
    if (user?.business_id) {
       load();
    }
  }, [load, user?.business_id]);

  const addCustomer = async () => {
    if (!name.trim() || !email.trim()) { Alert.alert('Required', 'Name and email are required.'); return; }
    setSaving(true);
    try {
      await apiRequest(ENDPOINTS.CREATE_CUSTOMER, {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined },
      });
      setShowAdd(false); setName(''); setEmail(''); setPhone('');
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const filtered = customers.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() || '?'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>✉️ {item.email}</Text>
        {item.phone ? <Text style={styles.detail}>📱 {item.phone}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.bg}>
      <View style={styles.toolbar}>
        <TextInput style={styles.searchInput} placeholder="Search customers..." placeholderTextColor="#94a3b8" value={search} onChangeText={setSearch} />
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
          ListEmptyComponent={<Text style={styles.empty}>No customers found.</Text>}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: 24 }}>
          <Text style={styles.modalTitle}>Add Customer</Text>
          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} placeholder="Acme Corp" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} />
          <Text style={styles.label}>Email *</Text>
          <TextInput style={styles.input} placeholder="contact@acme.com" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>Phone (Optional)</Text>
          <TextInput style={styles.input} placeholder="555-0199" placeholderTextColor="#94a3b8" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TouchableOpacity style={styles.btnPrimary} onPress={addCustomer} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Save Customer</Text>}
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
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#4f46e5' },
  name: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  detail: { fontSize: 12, color: '#64748b', marginTop: 2 },
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
