import { Colors } from '@/constants';
import { defaultStyles, loginStyles as styles } from '@/styles';
import React, { useContext, useState } from 'react';
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
import {
  Appbar,
  Button,
  HelperText,
  Icon,
  Snackbar,
  TextInput,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { delay } from '@/utils';
import { getSupabase } from '@/lib/supabase/client';
import { Context, ContextType } from '../_layout';
import i18n from '../../i18n';

export default function Login() {
  const router = useRouter();
  const [password, setPasswrod] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const { user } = useContext(Context) as ContextType;
  const { code } = useLocalSearchParams<{ code?: string }>();

  const handleResetPinCode = async () => {
    const email = user?.email_address?.trim();
    const codeVal = (code as string)?.trim();
    if (!email || !codeVal || !password || password.length < 6 || password !== confirmPassword) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError(i18n.t('(auth).reset-pin.unknownError'));
      return;
    }
    try {
      setLoading(true);
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: codeVal,
        type: 'recovery',
      });
      if (otpError) {
        setError(otpError.message ?? i18n.t('(auth).reset-pin.unknownError'));
        setLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message ?? i18n.t('(auth).reset-pin.unknownError'));
        setLoading(false);
        return;
      }
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('(auth).reset-pin.unknownError'));
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
            </Appbar.Header>
            <View style={styles.illustratorImageContainer}>
              <Image
                source={require('@/assets/images/forgot_illustration.png')}
              />
            </View>
            <View style={styles.forgotHeadingContainer}>
              <Text style={defaultStyles.headerText}>
                {i18n.t('(auth).reset-password.resetPassword')}
              </Text>
              <Text style={defaultStyles.subheaderText}>
                {i18n.t('(auth).reset-password.createNewPassword')}
              </Text>
            </View>
            <ScrollView
              style={defaultStyles.scrollContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled">
              <View style={defaultStyles.contentContainer}>
                <View style={[styles.inputsContainer]}>
                  <TextInput
                    mode="outlined"
                    outlineStyle={defaultStyles.outlineStyle}
                    style={defaultStyles.input}
                    left={<TextInput.Icon icon={'lock-outline'} />}
                    placeholder={i18n.t('(auth).reset-password.newPassword')}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setShowPassword(prev => !prev)}
                      />
                    }
                    secureTextEntry={!showPassword}
                    // inputMode="numeric"
                    onChangeText={setPasswrod}
                    value={password}
                  />
                  {!!password && password.length < 8 && (
                    <HelperText type="error">
                      {i18n.t('(auth).reset-password.passwordShouldBe')}
                    </HelperText>
                  )}
                  <TextInput
                    mode="outlined"
                    outlineStyle={defaultStyles.outlineStyle}
                    style={defaultStyles.input}
                    left={<TextInput.Icon icon={'lock-outline'} />}
                    placeholder={i18n.t(
                      '(auth).reset-password.confirmPassword',
                    )}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setShowPassword(prev => !prev)}
                      />
                    }
                    secureTextEntry={!showPassword}
                    onChangeText={setConfirmPassword}
                    value={confirmPassword}
                  />
                  {!!password &&
                    !!confirmPassword &&
                    password != confirmPassword && (
                      <HelperText type="error">
                        {i18n.t('(auth).reset-password.passwordsDoNot')}
                      </HelperText>
                    )}
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
          style={defaultStyles.button}
          loading={loading}
          disabled={
            loading ||
            !password ||
            !confirmPassword ||
            (!!password && !!confirmPassword && password !== confirmPassword)
          }
          onPress={handleResetPinCode}>
          <Text style={defaultStyles.buttonText}>
            {i18n.t('(auth).reset-password.updatePassword')}
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
