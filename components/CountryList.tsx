import React, {
  Dispatch,
  FC,
  SetStateAction,
  useEffect,
  useState,
} from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors, countries as allCountries } from '@/constants';
import { phoneNumberInputStyles as styles } from '@/styles';
import { Icon, Text } from 'react-native-paper';
import { Country } from '@/interfaces';
import i18n from '@/i18n';

interface Props {
  setCountry: Dispatch<SetStateAction<Country | undefined>>;
  visible: boolean;
  setVisible: Dispatch<SetStateAction<boolean>>;
  onRequestClose?: () => void;
  countries?: Country[] | undefined;
}

const CountryList: FC<Props> = ({
  setCountry,
  visible,
  setVisible,
  onRequestClose,
  countries = allCountries,
}) => {
  const [countryName, setCountryName] = useState<string>();
  const [filteredCountryList, setFiltedCountryList] = useState(countries);

  useEffect(() => {
    if (countryName?.length) {
      const filtered = countries.filter(country =>
        country.name.toLowerCase().includes(countryName.trim().toLowerCase()),
      );
      setFiltedCountryList(filtered);
    } else {
      // When countryName is empty, show all countries
      setFiltedCountryList(countries);
    }
  }, [countryName, countries]);

  return (
    <Modal
      animationType="slide"
      visible={visible}
      testID="countryModal"
      onRequestClose={onRequestClose}>
      <View style={styles.backgroundDark}>
        <SafeAreaView>
          <View style={styles.modalContainer}>
            <View style={styles.searchcontainer}>
              <TouchableOpacity
                onPress={() => {
                  setVisible(false);
                  setCountryName(undefined);
                }}>
                <Icon size={24} color={Colors.dark[0]} source={'close'} />
              </TouchableOpacity>
              <TextInput
                style={styles.searchInput}
                placeholder={i18n.t('(auth).login.enterCountryName')}
                placeholderTextColor={Colors.grey['77']}
                onChangeText={setCountryName}
              />
            </View>
            <FlatList
              data={filteredCountryList}
              keyExtractor={item => item.code}
              testID="country-flatlist"
              renderItem={item => {
                return (
                  <View style={styles.countryItem}>
                    <TouchableOpacity
                      style={styles.texts}
                      onPress={() => {
                        setCountry(item.item);
                        setVisible(false);
                        setCountryName(undefined);
                      }}>
                      <Text style={styles.emoji}>{item.item.emoji}</Text>
                      <Text style={styles.countryName}>{item.item.name}</Text>
                      <Text style={styles.countryName}>
                        ({item.item.dial_code})
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default CountryList;
