import { Colors } from '@/constants';
import { defaultStyles, loginStyles as styles } from '@/styles';
import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Button, Snackbar, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Loader, PhoneNumberInput } from '@/components';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { delay, updateAuthHeader } from '@/utils';
import {
  getLoginAttempts,
  saveLoginAttempts,
  clearLoginAttempts,
  getLockoutError,
  applyFailedAttempt,
  type LoginAttempt,
} from '@/utils/loginAttempts';
import { syncRolesFromBackend } from '@/lib/rolesSync';
import { getSupabase } from '@/lib/supabase/client';
import { mapSupabaseUser } from '@/lib/supabase/mapSupabaseUser';
import { Context, ContextType } from '../_layout';
import i18n from '../../i18n';
import FacebookButton from '@/components/socialButtons/FacebookButton';
import GoogleButton from '@/components/socialButtons/GoogleButton';
import { snackbarToast } from '@/utils/toastHelpter';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loginType, setLoginType] = useState<'phone' | 'email'>('phone');
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneNumberValid, setIsPhoneNumberValid] = useState(false);

  const [email, setEmail] = useState<string>();
  const [password, setPassword] = useState<string>();
  const [pin, setPin] = useState<string>();
  const [error, setError] = useState<string>();

  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttemptsState] = useState<LoginAttempt | null>(null);

  const { setUser, lang, socialError, socialLoading } = useContext(
    Context,
  ) as ContextType;

  const isLocked =
    loginAttempts != null &&
    loginAttempts.lockedUntil != null &&
    Date.now() < loginAttempts.lockedUntil;
  const lockoutMessage =
    isLocked && loginAttempts?.lockedUntil
      ? `Try again in ${Math.ceil((loginAttempts.lockedUntil - Date.now()) / 60000)} minute(s).`
      : null;

  useEffect(() => {
    getLoginAttempts().then(setLoginAttemptsState);
  }, []);
  useEffect(() => {
    if (!isLocked) return;
    const t = setInterval(() => getLoginAttempts().then(setLoginAttemptsState), 60_000);
    return () => clearInterval(t);
  }, [isLocked]);

  const handleLogin = async () => {
    let attempts = await getLoginAttempts();
    if (attempts.lockedUntil != null && Date.now() >= attempts.lockedUntil) {
      attempts = { count: 0, lockedUntil: null };
      await saveLoginAttempts(attempts);
      setLoginAttemptsState(attempts);
    }
    const lockErr = getLockoutError(attempts);
    if (lockErr) {
      setError(lockErr);
      setLoginAttemptsState(attempts);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      snackbarToast(
        'Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or PUBLISHABLE_KEY) in .env, then restart the app.',
        'error',
      );
      return;
    }

    setLoading(true);
    try {
      const identifier =
        loginType === 'email' ? (email ?? '').trim() : `${countryCode}${phoneNumber}`;
      const passwordOrPin = loginType === 'email' ? (password ?? '') : (pin ?? '');

      if (!identifier || !passwordOrPin) {
        snackbarToast(loginType === 'email' ? 'Enter email and password' : 'Enter phone and PIN', 'error');
        setLoading(false);
        return;
      }

      const { data, error: signInError } =
        loginType === 'email'
          ? await supabase.auth.signInWithPassword({ email: identifier, password: passwordOrPin })
          : await supabase.auth.signInWithPassword({ phone: identifier, password: passwordOrPin });

      if (signInError) {
        const isInvalidCreds =
          signInError.message?.toLowerCase().includes('invalid') ||
          signInError.message?.toLowerCase().includes('credentials') ||
          signInError.status === 400;
        if (isInvalidCreds) {
          const next = await getLoginAttempts();
          const { next: after, errorMessage } = applyFailedAttempt(next);
          await saveLoginAttempts(after);
          setLoginAttemptsState(after);
          snackbarToast(errorMessage, 'error');
          setError(errorMessage);
        } else {
          snackbarToast(signInError.message ?? 'Login failed', 'error');
          setError(signInError.message ?? 'Login failed');
        }
        await delay(5000);
        setError(undefined);
        setLoading(false);
        return;
      }

      if (data?.session?.user) {
        await clearLoginAttempts();
        setLoginAttemptsState({ count: 0, lockedUntil: null });
        const appUser = mapSupabaseUser(data.session.user);
        setUser(appUser);
        updateAuthHeader(data.session.access_token ?? '');
        await syncRolesFromBackend(data.session.user.id);
        router.replace('/(tabs)');
      } else {
        snackbarToast('Error logging in', 'error');
      }
    } catch (err) {
      console.warn({ err }, 'error from login');
      snackbarToast(err instanceof Error ? err.message : 'An error occurred', 'error');
      setError('An error occurred');
      await delay(5000);
      setError(undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const parsedNumber = parsePhoneNumberFromString(
      `${countryCode}${phoneNumber}`,
    );
    setIsPhoneNumberValid(!!parsedNumber?.isValid());
  }, [phoneNumber, countryCode]);

  return (
    <SafeAreaView style={defaultStyles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={defaultStyles.container}
        behavior="padding"
        keyboardVerticalOffset={24}
        >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <ScrollView
            style={defaultStyles.scrollContainer}
            contentContainerStyle={[defaultStyles.contentContainer, { flexGrow: 1, justifyContent: 'flex-end' }]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled">
            <View style={styles.appIconContainer}>
              <Image source={require('@/assets/images/jango_icon.png')} />
              <View
                style={[
                  defaultStyles.headerTextContainer,
                  styles.marginTop26,
                  styles.marginRight0,
                ]}>
                <Text style={defaultStyles.headerText}>
                  {i18n.t('(auth).login.welcome')}
                </Text>
              </View>
            </View>
            <View style={styles.illustratorImageContainer}>
              <Image
                source={require('@/assets/images/login_illustration.png')}
                style={styles.illustrationImage}
              />
            </View>
            <View style={styles.topNav}>
              <TouchableOpacity
                style={[
                  styles.navItem,
                  loginType === 'phone' && styles.activeNavItem,
                ]}
                onPress={() => setLoginType('phone')}>
                <Text
                  style={[
                    styles.navText,
                    loginType === 'phone' && styles.activeNavText,
                  ]}>
                  {i18n.t('(auth).login.phone')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.navItem,
                  loginType === 'email' && styles.activeNavItem,
                ]}
                onPress={() => setLoginType('email')}>
                <Text
                  style={[
                    styles.navText,
                    loginType === 'email' && styles.activeNavText,
                  ]}>
                  {i18n.t('(auth).login.email')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputsContainer}>
              {loginType === 'email' ? (
                <>
                  <TextInput
                    mode="outlined"
                    outlineStyle={defaultStyles.outlineStyle}
                    style={defaultStyles.input}
                    left={<TextInput.Icon icon={'email-outline'} />}
                    placeholder={i18n.t('(auth).login.emailOrUsername')}
                    inputMode="email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.forgotContainer}
                    onPress={() => router.push('/forgot-password')}>
                    <Text style={styles.forgotText}>
                      {i18n.t('(auth).login.forgotPassword')}?
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    mode="outlined"
                    outlineStyle={defaultStyles.outlineStyle}
                    style={defaultStyles.input}
                    left={<TextInput.Icon icon={'lock-outline'} />}
                    right={
                      <TextInput.Icon
                        icon={
                          showPassword ? 'eye-off-outline' : 'eye-outline'
                        }
                        onPress={() => setShowPassword(prev => !prev)}
                      />
                    }
                    placeholder={i18n.t('(auth).login.password')}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                </>
              ) : (
                <>
                  <PhoneNumberInput
                    countryCode={countryCode}
                    setCountryCode={setCountryCode}
                    phoneNumber={phoneNumber}
                    setPhoneNumber={setPhoneNumber}
                  />

                  <TouchableOpacity
                    style={styles.forgotContainer}
                    onPress={() => router.push('/forgot-pin')}>
                    <Text style={styles.forgotText}>
                      {i18n.t('(auth).login.forgotPin')}?
                    </Text>
                  </TouchableOpacity>

                  <TextInput
                    mode="outlined"
                    outlineStyle={defaultStyles.outlineStyle}
                    style={defaultStyles.input}
                    left={<TextInput.Icon icon={'lock-outline'} />}
                    placeholder={i18n.t('(auth).login.pin')}
                    right={
                      <TextInput.Icon
                        icon={showPin ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setShowPin(prev => !prev)}
                      />
                    }
                    secureTextEntry={!showPin}
                    inputMode="numeric"
                    value={pin}
                    onChangeText={setPin}
                  />
                </>
              )}
            </View>
            <View style={{ paddingTop: 16, rowGap: 10}}>
              {lockoutMessage ? (
                <Text style={[defaultStyles.errorText, { paddingVertical: 8 }]}>
                  Too many failed attempts. {lockoutMessage}
                </Text>
              ) : null}
              <Button
                mode="contained"
                buttonColor={Colors.primary['500']}
                style={defaultStyles.button}
                loading={loading}
                disabled={
                  loading ||
                  isLocked ||
                  (loginType === 'email' && (!email || !password)) ||
                  (loginType === 'phone' && (!isPhoneNumberValid || !pin))
                }
                onPress={handleLogin}>
                <Text style={defaultStyles.buttonText}>
                  {i18n.t('(auth).login.login')}
                </Text>
              </Button>
              <View style={styles.socialContainer}>
                <View style={styles.line} />
                <Text style={styles.socialText}>
                  {i18n.t('(auth).login.continueWithGoogleOrFacebook')}
                </Text>
                <View style={styles.line} />
              </View>
              <View style={styles.socialsButtonContainer}>
                <FacebookButton />
                <GoogleButton />
              </View>
              <View style={styles.bottomLinkContainer}>
                <Text>{i18n.t('(auth).login.dontHave')}?</Text>
                <TouchableOpacity onPress={() => router.push('/signup')}>
                  <Text style={styles.linkText}>{i18n.t('(auth).login.signup')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <Loader
        visible={socialLoading || loading}
        text={i18n.t('(auth).login.pleaseWait')}
      />
      <Snackbar
        visible={!!socialError || !!error}
        onDismiss={() => {}}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{socialError || error}</Text>
      </Snackbar>
    </SafeAreaView>
  );
}
