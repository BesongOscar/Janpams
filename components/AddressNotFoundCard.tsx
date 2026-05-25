import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants';
import i18n from '../i18n';
import * as Clipboard from 'expo-clipboard';
import { snackbarToast } from '@/utils/toastHelpter';
import { Icon } from 'react-native-paper';
import { useOffline } from '@/hooks/useOffline';

interface AddressNotFoundCardProps {
  onCreateAddress: () => void;
  plusCode?: string;
  what3Words?: string;
  locationContext?: {
    street?: string;
    city?: string;
    neighborhood?: string;
    region?: string;
    country?: string;
    countryCode?: string;
  };
  /** Called when user taps the sheet close icon (dismisses the bottom sheet). */
  onDismiss?: () => void;
}

export const AddressNotFoundCard: React.FC<AddressNotFoundCardProps> = ({
  onCreateAddress,
  plusCode,
  what3Words,
  locationContext,
  onDismiss,
}) => {
  const { isOnline } = useOffline();

  const handleCopyPlusCode = async () => {
    if (plusCode) {
      await Clipboard.setStringAsync(plusCode);
      snackbarToast('Plus Code copied to clipboard', 'success', Colors.success);
    }
  };

  const handleCopyWhat3Words = async () => {
    if (what3Words) {
      await Clipboard.setStringAsync(what3Words);
      snackbarToast(
        'What3Words copied to clipboard',
        'success',
        Colors.success,
      );
    }
  };

  // Convert region name to code (e.g., "Southwest" -> "SW", "Northwest" -> "NW")
  const getRegionCode = (regionName?: string): string | undefined => {
    if (!regionName) return undefined;
    const normalized = regionName.toLowerCase().replace(/[-\s]+/g, '');
    const regionCodes: Record<string, string> = {
      southwest: 'SW',
      southwestregion: 'SW',
      northwest: 'NW',
      northwestregion: 'NW',
      littoral: 'LT',
      littoralregion: 'LT',
      centre: 'CE',
      center: 'CE',
      centreregion: 'CE',
      centerregion: 'CE',
      west: 'OU',
      westregion: 'OU',
      east: 'ES',
      eastregion: 'ES',
      south: 'SU',
      southregion: 'SU',
      north: 'NO',
      northregion: 'NO',
      adamawa: 'AD',
      adamaoua: 'AD',
      adamawaregion: 'AD',
      farnorth: 'EN',
      extremenord: 'EN',
      extremenorth: 'EN',
      extremenorthregion: 'EN',
    };
    return regionCodes[normalized] || regionName.substring(0, 2).toUpperCase();
  };

  // Convert country code to ISO alpha-3 (e.g., "CM" -> "CMR", "US" -> "USA")
  const getCountryCodeAlpha3 = (countryCode?: string): string | undefined => {
    if (!countryCode) return undefined;
    const countryCodes: Record<string, string> = {
      CM: 'CMR',
      NG: 'NGA',
      US: 'USA',
      GB: 'GBR',
      FR: 'FRA',
      DE: 'DEU',
      CA: 'CAN',
      KE: 'KEN',
      ZA: 'ZAF',
      IN: 'IND',
      CN: 'CHN',
      ID: 'IDN',
      JP: 'JPN',
    };
    // If already 3 characters, return as is (might already be alpha-3)
    if (countryCode.length === 3) {
      return countryCode.toUpperCase();
    }
    return countryCodes[countryCode.toUpperCase()] || countryCode.toUpperCase();
  };

  // Format location context for display (street + neighborhood + city + region/country)
  const streetName = locationContext?.street?.trim() || i18n.t('add-home-address.unnamedStreet') || 'Unnamed Street';
  const cityNeighborhood = locationContext?.neighborhood
    ? `${locationContext.neighborhood}, ${locationContext.city || ''}`.trim()
    : (locationContext?.city || '').trim();
  
  // Format region and country as codes (e.g., "SW, CMR")
  const regionCode = getRegionCode(locationContext?.region);
  const countryCode = getCountryCodeAlpha3(locationContext?.countryCode);
  const regionCountry =
    regionCode && countryCode
      ? `${regionCode}, ${countryCode}`
      : regionCode || countryCode || '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Icon source="earth" size={24} color={Colors.primary[500]} />
        <Text style={styles.headerTitle}>JanGo Address Marker</Text>
        {onDismiss && (
          <TouchableOpacity
            style={styles.sheetCloseButton}
            onPress={onDismiss}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Icon source="close" size={24} color={Colors.grey} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Banner */}
      <View style={styles.statusBanner}>
        <Text style={styles.statusBannerText}>Location Has No Address</Text>
        <View style={[styles.onlineBadge, !isOnline && styles.offlineBadge]}>
          <Icon 
            source={isOnline ? "wifi" : "wifi-off"} 
            size={14} 
            color={isOnline ? Colors.primary[500] : Colors.grey} 
          />
          <Text style={[styles.onlineBadgeText, !isOnline && styles.offlineBadgeText]}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Location Context Card */}
      {locationContext && (streetName || cityNeighborhood || regionCountry) && (
        <View style={styles.locationContextCard}>
          <View style={styles.locationContextBorder} />
          <View style={styles.locationContextContent}>
            <Text style={styles.locationContextLabel}>LOCATION CONTEXT</Text>
            {streetName ? (
              <Text style={styles.locationContextStreet}>{streetName}</Text>
            ) : null}
            {cityNeighborhood ? (
              <Text style={styles.locationContextCity}>{cityNeighborhood}</Text>
            ) : null}
            {regionCountry ? (
              <Text style={styles.locationContextRegion}>{regionCountry}</Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Create Address Button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={event => {
          event.stopPropagation();
          onCreateAddress();
        }}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
        <Icon source="map-marker" size={20} color={Colors.light[10]} />
        <Text style={styles.createButtonText}>Create Location Address</Text>
      </TouchableOpacity>

      {/* Footer - Plus Code and What3Words */}
      <View style={styles.footer}>
        {plusCode && (
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Plus Code:</Text>
            <TouchableOpacity onPress={handleCopyPlusCode}>
              <Text style={styles.footerValue}>{plusCode}</Text>
            </TouchableOpacity>
          </View>
        )}
        {what3Words && (
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>What3Words:</Text>
            <TouchableOpacity onPress={handleCopyWhat3Words}>
              <Text style={styles.footerValue}>///{what3Words}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.light[10],
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetCloseButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.primary[500],
    marginLeft: 8,
  },
  statusBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF4E6', // Light orange-yellow
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusBannerText: {
    fontSize: 14,
    color: '#D97706', // Orange-brown
    fontFamily: 'gentium',
    fontWeight: '500',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD', // Light blue
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  offlineBadge: {
    backgroundColor: '#F5F5F5',
  },
  onlineBadgeText: {
    fontSize: 12,
    color: Colors.primary[500],
    fontFamily: 'gentium',
    fontWeight: '600',
  },
  offlineBadgeText: {
    color: Colors.grey,
  },
  locationContextCard: {
    flexDirection: 'row',
    backgroundColor: Colors.light[10],
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors['grey-93'],
  },
  locationContextBorder: {
    width: 4,
    backgroundColor: Colors.primary[500],
  },
  locationContextContent: {
    flex: 1,
    padding: 12,
  },
  locationContextLabel: {
    fontSize: 11,
    color: Colors.grey,
    fontFamily: 'gentium',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  locationContextStreet: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
    marginBottom: 4,
  },
  locationContextCity: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    marginBottom: 2,
  },
  locationContextRegion: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    color: Colors.light[10],
    fontWeight: '600',
    fontFamily: 'gentium',
  },
  footer: {
    gap: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 14,
    color: Colors.dark[10],
    fontFamily: 'gentium',
  },
  footerValue: {
    fontSize: 14,
    color: Colors.primary[500],
    fontFamily: 'gentium',
    fontWeight: '500',
  },
});
