import { Colors } from '@/constants';
import { StyleSheet, Platform } from 'react-native';

export const searchResultContainerStyles = StyleSheet.create({
  queryResultContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
    width: '100%',
    flex: 1, // Fill parent height
    // Android specific fixes
    ...(Platform.OS === 'android' && {
      elevation: 5, // Higher elevation for better touch handling
    }),
  },
  resultsList: {
    width: '100%',
    flex: 1,
    backgroundColor: 'white',
  },
  noResultContainer: {
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 130,
    padding: 10,
    width: '100%',
    borderRadius: 8,
    zIndex: 999,
    shadowColor: '#000', // iOS Shadow Color
    shadowOffset: { width: 0, height: 4 }, // iOS Shadow Offset
    shadowOpacity: 0.25, // iOS Shadow Opacity
    shadowRadius: 4, // iOS Shadow Blur Radius
    elevation: 5, // Android Shadow
  },
  noResultText: {
    textAlign: 'center',
    fontSize: 18,
  },
  searchResultItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.grey,
    paddingRight: 16,
    paddingLeft: 12,
    backgroundColor: 'white',
    minHeight: 80, // Fixed height for each item
    overflow: 'hidden', // Prevent overflow from the parent
  },
  boderBottom0: {
    borderBottomWidth: 0,
  },
  searchIconAndNameContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
    alignItems: 'flex-start', // Align to the start
    columnGap: 12,
    flexShrink: 1, // Prevent overflow
    flex: 1,
  },
  mapIcon: {
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flexShrink: 1, // Allow text to shrink to avoid overflow
    flex: 1,
    marginRight: 16,
  },
  topText: {
    fontSize: 11,
    flexShrink: 1, // Prevent overflow
    color: Colors.dark[0],
    marginBottom: 4,
  },
  bottomText: {
    fontSize: 10,
    color: Colors.dark[0],
    flexShrink: 1, // Prevent overflow
    lineHeight: 16,
  },
  rightIconContainer: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    rowGap: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: Colors.light[0],
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: Colors.dark['0.75'],
    fontWeight: '500',
  },
});
