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
import { useRouter } from 'expo-router';
import { Context, ContextType } from '../_layout';
import { delay } from '@/utils';
import { getSupabase } from '@/lib/supabase/client';
import i18n from '../../i18n';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const { setUser } = useContext(Context) as ContextType;

  const handleForgotPassword = async () => {
    const trimmed = email?.trim() ?? '';
    if (!trimmed || !emailRegex.test(trimmed)) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError(i18n.t('(auth).forgot-password.unknownError'));
      return;
    }
    try {
      setLoading(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (resetError) {
        setError(resetError.message ?? i18n.t('(auth).forgot-password.unknownError'));
        await delay(5000);
        setError(undefined);
        setLoading(false);
        return;
      }
      setUser({ id: undefined, email_address: trimmed });
      router.push('/email-verification-reset-password');
    } catch {
      setError(i18n.t('(auth).forgot-password.unknownError'));
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
                {i18n.t('(auth).forgot-password.forgotYourPassword')}?
              </Text>
              <Text style={defaultStyles.subheaderText}>
                {i18n.t('(auth).forgot-password.enterYourEmail')}
              </Text>
            </View>
            <ScrollView
              style={defaultStyles.scrollContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled">
              <View style={defaultStyles.contentContainer}>
                <View style={styles.inputsContainer}>
                  <TextInput
                    mode="outlined"
                    style={defaultStyles.input}
                    outlineStyle={defaultStyles.outlineStyle}
                    left={<TextInput.Icon icon={'email-outline'} />}
                    placeholder={i18n.t('(auth).forgot-password.email')}
                    inputMode="email"
                    value={email}
                    autoCapitalize="none"
                    onChangeText={setEmail}
                  />
                  {!!email && !emailRegex.test(email) && (
                    <HelperText type="error">
                      {i18n.t('(auth).forgot-password.invalidEmail')}
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
          disabled={!email || !emailRegex.test(email ?? '') || loading}
          loading={loading}
          onPress={handleForgotPassword}
          style={defaultStyles.button}>
          <Text style={defaultStyles.buttonText}>
            {i18n.t('(auth).forgot-password.recoverPassword')}
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
