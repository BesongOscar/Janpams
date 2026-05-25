/**
 * Offline Indicator Component
 * 
 * Displays offline status banner
 * Non-blocking design, auto-dismisses when online
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Icon } from 'react-native-paper';
import { useOffline } from '@/hooks/useOffline';
import Colors from '@/constants/Colors';

export function OfflineIndicator() {
  const { isOnline, isInitialized, searchIndexStatus } = useOffline();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isInitialized) return;

    if (!isOnline) {
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }
  }, [isOnline, isInitialized, fadeAnim]);

  const showSearchStatus = searchIndexStatus === 'validating' || searchIndexStatus === 'error';

  return (
    <>
      {!isOnline && visible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.container,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Icon source="wifi-off" size={16} color="#FFFFFF" />
          <Text style={styles.text}>You're offline. Changes will sync when you're back online.</Text>
        </Animated.View>
      )}
      {showSearchStatus && (
        <View style={styles.searchStatusRow} pointerEvents="box-none">
          <Icon
            source={searchIndexStatus === 'error' ? 'alert-circle' : 'loading'}
            size={14}
            color={searchIndexStatus === 'error' ? '#B00020' : Colors.warning || '#FF9800'}
          />
          <Text style={styles.searchStatusText}>
            {searchIndexStatus === 'validating'
              ? 'Search index: validating…'
              : 'Search index: error'}
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning || '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  searchStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light?.[10] ?? '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  searchStatusText: {
    fontSize: 12,
    marginLeft: 6,
    color: Colors.dark?.[10] ?? '#333',
  },
});
