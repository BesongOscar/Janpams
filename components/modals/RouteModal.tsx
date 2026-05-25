import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Linking,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors, routeNavigationApps } from '@/constants';
import NavigationOption from '../NavigationOption';
import i18n from '../../i18n';

interface RouteModalProps {
  visible: boolean;
  onClose: () => void;
  startingLocation?: {
    displayValue: string;
    coordinates: string;
  };
  destination?: {
    displayValue: string;
    coordinates: string;
  };
  waypoints?: {
    displayValue: string;
    coordinates: string;
  }[];
  routeDetails?: {
    distance: string;
    duration: string;
  };
  /** When provided, show "Start navigation" to begin in-app turn-by-turn. */
  onStartInAppNavigation?: () => void;
}

export const RouteModal: React.FC<RouteModalProps> = ({
  visible,
  onClose,
  startingLocation,
  destination,
  waypoints = [],
  onStartInAppNavigation,
}) => {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'work'>('personal');

  // Filter navigation apps based on platform
  const getPlatformSpecificApps = () => {
    if (Platform.OS === 'ios') {
      // Show Apple Maps and other iOS-compatible apps
      return routeNavigationApps.filter(app => 
        app.id === 'apple-maps' ||
        app.id === 'jango' ||
        app.id === 'waze' ||
        app.id === 'here' ||
        app.id === 'mapsme' ||
        app.id === 'uber' ||
        app.id === 'lyft'
      );
    } else {
      // Show Google Maps and other Android-compatible apps
      return routeNavigationApps.filter(app => 
        app.id === 'maps' || 
        app.id === 'jango' ||
        app.id === 'waze' ||
        app.id === 'here' ||
        app.id === 'mapsme' ||
        app.id === 'uber' ||
        app.id === 'lyft'
      );
    }
  };

  // When in-app navigation is available, hide "Jango" from the list — that option opened
  // Google Maps; the primary "Start navigation" button above is our in-app Valhalla engine.
  const platformSpecificApps = useMemo(() => {
    const apps = getPlatformSpecificApps();
    return onStartInAppNavigation != null ? apps.filter(a => a.id !== 'jango') : apps;
  }, [onStartInAppNavigation]);

  const handleAppOpen = (appType: string) => {
    if (!startingLocation || !destination) return;

    setSelectedApp(appType);
    const [startLng, startLat] = startingLocation.coordinates
      .split(',')
      .map(Number);
    const [destLng, destLat] = destination.coordinates.split(',').map(Number);

    // Prepare waypoints for URL generation with unique labels and route optimization
    const waypointCoords = waypoints.map((wp, index) => {
      const [lng, lat] = wp.coordinates.split(',').map(Number);
      return `${lat},${lng}`;
    });

    // Create waypoint labels for better clarity
    const waypointLabels = waypoints.map((wp, index) => {
      const stopName = wp.displayValue?.split(',')[0] || `Stop ${index + 1}`;
      return stopName.replace(/[^a-zA-Z0-9\s]/g, '').trim(); // Clean the label
    });

    // Helper function to create waypoints with labels for Google Maps
    // Uses optimize:true to ensure waypoints follow the actual route path
    const createWaypointsWithLabels = () => {
      if (waypointCoords.length === 0) return '';
      
      // For Google Maps, we'll use coordinates without labels to avoid parsing issues
      // Labels can cause "No results" errors when the format isn't perfect
      return `&waypoints=${waypointCoords.join('|')}&optimize=true`;
    };

    switch (appType) {
      case 'maps': { // Use Google Maps directions URL
        let mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=driving`;
        
        // Add waypoints with labels and route optimization if they exist
        mapsUrl += createWaypointsWithLabels();
        
        // Add additional route optimization parameters
        if (waypointCoords.length > 0) {
          mapsUrl += '&avoid=tolls&avoid=ferries';
        }

        Linking.openURL(mapsUrl).catch(() => {
          // Fallback to app URL scheme
          let appUrl = `comgooglemaps://?saddr=${startLat},${startLng}&daddr=${destLat},${destLng}&directionsmode=driving`;
          
          // Add waypoints for app URL (app scheme doesn't support labels or optimization)
          if (waypointCoords.length > 0) {
            appUrl += `&waypoints=${waypointCoords.join('|')}`;
          }
          
          Linking.openURL(appUrl).catch(() => {
            Linking.openURL(mapsUrl);
          });
        });
        break;
      }

      case 'waze': {
        const wazeUrl = `waze://?ll=${destLat},${destLng}&navigate=yes&from=${startLat},${startLng}`;

        Linking.openURL(wazeUrl).catch(() => {
          // Fallback to Google Maps directions if Waze is not installed
          let fallbackUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=driving`;
          fallbackUrl += createWaypointsWithLabels();
          if (waypointCoords.length > 0) {
            fallbackUrl += '&avoid=tolls&avoid=ferries';
          }
          Linking.openURL(fallbackUrl);
        });
        
        if (waypointCoords.length > 0) {
          Alert.alert(
            'Waypoints Notice',
            'Waze will navigate to your destination. Waypoints will need to be added manually in the Waze app.',
            [{ text: 'OK' }]
          );
        }
        break;
      }

      case 'uber': {
        const uberUrl = `uber://?action=setPickup&pickup[latitude]=${startLat}&pickup[longitude]=${startLng}&dropoff[latitude]=${destLat}&dropoff[longitude]=${destLng}`;

        Linking.openURL(uberUrl).catch(() => {
          // Fallback to web if Uber app is not installed
          const webUrl = `https://m.uber.com/ul/?pickup=${startLat},${startLng}&dropoff=${destLat},${destLng}`;
          Linking.openURL(webUrl);
        });
        
        if (waypointCoords.length > 0) {
          Alert.alert(
            'Waypoints Notice',
            'Uber will take you directly to your destination. Waypoints are not supported in ride-hailing apps.',
            [{ text: 'OK' }]
          );
        }
        break;
      }

      case 'lyft': {
        const lyftUrl = `lyft://ridetype?pickup[latitude]=${startLat}&pickup[longitude]=${startLng}&destination[latitude]=${destLat}&destination[longitude]=${destLng}`;

        Linking.openURL(lyftUrl).catch(() => {
          // Fallback to web if Lyft app is not installed
          const webUrl = `https://www.lyft.com/rider?pickup=${startLat},${startLng}&destination=${destLat},${destLng}`;
          Linking.openURL(webUrl);
        });
        
        if (waypointCoords.length > 0) {
          Alert.alert(
            'Waypoints Notice',
            'Lyft will take you directly to your destination. Waypoints are not supported in ride-hailing apps.',
            [{ text: 'OK' }]
          );
        }
        break;
      }

      case 'jango': {
        // Use Google Maps directions since Jango relies on Google Maps
        let jangoMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=driving`;
        
        // Add waypoints with labels and route optimization if they exist
        jangoMapsUrl += createWaypointsWithLabels();
        
        // Add additional route optimization parameters
        if (waypointCoords.length > 0) {
          jangoMapsUrl += '&avoid=tolls&avoid=ferries';
        }
        
        Linking.openURL(jangoMapsUrl).catch(() => {
          let appUrl = `comgooglemaps://?saddr=${startLat},${startLng}&daddr=${destLat},${destLng}&directionsmode=driving`;
          
          // Add waypoints for app URL (app scheme doesn't support labels or optimization)
          if (waypointCoords.length > 0) {
            appUrl += `&waypoints=${waypointCoords.join('|')}`;
          }
          
          Linking.openURL(appUrl).catch(() => {
            Linking.openURL(jangoMapsUrl);
          });
        });
        break;
      }

      case 'apple-maps': {
        // Use Apple Maps native app URL scheme for directions
        const appleMapsUrl = `maps://?saddr=${startLat},${startLng}&daddr=${destLat},${destLng}`;
        Linking.openURL(appleMapsUrl).catch(() => {
          // Fallback to Apple Maps web URL if app scheme fails
          const webAppleMapsUrl = `http://maps.apple.com/?saddr=${startLat},${startLng}&daddr=${destLat},${destLng}`;
          Linking.openURL(webAppleMapsUrl).catch(() => {
            // Final fallback to Google Maps directions
            let fallbackUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=driving`;
            fallbackUrl += createWaypointsWithLabels();
            if (waypointCoords.length > 0) {
              fallbackUrl += '&avoid=tolls&avoid=ferries';
            }
            Linking.openURL(fallbackUrl);
          });
        });
        
        if (waypointCoords.length > 0) {
          Alert.alert(
            'Waypoints Notice',
            'Apple Maps will navigate to your destination. Waypoints will need to be added manually in the Apple Maps app.',
            [{ text: 'OK' }]
          );
        }
        break;
      }

      case 'here': {
        const hereUrl = `here-route://${startLat},${startLng}/${destLat},${destLng}`;

        Linking.openURL(hereUrl).catch(() => {
          // Fallback to web directions if HERE WeGo app is not installed
          const webUrl = `https://wego.here.com/directions/drive/${startLat},${startLng}/${destLat},${destLng}`;

          Linking.openURL(webUrl);
        });
        
        if (waypointCoords.length > 0) {
          Alert.alert(
            'Waypoints Notice',
            'HERE Maps will navigate to your destination. Waypoints will need to be added manually in the HERE WeGo app.',
            [{ text: 'OK' }]
          );
        }
        break;
      }

      case 'mapsme': {
        const mapsmeUrl = `mapsme://route?sll=${startLat},${startLng}&saddr=${startingLocation.displayValue}&dll=${destLat},${destLng}&daddr=${destination.displayValue}&type=vehicle`;

        Linking.openURL(mapsmeUrl).catch(() => {
          // Fallback to web if MAPS.ME is not installed
          const webUrl = `https://maps.me/route/?sll=${startLat},${startLng}&saddr=${startingLocation.displayValue}&dll=${destLat},${destLng}&daddr=${destination.displayValue}`;
          Linking.openURL(webUrl);
        });
        
        if (waypointCoords.length > 0) {
          Alert.alert(
            'Waypoints Notice',
            'Maps.me will navigate to your destination. Waypoints will need to be added manually in the Maps.me app.',
            [{ text: 'OK' }]
          );
        }
        break;
      }

      case 'citymapper': {
        const citymapperUrl = `citymapper://directions?startcoord=${startLat},${startLng}&endcoord=${destLat},${destLng}&startname=${startingLocation.displayValue}&endname=${destination.displayValue}`;

        Linking.openURL(citymapperUrl).catch(() => {
          // Fallback to web if Citymapper is not installed
          const webUrl = `https://citymapper.com/directions?startcoord=${startLat},${startLng}&endcoord=${destLat},${destLng}&startname=${startingLocation.displayValue}&endname=${destination.displayValue}`;
          Linking.openURL(webUrl);
        });
        
        if (waypointCoords.length > 0) {
          Alert.alert(
            'Waypoints Notice',
            'Citymapper will navigate to your destination. Waypoints will need to be added manually in the Citymapper app.',
            [{ text: 'OK' }]
          );
        }
        break;
      }

      case 'myroute': {
        const myrouteUrl = `myroute://route?from=${startLat},${startLng}&to=${destLat},${destLng}`;

        Linking.openURL(myrouteUrl).catch(() => {
          // Fallback to web if MyRoute-app is not installed
          const webUrl = `https://myroute.app/route?from=${startLat},${startLng}&to=${destLat},${destLng}`;
          Linking.openURL(webUrl);
        });
        
        if (waypointCoords.length > 0) {
          Alert.alert(
            'Waypoints Notice',
            'MyRoute will navigate to your destination. Waypoints will need to be added manually in the MyRoute app.',
            [{ text: 'OK' }]
          );
        }
        break;
      }

      default:
        break;
    }
    onClose();
  };

  const handleInfoPress = () => {
    Alert.alert(
      'Navigation Insights',
      'Choose your preferred navigation app to get directions. Each app offers different features like real-time traffic, public transit options, and ride-sharing integration.',
      [{ text: 'OK' }],
    );
  };

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
          style={styles.routeModalContainer}
          activeOpacity={1}
          onPress={e => e.stopPropagation()}>
          {/* Header: when in-app nav is available, emphasize "Navigate"; otherwise "Open with" */}
          <View style={styles.routeModalHeader}>
            <Text style={styles.routeModalTitle}>
              {onStartInAppNavigation != null
                ? i18n.t('(tabs).index.navigate')
                : i18n.t('(tabs).index.openWith')}
            </Text>
            <TouchableOpacity
              onPress={handleInfoPress}
              style={styles.infoButton}>
              <Icon source="information" size={20} color={Colors.grey} />
            </TouchableOpacity>
          </View>

          {/* Start in-app navigation (Valhalla turn-by-turn in this app) */}
          {onStartInAppNavigation != null && (
            <TouchableOpacity
              style={styles.startNavigationButton}
              onPress={() => {
                onStartInAppNavigation();
                // Do not call onClose() here — parent's onClose runs stopNavigation().
                // Handler already closes the modal via setIsRouteModalVisible(false).
              }}>
              <Icon source="navigation" size={22} color={Colors.light[0]} />
              <View style={styles.startNavigationButtonContent}>
                <Text style={styles.startNavigationButtonText}>
                  {i18n.t('(tabs).navigation.startNavigation')}
                </Text>
                <Text style={styles.startNavigationButtonSubtext}>
                  {i18n.t('(tabs).index.turnByTurnInThisApp')}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* "Or open in another app" section label when in-app is the primary */}
          {onStartInAppNavigation != null && platformSpecificApps.length > 0 && (
            <Text style={styles.orOpenInAnotherAppLabel}>
              {i18n.t('(tabs).index.orOpenInAnotherApp')}
            </Text>
          )}

          {/* Personal/Work Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'personal' && styles.tabActive]}
              onPress={() => setActiveTab('personal')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'personal' && styles.tabTextActive,
                ]}>
                Personal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'work' && styles.tabActive]}
              onPress={() => setActiveTab('work')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'work' && styles.tabTextActive,
                ]}>
                Work
              </Text>
            </TouchableOpacity>
          </View>

          {/* App Options Grid */}
          <View style={styles.appOptionsGrid}>
            {platformSpecificApps.map((app, index) => {
              // Group apps into rows of 4
              if (index % 4 === 0) {
                const rowApps = platformSpecificApps.slice(index, index + 4);
                return (
                  <View key={`row-${index}`} style={styles.appRow}>
                    {rowApps.map(appItem => (
                      <NavigationOption
                        key={appItem.id}
                        app={appItem}
                        isSelected={selectedApp === appItem.id}
                        onPress={() => handleAppOpen(appItem.id)}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  routeModalContainer: {
    backgroundColor: Colors.light[0],
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
    marginBottom: 12,
  },
  startNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary[500],
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  startNavigationButtonContent: {
    alignItems: 'center',
  },
  startNavigationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light[0],
  },
  startNavigationButtonSubtext: {
    fontSize: 12,
    color: Colors.light[0],
    opacity: 0.9,
    marginTop: 2,
  },
  orOpenInAnotherAppLabel: {
    fontSize: 14,
    color: Colors.grey,
    marginBottom: 8,
  },
  routeModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark[0],
  },
  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light[10],
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: Colors.light[10],
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.light[0],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark[0],
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary[500],
  },
  appOptionsGrid: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 20,
  },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  emptySlot: {
    flex: 1,
    minWidth: 70,
  },
  modalActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 20,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  modalActionButtonPrimary: {
    backgroundColor: 'transparent',
  },
  modalActionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.grey,
  },
  modalActionButtonTextPrimary: {
    color: Colors.grey,
  },
});
