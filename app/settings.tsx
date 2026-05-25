import { Colors } from '@/constants';
import {
  defaultStyles,
  drawerStyles,
  myAddressesStyles as styles,
} from '@/styles';
import { delay, readData, storeData, performLogout, triggerLogoutNavigation } from '@/utils';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { Appbar, Button, Dialog, Icon, Snackbar, TextInput } from 'react-native-paper';
import i18n from '../i18n';
import { Loader } from '@/components';
import { useDeleteAccount } from '@/hooks/users.hooks';
import { Context, ContextType } from './_layout';

const languages = [
  {
    label: '🇬🇧 ENG',
    value: 'en',
  },
  {
    label: '🇫🇷 FRA',
    value: 'fr',
  },
  {
    label: '🇵🇹 POR',
    value: 'pt',
  },
];

export default function Settings() {
  const router = useRouter();
  const [language, setLanguage] = useState(languages[0]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'password'>('confirm');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePin, setDeletePin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const { lang, setLang, user } = useContext(Context) as ContextType;
  const isPhoneOnly = !!user?.phone_number && !user?.email_address;

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

  useEffect(() => {
    const readLanguageFromStorage = async () => {
      const language = await readData('@lang');
      setLanguage(
        languages.find(lang => lang.value === language) ?? languages[0],
      );
    };
    readLanguageFromStorage();
  }, []);

  const handleDeleteAccount = async () => {
    try {
      setLoading(true);
      const body = isPhoneOnly
        ? { pincode: deletePin || undefined }
        : { password: deletePassword || undefined };
      await deleteAccount(body);
    } catch {
      // Error handled in onError
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteStep('confirm');
    setDeletePassword('');
    setDeletePin('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteStep('confirm');
    setDeletePassword('');
    setDeletePin('');
  };

  const { mutateAsync: deleteAccount } = useDeleteAccount(
    lang,
    async () => {
      setLoading(false);
      closeDeleteModal();
      await performLogout();
      triggerLogoutNavigation();
    },
    async error => {
      // setIsLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        setError(error?.response?.data?.message);
        await delay(5000);
        setError(undefined);
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        setError(error?.response?.data?.message[0]);
        await delay(5000);
        setError(undefined);
      } else {
        setError(i18n.t('(tabs).index.unknownError'));
        await delay(5000);
        setError(undefined);
      }
    },
  );

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={24}>
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
          }}>
          <View style={defaultStyles.flex}>
            <Appbar.Header
              dark={false}
              style={[defaultStyles.appHeader, styles.headerContainer]}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={defaultStyles.backButtonContainer}>
                <Icon
                  source={'arrow-left'}
                  size={24}
                  color={Colors.light[10]}
                />
              </TouchableOpacity>
              <View style={defaultStyles.headerTextContainer}>
                <Text style={[defaultStyles.headerText, styles.headerText]}>
                  {i18n.t('settings.settings')}
                </Text>
              </View>
            </Appbar.Header>
            <ScrollView
              style={defaultStyles.scrollContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled">
              <View style={defaultStyles.flex}>
                <View style={styles.settingsOptionContainer}>
                  <View style={styles.settingsOptionTopContent}>
                    <Text>{i18n.t('settings.language')}</Text>
                    <Dropdown
                      value={language}
                      data={languages}
                      style={styles.languageContainer}
                      onChange={async e => {
                        i18n.changeLanguage(e.value);
                        setLanguage(e.value);
                        setLang(e.value);
                        await storeData('@lang', e.value);
                      }}
                      maxHeight={256}
                      itemTextStyle={styles.languageText}
                      labelField="label"
                      valueField="value"
                      selectedTextStyle={styles.languageText}
                    />
                  </View>
                  <Text style={styles.settingsOptionSubtitleText}>
                    {i18n.t('settings.chooseALanguage')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.settingsOptionContainer,
                    styles.deleteAccountContainer,
                  ]}>
                  <View style={styles.settingsOptionTopContent}>
                    <Text style={defaultStyles.errorText}>
                      {i18n.t('settings.deleteAccount')}
                    </Text>
                    <TouchableOpacity onPress={openDeleteModal}>
                      <Icon source={'delete'} size={24} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={defaultStyles.errorDarkText}>
                    {i18n.t('settings.accountWillBe')}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <Dialog
        visible={showDeleteModal}
        onDismiss={closeDeleteModal}
        style={[defaultStyles.dialogContainer, styles.errorBorder]}>
        <Dialog.Content style={defaultStyles.dialogSubtitleContainer}>
          <View />
          <Text style={[drawerStyles.logoutHeadingText, styles.dialogTitle]}>
            {i18n.t('settings.deleteAccount')}
          </Text>
          <TouchableOpacity onPress={closeDeleteModal}>
            <Icon source="close" color={Colors.error} size={24} />
          </TouchableOpacity>
        </Dialog.Content>
        <Dialog.Content>
          {deleteStep === 'confirm' ? (
            <Text style={styles.dialogSubTitle}>
              {i18n.t('settings.areYouSure')}
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              <Text style={styles.dialogSubTitle}>
                {isPhoneOnly
                  ? i18n.t('(auth).sign-up.enterPinToConfirm')
                  : i18n.t('(auth).sign-up.enterPasswordToConfirm')}
              </Text>
              {isPhoneOnly ? (
                <TextInput
                  mode="outlined"
                  placeholder={i18n.t('(auth).login.pin')}
                  value={deletePin}
                  onChangeText={setDeletePin}
                  secureTextEntry={!showPin}
                  inputMode="numeric"
                  right={
                    <TextInput.Icon
                      icon={showPin ? 'eye-off-outline' : 'eye-outline'}
                      onPress={() => setShowPin(prev => !prev)}
                    />
                  }
                />
              ) : (
                <TextInput
                  mode="outlined"
                  placeholder={i18n.t('(auth).login.password')}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry={!showPassword}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      onPress={() => setShowPassword(prev => !prev)}
                    />
                  }
                />
              )}
            </View>
          )}
        </Dialog.Content>
        <Dialog.Actions style={defaultStyles.dialogActionContainer}>
          {deleteStep === 'confirm' ? (
            <>
              <Button
                mode="contained"
                textColor={Colors.light['10']}
                buttonColor={Colors.primary[500]}
                style={[defaultStyles.flexButton, defaultStyles.secondaryButton]}
                onPress={closeDeleteModal}
                labelStyle={[
                  defaultStyles.buttonText,
                  defaultStyles.secondaryButtonText,
                  defaultStyles.font14,
                ]}>
                {i18n.t('profile.no')}
              </Button>
              <Button
                mode="contained"
                textColor={Colors.light['10']}
                buttonColor={Colors.error}
                style={[defaultStyles.flexButton]}
                onPress={() => setDeleteStep('password')}
                labelStyle={[
                  defaultStyles.buttonText,
                  defaultStyles.gentiumText,
                  defaultStyles.font14,
                ]}>
                {i18n.t('settings.continue')}
              </Button>
            </>
          ) : (
            <>
              <Button
                mode="contained"
                textColor={Colors.light['10']}
                buttonColor={Colors.primary[500]}
                style={[defaultStyles.flexButton, defaultStyles.secondaryButton]}
                disabled={loading}
                onPress={() => setDeleteStep('confirm')}
                labelStyle={[
                  defaultStyles.buttonText,
                  defaultStyles.secondaryButtonText,
                  defaultStyles.font14,
                ]}>
                {i18n.t('profile.no')}
              </Button>
              <Button
                mode="contained"
                textColor={Colors.light['10']}
                buttonColor={Colors.error}
                style={[defaultStyles.flexButton]}
                onPress={handleDeleteAccount}
                loading={loading}
                disabled={
                  loading ||
                  (isPhoneOnly ? deletePin.length !== 5 : !deletePassword)
                }
                labelStyle={[
                  defaultStyles.buttonText,
                  defaultStyles.gentiumText,
                  defaultStyles.font14,
                ]}>
                {i18n.t('settings.deleteAccount')}
              </Button>
            </>
          )}
        </Dialog.Actions>
      </Dialog>
      <Snackbar
        visible={!!error}
        onDismiss={() => {}}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{error}</Text>
      </Snackbar>
      <Loader visible={loading} text={`${i18n.t('profile.pleaseWait')}...`} />
    </>
  );
}
