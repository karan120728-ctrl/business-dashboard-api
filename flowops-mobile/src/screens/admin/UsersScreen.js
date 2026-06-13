import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

const ROLE_COLORS = { admin: '#4f46e5', superadmin: '#7c3aed', driver: '#f59e0b', customer: '#10b981' };

export default function UsersScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);

  const roles = ['customer', 'driver', 'admin', 'superadmin'];

  const load = useCallback(async () => {
    try {
      const res = await apiRequest(ENDPOINTS.USERS);
      setUsers(res.data || res.users || res || []);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRole = async () => {
    if (!newRole) { Alert.alert('Select a role'); return; }
    setSaving(true);
    try {
      await apiRequest(ENDPOINTS.UPDATE_USER_ROLE(editUser.id), { method: 'PATCH', body: { role: newRole } });
      setEditUser(null);
      load();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const confirmDelete = (user) => {
    Alert.alert('Delete User', `Remove ${user.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiRequest(ENDPOINTS.DELETE_USER(user.id), { method: 'DELETE' });
            load();
          } catch (e) { Alert.alert('Error', e.message); }
        }
      }
    ]);
  };

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: (ROLE_COLORS[item.role] || '#64748b') + '20' }]}>
        <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] || '#64748b' }]}>
          {item.name?.[0]?.toUpperCase() || '?'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.email}>{item.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] || '#64748b') + '15' }]}>
          <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] || '#64748b' }]}>
            {item.role?.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => { setEditUser(item); setNewRole(item.role); }}>
          <Text style={styles.editBtnText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.bg}>
      <View style={styles.toolbar}>
        <TextInput style={styles.searchInput} placeholder="Search users..." placeholderTextColor="#94a3b8" value={search} onChangeText={setSearch} />
      </View>

      {loading ? <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#4f46e5" />}
          ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
        />
      )}

      {/* Edit Role Modal */}
      <Modal visible={!!editUser} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: 24 }}>
          <Text style={styles.modalTitle}>Change Role</Text>
          {editUser && <Text style={styles.modalSub}>User: {editUser.name}</Text>}
          <Text style={styles.label}>Select New Role</Text>
          {roles.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.roleOption, newRole === r && styles.roleOptionActive]}
              onPress={() => setNewRole(r)}
            >
              <Text style={[styles.roleOptionText, newRole === r && { color: '#fff' }]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.btnPrimary} onPress={updateRole} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Save Changes</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={() => setEditUser(null)}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  toolbar: { padding: 14, paddingBottom: 8 },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, padding: 11, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  email: { fontSize: 12, color: '#64748b', marginTop: 1 },
  roleBadge: { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  roleText: { fontSize: 10, fontWeight: '700' },
  actions: { gap: 6 },
  editBtn: { padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8 },
  editBtnText: { fontSize: 16 },
  deleteBtn: { padding: 6, backgroundColor: '#fef2f2', borderRadius: 8 },
  deleteBtnText: { fontSize: 16 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  roleOption: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  roleOptionActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  roleOptionText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  btnPrimary: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnCancel: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnCancelText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
});
