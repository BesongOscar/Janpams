import { Colors } from '@/constants';
import { StyleSheet } from 'react-native';

export const loaderStyles = StyleSheet.create({
  modal: { alignItems: 'center', justifyContent: 'center' },
  container: {
    width: 164,
    height: 164,
    backgroundColor: Colors.primary['500'],
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: { transform: [{ scale: 3 }] },
  text: { color: Colors.light['10'], marginTop: 32, textAlign: 'center' },
});
