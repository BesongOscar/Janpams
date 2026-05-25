import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';

export interface NavigationApp {
  id: string;
  name: string;
  icon: string;
  iconType: 'material' | 'ionicon' | 'fontawesome' | 'custom';
  color: string;
  textColor: string;
}

interface NavigationOptionProps {
  app: NavigationApp;
  isSelected: boolean;
  onPress: () => void;
}

const NavigationOption: React.FC<NavigationOptionProps> = ({
  app,
  isSelected,
  onPress,
}) => {
  const renderIcon = () => {
    if (app.iconType === 'custom') {
      // For custom icons, we'll use a simple text-based approach
      return (
        <View style={[styles.customIcon, { backgroundColor: app.color }]}>
          <Text style={[styles.customIconText, { color: app.textColor }]}>
            {app.icon}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.iconContainer, { backgroundColor: app.color }]}>
        <Icon source={app.icon} size={20} color={app.textColor} />
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.option, isSelected && styles.optionSelected]}
      onPress={onPress}>
      <View
        style={[styles.iconWrapper, isSelected && styles.iconWrapperSelected]}>
        {renderIcon()}
      </View>
      <Text style={styles.optionText}>{app.name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  option: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    minWidth: 70,
  },
  optionSelected: {
    backgroundColor: Colors.primary['50'],
  },
  iconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: Colors.light.grey,
  },
  iconWrapperSelected: {
    backgroundColor: Colors.primary['500'],
  },
  optionText: {
    fontSize: 12,
    color: Colors.dark['0'],
    textAlign: 'center',
    fontWeight: '500',
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customIconText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default NavigationOption;
