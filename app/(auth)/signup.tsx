import { Colors } from '@/constants';
import { defaultStyles, signupStyles as styles } from '@/styles';
import { useRouter } from 'expo-router';
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  // PanResponder,
  Alert,
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
import { delay, useCompressedImage, updateAuthHeader } from '@/utils';
import { syncRolesFromBackend } from '@/lib/rolesSync';
import { getSupabase } from '@/lib/supabase/client';
import { mapSupabaseUser } from '@/lib/supabase/mapSupabaseUser';
import { Context, ContextType } from '../_layout';
import i18n from '../../i18n';
import { SafeAreaView } from 'react-native-safe-area-context';
import { snackbarToast } from '@/utils/toastHelpter';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
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

  const [checked, setChecked] = useState(false);

  const translateY = useRef(new Animated.Value(196)).current; // Starts off-screen

  const router = useRouter();

  const { setUser, lang } = useContext(Context) as ContextType;

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

  // Gesture handler for swipe down to close
  // const panResponder = useRef(
  //   PanResponder.create({
  //     onStartShouldSetPanResponder: () => true,
  //     onMoveShouldSetPanResponder: () => true,
  //     onPanResponderMove: (_, gestureState) => {
  //       if (gestureState.dy > 0) {
  //         // Move modal downwards
  //         translateY.setValue(gestureState.dy);
  //       }
  //     },
  //     onPanResponderRelease: (_, gestureState) => {
  //       if (gestureState.dy > 100) {
  //         // If swiped down enough, close modal
  //         closeModal();
  //       } else {
  //         // If not, snap back to position
  //         Animated.timing(translateY, {
  //           toValue: 0,
  //           duration: 200,
  //           useNativeDriver: true,
  //         }).start();
  //       }
  //     },
  //   }),
  // ).current;

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

  const handleSignup = async () => {
    try {
      setCheckError(true);
      if (
        !phoneNumber ||
        !pin ||
        ((!!email || !!username) && !password) ||
        (!!email && !username) ||
        !firstName ||
        firstName?.length < 3 ||
        !lastName ||
        lastName.length < 3
      )
        return;
      // if (!image) {
      //   Alert.alert('No image selected', 'Please pick an image first.');
      //   return;
      // }

      let imageUri = '';

      if (image?.uri) {
        imageUri = await compressImage();
      }

      if (!checked && !!phoneNumber) {
        setError(i18n.t('(auth).sign-up.pleaseCheck'));
        await delay(5000);
        setError(undefined);
        return;
      }
      setLoading(true);

      const supabase = getSupabase();
      if (!supabase) {
        snackbarToast(
          'Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or PUBLISHABLE_KEY) in .env, then restart the app.',
          'error',
        );
        setLoading(false);
        return;
      }

      const phone = `${countryCode}${phoneNumber}`;
      const isEmailSignup = !!email?.trim();
      const passwordOrPin = isEmailSignup ? (password ?? '') : pin;

      if (isEmailSignup) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email!.trim(),
          password: passwordOrPin,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              middle_names: middleName || undefined,
              profile_image: imageUri || undefined,
            },
          },
        });

        if (signUpError) {
          const msg =
            signUpError.message?.toLowerCase().includes('already registered') ||
            signUpError.message?.toLowerCase().includes('already been registered')
              ? i18n.t('(auth).sign-up.unknownError')
              : signUpError.message;
          setError(msg);
          await delay(5000);
          setError(undefined);
          setLoading(false);
          return;
        }

        if (!signUpData.user) {
          setError(i18n.t('(auth).sign-up.unknownError'));
          setLoading(false);
          return;
        }

        setUser(mapSupabaseUser(signUpData.user));
        router.push('/phone-number-verification');
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          phone,
          password: passwordOrPin,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              middle_names: middleName || undefined,
              profile_image: imageUri || undefined,
            },
          },
        });

        if (signUpError) {
          const msg =
            signUpError.message?.toLowerCase().includes('already registered') ||
            signUpError.message?.toLowerCase().includes('already been registered')
              ? i18n.t('(auth).sign-up.unknownError')
              : signUpError.message;
          setError(msg);
          await delay(5000);
          setError(undefined);
          setLoading(false);
          return;
        }

        if (!signUpData.user) {
          setError(i18n.t('(auth).sign-up.unknownError'));
          setLoading(false);
          return;
        }

        setUser(mapSupabaseUser(signUpData.user));

        await supabase.from('user_roles').insert({ user_id: signUpData.user.id, role: 'basic_user' }).then(() => {}).catch(() => {});

        if (signUpData.session) {
          updateAuthHeader(signUpData.session.access_token);
          await syncRolesFromBackend(signUpData.user.id).catch(() => {});
          router.replace('/(tabs)');
        } else {
          router.push('/phone-number-verification');
        }
      }
    } catch (err) {
      console.warn('[Signup] signup failed:', err);
      setError(err instanceof Error ? err.message : i18n.t('(auth).sign-up.unknownError'));
      await delay(5000);
      setError(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!modalVisible) {
      translateY.setValue(196); // Reset animation position when closed
    }
  }, [modalVisible]);

  return (
    <SafeAreaView edges={['bottom']} style={{flex:1}}>
      <KeyboardAvoidingView
        style={defaultStyles.container}
        behavior="padding"
        keyboardVerticalOffset={24}>
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            if (modalVisible) closeModal();
          }}>
          <View style={defaultStyles.flex}>
            <Appbar.Header dark={false} style={defaultStyles.appHeader}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={defaultStyles.backButtonContainer}>
                <Icon source={'arrow-left'} size={24} />
              </TouchableOpacity>
              <View style={defaultStyles.headerTextContainer}>
                <Text style={defaultStyles.headerText}>
                  {i18n.t('(auth).sign-up.createAccount')}
                </Text>
              </View>
            </Appbar.Header>
            <ScrollView
              style={defaultStyles.scrollContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled">
              <View style={defaultStyles.contentContainer}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={openModal}
                  // onPress={takePhoto}
                >
                  {image ? (
                    <Image
                      source={{ uri: image.uri }}
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
                <View style={styles.inputsContainer}>
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'account-outline'} />}
                    placeholder={i18n.t('(auth).sign-up.firstName')}
                    onChangeText={setFirstName}
                  />
                  {(!!firstName || checkError) && firstName.length < 3 && (
                    <HelperText type="error">
                      {i18n.t('(auth).sign-up.nameMustBe')}
                    </HelperText>
                  )}
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'account-outline'} />}
                    placeholder={i18n.t('(auth).sign-up.middleName')}
                    onChangeText={setMiddleName}
                  />
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'account-outline'} />}
                    placeholder={i18n.t('(auth).sign-up.lastName')}
                    onChangeText={setLastName}
                  />
                  {(!!lastName || checkError) && lastName.length < 3 && (
                    <HelperText type="error">
                      {i18n.t('(auth).sign-up.nameMustBe')}
                    </HelperText>
                  )}
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'account-outline'} />}
                    placeholder={i18n.t('(auth).sign-up.username')}
                    autoCapitalize="none"
                    onChangeText={setUsername}
                  />
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
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'email-outline'} />}
                    placeholder={i18n.t('(auth).sign-up.email')}
                    inputMode="email"
                    onChangeText={setEmail}
                    autoCapitalize="none"
                  />
                  {!!email && !emailRegex.test(email) && (
                    <HelperText type="error">
                      {i18n.t('(auth).sign-up.invalidEmail')}
                    </HelperText>
                  )}
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'lock-outline'} />}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setShowPassword(prev => !prev)}
                      />
                    }
                    placeholder={i18n.t('(auth).sign-up.createPassword')}
                    secureTextEntry={!showPassword}
                    onChangeText={setPassword}
                    error={!!password && password.length < 8}
                  />
                  {password
                    ? password.length < 8 && (
                        <HelperText type="error">
                          {i18n.t('(auth).sign-up.passwordShouldBe')}
                        </HelperText>
                      )
                    : (username || email) && (
                        <HelperText type="error">
                          {i18n.t('(auth).sign-up.aPasswordMustBe')}
                        </HelperText>
                      )}
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'lock-outline'} />}
                    placeholder={i18n.t('(auth).sign-up.confirmPassword')}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setShowPassword(prev => !prev)}
                      />
                    }
                    secureTextEntry={!showPassword}
                    onChangeText={setConfirmPassword}
                    error={
                      !!confirmPassword &&
                      !!password &&
                      password != confirmPassword
                    }
                  />
                  {(!!confirmPassword || checkError) &&
                    !!password &&
                    password != confirmPassword && (
                      <HelperText type="error">
                        {i18n.t('(auth).sign-up.passwordsDoNot')}
                      </HelperText>
                    )}
                  <PhoneNumberInput
                    countryCode={countryCode}
                    setCountryCode={setCountryCode}
                    phoneNumber={phoneNumber}
                    setPhoneNumber={setPhoneNumber}
                    showError={checkError}
                  />
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'lock-outline'} />}
                    placeholder={i18n.t('(auth).sign-up.createPin')}
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
                  {(!!pin || checkError) && pin.length !== 5 && (
                    <HelperText type="error">
                      {i18n.t('(auth).sign-up.pinMustBe')}
                    </HelperText>
                  )}
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'lock-outline'} />}
                    placeholder={i18n.t('(auth).sign-up.confirmPin')}
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
                  {!!pin &&
                    (!!confirmPin || checkError) &&
                    pin != confirmPin && (
                      <HelperText type="error">
                        {i18n.t('(auth).sign-up.pinsDoNot')}
                      </HelperText>
                    )}
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <View style={defaultStyles.bottomContainerWithContent}>
        {!!phoneNumber && (
          <View style={defaultStyles.checkboxContainer}>
            <Checkbox.Android
              status={checked ? 'checked' : 'unchecked'}
              onPress={() => setChecked(prev => !prev)}
              color={Colors.primary[500]}
            />
            <Text
              style={[
                defaultStyles.checkboxText,
                !checked && { color: Colors.error },
              ]}>
              {i18n.t('(auth).sign-up.privacyPolicy')}
            </Text>
          </View>
        )}
        <Button
          mode="contained"
          buttonColor={Colors.primary['500']}
          style={defaultStyles.button}
          disabled={loading}
          loading={loading}
          onPress={handleSignup}>
          <Text style={defaultStyles.buttonText}>
            {i18n.t('(auth).sign-up.createAccount')}
          </Text>
        </Button>
      </View>
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
