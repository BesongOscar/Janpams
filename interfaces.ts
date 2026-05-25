import { RegionZip } from './constants';

export interface Country {
  name: string;
  code: string;
  emoji: string;
  unicode: string;
  image: string;
  dial_code: string;
  currency_code: string;
}

export interface Result {
  id?: string;
  businessName?: string;
  formattedAddress?: string;
  longitude?: string;
  latitude?: string;
  global_code?: string;
  houseNumber?: string;
  streetName?: string;
  /** For canonical address display (e.g. My Address Book search). */
  aliasName?: string;
  address_components?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    city?: string;
    state?: string;
    country?: string;
    country_code?: string;
    business_name?: string;
    amenity?: string | null;
  };
  neighborhood?: string;
  city?: string;
  region?: string;
  regionCode?: string;
  country?: string;
  countryCode?: string;
}
export interface IResultDisplayFormat {
  id?: string;
  businessName?: string;
  streetNameDisplay?: string;
  cityDisplay?: string;
  formattedAddress?: string;
  longitude?: string;
  latitude?: string;
  global_code?: string;
}

export interface User {
  id?: string;
  username?: string;
  email_address?: string;
  main_phone_id?: string;
  email_verified?: string;
  created_at?: string;
  updated_at?: string;
  profiles_id?: string;
  roles_id?: number;
  account_type_id?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  stripe_id?: string | null;
  stripe_pm_id?: string | null;
  pm_type?: string | null;
  pm_last_four?: string | null;
  trial_ends_at?: string | null;
  phone_number?: string;
  full_names?: string;
  first_name?: string;
  first_middle_name?: string | null;
  second_middle_name?: string | null;
  last_name?: string;
  maiden_name?: string | null;
  husband_name?: string | null;
  home_address_id?: string | null;
  work_address_id?: string | null;
  image?: string | null;
  confirmed_at?: string | null;
}

export interface usersRegisterUserRequest {
  image?: string;
  first_name?: string;
  last_name?: string;
  middle_names?: string;
  username?: string;
  phone_number?: string;
  email?: string;
  password?: string;
  pincode?: string;
}

export interface usersRegisterUserResponse {
  status?: number;
  user_id?: string;
  message?: string;
}

export interface usersLoginRequest {
  email_username?: string;
  password?: string;
  phone_number?: string;
  pincode?: string;
}

export interface usersLoginResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  user?: User;
}

export interface usersForgotPasswordRequest {
  email?: string;
}

export interface usersForgotPasswordResponse {
  message?: string;
  user_id?: string;
}

export interface usersForgotPinCodeRequest {
  phone_number?: string;
}

export interface usersForgotPinCodeResponse {
  message?: string;
  user_id?: string;
  success?: boolean;
}

export interface usersResendVerificationEmailRequest {
  id?: string;
}

export interface usersResendVerificationRequest {
  id?: string;
  channel?: OTPChannel;
}

export type OTPChannel = 'sms' | 'email' | 'whatsapp';
export interface usersResendVerificationResponse {
  message?: string;
  code?: string;
}

export interface usersConfirmVerificationCodeRequest {
  user_id?: string;
  code?: string;
  channel?: OTPChannel;
}

export interface usersConfirmVerificationCodeResponse {
  message?: string;
}

export interface usersResetPinCodeRequest {
  user_id?: string;
  new_pin?: string;
  code?: string;
}

export interface usersResetPinCodeResponse {
  message?: string;
}

export interface usersResetPasswordRequest {
  user_id?: string;
  new_password?: string;
  code?: string;
}

export interface usersResetPasswordResponse {
  message?: string;
}

export interface usersUpdateProfileRequest {
  image?: string;
  first_name?: string;
  middle_names?: string;
  last_name?: string;
  phone_number?: string;
  username?: string;
  email_address?: string;
  pincode?: string;
  code?: string;
  password?: string;
  new_password?: string;
  new_pincode?: string;
}

export interface usersUpdateProfileResponse {
  message?: string;
}

export interface usersChangePasswordRequest {
  old_password?: string;
  new_password?: string;
}

export interface usersChangePasswordResponse {
  message?: string;
}

export interface usersChangePinRequest {
  old_pin?: number;
  new_pin?: number;
}

export interface usersChangePinResponse {
  message?: string;
}

export interface usersSocialLoginRequest {
  familyName?: string;
  givenName?: string;
  email?: string;
  name?: string;
  pictureUrl?: string;
}
export interface usersLoginWithGoogleRequest {
  code?: string;
}

export type usersLoginWithGoogleResponse = usersLoginResponse;

export interface usersGetUserNotificationsResponse {
  current_page?: number;
  data?: Array<{
    id?: string;
    user_id?: string;
    notification_type?: string;
    message?: string;
    associated_data?: string | null;
  }>;
}

export interface usersGetUserResponse {
  success?: boolean;
  user?: User;
}

export interface usersRefreshTokenRequest {
  user_id?: string;
  refresh_token?: string;
}

export interface usersRefreshTokenResponse {
  refresh_token?: string;
  access_token?: string;
}

export interface addressesSearchJangoAddressesRequest {
  address?: string;
}

export interface addressesSearchGlobalAddressesRequest {
  address?: string;
}

export interface addressesSearchJangoAddressesResponse {
  data: Array<addressesJangoAddress>;
}

export interface addressesSearchGlobalAddressesResponse {
  data: Array<addressesGlobalAddress>;
}

export interface addressesJangoAddress {
  id?: string;
  created_by?: string;
  compound_code?: string;
  address_type?: string;
  formatted_address?: string;
  distance_to_nearby_address?: string;
  global_code?: string;
  w3wAddress?: string;
  latitude?: string;
  longitude?: string;
  image?: string;
  address_components?: {
    house_number?: string;
    amenity?: string | null;
    road?: string;
    neighbourhood?: string;
    business_name?: string;
    postcode?: string;
    city?: string;
    county?: string;
    state?: string;
    country_code?: string;
    country?: string;
  };
  address?: {
    house_number?: string;
    amenity?: string | null;
    road?: string;
    neighbourhood?: string;
    business_name?: string;
    postcode?: string;
    city?: string;
    county?: string;
    state?: string;
    country_code?: string;
    country?: string;
  };
  is_nearby_adddress?: false;
}

export interface addressesGlobalAddress {
  place_id?: number;
  licence?: string;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  place_rank?: number;
  importance?: number;
  addresstype?: string;
  name?: string;
  display_name?: string;
  address?: {
    house_number?: string;
    amenity?: string | null;
    road?: string;
    suburb?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    'ISO3166-2-lvl4'?: string;
    country?: string;
    country_code?: string;
  };
  boundingbox?: Array<string>;
}

export interface addressesCheckAddressRequest {
  latitude?: number;
  longitude?: number;
}

export interface AddressCheckResponse {
  // Define your response structure here
  success: boolean;
  data?: any;
  message?: string;
}

export interface addressesCheckAddressResponse {
  id?: string;
  created_by?: string;
  compound_code?: string;
  address_type?: string;
  formatted_address?: string;
  global_code?: string;
  w3wAddress?: string;
  latitude?: string;
  longitude?: string;
  image?: string;
  address_components?: {
    house_number?: string;
    amenity?: string | null;
    road?: string;
    neighbourhood?: string;
    business_name?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country_code?: string;
    country?: string;
  };
  address?: {
    house_number?: string;
    amenity?: string | null;
    road?: string;
    neighbourhood?: string;
    business_name?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country_code?: string;
    country?: string;
  };
  is_nearby_adddress?: false;
  nearby_addresses?: Array<addressesJangoAddress>;
}

export interface addressesCreateAddressRequest {
  image?: string;
  business_name?: string;
  latitude?: string;
  longitude?: string;
  house_plot_nbr?: string;
  house_plot_extension?: string;
  // This is the road name
  userSSName?: string;
  // This is the neighbourhood name
  userSNName?: string;
  // this is the street type the user selects
  userSSType?: string;
  unit_number?: string;
  unit_type?: string;
  userSCity?: string;
  userSRegion?: string;
  address_category?: string;
  connection?: string;
}

export interface addressesCreateAddressResponse {
  message?: string;
  address?: {
    id?: string;
    compound_code?: string;
    business_name?: string;
    userSSName?: string;
    userSNName?: string;
    formatted_address?: string;
    global_code?: string;
    latitude?: string;
    w3wAddress?: string;
    longitude?: string;
    image?: string | null;
    address_components: {
      house_number?: string;
      amenity?: string | null;
      road?: string;
      neighbourhood?: string;
      city?: string;
      county?: string;
      state?: string;
      country_code?: string | null;
      country?: string | null;
    };
  };
}

export interface addressesAddUnitInformationRequest {
  unit_number?: number;
  unit_type?: string;
  business_name?: string;
  latitude?: number;
  longitude?: number;
  house_plot_nbr?: number;
  house_plot_extension?: string;
}

export interface addressesAddUnitInformationResponse {
  message?: string;
}

export interface addressesAddAliasAddressRequest {
  address_id?: string; // Jango address id when adding from My Addresses (local address book)
  longitude?: number;
  latitude?: number;
  alias_name?: string;
}

export interface addressesAddAliasAddressResponse {
  message?: string;
}

export interface addressesUpdateAliasAddressRequest {
  id?: string;
  alias_name?: string;
}

export interface addressesUpdateAliasAddressResponse {
  message?: string;
}

export interface addressesGetMyJangoAddressesRequest {
  items_per_page?: number;
  current_page?: number;
}

export type addressesGetMyJangoAddressesResponse = {
  data?: Array<addressesMyJangoAddress>;
};

export interface addressesMyJangoAddress {
  id?: string;
  created_by?: string;
  alias_name?: string;
  business_name?: string;
  compound_code?: string;
  address_type?: string;
  formatted_address?: string;
  global_code?: string;
  w3wAddress?: string;
  latitude?: string;
  longitude?: string;
  image?: string | null;
  address_components?: {
    house_number?: string;
    amenity?: string | null;
    road?: string;
    neighbourhood?: string;
    city?: string;
    county?: string;
    state?: string;
    country_code?: string | null;
    country?: string;
  };
}

export interface addressesGetAddressComponentsReqeust {
  latitude?: string;
  longitude?: string;
}

export interface addressesGetAddressComponentResponse {
  street_name?: string;
  neighborhood?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
}

export interface addressesGetMyHomeAddressResponse {
  home_id?: string;
  address_id?: string;
  created_by?: string;
  compound_code?: string;
  address_type?: string;
  formatted_address?: string;
  global_code?: string;
  w3wAddress?: string;
  latitude?: string;
  longitude?: string;
  image?: string | null;
  address_components?: {
    house_number?: string | null;
    amenity?: string | null;
    road?: string;
    neighbourhood?: string;
    city?: string;
    county?: string;
    state?: string;
    country_code?: string;
    country?: string;
  };
}

export interface addressesGetJangoRouteRequest {
  routeMode?: string;
  routeCoordinates?: string;
}

export interface addressesGetJangoRouteResponse {
  code?: string;
  routes?: Array<{
    legs?: Array<{
      steps?: Array<{
        geometry?: string;
        maneuver?: {
          bearing_after?: number;
          bearing_before?: number;
          location?: Array<number>;
          type?: string;
        };
        mode?: string;
        driving_side?: string;
        name?: string;
        intersections?: Array<{
          out?: number;
          entry?: Array<boolean>;
          bearings?: Array<number>;
          location?: Array<number>;
        }>;
        weight: 4.5;
        duration: 4.5;
        distance: 100.4;
      }>;
      summary?: string;
      weight?: number;
      duration?: number;
      distance?: number;
    }>;
    weight_name?: string;
    weight?: number;
    duration?: string;
    distance?: number;
    distance_km?: number;
    distance_miles?: number;
  }>;
  waypoints?: Array<{
    hint?: string;
    distance: number;
    name?: number;
    location?: Array<number>;
  }>;
}

export interface addressesAddHomeAddressRequest {
  address_id?: string;
}

export interface addressesAddHomeAddressResponse {
  message?: string;
  list: Array<addressesMyJangoAddress>;
}

export interface addressesDeleteAliasAddressRequest {
  aliases: Array<{
    alias_id?: string;
  }>;
}

export interface addressesDeleteAliasAddressResponse {
  message?: string;
}

export interface addressesGetMyAliasAddressesRequest {
  items_per_page?: string;
  current_page?: string;
}

export interface addressesGetMyAliasAddressesResponse {
  current_page?: number;
  data?: Array<addressesJangoAddress>;
}

export type Language = 'en' | 'fr' | 'pt';

export interface StreetType {
  English: string;
  'Abbr (EN)': string;
  French: string;
  'Abbr (FR)': string;
  Portuguese: string;
  'Abbr (PT)': string;
}

export type LocalizedLabel = {
  // eslint-disable-next-line no-unused-vars
  [key in Language]: string;
};

export type RegionZipItem = {
  region: LocalizedLabel;
  zip: LocalizedLabel;
};

export type RegionZipCountry = keyof typeof RegionZip;

export interface DropdownOption {
  label: string;
  value: string;
}

export interface LocalizedStreetTypeOptions {
  en: DropdownOption[];
  fr: DropdownOption[];
  pt: DropdownOption[];
}
