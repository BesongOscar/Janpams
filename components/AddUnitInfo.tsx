import React, {
  FC,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  createAddressStyles,
  defaultStyles,
  tabIndexStyles as styles,
} from '@/styles';
import {
  Keyboard,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Platform,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { Button, Dialog, Icon, Snackbar } from 'react-native-paper';
import { Colors, UNIT_TYPES } from '@/constants';
import { InputComponent } from './Input';
import { Loader } from './Loder';
import { useAddUnitInformation } from '@/hooks/addresses.hooks';
import { delay, openShareSheet } from '@/utils';
import { Context, ContextType } from '@/app/_layout';
import { router, useRouter } from 'expo-router';
import { addressesCheckAddressResponse } from '@/interfaces';
import i18n from '@/i18n';
import { parseFormattedAddress } from '@/utils/helpers';
import * as Location from 'expo-location';
import { useFormResetWithLocation, ResetReason } from '@/hooks/useFormResetWithLocation';
import { snackbarToast } from '@/utils/toastHelpter';
import { LocationRefreshBanner } from './LocationRefreshBanner';
import { LocationValidationDialog } from './LocationValidationDialog';

type Props = {
  onClose: () => void;
  visible: boolean;
  onSuccess?: () => void;
  address: addressesCheckAddressResponse | undefined;
};

export const AddUnitInfo: FC<Props> = ({
  onClose,
  visible,
  address,
  onSuccess = () => {},
}) => {
  const { user, lang } = useContext(Context) as ContextType;

  const [extension, setExtension] = useState<string>();
  const [businessName, setBusinessName] = useState<string>();
  const [unitNumber, setUnitNumber] = useState<string>();
  const [unitType, setUnitType] = useState<string>();
  const [showValidationError, setShowValidationError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [visibleToolTip, setVisibleToolTip] = useState<string>();
  const [unitNumberError, setUnitNumberError] = useState<string>();
  const [extensionError, setExtensionError] = useState<string>();
  
  // Location refresh banner state
  const [showLocationBanner, setShowLocationBanner] = useState(false);
  const [locationBannerMessage, setLocationBannerMessage] = useState('');
  const [locationBannerDistance, setLocationBannerDistance] = useState<number | undefined>();
  // Location validation dialog state
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [locationDialogReason, setLocationDialogReason] = useState<ResetReason | null>(null);

  // Function to clear all input fields and reset states
  const clearAllInputs = () => {
    setExtension(undefined);
    setBusinessName(undefined);
    setUnitNumber(undefined);
    setUnitType(undefined);
    setShowValidationError(false);
    setError(undefined);
    setVisibleToolTip(undefined);
    setUnitNumberError(undefined);
    setExtensionError(undefined);
  };

  // Enhanced close handler that clears inputs before closing
  const handleClose = () => {
    clearAllInputs();
    onClose();
  };

  const initialLocation = useMemo<
    Location.LocationObjectCoords | undefined
  >(() => {
    if (
      !address ||
      typeof address.latitude !== 'number' ||
      typeof address.longitude !== 'number'
    ) {
      return undefined;
    }

    return {
      latitude: address.latitude,
      longitude: address.longitude,
      altitude: 0,
      accuracy: 0,
      altitudeAccuracy: null,
      heading: 0,
      speed: 0,
    };
  }, [address]);

  // Soft reset: refresh location context, keep user inputs
  const handleSoftReset = useCallback(async (reason: ResetReason) => {
    // For AddUnitInfo, soft reset means just showing a message
    // since location comes from parent component
    if (reason.distance) {
      setLocationBannerMessage(reason.reason);
      setLocationBannerDistance(reason.distance);
      setShowLocationBanner(true);
    }
  }, []);

  // Hard reset: close modal and navigate home
  const handleHardReset = useCallback(async (reason: ResetReason) => {
    clearAllInputs();
    setLocationDialogReason(reason);
    setShowLocationDialog(true);
  }, []);

  // Unified location reset hook (only active when modal is visible)
  const { locationContext } = useFormResetWithLocation({
    locationOptions: {
      autoStart: visible,
    },
    onSoftReset: handleSoftReset,
    onHardReset: handleHardReset,
    shouldResetOnFocus: false, // Modal doesn't need focus reset
      shouldResetOnAppStateChange: visible,
    shouldResetOnLocationChange: visible && !!initialLocation,
      resetRoute: '/(tabs)',
      initialLocation,
    });

  // Function to handle unit number input with validation
  const handleUnitNumberChange = (value: string | undefined) => {
    if (!value) {
      setUnitNumber(undefined);
      setUnitNumberError(undefined);
      return;
    }

    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');

    // Check if the value exceeds 5 digits
    if (numericValue.length > 5) {
      setUnitNumberError('Unit number cannot exceed 5 digits');
      return;
    }

    // Clear error if value is valid
    setUnitNumberError(undefined);
    setUnitNumber(numericValue);
  };

  // Function to handle extension input with validation
  const handleExtensionChange = (value: string | undefined) => {
    if (!value) {
      setExtension(undefined);
      setExtensionError(undefined);
      return;
    }

    // Remove any non-letter characters and convert to uppercase
    const letterValue = value.replace(/[^a-zA-Z]/g, '').toUpperCase();

    // Check if the value exceeds 1 character
    if (letterValue.length > 1) {
      setExtensionError('Extension must be a single letter');
      return;
    }

    // Clear error if value is valid
    setExtensionError(undefined);
    setExtension(letterValue);
  };

  // Clear inputs when modal is closed or component unmounts
  useEffect(() => {
    if (!visible) {
      clearAllInputs();
    }
  }, [visible]);

  const handleSave = async () => {
    try {
      // Dismiss keyboard when save is clicked
      Keyboard.dismiss();
      
      setShowValidationError(true);

      // Check for validation errors
      if (unitNumberError || extensionError) return;

      if (!((unitType && unitNumber) || extension)) return;

      setLoading(true);
      // Validate location before submission
      const locationValidation = locationContext.validateForSubmit();
      if (!locationValidation.isValid) {
        setShowLocationDialog(true);
        setLocationDialogReason({
          type: 'hard',
          reason: locationValidation.reason || 'Location validation failed',
        });
        setLoading(false);
        return;
      }

      await mutateAsync({
        unit_number: unitNumber ? parseInt(unitNumber, 10) : undefined,
        unit_type: unitType as string | undefined,
        longitude: parseFloat(address?.longitude ?? ''),
        latitude: parseFloat(address?.latitude ?? ''),
        business_name:
          businessName ??
          address?.address_components?.business_name ??
          address?.address?.business_name ??
          address?.address_components?.amenity ??
          address?.address?.amenity ??
          '',
        house_plot_nbr: parseInt(
          address?.address_components?.house_number ??
            address?.address?.house_number ??
            '',
        ),
        house_plot_extension: extension,
      });
    } catch {
      // TODO: Handle errors if necessary
    } finally {
      setLoading(false);
      // Don't clear inputs here - they're cleared in success callback
    }
  };

  const { mutateAsync, data } = useAddUnitInformation(
    lang,
    () => {
      // Clear inputs when save is successful
      clearAllInputs();
      // Dismiss keyboard
      Keyboard.dismiss();
      // Show success modal (keep main modal open to show success)
      setShowSuccessModal(true);
    },
    async error => {
      setLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        setError(
          `${i18n.t('(tabs).index.errorAdding')}: ${error?.response?.data?.message}`,
        );
        await delay(5000);
        setError(undefined);
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        setError(
          `${i18n.t('(tabs).index.errorAdding')}: ${error?.response?.data?.message[0]}`,
        );
        await delay(5000);
        setError(undefined);
      } else {
        setError(i18n.t('(tabs).index.unknownErrorWhileAddingUnit'));
        await delay(5000);
        setError(undefined);
      }
    },
  );

  // This is a helper function to remove the extension from the house number, since all the house numbers are being returned with the extension
  const cleanHouseNumber = (houseNumber?: string) => {
    if (!houseNumber) return houseNumber; // Handle undefined/null

    return /[a-zA-Z]$/.test(houseNumber)
      ? houseNumber.slice(0, -1) // Remove last character if it's a letter
      : houseNumber;
  };

  const displayAddressText = parseFormattedAddress(
    address?.formatted_address ?? '',
  );
  const formatedLength = Object.keys(displayAddressText).length;
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent={true}>
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        pointerEvents="auto">
        <View style={modalStyles.modalContent} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
            <View
              pointerEvents="auto"
              style={{ width: '100%', height: '100%' }}>
              <Dialog
                visible={!showSuccessModal}
                onDismiss={() => {}}
                style={modalStyles.dialogStyle}
                dismissable={false}>
                <Dialog.Content style={modalStyles.dialogHeader}>
                  <View style={modalStyles.headerRow}>
                    <Text style={modalStyles.dialogTitle}>
                      {i18n.t('(tabs).index.addUnit')}
                    </Text>
                    <TouchableOpacity
                      onPress={handleClose}
                      style={modalStyles.closeButton}>
                      <Icon source="close" color={Colors.error} size={24} />
                    </TouchableOpacity>
                  </View>
                </Dialog.Content>
                <ScrollView
                  style={modalStyles.scrollView}
                  contentContainerStyle={modalStyles.scrollContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}>
                  <Dialog.Content style={styles.mainAddressTextContainer}>
                    <Text
                      style={[
                        styles.mainAddressText,
                        formatedLength > 3 && {
                          fontWeight: '700',
                          fontFamily: 'gentium-bold',
                        },
                      ]}>
                      {displayAddressText.line1}
                    </Text>
                    <Text style={styles.mainAddressText}>
                      {displayAddressText.line2}
                    </Text>
                    <Text style={styles.mainAddressText}>
                      {displayAddressText.line3}
                    </Text>
                    {displayAddressText.line4 && (
                      <Text style={styles.mainAddressText}>
                        {displayAddressText.line4}
                      </Text>
                    )}
                    {displayAddressText.line5 && (
                      <Text style={styles.mainAddressText}>
                        {displayAddressText.line5}
                      </Text>
                    )}
                  </Dialog.Content>

                  <Dialog.Content style={styles.dialogContentcontainer}>
                    <InputComponent
                      icon={require('@/assets/images/ic_building.png')}
                      title1={i18n.t('(tabs).index.extension')}
                      placeHolder1={i18n.t('(tabs).index.enterExtension')}
                      value1={extension}
                      setValue1={handleExtensionChange}
                      maxLength1={1}
                      tooltip={i18n.t('(tabs).index.aLetterCanBe')}
                      toolTipVisible={visibleToolTip === 'extension'}
                      onToggleTooltip={() => {
                        visibleToolTip === 'extension'
                          ? setVisibleToolTip(undefined)
                          : setVisibleToolTip('extension');
                      }}
                      error={
                        extensionError
                          ? extensionError
                          : i18n.t('(tabs).index.pleaseEnterExtension')
                      }
                      showError={
                        !!extensionError ||
                        (showValidationError &&
                          !extension &&
                          !(unitNumber && unitType))
                      }
                      containerStyle={styles.inputContainerStyle}
                    />
                  </Dialog.Content>
                  <Dialog.Content style={styles.dialogContentcontainer}>
                    <InputComponent
                      icon={require('@/assets/images/ic_building.png')}
                      optional
                      title1={i18n.t('(tabs).index.businessName')}
                      placeHolder1={i18n.t('(tabs).index.enterBusinessName')}
                      value1={businessName}
                      setValue1={setBusinessName}
                      tooltip={i18n.t('(tabs).index.ifThisAddressIs')}
                      toolTipVisible={visibleToolTip === 'business_name'}
                      onToggleTooltip={() => {
                        visibleToolTip === 'business_name'
                          ? setVisibleToolTip(undefined)
                          : setVisibleToolTip('business_name');
                      }}
                      containerStyle={styles.inputContainerStyle}
                    />
                  </Dialog.Content>
                  <Dialog.Content style={styles.dialogContentcontainer}>
                    <InputComponent
                      icon={require('@/assets/images/ic_unit.png')}
                      title1={i18n.t('(tabs).index.unitType')}
                      placeHolder1={i18n.t('(tabs).index.enterANumber')}
                      value1={unitNumber}
                      setValue1={handleUnitNumberChange}
                      inputMode1="numeric"
                      maxLength1={5}
                      placeHolder2={i18n.t('(tabs).index.selectType')}
                      value2={unitType}
                      setValue2={setUnitType}
                      tooltip={i18n.t('(tabs).index.useThisTo')}
                      toolTipVisible={visibleToolTip === 'unit'}
                      onToggleTooltip={() => {
                        visibleToolTip === 'unit'
                          ? setVisibleToolTip(undefined)
                          : setVisibleToolTip('unit');
                      }}
                      options2={UNIT_TYPES.map(unitType => ({
                        label:
                          lang === 'pt'
                            ? unitType.Portuguese
                            : lang === 'fr'
                              ? unitType.French
                              : unitType.English,
                        value:
                          lang === 'pt'
                            ? unitType.Portuguese
                            : lang === 'fr'
                              ? unitType.French
                              : unitType.English,
                      }))}
                      error={
                        unitNumberError
                          ? unitNumberError
                          : !unitNumber
                            ? i18n.t('(tabs).index.pleaseEnterUnit')
                            : i18n.t('(tabs).index.pleaseSelectUnit')
                      }
                      showError={
                        !!unitNumberError ||
                        (showValidationError &&
                          !(!!unitNumber && !!unitType) &&
                          !extension)
                      }
                      containerStyle={styles.inputContainerStyle}
                    />
                  </Dialog.Content>
                </ScrollView>
                <Dialog.Actions 
                  style={[
                    modalStyles.dialogActions,
                    { paddingBottom: Platform.OS === 'ios' ? 0 : 10 }
                  ]}>
                  <Button
                    mode="contained"
                    textColor={Colors.light['10']}
                    buttonColor={Colors.primary[500]}
                    style={[
                      defaultStyles.flexButton,
                      styles.shareAddressButton,
                    ]}
                    onPress={handleClose}
                    labelStyle={[
                      defaultStyles.buttonText,
                      styles.shareAddressText,
                      createAddressStyles.font14,
                    ]}>
                    {i18n.t('(tabs).index.cancel')}
                  </Button>
                  <Button
                    mode="contained"
                    textColor={Colors.light['10']}
                    buttonColor={Colors.primary[500]}
                    style={defaultStyles.button}
                    onPress={handleSave}
                    labelStyle={[
                      defaultStyles.buttonText,
                      styles.secondaryText,
                      createAddressStyles.font14,
                    ]}>
                    {i18n.t('(tabs).index.save')}
                  </Button>
                </Dialog.Actions>
              </Dialog>
              <Snackbar
                visible={!!error}
                onDismiss={() => {}}
                duration={3000}
                style={[defaultStyles.snackbar, defaultStyles.marginBottom]}>
                <Text style={defaultStyles.errorText}>{error}</Text>
              </Snackbar>
              <Loader
                visible={loading}
                text={i18n.t('(tabs).index.addingUnit')}
              />
              <Dialog
                visible={!!data && showSuccessModal}
                onDismiss={() => {}}
                style={styles.dialogContainer}>
                <Dialog.Content
                  style={[
                    styles.dialogSubtitleContainer,
                    styles.paddingHorizontal,
                  ]}>
                  <Icon
                    source={'check-circle'}
                    size={24}
                    color={Colors.success}
                  />
                  <Text
                    style={createAddressStyles.addressSuccessfullyCreatedText}>
                    {i18n.t('(tabs).index.yourUnitAddressHasBeenAdded')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowSuccessModal(false);
                      // Close the modal and let parent handle reopening bottom sheet
                      onSuccess();
                    }}>
                    <Icon source="close" color={Colors.error} size={24} />
                  </TouchableOpacity>
                </Dialog.Content>
                <Dialog.Content style={styles.paddingBottom}>
                  <Text style={styles.jangoAddress}>
                    {i18n.t('(tabs).index.jangoGPS')}
                  </Text>
                </Dialog.Content>
                <Dialog.Content>
                  <Text
                    style={[
                      styles.mainAddressText,
                      formatedLength > 3 && {
                        fontWeight: '700',
                        fontFamily: 'gentium-bold',
                      },
                    ]}>
                    {displayAddressText.line1}
                  </Text>
                  <Text style={styles.mainAddressText}>
                    {displayAddressText.line2}
                  </Text>
                  <Text style={styles.mainAddressText}>
                    {displayAddressText.line3}
                  </Text>
                  {displayAddressText.line4 && (
                    <Text style={styles.mainAddressText}>
                      {displayAddressText.line4}
                    </Text>
                  )}
                  {displayAddressText.line5 && (
                    <Text style={styles.mainAddressText}>
                      {displayAddressText.line5}
                    </Text>
                  )}
                </Dialog.Content>
                <Dialog.Actions style={styles.dialogActionContainer}>
                  <Button
                    mode="contained"
                    textColor={Colors.light['10']}
                    buttonColor={Colors.primary[500]}
                    style={[
                      defaultStyles.flexButton,
                      createAddressStyles.shareAddressButton,
                    ]}
                    onPress={() => {
                      setShowSuccessModal(false);
                      openShareSheet(
                        {
                          latitude: address?.latitude,
                          longitude: address?.longitude,
                          global_code: address?.global_code,
                          formatted_address: address?.formatted_address,
                          house_number: extension
                            ? `${cleanHouseNumber(
                                address?.address_components?.house_number ??
                                  address?.address?.house_number,
                              )}${extension}`
                            : (address?.address_components?.house_number ??
                              address?.address?.house_number),
                          street_name:
                            address?.address_components?.road ??
                            address?.address?.road,
                        },
                        user?.full_names,
                      );
                      // Close the modal after sharing
                      setShowSuccessModal(false);
                      onSuccess();
                    }}
                    labelStyle={[
                      defaultStyles.buttonText,
                      createAddressStyles.shareAddressText,
                      createAddressStyles.font14,
                    ]}>
                    {i18n.t('(tabs).index.shareAddress')}
                  </Button>
                  <Button
                    mode="contained"
                    textColor={Colors.light['10']}
                    buttonColor={Colors.primary[500]}
                    style={defaultStyles.button}
                    onPress={() => {
                      setShowSuccessModal(false);
                      clearAllInputs();
                      // Navigate to my addresses
                      router.push('/my-addresses');
                      // Also close the modal
                      onSuccess();
                    }}
                    labelStyle={[
                      defaultStyles.buttonText,
                      styles.secondaryText,
                      createAddressStyles.font14,
                    ]}>
                    {i18n.t('(tabs).index.viewMyAddress')}
                  </Button>
                </Dialog.Actions>
              </Dialog>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
      
      {/* Location refresh banner for soft resets */}
      <LocationRefreshBanner
        visible={showLocationBanner && visible}
        message={locationBannerMessage}
        distance={locationBannerDistance}
        onRefresh={async () => {
          setShowLocationBanner(false);
          await locationContext.refreshLocation();
        }}
        onDismiss={() => setShowLocationBanner(false)}
      />
      
      {/* Location validation dialog for hard resets and validation errors */}
      <LocationValidationDialog
        visible={showLocationDialog && visible}
        title={locationDialogReason?.type === 'hard' ? 'Location Changed' : 'Location Validation Error'}
        message={locationDialogReason?.reason || 'Please refresh your location and try again.'}
        reason={locationDialogReason?.distance ? `You moved ${Math.round(locationDialogReason.distance)}m` : undefined}
        onConfirm={async () => {
          setShowLocationDialog(false);
          if (locationDialogReason?.type === 'hard') {
            clearAllInputs();
            handleClose();
            router.replace('/(tabs)');
          }
          setLocationDialogReason(null);
        }}
        onCancel={() => {
          setShowLocationDialog(false);
          setLocationDialogReason(null);
        }}
        confirmLabel="OK"
        cancelLabel={locationDialogReason?.type === 'hard' ? undefined : 'Cancel'}
        type={locationDialogReason?.type === 'hard' ? 'warning' : 'error'}
      />
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogStyle: {
    backgroundColor: Colors.light['10'],
    borderRadius: 16,
    margin: 0,
    padding: 0,
    maxWidth: '100%',
    width: '100%',
    maxHeight: '100%',
    alignSelf: 'center',
    position: 'relative',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  dialogHeader: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark[0.1],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary[500],
    fontFamily: 'gentium-bold',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
  scrollView: {
    flexGrow: 1,
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark[0.1],
    gap: 16,
  },
});
