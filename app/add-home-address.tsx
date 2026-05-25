import { Colors, countries, STREET_TYPES, UNIT_TYPES } from '@/constants';
import { createAddressStyles as styles, defaultStyles } from '@/styles';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import {
  Appbar,
  Button,
  Checkbox,
  Dialog,
  Icon,
  Snackbar,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import {
  delay,
  formatNeighborhood,
  openShareSheet,
  readData,
  useCompressedImage,
  deleteData,
  storeData,
} from '@/utils';
import * as Location from 'expo-location';
import {
  useCreateAddress,
  useGetAddressesComponents,
  useSaveUserHomeAddress,
} from '@/hooks/addresses.hooks';
import {
  AddressCategoryDropdown,
  EditStreet,
  InputComponent,
  Loader,
} from '@/components';
import { Context, ContextType } from './_layout';
import { addressesCreateAddressRequest } from '@/interfaces';
import i18n from '../i18n';
import { getLocationLabel, getRegionZip } from '@/utils/regionZipFormatter';
import { snackbarToast } from '@/utils/toastHelpter';
import { useFormResetOnNavigation } from '@/hooks/useFormResetOnNavigation';

export default function AddHomeAddress() {
  const { user, lang } = useContext(Context) as ContextType;

  const [coordinates, setCoordinates] =
    useState<Location.LocationObjectCoords>();

  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [businessName, setBusinessName] = useState<string>();
  const [addressCategory, setAddressCategory] = useState<string>();
  const [houseNumber, setHouseNumber] = useState<string>();
  const [city, setCity] = useState<string>();
  const [region, setRegion] = useState<string>();
  const [extension, setExtension] = useState<string>();
  const [unitNumber, setUnitNumber] = useState<string>();
  const [unitType, setUnitType] = useState<string>();
  const [street, setStreet] = useState<string>();
  const [neighbourhood, setNeighbourhood] = useState<string>();
  const [country, setCountry] = useState<string>();
  const [loading, setLoading] = useState(false);
 // Removed modalVisible - modal no longer needed
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset>();
  const [error, setError] = useState<string>();
  const [showValidationError, setShowValidationError] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [preLoading, setPreLoading] = useState(false);
  const [visibleToolTip, setVisibleToolTip] = useState<string>();
  const [isEditingStreet, setIsEditingStreet] = useState(false);
  const [streetType, setStreetType] = useState<string>('Street');
  const [regionLabel, setRegionLabel] = useState('Region');
  const [cityLabel, setCityLabel] = useState('City');
  const [zipLabel, setZipLabel] = useState('Zip');
  const [extensionError, setExtensionError] = useState<string>();
  const [houseNumberError, setHouseNumberError] = useState<string>();

  const {
    compressImage,
    // loading: isCompressing,
    // error: compressionError,
  } = useCompressedImage(image?.uri ?? '');

  // Function to clear all input fields and reset states
  const clearAllInputs = () => {
    setChecked(false);
    setBusinessName(undefined);
    setAddressCategory(undefined);
    setHouseNumber(undefined);
    setCity(undefined);
    setRegion(undefined);
    setExtension(undefined);
    setUnitNumber(undefined);
    setUnitType(undefined);
    setStreet(undefined);
    setNeighbourhood(undefined);
    setCountry(undefined);
    setImage(undefined);
    setError(undefined);
    setShowValidationError(false);
    setVisibleToolTip(undefined);
    setExtensionError(undefined);
    setHouseNumberError(undefined);
    setIsEditingStreet(false);
    setStreetType('Street');
    setCoordinates(undefined);
  };

  // Function to refresh location and reset form - memoized to prevent re-renders
  const refreshLocationAndResetForm = useCallback(async (showFeedback: boolean = false) => {
    clearAllInputs();
    // Clear stored coordinates to prevent loading old location data
    await deleteData('@currentCoordinates');
    
    if (showFeedback) {
      snackbarToast(
        'Form reset: Returning to home screen. Please add home address for your current location.',
        'info',
      );
    }
    
    setPreLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert(i18n.t('add-home-address.pleaseAcceptPermissions'));
        setPreLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setCoordinates(currentLocation.coords);
      // Store the new location to keep it in sync
      await storeData('@currentCoordinates', currentLocation.coords);
    } catch {
      // TODO: Handle errors if necessary
    } finally {
      setPreLoading(false);
    }
  }, []); // Empty deps - clearAllInputs is stable

  // Create reset function with feedback
  const formResetWithFeedback = useCallback(async () => {
    await refreshLocationAndResetForm(true); // Pass true to show feedback
  }, [refreshLocationAndResetForm]);

  // Use the custom hook to handle form reset on navigation and app state changes
  useFormResetOnNavigation({
    onFormReset: formResetWithFeedback,
    shouldResetOnFocus: true,
    shouldResetOnAppStateChange: true,
    shouldResetOnLocationChange: true,
    resetRoute: '/(tabs)', // Navigate back to main tabs when form should be reset
    locationChangeThreshold: 50, // Reset if user moves more than 50 meters (more sensitive for accurate addressing)
    initialLocation: coordinates, // Pass the initial location for monitoring
    onLocationChangeReset: distance => {
      // Show user notification about location change
      snackbarToast(
        `Form reset: You moved ${Math.round(distance)}m from the original location. Returning to home screen. Please add home address for your current location.`,
        'info',
      );
    },
  });

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

  // Function to handle house number input with validation
  const handleHouseNumberChange = (value: string | undefined) => {
    if (!value) {
      setHouseNumber(undefined);
      setHouseNumberError(undefined);
      return;
    }

    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');

    // Check if the value exceeds 6 digits
    if (numericValue.length > 6) {
      setHouseNumberError('House number cannot exceed 6 digits');
      return;
    }

    // Clear error if value is valid
    setHouseNumberError(undefined);
    setHouseNumber(numericValue);
  };

  useEffect(() => {
    const retrieveLocationFromStorage = async () => {
      setPreLoading(true);
      const locationCoords = (await readData('@currentCoordinates')) as
        | Location.LocationObjectCoords
        | undefined;

      if (locationCoords) {
        setCoordinates(locationCoords);
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          alert(i18n.t('add-home-address.pleaseAcceptPermissions'));
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        setCoordinates(currentLocation.coords);
      }
      setPreLoading(false);
    };
    retrieveLocationFromStorage();
  }, []);

  const { data: addressComponents, isLoading } = useGetAddressesComponents(
    lang,
    {
      longitude: coordinates?.longitude?.toString(),
      latitude: coordinates?.latitude?.toString(),
    },
    !!coordinates?.longitude && !!coordinates?.latitude && !!user?.id,
  );

  useEffect(() => {
    if (addressComponents) {
      setCountry(addressComponents?.country ?? '');
      setCity(
        addressComponents?.city ??
          addressComponents?.town ??
          addressComponents?.village ??
          '',
      );
      setCityLabel(getLocationLabel(addressComponents, lang));
      setNeighbourhood(
        formatNeighborhood(
          addressComponents?.neighborhood ?? '',
          STREET_TYPES,
          lang,
        ),
      );
      setStreet(addressComponents?.street_name ?? '');
      setRegion(addressComponents?.state ?? '');
    }
  }, [addressComponents]);

  // Removed translateY - modal animation no longer needed

  // Removed modal - directly take photo when image button is clicked
  const openModal = () => {
    takePhoto();
  };

  const takePhoto = async () => {
    // Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        i18n.t('add-home-address.permissionDenied'),
        i18n.t('add-home-address.allowAccessToCamera'),
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const handleCreateAddress = async () => {
    try {
      setShowValidationError(true);
      if (!checked) {
        setError(i18n.t('add-home-address.pleaseCheck'));
        await delay(3000);
        setError(undefined);
        return;
      }

      // Check for validation errors
      if (extensionError || houseNumberError) return;

      if (
        !(
          addressCategory &&
          houseNumber &&
          city &&
          region &&
          street &&
          neighbourhood &&
          country
        )
      )
        return;

      let imageUri = '';

      if (image?.uri) {
        imageUri = await compressImage();
      }

      let createAddressData: addressesCreateAddressRequest = {
        image: imageUri,
        latitude: (coordinates?.latitude ?? 0)?.toString(),
        longitude: (coordinates?.longitude ?? 0)?.toString(),
        unit_number: unitNumber,
        unit_type: unitType as string,
        house_plot_nbr: houseNumber,
        house_plot_extension: extension,
        userSSName: street,
        userSSType: streetType,
        userSNName: neighbourhood,
      };

      if (businessName) {
        createAddressData = {
          ...createAddressData,
          business_name: businessName,
        };
      }

      setLoading(true);
      await createAddress(createAddressData);
    } catch {
      // TODO: Handle errors if necessary
    } finally {
      setLoading(false);
    }
  };

  const { mutateAsync: saveUserHomeAddress } = useSaveUserHomeAddress(
    lang,
    () => {
      setShowSuccessModal(true);
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
        setError(i18n.t('add-home-address.unknownError'));
        await delay(5000);
        setError(undefined);
      }
    },
  );

  const { data: createAddressResponse, mutateAsync: createAddress } =
    useCreateAddress(
      lang,
      async data => {
        await saveUserHomeAddress({
          address_id: data?.address?.id,
        });
        clearAllInputs();
      },
      async error => {
        setLoading(false);
        if (typeof error?.response?.data?.message === 'string') {
          setError(
            `${i18n.t('add-home-address.errorCreatingAddress')}: ${error?.response?.data?.message}`,
          );
          await delay(5000);
          setError(undefined);
        } else if (
          Array.isArray(error?.response?.data?.message) &&
          typeof error?.response?.data?.message[0] === 'string'
        ) {
          setError(
            `${i18n.t('add-home-address.errorCreatingAddress')}: ${error?.response?.data?.message[0]}`,
          );
          await delay(5000);
          setError(undefined);
        } else {
          setError(
            `${i18n.t('add-home-address.unknownError')} ${i18n.t('add-home-address.whileCreatingAddress')}`,
          );
          await delay(5000);
          setError(undefined);
        }
      },
    );

  // This use effect listens to every back action and routes to the tabs screen
  useEffect(() => {
    const backAction = () => {
      clearAllInputs();
      router.replace('/(tabs)');
      return true; // prevent default back behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const regionZip = getRegionZip(country, lang);
    setRegionLabel(regionZip.region);
    setZipLabel(regionZip.zip);
  }, [lang, country]);

  return (
    <>
      <View style={styles.container}>
        <Appbar.Header
          dark={false}
          style={[defaultStyles.appHeader, styles.headerContainer]}>
          <TouchableOpacity
            onPress={() => {
              clearAllInputs();
              router.replace('/(tabs)');
            }}
            style={defaultStyles.backButtonContainer}>
            <Icon source={'arrow-left'} size={24} color={Colors.light[10]} />
          </TouchableOpacity>
          <View style={defaultStyles.homeAddressheaderTextContainer}>
            <Text style={[defaultStyles.headerText, styles.headerText]}>
              {i18n.t('add-home-address.addHomeAddress')}
            </Text>
          </View>
        </Appbar.Header>
        <KeyboardAvoidingView
          style={defaultStyles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>
          <ScrollView
            style={defaultStyles.scrollContainer}
            contentContainerStyle={[
              defaultStyles.contentContainer,
              { paddingBottom: 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            scrollEventThrottle={16}>
            <TouchableWithoutFeedback
              onPress={() => {
                Keyboard.dismiss();
              }}>
              <View
                style={[
                  defaultStyles.contentContainer,
                  styles.contentContainer,
                ]}>
                <View style={styles.imageContainer}>
                  {image ? (
                    <>
                      <Image source={{ uri: image.uri }} style={styles.image} />
                      <TouchableOpacity
                        style={styles.closeContainer}
                        onPress={() => setImage(undefined)}>
                        <Icon
                          source={'close'}
                          size={12}
                          color={Colors.light[10]}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.changeImageContainer}
                        onPress={openModal}>
                        <Image
                          source={require('@/assets/images/ic_camera.png')}
                          tintColor={Colors.light[10]}
                        />
                        <Text style={styles.changeText}>
                          {i18n.t('add-home-address.change')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Image
                        source={require('@/assets/images/ic_big_camera.png')}
                      />
                      <TouchableOpacity
                        style={styles.addAPictureContainer}
                        onPress={openModal}>
                        <Icon
                          source={'plus'}
                          size={16}
                          color={Colors.primary[500]}
                        />
                        <Text style={styles.addAPictureText}>
                          {i18n.t('add-home-address.addAPicture')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                <View
                  style={[defaultStyles.inputsContainer, styles.paddingBottom]}>
                  <InputComponent
                    icon={require('@/assets/images/ic_building.png')}
                    optional
                    title1={i18n.t('add-home-address.businessName')}
                    placeHolder1={i18n.t('add-home-address.enterBusinessName')}
                    value1={businessName}
                    setValue1={setBusinessName}
                    tooltip={i18n.t('add-home-address.ifThisAddressIs')}
                    toolTipVisible={visibleToolTip === 'business_name'}
                    onToggleTooltip={() => {
                      visibleToolTip === 'business_name'
                        ? setVisibleToolTip(undefined)
                        : setVisibleToolTip('business_name');
                    }}
                  />
                  <AddressCategoryDropdown
                    label={i18n.t('add-home-address.addressCategory')}
                    value={addressCategory}
                    onChange={value => setAddressCategory(value)}
                    placeholder={i18n.t(
                      'add-home-address.selectAddressCategory',
                    )}
                    error={i18n.t(
                      'add-home-address.pleaseSelectAddressCategory',
                    )}
                    showError={showValidationError && !addressCategory}
                    onClose={() => {}}
                  />
                  <InputComponent
                    icon={require('@/assets/images/ic_house.png')}
                    title1={i18n.t('add-home-address.housePlotNumber')}
                    title2={i18n.t('add-home-address.extension')}
                    placeHolder1={i18n.t('add-home-address.enterNumber')}
                    value1={houseNumber}
                    setValue1={handleHouseNumberChange}
                    inputMode1="numeric"
                    maxLength1={6}
                    placeHolder2={i18n.t('add-home-address.enterExtension')}
                    value2={extension}
                    setValue2={handleExtensionChange}
                    maxLength2={1}
                    tooltip={i18n.t('add-home-address.aLetterCanBe')}
                    toolTipVisible={visibleToolTip === 'extension'}
                    onToggleTooltip={() => {
                      visibleToolTip === 'extension'
                        ? setVisibleToolTip(undefined)
                        : setVisibleToolTip('extension');
                    }}
                    error={
                      houseNumberError
                        ? houseNumberError
                        : extensionError
                          ? extensionError
                          : i18n.t('add-home-address.pleaseEnterAHouseNumber')
                    }
                    showError={
                      !!houseNumberError ||
                      !!extensionError ||
                      (showValidationError && !houseNumber)
                    }
                  />
                  <InputComponent
                    icon={require('@/assets/images/ic_unit.png')}
                    title1={i18n.t('add-home-address.unitType')}
                    placeHolder1={i18n.t('add-home-address.enterANumber')}
                    value1={unitNumber}
                    setValue1={setUnitNumber}
                    inputMode1="numeric"
                    maxLength1={5}
                    placeHolder2={i18n.t('add-home-address.selectType')}
                    value2={unitType}
                    setValue2={setUnitType}
                    tooltip={i18n.t('add-home-address.useThisTo')}
                    toolTipVisible={visibleToolTip === 'unit'}
                    onToggleTooltip={() => {
                      visibleToolTip === 'unit'
                        ? setVisibleToolTip(undefined)
                        : setVisibleToolTip('unit');
                    }}
                    options2={UNIT_TYPES.map(unitType => ({
                      label: lang === 'pt' ? unitType.Portuguese : lang === 'fr' ? unitType.French : unitType.English,
                      value: lang === 'pt' ? unitType.Portuguese : lang === 'fr' ? unitType.French : unitType.English,
                    }))}
                  />
                  <InputComponent
                    icon={require('@/assets/images/ic_street.png')}
                    title1={i18n.t('add-home-address.street')}
                    placeHolder1={i18n.t('add-home-address.street')}
                    value1={street}
                    setValue1={setStreet}
                    defaultDisabled={true}
                    onPress={() => setIsEditingStreet(true)}
                    editable
                    error={i18n.t('add-home-address.pleaseEnterAStreet')}
                    showError={showValidationError && !street}
                  />
                  <InputComponent
                    icon={require('@/assets/images/ic_neighbour.png')}
                    title1={zipLabel}
                    placeHolder1={`${i18n.t('add-home-address.enter')}${zipLabel}`}
                    value1={neighbourhood}
                    setValue1={setNeighbourhood}
                    onDone={() => {
                      setNeighbourhood(prev =>
                        formatNeighborhood(prev ?? '', STREET_TYPES, lang),
                      );
                    }}
                    editable
                    error={`${i18n.t('add-home-address.pleaseEnterA')}${zipLabel}`}
                    showError={showValidationError && !neighbourhood}
                  />
                  <InputComponent
                    icon={require('@/assets/images/ic_town.png')}
                    title1={cityLabel}
                    title2={regionLabel}
                    placeHolder1={i18n.t('add-home-address.city')}
                    value1={city}
                    // setValue1={
                    //   addressComponents?.city_town_village ? () => {} : setCity
                    // }
                    setValue1={setCity}
                    placeHolder2={regionLabel}
                    value2={region}
                    // setValue2={addressComponents?.state ? () => {} : setRegion}
                    setValue2={setRegion}
                    // defaultDisabled={!!addressComponents?.city_town_village}
                    defaultDisabled={true}
                    error={i18n.t('add-home-address.pleaseSpecifyACity')}
                    showError={showValidationError && !city}
                  />
                  <InputComponent
                    icon={require('@/assets/images/ic_country.png')}
                    title1={i18n.t('add-home-address.country')}
                    placeHolder1={i18n.t('add-home-address.country')}
                    value1={country}
                    setValue1={() => {}}
                    defaultDisabled={true}
                    rightIcon={
                      countries.find(
                        item =>
                          item.name.toLowerCase() === country?.toLowerCase(),
                      )?.emoji
                    }
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
          <View style={defaultStyles.bottomContainerWithContent}>
            <View style={defaultStyles.checkboxContainer}>
              <Checkbox.Android
                status={checked ? 'checked' : 'unchecked'}
                onPress={() => setChecked(prev => !prev)}
                color={Colors.primary[500]}
              />
              <Text style={defaultStyles.checkboxText}>
                {i18n.t('add-home-address.checkTheBox')}
              </Text>
            </View>
            <Button
              mode="contained"
              buttonColor={Colors.primary['500']}
              style={defaultStyles.button}
              disabled={loading}
              loading={loading}
              onPress={handleCreateAddress}>
              <Text style={defaultStyles.buttonText}>
                {i18n.t('add-home-address.submitAddress')}
              </Text>
            </Button>
          </View>
        </KeyboardAvoidingView>
      </View>
      {/* Modal removed - only taking photos is allowed */}
      <Snackbar
        visible={!!error}
        onDismiss={() => {}}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{error}</Text>
      </Snackbar>
      <Loader
        visible={loading}
        text={i18n.t('add-home-address.creatingAddress')}
      />
      <Dialog
        visible={!!createAddressResponse && showSuccessModal}
        onDismiss={() => {}}
        style={styles.dialogContainer}>
        <Dialog.Content
          style={[styles.dialogSubtitleContainer, styles.paddingHorizontal]}>
          <Icon source={'check-circle'} size={24} color={Colors.success} />
          <Text style={styles.addressSuccessfullyCreatedText}>
            {i18n.t('add-home-address.yourHomeAddress')}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowSuccessModal(false);
              clearAllInputs();
              router.back();
            }}>
            <Icon source="close" color={Colors.error} size={24} />
          </TouchableOpacity>
        </Dialog.Content>
        <Dialog.Content style={styles.dialogContentContainer}>
          <Text style={styles.jangoAddress}>
            {i18n.t('add-home-address.homeAddress')}:
          </Text>
        </Dialog.Content>
        <Dialog.Content>
          <Text style={styles.dialogTitle}>
            {createAddressResponse?.address?.formatted_address}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={styles.dialogActionContainer}>
          <Button
            mode="contained"
            textColor={Colors.light['10']}
            buttonColor={Colors.primary[500]}
            style={[defaultStyles.flexButton, styles.shareAddressButton]}
            onPress={() =>
              openShareSheet(
                {
                  longitude: createAddressResponse?.address?.longitude,
                  latitude: createAddressResponse?.address?.latitude,
                  global_code: createAddressResponse?.address?.global_code,
                  formatted_address:
                    createAddressResponse?.address?.formatted_address,
                  house_number:
                    createAddressResponse?.address?.address_components
                      ?.house_number || undefined,
                  street_name:
                    createAddressResponse?.address?.address_components?.road ||
                    undefined,
                },
                user?.full_names,
              )
            }
            labelStyle={[
              defaultStyles.buttonText,
              styles.shareAddressText,
              styles.font14,
            ]}>
            {i18n.t('add-home-address.shareAddress')}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <Loader
        visible={preLoading || isLoading}
        text={i18n.t('add-home-address.loadingAddressComponents')}
      />
      <EditStreet
        onClose={() => setIsEditingStreet(false)}
        visible={isEditingStreet}
        setStreet={setStreet}
        setStreetType={setStreetType}
        defaultStreetName={street}
      />
    </>
  );
}
