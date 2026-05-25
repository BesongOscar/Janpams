import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';

interface OfflineDataInfoCardProps {
  regionName?: string | null;
  showTip?: boolean;
  onDismissTip?: () => void;
  onDownloadRegion: () => void;
  /** Called when user taps the sheet close icon (dismisses the bottom sheet). */
  onDismiss?: () => void;
}

export const OfflineDataInfoCard: React.FC<OfflineDataInfoCardProps> = ({
  regionName,
  showTip = true,
  onDismissTip,
  onDownloadRegion,
  onDismiss,
}) => {
  return (
    <View style={[styles.container, onDismiss && styles.containerWithClose]}>
      {onDismiss && (
        <TouchableOpacity
          style={styles.sheetCloseButton}
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Icon source="close" size={24} color={Colors.grey} />
        </TouchableOpacity>
      )}
      {showTip && (
        <View style={styles.tipContainer}>
          {onDismissTip && (
            <TouchableOpacity style={styles.tipCloseButton} onPress={onDismissTip}>
              <Icon source="close" size={16} color={Colors.grey} />
            </TouchableOpacity>
          )}
          <View style={styles.tipContent}>
            <Icon source="information-outline" size={18} color={Colors.primary[500]} />
            <View style={styles.tipTextWrapper}>
              <Text style={styles.tipTitle}>Street Data Not Available</Text>
              <Text style={styles.tipBody}>
                To see street names and auto-generated house numbers, download the offline
                data pack for this region.
              </Text>
              {regionName ? (
                <View style={styles.regionBadge}>
                  <Icon source="map-marker" size={14} color={Colors.primary[500]} />
                  <Text style={styles.regionBadgeText}>
                    You appear to be in: <Text style={styles.regionBadgeStrong}>{regionName}</Text>
                  </Text>
                </View>
              ) : null}
              <View style={styles.tipFooterRow}>
                <Icon source="download" size={12} color={Colors.primary[500]} />
                <Text style={styles.tipFooterText}>
                  Click the download icon in the map controls to open the Offline Data Manager.
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.downloadButton} onPress={onDownloadRegion}>
        <Icon source="download" size={18} color={Colors.light[10]} />
        <Text style={styles.downloadButtonText}>
          Download {regionName || 'Region'} Data
        </Text>
      </TouchableOpacity>

      <Text style={styles.downloadHint}>
        Download offline data to create addresses for this location.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  containerWithClose: {
    paddingTop: 40,
  },
  sheetCloseButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    padding: 8,
  },
  tipContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    position: 'relative',
  },
  tipCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipTextWrapper: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 6,
    fontFamily: 'gentium-bold',
  },
  tipBody: {
    fontSize: 12,
    color: '#1976D2',
    marginBottom: 8,
    lineHeight: 16,
    fontFamily: 'gentium',
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#BBDEFB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  regionBadgeText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '500',
    fontFamily: 'gentium',
  },
  regionBadgeStrong: {
    fontFamily: 'gentium-bold',
  },
  tipFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tipFooterText: {
    fontSize: 11,
    color: '#1976D2',
    lineHeight: 14,
    flex: 1,
    fontFamily: 'gentium',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#0000EE',
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light[10],
    fontFamily: 'gentium-bold',
  },
  downloadHint: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'gentium',
  },
});

