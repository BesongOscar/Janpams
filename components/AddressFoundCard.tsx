import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import {
  addressesCheckAddressResponse,
  addressesJangoAddress,
} from '@/interfaces';
import { getAddressDisplayLines, normalizeAddressForDisplay } from '@/utils/addressDisplay';
import * as Clipboard from 'expo-clipboard';
import { snackbarToast } from '@/utils/toastHelpter';
import i18n from '../i18n';
import { SourceBadge, QualityIndicator, type AddressSource, type AddressQuality } from './AddressBadges';

const FORCE_BASE_URL = 'https://api-staging.janpams.com/api/v2';

interface AddressFoundCardProps {
  address: addressesCheckAddressResponse | addressesJangoAddress;
  onSaveAddress: () => void;
  onShareAddress: () => void;
  onAddToMyAddress: () => void;
  onAddUnitInfo?: () => void;
  /** Called when user taps the sheet close icon (dismisses the bottom sheet). */
  onDismiss?: () => void;
}

export const AddressFoundCard: React.FC<AddressFoundCardProps> = ({
  address,
  onSaveAddress,
  onShareAddress,
  onAddToMyAddress,
  onAddUnitInfo,
  onDismiss,
}) => {
  const displayLines = getAddressDisplayLines(normalizeAddressForDisplay((address ?? {}) as Record<string, unknown>));

  // Construct image URL
  const imageUrl = address?.image
    ? address.image.startsWith('http')
      ? address.image
      : `${FORCE_BASE_URL}${address.image.startsWith('/') ? '' : '/'}${address.image}`
    : null;

  const handleCopyPlusCode = async () => {
    if (address?.global_code) {
      await Clipboard.setStringAsync(address.global_code);
      snackbarToast('Plus Code copied to clipboard', 'success', Colors.success);
    }
  };

  const handleCopyWhat3Words = async () => {
    if (address?.w3wAddress) {
      await Clipboard.setStringAsync(address.w3wAddress);
      snackbarToast(
        'What3Words copied to clipboard',
        'success',
        Colors.success,
      );
    }
  };

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
      {/* Main Content Row */}
      <View style={styles.mainRow}>
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon source="image-outline" size={40} color={Colors.dark['0.4']} />
              <Text style={styles.imagePlaceholderText}>No image</Text>
            </View>
          )}
        </View>

        <View style={styles.addressInfoColumn}>
          {/* Canonical address: 1=alias/business, 2=number+street, 3=neighborhood+city, 4=region+country */}
          {displayLines.map((line, i) => (
            <Text
              key={i}
              style={i === 0 ? styles.businessName : styles.streetAddress}
              numberOfLines={i === 0 ? 2 : 1}>
              {line}
            </Text>
          ))}
          {/* Action row: Add unit + Share (no duplicate locality text) */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={onAddUnitInfo} style={styles.actionIcon}>
              <Image
                source={require('@/assets/images/ic_create.png')}
                style={styles.actionIconImage}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={onShareAddress} style={styles.actionIcon}>
              <Image
                source={require('@/assets/images/ic_share.png')}
                style={styles.actionIconImage}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <SourceBadge source={
          (address as any)?.name_source === 'jango' ? 'jango' :
          (address as any)?.name_source === 'osm' ? 'osm_offline' :
          (address as any)?.source ?? 'jango'
        } />
        <QualityIndicator quality={
          (address as any)?.quality ??
          ((address as any)?.accuracy_meters != null && (address as any).accuracy_meters < 10 ? 'HIGH' :
           (address as any)?.accuracy_meters != null && (address as any).accuracy_meters < 30 ? 'MEDIUM' : 'LOW')
        } />
      </View>

      <View style={styles.separator} />

      {address?.global_code && (
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Plus Code</Text>
          <View style={styles.codeValueContainer}>
            <Text style={styles.codeValue}>{address.global_code}</Text>
            <TouchableOpacity onPress={handleCopyPlusCode}>
              <Icon
                source="content-copy"
                size={18}
                color={Colors.primary[500]}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {address?.w3wAddress && (
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>What3Words</Text>
          <View style={styles.codeValueContainer}>
            <Text style={styles.codeValue}>{address.w3wAddress}</Text>
            <TouchableOpacity onPress={handleCopyWhat3Words}>
              <Icon
                source="content-copy"
                size={18}
                color={Colors.primary[500]}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.light[10],
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  containerWithClose: {
    paddingTop: 2,
  },
  sheetCloseButton: {
    position: 'absolute',
    top: -10,
    right: 10,
    zIndex: 100,
    padding: 8,
  },
  mainRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark['0.1'],
    overflow: 'hidden',
    backgroundColor: Colors.light[10.5],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark['0.04'],
  },
  imagePlaceholderText: {
    fontSize: 11,
    color: Colors.dark['0.4'],
    fontFamily: 'gentium',
    marginTop: 4,
  },
  addressInfoColumn: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
    marginBottom: 4,
  },
  streetAddress: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  actionIcon: {
    padding: 4,
  },
  actionIconImage: {
    width: 16,
    height: 16,
  },
  neighbourhoodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  neighbourhoodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  neighbourhoodText: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    marginTop: 4,
  },
  cityCountryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cityCountryText: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.dark['0.1'],
    marginVertical: 12,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  codeLabel: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    fontWeight: '500',
  },
  codeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // flex: 1,
    // justifyContent: 'flex-end',
  },
  codeValue: {
    fontSize: 14,
    color: Colors.primary[500],
    fontFamily: 'gentium',
  },
});
