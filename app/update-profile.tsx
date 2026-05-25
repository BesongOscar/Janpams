import { Colors } from '@/constants';
import {
  defaultStyles,
  loginStyles,
  myAddressesStyles,
  signupStyles as styles,
} from '@/styles';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  Image,
  Animated,
  Alert,
  StyleSheet,
} from 'react-native';
import {
  Appbar,
  Button,
  Checkbox,
  HelperText,
  Icon,
  Snackbar,
  TextInput,
} from 'react-native-paper';
import { PhoneNumberInput } from '@/components';
import * as ImagePicker from 'expo-image-picker';
import { useGetUser, useUpdateProfile } from '@/hooks/users.hooks';
import { usersUpdateProfileRequest } from '@/interfaces';
import { delay, storeData, useCompressedImage } from '@/utils';
import { Context, ContextType } from './_layout';
import parsePhoneNumberFromString from 'libphonenumber-js';
import i18n from '@/i18n';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  const { user, setUser, lang } = useContext(Context) as ContextType;
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [middleName, setMiddleName] = useState(
    (
      (user?.first_middle_name ?? '') + user?.second_middle_name &&
      ' ' + (user?.second_middle_name ?? '')
    ).trim(),
  );
  const [email, setEmail] = useState(user?.email_address ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [countryCode, setCountryCode] = useState<string>('237');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [error, setError] = useState<string>();

  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset>();
  const [loading, setLoading] = useState(false);
  const [checkError, setCheckError] = useState(false);
  const [authType, setAuthType] = useState<'phone' | 'email'>('phone');
  // const [contentHeight, setContentHeight] = useState(240);

  const [checked, setChecked] = useState(false);

  const translateY = useRef(new Animated.Value(196)).current; // Starts off-screen

  const router = useRouter();

  const {
    compressImage,
    // loading: isCompressing,
    // error: compressionError,
  } = useCompressedImage(image?.uri ?? '');

  const openModal = () => {
    setModalVisible(true);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(translateY, {
      toValue: 196,
      duration: 500,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  const pickImage = async () => {
    // Request permission to access media library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        i18n.t('(auth).sign-up.permissionDenied'),
        i18n.t('(auth).sign-up.allowAccessToGalery'),
      );
      return;
    }

    // Open image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
    closeModal();
  };

  const takePhoto = async () => {
    // Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        i18n.t('(auth).sign-up.permissionDenied'),
        i18n.t('(auth).sign-up.allowAccessToCamera'),
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
    closeModal();
  };

  const handleUpdateProfile = async () => {
    try {
      setCheckError(true);
      if (
        firstName.length < 3 ||
        lastName.length < 3 ||
        (email && !emailRegex.test(email)) ||
        (email && username.length < 3) ||
        ((email || username) && !!password && password.length < 8) ||
        ((email || username) &&
          !user?.email_address &&
          password !== confirmPassword) ||
        ((email || username) &&
          user?.email_address &&
          !!confirmPassword &&
          confirmPassword.length < 8) ||
        (!!pin && pin.length !== 5) ||
        (!!confirmPin && confirmPin.length !== 5) ||
        (!!user?.email_address && user?.email_address !== email && !password) ||
        (user?.phone_number !== `${countryCode}${phoneNumber}` && !pin)
      )
        return;

      if (
        !checked &&
        !!phoneNumber &&
        user?.phone_number !== `${countryCode}${phoneNumber}`
      ) {
        setError(i18n.t('(auth).sign-up.pleaseCheck'));
        await delay(5000);
        setError(undefined);
        return;
      }
      setLoading(true);

      let imageUri = '';

      if (image?.uri) {
        imageUri = await compressImage();
      }

      const data: usersUpdateProfileRequest = {
        image: imageUri ?? undefined,
        first_name: firstName,
        middle_names: middleName,
        last_name: lastName,
        email_address: email !== user?.email_address ? email : undefined,
        phone_number: `${countryCode}${phoneNumber}`,
        username: username !== user?.username ? username : undefined,
        pincode: pin ?? undefined,
        new_pincode: confirmPin ?? undefined,
        password,
        new_password: confirmPassword ?? undefined,
      };

      await storeData('@update-profile-data', data);

      await updateProfile(data);
    } catch {
      // TODO: Handle error if necessary
    } finally {
      setLoading(false);
    }
  };

  const { mutateAsync: updateProfile } = useUpdateProfile(
    lang,
    () => {
      refetch();
      if (email !== user?.email_address) {
        router.push('/email-verification');
      } else {
        router.back();
      }
    },
    async error => {
      setLoading(false);
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
        setError(i18n.t('(auth).sign-up.unknownError'));
        await delay(5000);
        setError(undefined);
      }
    },
  );

  useEffect(() => {
    if (!modalVisible) {
      translateY.setValue(196); // Reset animation position when closed
    }
  }, [modalVisible]);

  useEffect(() => {
    if (user?.phone_number) {
      const parsedNumber = parsePhoneNumberFromString(user?.phone_number);
      setCountryCode(`+${parsedNumber?.countryCallingCode ?? '237'}`);
      setPhoneNumber(parsedNumber?.nationalNumber ?? '');
    }
  }, [user]);

  // Fetch the userData only when the userid exsits
  const { data: userData, refetch } = useGetUser(lang, !!user?.id);

  useEffect(() => {
    if (userData?.user) {
      setUser(userData?.user);
    }
  }, [userData]);

  return (
    <SafeAreaView edges={['bottom']} style={{flex:1}}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAwareScrollView
          style={customStyles.container}
          contentContainerStyle={customStyles.content}
          enableOnAndroid={true}
          extraScrollHeight={20}
          keyboardShouldPersistTaps="handled">
          <Appbar.Header
            dark={false}
            style={[
              defaultStyles.appHeader,
              myAddressesStyles.headerContainer,
            ]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={defaultStyles.backButtonContainer}>
              <Icon source={'arrow-left'} size={24} color={Colors.light[10]} />
            </TouchableOpacity>
            <View style={defaultStyles.headerTextContainer}>
              <Text
                style={[
                  defaultStyles.headerText,
                  myAddressesStyles.headerText,
                ]}>
                {i18n.t('(auth).sign-up.editProfile')}
              </Text>
            </View>
          </Appbar.Header>
          {/* <View style={defaultStyles.contentContainer}> */}
          <TouchableOpacity
            style={[styles.avatarContainer, { marginVertical: 12 }]}
            onPress={openModal}>
            {image ? (
              <Image source={{ uri: image.uri }} style={styles.profileImage} />
            ) : user?.image ? (
              <Image
                source={{ uri: user?.image }}
                style={styles.profileImage}
              />
            ) : (
              <Image
                source={require('@/assets/images/avatar.png')}
                resizeMode="contain"
                style={styles.avatar}
              />
            )}
            <TouchableOpacity
              style={styles.cameraContainer}
              onPress={openModal}>
              <Image source={require('@/assets/images/ic_camera.png')} />
            </TouchableOpacity>
          </TouchableOpacity>
          {/* <View
            style={[
              styles.inputsContainer,
              // myAddressesStyles.contentContainer,
            ]}> */}
          <TextInput
            mode="outlined"
            style={customStyles.input}
            outlineStyle={defaultStyles.outlineStyle}
            left={<TextInput.Icon icon={'account-outline'} />}
            placeholder={i18n.t('(auth).sign-up.firstName')}
            value={firstName}
            onChangeText={setFirstName}
          />
          {(!!firstName || checkError) && firstName.length < 3 && (
            <HelperText type="error">
              {i18n.t('(auth).sign-up.nameMustBe')}
            </HelperText>
          )}
          <TextInput
            mode="outlined"
            style={customStyles.input}
            outlineStyle={defaultStyles.outlineStyle}
            left={<TextInput.Icon icon={'account-outline'} />}
            placeholder={i18n.t('(auth).sign-up.middleName')}
            value={middleName}
            onChangeText={setMiddleName}
          />
          <TextInput
            mode="outlined"
            style={customStyles.input}
            outlineStyle={defaultStyles.outlineStyle}
            left={<TextInput.Icon icon={'account-outline'} />}
            placeholder={i18n.t('(auth).sign-up.lastName')}
            value={lastName}
            onChangeText={setLastName}
          />
          {(!!lastName || checkError) && lastName.length < 3 && (
            <HelperText type="error">
              {i18n.t('(auth).sign-up.nameMustBe')}
            </HelperText>
          )}
          {/* <Collapsible
            title={i18n.t('(auth).sign-up.authentication')}
            height={contentHeight}> */}
          {/* <View
              style={styles.collapsibleContent}
              onLayout={event => {
                setContentHeight(event.nativeEvent.layout.height);
              }}> */}
          <View style={customStyles.topNav}>
            <TouchableOpacity
              style={[
                loginStyles.navItem,
                authType === 'phone' && loginStyles.activeNavItem,
              ]}
              onPress={() => setAuthType('phone')}>
              <Text
                style={[
                  loginStyles.navText,
                  authType === 'phone' && loginStyles.activeNavText,
                ]}>
                {i18n.t('(auth).login.phone')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                loginStyles.navItem,
                authType === 'email' && loginStyles.activeNavItem,
              ]}
              onPress={() => setAuthType('email')}>
              <Text
                style={[
                  loginStyles.navText,
                  authType === 'email' && loginStyles.activeNavText,
                ]}>
                {i18n.t('(auth).login.email')}
              </Text>
            </TouchableOpacity>
          </View>
          {authType === 'phone' ? (
            <>
              {/* OTP Auth */}
              <View style={{ marginHorizontal: 20 }}>
                <PhoneNumberInput
                  countryCode={countryCode}
                  setCountryCode={setCountryCode}
                  phoneNumber={phoneNumber}
                  setPhoneNumber={setPhoneNumber}
                  showError={checkError}
                />
              </View>
              {/* <View style={styles.height46}> */}
              <TextInput
                mode="outlined"
                style={customStyles.input}
                outlineStyle={defaultStyles.outlineStyle}
                left={<TextInput.Icon icon={'lock-outline'} />}
                placeholder={
                  user?.phone_number
                    ? i18n.t('(auth).sign-up.oldPin')
                    : i18n.t('(auth).sign-up.createPin')
                }
                right={
                  <TextInput.Icon
                    icon={showPin ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setShowPin(prev => !prev)}
                  />
                }
                secureTextEntry={!showPin}
                inputMode="numeric"
                onChangeText={setPin}
              />
              {/* </View> */}
              {user?.phone_number !== `${countryCode}${phoneNumber}` &&
                !pin && (
                  <HelperText type="error">
                    {i18n.t(
                      '(auth).sign-up.pinCodeIsRequiredWhenChangingPhoneNumber',
                    )}
                  </HelperText>
                )}
              {(!!pin || checkError) && pin.length > 0 && pin.length !== 5 && (
                <HelperText type="error">
                  {i18n.t('(auth).sign-up.pinMustBe')}
                </HelperText>
              )}
              {/* <View style={styles.height46}> */}
              <TextInput
                mode="outlined"
                style={customStyles.input}
                outlineStyle={defaultStyles.outlineStyle}
                left={<TextInput.Icon icon={'lock-outline'} />}
                placeholder={
                  user?.phone_number
                    ? i18n.t('(auth).sign-up.newPin')
                    : i18n.t('(auth).sign-up.confirmPin')
                }
                right={
                  <TextInput.Icon
                    icon={showPin ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setShowPin(prev => !prev)}
                  />
                }
                secureTextEntry={!showPin}
                inputMode="numeric"
                onChangeText={setConfirmPin}
              />
              {/* </View> */}
              {!!pin &&
                (!!confirmPin || checkError) &&
                pin.length > 0 &&
                confirmPin.length !== 5 && (
                  <HelperText type="error">
                    {i18n.t('(auth).sign-up.pinMustBe')}
                  </HelperText>
                )}
            </>
          ) : (
            <>
              {/* Email auth */}
              {/* <View style={styles.height46}> */}
              <TextInput
                mode="outlined"
                style={customStyles.input}
                outlineStyle={defaultStyles.outlineStyle}
                left={<TextInput.Icon icon={'account-outline'} />}
                placeholder={i18n.t('(auth).sign-up.username')}
                value={username}
                editable={!user?.username}
                autoCapitalize="none"
                onChangeText={setUsername}
              />
              {/* </View> */}
              {username ? (
                username.length < 3 && (
                  <HelperText type="error">
                    {i18n.t('(auth).sign-up.usernameMustBe')}
                  </HelperText>
                )
              ) : email ? (
                <HelperText type="error">
                  {i18n.t('(auth).sign-up.usernameMustBeProvided')}
                </HelperText>
              ) : null}
              {/* <View style={styles.height46}> */}
              <TextInput
                mode="outlined"
                style={customStyles.input}
                outlineStyle={defaultStyles.outlineStyle}
                left={<TextInput.Icon icon={'email-outline'} />}
                placeholder={i18n.t('(auth).sign-up.email')}
                inputMode="email"
                // editable={!user?.email_address}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
              {/* </View> */}
              {!!email && !emailRegex.test(email) && (
                <HelperText type="error">
                  {i18n.t('(auth).sign-up.invalidEmail')}
                </HelperText>
              )}
              {/* <View style={styles.height46}> */}
              <TextInput
                mode="outlined"
                style={customStyles.input}
                outlineStyle={defaultStyles.outlineStyle}
                left={<TextInput.Icon icon={'lock-outline'} />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setShowPassword(prev => !prev)}
                  />
                }
                placeholder={
                  user?.email_address
                    ? i18n.t('(auth).sign-up.oldPassword')
                    : i18n.t('(auth).sign-up.createPassword')
                }
                secureTextEntry={!showPassword}
                onChangeText={setPassword}
                error={!!password && password.length < 8}
              />
              {/* </View> */}
              {!!user?.email_address &&
                user?.email_address !== email &&
                !password && (
                  <HelperText type="error">
                    {i18n.t(
                      '(auth).sign-up.passwordIsRequiredWhenChangingEmail',
                    )}
                  </HelperText>
                )}
              {password
                ? password.length < 8 && (
                    <HelperText type="error">
                      {i18n.t('(auth).sign-up.passwordShouldBe')}
                    </HelperText>
                  )
                : (!!username || !!email) &&
                  !user?.email_address &&
                  !user?.username && (
                    <HelperText type="error">
                      {i18n.t('(auth).sign-up.aPasswordMustBe')}
                    </HelperText>
                  )}
              {/* <View style={styles.height46}> */}
              <TextInput
                mode="outlined"
                style={customStyles.input}
                outlineStyle={defaultStyles.outlineStyle}
                left={<TextInput.Icon icon={'lock-outline'} />}
                placeholder={
                  user?.email_address
                    ? i18n.t('(auth).sign-up.newPassword')
                    : i18n.t('(auth).sign-up.confirmPassword')
                }
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setShowPassword(prev => !prev)}
                  />
                }
                secureTextEntry={!showPassword}
                onChangeText={setConfirmPassword}
                error={!!confirmPassword}
              />
              {/* </View> */}
              {!!confirmPassword &&
                checkError &&
                (user?.email_address
                  ? confirmPassword.length < 8 && (
                      <HelperText type="error">
                        {i18n.t('(auth).sign-up.passwordShouldBe')}
                      </HelperText>
                    )
                  : confirmPassword !== password && (
                      <HelperText type="error">
                        {i18n.t('(auth).sign-up.passwordsDoNot')}
                      </HelperText>
                    ))}
            </>
          )}
          {/* </View> */}
          {/* </Collapsible> */}
          {/* </View> */}
          {/* </View> */}
          {/* Fixed bottom button */}
          <View style={customStyles.footer}>
            {!!phoneNumber &&
              user?.phone_number !== `${countryCode}${phoneNumber}` && (
                <View style={defaultStyles.checkboxContainer}>
                  <Checkbox.Android
                    status={checked ? 'checked' : 'unchecked'}
                    onPress={() => setChecked(prev => !prev)}
                    color={Colors.primary[500]}
                  />
                  <Text style={defaultStyles.checkboxText}>
                    {i18n.t('(auth).sign-up.privacyPolicyUpdateProfile')}
                  </Text>
                </View>
              )}
            <Button
              mode="contained"
              buttonColor={Colors.primary['500']}
              style={defaultStyles.button}
              disabled={loading}
              loading={loading}
              onPress={handleUpdateProfile}>
              <Text style={defaultStyles.buttonText}>
                {i18n.t('(auth).sign-up.update')}
              </Text>
            </Button>
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
      {modalVisible && (
        <Animated.View
          style={[styles.modal, { transform: [{ translateY }] }]}
          pointerEvents="box-none"
          // {...panResponder.panHandlers} // Attach pan gesture
        >
          <View style={styles.nodge} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {i18n.t('(auth).sign-up.uploadPhoto')}
            </Text>
            <View style={styles.uploadOptionsContainer}>
              <View pointerEvents="box-none">
                <TouchableOpacity
                  style={styles.uploadOption}
                  onPress={pickImage}>
                  <Icon source={'text-box-multiple-outline'} size={20} />
                  <Text style={styles.uploadOptionText}>
                    {i18n.t('(auth).sign-up.viewPhotoLibrary')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View pointerEvents="box-none">
                <TouchableOpacity
                  style={styles.uploadOption}
                  onPress={takePhoto}>
                  <Icon source={'image-outline'} size={20} />
                  <Text style={styles.uploadOptionText}>
                    {i18n.t('(auth).sign-up.takeAPhoto')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      )}
      <Snackbar
        visible={!!error}
        onDismiss={() => {}}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{error}</Text>
      </Snackbar>
    </SafeAreaView>
  );
}

const customStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    color: '#333',
  },
  footer: {
    marginTop: 'auto', // pushes button to bottom
    paddingVertical: 20,
    marginHorizontal: 20,
    gap: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    height: 46,
    backgroundColor: Colors.light['10'],
    borderBottomWidth: 0,
    fontSize: 14,
    overflow: 'hidden',
    marginTop: 5,
    marginHorizontal: 20,
  },
  topNav: {
    marginVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
});
