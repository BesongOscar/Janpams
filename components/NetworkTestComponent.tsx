import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants';
import {
  checkNetworkConnectivity,
  getNetworkState,
  setupNetworkListener,
  checkNetworkWithRetry,
} from '@/utils/networkCheck';
import { axiosInstance } from '@/utils/interceptor';

const NetworkTestComponent: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<string>('Checking...');
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Set up network listener
    const unsubscribe = setupNetworkListener(connected => {
      setIsConnected(connected);
      setNetworkStatus(connected ? 'Connected' : 'Disconnected');
    });

    // Initial network check
    checkNetworkConnectivity().then(connected => {
      setIsConnected(connected);
      setNetworkStatus(connected ? 'Connected' : 'Disconnected');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleTestAPI = async () => {
    try {
      setNetworkStatus('Testing API...');
      // This will trigger the network check in the interceptor
      await axiosInstance.get('/test-endpoint');
      setNetworkStatus('API test successful');
    } catch (error: any) {
      setNetworkStatus(`API test failed: ${error.message}`);
    }
  };

  const handleDetailedCheck = async () => {
    const state = await getNetworkState();
    setNetworkStatus(
      `Type: ${state.type}, Connected: ${state.isConnected}, Internet: ${state.isInternetReachable}`,
    );
  };

  const handleRetryCheck = async () => {
    setNetworkStatus('Retrying...');
    const connected = await checkNetworkWithRetry(3, 1000);
    setNetworkStatus(
      connected ? 'Connected after retry' : 'Failed after retry',
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Status Test</Text>

      <View style={styles.statusContainer}>
        <Text
          style={[
            styles.statusText,
            { color: isConnected ? Colors.success : Colors.error },
          ]}>
          {networkStatus}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleTestAPI}>
          <Text style={styles.buttonText}>Test API Call</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleDetailedCheck}>
          <Text style={styles.buttonText}>Detailed Check</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleRetryCheck}>
          <Text style={styles.buttonText}>Retry Check</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: Colors.light['0'],
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark['0'],
    marginBottom: 15,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: Colors.light.grey,
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    backgroundColor: Colors.primary['500'],
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.light['0'],
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NetworkTestComponent;
