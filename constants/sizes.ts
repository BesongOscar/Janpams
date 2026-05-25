import { Dimensions } from 'react-native';

export const sizes = {
  screenHeight: Dimensions.get('screen').height,
  screenWidth: Dimensions.get('screen').width,
  windowHeight: Dimensions.get('window').height,
  windowWidth: Dimensions.get('window').width,
};
export const isSmallDevice = sizes.screenHeight < 830;
export const isLargeDevice = sizes.screenHeight >= 877;
