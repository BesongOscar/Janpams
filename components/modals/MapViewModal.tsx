import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors, navigationApps } from '@/constants';
import NavigationOption from '../NavigationOption';
import i18n from '../../i18n';

interface MapViewModalProps {
  visible: boolean;
  onClose: () => void;
  selectedAddress: {
    displayValue: string;
    coordinates: string;
    latitude: number;
    longitude: number;
  } | null;
}

const MapViewModal: React.FC<MapViewModalProps> = ({
  visible,
  onClose,
  selectedAddress,
}) => {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  const openNavigationApp = async (
    appType: string,
    address: {
      displayValue: string;
      coordinates: string;
      latitude: number;
      longitude: number;
    },
  ) => {
    const { latitude, longitude, displayValue } = address;
    const label = encodeURIComponent(displayValue);

    let url = '';

    switch (appType) {
      case 'apple-maps':
        if (Platform.OS === 'ios') {
          // Apple Maps with location name
          url = `maps://?q=${label}&ll=${latitude},${longitude}&z=15`;
        } else {
          // Fallback to Google Maps on Android with location name
          url = `https://www.google.com/maps/search/?api=1&query=${label}`;
        }
        break;

      case 'maps': // Google Maps
        if (Platform.OS === 'ios') {
          // Google Maps iOS with location name
          url = `comgooglemaps://?q=${label}&center=${latitude},${longitude}&zoom=15`;
        } else {
          // Google Maps Android with location name
          url = `geo:${latitude},${longitude}?q=${label}`;
        }
        break;

      case 'waze':
        // Waze with location name
        url = `waze://?ll=${latitude},${longitude}&navigate=yes&label=${label}`;
        break;

      case 'lyft':
        // Lyft with location name
        url = `lyft://ridetype?id=lyft&destination[latitude]=${latitude}&destination[longitude]=${longitude}&destination[address]=${label}`;
        break;

      case 'uber':
        // Uber with location name
        url = `uber://?action=setPickup&pickup=my_location&dropoff[latitude]=${latitude}&dropoff[longitude]=${longitude}&dropoff[nickname]=${label}`;
        break;

      case 'here':
        // HERE Maps with location name
        url = `here-location://${latitude},${longitude}?title=${label}`;
        break;

      case 'mapsme':
        // Maps.me with location name
        url = `mapsme://route?sll=${latitude},${longitude}&saddr=My%20Location&dll=${latitude},${longitude}&daddr=${label}`;
        break;

      case 'citymapper':
        // Citymapper with location name
        url = `citymapper://directions?endcoord=${latitude},${longitude}&endname=${label}`;
        break;

      case 'myroute':
        // MyRoute with location name
        url = `myroute://route?destination=${latitude},${longitude}&destinationName=${label}`;
        break;

      case 'jango':
        // For Jango app, use Google Maps with location name
        url = `https://www.google.com/maps/search/?api=1&query=${label}`;
        break;

      default:
        // Default fallback with location name
        url = `https://www.google.com/maps/search/?api=1&query=${label}`;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        setSelectedApp(null);
        onClose();
      } else {
        // Fallback to web version with location name
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${label}`;
        await Linking.openURL(fallbackUrl);
        setSelectedApp(null);
        onClose();
      }
    } catch {
      // const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${label}`;
      // await Linking.openURL(fallbackUrl);
      // Alert.alert(
      //   'Error',
      //   `Failed to open ${appType}. Please make sure the app is installed.`,
      //   [{ text: 'OK', onPress: () => setSelectedApp(null) }],
      // );
    }
  };

  const handleAppSelect = async (appType: string) => {
    if (!selectedAddress) return;

    setSelectedApp(appType);

    // Open the selected navigation app
    await openNavigationApp(appType, selectedAddress);
  };

  if (!selectedAddress) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}>
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalTitle}>
                {i18n.t('(tabs).index.openWith')}
              </Text>
              <Text style={styles.modalSubtitle}>
                {selectedAddress.displayValue}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon source="close" size={24} color={Colors.grey} />
            </TouchableOpacity>
          </View>

          {/* App Options */}
          <View style={styles.appOptionsContainer}>
            {navigationApps.map((app, index) => {
              // Group apps into rows of 4
              if (index % 4 === 0) {
                const rowApps = navigationApps.slice(index, index + 4);
                return (
                  <View key={`row-${index}`} style={styles.appRow}>
                    {rowApps.map(appItem => (
                      <NavigationOption
                        key={appItem.id}
                        app={appItem}
                        isSelected={selectedApp === appItem.id}
                        onPress={() => handleAppSelect(appItem.id)}
                      />
                    ))}
                    {/* Fill remaining slots if row is not full */}
                    {Array.from({ length: 4 - rowApps.length }).map(
                      (_, emptyIndex) => (
                        <View
                          key={`empty-${index}-${emptyIndex}`}
                          style={styles.emptySlot}
                        />
                      ),
                    )}
                  </View>
                );
              }
              return null;
            })}
          </View>

          {/* Action Buttons */}
          <View style={styles.modalActionButtons}>
            <TouchableOpacity
              style={styles.modalActionButton}
              onPress={onClose}>
              <Text style={styles.modalActionButtonText}>
                {i18n.t('(tabs).index.justOnce')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalActionButton,
                styles.modalActionButtonPrimary,
              ]}
              onPress={onClose}>
              <Text
                style={[
                  styles.modalActionButtonText,
                  styles.modalActionButtonTextPrimary,
                ]}>
                {i18n.t('(tabs).index.always')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.light['0'],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalHeaderContent: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark['0'],
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.grey,
  },
  closeButton: {
    padding: 8,
  },
  appOptionsContainer: {
    flexDirection: 'column',
    marginBottom: 30,
  },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  emptySlot: {
    flex: 1,
    minWidth: 70,
  },
  // Action Buttons
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.grey,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalActionButtonPrimary: {
    backgroundColor: Colors.primary['500'],
    borderColor: Colors.primary['500'],
  },
  modalActionButtonText: {
    fontSize: 16,
    color: Colors.dark['0'],
    fontWeight: '600',
  },
  modalActionButtonTextPrimary: {
    color: Colors.light['0'],
  },
});

export default MapViewModal;
