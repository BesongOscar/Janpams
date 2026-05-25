import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Colors } from '@/constants';
import { tabIndexStyles as styles } from '@/styles';
import i18n from '../i18n';

interface NavigationTabsProps {
  activeNav: 'getDirection' | 'findRoute';
  onTabChange: (nav: 'getDirection' | 'findRoute') => void;
}

const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeNav,
  onTabChange,
}) => {
  return (
    <View style={styles.topNavItemsContainer}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('getDirection')}>
        <Text
          style={[
            styles.navItemText,
            activeNav === 'getDirection' && styles.activeNavItemText,
          ]}>
          {i18n.t('(tabs).index.getDirection')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('findRoute')}>
        <Text
          style={[
            styles.navItemText,
            activeNav === 'findRoute' && styles.activeNavItemText,
          ]}>
          {i18n.t('(tabs).index.findRoute')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default NavigationTabs;
