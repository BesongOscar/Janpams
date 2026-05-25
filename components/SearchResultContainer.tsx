import React, {
  Dispatch,
  FC,
  ReactElement,
  SetStateAction,
  useContext,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  ViewStyle,
  ActivityIndicator,
  Platform,
  FlatList,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { searchResultContainerStyles as styles } from '@/styles';
import { Result } from '@/interfaces';
import i18n from '@/i18n';
import { openShareSheet } from '@/utils';
import { Colors } from '@/constants';
import { Context, ContextType } from '@/app/_layout';
import { getAddressDisplayLines, normalizeResultForDisplay } from '@/utils/addressDisplay';

export interface OfflineResultItem {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  plus_code?: string;
  street_name?: string;
  house_number?: string;
  city?: string;
  region?: string;
}

type Props = {
  searchResults: Array<Result>;
  isSearching?: boolean;
  setMapScrollEnabled: Dispatch<SetStateAction<boolean>>;
  // eslint-disable-next-line no-unused-vars
  onSelect: (item?: Result) => void;
  containerStyle?: ViewStyle;
  moreContent?: ReactElement;
  offlineResults?: OfflineResultItem[];
  onSelectOffline?: (item: OfflineResultItem) => void;
};

export const SearchResultsContainer: FC<Props> = ({
  searchResults,
  isSearching = false,
  setMapScrollEnabled,
  onSelect,
  containerStyle,
  moreContent,
  offlineResults,
  onSelectOffline,
}) => {
  const { user } = useContext(Context) as ContextType;

  // Show loading card when searching
  if (isSearching) {
    return (
      <View style={[styles.queryResultContainer, containerStyle]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary[500]} />
          <Text style={styles.loadingText}>
            {i18n.t('components.searchResultsContainer.searching')}
          </Text>
        </View>
      </View>
    );
  }

  const hasOffline = offlineResults && offlineResults.length > 0;
  const hasOnline = searchResults?.length > 0;

  return hasOffline || hasOnline ? (
    <View style={[styles.queryResultContainer, containerStyle]}>
      {hasOffline && (
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ fontSize: 11, fontFamily: 'gentium-bold', color: Colors.primary[500], marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Offline Results
          </Text>
          {offlineResults!.map((item, idx) => (
            <TouchableOpacity
              key={`offline-${item.id}`}
              style={[styles.searchResultItemContainer, idx === offlineResults!.length - 1 && !hasOnline && styles.boderBottom0]}
              onPress={() => {
                if (onSelectOffline) {
                  onSelectOffline(item);
                } else {
                  onSelect({
                    id: item.id,
                    formattedAddress: [item.house_number, item.street_name, item.city, item.region].filter(Boolean).join(', '),
                    latitude: item.latitude,
                    longitude: item.longitude,
                    global_code: item.plus_code,
                    businessName: item.name,
                  } as Result);
                }
                Keyboard.dismiss();
              }}>
              <View style={styles.searchIconAndNameContainer}>
                <View style={[styles.mapIcon, { backgroundColor: Colors.primary[50] }]}>
                  <Icon source="database-marker-outline" size={16} color={Colors.primary[500]} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.topText, { fontWeight: '600' }]} numberOfLines={1} ellipsizeMode="tail">
                    {item.name || item.street_name || 'Address'}
                  </Text>
                  <Text style={styles.bottomText} numberOfLines={1} ellipsizeMode="tail">
                    {[item.house_number, item.street_name, item.city].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          {hasOnline && (
            <View style={{ height: 1, backgroundColor: Colors.dark['0.1'], marginVertical: 6 }} />
          )}
        </View>
      )}
      {hasOnline && <FlatList
        data={searchResults}
        keyExtractor={(item, index) => index.toString()}
        style={styles.resultsList}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={Platform.OS === 'ios'}
        // nestedScrollEnabled
        // These are the key props to make scrolling work properly
        scrollEventThrottle={16}
        {...(Platform.OS === 'ios' && {
          onTouchStart: () => setMapScrollEnabled(false),
        })}
        removeClippedSubviews={false} // Important for Android
        overScrollMode="never" // Android specific
        onScrollBeginDrag={() => setMapScrollEnabled(false)}
        onScrollEndDrag={() => setMapScrollEnabled(false)}
        onMomentumScrollEnd={() => setMapScrollEnabled(false)}
        renderItem={({ item, index }) => {
          const displayLines = getAddressDisplayLines(normalizeResultForDisplay(item));
          const linesToShow = displayLines.length > 0 ? displayLines : (item?.formattedAddress ? [item.formattedAddress.trim()] : []);

          return (
            <View
              style={[
                styles.searchResultItemContainer,
                index === searchResults.length - 1 && styles.boderBottom0,
              ]}
              key={index}>
              <TouchableOpacity
                style={styles.searchIconAndNameContainer}
                onPress={() => {
                  onSelect(item);
                  Keyboard.dismiss();
                }}>
                <View style={styles.mapIcon}>
                  <Icon source="map-marker" size={16} />
                </View>
                <View style={styles.textContainer}>
                  {linesToShow.map((line, i) => (
                    <Text
                      key={i}
                      style={[i === 0 ? styles.topText : styles.bottomText, i === 0 && linesToShow.length > 1 && { fontWeight: '600' }]}
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {line}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
              <View style={styles.iconsContainer}>
                <TouchableOpacity
                  style={styles.rightIconContainer}
                  onPress={e => {
                    e.stopPropagation();
                    onSelect(item);
                  }}>
                  <Icon
                    source={'directions'}
                    color={Colors.dark[0]}
                    size={20}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rightIconContainer}
                  onPress={() =>
                    openShareSheet(
                      {
                        longitude: item.longitude,
                        latitude: item.latitude,
                        global_code: item?.global_code,
                        formatted_address: item.formattedAddress,
                        house_number: item?.houseNumber,
                        street_name: item?.streetName,
                      },
                      user?.full_names,
                    )
                  }>
                  <Icon source="share-variant-outline" size={18} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />}
    </View>
  ) : (
    <View style={[styles.noResultContainer, containerStyle]}>
      <Text style={styles.noResultText}>
        {i18n.t('components.searchResultsContainer.noResult')}
      </Text>
      {moreContent}
    </View>
  );
};
