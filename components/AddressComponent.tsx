import { Colors } from '@/constants';
import { addressesMyJangoAddress } from '@/interfaces';
import { useRouter } from 'expo-router';
import React, { FC, useEffect } from 'react';
import { BackHandler, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { myAddressesStyles as styles } from '@/styles';
import { openMapDirectly, openShareSheet } from '@/utils';
import { getAddressDisplayLines, normalizeAddressForDisplay } from '@/utils/addressDisplay';
import { extractCoordinates, logCoordinateInfo } from '@/utils/coordinateUtils';
import i18n from '@/i18n';

type SyncStatus = 'pending' | 'synced' | 'conflict';

function getSyncStatusColor(status: SyncStatus | undefined): string {
  if (!status) return '#757575';
  switch (status) {
    case 'synced':
      return '#2E7D32';
    case 'pending':
      return '#E65100';
    case 'conflict':
      return '#C62828';
    default:
      return '#757575';
  }
}

function getSyncStatusIcon(status: SyncStatus | undefined): string {
  if (!status) return 'information';
  switch (status) {
    case 'synced':
      return 'check-circle';
    case 'pending':
      return 'sync';
    case 'conflict':
      return 'alert-circle';
    default:
      return 'information';
  }
}

type Props = {
  address: addressesMyJangoAddress & { sync_status?: SyncStatus };
  onSave: () => void;
  username: string | undefined;
  rightComponent?: React.ReactNode;
  savable?: boolean;
  onEdit?: () => void; // Callback for edit action
  showEditIcon?: boolean; // Flag to show edit icon
};
export const AddressComponent: FC<Props> = ({
  address,
  onSave,
  username,
  rightComponent,
  savable = true,
  onEdit,
  showEditIcon = false,
}) => {
  const router = useRouter();
  const syncStatus = address?.sync_status ?? undefined;

  // This use effect listens to every back action and routes to the tabs screen
  useEffect(() => {
    const backAction = () => {
      router.replace('/(tabs)');
      return true; // prevent default back behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  const displayLines = getAddressDisplayLines(normalizeAddressForDisplay((address ?? {}) as Record<string, unknown>));
  // Extract coordinate information using utility functions
  const { latitude, longitude, hasCoordinates } = extractCoordinates(address);

  // Log coordinate information for debugging
  logCoordinateInfo(address, 'AddressComponent');
  return (
    <>
      <View style={styles.addressComponentContainer}>
        <View style={styles.addressTopComponent}>
          {/* Sync Status Badge */}
          {syncStatus && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: getSyncStatusColor(syncStatus),
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 8,
                zIndex: 10,
              }}>
              <Icon
                source={getSyncStatusIcon(syncStatus)}
                size={12}
                color="#FFFFFF"
              />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: '500',
                  marginLeft: 4,
                  textTransform: 'capitalize',
                }}>
                {syncStatus}
              </Text>
            </View>
          )}
          <View style={styles.addressTextContainer}>
            {displayLines.map((line, i) => (
              <Text
                key={i}
                style={[
                  styles.addressNameText,
                  i === 0 && displayLines.length > 1 && { fontWeight: '700', fontFamily: 'gentium-bold' },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.shareIconsContainer}>
            {hasCoordinates ? (
              <>
                <TouchableOpacity
                  onPress={() =>
                    openMapDirectly(
                      {
                        longitude: longitude!,
                        latitude: latitude!,
                        global_code: address?.global_code,
                        formatted_address: address.formatted_address,
                      },
                      address?.alias_name ?? address?.business_name ?? displayLines[0],
                      () => {},
                      () => {},
                      () => {},
                      username,
                    )
                  }>
                  <Icon
                    source={'directions'}
                    color={Colors.dark[0]}
                    size={20}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    // Format address for sharing: remove alias, optionally include business name
                    let formattedAddressForShare = address.formatted_address || '';
                    
                    // If address has an alias_name (from My Address Book), remove it
                    // if (address?.alias_name) {
                      // Split the formatted address by commas
                      const addressParts = formattedAddressForShare.split(',').map(p => p.trim());
                      
                      // Remove the first part if it matches the alias (or always remove first part if alias exists)
                      // The alias is typically the first part in formatted_address
                      if (addressParts.length > 0) {
                        // Remove the first part (alias) and reconstruct
                        const addressWithoutAlias = addressParts.slice(1).join(', ');
                        formattedAddressForShare = addressWithoutAlias;
                      }
                      
                      // Optionally include business name if it exists
                      // const businessName = address?.business_name;
                     
                      // if (businessName) {
                      //   formattedAddressForShare = `${businessName} - ${formattedAddressForShare}`;
                      // }
                    // }
                    
                    openShareSheet(
                      {
                        longitude: longitude!,
                        latitude: latitude!,
                        global_code: address?.global_code,
                        formatted_address: formattedAddressForShare,
                        house_number:
                          address?.address_components?.house_number ??
                          (address as { address?: { house_number?: string } })?.address?.house_number,
                        street_name:
                          address?.address_components?.road ??
                          (address as { address?: { road?: string } })?.address?.road,
                      },
                      username,
                    );
                  }}>
                  <Icon
                    source={'share-variant-outline'}
                    color={Colors.dark[0]}
                    size={16}
                  />
                </TouchableOpacity>
                {showEditIcon && onEdit && (
                  <TouchableOpacity
                    onPress={onEdit}
                    style={{ marginLeft: 8 }}>
                    <Icon
                      source={'pencil'}
                      
                      size={16}
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text
                  style={{ fontSize: 12, color: Colors.grey, marginRight: 8 }}>
                  {i18n.t('(tabs).index.noCoordinates')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    // You could add logic here to try to get coordinates
                  }}>
                  <Icon source={'refresh'} color={Colors.grey} size={16} />
                </TouchableOpacity>
                {showEditIcon && onEdit && (
                  <TouchableOpacity
                    onPress={onEdit}
                    style={{ marginLeft: 8 }}>
                    <Icon
                      source={'pencil'}
                      color={Colors.primary[500]}
                      size={20}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {savable && (
              <TouchableOpacity onPress={onSave} style={styles.moreContainer}>
                <Icon
                  source={'content-save-outline'}
                  color={Colors.dark[0]}
                  size={16}
                />
              </TouchableOpacity>
            )}
            {rightComponent}
          </View>
        </View>
      </View>
    </>
  );
};
