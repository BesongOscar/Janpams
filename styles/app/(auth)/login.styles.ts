import { Colors } from '@/constants';
import { StyleSheet } from 'react-native';

export const loginStyles = StyleSheet.create({
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
  illustrationImage: {
    resizeMode: 'contain',
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginRight: 24,
    marginTop: -8
  },
  moreGap: { rowGap: 24 },
  forgotText: {
    color: Colors.primary['500'],
    textDecorationLine: 'underline',
  },
  forgotHeadingContainer: {
    marginVertical: 12,
    alignItems: 'center',
    rowGap: 4,
  },
  marginTop26: {
    marginTop: 26,
  },
  marginRight0: {
    marginRight: 0,
  },
  topComponent: {
    flex: 0.4,
  },
  bottomComponent: {
    flex: 0.6,
  },
  topNav: {
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  bottomLinkContainer: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 24,
    paddingHorizontal: 28,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  activeNavItem: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary['500'],
  },
  navText: {
    fontSize: 16,
    color: Colors.inactive,
  },
  activeNavText: {
    color: Colors.primary['500'],
  },
  linkText: {
    fontWeight: '500',
    color: Colors.primary['500'],
  },
  inputsContainer: {
    rowGap: 14,
  },
  socialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10, // Adjust margin as needed
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.inactive, // Color of the divider
    marginHorizontal: 10, // Space between the text and the divider
  },
  socialText: {
    fontSize: 10,
  },
  socialsButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
   
  },
  socialLogo: {
    width: 20,
    height: 20,
  },
  socialButton: {
    flexDirection: 'row',
    backgroundColor: Colors.light['10'],
    alignItems: 'center',
    columnGap: 16,
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
    borderColor: Colors.primary['50'],
    borderWidth: 1,
  },
});
