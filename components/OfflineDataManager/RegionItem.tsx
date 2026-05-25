import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import i18n from '../../i18n';
import type { DataPackInfo } from '@/lib/dataPacks/downloader';
import type { PackState } from '@/lib/db/schemas';

interface RegionItemProps {
  regionCode: string;
  regionName: string;
  cities: string[];
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  packInfo?: DataPackInfo;
  /** JAPA pack state: DOWNLOADING, VALIDATING, INSTALLING, FAILED, INSTALLED, NOT_INSTALLED */
  packState?: PackState;
  onDownload: (regionCode: string) => void;
  onUpdate?: (regionCode: string) => void;
}

const TRANSIENT_STATES: PackState[] = ['DOWNLOADING', 'STAGING', 'VALIDATING', 'INSTALLING'];

export const RegionItem: React.FC<RegionItemProps> = ({
  regionCode,
  regionName,
  cities,
  isDownloaded,
  isDownloading,
  downloadProgress,
  packInfo,
  packState,
  onDownload,
  onUpdate,
}) => {
  const displayRegionName =
    regionName.length > 10 ? `${regionName.slice(0, 8)}...` : regionName;
  const isTransient = packState && TRANSIENT_STATES.includes(packState);
  const isFailed = packState === 'FAILED';

  const handleDownload = () => {
    onDownload(regionCode);
  };

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text
            style={styles.regionName}
            numberOfLines={1}
            ellipsizeMode="tail">
            {displayRegionName}
          </Text>
          {isDownloaded ? (
            <View style={styles.badgeOffline}>
              <Icon source="check-circle" size={12} color={Colors.primary[500]} />
              <Text style={styles.badgeTextOffline}>
                {i18n.t('offlineDataManager.region.offline')}
              </Text>
            </View>
          ) : isFailed ? (
            <View style={styles.badgeFailed}>
              <Text style={styles.badgeTextFailed}>Failed</Text>
            </View>
          ) : (
            <View style={styles.badgeReady}>
              <Text style={styles.badgeTextReady}>
                {i18n.t('offlineDataManager.region.ready')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Streets count */}
      <Text style={[styles.streetCountText, { marginBottom: isDownloaded ? 2 : 10 }]}>
        {(packInfo?.street_count || 0).toLocaleString()}{' '}
        {i18n.t('offlineDataManager.region.streets')}
      </Text>

      {/* Default / Download state (or Retry when Failed) */}
      {!isDownloaded && !isDownloading && !isTransient && (
        <TouchableOpacity
          style={[styles.downloadButton, isFailed && styles.retryButton]}
          onPress={handleDownload}
          disabled={isDownloading}>
          <Icon
            source={isFailed ? 'refresh' : 'download'}
            size={12}
            color={Colors.light[10]}
          />
          <Text style={styles.downloadButtonText}>
            {isFailed ? 'Retry' : i18n.t('offlineDataManager.region.download')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Downloading / Validating / Installing state */}
      {(isDownloading || isTransient) && (
        <View style={styles.loadingButton}>
          <View style={styles.loadingIndicatorWrap}>
            <ActivityIndicator size="small" color={Colors.light[10]} />
          </View>
          <Text style={styles.loadingButtonText}>
            {isDownloading
              ? `${i18n.t('offlineDataManager.region.downloading')} ${Math.round(downloadProgress)}%`
              : packState === 'VALIDATING'
                ? 'Validating...'
                : packState === 'INSTALLING'
                  ? 'Installing...'
                  : 'Downloading...'}
          </Text>
        </View>
      )}

      {/* Downloaded state actions (disable when transient) */}
      {isDownloaded && !isDownloading && !isTransient && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onUpdate?.(regionCode)}>
            <Icon source="refresh" size={14} color={Colors.dark['0.8']} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => onUpdate && onUpdate(regionCode)}>
            <Icon source="delete" size={14} color={Colors.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light[10],
    borderRadius: 12,
    marginBottom: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors['grey-93'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  regionName: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
  },
  badgeOffline: {
    // flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2
  },
  badgeTextOffline: {
    fontSize: 8,
    color: Colors.primary[500],
    fontFamily: 'gentium',
    fontWeight: '600',
  },
  badgeReady: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextReady: {
    fontSize: 8,
    color: Colors.success,
    fontFamily: 'gentium',
    fontWeight: '600',
  },
  badgeFailed: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextFailed: {
    fontSize: 8,
    color: Colors.error,
    fontFamily: 'gentium',
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: Colors.error,
  },
  expandedContent: {
    padding: 0,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    color: Colors.grey,
    fontFamily: 'gentium',
  },
  citiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityTag: {
    borderWidth: 1,
    borderColor: Colors['grey-93'],
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cityText: {
    fontSize: 10,
    color: Colors.dark[10],
    fontFamily: 'gentium',
  },
  statsBox: {
    display: 'none',
  },
  statsText: {
    fontSize: 10,
    color: Colors.dark[10],
    fontFamily: 'gentium',
  },
  sizeText: {
    fontSize: 10,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    fontWeight: '500',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    paddingVertical: 4,
    borderRadius: 4,
    gap: 8,
    marginTop: 8,
  },
  downloadButtonText: {
    fontSize: 8,
    color: Colors.light[10],
    fontFamily: 'gentium',
    fontWeight: '600',
  },
  progressContainer: {
    display: 'none',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 8,
    color: Colors.dark['0.4'],
    fontFamily: 'gentium',
    textAlign: 'center',
  },
  downloadingButton: {
    display: 'none',
  },
  downloadingButtonText: {
    display: 'none',
  },
  streetCountText: {
    fontSize: 8,
    color: Colors.dark['0.6'],
    fontFamily: 'gentium',
   
  },
  loadingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A855F7',
    paddingVertical: 1,
    borderRadius: 4,
    gap: 6,
  },
  loadingIndicatorWrap: {
    transform: [{ scale: 0.5 }],
  },
  loadingButtonText: {
    fontSize: 8,
    color: Colors.light[10],
    fontFamily: 'gentium',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
});
