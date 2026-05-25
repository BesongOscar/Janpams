import { useState, useEffect, useCallback } from 'react';
import { Result } from '../interfaces';
import {
  useSearchGlobalAddresses,
  useSearchJangoAddresses,
} from './addresses.hooks';
import { querySearch, type OfflineGroupedResults, type SearchQueryContext } from '@/lib/search/searchQuery';
import type { SearchResult } from '@janpams/core/search';

export interface OfflineSearchState {
  grouped: OfflineGroupedResults | null;
  isSearching: boolean;
}

export const useSearch = (lang: string = 'en') => {
  const [query, setQuery] = useState('');
  const [debounceQuery, setDebounceQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<Result>>();
  const [showSearchResults, setShowSearchResults] = useState<string>();
  const [isSearching, setIsSearching] = useState(false);

  // Offline search state (local index)
  const [offlineResults, setOfflineResults] = useState<OfflineGroupedResults | null>(null);
  const [isOfflineSearching, setIsOfflineSearching] = useState(false);

  // Online search hooks as mutations
  const {
    mutateAsync: searchGlobalAddresses,
    isPending: isGlobalSearchLoading,
  } = useSearchGlobalAddresses(lang);
  const { mutateAsync: searchJangoAddresses, isPending: isJangoSearchLoading } =
    useSearchJangoAddresses(lang);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query === '') {
        setSearchResults(undefined);
        setOfflineResults(null);
        setDebounceQuery('');
        setIsSearching(false);
        setIsOfflineSearching(false);
      } else {
        setDebounceQuery(query);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debounceQuery || debounceQuery.trim() === '') {
      setSearchResults(undefined);
      setOfflineResults(null);
      setIsSearching(false);
      setIsOfflineSearching(false);
      return;
    }

    const performSearch = async () => {
      try {
        setIsSearching(true);
        setIsOfflineSearching(true);
        setSearchResults(undefined);

        // Run offline search (local SQLite index) in parallel with online search
        const offlineSearchPromise = querySearch({
          query: debounceQuery,
        } as SearchQueryContext).catch((err) => {
          console.warn('[useSearch] Offline search failed:', err);
          return null;
        });

        const onlineSearchPromise = Promise.allSettled([
          searchGlobalAddresses({ address: debounceQuery }),
          searchJangoAddresses({ address: debounceQuery }),
        ]);

        const [offlineData, onlineSettled] = await Promise.all([
          offlineSearchPromise,
          onlineSearchPromise,
        ]);

        // Set offline results
        if (offlineData) {
          setOfflineResults(offlineData);
        }
        setIsOfflineSearching(false);

        // Process online global search results
        const [globalResults, jangoResults] = onlineSettled;
        const globalData =
          globalResults.status === 'fulfilled' ? globalResults.value : null;
        const globalSearchResults = globalData?.data?.length
          ? globalData.data.map(item => ({
              id: item?.place_id?.toString(),
              formattedAddress:
                `${item?.address?.house_number || ''} ${item?.address?.road || ''}, ${item?.address?.city || item?.address?.county || ''}, ${item?.address?.state || ''}, ${item?.address?.country || ''}`.trim(),
              latitude: item.lat,
              longitude: item.lon,
              type: 'global' as const,
              houseNumber: item?.address?.house_number || '',
              streetName: item?.address?.road || '',
            }))
          : [];

        // Process online jango search results
        const jangoData =
          jangoResults.status === 'fulfilled' ? jangoResults.value : null;
        const jangoSearchResults = jangoData?.data?.length
          ? jangoData.data.map(item => ({
              id: item.id,
              formattedAddress: item?.formatted_address,
              latitude: item.latitude,
              longitude: item.longitude,
              global_code: item?.global_code,
              businessName:
                item?.address_components?.business_name ||
                item?.address_components?.amenity ||
                '',
              type: 'jango' as const,
              houseNumber: item?.address_components?.house_number || '',
              streetName: item?.address_components?.road || '',
            }))
          : [];

        // Combine online results
        const combinedResults = [...globalSearchResults, ...jangoSearchResults];
        setSearchResults(combinedResults);
      } catch {
        setSearchResults([]);
        setOfflineResults(null);
      } finally {
        setIsSearching(false);
        setIsOfflineSearching(false);
      }
    };

    performSearch();
  }, [debounceQuery, searchGlobalAddresses, searchJangoAddresses]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setSearchResults(undefined);
    setOfflineResults(null);
    setShowSearchResults(undefined);
    setIsSearching(false);
    setIsOfflineSearching(false);
  }, []);

  const handleSearchFocus = useCallback((inputType: string) => {
    setShowSearchResults(inputType);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setShowSearchResults(undefined);
  }, []);

  return {
    query,
    setQuery,
    searchResults,
    offlineResults,
    showSearchResults,
    isSearching: isSearching || isGlobalSearchLoading || isJangoSearchLoading,
    isOfflineSearching,
    clearSearch,
    handleSearchFocus,
    handleSearchBlur,
  };
};
