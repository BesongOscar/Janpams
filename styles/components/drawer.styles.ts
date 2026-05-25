import { Colors } from '@/constants';
import { Dimensions, Platform, StyleSheet } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_DRAWER_WIDTH = 262; // Maximum width constraint
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.9, MAX_DRAWER_WIDTH); // 90% of screen width but max 262px

export const drawerStyles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: Platform.OS === 'ios' ? 66 : 50,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.light[0],
    zIndex: 10,
  },
  closeButton: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 2,
    paddingRight: 8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent black
    zIndex: 1, // Ensures it's above the main screen
  },
  mainContainer: {
    padding: 20,
    flex: 1,
  },
  navContainer: {
    marginTop: 80,
    paddingHorizontal: 16,
  },
  topNavItemsContainer: {
    rowGap: 30,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: Colors.dark['0.2'],
  },
  bottomNavItemsContainer: {
    marginTop: 36,
    rowGap: 20,
  },
  navigationItem: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    alignItems: 'center',
    columnGap: 30,
  },
  navItemText: {
    fontSize: 14,
    color: Colors.dark['0.4'],
    lineHeight: 18,
  },
  logoutHeadingText: {
    fontSize: 20,
    fontFamily: 'gentium',
    flexShrink: 1,
    textAlign: 'center',
  },
  dialogSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    paddingBottom: 12,
  },
  logoutSubHeading: {
    fontFamily: 'gentium',
    textAlign: 'center',
  },
  dialogActionContainer: {
    flexDirection: 'row',
    columnGap: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  buttonContainer: {
    width: 40,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: Colors.logout,
  },
});
