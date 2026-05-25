import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Snackbar, Icon } from 'react-native-paper';
import Colors from '@/constants/Colors';
import { defaultStyles } from '@/styles';
import { LOCATION_THRESHOLDS } from '@/constants/locationThresholds';

interface LocationRefreshBannerProps {
  visible: boolean;
  message: string;
  distance?: number;
  onRefresh: () => void;
  onDismiss: () => void;
  onKeep?: () => void; // Optional "keep current" action
}

/**
 * Banner component for soft location refresh prompts
 * Auto-dismisses after a set time, but allows user to take action
 */
export const LocationRefreshBanner: React.FC<LocationRefreshBannerProps> = ({
  visible,
  message,
  distance,
  onRefresh,
  onDismiss,
  onKeep,
}) => {
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      // Auto-dismiss after threshold time
      autoDismissTimerRef.current = setTimeout(() => {
        onDismiss();
      }, LOCATION_THRESHOLDS.BANNER_AUTO_DISMISS_MS);
    }

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Snackbar
      visible={visible}
      onDismiss={onDismiss}
      duration={LOCATION_THRESHOLDS.BANNER_AUTO_DISMISS_MS}
      style={styles.snackbar}
      action={{
        label: 'Refresh',
        onPress: () => {
          if (autoDismissTimerRef.current) {
            clearTimeout(autoDismissTimerRef.current);
          }
          onRefresh();
        },
      }}>
      <View style={styles.content}>
        <Icon source="map-marker-alert" size={20} color={Colors.light[10]} />
        <Text style={styles.message}>{message}</Text>
        {distance !== undefined && (
          <Text style={styles.distance}>~{Math.round(distance)}m</Text>
        )}
      </View>
    </Snackbar>
  );
};

const styles = StyleSheet.create({
  snackbar: {
    backgroundColor: Colors.warning,
    marginBottom: 20,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  message: {
    color: Colors.light[10],
    fontSize: 14,
    flex: 1,
  },
  distance: {
    color: Colors.light[10],
    fontSize: 12,
    fontWeight: '600',
  },
});

