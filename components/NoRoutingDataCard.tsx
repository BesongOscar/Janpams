/**
 * Shown when getRoute fails due to missing routing data (Phase 5.2).
 * Message + "Manage data packs" opens OfflineDataManager.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import i18n from '../i18n';

interface NoRoutingDataCardProps {
  onManageDataPacks: () => void;
  onDismiss?: () => void;
}

export const NoRoutingDataCard: React.FC<NoRoutingDataCardProps> = ({
  onManageDataPacks,
  onDismiss,
}) => {
  return (
    <View style={styles.container}>
      <Icon source="map-marker-off-outline" size={32} color={Colors.grey} />
      <Text style={styles.message}>
        {i18n.t('navigation.noRoutingData', {
          defaultValue:
            'No routing data for this area. Download the region data pack for offline routing.',
        })}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onManageDataPacks}>
        <Icon source="download" size={18} color={Colors.light[0]} />
        <Text style={styles.buttonText}>
          {i18n.t('navigation.manageDataPacks', { defaultValue: 'Manage data packs' })}
        </Text>
      </TouchableOpacity>
      {onDismiss && (
        <TouchableOpacity style={styles.dismiss} onPress={onDismiss}>
          <Text style={styles.dismissText}>{i18n.t('common.dismiss', { defaultValue: 'Dismiss' })}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light[10],
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light[20],
  },
  message: {
    fontSize: 14,
    color: Colors.dark[10],
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    fontFamily: 'gentium',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary[500],
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light[0],
  },
  dismiss: {
    marginTop: 10,
  },
  dismissText: {
    fontSize: 13,
    color: Colors.grey,
  },
});
