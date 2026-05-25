import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Button, Icon } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants';
import { tabIndexStyles as styles } from '@/styles';
import SearchInput from './SearchInput';
import i18n from '../i18n';

interface Waypoint {
  displayValue: string;
  coordinates: string;
}

interface RoutePlanningProps {
  waypoints: Waypoint[];
  startingLocation?: {
    displayValue: string;
    coordinates: string;
  };
  destination?: {
    displayValue: string;
    coordinates: string;
  };
  onAddWaypoint: () => void;
  onRemoveWaypoint: (index: number) => void;
  onFindRoute: () => void;
  onSetActiveSearchInput: (input: string) => void;
}

const RoutePlanning: React.FC<RoutePlanningProps> = ({
  waypoints,
  startingLocation,
  destination,
  onAddWaypoint,
  onRemoveWaypoint,
  onFindRoute,
  onSetActiveSearchInput,
}) => {
  return (
    <View style={styles.routePlanningContainer}>
      <View style={styles.routeInputsContainer}>
        <View style={styles.routeInputRow}>
          <View style={styles.routeInputWrapper}>
            <SearchInput
              query={startingLocation?.displayValue || ''}
              onQueryChange={() => {}}
              placeholder={i18n.t('(tabs).index.startingPoint')}
              onFocus={() => onSetActiveSearchInput('starting')}
              onClear={() => {}}
              style={styles.routeSearchInput}
            />
          </View>
        </View>

        {waypoints.map((waypoint, index) => (
          <View key={index} style={styles.routeInputRow}>
            <View style={styles.routeInputWrapper}>
              <SearchInput
                query={waypoint.displayValue}
                onQueryChange={() => {}}
                placeholder={i18n.t('(tabs).index.waypoint')}
                onFocus={() => onSetActiveSearchInput(`waypoint-${index}`)}
                onClear={() => {}}
                style={styles.routeSearchInput}
              />
            </View>
            <TouchableOpacity
              style={styles.removeWaypointButton}
              onPress={() => onRemoveWaypoint(index)}>
              <Icon source={'close'} size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.routeInputRow}>
          <View style={styles.routeInputWrapper}>
            <SearchInput
              query={destination?.displayValue || ''}
              onQueryChange={() => {}}
              placeholder={i18n.t('(tabs).index.destination')}
              onFocus={() => onSetActiveSearchInput('destination')}
              onClear={() => {}}
              style={styles.routeSearchInput}
            />
          </View>
        </View>

        <View style={styles.routeActionsContainer}>
          <TouchableOpacity
            style={styles.addDestinationButton}
            onPress={onAddWaypoint}>
            <Icon source={'plus-box'} size={12} color={Colors.light[10]} />
            <Text style={styles.addDestinationText}>
              {i18n.t('(tabs).index.addDestination')}
            </Text>
          </TouchableOpacity>
          <Button style={styles.findRouteCTAButton} onPress={onFindRoute}>
            <Text style={styles.findRouteCTAText}>
              {i18n.t('(tabs).index.letsGo')}
            </Text>
          </Button>
        </View>

        <View style={styles.arrowsContainer}>
          {waypoints.length === 0 && (
            <Ionicons name="swap-vertical" size={24} color={Colors.light[10]} />
          )}
        </View>
      </View>
    </View>
  );
};

export default RoutePlanning;
