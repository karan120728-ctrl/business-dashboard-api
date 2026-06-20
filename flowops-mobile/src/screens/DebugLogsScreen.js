import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getLocalLogs, clearLocalLogs, reportErrorToBackend } from '../utils/logger';

export default function DebugLogsScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    const localLogs = await getLocalLogs();
    setLogs(localLogs);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClear = () => {
    Alert.alert('Clear Logs', 'Are you sure you want to delete all local debug logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearLocalLogs();
          setLogs([]);
        },
      },
    ]);
  };

  const handleTriggerCrash = () => {
    setTimeout(() => {
      throw new Error(`Manual test crash triggered at ${new Date().toLocaleTimeString()}!`);
    }, 100);
    
    Alert.alert('Crash Triggered', 'A test crash has been scheduled. Reopen this screen to see the captured log.');
    setTimeout(fetchLogs, 1000);
  };

  const handleSendAll = async () => {
    if (logs.length === 0) {
      Alert.alert('No Logs', 'There are no logs to send.');
      return;
    }
    setLoading(true);
    try {
      let succeeded = 0;
      for (const log of logs) {
        await reportErrorToBackend(log);
        succeeded++;
      }
      Alert.alert('Success', `Successfully uploaded ${succeeded} logs to the database! 🚀`);
    } catch (err) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={styles.bg}>
      {/* Header Controls */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.btn, styles.crashBtn]} onPress={handleTriggerCrash}>
          <Text style={styles.btnText}>💥 Trigger Crash</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btn, styles.sendAllBtn]} onPress={handleSendAll}>
          <Text style={styles.btnText}>📤 Send All Logs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.clearBtn]} onPress={handleClear}>
          <Text style={styles.btnText}>🗑️ Clear</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : logs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyText}>No errors logged!</Text>
          <Text style={styles.emptySub}>The app is running smoothly.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchLogs}>
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.logCount}>Showing last {logs.length} logged events:</Text>
          {logs.map((log, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <View key={index} style={styles.card}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(index)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.errorMsg} numberOfLines={2}>
                      {log.error}
                    </Text>
                    <Text style={styles.metaText}>
                      📍 {log.screen}  •  ⏱️ {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.detailsContainer}>
                    {/* User Metadata */}
                    <Text style={styles.label}>👤 User Context:</Text>
                    <Text style={styles.metaVal}>
                      User ID: {log.userId || 'Guest'}  |  Role: {log.userRole || 'N/A'}
                    </Text>

                    {/* Device Metadata */}
                    <Text style={[styles.label, { marginTop: 10 }]}>📱 Device Information:</Text>
                    <Text style={styles.metaVal}>
                      App: v{log.deviceInfo?.appVersion || '1.0.0'}  |  OS: {log.deviceInfo?.platform} ({log.deviceInfo?.version}){"\n"}
                      Device: {log.deviceInfo?.brand || 'Apple'} {log.deviceInfo?.model}
                    </Text>

                    {/* API Details if present */}
                    {log.apiDetails && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.label}>📡 API Details:</Text>
                        <View style={styles.apiBox}>
                          <Text style={styles.apiMetaText}>
                            Method: <Text style={{ fontWeight: '800', color: '#10b981' }}>{log.apiDetails.method}</Text> | Status: <Text style={{ fontWeight: '800', color: '#ef4444' }}>{log.apiDetails.status}</Text>
                          </Text>
                          <Text style={[styles.apiMetaText, { color: '#cbd5e1', fontSize: 10, marginVertical: 4 }]}>
                            URL: {log.apiDetails.url}
                          </Text>
                          <Text style={[styles.label, { fontSize: 9, marginTop: 4 }]}>Server Response Body:</Text>
                          <TextInput
                            style={styles.responseInput}
                            multiline
                            editable={false}
                            selectTextOnFocus
                            scrollEnabled={false}
                            value={log.apiDetails.response}
                          />
                        </View>
                      </View>
                    )}

                    {/* Stack Trace */}
                    <Text style={[styles.label, { marginTop: 10 }]}>
                      📋 Stack Trace (Double-Tap to Select & Copy):
                    </Text>
                    <TextInput
                      style={styles.stackInput}
                      multiline
                      editable={false}
                      selectTextOnFocus
                      scrollEnabled={false}
                      value={log.stack}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#1e293b',
    justifyContent: 'space-between',
    gap: 6,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  crashBtn: { backgroundColor: '#ef4444' },
  sendAllBtn: { backgroundColor: '#10b981' },
  clearBtn: { backgroundColor: '#64748b' },
  scroll: { padding: 12 },
  logCount: { color: '#94a3b8', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorMsg: { color: '#fca5a5', fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  metaText: { color: '#94a3b8', fontSize: 11, marginTop: 4, fontWeight: '500' },
  expandIcon: { color: '#94a3b8', fontSize: 14, marginLeft: 8 },
  detailsContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    backgroundColor: '#0f172a',
  },
  label: { color: '#f59e0b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  metaVal: { color: '#e2e8f0', fontSize: 11, fontFamily: 'monospace', backgroundColor: '#1e293b', padding: 6, borderRadius: 4, lineHeight: 16 },
  apiBox: {
    backgroundColor: '#1e293b',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  apiMetaText: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  responseInput: {
    color: '#cbd5e1',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 4,
    minHeight: 40,
    textAlignVertical: 'top',
    marginTop: 2,
  },
  stackInput: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 4,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptySub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  refreshBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  refreshBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
