import { Colors } from '@/constants';
import { Dimensions, Platform, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');
export const tabLayoutStyles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    height: 48,
    backgroundColor: Colors.light['10'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    backgroundColor: Colors.light[10],
    width: width / 2,
    justifyContent: 'center',
    alignItems: 'center',
    height: Platform.OS === 'ios' ? 48 : 52,
    marginTop: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary[500],
  },
  tabTextFocused: {
    color: Colors.light['10'],
  },
  tabIconFocused: {
    backgroundColor: Colors.primary[500],
  },
  tabIconImage: {
    width: 18,
    height: 18,
    tintColor: Colors.primary[500],
  },
  tabIconImageFocused: {
    tintColor: Colors.light['10'],
  },
});
