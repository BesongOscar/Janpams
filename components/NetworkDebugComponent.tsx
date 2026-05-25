import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  testAPIConnectivity,
  reinitializeAxiosInstances,
} from '@/utils/interceptor';
import {
  getNetworkState,
  checkNetworkConnectivity,
} from '@/utils/networkCheck';

interface NetworkDebugComponentProps {
  onClose?: () => void;
}

export const NetworkDebugComponent: React.FC<NetworkDebugComponentProps> = ({
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runNetworkTest = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      // Test 1: Basic network connectivity
      const basicConnectivity = await checkNetworkConnectivity();
      console.warn('📡 Basic connectivity:', basicConnectivity);

      // Test 2: Detailed network state
      const networkState = await getNetworkState();
      console.warn('📊 Network state:', networkState);

      // Test 3: API connectivity
      const apiTest = await testAPIConnectivity();
      console.warn('🌐 API test result:', apiTest);

      // Test 4: Reinitialize axios instances
      console.warn('🔄 Reinitializing axios instances...');
      reinitializeAxiosInstances();

      setResults({
        basicConnectivity,
        networkState,
        apiTest,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setResults({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Network Debug Tool</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={runNetworkTest}
          disabled={isLoading}>
          <Text style={styles.buttonText}>
            {isLoading ? 'Testing...' : 'Run Network Test'}
          </Text>
        </TouchableOpacity>

        {results && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>Test Results:</Text>
            <Text style={styles.resultsText}>
              {JSON.stringify(results, null, 2)}
            </Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.infoTitle}>What this test does:</Text>
          <Text style={styles.infoText}>
            • Checks basic network connectivity{'\n'}• Gets detailed network
            state{'\n'}• Tests API endpoint reachability{'\n'}• Reinitializes
            axios instances{'\n'}• Provides detailed error information
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            showAlert(
              'Network Info',
              'Check the console logs for detailed information about your network connection and API connectivity.',
            )
          }>
          <Text style={styles.buttonText}>Show Help</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2196F3',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  results: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  info: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
});

export default NetworkDebugComponent;
