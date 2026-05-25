import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Keyboard,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';

import addressFormatter from '@fragaria/address-formatter';

import {
  createAddressStyles,
  defaultStyles,
  drawerStyles,
  loginStyles,
  myAddressesStyles as styles,
  tabIndexStyles,
} from '@/styles';
import { Appbar, Button, Dialog, Icon, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants';
import {
  useDeleteAliasAddress,
  useGetHomeAddress,
  useGetMyAliasAddresses,
  useGetMyAliasAddressesInfinite,
  useGetMyJangoAddresses,
  useGetMyJangoAddressesInfinite,
  useSaveUserHomeAddress,
  useSearchGlobalAddresses,
  useSearchJangoAddresses,
} from '@/hooks/addresses.hooks';
import { Context, ContextType } from './_layout';
import { delay } from '@/utils';
import { logCoordinateInfo } from '@/utils/coordinateUtils';
import {
  AddAlias,
  AddressComponent,
  Loader,
  SearchResultsContainer,
} from '@/components';
import {
  addressesJangoAddress,
  addressesMyJangoAddress,
  addressesSearchGlobalAddressesResponse,
  addressesSearchJangoAddressesResponse,
  Result,
} from '@/interfaces';
import i18n from '@/i18n';
import { isSmallDevice } from '@/constants/sizes';
import { snackbarToast } from '@/utils/toastHelpter';
import { SourceBadge, QualityIndicator, type AddressSource } from '@/components/AddressBadges';

export default function MyAddresses() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showAddAsHomeAddressModal, setShowAddAsHomeAddressModal] =
    useState(false);
  const [selectedAddress, setSelectedAddress] =
    useState<addressesMyJangoAddress>();
  const { user, lang } = useContext(Context) as ContextType;
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-addresses' | 'all-addresses'>(
    'my-addresses',
  );
  const [query, setQuery] = useState<string>('');
  const [filteredData, setFilteredData] = useState<
    Array<addressesJangoAddress> | Array<addressesMyJangoAddress>
  >();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Result[]>();
  const [selectedResult, setSelectedResult] = useState<Result>();
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [searchingAlias, setSearchingAlias] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSearhing, setIsSearching] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [editingHomeAddress, setEditingHomeAddress] = useState<addressesMyJangoAddress | undefined>();
  const [showEditAlias, setShowEditAlias] = useState(false);
  const [editingAddressTab, setEditingAddressTab] = useState<'my-addresses' | 'all-addresses' | undefined>();
  const [syncStatusFilter, setSyncStatusFilter] = useState<'all' | 'synced' | 'pending' | 'conflict'>('all');

  const [jangoAddressesResult, setJangoAddressesResult] = useState<
    addressesSearchJangoAddressesResponse | undefined
  >(undefined);
  const [globalAddressesResult, setGlobalAddresesResult] = useState<
    addressesSearchGlobalAddressesResponse | undefined
  >(undefined);

  // Offline-first: addresses from local DB via hook (no API; avoids 401 with Supabase auth)
  const {
    data: jangoAddressesInfinite,
    isLoading: isLoadingAPI,
    error: getMyJangoAddressesError,
    isError: getMyJangoAddressesIsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMyJangoAddresses,
  } = useGetMyJangoAddressesInfinite(
    lang,
    10,
    !!user?.id,
  );

  // Flatten pages into single array and apply sync status filter
  const data = useMemo(() => {
    let addresses: any[] = [];
    if (jangoAddressesInfinite?.pages) {
      addresses = jangoAddressesInfinite.pages.flatMap(page => page.data || []);
    }
    if (syncStatusFilter !== 'all') {
      addresses = addresses.filter(addr => {
        const status = addr.sync_status || 'synced';
        return status === syncStatusFilter;
      });
    }
    return addresses.length > 0 ? { data: addresses } : undefined;
  }, [jangoAddressesInfinite, syncStatusFilter]);

  const isLoading = isLoadingAPI;

  // Use infinite query for pagination on "My Address Book" tab
  const {
    data: aliasAddressesInfinite,
    isLoading: isMyAliasAddressesLoading,
    error: getMyAliasAddressesError,
    isError: getMyAliasAddressesIsError,
    fetchNextPage: fetchNextAliasPage,
    hasNextPage: hasNextAliasPage,
    isFetchingNextPage: isFetchingNextAliasPage,
    refetch: refetchMyAliasAddresses,
  } = useGetMyAliasAddressesInfinite(
    lang,
    10, // 10 items per page
    !!user?.id, // Always enable when user exists to prevent data disappearing
  );

  // Flatten all pages into a single array for display
  const myAliasAddresses = useMemo(() => {
    if (!aliasAddressesInfinite?.pages) return undefined;
    return {
      data: aliasAddressesInfinite.pages.flatMap(page => page.data || []),
      current_page: aliasAddressesInfinite.pages[aliasAddressesInfinite.pages.length - 1]?.current_page || 1,
      message: aliasAddressesInfinite.pages[aliasAddressesInfinite.pages.length - 1]?.message as string | undefined,
    };
  }, [aliasAddressesInfinite]);

  const {
    data: homeAddress,
    isLoading: isHomeAddressLoading,
    refetch: refetchHomeAddress,
  } = useGetHomeAddress(lang, !!user?.id);

  // Refetch both datasets whenever the screen gains focus, regardless of active tab
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      refetchMyJangoAddresses();
      refetchMyAliasAddresses();
      refetchHomeAddress();
    }, [user?.id, refetchMyJangoAddresses, refetchMyAliasAddresses, refetchHomeAddress]),
  );

  useEffect(() => {
    const getError = async () => {
      if (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof ((getMyJangoAddressesError ?? getMyAliasAddressesError) as any)
          ?.response?.data?.message === 'string'
      ) {
        snackbarToast(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `${i18n.t('my-addresses.errorGettingAddresses')}: ${((getMyJangoAddressesError ?? getMyAliasAddressesError) as any)?.response?.data?.message}`,
          'error',
          Colors.error,
        );
        
      } else if (
        Array.isArray(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((getMyJangoAddressesError ?? getMyAliasAddressesError) as any)
            ?.response?.data?.message,
        ) &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof ((getMyJangoAddressesError ?? getMyAliasAddressesError) as any)
          ?.response?.data?.message[0] === 'string'
      ) {
        snackbarToast(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `${i18n.t('my-addresses.errorGettingAddresses')}: ${((getMyJangoAddressesError ?? getMyAliasAddressesError) as any)?.response?.data?.message[0]}`,
          'error',
          Colors.error,
        );
      } else {
        snackbarToast(
          `${i18n.t('my-addresses.unknownError')} ${i18n.t('my-addresses.whileGettingAddresses')}`,
          'error',
          Colors.error,
        );
      }
    };
    if (getMyJangoAddressesIsError || getMyAliasAddressesIsError) {
      getError();
    }
  }, [
    getMyJangoAddressesError,
    getMyJangoAddressesIsError,
    getMyAliasAddressesError,
    getMyAliasAddressesIsError,
  ]);

  const { mutateAsync: saveUserHomeAddress } = useSaveUserHomeAddress(
    lang,
    () => {
      setShowAddAsHomeAddressModal(false);
    },
    async error => {
      setLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        snackbarToast(`${error?.response?.data?.message}`, 'error', Colors.error);
        await delay(5000);
        snackbarToast(`${error?.response?.data?.message[0]}`, 'error', Colors.error);
      } else {
        snackbarToast(
          `${i18n.t('my-addresses.unknownError')} ${i18n.t('my-addresses.whileSavingHomeAddress')}`,
          'error',
          Colors.error,
        );
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
      // TODO: Handle errors if necessary
    } finally {
      setLoading(false);
    }
  };

  const { mutateAsync: deleteAliasAddress } = useDeleteAliasAddress(
    lang,
    () => {
      // Reset and invalidate the infinite query cache so deleted address is removed
      queryClient.resetQueries({
        queryKey: ['/addresses/my-alias-addresses-infinite'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/addresses/my-alias-addresses-infinite'],
      });
      refetchMyAliasAddresses();
      setShowDeleteModal(false);
    },
    async error => {
      setLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        snackbarToast(`${error?.response?.data?.message}`, 'error', Colors.error);
        snackbarToast(`${error?.response?.data?.message[0]}`, 'error', Colors.error);
      } else {
        snackbarToast(`${i18n.t('my-addresses.unknownError')}`, 'error', Colors.error);
      }
    },
  );

  const handleDeleteAliasAddress = async () => {
    try {
      setLoading(true);
      await deleteAliasAddress({
        aliases: [
          {
            alias_id: selectedAddress?.id,
          },
        ],
      });
    } catch {
      // TODO: Handle errors if necessary
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh functionality (refresh both lists to keep data consistent)
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refetch both queries, ensuring they complete even if queries are disabled
      const [jangoResult, aliasResult] = await Promise.allSettled([
        refetchMyJangoAddresses(),
        refetchMyAliasAddresses(),
      ]);
      
      // Log any errors for debugging but don't throw
      if (jangoResult.status === 'rejected') {
        console.warn('Failed to refetch My Jango Addresses:', jangoResult.reason);
      }
      if (aliasResult.status === 'rejected') {
        console.warn('Failed to refetch My Alias Addresses:', aliasResult.reason);
      }
    } catch (error) {
      console.warn('Error during refresh:', error);
      // Still set refreshing to false even if there's an error
    } finally {
      // Always set refreshing to false after a short delay to ensure UI updates
      setTimeout(() => {
        setRefreshing(false);
      }, 100);
    }
  };

  // Transform user addresses to ensure latitude/longitude are available
  const transformUserAddresses = (addresses: addressesMyJangoAddress[]) => {
    return addresses.map(address => {
      // If latitude/longitude are missing, try to extract from global_code or other fields
      let latitude = address.latitude;
      let longitude = address.longitude;

      // If coordinates are missing, log warning and try to get them
      if (!latitude || !longitude) {
        logCoordinateInfo(address, 'MyAddresses - TransformUserAddresses');

        // TODO: Add Plus Code decoding logic here if global_code is available
        // For now, we'll keep the original values (which might be undefined)
        // In a real implementation, you could:
        // 1. Decode Plus Code to get coordinates
        // 2. Make an API call to geocode the address
        // 3. Use a geocoding service to get coordinates from the formatted address
      }

      return {
        ...address,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      };
    });
  };

  useEffect(() => {
    if (activeTab === 'all-addresses') {
      // Check if data exists and is an array before processing
      if (!myAliasAddresses?.data || !Array.isArray(myAliasAddresses.data) || myAliasAddresses.data.length === 0) {
        setFilteredData([]);
      } else {
        if (!query) {
          setFilteredData(myAliasAddresses.data);
        } else {
          setFilteredData(
            myAliasAddresses.data.filter(address =>
              address.formatted_address
                ?.toLowerCase()
                .includes(query.toLowerCase()),
            ),
          );
        }
      }
    } else {
      // Check if data exists and is an array before processing
      if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
        setFilteredData([]);
      } else {
        if (!query) {
          // Transform the data to ensure coordinates are available
          const transformedData = transformUserAddresses(data.data);
          setFilteredData(transformedData);
        } else {
          const transformedData = transformUserAddresses(data.data);
          setFilteredData(
            transformedData.filter(address =>
              address.formatted_address
                ?.toLowerCase()
                .includes(query.toLowerCase()),
            ),
          );
        }
      }
    }
  }, [query, activeTab, data, myAliasAddresses]);

  // When on Address Book and "Add address": show My Addresses list or Jango search results (so we have address id)
  const listData = useMemo(() => {
    if (activeTab === 'all-addresses' && searchingAlias) {
      return searchQuery ? (searchResults || []) : (data?.data || []);
    }
    return filteredData || [];
  }, [activeTab, searchingAlias, searchQuery, searchResults, data?.data, filteredData]);

  useEffect(() => {
    // Clear search results immediately when searchQuery changes
    // This prevents previous results from showing when starting a new search
    if (searchQuery.trim() === '') {
      setSearchResults(undefined);
      setDebounceQuery('');
      setIsSearching(false);
    } else {
      // Clear previous results immediately when user starts typing a new query
      setSearchResults(undefined);
      // Clear previous API result data to prevent old results from appearing
      setJangoAddressesResult(undefined);
      setGlobalAddresesResult(undefined);
      setIsSearching(true);
    }

    const handler = setTimeout(() => {
      if (searchQuery === '') {
        setSearchResults(undefined);
        setDebounceQuery('');
        setIsSearching(false);
      } else {
        setDebounceQuery(searchQuery);
      }
    }, 300); // Wait for 300ms

    return () => clearTimeout(handler); // Cleanup timeout on every change
  }, [searchQuery]);

  const { mutateAsync: searchGlobalAddresses } = useSearchGlobalAddresses(
    lang,
    data => {
      if (data.data) {
        setGlobalAddresesResult(data);
        return;
      } else {
        // TODO: Handle errors if necessary
      }
    },
    async error => {
      setLoading(false);
      // Handle 500 errors from backend gracefully (backend bug with missing "country" key)
      if (error?.response?.status === 500) {
        console.warn('Backend error (500) - likely missing data structure:', error?.response?.data?.message);
        // Don't show error to user for 500s on global search - let jango search handle it
        return;
      }
      if (typeof error?.response?.data?.message === 'string') {
        snackbarToast(error?.response?.data?.message, 'error', Colors.error);
      
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        snackbarToast(error?.response?.data?.message[0], 'error', Colors.error);
        await delay(5000);
        snackbarToast(i18n.t('(tabs).index.unknownError'), 'error', Colors.error);
      } else {
        snackbarToast(i18n.t('(tabs).index.unknownError'), 'error', Colors.error);
      }
    },
  );

  const { mutateAsync: searchJangoAddresses } = useSearchJangoAddresses(
    lang,
    data => {
      if (data.data) {
        setJangoAddressesResult(data);
        return;
      } else {
        // TODO: Handle errors if necessary
      }
    },
    async error => {
      setLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        snackbarToast(
          `${i18n.t('(tabs).index.errorFetchingAddresses')}: ${error?.response?.data?.message}`,
          'error',
          Colors.error,
        );
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        snackbarToast(
          `${i18n.t('(tabs).index.errorFetchingAddresses')}: ${error?.response?.data?.message[0]}`,
          'error',
          Colors.error,
        );
      } else {
        snackbarToast(
          `${i18n.t('(tabs).index.unknownError')} ${i18n.t('(tabs).index.whileFetchingAddresses')}`,
          'error',
          Colors.error,
        );
      }
    },
  );

  useEffect(() => {
    // Require minimum 3 characters to search (prevents backend errors with very short queries)
    if (!debounceQuery || !user?.id || debounceQuery.trim().length < 3) {
      setSearchResults(undefined);
      setIsSearching(false);
      return;
    }

    const searchAddress = async () => {
      try {
        setIsSearching(true);
        // Clear previous results before starting new search
        setSearchResults(undefined);
        // Clear previous API result data to prevent old results from appearing
        setJangoAddressesResult(undefined);
        setGlobalAddresesResult(undefined);

        // On Address Book add flow: search only My Addresses (Jango) so results have address id
        if (activeTab === 'all-addresses') {
          const [jangoResult] = await Promise.allSettled([
            searchJangoAddresses({ address: debounceQuery }),
          ]);
          if (jangoResult.status === 'rejected') {
            const err = (jangoResult as PromiseRejectedResult).reason;
            console.warn('Jango search failed:', err);
            snackbarToast(
              err?.response?.data?.message || 'Failed to search addresses. Please try again.',
              'error',
              Colors.error,
            );
          }
        } else {
          const [jangoResult, globalResult] = await Promise.allSettled([
            searchJangoAddresses({ address: debounceQuery }),
            searchGlobalAddresses({ address: debounceQuery }),
          ]);
          if (jangoResult.status === 'rejected') console.warn('Jango search failed:', jangoResult.reason);
          if (globalResult.status === 'rejected') {
            console.warn('Global search failed:', globalResult.reason);
            if (jangoResult.status === 'rejected') {
              const errorMessage =
                (globalResult as PromiseRejectedResult).reason?.response?.data?.message ||
                (jangoResult as PromiseRejectedResult).reason?.response?.data?.message ||
                'Failed to search addresses. Please try again.';
              snackbarToast(errorMessage, 'error', Colors.error);
            }
          }
        }
      } catch (error) {
        console.log('Search error:', error);
        snackbarToast('Failed to search addresses. Please try again.', 'error', Colors.error);
      } finally {
        setIsSearching(false);
      }
    };

    searchAddress();
  }, [debounceQuery, user, activeTab, searchJangoAddresses, searchGlobalAddresses]);

  useEffect(() => {
    // Don't process results if there's no active search query
    if (!debounceQuery) {
      return;
    }
    if (!!globalAddressesResult || !!jangoAddressesResult) {
      const globalResults =
        globalAddressesResult?.data.length &&
        globalAddressesResult?.data?.length > 0
          ? globalAddressesResult.data.map(item => {
              const formattedAddress = addressFormatter.format({
                houseNumber: item?.address?.house_number || '',
                road: item?.address?.road || '',
                city: item?.address?.city || item?.address?.county || '',
                state: item?.address?.state || '',
                postcode: '',
                country: item?.address?.country || '',
                countryCode: item?.address?.country_code || '',
              });

              return {
                id: item?.place_id?.toString(),
                formattedAddress,
                latitude: item.lat,
                longitude: item.lon,
              };
            })
          : [];

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
                  '',
                aliasName: item?.alias_name,
                address_components: item?.address_components,
              };
            })
          : [];

      // Combine results from both APIs
      const combinedResults = [...jangoResults, ...globalResults];

      const uniqueResults = Array.from(
        new Set(combinedResults.map(item => JSON.stringify(item))),
      ).map(item => JSON.parse(item));

      setSearchResults(uniqueResults);
    }
  }, [globalAddressesResult, jangoAddressesResult, debounceQuery]);

  useEffect(() => {
    // When switching tabs, clear search state and refetch data to ensure fresh data
    setDebounceQuery('');
    setQuery('');
    setSearchQuery('');
    setDisplayValue(undefined);
    setSelectedResult(undefined);
    setSearchingAlias(false);
    setSearchResults(undefined);
    
    // Refetch data when switching tabs to ensure fresh data
    if (user?.id) {
      if (activeTab === 'my-addresses') {
        refetchMyJangoAddresses();
      } else if (activeTab === 'all-addresses') {
        refetchMyAliasAddresses();
      }
    }
  }, [activeTab, user?.id, refetchMyJangoAddresses, refetchMyAliasAddresses]);

  // Clear search when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Clear search when screen loses focus
        setDebounceQuery('');
        setQuery('');
        setSearchQuery('');
        setDisplayValue(undefined);
        setSelectedResult(undefined);
        setSearchingAlias(false);
        setSearchResults(undefined);
      };
    }, []),
  );

  useEffect(() => {
    if (myAliasAddresses?.message && activeTab === 'all-addresses') {
      snackbarToast(myAliasAddresses.message, 'info', Colors.primary[500]);
    }
  }, [myAliasAddresses?.message, activeTab]);

  return (
    <>
      <KeyboardAvoidingView
        style={defaultStyles.flex}
        behavior="padding"
        keyboardVerticalOffset={24}>
          <View style={defaultStyles.flex}>
            <Appbar.Header
              dark={false}
              style={[defaultStyles.appHeader, styles.headerContainer]}>
              <TouchableOpacity
                onPress={() => router.replace('/(tabs)')}
                style={defaultStyles.backButtonContainer}>
                <Icon
                  source={'arrow-left'}
                  size={24}
                  color={Colors.light[10]}
                />
              </TouchableOpacity>
              <View style={defaultStyles.headerTextContainer}>
                <Text style={[defaultStyles.headerText, styles.headerText]}>
                  {i18n.t('my-addresses.addresses')}
                </Text>
              </View>
            </Appbar.Header>
            <View style={styles.topNav}>
              <TouchableOpacity
                style={[
                  loginStyles.navItem,
                  activeTab === 'my-addresses' && loginStyles.activeNavItem,
                ]}
                onPress={() => setActiveTab('my-addresses')}>
                <Text
                  style={[
                    loginStyles.navText,
                    activeTab === 'my-addresses' && loginStyles.activeNavText,
                  ]}>
                  {i18n.t('my-addresses.myAddresses')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  loginStyles.navItem,
                  activeTab === 'all-addresses' && loginStyles.activeNavItem,
                ]}
                onPress={() => setActiveTab('all-addresses')}>
                <Text
                  style={[
                    loginStyles.navText,
                    activeTab === 'all-addresses' && loginStyles.activeNavText,
                  ]}>
                  {i18n.t('my-addresses.savedAddresses')}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Sync Status Filter - Only show for "My Addresses" tab */}
            {activeTab === 'my-addresses' && (
              <View style={[styles.topNav, { marginTop: 8, marginBottom: 8, paddingHorizontal: 16 }]}>
                <TouchableOpacity
                  style={[
                    loginStyles.navItem,
                    syncStatusFilter === 'all' && loginStyles.activeNavItem,
                    { paddingHorizontal: 12, paddingVertical: 6, marginRight: 4 },
                  ]}
                  onPress={() => setSyncStatusFilter('all')}>
                  <Text
                    style={[
                      loginStyles.navText,
                      syncStatusFilter === 'all' && loginStyles.activeNavText,
                      { fontSize: 12 },
                    ]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    loginStyles.navItem,
                    syncStatusFilter === 'synced' && loginStyles.activeNavItem,
                    { paddingHorizontal: 12, paddingVertical: 6, marginRight: 4 },
                  ]}
                  onPress={() => setSyncStatusFilter('synced')}>
                  <Text
                    style={[
                      loginStyles.navText,
                      syncStatusFilter === 'synced' && loginStyles.activeNavText,
                      { fontSize: 12 },
                    ]}>
                    Synced
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    loginStyles.navItem,
                    syncStatusFilter === 'pending' && loginStyles.activeNavItem,
                    { paddingHorizontal: 12, paddingVertical: 6, marginRight: 4 },
                  ]}
                  onPress={() => setSyncStatusFilter('pending')}>
                  <Text
                    style={[
                      loginStyles.navText,
                      syncStatusFilter === 'pending' && loginStyles.activeNavText,
                      { fontSize: 12 },
                    ]}>
                    Pending
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    loginStyles.navItem,
                    syncStatusFilter === 'conflict' && loginStyles.activeNavItem,
                    { paddingHorizontal: 12, paddingVertical: 6 },
                  ]}
                  onPress={() => setSyncStatusFilter('conflict')}>
                  <Text
                    style={[
                      loginStyles.navText,
                      syncStatusFilter === 'conflict' && loginStyles.activeNavText,
                      { fontSize: 12 },
                    ]}>
                    Conflict
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View
              style={[tabIndexStyles.relativeContainer, styles.zIndexPositive]}>
              <View
                style={[
                  tabIndexStyles.searchContainer,
                  styles.searchContainer,
                ]}>
                {!searchingAlias && (
                  <View style={[tabIndexStyles.searchInputContainer]}>
                    <View
                      style={[
                        tabIndexStyles.searchInput,
                        styles.whiteBackground,
                      ]}>
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
                        value={query}
                        onChangeText={e => {
                          setQuery(e);
                          // setActiveSearchInput('search');
                        }}
                        placeholder={i18n.t('my-addresses.search')}
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
                )}
              </View>
              {activeTab === 'all-addresses' ? (
                !searchingAlias ? (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      columnGap: 8,
                      width: 'auto',
                      // backgroundColor: 'white',
                      marginTop: 20,
                      marginBottom: -8,
                      padding: 8,
                      borderRadius: 8,
                    }}
                    onPress={() => setSearchingAlias(true)}>
                    <Text
                      style={{
                        color: Colors.primary[500],
                      }}>
                      {i18n.t('my-addresses.addAnAddress')}
                    </Text>
                    <Icon
                      source={'plus'}
                      color={Colors.primary[500]}
                      size={20}
                    />
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      tabIndexStyles.searchContainer,
                      styles.searchAndReplaceContainer,
                      styles.addAliasSearchContainer,
                    ]}>
                    <View style={styles.searchInputContainer}>
                      <View
                        style={[
                          tabIndexStyles.searchInput,
                          styles.whiteBackground,
                        ]}>
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
                          value={!searchQuery ? displayValue : searchQuery}
                          onChangeText={e => {
                            if (displayValue) setDisplayValue(undefined);
                            // Clear search results immediately when user types
                            if (e.trim() !== searchQuery.trim()) {
                              setSearchResults(undefined);
                            }
                            setSearchQuery(e);
                            // setActiveSearchInput('search');
                          }}
                          placeholder={i18n.t('my-addresses.searchAndSave')}
                          placeholderTextColor={Colors.grey}
                          // onFocus={handleOutsidePress}
                          numberOfLines={1}
                        />
                        {isSearhing ? (
                          <ActivityIndicator color={Colors.primary['500']} />
                        ) : (
                          (!!searchQuery || !!displayValue) && (
                            <TouchableOpacity
                              style={tabIndexStyles.searchIconContainer}
                              onPress={() => {
                                setSearchQuery('');
                                setDisplayValue(undefined);
                              }}>
                              <Icon
                                source={'close'}
                                size={18}
                                color={Colors.grey}
                              />
                            </TouchableOpacity>
                          )
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setSearchingAlias(false);
                        setSearchResults(undefined);
                        setSearchQuery('');
                        setDisplayValue(undefined);
                      }}>
                      <Icon source={'close'} size={18} />
                    </TouchableOpacity>
                  </View>
                )
              ) : null}
            </View>
            <FlatList
              style={defaultStyles.flex}
              data={(listData || []) as any[]}
              keyExtractor={(item, index) => `${activeTab}-${index}-${(item as any).id || (item as any).alias_id || index}`}
              onEndReached={() => {
                if (activeTab === 'my-addresses' && hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                } else if (activeTab === 'all-addresses' && searchingAlias && hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                } else if (activeTab === 'all-addresses' && !searchingAlias && hasNextAliasPage && !isFetchingNextAliasPage) {
                  fetchNextAliasPage();
                }
              }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={() => {
                // Show loading indicator at the bottom when fetching more
                if (activeTab === 'my-addresses' && isFetchingNextPage) {
                  return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={Colors.primary['500']} />
                    </View>
                  );
                } else if (activeTab === 'all-addresses' && isFetchingNextAliasPage) {
                  return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={Colors.primary['500']} />
                    </View>
                  );
                }
                
                // Show "No more items" message when there are no more pages to load
                // Only show if we have data and we're not loading
                if (activeTab === 'my-addresses' && !hasNextPage && data?.data && data.data.length > 0 && !isLoading) {
                  return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ color: Colors.grey, fontSize: 14 }}>
                        {i18n.t('my-addresses.noMoreItems')}
                      </Text>
                    </View>
                  );
                } else if (activeTab === 'all-addresses' && !hasNextAliasPage && myAliasAddresses?.data && myAliasAddresses.data.length > 0 && !isMyAliasAddressesLoading) {
                  return (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ color: Colors.grey, fontSize: 14 }}>
                        {i18n.t('my-addresses.noMoreItems')}
                      </Text>
                    </View>
                  );
                }
                
                return null;
              }}
              renderItem={({ item }) => {
                // Check if this is the home address by comparing with fetched home address or user's home_address_id
                const isHomeAddress = activeTab === 'my-addresses' && (
                  homeAddress?.address_id === item.id || 
                  user?.home_address_id === item.id
                );
                
                // Debug: Log to verify home address detection
                if (isHomeAddress) {
                  console.log('Home address detected:', {
                    itemId: item.id,
                    homeAddressId: homeAddress?.address_id,
                    userHomeAddressId: user?.home_address_id,
                    activeTab,
                  });
                }
                
                return (
                  <AddressComponent
                    address={item}
                    onSave={() => {
                      setSelectedAddress(item);
                      setShowAddAsHomeAddressModal(true);
                    }}
                    username={user?.full_names}
                    savable={activeTab !== 'all-addresses'}
                    showEditIcon={activeTab === 'all-addresses'}
                    onEdit={() => {
                      if (activeTab !== 'all-addresses') return;
                      if (searchingAlias) {
                        setSelectedResult({
                          id: (item as any).id,
                          formattedAddress: (item as any).formatted_address ?? (item as any).formattedAddress,
                          latitude: (item as any).latitude,
                          longitude: (item as any).longitude,
                        });
                        setShowAddAlias(true);
                      } else {
                        setEditingHomeAddress(item);
                        setEditingAddressTab(activeTab);
                        setShowEditAlias(true);
                      }
                    }}
                    rightComponent={
                      activeTab === 'all-addresses' && (
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedAddress(item);
                            setShowDeleteModal(true);
                          }}>
                          <Icon
                            source={'delete'}
                            size={20}
                            color={Colors.error}
                          />
                        </TouchableOpacity>
                      )
                    }
                  />
                );
              }}
              ListEmptyComponent={() => {
                if ((activeTab === 'my-addresses' && isLoading) ||
                    (activeTab === 'all-addresses' && isMyAliasAddressesLoading)) {
                  return null;
                }
                
                return (
                  <View style={styles.noAddressFoundContainer}>
                    <Text style={styles.noAddressFoundText}>
                      {activeTab === 'my-addresses'
                        ? i18n.t('my-addresses.noAddressesFound')
                        : i18n.t('my-addresses.noSavedAddressesFound')}
                    </Text>
                  </View>
                );
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={true}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[Colors.primary['500']]} // Android
                  tintColor={Colors.primary['500']} // iOS
                />
              }
              ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
              contentContainerStyle={[
                styles.contentContainer,
                defaultStyles.paddingBottom,
                { flexGrow: 1 }
              ]}
              onScrollBeginDrag={() => {
                Keyboard.dismiss();
                // Only clear search results, don't clear query to prevent data disappearing
                setSearchResults(undefined);
              }}
            />

            {/* Search results address for all adresses */}
            {searchResults && activeTab === 'all-addresses' && (
              <View
                style={[
                  customStyles.searchResultsDropdownContainer,
                  { top: isSmallDevice ? 160 : 190 },
                ]}>
                <SearchResultsContainer
                  searchResults={searchResults}
                  setMapScrollEnabled={() => {}}
                  containerStyle={styles.searchResultContainer}
                  onSelect={item => {
                    setDisplayValue(
                      item?.businessName
                        ? item?.businessName
                        : ((item?.formattedAddress?.includes('\n')
                            ? item.formattedAddress.split('\n')[0]
                            : item?.formattedAddress?.split(',')[0]) ?? ''),
                    );
                    setSelectedResult(item);
                    setSearchResults(undefined);
                    setShowAddAlias(true);
                  }}

                />
              </View>
            )}
            {/* End or search results for all addresses */}
          </View>
      </KeyboardAvoidingView>
      <Loader
        visible={
          loading ||
          (activeTab === 'my-addresses' && isLoading) ||
          (activeTab === 'all-addresses' && isMyAliasAddressesLoading)
        }
        text={`${i18n.t('my-addresses.pleaseWait')}...`}
      />
      <Dialog
        visible={showAddAsHomeAddressModal}
        onDismiss={() => {}}
        style={defaultStyles.dialogContainer}>
        <Dialog.Content style={defaultStyles.dialogSubtitleContainer}>
          <View />
          <Text style={drawerStyles.logoutHeadingText}>
            {i18n.t('my-addresses.saveAsHomeAddress')}
          </Text>
          <TouchableOpacity onPress={() => setShowAddAsHomeAddressModal(false)}>
            <Icon source="close" color={Colors.error} size={24} />
          </TouchableOpacity>
        </Dialog.Content>
        <Dialog.Content>
          <Text style={drawerStyles.logoutSubHeading}>
            {i18n.t('my-addresses.doYouWantTo')}
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
            {i18n.t('my-addresses.no')}
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
            {i18n.t('my-addresses.yes')}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <AddAlias
        onClose={() => {
          setShowAddAlias(false);
          setSelectedResult(undefined);
        }}
        visible={showAddAlias && !!selectedResult}
        onSuccess={() => {
          setShowAddAlias(false);
          setSelectedResult(undefined);
          setSearchingAlias(false);
          setSearchResults(undefined);
          queryClient.resetQueries({ queryKey: ['/addresses/my-alias-addresses-infinite'] });
          queryClient.invalidateQueries({ queryKey: ['/addresses/my-alias-addresses-infinite'] });
          refetchMyAliasAddresses();
        }}
        address={{
          longitude: selectedResult?.longitude,
          latitude: selectedResult?.latitude,
          formatted_address: selectedResult?.formattedAddress,
        }}
        addressIdForAdd={selectedResult?.id}
      />
      <AddAlias
        onClose={() => {
          setShowEditAlias(false);
          setEditingHomeAddress(undefined);
          setEditingAddressTab(undefined);
        }}
        visible={showEditAlias && !!editingHomeAddress}
        onSuccess={() => {
          setShowEditAlias(false);
          setEditingHomeAddress(undefined);
          
          // Reset and invalidate all address queries to ensure UI is updated
          // This ensures both "My Addresses" and "My Address Book" tabs show updated data
          queryClient.resetQueries({
            queryKey: ['/addresses/my-jango-addresses-infinite'],
          });
          queryClient.resetQueries({
            queryKey: ['/addresses/my-alias-addresses-infinite'],
          });
          queryClient.invalidateQueries({
            queryKey: ['/addresses/my-jango-addresses-infinite'],
          });
          queryClient.invalidateQueries({
            queryKey: ['/addresses/my-alias-addresses-infinite'],
          });
          refetchMyJangoAddresses();
          refetchMyAliasAddresses();
          refetchHomeAddress();
          
          setEditingAddressTab(undefined);
        }}
        address={{
          longitude: editingHomeAddress?.longitude,
          latitude: editingHomeAddress?.latitude,
          formatted_address: editingHomeAddress?.formatted_address,
        }}
        existingAlias={editingHomeAddress?.alias_name}
        addressId={editingHomeAddress?.id}
        isEditMode={true}
      
      />
      <Dialog
        visible={showDeleteModal}
        onDismiss={() => {}}
        style={[defaultStyles.dialogContainer, styles.errorBorder]}>
        <Dialog.Content style={defaultStyles.dialogSubtitleContainer}>
          <View />
          <Text style={[drawerStyles.logoutHeadingText, styles.dialogTitle]}>
            {i18n.t('my-addresses.delete')}
          </Text>
          <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
            <Icon source="close" color={Colors.error} size={24} />
          </TouchableOpacity>
        </Dialog.Content>
        <Dialog.Content>
          <Text style={drawerStyles.logoutSubHeading}>
            {i18n.t('my-addresses.doYouWantToDelete')}
          </Text>
          <Text style={createAddressStyles.dialogTitle}>
            {selectedAddress?.alias_name}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={defaultStyles.dialogActionContainer}>
          <Button
            mode="contained"
            textColor={Colors.light['10']}
            buttonColor={Colors.primary[500]}
            disabled={loading}
            style={[defaultStyles.flexButton, defaultStyles.secondaryButton]}
            onPress={() => setShowDeleteModal(false)}
            labelStyle={[
              defaultStyles.buttonText,
              defaultStyles.secondaryButtonText,
              defaultStyles.font14,
            ]}>
            {i18n.t('my-addresses.no')}
          </Button>
          <Button
            mode="contained"
            textColor={Colors.light['10']}
            buttonColor={Colors.primary[500]}
            style={[defaultStyles.button]}
            onPress={handleDeleteAliasAddress}
            disabled={loading}
            loading={loading}
            labelStyle={[
              defaultStyles.buttonText,
              defaultStyles.gentiumText,
              defaultStyles.font14,
            ]}>
            {i18n.t('my-addresses.yes')}
          </Button>
        </Dialog.Actions>
      </Dialog>
      {activeTab !== 'all-addresses' && (
        <Loader
          visible={isSearhing}
          text={`${i18n.t('profile.pleaseWait')}...`}
        />
      )}

    </>
  );
}

const customStyles = StyleSheet.create({
  searchResultsDropdownContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    height: 240,

    zIndex: 9999,
  },
});
