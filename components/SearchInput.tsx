import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import { tabIndexStyles as styles } from '@/styles';

interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  onFocus: () => void;
  onClear: () => void;
  showClearButton?: boolean;
  style?: any;
}

const SearchInput: React.FC<SearchInputProps> = ({
  query,
  onQueryChange,
  placeholder,
  onFocus,
  onClear,
  showClearButton = false,
  style,
}) => {
  return (
    <View style={[styles.searchInputContainer, style]}>
      <Icon source={'magnify'} size={20} color={Colors['grey-dark']} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        value={query}
        onChangeText={onQueryChange}
        onFocus={onFocus}
        placeholderTextColor={Colors['grey-dark']}
      />
      {showClearButton && query.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <Icon source={'close'} size={16} color={Colors['grey-dark']} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchInput;
