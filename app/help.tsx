import React, { useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from 'react-native';
import { defaultStyles, myAddressesStyles as styles } from '@/styles';
import { Appbar, Icon } from 'react-native-paper';
import {  useRouter } from 'expo-router';
import { Colors } from '@/constants';
import i18n from '@/i18n';

export default function Help() {
  const router = useRouter();

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

  const help = [
    {
      heading: i18n.t('help.getDirections.heading'),
      subheading: i18n.t('help.getDirections.subHeading'),
    },
    {
      heading: i18n.t('help.createAddress.heading'),
      subheading: i18n.t('help.createAddress.subHeading'),
    },
    {
      heading: i18n.t('help.shareAddress.heading'),
      subheading: i18n.t('help.shareAddress.subHeading'),
    },
    {
      heading: i18n.t('help.navigation.heading'),
      subheading: i18n.t('help.navigation.subHeading'),
    },
    {
      heading: i18n.t('help.sendFeedback.heading'),
      subheading: i18n.t('help.sendFeedback.subHeading'),
    },
  ];

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={24}>
        <View style={defaultStyles.flex}>
          <Appbar.Header
            dark={false}
            style={[defaultStyles.appHeader, styles.headerContainer]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={defaultStyles.backButtonContainer}>
              <Icon source={'arrow-left'} size={24} color={Colors.light[10]} />
            </TouchableOpacity>
            <View style={defaultStyles.headerTextContainer}>
              <Text style={[defaultStyles.headerText, styles.headerText]}>
                {i18n.t('help.help')}
              </Text>
            </View>
          </Appbar.Header>
          <ScrollView
            style={defaultStyles.scrollContainer}
            showsVerticalScrollIndicator={false}>
            <View
              style={[styles.contentContainer, defaultStyles.paddingBottom]}>
              {help.map((item, index) => {
                return (
                  <View style={styles.helpItemContainer} key={index}>
                    <Text style={styles.helpHeading}>{item.heading}</Text>
                    <Text style={styles.helpSubHeading}>{item.subheading}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
