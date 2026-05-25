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
import { delay } from '@/utils';
import { getSupabase } from '@/lib/supabase/client';
import { Context, ContextType } from '../_layout';
import i18n from '@/i18n';

export default function PhoneNumberVerificationPinReset() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const { user } = useContext(Context) as ContextType;

  const otpInputRef = useRef<OtpInputRef>(null);

  const router = useRouter();

  const identifier = user?.email_address ?? '';

  const handleResendOtp = async () => {
    if (!identifier) {
      setError('Email not available. Please try again from forgot password.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError(i18n.t('(auth).phone-number-verification-pin-reset.unknownError'));
      return;
    }
    try {
      setLoading(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(identifier);
      if (resetError) {
        setError(resetError.message ?? 'Failed to resend code');
        await delay(5000);
        setError(undefined);
      }
    } catch {
      setError(i18n.t('(auth).phone-number-verification-pin-reset.unknownError'));
      await delay(5000);
      setError(undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    if (code.length < 6) return;
    router.push({
      pathname: '/reset-password',
      params: { code },
    });
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
