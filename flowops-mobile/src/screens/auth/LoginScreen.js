import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      Alert.alert('Login Failed', e.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}><Text style={styles.logoIconText}>⬡</Text></View>
          <Text style={styles.logoText}>FlowOps</Text>
          <Text style={styles.logoSub}>B2B Logistics Platform</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="admin@flowops.com"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Register here</Text></Text>
          </TouchableOpacity>

          {/* Quick Login Demo */}
          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>Experience Role-Based Access</Text>
            <View style={styles.demoRow}>
              <TouchableOpacity style={styles.demoBtn} onPress={() => quickLogin('admin@flowops.com', 'admin123')}>
                <Text style={styles.demoBtnText}>🛡️ Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.demoBtn} onPress={() => quickLogin('driver@flowops.com', 'password')}>
                <Text style={styles.demoBtnText}>🚛 Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.demoBtn} onPress={() => quickLogin('customer@flowops.com', 'password')}>
                <Text style={styles.demoBtnText}>👤 Customer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  logoIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logoIconText: { fontSize: 26, color: '#fff' },
  logoText: { fontSize: 26, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  logoSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 13, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 4 },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eyeBtn: { padding: 12, backgroundColor: '#f1f5f9', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  eyeText: { fontSize: 16 },
  forgotText: { fontSize: 12, color: '#4f46e5', textAlign: 'right', marginTop: 6, marginBottom: 20 },
  btnPrimary: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkText: { textAlign: 'center', fontSize: 13, color: '#64748b' },
  linkBold: { color: '#4f46e5', fontWeight: '600' },
  demoSection: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  demoTitle: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoBtn: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  demoBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
});
