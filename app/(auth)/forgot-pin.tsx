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
import { Appbar, Button, Icon, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { PhoneNumberInput } from '@/components';
import { delay } from '@/utils';
import { getSupabase } from '@/lib/supabase/client';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { Context, ContextType } from '../_layout';
import i18n from '../../i18n';

export default function Login() {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [isPhoneNumberValid, setIsPhoneNumberValid] = useState(false);

  const { setUser } = useContext(Context) as ContextType;

  const handleForgotPin = async () => {
    const phone = `${countryCode}${phoneNumber}`;
    if (!phone) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError(i18n.t('(auth).forgot-pin.unknownError'));
      return;
    }
    try {
      setLoading(true);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        setError(otpError.message ?? i18n.t('(auth).forgot-pin.unknownError'));
        await delay(5000);
        setError(undefined);
        setLoading(false);
        return;
      }
      setUser({ id: undefined, phone_number: phone });
      router.push('/phone-number-verification-pin-reset');
    } catch {
      setError(i18n.t('(auth).forgot-pin.unknownError'));
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
            </Appbar.Header>
            <View style={styles.illustratorImageContainer}>
              <Image
                source={require('@/assets/images/forgot_illustration.png')}
              />
            </View>
            <View style={styles.forgotHeadingContainer}>
              <Text style={defaultStyles.headerText}>
                {i18n.t('(auth).forgot-pin.forgotYourPin')}?
              </Text>
              <Text style={defaultStyles.subheaderText}>
                {i18n.t('(auth).forgot-pin.enterYourPhoneNumber')}
              </Text>
            </View>
            <ScrollView
              style={defaultStyles.scrollContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled">
              <View style={defaultStyles.contentContainer}>
                <View style={styles.inputsContainer}>
                  <PhoneNumberInput
                    countryCode={countryCode}
                    setCountryCode={setCountryCode}
                    phoneNumber={phoneNumber}
                    setPhoneNumber={setPhoneNumber}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
      <View style={defaultStyles.bottomButtonContainer}>
        <Button
          mode="contained"
          buttonColor={Colors.primary['500']}
          onPress={handleForgotPin}
          loading={loading}
          disabled={loading || !isPhoneNumberValid}
          style={defaultStyles.button}>
          <Text style={defaultStyles.buttonText}>
            {i18n.t('(auth).forgot-pin.recoverPin')}
          </Text>
        </Button>
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
