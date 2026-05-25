import { Colors } from '@/constants';
import { StyleSheet } from 'react-native';

export const authIndexStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
    paddingTop: 12,
    rowGap: 20,
  },
  appIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  illustratorImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  // Keep image sizing controlled by asset; screen will scroll
  textContainer: {
    marginHorizontal: 24,
    rowGap: 16,
  },
  headingText: {
    fontSize: 16,
    fontFamily: 'gentium-bold',
    textAlign: 'center',
  },
  subheadingText: {
    fontFamily: 'gentium',
    fontSize: 14,
    textAlign: 'center',
  },
  bottomLinkContainer: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 24,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  linkText: {
    fontWeight: '500',
    color: Colors.primary['500'],
  },
  actionsContainer: {
    rowGap: 12,
    paddingHorizontal: 0,
  },
});
