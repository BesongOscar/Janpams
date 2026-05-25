import { Colors } from '@/constants';
import { Dimensions, Platform, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');

export const tabIndexStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  z9: {
    zIndex: 9,
  },
  map: {
    width: '100%',
    height: '100%',
    flex: 1,
    bottom: -24,
    position: 'absolute',
  },
  contentPadding: { paddingBottom: 16, paddingTop: 0 },
  paddingBottom: {
    paddingTop: 0,
    paddingBottom: 4,
  },
  lastContentPadding: { paddingTop: 0, paddingBottom: 24 },
  paddingBottom32: { paddingBottom: 32 },
  inputContainerStyle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    zIndex: 1,
  },
  topBar: {
    zIndex: 50,
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary[75],
    padding: 16,
  },
  topNav: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 32,
  },
  topNavItemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    flexGrow: 1,
    // paddingHorizontal: 24,
  },
  navItem: {
    paddingVertical: 12,
  },
  navItemText: {
    paddingBottom: 4,
    paddingHorizontal: 4,
    fontWeight: '500',
    color: Colors.light[10.6],
  },
  activeNavItemText: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.light[10],
    color: Colors.light[10],
  },
  searchContainer: {
    marginTop: 12,
    paddingHorizontal: 4,
    width: '100%',
  },
  searchInputContainer: {
    flexDirection: 'row',
    height: 40,
  },
  searchIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    backgroundColor: Colors.light[0],
    height: '100%',
    // borderTopLeftRadius: 8,
    // borderBottomLeftRadius: 8,
    borderRadius: 8,
    flexDirection: 'row',
    paddingHorizontal: 12,
    rowGap: 20,
    flexGrow: 1, // Takes remaining space
    flexShrink: 1, // Prevents unwanted growth
    maxWidth: '100%',
    overflow: 'hidden',
  },
  search: {
    flexGrow: 1, // Takes remaining space
    flexShrink: 1, // Prevents unwanted growth
    width: '90%',
    maxWidth: '100%',
    paddingHorizontal: 4,
  },
  relativeContainer: {
    position: 'relative',
  },
  z99: {
    zIndex: 99,
  },
  button: {
    paddingVertical: 0,
    width: 104,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    height: '100%',
    backgroundColor: Colors.primary[35],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  buttonText: {
    color: Colors.light[10],
    fontSize: 12,
    lineHeight: 12,
  },
  secondaryText: {
    fontFamily: 'gentium',
  },
  toolTipText: {
    color: Colors.light['10'],
    marginHorizontal: 8,
    marginVertical: 12,
  },
  tipContainer: {
    top: '120%',
    backgroundColor: 'white',
    width: '100%',
    borderRadius: 8,
    position: 'absolute',
    shadowColor: '#000', // iOS Shadow Color
    shadowOffset: { width: 0, height: 4 }, // iOS Shadow Offset
    shadowOpacity: 0.3, // iOS Shadow Opacity
    shadowRadius: 4, // iOS Shadow Blur Radius
    elevation: 5, // Android Shadow
  },
  tipText: {
    margin: 10,
    color: Colors.dark['grey'],
    lineHeight: 24,
    fontSize: 14,
  },
  findRouteMainContainer: {
    flexDirection: 'row',
    columnGap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  findRouteBottomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9,
    width: '100%',
    marginTop: 12,
  },
  findRouteContentContainer: {
    flexDirection: 'column',
    rowGap: 12,
    paddingHorizontal: 12,
    width: '100%',
  },
  addDestinationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    // borderWidth: 1,
    // borderColor: Colors.primary[500],
    borderRadius: 8,
    // backgroundColor: Colors.primary['10'],
  },
  addDestinationText: {
    color: Colors.primary[500],
    fontSize: 12,
      fontWeight: '600',
  },
  findRouteCTAButton: {
    paddingHorizontal: 24,
    backgroundColor: Colors.light[10],
    borderRadius: 4,
  },
  findRouteCTAText: {
    color: Colors.primary[500],
    fontSize: 12,
  },
  arrowsContainer: {
    flexDirection: 'row',
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dialogContainer: {
    backgroundColor: Colors.light['10'],
    borderRadius: 8,
    position: 'relative',
    rowGap: 0,
    paddingVertical: 4,
    width: width * 0.94,
    marginHorizontal: 0,
    alignSelf: 'center',
    top: -75,
  },
  paddingHorizontal: {
    marginTop: 16,
    paddingLeft: 12,
    paddingRight: 12,
    columnGap: 16,
  },
  dialogSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 4,
    paddingHorizontal: 12,
    paddingBottom: 16,
    overflowX: 'hidden',
    flexShrink: 1,
  },
  dialogFirstContent: {
    alignSelf: 'flex-end',
    paddingVertical: 0,
    marginTop: 4,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 2,
    paddingLeft: 0,
    paddingRight: 4,
  },
  dialogTitle: {
    fontSize: 16,
    color: Colors.primary[500],
    textAlign: 'center',
    fontFamily: 'gentium',
  },
  dialogSubtitle: {
    textAlign: 'center',
    fontFamily: 'gentium',
  },
  dialogActionContainer: {
    flexShrink: 1,
    flexDirection: 'row',
    columnGap: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingBottom: 0,
    overflowX: 'hidden',
  },
  justifyCenter: {
    justifyContent: 'center',
  },
  marginTop: {
    marginTop: 32,
  },
  gentiumBold: {
    fontWeight: '700',
    fontFamily: 'gentium-bold',
    fontSize: 12,
  },
  textCenter: {
    flexShrink: 1,
    textAlign: 'center',
  },
  linkText: {
    color: Colors.primary[300],
  },
  shrinkText: {
    flexShrink: 1,
  },
  absoluteIcon: {
    position: 'absolute',
    right: 12,
    top: -1,
  },
  dialogCenterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    paddingTop: 0,
    marginTop: 0,
    paddingBottom: 0,
  },
  fullWidth: {
    width: '100%',
    marginTop: 12,
  },
  dialogContentcontainer: {
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 8,
  },
  darkWhiteBg: {
    backgroundColor: Colors.light[0],
  },
  dialogTitleText: {
    textAlign: 'center',
    color: Colors.primary[500],
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'gentium-bold',
  },
  marginLeft: {
    marginLeft: 32,
  },
  jangoAddress: {
    fontFamily: 'gentium',
    fontWeight: '700',
    textAlign: 'center',
  },
  nearbyAddressesFirstView: {
    borderTopWidth: 1,
    borderTopColor: Colors['grey-93'],
    marginHorizontal: 4,
    marginTop: 4,
  },
  iconColumn: {
    width: 24,
    alignItems: 'center',
  },
  mainTextColumn: {
    flexShrink: 1,
    paddingHorizontal: 5,
    // backgroundColor: 'red',
  },
  shortTextColumn: {
    // flex: 3.2,
    alignItems: 'flex-start',
  },
  lastIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 24,
    // marginLeft: 8,
  },
  lastContainer: {
    alignItems: 'center',
    rowGap: 8,
    marginLeft: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    columnGap: 4,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors['grey-93'],
  },
  addressText: {
    color: Colors.success,
    // textDecorationLine: 'underline',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  shareAddressButton: {
    borderWidth: 1,
    borderColor: Colors.dark[0.1],
    backgroundColor: Colors.secondary[10],
  },
  halfButton: {
    maxWidth: '50%',
  },
  shareAddressText: {
    color: Colors.dark[0],
    fontFamily: 'gentium',
  },
  cancelText: {
    fontFamily: 'gentium',
  },
  findRouteInputContainer: {
    flexDirection: 'row',
    height: 40,
    flex: 1,
    minWidth: 0,
  },
  inputWithIconContainer: {
    position: 'relative',
    flexDirection: 'row',
    columnGap: 12,
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
  },
  inputRowAlign: {
    width: '100%',
    minWidth: 0,
    minHeight: 48,
  },
  findRouteInputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
  },
  findRouteSearchInput: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: 4,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  iconsContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  verticalDivider: {
    position: 'absolute',
    top: 25, // Starts below the icon
    left: 10, // Align with icon center
    height: 24, // Adjust as needed
    width: 2,
    borderColor: Colors.light[10],
    borderStyle: 'dashed',
    borderRightWidth: 1,
  },
  modal: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 64 : 48,
    width: '100%',
    height: 164,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  modalContent: {
    top: 40,
    height: 124,
    paddingHorizontal: 32,
  },
  nodge: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 3,
    marginTop: 10,
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
  },
  closeModalIconContainer: {
    marginTop: 10,
    position: 'absolute',
    top: 10,
    right: 16,
    // alignSelf: 'flex-end',
  },
  estimateHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors['grey-dark'],
  },
  estimateSubHeading: {
    fontSize: 12,
    color: Colors['grey-dark'],
  },
  estimatedTravelTimeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    columnGap: 16,
    rowGap: 8,
    alignItems: 'center',
  
  },
  estimatedItemContainer: {
    flexDirection: 'row',
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.tetiary,
  },
  primaryEstimatedItemContainer: {
    backgroundColor: Colors.primary[500],
  },
  mainEstimatedText: {
    color: Colors.light[10],
    fontSize: 12,
  },
  mainAddressTextContainer: {
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  mainAddressText: {
    color: Colors.success,
    textAlign: 'center',
    marginTop: 8,
  },
});
