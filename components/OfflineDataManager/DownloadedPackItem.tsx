import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import i18n from '../../i18n';
import type { DataPackManifest } from '@/lib/db/schemas';
import { hasProdTilesForRegion } from '@/lib/valhalla/tileStorage';

interface DownloadedPackItemProps {
  pack: DataPackManifest;
  onUpdate: (regionCode: string) => void;
  onDelete: (regionCode: string) => void;
}

export const DownloadedPackItem: React.FC<DownloadedPackItemProps> = ({
  pack,
  onUpdate,
  onDelete,
}) => {
  const [hasRouting, setHasRouting] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasProdTilesForRegion(pack.id).then(ok => {
      if (!cancelled) setHasRouting(ok);
    });
    return () => { cancelled = true; };
  }, [pack.id]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      <Icon source="check-circle" size={20} color={Colors.success} />
      <View style={styles.content}>
        <Text style={styles.name}>{pack.name}</Text>
        <Text style={styles.stats}>
          {pack.street_count?.toLocaleString() || 0}{' '}
          {i18n.t('offlineDataManager.region.streets')}{' '}
          • {pack.boundary_count?.toLocaleString() || 0}{' '}
          {i18n.t('offlineDataManager.region.boundaries')}{' '}
          • {pack.settlement_count?.toLocaleString() || 0}{' '}
          {i18n.t('offlineDataManager.region.settlements')}
          {hasRouting === true && (
            <> • {i18n.t('offlineDataManager.region.routingAvailable', { defaultValue: 'Routing: Yes' })}</>
          )}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onUpdate(pack.id)}>
          <Icon source="refresh" size={18} color={Colors.primary[500]} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onDelete(pack.id)}>
          <Icon source="delete" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light[10],
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
    marginBottom: 4,
  },
  stats: {
    fontSize: 12,
    color: Colors.grey,
    fontFamily: 'gentium',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
});
