import { Colors } from '@/constants';
import { StyleSheet } from 'react-native';

export const myAddressesStyles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 32,
  },
  zIndexNegative: { zIndex: -99 },
  zIndexPositive: { zIndex: 999 },
  searchResultContainer: {
    width: '90%',
    alignSelf: 'center',
    top: 68,
  },
  menuContainer: {
    position: 'relative',
    zIndex: 999,
  },
  notificationHeading: {
    fontSize: 14,
  },
  notificationItem: {
    backgroundColor: Colors.light[10],
    padding: 10,
    // borderRadius: 6,
    // borderBottomWidth: 0.2,
    // borderBottomColor: Colors.grey,
    marginBottom: 2,
    marginHorizontal: 16,
    rowGap: 4,
  },
  notificationText: {
    color: Colors.dark[0.75],
    fontSize: 12,
  },
  whiteBackground: {
    backgroundColor: Colors.light[10],
  },
  searchContainer: {
    width: 'auto',
    marginHorizontal: 24,
  },
  addAliasSearchContainer: {
    width: 'auto',
    marginHorizontal: 20,
  },
  topNav: {
    marginVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  headerContainer: {
    backgroundColor: Colors.primary[500],
    height: 64,
    paddingHorizontal: 16,
  },
  headerText: {
    color: Colors.light[10],
    fontSize: 16,
    fontWeight: '500',
  },
  headingContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    rowGap: 16,
  },
  contentContainer: {
    padding: 24,
    rowGap: 4,
    zIndex: -9,
  },
  zIndex99: {
    zIndex: 99,
  },
  mainHeadingText: {
    color: Colors.dark[0.5],
    fontSize: 14,
  },
  addressComponentContainer: {
    backgroundColor: Colors.primary['2'],
    paddingVertical: 8,
    paddingHorizontal: 12,
    rowGap: 4,
    zIndex: -99,
  },
  addressTopComponent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 36,
  },
  addressComponentCountryText: {
    color: Colors.dark[0],
    fontSize: 10,
  },
  addressNameText: {
  
    color: Colors.dark[0],
    marginBottom: 2,
  },
  addressStreetText: {
    fontSize: 10,
    color: Colors.dark[0],
    marginBottom: 2,
  },
  addressTextContainer: {
    flexShrink: 1,
    width: '60%',
  },
  shareIconsContainer: {
    flexDirection: 'row',
    flexShrink: 1,
    columnGap: 8,
    alignItems: 'center',
  },
  noAddressFoundContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: -99,
  },
  noAddressFoundText: {
    fontSize: 20,
    textAlign: 'center',
    color: Colors.dark[0.5],
  },
  addHomeAddressContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
  },
  addHomeAddressText: {
    fontSize: 12,
    color: Colors.primary[500],
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark['0.04'],
    columnGap: 24,
  },
  profileLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 28,
    // flexGrow: 1,
    flexShrink: 1,
  },
  profileDetailsContainer: {
    flexShrink: 1,
    overflow: 'hidden',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  profileDetailsTopContainer: {
    alignItems: 'flex-start',
    rowGap: 4,
  },
  profileImageContainer: {
    width: 81,
    height: 81,
    borderRadius: 81,
    backgroundColor: Colors.dark[0.1],
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: 81,
    height: 81,
    borderRadius: 81,
  },
  avatar: {
    width: 48,
    height: 48,
  },
  profileText: {
    fontSize: 14,
    color: Colors.dark['0.8'],
  },
  editButton: {
    height: 36,
    width: 96,
    flexDirection: 'row',
    columnGap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary[10],
    borderRadius: 2,
  },
  editButtonText: {
    fontSize: 12,
    color: Colors.primary[500],
  },
  homeAddressHeadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeAddressContainer: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light[10],
    rowGap: 4,
    borderColor: Colors.primary['75'],
  },
  homeAddressText: {
    fontSize: 14,
  },
  smallText: {
    fontSize: 12,
  },
  helpItemContainer: {
    rowGap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark[0.04],
  },
  helpHeading: {
    fontSize: 14,
  },
  helpSubHeading: {
    fontSize: 12,
    color: Colors.dark['0.75'],
  },
  settingsOptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark[0.04],
  },
  settingsOptionTopContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switch: { width: 48 },
  settingsOptionSubtitleText: { fontSize: 12, color: Colors.dark[0.5] },
  languageContainer: {
    width: 76,
    height: 20,
    backgroundColor: Colors.dark[0.02],
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  languageText: {
    fontSize: 10,
  },
  deleteAccountContainer: {
    borderBottomWidth: 0,
    backgroundColor: Colors.errorLight,
  },
  moreContainer: { position: 'relative' },
  moreModalContainer: {
    position: 'absolute',
    backgroundColor: 'white',
    width: 124,
    right: 0,
    top: '50%',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    // iOS shadow properties
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,

    // Android shadow (Elevation)
    elevation: 4,
  },
  moreTouchableOpacity: {
    flexDirection: 'row',
    columnGap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflowX: 'hidden',
    flexShrink: 1,
  },
  saveHomeAddressText: { fontSize: 10, flexShrink: 1, flexWrap: 'wrap' },
  menuModal: {
    position: 'absolute',
    top: '60%',
    backgroundColor: 'white',
    rowGap: 12,
    overflowY: 'auto',
    padding: 16,
    right: 0,
    width: 124,
    borderRadius: 8,
    zIndex: 99,
    shadowColor: '#000', // iOS Shadow Color
    shadowOffset: { width: 0, height: 4 }, // iOS Shadow Offset
    shadowOpacity: 0.3, // iOS Shadow Opacity
    shadowRadius: 4, // iOS Shadow Blur R
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    justifyContent: 'space-between',
  },

  searchInputContainer: {
    flexDirection: 'row',
    height: 40,
    flexShrink: 1,
  },

  height56: {
    height: 56,
  },

  searchAndReplaceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    overflow: 'hidden',
  },
  dialogTitle: {
    color: Colors.error,
  },
  dialogSubTitle: {
    fontFamily: 'gantium',
    textAlign: 'center',
  },
  errorBorder: {
    borderWidth: 1,
    borderColor: Colors.error,
  },
  marginVertical24: {
    marginVertical: 24,
  },
});
