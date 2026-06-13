import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

export default function RegisterScreen({ navigation }) {
  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessVal, setBusinessVal] = useState('');
  const [loading, setLoading] = useState(false);

  const roles = [
    { key: 'customer', label: '👤 Customer' },
    { key: 'driver', label: '🚛 Driver' },
    { key: 'admin', label: '💼 Admin' },
  ];

  const businessLabel = role === 'admin' ? 'Business Name' : 'Business Invite Code';
  const businessPlaceholder = role === 'admin' ? 'e.g. Acme Logistics' : 'e.g. FLOW-XXXXXX';
  const businessHint = role === 'admin'
    ? 'This will create a new private workspace for your business.'
    : 'Ask your manager for the company invite code.';

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !businessVal.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        phone: phone.trim() || undefined,
        businessName: role === 'admin' ? businessVal.trim() : undefined,
        businessCode: role !== 'admin' ? businessVal.trim() : undefined,
      };
      const data = await apiRequest(ENDPOINTS.REGISTER, { method: 'POST', body: payload });

      if (role === 'admin' && data.data?.businessCode) {
        Alert.alert(
          '🚀 Business Created!',
          `Your Invite Code is: ${data.data.businessCode}\n\nShare this with your Drivers and Customers.`,
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      } else {
        Alert.alert('Success', 'Account created! Please sign in.', [
          { text: 'Sign In', onPress: () => navigation.navigate('Login') },
        ]);
      }
    } catch (e) {
      Alert.alert('Registration Failed', e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}><Text style={styles.logoIconText}>⬡</Text></View>
          <Text style={styles.logoText}>Join FlowOps</Text>
          <Text style={styles.logoSub}>Create your account to get started</Text>
        </View>

        <View style={styles.card}>
          {/* Role Selector */}
          <View style={styles.roleRow}>
            {roles.map(r => (
              <TouchableOpacity
                key={r.key}
                style={[styles.roleBtn, role === r.key && styles.roleBtnActive]}
                onPress={() => setRole(r.key)}
              >
                <Text style={[styles.roleBtnText, role === r.key && styles.roleBtnTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="john@example.com" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Mobile Number <Text style={styles.optional}>(Optional)</Text></Text>
          <TextInput style={styles.input} placeholder="+91 98765 43210" placeholderTextColor="#94a3b8" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="Min 6 characters" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.label}>{businessLabel}</Text>
          <TextInput style={styles.input} placeholder={businessPlaceholder} placeholderTextColor="#94a3b8" value={businessVal} onChangeText={setBusinessVal} />
          <Text style={styles.hint}>{businessHint}</Text>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logoIconText: { fontSize: 24, color: '#fff' },
  logoText: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  logoSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 22, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  roleRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 20, gap: 4 },
  roleBtn: { flex: 1, padding: 9, borderRadius: 8, alignItems: 'center' },
  roleBtnActive: { backgroundColor: '#4f46e5' },
  roleBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  roleBtnTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  optional: { fontWeight: '400', color: '#94a3b8' },
  input: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 13, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 2 },
  hint: { fontSize: 11, color: '#94a3b8', marginBottom: 4, marginTop: 3 },
  btnPrimary: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20, marginBottom: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkText: { textAlign: 'center', fontSize: 13, color: '#64748b' },
  linkBold: { color: '#4f46e5', fontWeight: '600' },
});
