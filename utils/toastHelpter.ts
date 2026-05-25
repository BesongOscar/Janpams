import Toast from 'react-native-toast-message';

export const snackbarToast = (
  message: string,
  type: 'error' | 'info' | 'success',
  color?: string,
) => {
  Toast.show({
    type: type,
    text1: message,
    text1Style: {
      fontSize: 12,
      color: color,
      flexWrap: 'wrap',
      flexShrink: 1,
    },
    props: {
      // ensure the text container can wrap content
      text1NumberOfLines: 0,
    },
    position: 'top',
  });
};
