import { Colors } from '@/constants';
import { Dimensions, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');

export const defaultStyles = StyleSheet.create({
  relativeContainer: {
    position: 'relative',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  paddingBottom: {
    paddingBottom: 64,
  },
  backButtonContainer: {
    backgroundColor: 'transparent',
    width: 64,
    height: 64,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  snackbar: {
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: Colors.light['0'],
  },
  marginBottom: {
    marginBottom: 64,
  },
  errorText: {
    color: Colors.error,
  },
  errorDarkText: {
    color: Colors.errorDark,
  },
  flex: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    gap: 16,
    justifyContent: 'space-evenly',
    flexGrow: 1,
    flexShrink: 1,
  },
  contentContainer: {
    paddingVertical: 16,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  bottomButtonContainer: {
    // position: 'absolute',
    alignSelf: 'center',
    bottom: 0,
    backgroundColor: Colors.light['grey'],
    height: 90,
    width: width,
    paddingBottom: 20,
    paddingHorizontal: 32,
    rowGap: 12,
    paddingTop: 12,
  },
  bottomContainerWithContent: {
    paddingTop: 12,
    bottom: 28,
    backgroundColor: Colors.light['grey'],
    width: width,
    paddingHorizontal: 20,
    rowGap: 12,
  },
  button: {
    justifyContent: 'center',
    borderRadius: 4,
    minHeight: 40,
    minWidth: 124,
  },
  flexButton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    borderRadius: 4,
    minHeight: 40,
    minWidth: 124,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.dark[0.1],
    backgroundColor: Colors.secondary[10],
  },
  secondaryButtonText: {
    color: Colors.dark[0],
    fontFamily: 'gentium',
  },
  gentiumText: {
    fontFamily: 'gentium',
  },
  font14: {
    fontSize: 14,
  },
  buttonText: {
    // flexShrink: 1,
    flexWrap: 'wrap',
    fontWeight: '500',
    color: Colors.light['10'],
    fontSize: 14,
    textAlign: 'center',
  },
  appHeader: {
    backgroundColor: 'transparent',
  },
  headerTextContainer: {
    flexGrow: 1,
    marginRight: 72,
  },
  homeAddressheaderTextContainer: {
    flexGrow: 1,
    marginRight: 32,
  },
  headerText: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '500',
    color: Colors.primary['500'],
  },
  subheaderText: {
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.light['10'],
    flexGrow: 1,
    height: 46,
    fontSize: 16,
    borderRadius: 4,
    paddingHorizontal: 16,
    // bottom: 2,
  },
  inputsContainer: {
    marginTop: 16,
    paddingBottom: 96,
    rowGap: 16,
  },
  outlineStyle: {
    borderWidth: 0,
    borderColor: 'transparent',
  },
  linkText: {
    color: Colors.primary[300],
  },
  dialogContainer: {
    backgroundColor: Colors.light['10'],
    borderRadius: 8,
    position: 'relative',
    rowGap: 0,
    paddingVertical: 4,
    width: width * 0.94,
    alignSelf: 'center',
    marginHorizontal: 0,
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
    marginHorizontal: 24,
  },
  dialogSubtitle: {
    textAlign: 'center',
  },
  dialogActionContainer: {
    flexDirection: 'row',
    columnGap: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingBottom: 0,
    overflowX: 'hidden',
  },
  dialogContentContainer: { paddingTop: 0, paddingBottom: 2 },
  checkboxContainer: {
    flexDirection: 'row',
    columnGap: 12,
    alignItems: 'center',
    width: '94%',
  },
  checkboxText: {
    fontSize: 10,
    color: Colors.primary['500'],
    textAlign: 'justify',
    marginRight: 12,
    lineHeight: 18,
  },
  
  resendOTPContainer: { alignItems: 'center', rowGap: 4 },
});
