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
} from 'react-native';
import { Appbar, Button, Icon, Snackbar } from 'react-native-paper';
import { OtpInput, OtpInputRef } from 'react-native-otp-entry';
import { Context, ContextType } from './_layout';
import { delay, readData } from '@/utils';
import { useGetUser, useUpdateProfile } from '@/hooks/users.hooks';
import i18n from './../i18n';
import { usersUpdateProfileRequest } from '@/interfaces';

export default function PhoneNumberVerificationPinReset() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<usersUpdateProfileRequest>();

  const { setUser, user, lang } = useContext(Context) as ContextType;

  const otpInputRef = useRef<OtpInputRef>(null);

  const router = useRouter();

  useEffect(() => {
    const getUpdateProfileData = async () => {
      const data = await readData('@update-profile-data');
      setData(data as usersUpdateProfileRequest);
    };
    getUpdateProfileData();
  }, []);

  const handleResendOtp = async () => {
    try {
      setLoading(true);
      await updateProfile(data as usersUpdateProfileRequest);
    } catch {
      //  TODO: Handle error if necessary
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    try {
      setLoading(true);
      await updateProfile({
        ...data,
        code: code,
      });
      const changingEmail =
        user?.email_address !== data?.email_address && !!user?.email_address;

      if (changingEmail) {
        router.push('/new-email-verification');
      } else {
        router.push('/profile');
      }
    } catch {
      // TODO: Handle error if necessary
    } finally {
      setLoading(false);
    }
  };

  const { mutateAsync: updateProfile } = useUpdateProfile(
    lang,
    async () => {
      await refetch();
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

  // Fetch the userData only when the userid exsits
  const { data: userData, refetch } = useGetUser(lang, !!user?.id);

  useEffect(() => {
    if (userData?.user) {
      setUser(userData?.user);
    }
  }, [userData]);

  return (
    <>
      <KeyboardAvoidingView
        style={defaultStyles.container}
        behavior="padding"
        keyboardVerticalOffset={24}>
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={defaultStyles.flex}>
            <Appbar.Header dark={false} style={defaultStyles.appHeader}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={defaultStyles.backButtonContainer}>
                <Icon source={'arrow-left'} size={24} />
              </TouchableOpacity>
              <View style={defaultStyles.headerTextContainer}>
                <Text style={defaultStyles.headerText}>
                  {i18n.t('(auth).email-verification.emailVerification')}
                </Text>
              </View>
            </Appbar.Header>
            <View style={styles.haderTextContainer}>
              <Text style={styles.headerText}>
                {i18n.t('(auth).email-verification.enterVerificationCode')}{' '}
                <Text style={styles.phoneNumberText}>
                  {user?.email_address}
                </Text>
              </Text>
            </View>
            <ScrollView
              style={defaultStyles.scrollContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled">
              <View style={defaultStyles.contentContainer}>
                <View style={styles.inputsContainer}>
                  <OtpInput
                    ref={otpInputRef}
                    numberOfDigits={6}
                    onTextChange={setCode}
                    onFilled={() => Keyboard.dismiss()}
                    theme={{
                      pinCodeContainerStyle: styles.pinCodeContainerStyle,
                      focusedPinCodeContainerStyle:
                        styles.focusedPinCodeContainerStyle,
                      containerStyle: styles.pinContainerStyle,
                    }}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <View style={defaultStyles.bottomContainerWithContent}>
        <Button
          mode="contained"
          buttonColor={Colors.primary['500']}
          style={defaultStyles.button}
          disabled={loading || code?.length < 6}
          loading={loading}
          onPress={handleConfirmCode}>
          <Text style={defaultStyles.buttonText}>
            {i18n.t('(auth).phone-number-verification-pin-reset.verify')}
          </Text>
        </Button>
        <View style={styles.bottomLinkContainer}>
          <Text>
            {i18n.t('(auth).phone-number-verification-pin-reset.didntReceive')}?
          </Text>
          <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
            <Text style={styles.linkText}>
              {i18n.t('(auth).phone-number-verification-pin-reset.resend')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <Snackbar
        visible={!!error}
        onDismiss={() => {}}
        duration={3000}
        style={defaultStyles.snackbar}>
        <Text style={defaultStyles.errorText}>{error}</Text>
      </Snackbar>
    </>
  );
}
