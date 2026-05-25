// import { Colors } from '@/constants';
// import { useRouter } from 'expo-router';
// import React, { useContext } from 'react';
// import {
//   View,
//   Text,
//   KeyboardAvoidingView,
//   TouchableWithoutFeedback,
//   Keyboard,
//   ScrollView,
//   TouchableOpacity,
// } from 'react-native';
// import { Appbar, Button, Icon } from 'react-native-paper';
// import { defaultStyles, signupStyles as styles } from '@/styles';
// import { Context, ContextType } from './_layout';
// import i18n from './../i18n';

// export default function NewEmailVerification() {
//   const { user } = useContext(Context) as ContextType;

//   const router = useRouter();
//   return (
//     <>
//       <KeyboardAvoidingView
//         style={defaultStyles.container}
//         behavior="padding"
//         keyboardVerticalOffset={24}>
//         <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
//           <View style={defaultStyles.flex}>
//             <Appbar.Header dark={false} style={defaultStyles.appHeader}>
//               <TouchableOpacity
//                 onPress={() => router.back()}
//                 style={defaultStyles.backButtonContainer}>
//                 <Icon source={'arrow-left'} size={24} />
//               </TouchableOpacity>
//               <View style={defaultStyles.headerTextContainer}>
//                 <Text style={defaultStyles.headerText}>
//                   {i18n.t('(auth).email-verification.emailVerification')}
//                 </Text>
//               </View>
//             </Appbar.Header>
//             <ScrollView
//               style={defaultStyles.scrollContainer}
//               showsVerticalScrollIndicator={false}
//               nestedScrollEnabled={true}
//               keyboardShouldPersistTaps="handled">
//               <View style={defaultStyles.contentContainer}>
//                 <View style={styles.emailVerificationTextContainer}>
//                   <Text style={styles.emailVerificationText}>
//                     {i18n.t('(auth).email-verification.checkYourEmail')}{' '}
//                     <Text
//                       style={
//                         styles.linkText
//                       }>{`${user?.email_address}`}</Text>{' '}
//                     {i18n.t(
//                       '(auth).email-verification.andFollowTheInstructions',
//                     )}
//                   </Text>
//                 </View>
//               </View>
//             </ScrollView>
//           </View>
//         </TouchableWithoutFeedback>
//       </KeyboardAvoidingView>
//       <View style={defaultStyles.bottomButtonContainer}>
//         <Button
//           mode="contained"
//           buttonColor={Colors.primary['500']}
//           style={defaultStyles.button}
//           onPress={() => router.push('/profile')}>
//           <Text style={defaultStyles.buttonText}>
//             {i18n.t('(auth).email-verification.next')}
//           </Text>
//         </Button>
//       </View>
//     </>
//   );
// }

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
import { Context, ContextType } from './_layout';
import { delay } from '@/utils';
import {
  useConfirmVerificationCode,
  useResendVerificationCode,
} from '@/hooks/users.hooks';
import i18n from './../i18n';

export default function PhoneNumberVerificationPinReset() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const { user, lang } = useContext(Context) as ContextType;

  const otpInputRef = useRef<OtpInputRef>(null);

  const router = useRouter();

  //   const { mutateAsync: resendOtp } = useResendPhoneNumberVerificationCode(
  //     data => {
  //       // TODO: remove this in production
  //       const newCode = (data?.code ?? '')?.match(/^\d+/)?.[0];
  //       if (newCode) {
  //         setCode(newCode);
  //         otpInputRef.current?.setValue(newCode);
  //       }
  //     },
  //     async error => {
  //       setLoading(false);
  //       if (typeof error?.response?.data?.message === 'string') {
  //         setError(error?.response?.data?.message);
  //         await delay(5000);
  //         setError(undefined);
  //       } else if (
  //         Array.isArray(error?.response?.data?.message) &&
  //         typeof error?.response?.data?.message[0] === 'string'
  //       ) {
  //         setError(error?.response?.data?.message[0]);
  //         await delay(5000);
  //         setError(undefined);
  //       } else {
  //         setError(
  //           i18n.t('(auth).phone-number-verification-pin-reset.unknownError'),
  //         );
  //         await delay(5000);
  //         setError(undefined);
  //       }
  //     },
  //   );

  const handleResendOtp = async () => {
    try {
      setLoading(true);
      await resendOtp({
        id: user?.id,
        channel: 'email',
      });
    } catch {
      // TODO: Handle error if necessary
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    try {
      setLoading(true);
      await confirmVerificationCode({
        user_id: user?.id,
        code,
        channel: 'email',
      });
    } catch {
      // TODO: Handle error if necessary
    } finally {
      setLoading(false);
    }
  };

  const { mutateAsync: confirmVerificationCode } = useConfirmVerificationCode(
    lang,
    () => {
      router.push('/profile');
    },
    async error => {
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
        setError(
          i18n.t('(auth).phone-number-verification-pin-reset.unknownError'),
        );
        await delay(5000);
        setError(undefined);
      }
    },
  );

  const { mutateAsync: resendOtp } = useResendVerificationCode(
    lang,
    () => {},
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
        setError(i18n.t('(auth).phone-number-verification.unknownError'));
        await delay(5000);
        setError(undefined);
      }
    },
  );

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
