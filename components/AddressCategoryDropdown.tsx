import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Portal } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';
import { addressCategories, Colors } from '@/constants';
import { defaultStyles } from '@/styles';
import { useFocusEffect } from 'expo-router';

interface AddressType {
  label: string;
  icon: string;
}

interface AddressCategory {
  category: string;
  icon: string;
  color: string;
  types: AddressType[];
}

interface Props {
  value: string | undefined;

  // eslint-disable-next-line no-unused-vars
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  showError?: boolean;
  onClose?: () => void;
}

const DATA: AddressCategory[] = addressCategories;

export const AddressCategoryDropdown: React.FC<Props> = ({
  value,
  onChange,
  placeholder = '',
  label,
  error,
  showError = false,
  onClose,
}) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<AddressCategory>();
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0 });

  const inputRef = useRef<View>(null);

  const handleSelect = (type: AddressType) => {
    onChange(i18n.t(`types.${type.label}`));
    setDropdownVisible(false);
    setCurrentCategory(undefined);
  };

  const selectedLabel = () => {
    if (!value) return '';
    return value;
  };

  const toggleDropdown = () => {
    if (dropdownVisible) {
      setDropdownVisible(false);
      setCurrentCategory(undefined);
    } else {
      inputRef.current?.measureInWindow((x, y, width, height) => {
        setDropdownPos({ x, y: y + height + 8, width });
        setDropdownVisible(true);
      });
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // This runs when the screen focuses
      return () => {
        // This runs when the screen blurs (leaves focus)
        setDropdownVisible(false); // Close the portal
      };
    }, []),
  );

  return (
    <>
      <View style={styles.wrapper}>
        <Image
          source={require('@/assets/images/ic_house.png')}
          style={{ width: 20, height: 20 }}
        />
        <View style={defaultStyles.flex}>
          {label && <Text style={styles.label}>{label}</Text>}
          <TouchableOpacity
            ref={inputRef}
            style={styles.input}
            onPress={toggleDropdown}
            activeOpacity={0.8}>
            <Text style={value ? styles.inputText : styles.placeholder}>
              {value ? selectedLabel() : placeholder}
            </Text>
          </TouchableOpacity>
        </View>
        {dropdownVisible ? (
          <Image
            source={require('@/assets/images/ic_dropdown.png')}
            style={{ width: 13, height: 13, transform: [{ rotate: '180deg' }] }}
          />
        ) : (
          <Image
            source={require('@/assets/images/ic_dropdown.png')}
            style={{ width: 13, height: 13 }}
          />
        )}
        
      </View>

      {dropdownVisible && (
        <Portal>
          <TouchableWithoutFeedback
            onPress={() => {
              setDropdownVisible(false);
              setCurrentCategory(undefined);
              onClose?.();
            }}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View
                  style={[
                    styles.dropdown,
                    {
                      position: 'absolute',
                      top: dropdownPos.y,
                      left: dropdownPos.x,
                      width: dropdownPos.width,
                      marginTop: Platform.OS === 'ios' ? 0 : 24,
                    },
                  ]}>
                  {currentCategory && (
                    <TouchableOpacity
                      style={styles.mainCategoryContainer}
                      onPress={() => setCurrentCategory(undefined)}>
                      <Text style={styles.mainCategoryText}>
                        {currentCategory.category}
                      </Text>
                      <Image
                        source={require('@/assets/images/ic_dropdown.png')}
                        style={{ width: 13, height: 13 }}
                      />
                      {/* <Ionicons
                        name={'chevron-down'}
                        size={16}
                        color={Colors.dark[0]}
                      /> */}
                    </TouchableOpacity>
                  )}
                  <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    scrollEnabled>
                    <TouchableWithoutFeedback>
                      <>
                        {(currentCategory ? currentCategory.types : DATA).map(
                          item =>
                            'label' in item ? (
                              <TouchableOpacity
                                key={item.label}
                                style={styles.item}
                                onPress={() =>
                                  handleSelect(item as AddressType)
                                }>
                                <Text style={styles.itemText}>
                                  {item.icon} {i18n.t(`types.${item.label}`)}
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                key={item.category}
                                style={styles.item}
                                onPress={() =>
                                  setCurrentCategory(item as AddressCategory)
                                }>
                                <Text style={styles.itemText}>
                                  {item.icon}{' '}
                                  {i18n.t(`categories.${item.category}`)}
                                </Text>
                                <Ionicons
                                  name={'chevron-forward'}
                                  size={16}
                                  color={Colors.dark[0]}
                                />
                              </TouchableOpacity>
                            ),
                        )}
                      </>
                    </TouchableWithoutFeedback>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Portal>
      )}

      {showError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    columnGap: 12,
    position: 'relative',
    // zIndex: 10, // Ensure it's layered above default views
    backgroundColor: 'white',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    flexDirection: 'row',
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 6,
    justifyContent: 'space-between',
  },
  label: {
    marginBottom: 4,
    fontSize: 12,
    color: Colors.primary[500],
  },
  mainCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  mainCategoryText: {
    fontSize: 16,
    fontWeight: 600,
  },
  input: {
    flex: 1,
    zIndex: 1,
    height: 24,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: Colors['grey-93'],
    overflow: 'hidden',
    flexShrink: 1,
  },
  inputText: {
    fontSize: 15,
    color: '#333',
  },
  placeholder: {
    color: Colors['grey-93'],
    fontSize: 14,
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: '#fff',
    height: 228,
    width: '100%',
    maxHeight: 250,
    borderRadius: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 99,
  },
  list: {
    paddingHorizontal: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemText: {
    fontSize: 15,
    color: '#333',
  },
  errorText: {
    marginLeft: 4,
    color: Colors.error,
    fontSize: 12,
  },
  errorContainer: {
    marginVertical: 4,
  },
  scrollView: {
    maxHeight: 250, // similar to FlatList max height
  },
  scrollViewContent: {
    zIndex: 99,
    paddingVertical: 4,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 98,
  },
});
