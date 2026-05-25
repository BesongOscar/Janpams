import React, {
  Dispatch,
  FC,
  SetStateAction,
  useEffect,
  useState,
} from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';

import PhoneNumber, { CountryCode } from 'libphonenumber-js';

import { CAMEROON, Colors, countries as allCountries } from '@/constants';
import { defaultStyles, phoneNumberInputStyles as styles } from '@/styles';
import { HelperText, Icon, Text, TextInput } from 'react-native-paper';
import CountryList from './CountryList';
import { Country } from '@/interfaces';
import i18n from '@/i18n';
import * as Location from 'expo-location';

interface Props {
  containerStyle?: StyleProp<ViewStyle>;
  textContainerStyles?: StyleProp<ViewStyle>;
  setCountryCode: Dispatch<SetStateAction<string>>;
  setPhoneNumber: Dispatch<SetStateAction<string>>;
  countryCode: string | null | undefined;
  phoneNumber: string | null | undefined;
  countries?: Country[] | undefined;
  showError?: boolean;
}

export const validatePhoneNumber = (
  phoneNumber: string | null,
  countryCode: string | null,
) => {
  try {
    const code = allCountries.find(
      country => country.dial_code === countryCode,
    )?.code;
    const number = PhoneNumber(
      phoneNumber as string,
      code as string as CountryCode,
    );
    if (number?.isValid()) {
      return true; // Phone number is valid.
    } else {
      return false; // Phone number is not valid.
    }
  } catch {
    return false;
  }
};

const PhoneNumberInput: FC<Props> = ({
  setCountryCode,
  countryCode,
  phoneNumber,
  setPhoneNumber,
  containerStyle,
  countries,
  showError = false,
}) => {
  const [showCountries, setShowCountries] = useState(false);
  const [country, setCountry] = useState<Country | undefined>(CAMEROON);
  const [isValidPhoneNumber, setIsValidPhoneNumber] = useState(false);

  const handlePhoneNumber = (input: string) => {
    setPhoneNumber(input);

    // if (isValid && !!phoneNumber) {
    //   Keyboard.dismiss();
    // }
  };

  // useEffect(() => {
  //   if (countryCode) {
  //     const countryFound = allCountries?.find(
  //       country => country?.dial_code === countryCode,
  //     );
  //     if (countryFound && countryFound !== country) {
  //       setCountry(countryFound);
  //     }
  //   }
  // }, [countryCode, allCountries]);

  useEffect(() => {
    const isValid = validatePhoneNumber(
      (countryCode ?? '') + (phoneNumber ?? ''),
      country?.code ?? 'CM',
    );
    setIsValidPhoneNumber(isValid);
  }, [phoneNumber, countryCode]);

  useEffect(() => {
    if (countries?.length) {
      const defaultCountry = countries.find(
        country => country?.name === 'Cameroon',
      ) as Country;
      setCountry(defaultCountry ?? countries[0]);
    }
  }, [countries]);

  useEffect(() => {
    const isValid = validatePhoneNumber(
      (countryCode ?? '') + (phoneNumber ?? ''),
      (allCountries.find(country => country.dial_code === countryCode)?.code ??
        'US') as CountryCode,
    );
    setIsValidPhoneNumber(isValid);
  }, [phoneNumber, countryCode]);

  useEffect(() => {
    if (country?.dial_code && country?.dial_code !== countryCode) {
      setCountryCode(country.dial_code);
    }
  }, [country]);

  useEffect(() => {
    const handleUseCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          alert(i18n.t('(tabs).index.pleaseAcceptPermissions'));
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});

        const address = await Location.reverseGeocodeAsync(
          currentLocation.coords,
        );

        const currentCountry = allCountries.find(
          country => country?.name === address[0].country,
        );

        if (currentCountry?.currency_code) setCountry(currentCountry);
      } catch {
        // TODO: Handle error if necessary
      }
    };

    handleUseCurrentLocation();
  }, []);

  return (
    <View style={containerStyle} testID="phone-number-component">
      <View style={styles.mainContainer}>
        <TouchableOpacity onPress={() => setShowCountries(true)}>
          <View style={styles.countryCodeContainer}>
            <Text>{country?.emoji}</Text>
            <Text style={styles.countryCodeText}>{country?.dial_code}</Text>
            <Icon color={Colors.dark[0]} size={20} source={'chevron-down'} />
          </View>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          mode="outlined"
          outlineStyle={defaultStyles.outlineStyle}
          placeholder={i18n.t('(auth).login.mobileNumber')}
          testID="text-input-container"
          onChangeText={handlePhoneNumber}
          value={phoneNumber ?? ''}
          inputMode="numeric"
        />
      </View>
      {(!!phoneNumber || showError) && !isValidPhoneNumber && (
        <HelperText type="error" style={styles.phoneNumberHelperText}>
          {i18n.t('(auth).login.mobileNumberError')}
        </HelperText>
      )}
      <CountryList
        visible={showCountries}
        setVisible={setShowCountries}
        setCountry={setCountry}
        countries={countries}
      />
    </View>
  );
};

export default PhoneNumberInput;
