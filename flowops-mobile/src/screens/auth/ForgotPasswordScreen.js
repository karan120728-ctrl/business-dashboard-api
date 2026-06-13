import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1 = email, 2 = OTP + new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOTP = async () => {
    if (!email.trim()) { Alert.alert('Required', 'Please enter your email.'); return; }
    setLoading(true);
    try {
      await apiRequest(ENDPOINTS.FORGOT_PASSWORD, { method: 'POST', body: { email: email.trim() } });
      Alert.alert('OTP Sent', 'Check your email inbox (and spam) for the 6-digit code.');
      setStep(2);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!otp || !newPassword) { Alert.alert('Required', 'Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await apiRequest(ENDPOINTS.RESET_PASSWORD, { method: 'POST', body: { otp, email: email.trim(), newPassword } });
      Alert.alert('Success', 'Password updated! Please sign in.', [
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Reset failed. Check your OTP.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {step === 1 ? 'Enter your email to receive a 6-digit OTP.' : 'Enter the OTP sent to your email.'}
          </Text>

          {step === 1 ? (
            <>
              <Text style={styles.label}>Email Address</Text>
              <TextInput style={styles.input} placeholder="john@example.com" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TouchableOpacity style={styles.btnPrimary} onPress={handleRequestOTP} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Send OTP Code</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>6-Digit OTP</Text>
              <TextInput style={styles.input} placeholder="Enter 6-digit code" placeholderTextColor="#94a3b8" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
              <Text style={styles.label}>New Password</Text>
              <TextInput style={styles.input} placeholder="Min 6 characters" placeholderTextColor="#94a3b8" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
              <TouchableOpacity style={styles.btnPrimary} onPress={handleReset} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Update Password</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>← Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 13, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  btnPrimary: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20, marginBottom: 16 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkText: { textAlign: 'center', fontSize: 13, color: '#4f46e5', fontWeight: '600' },
});
