import React, { forwardRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import i18n from '../i18n';
import MapViewMapLibre from './MapViewMapLibre';
import { MapLibreMarker } from './MapLibreMarker';
import { MapLibrePolyline } from './MapLibrePolyline';
import type { Region } from 'react-native-maps';

interface MapViewComponentProps {
  initialRegion: Region;
  mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'mutedStandard';
  routeCoordinates?: Array<{
    longitude: number;
    latitude: number;
  }>;
  startMarker?: {
    longitude: number;
    latitude: number;
  };
  endMarker?: {
    longitude: number;
    latitude: number;
  };
  location?: {
    description: string;
    region: Region;
  };
  startingLocation?: {
    displayValue: string;
    coordinates: string;
  };
  destination?: {
    displayValue: string;
    coordinates: string;
  };
  style?: any;
  showNavigationOptions?: boolean;
  showGrid?: boolean;
  selectedGridRectangle?: {
    coordinates: Array<{ latitude: number; longitude: number }>;
  } | null;
  /** When set, show current position along route (live navigation). */
  navigationPosition?: { longitude: number; latitude: number } | null;
  /**
   * When set, renders the user's current position as a pulsing Plus Code grid cell
   * with marching-ants border. Covers both the idle "I am here" state and the live
   * navigation snapped-position indicator. Supersedes the basic location pin.
   */
  currentUserPosition?: { latitude: number; longitude: number } | null;
  onMapPress?: (e: any) => void;
  /** Called once when the MapLibre map finishes loading (tiles + camera ready). */
  onMapLoad?: () => void;
  /** Called when the map region changes (e.g. user pan/zoom). */
  onRegionDidChange?: (payload: any) => void;
  // onAddressSelect?: (address: {
  //   displayValue: string;
  //   coordinates: string;
  //   latitude: number;
  //   longitude: number;
  // }) => void;
}

const MapViewComponent = forwardRef<MapView, MapViewComponentProps>(
  (
    {
      initialRegion,
      mapType = 'standard',
      routeCoordinates,
      startMarker,
      endMarker,
      location,
      startingLocation,
      destination,
      style,
      showNavigationOptions = false,
      showGrid = false,
      selectedGridRectangle = null,
      navigationPosition = null,
      currentUserPosition = null,
      onMapPress,
      onMapLoad,
      onRegionDidChange,
      // onAddressSelect,
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const [selectedApp, setSelectedApp] = useState<string | null>(null);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showNavigationModal, setShowNavigationModal] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState<{
      displayValue: string;
      coordinates: string;
      latitude: number;
      longitude: number;
    } | null>(null);

    // Function to refocus on current location
    const focusOnCurrentLocation = () => {
      if (ref && typeof ref !== 'function' && ref.current && location?.region) {
        ref.current.animateToRegion(location.region, 1000);
      }
    };

    // Show navigation options when destination is available
    useEffect(() => {
      if (destination && showNavigationOptions) {
        setShowNavigationModal(true);
      }
    }, [destination, showNavigationOptions]);

    const handleAppSelect = (appType: string) => {
      if (!destination) return;

      setSelectedApp(appType);
      const [destLng, destLat] = destination.coordinates.split(',').map(Number);

      const addressData = {
        displayValue: destination.displayValue,
        coordinates: destination.coordinates,
        latitude: destLat,
        longitude: destLng,
      };

      setSelectedAddress(addressData);
      setShowNavigationModal(false); // Close navigation modal
      setShowAddressModal(true); // Show address details modal

      // Call the callback if provided
      // if (onAddressSelect) {
      //   onAddressSelect(addressData);
      // }
    };

    const handleInfoPress = () => {
      Alert.alert(
        'Address Information',
        'Select a navigation app to view the address details. This will show you the location name, coordinates, and other relevant information.',
        [{ text: 'OK' }],
      );
    };

    return (
      <>
        <MapViewMapLibre
          key={'map-instance'}
          style={[
            style,
            {
              marginBottom: insets.bottom - 12,
            },
          ]}
          ref={ref}
          initialRegion={initialRegion}
          showGrid={showGrid}
          selectedGridRectangle={selectedGridRectangle}
          onMapPress={onMapPress}
          onMapLoad={onMapLoad}
          onRegionDidChange={onRegionDidChange}
          currentUserPosition={currentUserPosition}
        >
          {routeCoordinates && routeCoordinates?.length > 0 ? (
            <>
              <MapLibrePolyline
                coordinates={routeCoordinates}
                strokeColor="#0000FF"
                strokeWidth={6}
              />
              {startMarker && (
                <MapLibreMarker
                  coordinate={{
                    latitude: startMarker.latitude,
                    longitude: startMarker.longitude,
                  }}
                  title={startingLocation?.displayValue}
                  pinColor={Colors.primary[500]}
                />
              )}
              {endMarker && (
                <MapLibreMarker
                  coordinate={{
                    latitude: endMarker.latitude,
                    longitude: endMarker.longitude,
                  }}
                  pinColor="green"
                  title={destination?.displayValue}
                />
              )}
              {/* Navigation position is now shown as animated grid cell via currentUserPosition */}
            </>
          ) : null /* Idle current location is now shown as animated grid cell via currentUserPosition */}
        </MapViewMapLibre>

        {/* Refocus on Current Location Button */}
        {location?.region && !routeCoordinates && (
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={focusOnCurrentLocation}>
            <Icon
              source="crosshairs-gps"
              size={24}
              color={Colors.primary['500']}
            />
          </TouchableOpacity>
        )}

        {/* Navigation Options Button */}
        {destination && showNavigationOptions && (
          <View style={styles.navigationButtonContainer}>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => setShowNavigationModal(true)}>
              <Icon source="navigation" size={20} color={Colors.light['0']} />
              <Text style={styles.navigationButtonText}>
                {i18n.t('(tabs).index.openWith')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Navigation Options Modal */}
        <Modal
          visible={showNavigationModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowNavigationModal(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowNavigationModal(false)}>
            <TouchableOpacity
              style={styles.routeModalContainer}
              activeOpacity={1}
              onPress={e => e.stopPropagation()}>
              {/* Header */}
              <View style={styles.routeModalHeader}>
                <Text style={styles.routeModalTitle}>
                  {i18n.t('(tabs).index.openWith')}
                </Text>
                <TouchableOpacity
                  onPress={handleInfoPress}
                  style={styles.infoButton}>
                  <Icon source="information" size={20} color={Colors.grey} />
                </TouchableOpacity>
              </View>

              {/* App Options Grid */}
              <View style={styles.appOptionsGrid}>
                {/* First Row */}
                <View style={styles.appRow}>
                  <TouchableOpacity
                    style={[
                      styles.appOption,
                      selectedApp === 'apple-maps' && styles.appOptionSelected,
                    ]}
                    onPress={() => handleAppSelect('apple-maps')}>
                    <View
                      style={[
                        styles.appIconContainer,
                        selectedApp === 'apple-maps' &&
                          styles.appIconContainerSelected,
                      ]}>
                      <View style={styles.appleMapsIcon}>
                        <Icon source="map" size={24} color="#007AFF" />
                      </View>
                    </View>
                    <Text style={styles.appOptionText}>Apple Maps</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.appOption,
                      selectedApp === 'jango' && styles.appOptionSelected,
                    ]}
                    onPress={() => handleAppSelect('jango')}>
                    <View
                      style={[
                        styles.appIconContainer,
                        selectedApp === 'jango' &&
                          styles.appIconContainerSelected,
                      ]}>
                      <View style={styles.jangoIcon}>
                        <Text style={styles.jangoIconText}>j</Text>
                      </View>
                    </View>
                    <Text style={styles.appOptionText}>Jango</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.appOption,
                      selectedApp === 'maps' && styles.appOptionSelected,
                    ]}
                    onPress={() => handleAppSelect('maps')}>
                    <View
                      style={[
                        styles.appIconContainer,
                        selectedApp === 'maps' &&
                          styles.appIconContainerSelected,
                      ]}>
                      <View style={styles.mapsIcon}>
                        <Icon source="map-marker" size={24} color="#EA4335" />
                      </View>
                    </View>
                    <Text style={styles.appOptionText}>Maps</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.appOption,
                      selectedApp === 'waze' && styles.appOptionSelected,
                    ]}
                    onPress={() => handleAppSelect('waze')}>
                    <View
                      style={[
                        styles.appIconContainer,
                        selectedApp === 'waze' &&
                          styles.appIconContainerSelected,
                      ]}>
                      <View style={styles.wazeIcon}>
                        <Icon source="chat" size={24} color="#33B5E5" />
                      </View>
                    </View>
                    <Text style={styles.appOptionText}>Waze</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => setShowNavigationModal(false)}>
                  <Text style={styles.modalActionButtonText}>
                    {i18n.t('(tabs).index.justOnce')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    styles.modalActionButtonPrimary,
                  ]}
                  onPress={() => setShowNavigationModal(false)}>
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

        {/* Address Details Modal */}
        <Modal
          visible={showAddressModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddressModal(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddressModal(false)}>
            <TouchableOpacity
              style={styles.addressModalContainer}
              activeOpacity={1}
              onPress={e => e.stopPropagation()}>
              {/* Header */}
              <View style={styles.addressModalHeader}>
                <Text style={styles.addressModalTitle}>
                  {selectedAddress?.displayValue || 'Address Details'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddressModal(false)}
                  style={styles.closeButton}>
                  <Icon source="close" size={24} color={Colors.grey} />
                </TouchableOpacity>
              </View>

              {/* Address Information */}
              {selectedAddress && (
                <View style={styles.addressDetailsContainer}>
                  <View style={styles.addressDetailRow}>
                    <Icon
                      source="map-marker"
                      size={20}
                      color={Colors.primary['500']}
                    />
                    <View style={styles.addressDetailContent}>
                      <Text style={styles.addressDetailLabel}>
                        Location Name
                      </Text>
                      <Text style={styles.addressDetailValue}>
                        {selectedAddress.displayValue}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.addressDetailRow}>
                    <Icon
                      source="map"
                      size={20}
                      color={Colors.primary['500']}
                    />
                    <View style={styles.addressDetailContent}>
                      <Text style={styles.addressDetailLabel}>Coordinates</Text>
                      <Text style={styles.addressDetailValue}>
                        {selectedAddress.coordinates}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.addressDetailRow}>
                    <Icon
                      source="latitude"
                      size={20}
                      color={Colors.primary['500']}
                    />
                    <View style={styles.addressDetailContent}>
                      <Text style={styles.addressDetailLabel}>Latitude</Text>
                      <Text style={styles.addressDetailValue}>
                        {selectedAddress.latitude.toFixed(6)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.addressDetailRow}>
                    <Icon
                      source="longitude"
                      size={20}
                      color={Colors.primary['500']}
                    />
                    <View style={styles.addressDetailContent}>
                      <Text style={styles.addressDetailLabel}>Longitude</Text>
                      <Text style={styles.addressDetailValue}>
                        {selectedAddress.longitude.toFixed(6)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.addressDetailRow}>
                    <Icon
                      source="information"
                      size={20}
                      color={Colors.primary['500']}
                    />
                    <View style={styles.addressDetailContent}>
                      <Text style={styles.addressDetailLabel}>
                        Selected App
                      </Text>
                      <Text style={styles.addressDetailValue}>
                        {selectedApp || 'None'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => setShowAddressModal(false)}>
                  <Text style={styles.modalActionButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </>
    );
  },
);

MapViewComponent.displayName = 'MapViewComponent';

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  routeModalContainer: {
    backgroundColor: Colors.light['0'],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 60,
    height: '70%',
  },
  routeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  routeModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark['0'],
  },
  infoButton: {
    padding: 8,
  },
  appOptionsGrid: {
    flex: 1,
  },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  appOption: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  appOptionSelected: {
    backgroundColor: Colors.primary['500'] + '20',
    borderRadius: 12,
    padding: 8,
  },
  appIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light['10'],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appIconContainerSelected: {
    backgroundColor: Colors.primary['500'] + '30',
  },
  appOptionText: {
    fontSize: 12,
    color: Colors.dark['0'],
    textAlign: 'center',
  },
  appleMapsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jangoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary['500'] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jangoIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary['500'],
  },
  mapsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EA433520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wazeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#33B5E520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: Colors.light['10'],
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalActionButtonPrimary: {
    backgroundColor: Colors.primary['500'],
  },
  modalActionButtonText: {
    fontSize: 16,
    color: Colors.dark['0'],
    fontWeight: '500',
  },
  modalActionButtonTextPrimary: {
    color: Colors.light['0'],
  },
  // Address Modal Styles
  addressModalContainer: {
    backgroundColor: Colors.light['0'],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 60,
    height: '60%',
  },
  addressModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addressModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark['0'],
  },
  closeButton: {
    padding: 8,
  },
  addressDetailsContainer: {
    flex: 1,
  },
  addressDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light['10'],
  },
  addressDetailContent: {
    flex: 1,
    marginLeft: 12,
  },
  addressDetailLabel: {
    fontSize: 14,
    color: Colors.grey,
    marginBottom: 4,
  },
  addressDetailValue: {
    fontSize: 16,
    color: Colors.dark['0'],
    fontWeight: '500',
  },
  // Recenter Button Styles
  recenterButton: {
    position: 'absolute',
    bottom: -1000,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light['0'],
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  // Navigation Button Styles
  navigationButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  navigationButton: {
    backgroundColor: Colors.primary['500'],
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  navigationButtonText: {
    color: Colors.light['0'],
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MapViewComponent;
