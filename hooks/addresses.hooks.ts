import {
  addressesAddAliasAddressRequest,
  addressesAddAliasAddressResponse,
  addressesAddHomeAddressRequest,
  addressesAddHomeAddressResponse,
  addressesAddUnitInformationRequest,
  addressesAddUnitInformationResponse,
  addressesCheckAddressRequest,
  addressesCheckAddressResponse,
  addressesCreateAddressRequest,
  addressesCreateAddressResponse,
  addressesDeleteAliasAddressRequest,
  addressesDeleteAliasAddressResponse,
  addressesGetAddressComponentResponse,
  addressesGetAddressComponentsReqeust,
  addressesGetJangoRouteRequest,
  addressesGetJangoRouteResponse,
  addressesGetMyAliasAddressesRequest,
  addressesGetMyAliasAddressesResponse,
  addressesGetMyHomeAddressResponse,
  addressesGetMyJangoAddressesRequest,
  addressesGetMyJangoAddressesResponse,
  addressesSearchGlobalAddressesRequest,
  addressesSearchGlobalAddressesResponse,
  addressesSearchJangoAddressesRequest,
  addressesSearchJangoAddressesResponse,
  addressesUpdateAliasAddressRequest,
  addressesUpdateAliasAddressResponse,
  addressesMyJangoAddress,
  addressesJangoAddress,
} from '@/interfaces';
import { checkLocation, offlineResultToCheckResponse } from '@/lib/addressServices';
import { SyncManager } from '@/lib/syncManager';
import { initDB, insertAddressBookEntry, getAddressBookEntriesPaginated, getAddressBookEntryById, updateAddressBookEntry, deleteAddressBookEntry } from '@/lib/db';
import { storeData, readData } from '@/utils/storage';
import { formatStreetLine } from '@/utils/formatStreetName';
import { axiosFormDataInstance, axiosInstance } from '@/utils';
import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { Address } from '@/lib/db/schemas';
import { randomUUID } from '@/lib/randomUUID';

const HOME_ADDRESS_ID_KEY = 'home_address_id';

/** Map local Address (SQLite) to API-shaped addressesMyJangoAddress (offline-first, no API). */
function addressToMyJango(addr: Address): addressesMyJangoAddress & { sync_status?: string } {
  const streetLine = formatStreetLine(addr.street_name, addr.street_type);
  const formatted_address = `${addr.house_number}${addr.extension || ''} ${streetLine}, ${addr.neighborhood || ''}, ${addr.city}, ${addr.region}`;
  return {
    id: addr.id,
    created_by: addr.created_by,
    business_name: addr.business_name,
    formatted_address,
    global_code: addr.plus_code,
    latitude: addr.latitude != null ? String(addr.latitude) : undefined,
    longitude: addr.longitude != null ? String(addr.longitude) : undefined,
    image: addr.image_url ?? null,
    address_components: {
      house_number: addr.house_number != null ? String(addr.house_number) : undefined,
      road: addr.street_name,
      neighbourhood: addr.neighborhood ?? undefined,
      city: addr.city,
      state: addr.region,
      country: addr.country,
      business_name: addr.business_name ?? undefined,
    },
    sync_status: addr.sync_status,
  };
}

/** Offline-first: load all addresses from local DB (SyncManager), no API. */
async function getLocalJangoAddresses(): Promise<addressesMyJangoAddress[]> {
  await initDB();
  await SyncManager.init();
  const list = await SyncManager.getAllAddresses();
  return list.map(addressToMyJango);
}

/** Offline-first: get home address from local (stored id or first address). */
async function getLocalHomeAddress(): Promise<addressesGetMyHomeAddressResponse | null> {
  const addresses = await getLocalJangoAddresses();
  if (addresses.length === 0) return null;
  const homeId = await readData<string>(HOME_ADDRESS_ID_KEY);
  const home = homeId ? addresses.find(a => a.id === homeId) : addresses[0];
  if (!home) return null;
  return {
    home_id: home.id,
    address_id: home.id,
    created_by: home.created_by,
    formatted_address: home.formatted_address,
    global_code: home.global_code,
    latitude: home.latitude,
    longitude: home.longitude,
    image: home.image ?? null,
    address_components: home.address_components,
  };
}

const searchGlobalAddress = async (
  body: addressesSearchGlobalAddressesRequest,
  lang: string,
) => {
  return (
    await axiosInstance.get<addressesSearchGlobalAddressesResponse>(
      `/address/mbukanji/search?address=${body.address}&lang=${lang}`,
    )
  ).data;
};

export function useSearchGlobalAddresses(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesSearchGlobalAddressesResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: addressesSearchGlobalAddressesRequest) =>
      searchGlobalAddress(body, lang),
    onSuccess,
    onError,
  });
}

/**
 * Offline-first: search Jango addresses from local DB (filter by query).
 * Matches web: search/filter local addresses; no API call to avoid 401.
 */
async function searchLocalJangoAddresses(
  body: addressesSearchJangoAddressesRequest,
): Promise<addressesSearchJangoAddressesResponse> {
  const all = await getLocalJangoAddresses();
  const q = (body.address ?? '').trim().toLowerCase();
  if (!q) {
    return { data: all as unknown as addressesJangoAddress[] };
  }
  const data = all.filter(addr => {
    const searchable = [
      addr.formatted_address,
      addr.global_code,
      addr.business_name,
      addr.address_components?.road,
      addr.address_components?.neighbourhood,
      addr.address_components?.city,
      addr.address_components?.state,
      addr.address_components?.country,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(q);
  });
  return { data: data as unknown as addressesJangoAddress[] };
}

export function useSearchJangoAddresses(
  _lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesSearchJangoAddressesResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: addressesSearchJangoAddressesRequest) =>
      searchLocalJangoAddresses(body),
    onSuccess,
    onError,
  });
}

// Address check using local/Supabase-era logic (no Laravel check-mobile API).
// Uses offline-first checkLocation + offlineResultToCheckResponse (same as map tab offline path).
const checkAddress = async (
  body: addressesCheckAddressRequest,
  _lang: string,
): Promise<addressesCheckAddressResponse> => {
  if (!body.longitude || !body.latitude) {
    throw new Error('Invalid coordinates: longitude and latitude are required');
  }
  if (body.longitude < -180 || body.longitude > 180) {
    throw new Error('Invalid longitude: must be between -180 and 180');
  }
  if (body.latitude < -90 || body.latitude > 90) {
    throw new Error('Invalid latitude: must be between -90 and 90');
  }

  const result = await checkLocation(body.latitude, body.longitude, true);
  if (result.status !== 'FOUND') {
    throw new Error('No address found for this location.');
  }
  const converted = offlineResultToCheckResponse(
    result,
    body.latitude,
    body.longitude,
    undefined,
    undefined,
  );
  return converted as addressesCheckAddressResponse;
};

export function useCheckAddress(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesCheckAddressResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: addressesCheckAddressRequest) =>
      checkAddress(body, lang),
    onSuccess,
    onError,
  });
}

const createAddress = async (
  body: addressesCreateAddressRequest,
  lang: string,
) => {
  const formData = new FormData();
  if (body?.image) {
    formData.append('image', {
      uri: body.image,
      name: 'image.jpg',
      type: 'image/jpeg',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
  formData.append('unit_number', body.unit_number ?? '');
  formData.append('unit_type', body?.unit_type ?? '');
  formData.append('house_plot_nbr', body?.house_plot_nbr ?? '');
  formData.append('house_plot_extension', body?.house_plot_extension ?? '');
  formData.append('latitude', body?.latitude ?? '');
  formData.append('longitude', body?.longitude ?? '');
  formData.append('userSSName', body?.userSSName ?? '');
  formData.append('userSSType', body?.userSSType ?? '');
  formData.append('userSNName', body?.userSNName ?? '');
  formData.append('business_name', body?.business_name ?? '');
  formData.append('address_category', body?.address_category ?? '');
  formData.append('connection', body?.connection ?? '');
  try {
    const response =
      await axiosFormDataInstance.post<addressesCreateAddressResponse>(
        `/address/create?lang=${lang}`,
        formData,
      );
    return response.data;
  } catch (error) {
    console.warn('Error creating address:', error);
    throw error;
  }
};

export function useCreateAddress(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesCreateAddressResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: addressesCreateAddressRequest) =>
      createAddress(body, lang),
    onSuccess,
    onError,
  });
}

const addUnitInformation = async (
  body: addressesAddUnitInformationRequest,
  lang: string,
) => {
  return (
    await axiosInstance.post<addressesAddUnitInformationResponse>(
      `/address/unit?lang=${lang}`,
      body,
    )
  ).data;
};

export function useAddUnitInformation(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesAddUnitInformationResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: addressesAddUnitInformationRequest) =>
      addUnitInformation(body, lang),
    onSuccess,
    onError,
  });
}

/** Offline-first: add alias to local address_book (My Address Book). Requires address_id (Jango address). */
async function addLocalAliasAddress(
  body: addressesAddAliasAddressRequest,
  _lang: string,
): Promise<addressesAddAliasAddressResponse> {
  if (!body.address_id || !body.alias_name?.trim()) {
    return { message: 'address_id and alias_name required' };
  }
  await initDB();
  const id = randomUUID();
  await insertAddressBookEntry(id, body.address_id, body.alias_name.trim());
  return { message: 'saved' };
}

export function useAddAliasAddress(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesAddAliasAddressResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: addressesAddAliasAddressRequest) =>
      addLocalAliasAddress(body, lang),
    onSuccess: (data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ['/addresses/my-alias-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['/addresses/my-alias-addresses-infinite'] });
      onSuccess?.(data);
    },
    onError,
  });
}

/** Offline-first: update alias name in address_book. id = address_book row id. */
async function updateLocalAliasAddress(
  body: addressesUpdateAliasAddressRequest,
  _lang: string,
): Promise<addressesUpdateAliasAddressResponse> {
  if (!body.id || body.alias_name === undefined) {
    return { message: 'id and alias_name required' };
  }
  await initDB();
  const updated = await updateAddressBookEntry(body.id, body.alias_name ?? '');
  return { message: updated ? 'updated' : 'not_found' };
}

export function useUpdateAliasAddress(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesUpdateAliasAddressResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: addressesUpdateAliasAddressRequest) =>
      updateLocalAliasAddress(body, lang),
    onSuccess: (data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ['/addresses/my-alias-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['/addresses/my-alias-addresses-infinite'] });
      onSuccess?.(data);
    },
    onError,
  });
}

/**
 * Offline-first: get my Jango addresses from local DB only (no API).
 * Matches web: use local/SyncManager data; Supabase handles auth, not Laravel user-addresses.
 */
export function useGetMyJangoAddresses(
  lang: string,
  body: addressesGetMyJangoAddressesRequest,
  enabled?: boolean,
) {
  return useQuery({
    queryFn: async () => {
      const all = await getLocalJangoAddresses();
      const page = body.current_page ?? 1;
      const perPage = body.items_per_page ?? 10;
      const start = (page - 1) * perPage;
      const data = all.slice(start, start + perPage);
      return { data, current_page: page, items_per_page: perPage } as addressesGetMyJangoAddressesResponse;
    },
    queryKey: ['/addresses/my-jango-addresses', lang],
    enabled,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
}

/**
 * Offline-first: infinite query for My Jango Addresses from local DB (no API).
 * Pagination is in-memory over local addresses; same shape as before for UI.
 */
export function useGetMyJangoAddressesInfinite(
  lang: string,
  itemsPerPage: number = 10,
  enabled?: boolean,
) {
  return useInfiniteQuery({
    queryKey: ['/addresses/my-jango-addresses-infinite', lang, itemsPerPage],
    queryFn: async ({ pageParam = 1 }) => {
      const all = await getLocalJangoAddresses();
      const start = (pageParam - 1) * itemsPerPage;
      const data = all.slice(start, start + itemsPerPage);
      return { data, current_page: pageParam, items_per_page: itemsPerPage } as addressesGetMyJangoAddressesResponse;
    },
    getNextPageParam: (lastPage, allPages) => {
      const hasData = lastPage?.data && Array.isArray(lastPage.data) && lastPage.data.length > 0;
      const currentPage = allPages.length;
      if (hasData && lastPage.data && lastPage.data.length === itemsPerPage) {
        return currentPage + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
}

const getAddressComponents = async (
  body: addressesGetAddressComponentsReqeust,
  lang: string,
) => {
  return (
    await axiosInstance.get<addressesGetAddressComponentResponse>(
      `/address/mbukanji/components?longitude=${body.longitude}&latitude=${body?.latitude}&lang=${lang}`,
    )
  ).data;
};

export function useGetAddressesComponents(
  lang: string,
  body: addressesGetAddressComponentsReqeust,
  enabled?: boolean,
) {
  return useQuery({
    queryFn: () => getAddressComponents(body, lang),
    queryKey: [
      `/addresses/address-components/${body.latitude}/${body.longitude}`,
    ],
    enabled,
  });
}

/**
 * Offline-first: get home address from local (stored home_address_id or first address).
 * No API call; avoids 401 when Supabase auth is used and Laravel endpoint is not.
 */
export function useGetHomeAddress(lang: string, enabled?: boolean) {
  return useQuery({
    queryFn: () => getLocalHomeAddress(),
    queryKey: ['/addresses/my-home-address'],
    enabled,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
}

const getJangoRoute = async (
  body: addressesGetJangoRouteRequest,
  lang: string,
) => {
  return (
    await axiosInstance.get<addressesGetJangoRouteResponse>(
      `/address/mbukanji/route/${body.routeMode}/${body.routeCoordinates}?lang=${lang}`,
    )
  ).data;
};

export function useGetJangoRoute(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesGetJangoRouteResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: addressesGetJangoRouteRequest) =>
      getJangoRoute(body, lang),
    onSuccess,
    onError,
  });
}

/** Offline-first: save home address id locally (no API). */
async function saveLocalHomeAddress(body: addressesAddHomeAddressRequest): Promise<addressesAddHomeAddressResponse> {
  if (body.address_id) {
    await storeData(HOME_ADDRESS_ID_KEY, body.address_id);
  }
  return { message: 'saved' } as addressesAddHomeAddressResponse;
}

// Get Plus Code from coordinates
const getPlusCode = async (latitude: number, longitude: number) => {
  return (
    await axiosInstance.get<{ plus_code: { global_code: string } }>(
      `/address/mbukanji/plus-code?latitude=${latitude}&longitude=${longitude}`,
    )
  ).data;
};

export function useGetPlusCode(
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: { plus_code: { global_code: string } }) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: ({ latitude, longitude }: { latitude: number; longitude: number }) =>
      getPlusCode(latitude, longitude),
    onSuccess,
    onError,
  });
}

// Get What3Words from coordinates
const getWhat3Words = async (latitude: number, longitude: number) => {
  return (
    await axiosInstance.get<{ words: string }>(
      `/address/mbukanji/w3w-address?latitude=${latitude}&longitude=${longitude}`,
    )
  ).data;
};

export function useGetWhat3Words(
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: { words: string }) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: ({ latitude, longitude }: { latitude: number; longitude: number }) =>
      getWhat3Words(latitude, longitude),
    onSuccess,
    onError,
  });
}

export function useSaveUserHomeAddress(
  _lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesAddHomeAddressResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: addressesAddHomeAddressRequest) =>
      saveLocalHomeAddress(body),
    onSuccess: (data, _variables, _context) => {
      queryClient.invalidateQueries({ queryKey: ['/addresses/my-home-address'] });
      onSuccess?.(data);
    },
    onError,
  });
}

/** Offline-first: delete alias from address_book. aliases[].alias_id = address_book row id. */
async function deleteLocalAliasAddress(
  body: addressesDeleteAliasAddressRequest,
  _lang: string,
): Promise<addressesDeleteAliasAddressResponse> {
  if (!body.aliases?.length) {
    return { message: 'deleted' };
  }
  await initDB();
  for (const { alias_id } of body.aliases) {
    if (alias_id) await deleteAddressBookEntry(alias_id);
  }
  return { message: 'deleted' };
}

export function useDeleteAliasAddress(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: addressesDeleteAliasAddressResponse) => void,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-explicit-any
  onError?: (error?: any) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: addressesDeleteAliasAddressRequest) =>
      deleteLocalAliasAddress(body, lang),
    onSuccess: (data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ['/addresses/my-alias-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['/addresses/my-alias-addresses-infinite'] });
      onSuccess?.(data);
    },
    onError,
  });
}

/**
 * Offline-first: alias addresses (address book) from local address_book + addresses.
 */
async function getLocalAliasAddresses(
  body: addressesGetMyAliasAddressesRequest,
  _lang: string,
): Promise<addressesGetMyAliasAddressesResponse> {
  const page = typeof body.current_page === 'string' ? parseInt(body.current_page, 10) : body.current_page ?? 1;
  const perPage = typeof body.items_per_page === 'string' ? parseInt(body.items_per_page, 10) : (body.items_per_page ?? 10);
  await initDB();
  const { entries } = await getAddressBookEntriesPaginated(page, perPage);
  return { data: entries, current_page: page };
}

export function useGetMyAliasAddresses(
  lang: string,
  body: addressesGetMyAliasAddressesRequest,
  enabled?: boolean,
) {
  return useQuery({
    queryFn: () => getLocalAliasAddresses(body, lang),
    queryKey: ['/addresses/my-alias-addresses'],
    enabled,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
}

/**
 * Offline-first: infinite query for alias addresses (no API).
 */
export function useGetMyAliasAddressesInfinite(
  lang: string,
  itemsPerPage: number = 5,
  enabled?: boolean,
) {
  return useInfiniteQuery({
    queryKey: ['/addresses/my-alias-addresses-infinite', lang, itemsPerPage],
    queryFn: async ({ pageParam = 1 }) => {
      return getLocalAliasAddresses(
        { items_per_page: itemsPerPage.toString(), current_page: pageParam.toString() },
        lang,
      );
    },
    getNextPageParam: () => undefined,
    initialPageParam: 1,
    enabled,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
}
