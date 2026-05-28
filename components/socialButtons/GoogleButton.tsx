import { Image, Text, TouchableOpacity } from 'react-native';
import React, { useContext } from 'react';
import { loginStyles } from '@/styles';
import { Context, SessionContext } from '@/app/_layout';
import { useSocialLogin } from '@/hooks/users.hooks';
import { useSocialAuth } from '@/contexts/SocialAuthContext';
import { snackbarToast } from '@/utils/toastHelpter';
import { delay, storeData, updateAuthHeader } from '@/utils';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';
import i18n from '@/i18n';

const GoogleButton = () => {
  const { setUser, lang } = useContext(Context)!;
  const sessionCtx = useContext(SessionContext);
  const { setSocialLoading, setSocialError } = useSocialAuth();
  const setIsLoggedIn = sessionCtx?.setIsLoggedIn ?? (() => {});

  const { mutateAsync: socialLogin } = useSocialLogin(
    lang,
    async data => {
      const user = data?.user;
      const accessToken = data?.access_token;
      const refreshToken = data?.refresh_token;
      if (user && accessToken && refreshToken) {
        setIsLoggedIn(true);
        updateAuthHeader(accessToken ?? '');
        await storeData('@userId', user?.id);
        await storeData('@refreshToken', refreshToken ?? '');
        router.replace('/(tabs)');
        setUser(data?.user);
      } else {
        snackbarToast(data?.message ?? 'Error Loging in with google', 'error');
      }
    },
    async error => {
      setSocialLoading(false);
      if (typeof error?.response?.data?.message === 'string') {
        setSocialError(error?.response?.data?.message);
        await delay(5000);
        setSocialError(undefined);
      } else if (
        Array.isArray(error?.response?.data?.message) &&
        typeof error?.response?.data?.message[0] === 'string'
      ) {
        setSocialError(error?.response?.data?.message[0]);
        await delay(5000);
        setSocialError(undefined);
      } else {
        setSocialError(i18n.t('(auth).login.unknownError'));
        await delay(5000);
        setSocialError(undefined);
      }
    },
  );
  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      setSocialLoading(true);
      const userInfo = await GoogleSignin.signIn();
      if (userInfo.data) {
        const user = userInfo.data.user;
        await socialLogin({
          familyName: user.familyName ?? '',
          givenName: user.givenName ?? '',
          email: user.email ?? '',
          name: user.name ?? '',
          pictureUrl: user.photo ?? '',
        });
      } else {
        snackbarToast('Error Loging in with google', 'error');
      }
    } catch (error) {
      console.log('Google Sign-In Error:', error);
      snackbarToast(
        'Error Loging in with google, Try Logging In with another method\nor Contact Jango Team',
        'error',
      );
      // TODO: Handle error if necessary
    } finally {
      setSocialLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={loginStyles.socialButton}
      onPress={handleGoogleSignIn}>
      <Image
        source={require('@/assets/images/google.png')}
        style={loginStyles.socialLogo}
      />
      <Text style={loginStyles.socialText}>Google</Text>
    </TouchableOpacity>
  );
};

export default GoogleButton;
