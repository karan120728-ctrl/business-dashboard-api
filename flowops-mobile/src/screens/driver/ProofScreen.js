import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiUpload } from '../../api/client';
import { ENDPOINTS } from '../../config/config';

export default function ProofScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [image, setImage] = useState(null); // { uri, type, name }
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const compressAndResizeImage = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipResult.uri;
    } catch (error) {
      console.warn('Image compression failed, using original:', error.message);
      return uri;
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take delivery photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const compressedUri = await compressAndResizeImage(asset.uri);
      setImage({ uri: compressedUri, type: 'image/jpeg', name: `pod_order_${orderId}.jpg` });
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const compressedUri = await compressAndResizeImage(asset.uri);
      setImage({ uri: compressedUri, type: asset.mimeType || 'image/jpeg', name: `pod_order_${orderId}.jpg` });
    }
  };

  const submitProof = async () => {
    if (!image) { Alert.alert('No Photo', 'Please take or select a photo first.'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('proof', { uri: image.uri, type: image.type, name: image.name });
      await apiUpload(ENDPOINTS.SUBMIT_POD(orderId), formData);
      setSubmitted(true);
    } catch (e) {
      Alert.alert('Upload Failed', e.message || 'Could not upload proof. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.successBg}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Delivery Confirmed!</Text>
        <Text style={styles.successSub}>Proof of delivery submitted for Order #{orderId}</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.doneBtnText}>Back to Deliveries</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.scroll}>
      <Text style={styles.orderLabel}>Order #{orderId}</Text>
      <Text style={styles.subtitle}>Take or upload a photo as proof of delivery</Text>

      {/* Preview */}
      <View style={styles.preview}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.previewImg} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>No photo selected</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <TouchableOpacity style={styles.btnCamera} onPress={pickFromCamera}>
        <Text style={styles.btnCameraText}>📷  Open Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnGallery} onPress={pickFromGallery}>
        <Text style={styles.btnGalleryText}>🖼️  Upload from Gallery</Text>
      </TouchableOpacity>

      {image && (
        <View style={styles.retakeRow}>
          <Text style={styles.retakeHint}>Photo selected ✓</Text>
          <TouchableOpacity onPress={() => setImage(null)}>
            <Text style={styles.retakeLink}>Retake</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btnSubmit, !image && styles.btnSubmitDisabled]}
        onPress={submitProof}
        disabled={!image || uploading}
      >
        {uploading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnSubmitText}>✅  Confirm Delivery</Text>
        }
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          🔒 Your photo will be securely stored and shared with the customer and admin as official delivery confirmation.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, paddingBottom: 40 },
  orderLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  preview: { width: '100%', height: 240, borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  previewImg: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 48, marginBottom: 8 },
  placeholderText: { fontSize: 14, color: '#94a3b8' },
  btnCamera: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10 },
  btnCameraText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnGallery: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  btnGalleryText: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  retakeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  retakeHint: { fontSize: 13, color: '#10b981', fontWeight: '600' },
  retakeLink: { fontSize: 13, color: '#4f46e5', fontWeight: '600' },
  btnSubmit: { backgroundColor: '#10b981', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4, marginBottom: 16 },
  btnSubmitDisabled: { backgroundColor: '#94a3b8' },
  btnSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  infoBox: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#bbf7d0' },
  infoText: { fontSize: 12, color: '#059669', lineHeight: 18 },
  successBg: { flex: 1, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', padding: 30 },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#065f46', marginBottom: 8 },
  successSub: { fontSize: 14, color: '#059669', textAlign: 'center', marginBottom: 30 },
  doneBtn: { backgroundColor: '#10b981', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
