// FlowOps App Entry Point
import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Catches any crash and shows the error on screen instead of closing the app.
// Remove this before production release.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('APP CRASH:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView contentContainerStyle={styles.errorContainer}>
          <Text style={styles.errorTitle}>🔴 App Crashed — Error Details</Text>
          <Text style={styles.errorSubtitle}>
            Please screenshot this and send to developer:
          </Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {this.state.error?.toString() || 'Unknown error'}
            </Text>
          </View>
          {this.state.errorInfo && (
            <View style={styles.errorBox}>
              <Text style={styles.errorLabel}>Component Stack:</Text>
              <Text style={styles.errorStackText}>
                {this.state.errorInfo.componentStack?.substring(0, 800)}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    paddingTop: 60,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 13,
    color: '#fca5a5',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  errorStackText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
