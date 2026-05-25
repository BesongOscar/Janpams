import React from 'react';
import { View, TouchableOpacity, Text, Animated } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import { tabIndexStyles as styles } from '@/styles';
import i18n from '../i18n';

interface TravelTimeModalProps {
  visible: boolean;
  translateY: Animated.Value;
  estimatedTravelTime?: {
    driving: string;
    bicycling: string;
    walking: string;
  };
  distance?: number;
  onClose: () => void;
}

const TravelTimeModal: React.FC<TravelTimeModalProps> = ({
  visible,
  translateY,
  estimatedTravelTime,
  distance,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <Animated.View style={[styles.modal, { transform: [{ translateY }] }]}>
      <View style={styles.nodge} />
      <TouchableOpacity
        style={styles.closeModalIconContainer}
        onPress={onClose}>
        <Icon source={'close'} size={16} color={Colors.error} />
      </TouchableOpacity>
      <View style={styles.modalContent}>
        <Text style={styles.estimateHeading}>
          {estimatedTravelTime?.driving} ({distance ?? 0}km)
        </Text>
        <Text style={styles.estimateSubHeading}>
          {i18n.t('(tabs).index.viaMainRoad')}
        </Text>
        <View style={styles.estimatedTravelTimeContainer}>
          <View
            style={[
              styles.estimatedItemContainer,
              styles.primaryEstimatedItemContainer,
            ]}>
            <Icon source={'car'} color={Colors.light[10]} size={14} />
            <Text style={styles.mainEstimatedText}>
              {estimatedTravelTime?.driving}
            </Text>
          </View>
          <View style={styles.estimatedItemContainer}>
            <Icon source={'bike'} color={Colors['grey-dark']} size={14} />
            <Text style={styles.estimateSubHeading}>
              {estimatedTravelTime?.bicycling}
            </Text>
          </View>
          <View style={styles.estimatedItemContainer}>
            <Icon source={'walk'} color={Colors['grey-dark']} size={14} />
            <Text style={styles.estimateSubHeading}>
              {estimatedTravelTime?.walking}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default TravelTimeModal;
