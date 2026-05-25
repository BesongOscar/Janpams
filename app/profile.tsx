import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import {
  createAddressStyles,
  defaultStyles,
  drawerStyles,
  myAddressesStyles as styles,
  tabIndexStyles,
} from '@/styles';
import { Appbar, Button, Dialog, Icon, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants';
import {
  useGetHomeAddress,
  useGetMyJangoAddresses,
  useSaveUserHomeAddress,
  useSearchJangoAddresses,
} from '@/hooks/addresses.hooks';
import { Context, ContextType } from './_layout';
import { delay, openMapDirectly, openShareSheet } from '@/utils';
import { AddressComponent, Loader, SearchResultsContainer } from '@/components';
import { addressesMyJangoAddress, Result } from '@/interfaces';
import i18n from '../i18n';
import { isSmallDevice } from '@/constants/sizes';

export const splitAddress = (address: string | undefined) => {
  if (!address) return { firstPart: '', lastPart: '' };

  const parts = address.split(',').map(part => part.trim());

  if (parts.length < 3) {
    return { firstPart: '', lastPart: '' }; // If address has less than 3 parts, return both empty
  }

  const firstPart = parts.slice(0, -3).join(', ');
  const lastPart = parts.slice(-3).join(', ');

  return { firstPart, lastPart };
};

export default function Profile() {
  const router = useRouter();

  const { user, lang } = useContext(Context) as ContextType;
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [showAddAsHomeAddressModal, setShowAddAsHomeAddressModal] =
    useState(false);
  const [selectedAddress, setSelectedAddress] =
    useState<addressesMyJangoAddress>();

  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [displayValue, setDisplayValue] = useState<string>('');

  const [searchResults, setSearchResults] = useState<Array<Result>>();
  const [showMenu, setShowMenu] = useState(false);
  const [showSearchAndReplace, setShowSearchAndReplace] = useState(false);
  const [isSearhing, setIsSearching] = useState<boolean>(false);

  const {
    data,
    isLoading,
    error: requestError,
    isError,
  } = useGetMyJangoAddresses(
    lang,
    {
      items_per_page: 10,
      current_page: 1,
    },
    !!user?.id,
  );

  useEffect(() => {
    const getError = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (requestError as any)?.response?.data?.message === 'string') {
        setError(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `${i18n.t('profile.errorGettingAddresses')}: ${(requestError as any)?.response?.data?.message}`,
        );
        await delay(5000);
        setError(undefined);
      } else if (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Array.isArray((requestError as any)?.response?.data?.message) &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (requestError as any)?.response?.data?.message[0] === 'string'
      ) {
        setError(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `${i18n.t('profile.errorGettingAddresses')}: ${(requestError as any)?.response?.data?.message[0]}`,
        );
        await delay(5000);
        setError(undefined);
      } else {
        setError(
          `${i18n.t('profile.unknownError')} ${i18n.t('profile.whileGettingAddresses')}`,
        );
        await delay(5000);
        setError(undefined);
      }
    };
    if (isError) {
      getError();
    }
  }, [requestError, isError]);

  const {
    data: homeAddress,
    isLoading: isHomeAddressLoading,
    refetch: refetchHomeAddress,
  } = useGetHomeAddress(lang, !!user?.id);

  const { mutateAsync: saveUserHomeAddress } = useSaveUserHomeAddress(
    lang,
    () => {
      setShowAddAsHomeAddressModal(false);
      setSearchResults(undefined);
      setQuery('');
      setDebounceQuery('');
      refetchHomeAddress();
      setShowSearchAndReplace(false);
    },
    async error => {
      setLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        setError(`${error?.response?.data?.message}`);
        await delay(5000);
        setError(undefined);
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        setError(`${error?.response?.data?.message[0]}`);
        await delay(5000);
        setError(undefined);
      } else {
        setError(
          `${i18n.t('profile.unknownError')} ${i18n.t('profile.whileSavingHomeAddress')}`,
        );
        await delay(5000);
        setError(undefined);
      }
    },
  );

  const handleSaveHomeAddress = async () => {
    try {
      setLoading(true);
      await saveUserHomeAddress({
        address_id: selectedAddress?.id,
      });
    } catch {
      // TODO: Error handling if neccessary
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query === '') {
        setSearchResults(undefined);
        setDebounceQuery('');
      } else {
        setDebounceQuery(query);
      }
    }, 300); // Wait for 1 second

    return () => clearTimeout(handler); // Cleanup timeout on every change
  }, [query]);

  const { data: jangoAddressesResult, mutateAsync: searchJangoAddresses } =
    useSearchJangoAddresses(
      lang,
      () => {},
      async error => {
        // setIsLoading(false);
        if (typeof error?.response?.data?.message === 'string') {
          setError(
            `${i18n.t('(tabs).index.errorFetchingAddresses')}: ${error?.response?.data?.message}`,
          );
          await delay(5000);
          setError(undefined);
        } else if (
          Array.isArray(error?.response?.data?.message) &&
          typeof error?.response?.data?.message[0] === 'string'
        ) {
          setError(
            `${i18n.t('(tabs).index.errorFetchingAddresses')}: ${error?.response?.data?.message[0]}`,
          );
          await delay(5000);
          setError(undefined);
        } else {
          setError(
            `${i18n.t('(tabs).index.unknownError')} ${i18n.t('(tabs).index.whileFetchingAddresses')}`,
          );
          await delay(5000);
          setError(undefined);
        }
      },
    );

  useEffect(() => {
    if (!debounceQuery || !user?.id) {
      setSearchResults(undefined);
      setIsSearching(false);
      return;
    }

    const searchAddress = async () => {
      try {
        setIsSearching(true);
        setSearchResults(undefined);

        await searchJangoAddresses({
          address: debounceQuery,
        });
      } catch {
        setError('Failed to search addresses. Please try again.');
        setTimeout(() => setError(undefined), 5000);
      } finally {
        setIsSearching(false);
      }
    };

    searchAddress();
  }, [debounceQuery, user, searchJangoAddresses]);

  useEffect(() => {
    if (jangoAddressesResult) {
      const jangoResults =
        jangoAddressesResult?.data && jangoAddressesResult?.data?.length > 0
          ? jangoAddressesResult.data.map(item => {
              return {
                id: item.id,
                formattedAddress: item?.formatted_address,
                latitude: item.latitude,
                longitude: item.longitude,
                global_code: item?.global_code,
                businessName:
                  item?.address_components?.business_name ||
                  item?.address_components?.amenity ||
                  '', // Add business name if available
              };
            })
          : [];

      // Combine results from both APIs
      const combinedResults = [...jangoResults];

      const uniqueResults = Array.from(
        new Set(combinedResults.map(item => JSON.stringify(item))),
      ).map(item => JSON.parse(item));

      setSearchResults(uniqueResults);
    }
  }, [jangoAddressesResult]);

  const slideAnim = useRef(new Animated.Value(-100)).current; // Start above the view

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showMenu ? 1 : 0, // Animate from 0 (hidden) to 1 (fully visible)
      duration: 500,
      useNativeDriver: false, // height animation requires disabling native driver
    }).start();
  }, [showMenu]);

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={24}>
          <View style={defaultStyles.flex}>
            <Appbar.Header
              dark={false}
              style={[defaultStyles.appHeader, styles.headerContainer]}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={defaultStyles.backButtonContainer}>
                <Icon
                  source={'arrow-left'}
                  size={24}
                  color={Colors.light[10]}
                />
              </TouchableOpacity>
              <View style={defaultStyles.headerTextContainer}>
                <Text style={[defaultStyles.headerText, styles.headerText]}>
                  {i18n.t('profile.profile')}
                </Text>
              </View>
            </Appbar.Header>
            <View style={[styles.contentContainer, styles.profileContainer]}>
              <View style={styles.profileLeftContainer}>
                <View style={styles.profileImageContainer}>
                  {user?.image ? (
                    <Image
                      source={{ uri: user?.image }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <Image
                      source={require('@/assets/images/avatar.png')}
                      resizeMode="contain"
                      style={styles.avatar}
                    />
                  )}
                </View>
                <View style={styles.profileDetailsContainer}>
                  <View style={styles.profileDetailsTopContainer}>
                    <Text style={styles.profileText}>{user?.full_names}</Text>
                    <Text style={styles.profileText}>
                      {user?.email_address}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/update-profile')}
                    // onPress={() => router.push('/email-verification')}
                    style={styles.editButton}>
                    <Icon
                      source="pencil-outline"
                      size={16}
                      color={Colors.primary[300]}
                    />
                    <Text style={styles.editButtonText}>
                      {i18n.t('profile.edit')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push('/notifications')}>
                <Icon source={'bell-badge'} size={24} />
              </TouchableOpacity>
            </View>
            <View style={[styles.contentContainer, styles.zIndex99]}>
              <View style={styles.homeAddressContainer}>
                <View style={styles.homeAddressHeadingContainer}>
                  <Text style={styles.mainHeadingText}>
                    {i18n.t('profile.homeAddress')}
                  </Text>
                  {!!homeAddress && !!homeAddress?.formatted_address && (
                    <View style={styles.menuContainer}>
                      <TouchableOpacity
                        onPress={() => setShowMenu(prev => !prev)}>
                        <Icon
                          source={'dots-horizontal'}
                          size={24}
                          color={Colors.dark[0]}
                        />
                      </TouchableOpacity>
                      {/* Animated Dropdown */}
                      {showMenu && (
                        <Animated.View
                          style={[
                            styles.menuModal,
                            {
                              height: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 120], // Adjust the final height of dropdown
                              }),
                              opacity: slideAnim,
                            },
                          ]}>
                          <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                              openMapDirectly(
                                {
                                  longitude: homeAddress?.longitude,
                                  latitude: homeAddress?.latitude,
                                  global_code: homeAddress?.global_code,
                                  formatted_address:
                                    homeAddress?.formatted_address,
                                },
                                homeAddress?.formatted_address?.split(',')[0],
                                () => {},
                                () => {
                                  setShowMenu(false);
                                },
                                () => {},
                                user?.full_names,
                              );
                            }}>
                            <Text>{i18n.t('profile.navigate')}</Text>
                            <Icon source={'directions'} size={20} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                              openShareSheet(
                                {
                                  longitude: homeAddress?.longitude,
                                  latitude: homeAddress?.latitude,
                                  global_code: homeAddress?.global_code,
                                  formatted_address:
                                    homeAddress?.formatted_address,
                                  house_number:
                                    homeAddress?.address_components
                                      ?.house_number ?? undefined,
                                  street_name:
                                    homeAddress?.address_components?.road ??
                                    undefined,
                                },
                                user?.full_names,
                                '',
                                () => {
                                  setShowMenu(false);
                                },
                              );
                            }}>
                            <Text>{i18n.t('profile.share')}</Text>
                            <Icon source="share-variant-outline" size={18} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                              setShowMenu(false);
                              setDisplayValue(
                                splitAddress(homeAddress?.formatted_address)
                                  .firstPart,
                              );
                              setShowSearchAndReplace(true);
                            }}>
                            <Text>{i18n.t('profile.replace')}</Text>
                            <Icon source="find-replace" size={18} />
                          </TouchableOpacity>
                        </Animated.View>
                      )}
                    </View>
                  )}
                </View>
                <View style={styles.zIndexNegative}>
                  {showSearchAndReplace ? (
                    <View
                      style={[
                        styles.noAddressFoundContainer,
                        defaultStyles.relativeContainer,
                      ]}>
                      <View
                        style={[
                          tabIndexStyles.searchContainer,
                          styles.searchAndReplaceContainer,
                        ]}>
                        <View style={styles.searchInputContainer}>
                          <View style={tabIndexStyles.searchInput}>
                            <TouchableOpacity
                              style={tabIndexStyles.searchIconContainer}>
                              <Icon
                                source={'magnify'}
                                size={18}
                                color={Colors.grey}
                              />
                            </TouchableOpacity>
                            <TextInput
                              style={tabIndexStyles.search}
                              value={!query ? displayValue : query}
                              onChangeText={e => {
                                if (displayValue) setDisplayValue('');
                                setQuery(e);
                                // setActiveSearchInput('search');
                              }}
                              placeholder={i18n.t('profile.searchAndReplace')}
                              placeholderTextColor={Colors.grey}
                              // onFocus={handleOutsidePress}
                              numberOfLines={1}
                            />
                            {!!query && (
                              <TouchableOpacity
                                style={tabIndexStyles.searchIconContainer}
                                onPress={() => setQuery('')}>
                                <Icon
                                  source={'close'}
                                  size={18}
                                  color={Colors.grey}
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => setShowSearchAndReplace(false)}>
                          <Icon source={'close'} size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : homeAddress?.formatted_address ? (
                    <>
                      <Text style={styles.homeAddressText}>
                        {splitAddress(homeAddress?.formatted_address).firstPart}
                      </Text>
                      <Text style={styles.smallText}>
                        {splitAddress(homeAddress?.formatted_address).lastPart}
                      </Text>
                    </>
                  ) : (
                    <View
                      style={[
                        styles.noAddressFoundContainer,
                        defaultStyles.relativeContainer,
                      ]}>
                      <View style={tabIndexStyles.searchContainer}>
                        <View style={tabIndexStyles.searchInputContainer}>
                          <View style={tabIndexStyles.searchInput}>
                            <TouchableOpacity
                              style={tabIndexStyles.searchIconContainer}>
                              <Icon
                                source={'magnify'}
                                size={18}
                                color={Colors.grey}
                              />
                            </TouchableOpacity>
                            <TextInput
                              style={tabIndexStyles.search}
                              value={!query ? displayValue : query}
                              onChangeText={e => {
                                if (displayValue) setDisplayValue('');
                                setQuery(e);
                                // setActiveSearchInput('search');
                              }}
                              placeholder={i18n.t('profile.searchToAdd')}
                              placeholderTextColor={Colors.grey}
                              // onFocus={handleOutsidePress}
                              numberOfLines={1}
                            />
                            {isSearhing && (
                              <ActivityIndicator
                                color={Colors.primary['500']}
                              />
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.headingContentContainer}>
              <Text style={styles.mainHeadingText}>
                {i18n.t('profile.savedAddresses')}
              </Text>
              <TouchableOpacity onPress={() => router.push('/my-addresses')}>
                <Text style={defaultStyles.linkText}>
                  {i18n.t('profile.viewAll')}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={defaultStyles.scrollContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              onScrollBeginDrag={() => {
                Keyboard.dismiss();
                setSearchResults(undefined);
                setQuery('');
                setDebounceQuery('');
              }}>
              <View
                style={[styles.contentContainer, defaultStyles.paddingBottom]}>
                {!isLoading ? (
                  data?.data?.length ? (
                    data?.data?.slice(0, 4)?.map((item, index) => (
                      <AddressComponent
                        key={index}
                        address={item}
                        onSave={() => {
                          setSelectedAddress(item);
                          setShowAddAsHomeAddressModal(true);
                        }}
                        username={user?.full_names}
                      />
                    ))
                  ) : (
                    <View style={styles.noAddressFoundContainer}>
                      <Text style={styles.noAddressFoundText}>
                        {i18n.t('profile.noAddressesFound')}
                      </Text>
                    </View>
                  )
                ) : undefined}
              </View>
            </ScrollView>
            {searchResults && (
              <View
                style={[
                  customStyles.searchResultsContainer,
                  { top: isSmallDevice ? 350 : 380 },
                ]}>
                <SearchResultsContainer
                  searchResults={searchResults}
                  setMapScrollEnabled={() => {}}
                  onSelect={item => {
                    setDisplayValue(
                      item?.businessName
                        ? item?.businessName
                        : ((item?.formattedAddress?.includes('\n')
                            ? item.formattedAddress.split('\n')[0]
                            : item?.formattedAddress?.split(',')[0]) ?? ''),
                    );
                    setSelectedAddress({
                      formatted_address: item?.businessName
                        ? item?.businessName
                        : ((item?.formattedAddress?.includes('\n')
                            ? item.formattedAddress.split('\n')[0]
                            : item?.formattedAddress?.split(',')[0]) ?? ''),
                      id: item?.id,
                      longitude: item?.longitude,
                      latitude: item?.latitude,
                    } as addressesMyJangoAddress);
                    setShowAddAsHomeAddressModal(true);
                    setDebounceQuery('');
                    setQuery('');
                    setSearchResults(undefined);
                  }}
                  // moreContent={
                  //   <TouchableOpacity
                  //     style={styles.addHomeAddressContainer}
                  //     // onPress={() => router.push('/add-home-address')}
                  //     onPress={() => setShowAddAsHomeAddressModal(false)}>
                  //     <Icon
                  //       source={'plus'}
                  //       size={12}
                  //       color={Colors.primary[500]}
                  //     />
                  //     <Text style={styles.addHomeAddressText}>
                  //       {i18n.t('profile.addAHomeAddress')}
                  //     </Text>
                  //   </TouchableOpacity>
                  // }
                />
              </View>
            )}
          </View>
      </KeyboardAvoidingView>
      <Dialog
        visible={showAddAsHomeAddressModal}
        onDismiss={() => {}}
        style={defaultStyles.dialogContainer}>
        <Dialog.Content style={defaultStyles.dialogSubtitleContainer}>
          <View />
          <Text style={drawerStyles.logoutHeadingText}>
            {i18n.t('profile.saveAsHomeAddress')}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowAddAsHomeAddressModal(false);
            }}>
            <Icon source="close" color={Colors.error} size={24} />
          </TouchableOpacity>
        </Dialog.Content>
        <Dialog.Content>
          <Text style={drawerStyles.logoutSubHeading}>
            {i18n.t('profile.doYouWantTo')}
          </Text>
          <Text style={createAddressStyles.dialogTitle}>
            {selectedAddress?.formatted_address}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={defaultStyles.dialogActionContainer}>
          <Button
            mode="contained"
            textColor={Colors.light['10']}
            buttonColor={Colors.primary[500]}
            style={[defaultStyles.flexButton, defaultStyles.secondaryButton]}
            onPress={() => setShowAddAsHomeAddressModal(false)}
            labelStyle={[
              defaultStyles.buttonText,
              defaultStyles.secondaryButtonText,
              defaultStyles.font14,
            ]}>
            {i18n.t('profile.no')}
          </Button>
          <Button
            mode="contained"
            textColor={Colors.light['10']}
            buttonColor={Colors.primary[500]}
            style={[defaultStyles.button]}
            onPress={handleSaveHomeAddress}
            labelStyle={[
              defaultStyles.buttonText,
              defaultStyles.gentiumText,
              defaultStyles.font14,
            ]}>
            {i18n.t('profile.yes')}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <Snackbar
        visible={!!error}
        onDismiss={() => {}}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{error}</Text>
      </Snackbar>
      <Loader
        visible={isLoading || isHomeAddressLoading || loading}
        text={`${i18n.t('profile.pleaseWait')}...`}
      />
    </>
  );
}

const customStyles = StyleSheet.create({
  searchResultsContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    borderRadius: 8,
    height: 240,
    // width: '80%',
    zIndex: 9999,
  },
});
