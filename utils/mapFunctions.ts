import i18n from '@/i18n';
import { Linking, Platform, Share } from 'react-native';

// Function to show the share sheet
const openShareSheet = async (
  address: {
    latitude: string | number | undefined;
    longitude: string | number | undefined;
    global_code: string | undefined;
    formatted_address: string | undefined;
    house_number?: string | number | null;
    street_name?: string | null;
    road?: string | null;
    houseNumber?: string | null;
    streetName?: string | null;
  },
  userName?: string | undefined,
  locationName?: string,
  onFinish?: () => void,
  finallyFxn?: () => void,
) => {
  const label = encodeURIComponent(
    locationName ?? i18n.t('components.addressComponent.pinnedLocation'),
  );
  // Fallback to default app store links if environment variable is not set
  const appLink = process.env.EXPO_PUBLIC_APP_LINK || 
    (Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/jango' 
      : 'https://play.google.com/store/apps/details?id=com.janitsolutions.jangoaddressmaker');

  const globalCode = encodeURIComponent(address?.global_code ?? '');
  // Fallback to mbukanji.org if environment variable is not set
  const mbukangiUrl = process.env.EXPO_PUBLIC_MBUKANGI_URL || 'https://mbukanji.org';
  const locationLink = `${mbukangiUrl}?global_code=${globalCode}&action=find`;

  // Create platform-appropriate map URLs for navigation
  // For iOS: Apple Maps web URL (opens Apple Maps app on iOS devices)
  // For Android: Google Maps directions URL (opens Google Maps app on Android devices)
  // Format matches the behavior when clicking from directions-rides tab
  const latitudeValue =
    address?.latitude !== undefined && address?.latitude !== null
      ? `${address.latitude}`
      : '';
  const longitudeValue =
    address?.longitude !== undefined && address?.longitude !== null
      ? `${address.longitude}`
      : '';

  const encodedLatitude = encodeURIComponent(latitudeValue);
  const encodedLongitude = encodeURIComponent(longitudeValue);

  const appleMapsUrl =
    latitudeValue && longitudeValue
      ? `http://maps.apple.com/?daddr=${encodedLatitude},${encodedLongitude}&dirflg=d`
      : 'http://maps.apple.com/?dirflg=d';
  const googleMapsUrl =
    latitudeValue && longitudeValue
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodedLatitude},${encodedLongitude}&travelmode=driving`
      : 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
  
  // Use Apple Maps for iOS, Google Maps for Android (when shared, the appropriate one will be used)
  // Apple Maps URL works on iOS and opens the app directly, Google Maps works on both platforms
  const mapUrl = Platform.OS === 'ios' ? appleMapsUrl : googleMapsUrl;

  const formatPart = (value?: string | number | null) => {
    if (value === undefined || value === null) return undefined;
    const stringValue = `${value}`.trim();
    return stringValue.length > 0 ? stringValue : undefined;
  };

  const resolvedHouseNumber =
    formatPart(address?.house_number) ??
    formatPart(address?.houseNumber) ??
    undefined;
  const resolvedStreetName =
    formatPart(address?.street_name) ??
    formatPart(address?.streetName) ??
    formatPart(address?.road) ??
    undefined;
  const formattedAddress = formatPart(address?.formatted_address);

  const streetLine = [resolvedHouseNumber, resolvedStreetName]
    .filter(part => !!part)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const addressParts = [
    streetLine || undefined,
    formattedAddress,
  ].filter(part => !!part && part.trim() !== '');

  const uniqueAddressParts = Array.from(new Set(addressParts));
  const addressLine =
    uniqueAddressParts.length > 0
      ? uniqueAddressParts.join(', ')
      : formattedAddress || '';

  let message = '';
  if (address?.global_code) {
    message = `*${i18n.t('components.addressComponent.address')}:* ${addressLine}\n\n*${i18n.t('components.addressComponent.getTheApp')}:* ${i18n.t('components.addressComponent.downloadJango')} ${appLink} ${i18n.t('components.addressComponent.useTheLink')}\n\n*${i18n.t('components.addressComponent.findIt')} (Car):* ${mapUrl}\n\n*${i18n.t('components.addressComponent.viewLocation')}:* ${locationLink}`;
  } else {
    message = `*${i18n.t('components.addressComponent.address')}:* ${addressLine}\n\n*${i18n.t('components.addressComponent.getTheApp')}:* ${i18n.t('components.addressComponent.downloadJango')} ${appLink} ${i18n.t('components.addressComponent.useTheLink')}\n\n*${i18n.t('components.addressComponent.findIt')} (Car):* ${mapUrl}`;
  }

  try {
    await Share.share({
      message: message, // Message body
      // url: mapUrl, // Link to share
      title: `${userName ?? i18n.t('components.addressComponent.someone')} ${i18n.t('components.addressComponent.shareAddress')}`, // (iOS only)
    });
  } catch {
    // Handle errors if any
  } finally {
    finallyFxn?.();
  }
  onFinish?.();
};

const openMapDirectly = async (
  address: {
    latitude: string | undefined;
    longitude: string | undefined;
    global_code: string | undefined;
    formatted_address: string | undefined;
  },
  locationName?: string,
  beforeOpenMap?: () => void,
  onFinish?: () => void,
  finallyFxn?: () => void,
  userName?: string | undefined,
) => {
  const label = encodeURIComponent(
    locationName ?? i18n.t('components.addressComponent.pinnedLocation'),
  );
  let url = '';

  if (Platform.OS === 'ios') {
    // For iOS: Apple Maps (maps:// URL scheme)
    // url = `maps://?q=${address?.latitude},${address?.longitude};`;
    url = `maps://?q=${label}&ll=${address?.latitude},${address?.longitude}&z=15`;
    // url += `https://share.here.com/l/${address?.latitude},${address?.longitude}/${label};`;
    // url += `mapsme://map?v=1&ll=${address?.latitude},${address?.longitude}&n=${label};`;
    // url += `waze://?ll=${address?.latitude},${address?.longitude}&navigate=yes;`;
    // url += `here-location://${address?.latitude},${address?.longitude}`;
  } else if (Platform.OS === 'android') {
    // For Android: Google Maps (geo:// URL scheme)
    url = `geo:${address?.latitude},${address?.longitude}?q=${address?.latitude},${address?.longitude}(${label});`;
    // url = `geo:${address?.latitude},${address?.longitude}?q=${label}&zoom=15`;
    // url += `https://share.here.com/l/${address?.latitude},${address?.longitude}/${label};`;
    // url += `mapsme://map?v=1&ll=${address?.latitude},${address?.longitude}&n=${label};`;
    // url += `waze://?ll=${address?.latitude},${address?.longitude}&navigate=yes&label=${label};`;
    // url += `here-location://${address?.latitude},${address?.longitude}&label=$`;
  }

  beforeOpenMap?.();

  // Try to open the URL directly using Linking
  Linking.canOpenURL(url)
    .then(supported => {
      if (supported) {
        return Linking.openURL(url); // Open the map app directly
      } else {
        // Fallback to share options if the app is not found
        openShareSheet(address, userName, locationName);
      }
    })
    .catch(() => {
      openShareSheet(address, userName, locationName); // Fallback to share sheet if error occurs
    })
    .finally(() => {
      finallyFxn?.();
    });
  onFinish?.();
};

export { openMapDirectly, openShareSheet };
