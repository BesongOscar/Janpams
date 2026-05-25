import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import { parseFormattedAddress } from '@/utils/helpers';
import * as Clipboard from 'expo-clipboard';
import { snackbarToast } from '@/utils/toastHelpter';
import { formatStreetName } from '@/utils/formatStreetName';
import { STREET_TYPES } from '@/constants';
import i18n from '../i18n';

interface AddressLivePreviewCardProps {
  businessName?: string;
  houseNumber?: string;
  extension?: string;
  street?: string;
  streetType?: string;
  unitNumber?: string;
  unitType?: string;
  neighbourhood?: string;
  city?: string;
  region?: string;
  country?: string;
  imageUri?: string;
  globalCode?: string;
  w3wAddress?: string;
  lang?: string;
}

export const AddressLivePreviewCard: React.FC<AddressLivePreviewCardProps> = ({
  businessName,
  houseNumber,
  extension,
  street,
  streetType = 'Street',
  unitNumber,
  unitType,
  neighbourhood,
  city,
  region,
  country,
  imageUri,
  globalCode,
  w3wAddress,
  lang = 'en',
}) => {
  // Build address lines in the format shown in images
  const buildAddressLines = () => {
    const lines: string[] = [];

    // Line 1: House number with extension (bold, larger)
    if (houseNumber) {
      const houseNum = extension ? `${houseNumber}${extension}` : houseNumber;
      lines.push(houseNum);
    }

    // Line 2: Street name (if house number exists) OR Street + House number (if no house number)
    if (street) {
      const formattedStreet = formatStreetName(
        street,
        streetType,
        lang as 'en' | 'fr' | 'pt',
        STREET_TYPES,
        false,
      );
      if (houseNumber) {
        lines.push(formattedStreet);
      } else {
        // If no house number, combine with first line
        if (lines.length === 0) {
          lines.push(formattedStreet);
        } else {
          lines[0] = `${lines[0]} ${formattedStreet}`;
        }
      }
    }

    // Line 3: Unit info (if present)
    if (unitType && unitNumber) {
      lines.push(`${unitType} ${unitNumber}`);
    } else if (unitType) {
      lines.push(unitType);
    } else if (unitNumber) {
      lines.push(unitNumber);
    }

    // Line 4: Neighbourhood OR Neighbourhood + City
    if (neighbourhood && city) {
      lines.push(`${neighbourhood} ${city}`);
    } else if (neighbourhood) {
      lines.push(neighbourhood);
    } else if (city) {
      lines.push(city);
    }

    // Line 5: Region, Country (combined)
    if (region && country) {
      lines.push(`${region},${country}`);
    } else if (region) {
      lines.push(region);
    } else if (country) {
      lines.push(country);
    }

    return lines;
  };

  const addressLines = buildAddressLines();

  const handleCopyPlusCode = async () => {
    if (globalCode) {
      await Clipboard.setStringAsync(globalCode);
      snackbarToast('Plus Code copied to clipboard', 'success', Colors.success);
    }
  };

  const handleCopyWhat3Words = async () => {
    if (w3wAddress) {
      await Clipboard.setStringAsync(w3wAddress);
      snackbarToast('What3Words copied to clipboard', 'success', Colors.success);
    }
  };

  // Show card even if no address data - at least show plus code/what3words if available
  // This allows the card to be visible as a marker on the map

  return (
    <View style={styles.container}>
      {/* Image Section */}
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      )}

      {/* Content Section */}
      <View style={styles.content}>
        {/* Business Name */}
        {businessName && (
          <Text style={styles.businessName} numberOfLines={1} ellipsizeMode="tail">{businessName}</Text>
        )}

        {/* Address Lines */}
        {addressLines.length > 0 ? (
          <View style={styles.addressContainer}>
            {addressLines.map((line, index) => (
              <Text
                key={index}
                style={[
                  styles.addressLine,
                  // First line (house number) is bold and larger
                ]}>
                {line}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.addressContainer}>
            <Text style={styles.addressLine}>
              {i18n.t('(tabs).index.noOfficialAddress')}
            </Text>
          </View>
        )}

        {/* Plus Code and What3Words */}
        <View style={styles.locationCodesContainer}>
          {globalCode && (
            <View style={styles.locationCodeRow}>
              <Text style={styles.locationCodeLabel}>Plus Code: </Text>
              <TouchableOpacity onPress={handleCopyPlusCode}>
                <Text style={styles.locationCodeValue}>{globalCode}</Text>
              </TouchableOpacity>
            </View>
          )}
          {w3wAddress && (
            <View style={styles.locationCodeRow}>
              <Text style={styles.locationCodeLabel}>What3Words: </Text>
              <TouchableOpacity onPress={handleCopyWhat3Words}>
                <Text style={styles.locationCodeValue}>{w3wAddress}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 280,
    backgroundColor: Colors.light[10],
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  image: {
    width: '100%',
    height: 100,
    backgroundColor: Colors.light[10.5],
  },
  content: {
    padding: 16,
  },
  businessName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    color: Colors.dark[10],
    textAlign: 'center'
  },
  addressContainer: {
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderColor: Colors.dark['0.1'],
  },
  addressLine: {
    fontSize: 10,
    color: Colors.dark[10],
    fontFamily: 'gentium',
    marginBottom: 2,
    textAlign: 'center',
  },
  addressLineFirst: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    marginBottom: 4,
  },
  locationCodesContainer: {
    gap: 8,
    marginTop: 8,
  },
  locationCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  locationCodeLabel: {
    fontSize: 12,
    color: Colors.dark[10],
    fontFamily: 'gentium',
  },
  locationCodeValue: {
    fontSize: 12,
    color: Colors.primary[500],
    textDecorationLine: 'underline',
    fontWeight: '500',
    fontFamily: 'gentium',
  },
});

