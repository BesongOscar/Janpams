/**
 * Directions - Rides tab: single search field only.
 * User searches → taps an address → in-app navigation starts (handled by parent).
 * This panel never shows the planning form (start/destination/Let's go).
 */

import React from 'react';
import { View, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { Colors } from '@/constants';
import { tabIndexStyles as styles } from '@/styles';
import i18n from '@/i18n';

export interface DirectionsRidesPanelProps {
  value: string;
  onFocus: () => void;
  onChangeText: (text: string) => void;
  isSearching?: boolean;
  placeholder?: string;
  onClose?: () => void;
}

export function DirectionsRidesPanel({
  value,
  onFocus,
  onChangeText,
  isSearching = false,
  placeholder,
  onClose,
}: DirectionsRidesPanelProps) {
  return (
    <View style={[styles.relativeContainer, styles.z99]}>
      {onClose && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 6 }}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close directions panel">
            <Icon source="close" size={22} color={Colors.grey} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <View style={styles.searchInput}>
            <View style={styles.searchIconContainer}>
              <Icon source="magnify" size={18} color={Colors.grey} />
            </View>
            <TextInput
              style={styles.search}
              value={value}
              onFocus={onFocus}
              onChangeText={onChangeText}
              placeholder={
                placeholder ??
                i18n.t('(tabs).index.searchJanGoAddress')
              }
              placeholderTextColor={Colors.grey}
              numberOfLines={1}
            />
            {isSearching && (
              <ActivityIndicator color={Colors.primary['500']} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
