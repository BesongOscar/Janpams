/**
 * Sync Status Indicator Component
 * 
 * Displays sync status, pending count, and last sync time
 * Minimal, non-intrusive design
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { useSync } from '@/hooks/useSync';
import Colors from '@/constants/Colors';

export function SyncStatusIndicator() {
  const { isOnline, status, lastSync, pendingCount, isInitialized, syncNow } = useSync();
  const [expanded, setExpanded] = useState(false);

  if (!isInitialized) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return Colors.warning || '#FF9800';
    if (status === 'error') return Colors.error;
    if (status === 'syncing') return '#2196F3';
    if (pendingCount > 0) return Colors.warning || '#FF9800';
    return Colors.success || '#4CAF50';
  };

  const getStatusIcon = () => {
    if (!isOnline) {
      return 'cloud-off';
    }
    if (status === 'syncing') {
      return 'sync';
    }
    if (status === 'error') {
      return 'alert-circle';
    }
    if (pendingCount > 0) {
      return 'cloud-upload';
    }
    return 'check-circle';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (status === 'syncing') return 'Syncing...';
    if (status === 'error') return 'Sync error';
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'Synced';
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handlePress = () => {
    if (isOnline && pendingCount > 0 && status !== 'syncing') {
      syncNow();
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: getStatusColor() }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Icon source={getStatusIcon()} size={16} color="#FFFFFF" />
      <Text style={styles.statusText}>{getStatusText()}</Text>

      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={styles.expandedText}>Last sync: {formatLastSync()}</Text>
          {pendingCount > 0 && (
            <Text style={styles.expandedText}>{pendingCount} items waiting</Text>
          )}
          {status === 'error' && (
            <Text style={styles.expandedText}>Tap to retry</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 8,
    marginVertical: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  expandedContent: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  expandedText: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 2,
  },
});
