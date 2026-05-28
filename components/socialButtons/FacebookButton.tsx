import { Image, Text, TouchableOpacity } from 'react-native';
import React, { useContext } from 'react';
import { loginStyles } from '@/styles';
import { Context, SessionContext } from '@/app/_layout';
import { useSocialLogin } from '@/hooks/users.hooks';
import { useSocialAuth } from '@/contexts/SocialAuthContext';
import { snackbarToast } from '@/utils/toastHelpter';
import {
  delay,
  isFacebookSDKInitialized,
  storeData,
  updateAuthHeader,
} from '@/utils';
import { router } from 'expo-router';
import i18n from '@/i18n';
import { AccessToken, LoginManager, Profile } from 'react-native-fbsdk-next';

const FacebookButton = () => {
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

  const getUserFBDataAndLogin = async () => {
    try {
      setSocialLoading(true);
      const currentProfile = await Profile.getCurrentProfile();
      if (!currentProfile) {
        snackbarToast('Error fetching Facebook profile', 'error');
        return;
      }
      await socialLogin({
        familyName: currentProfile?.firstName ?? '',
        givenName: currentProfile?.lastName ?? '',
        email: currentProfile?.email ?? '',
        name: currentProfile?.name ?? '',
        pictureUrl: currentProfile?.imageURL ?? '',
      });
    } catch {
      snackbarToast(
        'Error Loging in with google, Try Logging In with another method\nor Contact Jango Team',
        'error',
      );
    } finally {
      setSocialLoading(false);
    }
  };

  /* Trigger the below function on your custom button press */
  const loginWithFacebook = () => {
    // Check if Facebook SDK is initialized
    if (!isFacebookSDKInitialized()) {
      setSocialError('Facebook SDK not initialized. Please try again.');
      setTimeout(() => setSocialError(undefined), 5000);
      return;
    }

    LoginManager.logInWithPermissions(['public_profile', 'email']).then(
      function (result) {
        if (result.isCancelled) {
          // TODO: Handle error if necessary
        } else {
          AccessToken.getCurrentAccessToken().then(() => {
            getUserFBDataAndLogin();
          });
        }
      },
      function () {
        // TODO: Handle error if necessary
        setSocialError('Facebook login failed. Please try again.');
        setTimeout(() => setSocialError(undefined), 5000);
      },
    );
  };

  return (
    <TouchableOpacity
      style={loginStyles.socialButton}
      onPress={loginWithFacebook}>
      <Image
        source={require('@/assets/images/facebook.png')}
        style={loginStyles.socialLogo}
      />
      <Text style={loginStyles.socialText}>Facebook</Text>
    </TouchableOpacity>
  );
};

export default FacebookButton;
