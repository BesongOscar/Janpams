import { Colors } from '@/constants';
import { defaultStyles, signupStyles as styles } from '@/styles';
import { useRouter } from 'expo-router';
import React, { useContext, useRef, useState } from 'react';
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
import parsePhoneNumberFromString from 'libphonenumber-js';
import { Context, ContextType } from '../_layout';
import { delay, updateAuthHeader } from '@/utils';
import { syncRolesFromBackend } from '@/lib/rolesSync';
import { getSupabase } from '@/lib/supabase/client';
import { mapSupabaseUser } from '@/lib/supabase/mapSupabaseUser';
import i18n from '../../i18n';
import { OTPChannel } from '@/interfaces';

export default function Signup() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<OTPChannel>('whatsapp');

  const { user, setUser, lang } = useContext(Context) as ContextType;

  const otpInputRef = useRef<OtpInputRef>(null);

  const router = useRouter();

  const isEmailVerification = !!user?.email_address;
  const identifier = user?.email_address ?? user?.phone_number ?? '';

  const handleResendOtp = async (newChannel?: OTPChannel) => {
    if (!user?.id || !identifier) {
      setError('User information not available. Please try again.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError(i18n.t('(auth).phone-number-verification.unknownError'));
      return;
    }
    try {
      setLoading(true);
      if (isEmailVerification) {
        const { error: resendError } = await supabase.auth.resend({
          email: identifier,
          type: 'signup',
        });
        if (resendError) {
          setError(resendError.message ?? 'Failed to resend code');
          await delay(5000);
          setError(undefined);
        }
      }
    } catch {
      setError(i18n.t('(auth).phone-number-verification.unknownError'));
      await delay(5000);
      setError(undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!user?.id || !identifier) {
      setError('User information not available. Please try again.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError(i18n.t('(auth).phone-number-verification.unknownError'));
      return;
    }
    try {
      setLoading(true);
      if (isEmailVerification) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: identifier,
          token: code.trim(),
          type: 'signup',
        });
        if (verifyError) {
          setError(verifyError.message ?? 'Invalid or expired code');
          setLoading(false);
          return;
        }
      } else {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: 'sms',
          token: code.trim(),
          phone: identifier,
        });
        if (verifyError) {
          setError(verifyError.message ?? 'Invalid or expired code');
          setLoading(false);
          return;
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(mapSupabaseUser(session.user));
        updateAuthHeader(session.access_token);
        await syncRolesFromBackend(session.user.id).catch(() => {});
      }
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('(auth).phone-number-verification.unknownError'));
      await delay(5000);
      setError(undefined);
    } finally {
      setLoading(false);
    }
  };

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
                  {i18n.t('(auth).phone-number-verification.phoneVerification')}
                </Text>
              </View>
            </Appbar.Header>
            <View style={styles.haderTextContainer}>
              <Text style={styles.headerText}>
                {channel === 'whatsapp'
                  ? i18n.t(
                      '(auth).phone-number-verification.enterVerificationCodeWhatsapp',
                    )
                  : i18n.t(
                      '(auth).phone-number-verification.enterVerificationCode',
                    )}{' '}
                <Text
                  style={
                    styles.phoneNumberText
                  }>{`${parsePhoneNumberFromString(`${user?.phone_number}`)?.formatInternational()}`}</Text>
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
                  <View style={defaultStyles.resendOTPContainer}>
                    <View style={styles.bottomLinkContainer}>
                      <Text>Didn&apos;t receive a code?</Text>
                      <TouchableOpacity
                        onPress={() => handleResendOtp()}
                        disabled={loading}>
                        <Text style={styles.linkText}>
                          {i18n.t('(auth).phone-number-verification.resend')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      disabled={loading}
                      onPress={() => {
                        switch (channel) {
                          case 'sms':
                            setChannel('whatsapp');
                            handleResendOtp('whatsapp');
                            break;
                          case 'whatsapp':
                            setChannel('sms');
                            handleResendOtp('sms');
                            break;
                        }
                      }}>
                      <Text style={styles.linkText}>
                        {channel === 'whatsapp'
                          ? i18n.t(
                              '(auth).phone-number-verification.sendSmsInstead',
                            )
                          : i18n.t(
                              '(auth).phone-number-verification.sendWhatsappInstead',
                            )}
                      </Text>
                    </TouchableOpacity>
                  </View>
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
            {i18n.t('(auth).phone-number-verification.verify')}
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
