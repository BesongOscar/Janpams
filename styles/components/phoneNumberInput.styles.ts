// import { Colors } from '@/constants';
import { Colors } from '@/constants';
import { StyleSheet } from 'react-native';

export const phoneNumberInputStyles = StyleSheet.create({
  mainContainer: {
    flexDirection: 'row',
    columnGap: 8,
  },
  countryCodeContainer: {
    backgroundColor: Colors.light['10'],
    flexDirection: 'row',
    columnGap: 8,
    marginRight: 4,
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    padding: 8,
    borderRadius: 4,
  },
  phoneNumberHelperText: {
    marginLeft: 96,
  },
  countryCodeText: {
    fontSize: 12,
  },
  divider: {
    height: '100%',
    width: 2,
    // backgroundColor: Colors.grey[20],
  },
  errorInput: {
    borderWidth: 1,
    borderColor: 'red',
  },
  focusedMode: {
    borderWidth: 3,
    // borderColor: Colors.grey['79'],
  },
  input: {
    backgroundColor: Colors.light['10'],
    flexGrow: 1,
    height: 46,
    fontSize: 16,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  searchInput: {
    backgroundColor: 'transparent',
    flexGrow: 1,
    height: 48,
    fontSize: 18,
    color: Colors.dark[0],
  },
  backgroundDark: {
    backgroundColor: Colors.light['0'],
    flex: 1,
  },
  modalContainer: {
    padding: 24,
    rowGap: 16,
  },
  searchcontainer: {
    flexDirection: 'row',
    columnGap: 8,
    marginRight: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  countryItem: {
    paddingVertical: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light['grey'],
  },
  texts: {
    flexDirection: 'row',
    columnGap: 8,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  countryName: {
    fontSize: 18,
    // color: Colors.neutral[10],
  },
  countryContainer: {
    backgroundColor: Colors.light['10'],
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    height: 64,
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  flexContainer: {
    flexDirection: 'row',
    columnGap: 16,
  },
});
